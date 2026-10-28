import {
    requireObject,
    requirePort
} from "../../src/application/ports/ApplicationPorts.js";
import {
    CLRSTestResultPresenter
} from "./CLRSTestResultPresenter.js";
import {
    CLRSTestCoveragePresenter
} from "./CLRSTestCoveragePresenter.js";
import {
    selectCLRSTestTargets
} from "./CLRSTestSelection.js";

export const CLRS_TEST_RUN_PROFILE_LABEL =
    "Ejecutar";
export const CLRS_TEST_RUN_NAME =
    "Pruebas CLRS";
export const CLRS_TEST_COVERAGE_PROFILE_LABEL =
    "Cobertura";
export const CLRS_TEST_COVERAGE_RUN_NAME =
    "Cobertura de pruebas CLRS";

/**
 * Traduce solicitudes de la Testing API al ejecutor neutral y devuelve cada
 * transición al TestRun nativo. No interpreta CLRS ni ejecuta procesos.
 */
export class CLRSTestRunController {

    constructor(options = {}) {
        this.vscode = requireObject(
            options.vscodeApi,
            "vscodeApi"
        );
        this.discoveryController =
            requirePort(
                options.discoveryController,
                "testDiscoveryController",
                ["getMetadata", "getSnapshot"]
            );
        this.discovery = requirePort(
            options.discovery,
            "testDiscovery",
            ["findByDefinitionPath"]
        );
        this.workspace = requirePort(
            options.workspace,
            "testWorkspace",
            ["readText", "toUri"]
        );
        this.executor = requirePort(
            options.executor,
            "testExecutor",
            ["execute"]
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
        this.coveragePresenter = requirePort(
            options.coveragePresenter ??
                new CLRSTestCoveragePresenter({
                    vscodeApi: this.vscode,
                    workspace: this.workspace,
                    coverageStore:
                        options.coverageStore
                }),
            "testCoveragePresenter",
            [
                "present",
                "loadDetailedCoverage",
                "loadDetailedCoverageForTest"
            ]
        );
        this.controller = null;
        this.activationSubscription = null;
        this.developerLogger =
            options.developerLogger ?? console;
        this.profile = null;
        this.coverageProfile = null;
        this.externalSources = new Map();
        this.activeControllers = new Set();
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
                "The CLRS test run controller is disposed."
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
                CLRS_TEST_RUN_PROFILE_LABEL,
                this.vscode.TestRunProfileKind.Run,
                async (request, token) => {
                    await this.run(request, token);
                },
                true,
                undefined,
                false
            );
        this.profile.supportsContinuousRun = false;
        this.coverageProfile = this.controller
            .createRunProfile(
                CLRS_TEST_COVERAGE_PROFILE_LABEL,
                this.vscode.TestRunProfileKind.Coverage,
                async (request, token) => {
                    await this.run(request, token, {
                        publishCoverage: true,
                        runName:
                            CLRS_TEST_COVERAGE_RUN_NAME
                    });
                },
                true,
                undefined,
                false
            );
        this.coverageProfile.supportsContinuousRun =
            false;
        this.coverageProfile.loadDetailedCoverage = (
            testRun,
            fileCoverage,
            token
        ) => this.coveragePresenter
            .loadDetailedCoverage(
                testRun,
                fileCoverage,
                token
            );
        this.coverageProfile.loadDetailedCoverageForTest = (
            testRun,
            fileCoverage,
            fromTestItem,
            token
        ) => this.coveragePresenter
            .loadDetailedCoverageForTest(
                testRun,
                fileCoverage,
                fromTestItem,
                token
            );

        return this.profile;
    }

