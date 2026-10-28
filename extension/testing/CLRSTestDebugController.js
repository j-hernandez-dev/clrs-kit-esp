import path from "node:path";

import {
    CLRS_TEST_LIMITS,
    CLRSTestFailureKind,
    CLRSTestResultStatus,
    createCLRSTestResult,
    createCompletedCLRSTestResult,
    deriveCLRSTestCaseSeed
} from "../../src/testing/index.js";
import {
    requireObject,
    requirePort
} from "../../src/application/ports/ApplicationPorts.js";
import {
    CLRSTestResultPresenter
} from "./CLRSTestResultPresenter.js";
import {
    selectCLRSTestTargets
} from "./CLRSTestSelection.js";

export const CLRS_TEST_DEBUG_PROFILE_LABEL =
    "Depurar";
export const CLRS_TEST_DEBUG_RUN_NAME =
    "Depurar prueba CLRS";

const DEBUG_RESULT_GRACE_MS = 750;

/**
 * Inicia un caso del Explorador de pruebas mediante el DAP de CLRS. El Host
 * conserva la entrada y la semilla; el TestRun sólo proyecta el resultado.
 */
export class CLRSTestDebugController {

    constructor(options = {}) {
        this.vscode = requireObject(
            options.vscodeApi,
            "vscodeApi"
        );
        this.debug = requirePort(
            this.vscode.debug,
            "vscodeApi.debug",
            [
                "startDebugging",
                "stopDebugging",
                "onDidStartDebugSession",
                "onDidTerminateDebugSession"
            ]
        );
        this.discoveryController = requirePort(
            options.discoveryController,
            "testDiscoveryController",
            ["getMetadata"]
        );
        this.discovery = requirePort(
            options.discovery,
            "testDiscovery",
            ["findByDefinitionPath"]
        );
        this.workspace = requirePort(
            options.workspace,
            "testWorkspace",
            [
                "toUri",
                "getWorkspaceFolder",
                "getDocumentVersion"
            ]
        );
        this.executionTraceService = requirePort(
            options.executionTraceService,
            "debugExecutionTraceService",
            ["subscribe"]
        );
        this.resultPresenter = requirePort(
            options.resultPresenter ??
                new CLRSTestResultPresenter({
                    vscodeApi: this.vscode,
                    workspace: this.workspace
                }),
            "testResultPresenter",
            ["present"]
        );
        this.controller = null;
        this.activationSubscription = null;
        this.debugType = String(options.debugType);
        this.now = options.now ?? Date.now;
        this.schedule = options.setTimeout ??
            globalThis.setTimeout;
        this.cancelSchedule = options.clearTimeout ??
            globalThis.clearTimeout;
        this.developerLogger =
            options.developerLogger ?? console;
        this.profile = null;
        this.externalSources = new Map();
        this.active = null;
        this.nextRunId = 1;
        this.started = false;
        this.disposed = false;

        if (
            this.discoveryController.controller !=
                null
        ) {
            this.activate(
                this.discoveryController.controller
            );
        } else if (
            typeof this.discoveryController
                .onDidActivate === "function"
        ) {
            this.activationSubscription =
                this.discoveryController
                    .onDidActivate(
                        controller => {
                            this.activate(controller);
                        }
                    );
        } else {
            requirePort(
                this.discoveryController.controller,
                "vscodeTestController",
                [
                    "createRunProfile",
                    "createTestRun"
                ]
            );
        }
    }

    start() {
        if (this.disposed) {
            throw new Error(
                "The CLRS test debug controller is disposed."
            );
        }

        this.started = true;

        if (
            this.profile != null ||
            this.controller == null
        ) {
            return this.profile;
        }

        this.profile = this.controller
            .createRunProfile(
                CLRS_TEST_DEBUG_PROFILE_LABEL,
                this.vscode.TestRunProfileKind.Debug,
                async (request, token) => {
                    await this.run(request, token);
                },
                true,
                undefined,
                false
            );
        this.profile.supportsContinuousRun = false;

        return this.profile;
    }

