import {
    requireFunction,
    requirePort
} from "../../application/ports/ApplicationPorts.js";
import {
    BrokerOperationCoordinator,
    createBrokerOperationFingerprint
} from "../application/BrokerOperationCoordinator.js";
import {
    BrokerContractState
} from "../core/BrokerContract.js";
import {
    BrokerGameError
} from "../core/BrokerGameError.js";
import {
    BrokerGameStatus
} from "../core/BrokerGameRules.js";
import {
    BrokerRisk,
    getBrokerRiskRule
} from "../core/BrokerRiskRules.js";
import {
    acceptBrokerContract,
    deleteBrokerContract,
    purgeBrokerContracts
} from "../core/BrokerStateTransition.js";
import {
    BrokerTerminalCommandType
} from "../terminal/BrokerTerminalCommand.js";
import {
    getBrokerEvaluationRubric
} from "../submission/BrokerEvaluationRubric.js";

export const BrokerContractCycleOperation =
    Object.freeze({
        ROOT: "contract/root",
        HELP: "contract/help",
        NEW: "contract/new",
        LIST: "contract/list",
        READ: "contract/read",
        ACCEPT: "contract/accept",
        DELETE: "contract/delete",
        PURGE: "contract/purge",
        INFO: "contract/info",
        GAME_INFO: "contract/game-info"
    });

export const BROKER_CONTRACT_CYCLE_LIMITS =
    Object.freeze({
        maximumListedContracts: 24
    });

const SUPPORTED_COMMANDS = new Map([
    [
        BrokerTerminalCommandType.ROOT,
        BrokerContractCycleOperation.ROOT
    ],
    [
        BrokerTerminalCommandType.HELP,
        BrokerContractCycleOperation.HELP
    ],
    [
        BrokerTerminalCommandType.NEW_CONTRACT,
        BrokerContractCycleOperation.NEW
    ],
    [
        BrokerTerminalCommandType.LIST_CONTRACTS,
        BrokerContractCycleOperation.LIST
    ],
    [
        BrokerTerminalCommandType.READ_CONTRACT,
        BrokerContractCycleOperation.READ
    ],
    [
        BrokerTerminalCommandType.ACCEPT_CONTRACT,
        BrokerContractCycleOperation.ACCEPT
    ],
    [
        BrokerTerminalCommandType.DELETE_CONTRACT,
        BrokerContractCycleOperation.DELETE
    ],
    [
        BrokerTerminalCommandType.PURGE_CONTRACTS,
        BrokerContractCycleOperation.PURGE
    ],
    [
        BrokerTerminalCommandType.INFO,
        BrokerContractCycleOperation.INFO
    ],
    [
        BrokerTerminalCommandType.GAME_INFO,
        BrokerContractCycleOperation.GAME_INFO
    ]
]);

const RISK_LABELS = Object.freeze({
    low: "BAJO",
    medium: "MEDIO",
    high: "ALTO",
    extreme: "EXTREMO"
});

const STATE_LABELS = Object.freeze({
    [BrokerContractState.PENDING]: "PENDIENTE",
    [BrokerContractState.ACTIVE]: "ACTIVO",
    [BrokerContractState.COMPLETED]: "COMPLETADO",
    [BrokerContractState.FAILED]: "FALLIDO",
    [BrokerContractState.DELETED]: "ELIMINADO"
});

/**
 * Coordina exclusivamente el ciclo determinista de contratos. No conoce el
 * protocolo Webview ni ejecuta casos de prueba; el Host conserva esa autoridad.
 */
export class BrokerContractCycleService {

    constructor(options = {}) {
        this.gameSession = requirePort(
            options.gameSession,
            "brokerGameSession",
            ["initialize", "getState", "transact"]
        );
        this.contractService = requirePort(
            options.contractService,
            "brokerContractService",
            ["generate"]
        );
        this.now = requireFunction(
            options.now ?? Date.now,
            "brokerContractCycleClock"
        );
        this.operations = requirePort(
            options.operationCoordinator ??
                new BrokerOperationCoordinator(),
            "brokerContractCycleOperations",
            ["execute"]
        );
    }

