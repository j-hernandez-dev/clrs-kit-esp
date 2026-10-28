import assert from "node:assert/strict";
import test from "node:test";

import {
    BROKER_CONTRACT_CYCLE_LIMITS,
    BrokerContractCycleOperation,
    BrokerContractCycleService,
    BrokerContractState,
    BrokerRisk,
    addBrokerContract,
    createBrokerGameState,
    parseBrokerTerminalInput
} from "../src/broker95/index.js";

test("coordina solicitud, inspecci\u00f3n y aceptaci\u00f3n mostrando las pruebas requeridas", async () => {
    const session = createMemorySession();
    const generatedRisks = [];
    const service = new BrokerContractCycleService({
        gameSession: session,
        contractService: {
            async generate({ risk }) {
                generatedRisks.push(risk);
                let contract = null;

                await session.transact(current => {
                    const next = addBrokerContract(
                        current,
                        contractDraft({
                            risk,
                            title: "Validar registros"
                        })
                    );
                    contract = next.contracts.at(-1);

                    return next;
                });

                return Object.freeze({ contract });
            }
        },
        now: () => 1_700_000_000_000
    });

    const generated = await service.execute(
        parseBrokerTerminalInput("ai -new medium")
    );
    const listed = await service.execute(
        parseBrokerTerminalInput("ai -get")
    );
    const inspected = await service.execute(
        parseBrokerTerminalInput("ai -read 1")
    );
    const accepted = await service.execute(
        parseBrokerTerminalInput("ai -set 1")
    );
    const information = await service.execute(
        parseBrokerTerminalInput("ai -info")
    );
    const gameInformation = await service.execute(
        parseBrokerTerminalInput("ai -gameinfo")
    );
    const help = await service.execute(
        parseBrokerTerminalInput("ai -?")
    );

    assert.deepEqual(generatedRisks, [BrokerRisk.MEDIUM]);
    assert.equal(
        generated.operation,
        BrokerContractCycleOperation.NEW
    );
    assert.match(
        generated.messages[0].text,
        /NUEVO CONTRATO DISPONIBLE/u
    );
    assert.match(
        listed.messages[0].text,
        /#1 \[MEDIO\] \[PENDIENTE\]/u
    );
    assert.match(
        inspected.messages[0].text,
        /Validar registros/u
    );
    assert.match(
        inspected.messages[0].text,
        /REQUISITOS/u
    );
    assert.match(
        inspected.messages[0].text,
        /PRUEBAS DE ACEPTACI\u00d3N/u
    );
    assert.match(
        inspected.messages[0].text,
        /TC-PRIVADO/u
    );
    assert.match(
        inspected.messages[0].text,
        /Comprueba el resultado solicitado/u
    );
    assert.match(
        inspected.messages[0].text,
        /"resultado-secreto"/u
    );
    assert.match(
        accepted.messages[0].text,
        /Contrato #1 aceptado/u
    );
    assert.equal(
        session.getState().activeContractId,
        1
    );
    assert.equal(
        session.getState().contracts[0].state,
        BrokerContractState.ACTIVE
    );
    assert.equal(session.getState().alertLevel, 1);
    assert.equal(
        session.getState().contracts[0].acceptedAt,
        1_700_000_000_000
    );
    assert.match(
        information.messages[0].text,
        /Contrato activo:\s+#1 Validar registros/u
    );
    assert.doesNotMatch(
        information.messages[0].text,
        /PONDERACIÓN POR RIESGO|CATÁLOGO DE CRITERIOS/u
    );
    assert.match(
        gameInformation.messages[0].text,
        /Bienvenido a BROKER\.95, operador/u
    );
    assert.match(
        gameInformation.messages[0].text,
        /PONDERACIÓN POR RIESGO/u
    );
    assert.match(
        gameInformation.messages[0].text,
        /CATÁLOGO DE CRITERIOS/u
    );
    assert.match(
        gameInformation.messages[0].text,
        /F-CUM · Cumplimiento/u
    );
    assert.match(
        gameInformation.messages[0].text,
        /R-SEG · Operaciones seguras/u
    );
    assert.match(
        gameInformation.messages[0].text,
        /D-CLA/u
    );
    assert.match(
        gameInformation.messages[0].text,
        /ai -new low/u
    );
    assert.match(
        help.messages[0].text,
        /Estructura de comandos: ai <opción> \[argumentos\]/u
    );
    assert.match(
        help.messages[0].text,
        /primera vez\? Ejecuta ai -gameinfo/iu
    );
    assert.match(
        help.messages[0].text,
        /ai -ask \[pregunta\]/u
    );
});