    activate(controller) {
        if (this.disposed) {
            return null;
        }

        const normalized = requirePort(
            controller,
            "vscodeTestController",
            ["createRunProfile", "createTestRun"]
        );

        if (
            this.controller != null &&
            this.controller !== normalized
        ) {
            throw new Error(
                "The CLRS test controller is already active."
            );
        }

        this.controller = normalized;

        return this.started
            ? this.start()
            : null;
    }

    registerExternalSource(source) {
        const normalized = requirePort(
            source,
            "externalTestSource",
            ["prepareDebug"]
        );
        const sourceId = String(normalized.id ?? "").trim();

        if (sourceId.length === 0) {
            throw new TypeError(
                "The external test source identifier is invalid."
            );
        }

        this.externalSources.set(sourceId, normalized);
        return normalized;
    }

    async run(request = {}, token = null) {
        if (this.disposed) {
            return null;
        }

        const testRun = this.controller.createTestRun(
            request,
            CLRS_TEST_DEBUG_RUN_NAME,
            true
        );

        try {
            const targets = selectCLRSTestTargets({
                roots: this.controller.items,
                included: request.include,
                excluded: request.exclude,
                resolveMetadata: item =>
                    this.discoveryController
                        .getMetadata(item)
            });

            for (const target of targets) {
                testRun.enqueued(target.item);
            }

            if (targets.length !== 1) {
                this.#errorTargets(
                    testRun,
                    targets,
                    targets.length === 0
                        ? "No hay una prueba CLRS seleccionada para depurar."
                        : "Selecciona un único caso CLRS para depurarlo."
                );
                return testRun;
            }

            const target = targets[0];

            if (
                !target.metadata.runnable ||
                target.metadata.kind !== "case"
            ) {
                this.#errorTargets(
                    testRun,
                    targets,
                    target.item.error ??
                        "La prueba no puede depurarse porque su definición no está disponible."
                );
                return testRun;
            }