    canExecute(command) {
        return command != null &&
            typeof command === "object" &&
            SUPPORTED_COMMANDS.has(command.type);
    }

    async execute(command, options = {}) {
        const operation = requireOperation(command);
        const execution =
            normalizeExecutionOptions(options);

        return this.operations.execute(
            {
                operation,
                requestId:
                    execution.requestId,
                fingerprint:
                    execution.requestId == null
                        ? null
                        : createBrokerOperationFingerprint(
                            command
                        ),
                lane: "contract-cycle"
            },
            () => this.#execute(
                command,
                operation,
                execution
            )
        );
    }

    async #execute(
        command,
        operation,
        execution
    ) {

        await this.gameSession.initialize();

        switch (command.type) {
            case BrokerTerminalCommandType.ROOT:
                return this.#root(operation);

            case BrokerTerminalCommandType.HELP:
                return this.#help(operation);

            case BrokerTerminalCommandType.NEW_CONTRACT:
                return this.#generate(
                    command,
                    operation,
                    execution
                );

            case BrokerTerminalCommandType.LIST_CONTRACTS:
                return this.#list(operation);

            case BrokerTerminalCommandType.READ_CONTRACT:
                return this.#read(command, operation);

            case BrokerTerminalCommandType.ACCEPT_CONTRACT:
                return this.#accept(command, operation);

            case BrokerTerminalCommandType.DELETE_CONTRACT:
                return this.#delete(command, operation);

            case BrokerTerminalCommandType.PURGE_CONTRACTS:
                return this.#purge(operation);

            case BrokerTerminalCommandType.INFO:
                return this.#info(operation);

            case BrokerTerminalCommandType.GAME_INFO:
                return this.#gameInfo(operation);

            default:
                return unreachableContractCommand();
        }
    }

    #root(operation) {
        const state = this.gameSession.getState();
        const active = findActiveContract(state);
        const text = active
            ? `Canal operativo. Contrato activo: #${active.id} ${active.title}. Usa ai -info o ai -? para continuar.`
            : "Canal operativo. Si es tu primera vez, ejecuta ai -gameinfo. Usa ai -? para consultar los comandos.";

        return cycleResult(operation, [
            systemMessage(text)
        ]);
    }

    #help(operation) {
        return cycleResult(operation, [
            systemMessage([
                "┌─[BROKER.95://AYUDA]",
                "│ La terminal te permite interactúar con el sistema de forma directa mediante comandos.",
                "│ Estructura de comandos: ai <opción> [argumentos]",
                "│ ai es el comando raíz; la opción indica la acción y los argumentos aportan datos de entrada.",
                "│ ¿Primera vez? Ejecuta ai -gameinfo para conocer el juego y elegir por dónde empezar.",
                "├─[COMANDOS DISPONIBLES]",
                "ai -new [low|medium|high|extreme]  Solicita un contrato.",
                "ai -get                              Lista contratos disponibles.",
                "ai -read <id>                        Inspecciona un contrato.",
                "ai -set <id>                         Acepta un contrato pendiente.",
                "ai -delete <id>                      Elimina un contrato pendiente.",
                "ai -purge                            Elimina todos los contratos pendientes.",
                "ai -review [ruta.clrs]               CIPHER revisa el documento CLRS seleccionado sin entregar el contrato.",
                "ai -ask [pregunta]                   Consulta a CIPHER sobre tu documento CLRS y el contrato.",
                "ai -push [ruta.clrs]                 Entrega definitivamente a CIPHER el documento CLRS seleccionado.",
                "ai -info                             Consulta el estado de la partida.",
                "ai -gameinfo                         Guía explicativa para comenzar en BROKER.95.",
                "└─[FIN DE LA AYUDA]"
            ].join("\n"))
        ]);
    }

    async #generate(
        command,
        operation,
        execution
    ) {
        const generated = await this.contractService.generate({
            risk: command.risk,
            requestId: execution.requestId
        });
        const contract = requireGeneratedContract(generated);

        return cycleResult(operation, [
            cipherMessage([
                "NUEVO CONTRATO DISPONIBLE",
                formatContractSummary(contract),
                `Usa ai -read ${contract.id} para inspeccionarlo o ai -set ${contract.id} para aceptarlo.`
            ].join("\n"))
        ]);
    }

    #list(operation) {
        const contracts = visibleContracts(
            this.gameSession.getState()
        );
        const displayed = contracts.slice(
            -BROKER_CONTRACT_CYCLE_LIMITS
                .maximumListedContracts
        );
        const text = contracts.length === 0
            ? "No hay contratos disponibles. Solicita uno con ai -new."
            : [
                "CONTRATOS DISPONIBLES",
                ...displayed.map(formatContractSummary),
                ...(displayed.length === contracts.length
                    ? []
                    : [`Mostrando los ${displayed.length} contratos m\u00e1s recientes de ${contracts.length}.`]),
                "Usa ai -read <id> para inspeccionar un contrato."
            ].join("\n");

        return cycleResult(operation, [
            systemMessage(text)
        ]);
    }

    #read(command, operation) {
        const contract = findVisibleContract(
            this.gameSession.getState(),
            command.contractId
        );

        return cycleResult(operation, [
            systemMessage(formatContractDetail(contract))
        ]);
    }

    async #accept(command, operation) {
        let accepted = null;
        const acceptedAt = this.now();
        const state = await this.gameSession.transact(
            (current, transitionOptions) => {
                accepted = findVisibleContract(
                    current,
                    command.contractId
                );

                return acceptBrokerContract(
                    current,
                    command.contractId,
                    {
                        ...transitionOptions,
                        acceptedAt
                    }
                );
            }
        );

        if (state.status === BrokerGameStatus.GAME_OVER) {
            return cycleResult(operation, [
                systemMessage([
                    `Contrato #${accepted.id} aceptado.`,
                    "ALERTA CR\u00cdTICA: la partida ha terminado."
                ].join("\n"))
            ]);
        }

        return cycleResult(operation, [
            systemMessage([
                `Contrato #${accepted.id} aceptado: ${accepted.title}.`,
                `Alerta actual: ${state.alertLevel}/10.`,
                "Programa en cualquier documento CLRS y conserva este contrato activo para la revisi\u00f3n posterior."
            ].join("\n"))
        ]);
    }

    async #delete(command, operation) {
        let deleted = null;
        await this.gameSession.transact((
            current,
            transitionOptions
        ) => {
            deleted = findVisibleContract(
                current,
                command.contractId,
                transitionOptions
            );

            return deleteBrokerContract(
                current,
                command.contractId
            );
        });

        return cycleResult(operation, [
            systemMessage(
                `Contrato #${deleted.id} eliminado.`
            )
        ]);
    }

    async #purge(operation) {
        const before = this.gameSession.getState();
        const deletedCount = before.contracts.filter(
            contract => contract.state === BrokerContractState.PENDING
        ).length;

        await this.gameSession.transact(
            purgeBrokerContracts
        );

        return cycleResult(operation, [
            systemMessage(
                deletedCount === 0
                    ? "No hab\u00eda contratos pendientes para eliminar."
                    : `${deletedCount} contrato${deletedCount === 1 ? "" : "s"} pendiente${deletedCount === 1 ? "" : "s"} eliminado${deletedCount === 1 ? "" : "s"}.`
            )
        ]);
    }

    #info(operation) {
        const state = this.gameSession.getState();
        const contracts = visibleContracts(state);
        const active = findActiveContract(state);
        const pending = contracts.filter(
            contract => contract.state === BrokerContractState.PENDING
        ).length;

        return cycleResult(operation, [
            systemMessage(formatGameStatus({
                state,
                active,
                pending
            }))
        ]);
    }

    #gameInfo(operation) {
        return cycleResult(operation, [
            systemMessage(formatGameGuide())
        ]);
    }
}

