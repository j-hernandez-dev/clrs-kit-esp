import {
    BrokerTerminalCommandType,
    createBrokerTerminalCommand,
    getBrokerTerminalCommand
} from "./BrokerTerminalCommand.js";
import {
    BrokerTerminalError
} from "./BrokerTerminalError.js";
import {
    isBrokerRisk
} from "../core/BrokerRiskRules.js";

const ROOT_COMMAND = "ai";
const ID_COMMANDS = Object.freeze(
    new Set([
        BrokerTerminalCommandType
            .DELETE_CONTRACT,
        BrokerTerminalCommandType
            .ACCEPT_CONTRACT,
        BrokerTerminalCommandType
            .READ_CONTRACT
    ])
);

export class BrokerTerminalParser {

    parse(input) {
        const tokenized =
            tokenizeBrokerTerminalInput(
                input
            );
        const [root, second] =
            tokenized.tokens;

        if (
            root.value.toLowerCase() !==
            ROOT_COMMAND
        ) {
            terminalError(
                "BROKER95_TERMINAL_ROOT_INVALID",
                "Comando desconocido. El único comando raíz es: ai. Prueba ai -?.",
                [{
                    received: root.value,
                    tokenIndex: 0
                }]
            );
        }

        if (!second) {
            return createBrokerTerminalCommand({
                type:
                    BrokerTerminalCommandType
                        .ROOT,
                rawInput: input,
                normalizedInput:
                    tokenized.normalizedInput
            });
        }

        if (!second.value.startsWith("-")) {
            terminalError(
                "BROKER95_TERMINAL_FREE_MESSAGE_DISABLED",
                "Los mensajes libres no están disponibles. Usa ai -? para consultar los comandos.",
                [{ tokenIndex: 1 }]
            );
        }

        const option = second.value
            .toLowerCase();
        const definition =
            getBrokerTerminalCommand(
                option
            );

        if (!definition) {
            terminalError(
                "BROKER95_TERMINAL_OPTION_UNKNOWN",
                "Opción desconocida. Usa ai -? para consultar los comandos disponibles.",
                [{
                    received: second.value,
                    tokenIndex: 1
                }]
            );
        }

        const commandArguments =
            createCommandArguments(
                input,
                tokenized,
                definition
            );

        requireArity(
            definition,
            commandArguments
        );

        return createParsedCommand({
            definition,
            commandArguments,
            rawInput: input,
            normalizedInput:
                tokenized.normalizedInput
        });
    }
}

export const brokerTerminalParser =
    Object.freeze(
        new BrokerTerminalParser()
    );

export function parseBrokerTerminalInput(
    input
) {
    return brokerTerminalParser.parse(input);
}

export function tokenizeBrokerTerminalInput(
    input
) {
    if (typeof input !== "string") {
        terminalError(
            "BROKER95_TERMINAL_INPUT_INVALID",
            "La entrada de la terminal no es válida.",
            [{ inputType: typeof input }]
        );
    }

    const normalizedInput = input.trim();

    if (normalizedInput.length === 0) {
        terminalError(
            "BROKER95_TERMINAL_INPUT_EMPTY",
            "CIPHER espera una instrucción. Usa ai -?.",
            []
        );
    }

    const tokens = Object.freeze(
        [...input.matchAll(/\S+/gu)]
            .map(match => Object.freeze({
                value: match[0],
                start: match.index,
                end:
                    match.index +
                    match[0].length
            }))
    );

    return Object.freeze({
        rawInput: input,
        normalizedInput,
        tokens
    });
}

function createParsedCommand({
    definition,
    commandArguments,
    rawInput,
    normalizedInput
}) {
    let risk = null;
    let contractId = null;
    let documentSelector = null;
    let question = null;

    if (
        definition.type ===
            BrokerTerminalCommandType
                .NEW_CONTRACT &&
        commandArguments.length === 1
    ) {
        risk = commandArguments[0]
            .toLowerCase();

        if (!isBrokerRisk(risk)) {
            terminalError(
                "BROKER95_TERMINAL_RISK_INVALID",
                "Riesgo inválido. Usa: low, medium, high o extreme.",
                [{ received: commandArguments[0] }]
            );
        }
    }

    if (ID_COMMANDS.has(definition.type)) {
        contractId = parseContractId(
            commandArguments[0]
        );
    }

    if (
        isDocumentCommand(definition.type) &&
        commandArguments.length === 1
    ) {
        documentSelector = commandArguments[0];
    }

    if (
        definition.type ===
            BrokerTerminalCommandType.ASK_CODE &&
        commandArguments.length === 1
    ) {
        question = commandArguments[0];
    }

    return createBrokerTerminalCommand({
        type: definition.type,
        option: definition.option,
        arguments: commandArguments,
        risk,
        contractId,
        documentSelector,
        question,
        requiresLlm:
            definition.requiresLlm,
        requiresActiveDocument:
            definition
                .requiresActiveDocument,
        rawInput,
        normalizedInput
    });
}