test("lista, elimina y purga s\u00f3lo contratos pendientes visibles", async () => {
    const session = createMemorySession();
    await session.transact(current => addBrokerContract(
        current,
        contractDraft({ title: "Primero" })
    ));
    await session.transact(current => addBrokerContract(
        current,
        contractDraft({ title: "Segundo" })
    ));
    const service = createCycle(session);

    const deleted = await service.execute(
        parseBrokerTerminalInput("ai -delete 1")
    );
    const listed = await service.execute(
        parseBrokerTerminalInput("ai -get")
    );
    const purged = await service.execute(
        parseBrokerTerminalInput("ai -purge")
    );
    const empty = await service.execute(
        parseBrokerTerminalInput("ai -get")
    );

    assert.match(
        deleted.messages[0].text,
        /Contrato #1 eliminado/u
    );
    assert.doesNotMatch(listed.messages[0].text, /Primero/u);
    assert.match(listed.messages[0].text, /Segundo/u);
    assert.match(
        purged.messages[0].text,
        /1 contrato pendiente eliminado/u
    );
    assert.match(
        empty.messages[0].text,
        /No hay contratos disponibles/u
    );
    assert.equal(
        session.getState().contracts.every(contract =>
            contract.state === BrokerContractState.DELETED
        ),
        true
    );
    await assert.rejects(
        service.execute(
            parseBrokerTerminalInput("ai -read 1")
        ),
        error =>
            error.code ===
            "BROKER95_CONTRACT_NOT_AVAILABLE"
    );
});

test("una solicitud correlacionada genera y persiste un solo contrato", async () => {
    const session = createMemorySession();
    let generations = 0;
    const service = new BrokerContractCycleService({
        gameSession: session,
        contractService: {
            async generate({ risk }) {
                generations += 1;
                let contract;

                await session.transact(current => {
                    const next = addBrokerContract(
                        current,
                        contractDraft({ risk })
                    );

                    contract = next.contracts.at(-1);
                    return next;
                });

                return Object.freeze({ contract });
            }
        }
    });
    const command = parseBrokerTerminalInput(
        "ai -new low"
    );
    const options = {
        requestId: "contract-cycle:idempotent:1"
    };
    const [first, duplicate] =
        await Promise.all([
            service.execute(command, options),
            service.execute(command, options)
        ]);

    assert.equal(first, duplicate);
    assert.equal(generations, 1);
    assert.equal(
        session.getState().contracts.length,
        1
    );
    assert.equal(
        await service.execute(command, options),
        first
    );
    assert.equal(generations, 1);
});

test("el ciclo conserva comandos futuros fuera de su frontera", async () => {
    const service = createCycle(createMemorySession());

    assert.equal(
        service.canExecute(
            parseBrokerTerminalInput("ai -review")
        ),
        false
    );
    assert.equal(
        service.canExecute(
            parseBrokerTerminalInput("ai -ask")
        ),
        false
    );
    await assert.rejects(
        service.execute(
            parseBrokerTerminalInput("ai -review")
        ),
        error =>
            error.code ===
            "BROKER95_CONTRACT_CYCLE_COMMAND_UNSUPPORTED"
    );
});

test("acota ai -get a contratos recientes sin borrar el historial", async () => {
    const session = createMemorySession();
    const count = BROKER_CONTRACT_CYCLE_LIMITS
        .maximumListedContracts + 1;

    for (let index = 1; index <= count; index += 1) {
        await session.transact(current => addBrokerContract(
            current,
            contractDraft({ title: `Contrato ${index}` })
        ));
    }

    const result = await createCycle(session).execute(
        parseBrokerTerminalInput("ai -get")
    );

    assert.equal(session.getState().contracts.length, count);
    assert.doesNotMatch(
        result.messages[0].text,
        /#1 \[BAJO\]/u
    );
    assert.match(
        result.messages[0].text,
        new RegExp(`#${count} \\[BAJO\\]`, "u")
    );
    assert.match(
        result.messages[0].text,
        /contratos m\u00e1s recientes/u
    );
});

function createCycle(session) {
    return new BrokerContractCycleService({
        gameSession: session,
        contractService: {
            async generate() {
                throw new Error(
                    "Generation is not expected in this test."
                );
            }
        },
        now: () => 1_700_000_000_000
    });
}

function createMemorySession() {
    let state = createBrokerGameState();

    return {
        async initialize() {
            return Object.freeze({ state });
        },
        getState() {
            return state;
        },
        async transact(transition) {
            state = transition(state);

            return state;
        }
    };
}

function contractDraft({
    risk = BrokerRisk.LOW,
    title = "Contrato"
} = {}) {
    return {
        title,
        categoryId: "NUM-ARITH",
        categoryName: "Aritm\u00e9tica",
        familyId: "NUM",
        familyName: "Procesamiento numérico",
        risk,
        description: "Procesa los registros recibidos.",
        requirements: ["Mostrar el resultado solicitado."],
        testCases: [{
            id: "TC-PRIVADO",
            kind: "normal",
            requirementIds: ["REQ-1"],
            explanation:
                "Comprueba el resultado solicitado.",
            stdin: "entrada-secreta",
            expected: "resultado-secreto",
            comparison: "exact",
            timeoutMs: 1_000
        }],
        client: "Cliente local",
        payPotential: risk === BrokerRisk.MEDIUM ? 300 : 100
    };
}