function normalizeExecutionOptions(value) {
    if (
        value == null ||
        typeof value !== "object" ||
        Array.isArray(value) ||
        Object.keys(value).some(
            key => key !== "requestId"
        ) ||
        (
            value.requestId != null &&
            (
                typeof value.requestId !== "string" ||
                !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u
                    .test(value.requestId)
            )
        )
    ) {
        throw BrokerGameError.invalidRule(
            "BROKER95_CONTRACT_CYCLE_OPTIONS_INVALID",
            "No fue posible coordinar el comando de contrato.",
            []
        );
    }

    return Object.freeze({
        requestId: value.requestId ?? null
    });
}

export function isBrokerContractCycleCommand(command) {
    return command != null &&
        typeof command === "object" &&
        SUPPORTED_COMMANDS.has(command.type);
}

function requireOperation(command) {
    if (!isBrokerContractCycleCommand(command)) {
        throw BrokerGameError.invalidRule(
            "BROKER95_CONTRACT_CYCLE_COMMAND_UNSUPPORTED",
            "Este comando todav\u00eda no forma parte del ciclo de contratos.",
            [{ commandType: command?.type ?? null }]
        );
    }

    if (requiresContractId(command.type)) {
        requireContractId(command.contractId);
    }

    return SUPPORTED_COMMANDS.get(command.type);
}