    activate(controller) {
        if (this.disposed) {
            return null;
        }

        const normalized = requirePort(
            controller,
            "vscodeTestController",
            [
                "createRunProfile",
                "createTestRun"
            ]
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
            ["execute"]
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

    async run(
        request = {},
        token = null,
        options = {}
    ) {
        if (this.disposed) {
            return null;
        }

        const testRun = this.controller
            .createTestRun(
                request,
                options.runName ??
                    CLRS_TEST_RUN_NAME,
                true
            );
        const abortController =
            new AbortController();
        const cancellation = token
            ?.onCancellationRequested?.(
                () => abortController.abort()
            ) ?? null;

        if (token?.isCancellationRequested === true) {
            abortController.abort();
        }

        this.activeControllers.add(abortController);

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

            const runnableGroups = new Map();

            for (const target of targets) {
                if (!target.metadata.runnable) {
                    testRun.started(target.item);
                    testRun.errored(
                        target.item,
                        this.#message(
                            target.item.error ??
                                "La prueba no puede ejecutarse porque su definición no está disponible."
                        )
                    );
                    continue;
                }

                if (target.metadata.kind !== "case") {
                    continue;
                }

                const groupKey = [
                    target.metadata.sourceId ??
                        "declarative",
                    target.metadata.sourceKey ??
                        target.metadata.definitionPath
                ].join(":");
                const group = runnableGroups.get(
                    groupKey
                ) ?? [];

                group.push(target);
                runnableGroups.set(
                    groupKey,
                    group
                );
            }

            for (const group of runnableGroups.values()) {
                if (abortController.signal.aborted) {
                    for (const target of group) {
                        testRun.skipped(target.item);
                    }
                    continue;
                }

                const metadata = group[0].metadata;

                if (
                    metadata.sourceId != null &&
                    metadata.sourceId !== "declarative"
                ) {
                    await this.#runExternalGroup({
                        sourceId: metadata.sourceId,
                        sourceKey: metadata.sourceKey,
                        targets: group,
                        testRun,
                        signal: abortController.signal,
                        publishCoverage:
                            options.publishCoverage ===
                                true
                    });
                    continue;
                }

                await this.#runGroup({
                    definitionPath:
                        metadata.definitionPath,
                    targets: group,
                    testRun,
                    signal: abortController.signal,
                    publishCoverage:
                        options.publishCoverage === true
                });
            }
        } catch (error) {
            this.#report(error);
        } finally {
            cancellation?.dispose?.();
            this.activeControllers.delete(
                abortController
            );
            testRun.end();
        }

        return testRun;
    }

    dispose() {
        if (this.disposed) {
            return;
        }

        this.disposed = true;

        for (const controller of this.activeControllers) {
            controller.abort();
        }

        this.activeControllers.clear();
        this.externalSources.clear();
        this.activationSubscription?.dispose?.();
        this.activationSubscription = null;
        this.profile?.dispose();
        this.profile = null;
        this.coverageProfile?.dispose();
        this.coverageProfile = null;
        this.controller = null;
    }

    async #runGroup({
        definitionPath,
        targets,
        testRun,
        signal,
        publishCoverage
    }) {
        const entry = this.discovery
            .findByDefinitionPath(definitionPath);

        if (
            entry?.suite == null ||
            entry.status !== "ready"
        ) {
            this.#errorTargets(
                testRun,
                targets,
                entry?.issue?.message ??
                    "La suite ya no está disponible."
            );
            return;
        }

        let sourceCode;

        try {
            sourceCode = await this.workspace
                .readText(entry.suite.programPath);
        } catch (error) {
            this.#report(error);
            this.#errorTargets(
                testRun,
                targets,
                "No fue posible leer el programa CLRS asociado."
            );
            return;
        }

        for (const target of targets) {
            testRun.started(target.item);
        }

        let execution;

        try {
            execution = await this.executor.execute({
                suite: entry.suite,
                sourceCode,
                sourceVersion:
                    this.workspace
                        .getDocumentVersion?.(
                            entry.suite.programPath
                        ) ?? null,
                caseIds: targets.map(
                    target =>
                        target.metadata.caseId
                ),
                seed: 0,
                signal
            });
        } catch (error) {
            this.#report(error);
            this.#errorTargets(
                testRun,
                targets,
                "No fue posible ejecutar la suite CLRS.",
                { started: true }
            );
            return;
        }

        this.#presentExecution({
            suite: entry.suite,
            execution,
            targets,
            testRun,
            publishCoverage
        });
    }

    async #runExternalGroup({
        sourceId,
        sourceKey,
        targets,
        testRun,
        signal,
        publishCoverage
    }) {
        const source = this.externalSources.get(
            sourceId
        );

        if (source == null) {
            this.#errorTargets(
                testRun,
                targets,
                "La fuente de pruebas ya no está disponible."
            );
            return;
        }

        for (const target of targets) {
            testRun.started(target.item);
        }

        let result;

        try {
            result = await source.execute({
                sourceKey,
                caseIds: targets.map(target =>
                    target.metadata.caseId
                ),
                signal
            });
        } catch (error) {
            this.#report(error);
            this.#errorTargets(
                testRun,
                targets,
                error?.publicMessage ??
                    "No fue posible ejecutar las pruebas del contrato activo.",
                { started: true }
            );
            return;
        }

        this.#presentExecution({
            suite: result.suite,
            execution: result.execution,
            targets,
            testRun,
            publishCoverage
        });
    }

    #presentExecution({
        suite,
        execution,
        targets,
        testRun,
        publishCoverage
    }) {
        const results = new Map(
            execution.results.map(result => [
                result.caseId,
                result
            ])
        );

        for (const target of targets) {
            const result = results.get(
                target.metadata.caseId
            );

            if (result == null) {
                testRun.errored(
                    target.item,
                    this.#message(
                        "El ejecutor no devolvió un resultado para este caso."
                    )
                );
                continue;
            }

            const testCase = suite.cases
                .find(candidate =>
                    candidate.id ===
                        target.metadata.caseId
                );

            if (testCase == null) {
                testRun.errored(
                    target.item,
                    this.#message(
                        "La definición ya no contiene este caso de prueba."
                    )
                );
                continue;
            }

            this.resultPresenter.present({
                testRun,
                item: target.item,
                testCase,
                result,
                programPath: suite.programPath
            });
        }

        if (publishCoverage === true) {
            this.coveragePresenter.present({
                testRun,
                execution,
                targets,
                programPath: suite.programPath
            });
        }
    }

    #message(value) {
        return new this.vscode.TestMessage(value);
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
                this.#message(message)
            );
        }
    }

    #report(error) {
        try {
            this.developerLogger.error?.(
                "CLRS native test execution failed.",
                error
            );
        } catch {
            // El registro técnico no altera el TestRun.
        }
    }
}