            if (this.active != null) {
                this.#errorTargets(
                    testRun,
                    targets,
                    "Ya hay una prueba CLRS en depuración."
                );
                return testRun;
            }

            let prepared;

            try {
                prepared = await this.#prepareTarget(
                    target.metadata
                );
            } catch (error) {
                this.#report(error);
                this.#errorTargets(
                    testRun,
                    targets,
                    error?.publicMessage ??
                        "La suite ya no está disponible."
                );
                return testRun;
            }

            const { suite, testCase } = prepared;

            testRun.started(target.item);

            const seed = deriveCLRSTestCaseSeed(
                0,
                suite.id,
                testCase.id
            );
            const startedAt = this.now();
            const outcome = await this.#startDebugging({
                target,
                suite,
                testCase,
                seed,
                token
            });
            const result = this.#createResult({
                outcome,
                suite,
                testCase,
                seed,
                durationMs: elapsed(
                    startedAt,
                    this.now
                )
            });

            this.resultPresenter.present({
                testRun,
                item: target.item,
                testCase,
                result,
                programPath:
                    suite.programPath
            });
        } catch (error) {
            this.#report(error);

            const targets = selectCLRSTestTargets({
                roots: this.controller.items,
                included: request.include,
                excluded: request.exclude,
                resolveMetadata: item =>
                    this.discoveryController
                        .getMetadata(item)
            });

            this.#errorTargets(
                testRun,
                targets,
                "No fue posible iniciar la depuración de la prueba CLRS.",
                { started: true }
            );
        } finally {
            testRun.end();
        }

        return testRun;
    }

    dispose() {
        if (this.disposed) {
            return;
        }

        this.disposed = true;
        this.#cancelActive();
        this.externalSources.clear();
        this.activationSubscription?.dispose?.();
        this.activationSubscription = null;
        this.profile?.dispose();
        this.profile = null;
        this.controller = null;
    }

    async #prepareTarget(metadata) {
        if (
            metadata.sourceId != null &&
            metadata.sourceId !== "declarative"
        ) {
            const source = this.externalSources.get(
                metadata.sourceId
            );

            if (source == null) {
                throw publicError(
                    "La fuente de pruebas ya no está disponible."
                );
            }

            return source.prepareDebug({
                sourceKey: metadata.sourceKey,
                caseId: metadata.caseId
            });
        }

        const entry = this.discovery
            .findByDefinitionPath(
                metadata.definitionPath
            );
        const testCase = entry?.suite?.cases.find(
            candidate =>
                candidate.id === metadata.caseId
        );

        if (
            entry?.status !== "ready" ||
            entry.suite == null ||
            testCase == null
        ) {
            throw publicError(
                entry?.issue?.message ??
                    "La suite ya no está disponible."
            );
        }

        return Object.freeze({
            suite: entry.suite,
            testCase
        });
    }

    #startDebugging({
        suite,
        testCase,
        seed,
        token
    }) {
        const runId =
            `clrs-test-debug-${this.nextRunId++}`;
        let settle;
        const promise = new Promise(resolve => {
            settle = resolve;
        });
        const active = {
            runId,
            programPath: suite.programPath,
            session: null,
            traceId: null,
            fallbackTimer: null,
            settled: false,
            cancelled: false,
            startSettled: false,
            resources: [],
            finish: outcome => {
                if (active.settled) {
                    return;
                }

                active.settled = true;

                if (active.fallbackTimer != null) {
                    this.cancelSchedule(
                        active.fallbackTimer
                    );
                }

                for (const resource of active.resources) {
                    resource?.dispose?.();
                }

                if (this.active === active) {
                    this.active = null;
                }

                settle(outcome);
            },
            cancel: () => {
                if (active.settled) {
                    return;
                }

                active.cancelled = true;

                if (active.session != null) {
                    this.#stopSession(active.session);
                    active.finish({ kind: "cancelled" });
                } else if (active.startSettled) {
                    active.finish({ kind: "cancelled" });
                }
            }
        };

        active.resources.push(
            this.executionTraceService.subscribe(event => {
                if (event?.type === "start") {
                    if (
                        samePath(
                            event.trace?.sourcePath,
                            active.programPath
                        )
                    ) {
                        active.traceId =
                            event.trace.traceId;
                    }
                    return;
                }

                if (
                    event?.type === "test-result" &&
                    event.traceId === active.traceId
                ) {
                    active.finish({
                        kind: "result",
                        event
                    });
                }
            }),
            this.debug.onDidStartDebugSession(session => {
                if (
                    session?.configuration
                        ?.__clrsTestRunId === runId
                ) {
                    active.session = session;

                    if (active.cancelled) {
                        this.#stopSession(session);
                        active.finish({
                            kind: "cancelled"
                        });
                    }
                }
            }),
            this.debug.onDidTerminateDebugSession(session => {
                if (
                    session?.configuration
                        ?.__clrsTestRunId !== runId ||
                    active.settled
                ) {
                    return;
                }

                active.fallbackTimer = this.schedule(
                    () => active.finish({
                        kind: "error",
                        message:
                            "La sesión terminó sin producir un resultado de prueba."
                    }),
                    DEBUG_RESULT_GRACE_MS
                );
            })
        );

        const cancellation = token
            ?.onCancellationRequested?.(() => {
                active.cancel();
            });

        if (cancellation?.dispose) {
            active.resources.push(cancellation);
        }

        this.active = active;

        if (token?.isCancellationRequested === true) {
            active.finish({ kind: "cancelled" });
            return promise;
        }

        const configuration = {
            type: this.debugType,
            request: "launch",
            name: `Depurar prueba CLRS: ${testCase.name}`,
            program: suite.programPath,
            stopOnEntry: true,
            __clrsDocumentVersion:
                this.workspace.getDocumentVersion(
                    suite.programPath
                ),
            __clrsTestRunId: runId,
            __clrsTest: {
                suiteId: suite.id,
                caseId: testCase.id,
                stdin: testCase.input.stdin,
                seed
            }
        };

        Promise.resolve(
            this.debug.startDebugging(
                this.workspace.getWorkspaceFolder(
                    suite.programPath
                ),
                configuration
            )
        ).then(started => {
            active.startSettled = true;

            if (active.settled) {
                return;
            }

            if (active.cancelled) {
                if (active.session != null) {
                    this.#stopSession(
                        active.session
                    );
                }
                active.finish({
                    kind: "cancelled"
                });
                return;
            }

            if (started !== true) {
                active.finish({
                    kind: "error",
                    message:
                        "VS Code no pudo iniciar la sesión de depuración."
                });
            }
        }).catch(error => {
            active.startSettled = true;

            if (active.settled) {
                return;
            }

            if (active.cancelled) {
                active.finish({
                    kind: "cancelled"
                });
                return;
            }

            this.#report(error);
            active.finish({
                kind: "error",
                message:
                    "VS Code no pudo iniciar la sesión de depuración."
            });
        });

        return promise;
    }

    #createResult({
        outcome,
        suite,
        testCase,
        seed,
        durationMs
    }) {
        if (outcome.kind === "cancelled") {
            return createCLRSTestResult({
                suiteId: suite.id,
                caseId: testCase.id,
                status:
                    CLRSTestResultStatus.CANCELLED,
                durationMs,
                seed
            });
        }

        if (outcome.kind === "error") {
            return createCLRSTestResult({
                suiteId: suite.id,
                caseId: testCase.id,
                status: CLRSTestResultStatus.ERRORED,
                durationMs,
                seed,
                failure: {
                    kind:
                        CLRSTestFailureKind.START_FAILURE,
                    code:
                        "CLRS_TEST_DEBUG_SESSION_FAILED",
                    message: outcome.message
                }
            });
        }

        const event = outcome.event;

        if (event.status === "cancelled") {
            return createCLRSTestResult({
                suiteId: suite.id,
                caseId: testCase.id,
                status:
                    CLRSTestResultStatus.CANCELLED,
                durationMs,
                seed,
                stdout: event.stdout,
                stderr: event.stderr,
                exitCode: event.exitCode,
                signal: event.signal
            });
        }

        if (event.outputTruncated === true) {
            return createCLRSTestResult({
                suiteId: suite.id,
                caseId: testCase.id,
                status: CLRSTestResultStatus.ERRORED,
                durationMs,
                seed,
                stdout: event.stdout.slice(
                    0,
                    CLRS_TEST_LIMITS
                        .maximumCapturedOutputCharacters
                ),
                stderr: event.stderr,
                exitCode: event.exitCode,
                signal: event.signal,
                failure: {
                    kind:
                        CLRSTestFailureKind.OUTPUT_LIMIT,
                    code: "CLRS_TEST_OUTPUT_LIMIT",
                    message:
                        "La prueba produjo más salida de la permitida."
                }
            });
        }

        return createCompletedCLRSTestResult({
            suite,
            testCase,
            durationMs,
            seed,
            stdout: event.stdout,
            stderr: event.stderr,
            exitCode: event.status === "correct"
                ? event.exitCode ?? 0
                : event.exitCode === 0
                    ? 1
                    : event.exitCode ?? 1,
            signal: event.signal
        });
    }

    #cancelActive() {
        const active = this.active;

        if (active == null) {
            return;
        }

        active.cancel();
    }

    #stopSession(session) {
        if (session == null) {
            return;
        }

        Promise.resolve(
            this.debug.stopDebugging(session)
        ).catch(error => this.#report(error));
    }

    #errorTargets(
        testRun,
        targets,
        message,
        options = {}
    ) {
        for (const target of targets) {
            if (options.started !== true) {
                testRun.started(target.item);
            }

            testRun.errored(
                target.item,
                new this.vscode.TestMessage(message)
            );
        }
    }

    #report(error) {
        try {
            this.developerLogger.error?.(
                "CLRS test debugging failed.",
                error
            );
        } catch {
            // El registro técnico no altera la sesión ni el TestRun.
        }
    }
}

function samePath(left, right) {
    if (!left || !right) {
        return false;
    }

    const normalizedLeft = path.resolve(left);
    const normalizedRight = path.resolve(right);

    return process.platform === "win32"
        ? normalizedLeft.toLocaleLowerCase("en-US") ===
            normalizedRight.toLocaleLowerCase("en-US")
        : normalizedLeft === normalizedRight;
}

function elapsed(startedAt, now) {
    const duration = Number(now()) - Number(startedAt);

    return Number.isFinite(duration) && duration >= 0
        ? Math.floor(duration)
        : 0;
}

function publicError(publicMessage) {
    const error = new Error(publicMessage);

    error.publicMessage = publicMessage;
    return error;
}