function requiresContractId(type) {
    return type === BrokerTerminalCommandType.READ_CONTRACT ||
        type === BrokerTerminalCommandType.ACCEPT_CONTRACT ||
        type === BrokerTerminalCommandType.DELETE_CONTRACT;
}

function requireContractId(value) {
    if (!Number.isSafeInteger(value) || value <= 0) {
        throw BrokerGameError.invalidRule(
            "BROKER95_CONTRACT_CYCLE_ID_INVALID",
            "El ID del contrato no es v\u00e1lido.",
            [{ value }]
        );
    }

    return value;
}

function requireGeneratedContract(value) {
    const contract = value?.contract;

    if (
        contract == null ||
        typeof contract !== "object" ||
        !Number.isSafeInteger(contract.id)
    ) {
        throw BrokerGameError.invalidRule(
            "BROKER95_CONTRACT_GENERATION_RESULT_INVALID",
            "CIPHER no devolvi\u00f3 un contrato v\u00e1lido.",
            []
        );
    }

    return contract;
}

function visibleContracts(state) {
    return state.contracts.filter(
        contract => contract.state !== BrokerContractState.DELETED
    );
}

function findVisibleContract(state, contractId) {
    requireContractId(contractId);
    const contract = state.contracts.find(
        item => item.id === contractId &&
            item.state !== BrokerContractState.DELETED
    );

    if (!contract) {
        throw BrokerGameError.invalidRule(
            "BROKER95_CONTRACT_NOT_AVAILABLE",
            "No se encontr\u00f3 un contrato disponible con ese ID.",
            [{ contractId }]
        );
    }

    return contract;
}

function findActiveContract(state) {
    return state.activeContractId == null
        ? null
        : state.contracts.find(
            contract => contract.id === state.activeContractId
        ) ?? null;
}

function formatContractSummary(contract) {
    return `#${contract.id} [${RISK_LABELS[contract.risk]}] [${STATE_LABELS[contract.state]}] ${contract.title} // ${formatMoney(contract.payPotential)}`;
}

function formatContractDetail(contract) {
    const requirementIds =
        contract.metadata?.requirementIds ??
        contract.requirements.map(
            (_item, index) => `REQ-${index + 1}`
        );

    return [
        `\u250c\u2500[BROKER.95://CONTRATO/${contract.id}]`,
        `\u2502 T\u00edtulo         : ${contract.title}`,
        `\u2502 Estado         : ${STATE_LABELS[contract.state]}`,
        `\u2502 Riesgo         : ${RISK_LABELS[contract.risk]}`,
        `\u2502 Cliente        : ${contract.client}`,
        `\u2502 Categor\u00eda      : ${contract.familyName} / ${contract.categoryName}`,
        `\u2502 Paga potencial : ${formatMoney(contract.payPotential)}`,
        ...(
            contract.state ===
                BrokerContractState.COMPLETED ||
            contract.state ===
                BrokerContractState.FAILED
                ? [
                    `\u2502 Paga final     : ${formatMoney(contract.payout)}`
                ]
                : []
        ),
        "\u251c\u2500[OBJETIVO]",
        ...formatBlockText(contract.description),
        "\u251c\u2500[REQUISITOS]",
        ...contract.requirements.map(
            (requirement, index) =>
                `\u2502 ${requirementIds[index]}  ${requirement}`
        ),
        `\u251c\u2500[PRUEBAS DE ACEPTACI\u00d3N \u00b7 ${contract.testCases.length}]`,
        "\u2502 El programa debe superar todos los casos para satisfacer la evidencia funcional.",
        ...contract.testCases.flatMap(
            testCase => formatTestCase(testCase)
        ),
        "\u2514\u2500[FIN DEL EXPEDIENTE]"
    ].join("\n");
}

