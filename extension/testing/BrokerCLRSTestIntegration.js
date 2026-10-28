import {
    requirePort
} from "../../src/application/ports/ApplicationPorts.js";
import {
    BrokerContractState
} from "../../src/broker95/core/BrokerContract.js";
import {
    createCLRSTestSuite
} from "../../src/testing/index.js";

export const BROKER_TEST_SOURCE_ID = "broker95";

/**
 * Proyecta exclusivamente los casos declarados del contrato activo. La suite
 * ejecutable y el código se resuelven sólo en el Host cuando el usuario
 * solicita Ejecutar o Depurar.
 */
export class BrokerCLRSTestIntegration {

    constructor(options = {}) {
        this.id = BROKER_TEST_SOURCE_ID;
        this.gameSession = requirePort(
            options.gameSession,
            "brokerGameSession",
            ["initialize", "getState", "subscribe"]
        );
        this.documentHost = requirePort(
            options.documentHost,
            "brokerDocumentHost",
            ["getActiveDocumentReference"]
        );
        this.executor = requirePort(
            options.executor,
            "clrsTestExecutor",
            ["execute"]
        );
        this.listeners = new Set();
        this.gameSubscription = null;
        this.snapshot = emptySnapshot();
        this.ready = null;
        this.disposed = false;
    }

    start() {
        if (this.disposed) {
            throw new Error(
                "The BROKER.95 test integration is disposed."
            );
        }

        if (this.ready != null) {
            return this.ready;
        }

        this.ready = this.gameSession.initialize()
            .then(() => {
                this.gameSubscription =
                    this.gameSession.subscribe(
                        state => this.#refresh(state)
                    );
                return this.#refresh(
                    this.gameSession.getState()
                );
            });

        return this.ready;
    }

    getSnapshot() {
        return this.snapshot;
    }

    subscribe(listener) {
        if (typeof listener !== "function") {
            throw new TypeError(
                "The BROKER.95 test listener must be a function."
            );
        }

        this.listeners.add(listener);

        return Object.freeze({
            dispose: () => {
                this.listeners.delete(listener);
            }
        });
    }

    async execute({
        sourceKey,
        caseIds,
        signal
    }) {
        const prepared = await this.#prepare(
            sourceKey
        );
        const execution = await this.executor.execute({
            suite: prepared.suite,
            sourceCode: prepared.source.sourceCode,
            sourceVersion: prepared.source.version,
            caseIds,
            seed: 0,
            signal
        });

        return Object.freeze({
            suite: prepared.suite,
            execution
        });
    }

    async prepareDebug({ sourceKey, caseId }) {
        const prepared = await this.#prepare(
            sourceKey
        );
        const testCase = prepared.suite.cases.find(
            candidate => candidate.id === caseId
        );

        if (testCase == null) {
            throw integrationError(
                "BROKER95_TEST_CASE_STALE",
                "El caso público ya no pertenece al contrato activo."
            );
        }

        return Object.freeze({
            suite: prepared.suite,
            testCase
        });
    }

    dispose() {
        if (this.disposed) {
            return;
        }

        this.disposed = true;
        this.gameSubscription?.dispose();
        this.gameSubscription = null;
        this.listeners.clear();
        this.snapshot = emptySnapshot();
    }

    async #prepare(sourceKey) {
        await this.start();
        const contract = activeContract(
            this.gameSession.getState()
        );

        if (
            contract == null ||
            String(contract.id) !== String(sourceKey)
        ) {
            throw integrationError(
                "BROKER95_TEST_CONTRACT_STALE",
                "El contrato cambió; actualiza el Explorador de pruebas."
            );
        }

        const source = this.documentHost
            .getActiveDocumentReference();

        if (source == null) {
            throw integrationError(
                "BROKER95_TEST_DOCUMENT_REQUIRED",
                "Abre el programa CLRS del contrato antes de ejecutar sus pruebas."
            );
        }

        return Object.freeze({
            source,
            suite: contractSuite(contract, source)
        });
    }

    #refresh(state) {
        const contract = activeContract(state);
        const next = contract == null
            ? emptySnapshot(state?.revision ?? 0)
            : contractSnapshot(
                contract,
                state.revision
            );

        if (sameSnapshot(this.snapshot, next)) {
            return this.snapshot;
        }

        this.snapshot = next;

        for (const listener of this.listeners) {
            listener(this.snapshot);
        }

        return this.snapshot;
    }
}

function activeContract(state) {
    if (state?.activeContractId == null) {
        return null;
    }

    const contract = state.contracts?.find(item =>
        item.id === state.activeContractId
    );

    return contract?.state === BrokerContractState.ACTIVE
        ? contract
        : null;
}

function contractSnapshot(contract, revision) {
    return Object.freeze({
        sourceId: BROKER_TEST_SOURCE_ID,
        revision,
        roots: Object.freeze([Object.freeze({
            id: `broker95-contract:${contract.id}`,
            sourceKey: String(contract.id),
            label: boundedInline(
                `BROKER.95 · ${contract.title}`,
                256
            ),
            description: contract.contractType === "learning"
                ? "Contrato educativo activo · casos públicos"
                : "Contrato de cliente activo · casos públicos",
            error: null,
            runnable: true,
            cases: Object.freeze(
                contract.testCases.map(
                    (testCase, index) =>
                        Object.freeze({
                            id: testCase.id,
                            label: boundedInline(
                                `${testCase.id} · ${testCase.kind}`,
                                256
                            ),
                            description: boundedInline(
                                testCase.explanation ??
                                    `Caso público ${index + 1}`,
                                500
                            ),
                            error: null,
                            runnable: true
                        })
                )
            )
        })])
    });
}

function contractSuite(contract, source) {
    return createCLRSTestSuite({
        id: `broker95:contract:${contract.id}`,
        name: boundedInline(
            `BROKER.95 · ${contract.title}`,
            256
        ),
        programPath: source.filePath,
        definitionPath: null,
        cases: contract.testCases.map(
            (testCase, index) => ({
                id: testCase.id,
                name: boundedInline(
                    testCase.explanation ??
                        `Caso público ${index + 1}`,
                    256
                ),
                input: {
                    stdin: testCase.stdin
                },
                expectation: {
                    stdout: testCase.expected,
                    comparison:
                        testCase.comparison
                },
                timeoutMs: testCase.timeoutMs
            })
        )
    });
}

function emptySnapshot(revision = 0) {
    return Object.freeze({
        sourceId: BROKER_TEST_SOURCE_ID,
        revision,
        roots: Object.freeze([])
    });
}

function sameSnapshot(left, right) {
    return left.revision === right.revision &&
        left.roots[0]?.sourceKey ===
            right.roots[0]?.sourceKey;
}

function boundedInline(value, maximum) {
    const normalized = String(value)
        .replace(/\s+/gu, " ")
        .trim();

    return normalized.slice(0, maximum) ||
        "Prueba BROKER.95";
}

function integrationError(code, publicMessage) {
    const error = new Error(publicMessage);

    error.code = code;
    error.publicMessage = publicMessage;
    return error;
}
