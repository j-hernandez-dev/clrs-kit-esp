import test from "node:test";
import assert from "node:assert/strict";

import {
    BROKER_TERMINAL_COMMANDS,
    BrokerTerminalCommandType,
    BrokerTerminalParser,
    BrokerTerminalError,
    parseBrokerTerminalInput,
    tokenizeBrokerTerminalInput
} from "../src/broker95/index.js";

test("reconoce el comando raíz y todas las opciones documentadas", () => {
    const corpus = [
        ["ai", BrokerTerminalCommandType.ROOT],
        ["ai -?", BrokerTerminalCommandType.HELP],
        ["ai -new", BrokerTerminalCommandType.NEW_CONTRACT],
        ["ai -delete 12", BrokerTerminalCommandType.DELETE_CONTRACT],
        ["ai -set 12", BrokerTerminalCommandType.ACCEPT_CONTRACT],
        ["ai -purge", BrokerTerminalCommandType.PURGE_CONTRACTS],
        ["ai -get", BrokerTerminalCommandType.LIST_CONTRACTS],
        ["ai -read 12", BrokerTerminalCommandType.READ_CONTRACT],
        ["ai -review", BrokerTerminalCommandType.REVIEW_CODE],
        ["ai -ask", BrokerTerminalCommandType.ASK_CODE],
        ["ai -push", BrokerTerminalCommandType.PUSH_CODE],
        ["ai -info", BrokerTerminalCommandType.INFO],
        ["ai -gameinfo", BrokerTerminalCommandType.GAME_INFO]
    ];

    for (const [input, expectedType] of corpus) {
        assert.equal(
            parseBrokerTerminalInput(input).type,
            expectedType,
            input
        );
    }

    assert.equal(
        BROKER_TERMINAL_COMMANDS.length,
        12
    );
});

test("normaliza comando, opción y riesgo sin alterar la entrada", () => {
    const parsed = parseBrokerTerminalInput(
        "  AI   -NEW   HIGH  "
    );

    assert.equal(
        parsed.type,
        BrokerTerminalCommandType.NEW_CONTRACT
    );
    assert.equal(parsed.root, "ai");
    assert.equal(parsed.option, "-new");
    assert.equal(parsed.risk, "high");
    assert.deepEqual(parsed.arguments, ["HIGH"]);
    assert.equal(
        parsed.rawInput,
        "  AI   -NEW   HIGH  "
    );
    assert.equal(
        parsed.normalizedInput,
        "AI   -NEW   HIGH"
    );
});

test("ai -new permite riesgo omitido o explícito", () => {
    const automatic =
        parseBrokerTerminalInput(
            "ai -new"
        );
    const explicit =
        parseBrokerTerminalInput(
            "ai -new extreme"
        );

    assert.equal(automatic.risk, null);
    assert.equal(explicit.risk, "extreme");
    assert.equal(automatic.requiresLlm, true);
});

test("convierte IDs canónicos en enteros seguros", () => {
    const read = parseBrokerTerminalInput(
        "ai -read 42"
    );
    const accept = parseBrokerTerminalInput(
        "ai -set 9"
    );
    const remove = parseBrokerTerminalInput(
        "ai -delete 3"
    );

    assert.equal(read.contractId, 42);
    assert.equal(accept.contractId, 9);
    assert.equal(remove.contractId, 3);
});

test("rechaza mensajes libres antes de crear una operación LLM", () => {
    for (const input of [
        "ai hola",
        "  ai   ¿qué opinas de mi solución?  "
    ]) {
        assertTerminalError(
            input,
            "BROKER95_TERMINAL_FREE_MESSAGE_DISABLED"
        );
    }
});

test("ai -ask conserva una pregunta libre o solicita ayuda sin mensaje", () => {
    const direct = parseBrokerTerminalInput(
        "ai -ask Hola, ¿por qué mi ciclo no termina?"
    );
    const offered = parseBrokerTerminalInput(
        "ai -ask"
    );

    assert.equal(
        direct.type,
        BrokerTerminalCommandType.ASK_CODE
    );
    assert.equal(
        direct.question,
        "Hola, ¿por qué mi ciclo no termina?"
    );
    assert.deepEqual(
        direct.arguments,
        ["Hola, ¿por qué mi ciclo no termina?"]
    );
    assert.equal(direct.requiresLlm, true);
    assert.equal(
        direct.requiresActiveDocument,
        true
    );
    assert.equal(offered.question, null);
    assert.deepEqual(offered.arguments, []);
});

test("ai -review y ai -push aceptan un selector documental opcional", () => {
    const review = parseBrokerTerminalInput(
        "ai -review algoritmos/ordenamiento.clrs"
    );
    const push = parseBrokerTerminalInput(
        "ai -push curso/práctica final.clrs"
    );

    assert.equal(
        review.documentSelector,
        "algoritmos/ordenamiento.clrs"
    );
    assert.deepEqual(
        review.arguments,
        ["algoritmos/ordenamiento.clrs"]
    );
    assert.equal(
        push.documentSelector,
        "curso/práctica final.clrs"
    );
    assert.deepEqual(
        push.arguments,
        ["curso/práctica final.clrs"]
    );
});