function formatTestCase(testCase) {
    const explanation = testCase.explanation ??
        "Caso guardado sin explicaci\u00f3n narrativa disponible.";

    return [
        "\u2502",
        `\u2502 [${testCase.id}] ${formatTestKind(testCase.kind)}`,
        `\u2502   Explicaci\u00f3n : ${explanation}`,
        `\u2502   Entrada     : ${formatTestData(testCase.stdin)}`,
        `\u2502   Esperado    : ${formatTestData(testCase.expected)}`,
        `\u2502   Comparador  : ${formatComparison(testCase.comparison)}`,
        `\u2502   Requisitos : ${testCase.requirementIds.join(", ")}`,
        `\u2502   Tiempo m\u00e1x. : ${testCase.timeoutMs} ms`
    ];
}

function formatGameStatus({
    state,
    active,
    pending
}) {
    return [
        "\u250c\u2500[BROKER.95://ESTADO]",
        `\u2502 Partida         : ${
            state.status === BrokerGameStatus.PLAYING
                ? "OPERATIVA"
                : "FINALIZADA"
        }`,
        `\u2502 Saldo          : ${formatMoney(state.money)}`,
        `\u2502 Alerta         : ${state.alertLevel}/10`,
        `\u2502 Contrato activo: ${
            active
                ? `#${active.id} ${active.title}`
                : "NINGUNO"
        }`,
        `\u2502 Pendientes      : ${pending}`,
        `\u2502 Completados     : ${state.statistics.completed}`,
        `\u2502 Fallidos        : ${state.statistics.failed}`,
        "\u2514\u2500[FIN DEL ESTADO]"
    ].join("\n");
}

function formatGameGuide() {
    const rubric = getBrokerEvaluationRubric(
        BrokerRisk.EXTREME
    );

    return [
        "\u250c\u2500[BROKER.95://BIENVENIDA AL VIDEOJUEGO]",
        "\u2502 Bienvenido a BROKER.95, operador.",
        "\u2502 Esta es una red de contratos de programación, los clientes presentan problemas y tú escribes soluciones CLRS desde el editor de VS Code.",
        "\u2502 CIPHER es la IA intermediaria. Proporciona los contratos, orienta durante revisión, responde preguntas y recibe tu código.",
        "\u2502 El operador (Host) almacena el estado real de la partida.",
        "\u251c\u2500[OBJETIVO Y ALERTA]",
        "\u2502 Resuelve contratos, entrega programas correctos y acumula saldo. Cada nivel de riesgo modifica la paga, los criterios y la alerta.",
        "\u2502 Aceptar contratos medios, altos o extremos aumenta la alerta en 1, 2 o 4 puntos; los contratos bajos no la aumentan.",
        "\u2502 Si la alerta llega a 10, la policía localiza la red: ocurre GAME OVER y finaliza esa partida.",
        "\u251c\u2500[PONDERACI\u00d3N POR RIESGO]",
        ...Object.values(BrokerRisk).map(
            risk => formatRiskWeights(risk)
        ),
        "\u251c\u2500[CAT\u00c1LOGO DE CRITERIOS]",
        ...rubric.dimensions.flatMap(
            dimension => formatRubricDimension(
                dimension,
                false
            )
        ),
        "\u251c\u2500[INICIO R\u00c1PIDO]",
        "\u2502 1. ¿Ya configuraste a CIPHER? Abre la pestaña Configuración y proporciona los datos correspondientes. Tu información se guarda de forma secreta en tu sistema.",
        "\u2502 2. ¿Quieres jugar de inmediato? Ejecuta ai -new low, inspecciona el contrato con ai -read <id> y acéptalo con ai -set <id>.",
        "\u2502 3. ¿Quieres aprender desde cero? Abre la pestaña Aprendizaje y comienza la ruta de Programación; después podrás avanzar a Algoritmia.",
        "\u2502 4. Programa en un archivo .clrs; usa ai -review para una revisión, ai -ask para preguntar y ai -push para entregar.",
        "\u2502 5. Consulta ai -? cuando necesites recordar la estructura y los comandos disponibles.",
        "\u2514\u2500[FIN DE LA GU\u00cdA]"
    ].join("\n");
}

function formatRiskWeights(risk) {
    const rule = getBrokerRiskRule(risk);
    const values = Object.entries(rule.weights)
        .map(([dimension, weight]) =>
            `${formatDimension(dimension)} ${formatPercent(weight)}`
        )
        .join(" \u00b7 ");

    return `\u2502 ${RISK_LABELS[risk].padEnd(8)} ${values}`;
}

function formatRubricDimension(
    dimension,
    showFinalWeight
) {
    const heading = showFinalWeight
        ? `${formatDimension(dimension.dimension)} \u00b7 peso final ${formatPercent(dimension.finalWeight)}`
        : formatDimension(dimension.dimension);

    return [
        `\u2502 ${heading}`,
        ...dimension.criteria.map((criterion, index) => {
            const branch = index ===
                dimension.criteria.length - 1
                ? "\u2514"
                : "\u251c";

            return `\u2502   ${branch}\u2500 ${criterion.criterion} \u00b7 ${criterion.label} \u00b7 ${formatPercent(criterion.internalWeight)} de la dimensi\u00f3n`;
        })
    ];
}

function formatBlockText(value) {
    return String(value)
        .split("\n")
        .map(line => `\u2502 ${line}`);
}

function formatTestData(value) {
    return JSON.stringify(value ?? "");
}

function formatTestKind(value) {
    return {
        normal: "NORMAL",
        boundary: "CASO L\u00cdMITE",
        invalid: "ENTRADA INV\u00c1LIDA"
    }[value] ?? String(value).toUpperCase();
}

function formatComparison(value) {
    return {
        exact: "TEXTO EXACTO",
        trimmed: "TEXTO SIN ESPACIOS EXTERIORES",
        "normalized-whitespace": "ESPACIOS NORMALIZADOS",
        lines: "L\u00cdNEAS EN ORDEN",
        "unordered-lines": "L\u00cdNEAS SIN ORDEN",
        number: "N\u00daMERO",
        "number-tolerance": "N\u00daMERO CON TOLERANCIA",
        json: "JSON",
        "array-ordered": "ARREGLO EN ORDEN",
        "array-unordered": "ARREGLO SIN ORDEN",
        boolean: "VALOR L\u00d3GICO",
        contains: "CONTIENE TEXTO",
        "regex-safe": "PATR\u00d3N SEGURO"
    }[value] ?? String(value).toUpperCase();
}

function formatDimension(value) {
    return {
        functionality: "Funcionalidad",
        robustness: "Robustez",
        design: "Dise\u00f1o"
    }[value] ?? value;
}

function formatPercent(value) {
    return `${Number(value * 100).toLocaleString(
        "es-MX",
        { maximumFractionDigits: 1 }
    )}%`;
}

function formatMoney(value) {
    return `USD ${Number(value).toLocaleString("en-US")}`;
}

function cycleResult(operation, messages) {
    return Object.freeze({
        operation,
        messages: Object.freeze(
            messages.map(message =>
                Object.freeze({ ...message })
            )
        )
    });
}

function systemMessage(text) {
    return Object.freeze({ kind: "system", text });
}

function cipherMessage(text) {
    return Object.freeze({ kind: "cipher", text });
}

function unreachableContractCommand() {
    throw new Error(
        "Unsupported BROKER.95 contract cycle command."
    );
}