function createCommandArguments(
    rawInput,
    tokenized,
    definition
) {
    const argumentTokens = tokenized.tokens.slice(2);

    if (
        definition.type ===
            BrokerTerminalCommandType.ASK_CODE
    ) {
        return argumentTokens.length === 0
            ? []
            : [normalizeAskQuestion(
                rawInput.slice(argumentTokens[0].start)
            )];
    }

    if (
        !isDocumentCommand(definition.type) ||
        argumentTokens.length === 0
    ) {
        return argumentTokens.map(token => token.value);
    }

    return [normalizeDocumentSelector(
        rawInput.slice(argumentTokens[0].start)
    )];
}

function normalizeAskQuestion(value) {
    const normalized = value.trim();

    if (
        normalized.length === 0 ||
        normalized.length > 8_192 ||
        normalized.includes("\u0000")
    ) {
        terminalError(
            "BROKER95_TERMINAL_ASK_QUESTION_INVALID",
            "La pregunta para CIPHER no es válida.",
            []
        );
    }

    return normalized;
}

function normalizeDocumentSelector(value) {
    const selected = value.trim();
    const openingQuote = selected[0];
    const quoted = openingQuote === "\"" ||
        openingQuote === "'";
    let normalized = selected;

    if (quoted) {
        if (
            selected.length < 2 ||
            selected.at(-1) !== openingQuote
        ) {
            terminalError(
                "BROKER95_TERMINAL_DOCUMENT_SELECTOR_INVALID",
                "La ruta del documento contiene comillas incompletas.",
                []
            );
        }

        normalized = selected.slice(1, -1).trim();
    } else if (
        selected.endsWith("\"") ||
        selected.endsWith("'")
    ) {
        terminalError(
            "BROKER95_TERMINAL_DOCUMENT_SELECTOR_INVALID",
            "La ruta del documento contiene comillas incompletas.",
            []
        );
    }

    if (
        normalized.length === 0 ||
        normalized.length > 2_048 ||
        normalized.includes("\u0000")
    ) {
        terminalError(
            "BROKER95_TERMINAL_DOCUMENT_SELECTOR_INVALID",
            "La ruta del documento no es válida.",
            []
        );
    }

    return normalized;
}

function isDocumentCommand(type) {
    return type ===
        BrokerTerminalCommandType.REVIEW_CODE ||
        type === BrokerTerminalCommandType.PUSH_CODE;
}

function requireArity(
    definition,
    commandArguments
) {
    if (
        commandArguments.length <
        definition.minimumArguments
    ) {
        terminalError(
            "BROKER95_TERMINAL_ARGUMENT_REQUIRED",
            `La opción ${definition.option} requiere un argumento.`,
            [{
                option: definition.option,
                expectedMinimum:
                    definition.minimumArguments,
                received:
                    commandArguments.length
            }]
        );
    }

    if (
        commandArguments.length >
        definition.maximumArguments
    ) {
        terminalError(
            "BROKER95_TERMINAL_ARGUMENT_UNEXPECTED",
            `La opción ${definition.option} recibió argumentos adicionales.`,
            [{
                option: definition.option,
                expectedMaximum:
                    definition.maximumArguments,
                received:
                    commandArguments.length
            }]
        );
    }
}

function parseContractId(value) {
    if (!/^[1-9]\d*$/u.test(value)) {
        invalidContractId(value);
    }

    const parsed = Number(value);

    if (!Number.isSafeInteger(parsed)) {
        invalidContractId(value);
    }

    return parsed;
}

function invalidContractId(value) {
    terminalError(
        "BROKER95_TERMINAL_CONTRACT_ID_INVALID",
        "El ID del contrato debe ser un entero positivo válido.",
        [{ received: value }]
    );
}

function terminalError(
    code,
    publicMessage,
    diagnostics
) {
    throw new BrokerTerminalError(
        code,
        publicMessage,
        diagnostics
    );
}