test("preserva espacios de rutas documentales con o sin comillas", () => {
    const cases = [
        [
            "ai -review carpeta con espacios/solución.clrs",
            "carpeta con espacios/solución.clrs"
        ],
        [
            "ai -push \"Curso Uno/Entrega final.clrs\"",
            "Curso Uno/Entrega final.clrs"
        ],
        [
            "ai -review 'Otra Carpeta/reto 1.clrs'",
            "Otra Carpeta/reto 1.clrs"
        ]
    ];

    for (const [input, expected] of cases) {
        const command = parseBrokerTerminalInput(input);

        assert.equal(command.documentSelector, expected, input);
        assert.deepEqual(command.arguments, [expected], input);
    }
});

test("rechaza selectores documentales vacíos, desmedidos o con comillas incompletas", () => {
    for (const input of [
        "ai -review \"\"",
        "ai -push ''",
        "ai -review \"carpeta/reto.clrs",
        "ai -push carpeta/reto.clrs'",
        `ai -review ${"a".repeat(2_049)}.clrs`,
        "ai -push carpeta/\u0000reto.clrs"
    ]) {
        assertTerminalError(
            input,
            "BROKER95_TERMINAL_DOCUMENT_SELECTOR_INVALID"
        );
    }
});

test("una opción desconocida no se degrada a conversación", () => {
    assertTerminalError(
        "ai -unknown",
        "BROKER95_TERMINAL_OPTION_UNKNOWN"
    );
    assertTerminalError(
        "ai --hola",
        "BROKER95_TERMINAL_OPTION_UNKNOWN"
    );
});

test("rechaza comandos raíz distintos de ai", () => {
    assertTerminalError(
        "npm -new",
        "BROKER95_TERMINAL_ROOT_INVALID"
    );
    assertTerminalError(
        "cipher hola",
        "BROKER95_TERMINAL_ROOT_INVALID"
    );
});

test("valida la aridad de cada opción", () => {
    for (const input of [
        "ai -read",
        "ai -set",
        "ai -delete"
    ]) {
        assertTerminalError(
            input,
            "BROKER95_TERMINAL_ARGUMENT_REQUIRED"
        );
    }

    for (const input of [
        "ai -? extra",
        "ai -new low extra",
        "ai -get extra",
        "ai -read 1 extra"
    ]) {
        assertTerminalError(
            input,
            "BROKER95_TERMINAL_ARGUMENT_UNEXPECTED"
        );
    }
});

test("rechaza riesgos e IDs no canónicos", () => {
    assertTerminalError(
        "ai -new impossible",
        "BROKER95_TERMINAL_RISK_INVALID"
    );

    for (const value of [
        "0",
        "-1",
        "+1",
        "01",
        "1.5",
        "9007199254740992"
    ]) {
        assertTerminalError(
            `ai -read ${value}`,
            "BROKER95_TERMINAL_CONTRACT_ID_INVALID"
        );
    }
});

test("distingue dependencias de LLM y documento activo", () => {
    const review =
        parseBrokerTerminalInput(
            "ai -review"
        );
    const push = parseBrokerTerminalInput(
        "ai -push"
    );
    const list = parseBrokerTerminalInput(
        "ai -get"
    );

    assert.equal(review.requiresLlm, true);
    assert.equal(review.documentSelector, null);
    assert.equal(
        review.requiresActiveDocument,
        true
    );
    assert.equal(push.requiresLlm, true);
    assert.equal(push.documentSelector, null);
    assert.equal(
        push.requiresActiveDocument,
        true
    );
    assert.equal(list.requiresLlm, false);
    assert.equal(
        list.requiresActiveDocument,
        false
    );
});

test("tokeniza espacios y saltos de línea con ubicaciones estables", () => {
    const tokenized =
        tokenizeBrokerTerminalInput(
            " ai\n-new\tmedium "
        );

    assert.deepEqual(
        tokenized.tokens.map(token =>
            token.value
        ),
        ["ai", "-new", "medium"]
    );
    assert.deepEqual(
        tokenized.tokens.map(token =>
            [token.start, token.end]
        ),
        [[1, 3], [4, 8], [9, 15]]
    );
});

test("rechaza entradas vacías o de tipo incorrecto", () => {
    assertTerminalError(
        "   \n\t ",
        "BROKER95_TERMINAL_INPUT_EMPTY"
    );

    assert.throws(
        () => parseBrokerTerminalInput(null),
        error =>
            error instanceof
                BrokerTerminalError &&
            error.code ===
                "BROKER95_TERMINAL_INPUT_INVALID"
    );
});

test("los comandos resultantes son profundamente inmutables", () => {
    const command =
        new BrokerTerminalParser().parse(
            "ai -new low"
        );

    assert.equal(
        Object.isFrozen(command),
        true
    );
    assert.equal(
        Object.isFrozen(command.arguments),
        true
    );
});

function assertTerminalError(input, code) {
    assert.throws(
        () => parseBrokerTerminalInput(input),
        error =>
            error instanceof
                BrokerTerminalError &&
            error.code === code &&
            typeof error.publicMessage ===
                "string"
    );
}
