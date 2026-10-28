import {
    accumulateCLRSTestCoverage
} from "../../src/testing/index.js";
import {
    ExecutionCoverageKind
} from "../../src/runtime/ExecutionCoverageEvent.js";
import {
    requireObject,
    requirePort
} from "../../src/application/ports/ApplicationPorts.js";

const CONDITION_KINDS = new Set([
    ExecutionCoverageKind.BRANCH,
    ExecutionCoverageKind.LOOP
]);

/**
 * Adapta la evidencia neutral de CLRS a la API de cobertura de VS Code. El
 * estado queda asociado al TestRun y al FileCoverage que VS Code entrega de
 * vuelta al solicitar sus detalles.
 */
export class CLRSTestCoveragePresenter {

    constructor(options = {}) {
        this.vscode = requireObject(
            options.vscodeApi,
            "vscodeApi"
        );
        this.workspace = requirePort(
            options.workspace,
            "testWorkspace",
            ["toUri"]
        );
        this.coverageStore =
            options.coverageStore == null
                ? null
                : requirePort(
                    options.coverageStore,
                    "testCoverageStore",
                    ["publish"]
                );
        this.runStates = new WeakMap();
        this.fileStates = new WeakMap();
    }

    present({
        testRun,
        execution,
        targets,
        programPath
    }) {
        if (
            execution?.coverage == null ||
            typeof testRun?.addCoverage !== "function"
        ) {
            return null;
        }

        const files = this.runStates.get(testRun) ??
            new Map();
        const previous = files.get(programPath) ?? null;
        const coverage = previous == null
            ? execution.coverage
            : accumulateCLRSTestCoverage({
                coverages: [
                    previous.coverage,
                    execution.coverage
                ]
            });
        const byTest = previous == null
            ? new Map()
            : new Map(previous.byTest);
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

            if (result?.coverage != null) {
                byTest.set(target.item, result.coverage);
            }
        }

        const fileCoverage = previous?.fileCoverage ??
            this.#createFileCoverage(
                programPath,
                coverage,
                [...byTest.keys()]
            );

        if (previous != null) {
            this.#updateFileCoverage(
                fileCoverage,
                coverage,
                [...byTest.keys()]
            );
        }

        const state = Object.freeze({
            testRun,
            coverage,
            byTest,
            fileCoverage
        });

        files.set(programPath, state);
        this.runStates.set(testRun, files);
        this.fileStates.set(fileCoverage, state);
        testRun.addCoverage(fileCoverage);
        this.coverageStore?.publish({
            sourcePath: programPath,
            documentVersion:
                execution.sourceVersion ?? null,
            coverage
        });
        this.#presentPartialWarning(
            testRun,
            coverage
        );

        return fileCoverage;
    }

    async loadDetailedCoverage(
        testRun,
        fileCoverage,
        token
    ) {
        const state = this.#stateFor(
            testRun,
            fileCoverage,
            token
        );

        return state == null
            ? []
            : this.#details(state.coverage);
    }

    async loadDetailedCoverageForTest(
        testRun,
        fileCoverage,
        fromTestItem,
        token
    ) {
        const state = this.#stateFor(
            testRun,
            fileCoverage,
            token
        );

        if (state == null) {
            return [];
        }

        const coverage = state.byTest.get(
            fromTestItem
        ) ?? [...state.byTest.entries()]
            .find(([item]) =>
                item.id === fromTestItem?.id
            )?.[1] ?? null;

        return coverage == null
            ? []
            : this.#details(coverage);
    }

    #createFileCoverage(
        programPath,
        coverage,
        includesTests
    ) {
        const counts = nativeCounts(
            this.vscode,
            coverage
        );

        return new this.vscode.FileCoverage(
            this.workspace.toUri(programPath),
            counts.statements,
            counts.branches,
            counts.declarations,
            includesTests.length === 0
                ? undefined
                : includesTests
        );
    }

    #updateFileCoverage(
        fileCoverage,
        coverage,
        includesTests
    ) {
        const counts = nativeCounts(
            this.vscode,
            coverage
        );

        fileCoverage.statementCoverage =
            counts.statements;
        fileCoverage.branchCoverage =
            counts.branches;
        fileCoverage.declarationCoverage =
            counts.declarations;
        fileCoverage.includesTests =
            includesTests.length === 0
                ? undefined
                : includesTests;
    }

    #details(coverage) {
        return coverage.points.map(point => {
            const location = nativeRange(
                this.vscode,
                point.location
            );

            if (
                point.kind ===
                    ExecutionCoverageKind.FUNCTION
            ) {
                return new this.vscode
                    .DeclarationCoverage(
                        point.name ?? "Función CLRS",
                        point.hitCount,
                        location
                    );
            }

            return new this.vscode.StatementCoverage(
                point.hitCount,
                location,
                nativeBranches(
                    this.vscode,
                    point,
                    location
                )
            );
        });
    }

    #stateFor(testRun, fileCoverage, token) {
        if (token?.isCancellationRequested === true) {
            return null;
        }

        const state = this.fileStates.get(
            fileCoverage
        );

        return state?.testRun === testRun
            ? state
            : null;
    }

    #presentPartialWarning(testRun, coverage) {
        if (
            coverage.complete &&
            !coverage.truncated
        ) {
            return;
        }

        const details = [
            `evidencia de ${coverage.evidenceTestCount}/${coverage.testCount} pruebas`,
            coverage.truncated
                ? "la traza alcanzó su límite"
                : "una o más trazas no se completaron"
        ];

        testRun.appendOutput(
            `Cobertura CLRS parcial: ${details.join("; ")}\r\n`
        );
    }
}

function nativeCounts(vscode, coverage) {
    const statements = coverage.points.filter(point =>
        point.kind !== ExecutionCoverageKind.FUNCTION
    );
    const declarations = coverage.points.filter(point =>
        point.kind === ExecutionCoverageKind.FUNCTION
    );
    const conditions = coverage.points.filter(point =>
        CONDITION_KINDS.has(point.kind)
    );
    const totalBranchOutcomes = conditions.length * 2;
    const coveredBranchOutcomes = conditions.reduce(
        (total, point) => total +
            (point.outcomeCounts.true > 0 ? 1 : 0) +
            (point.outcomeCounts.false > 0 ? 1 : 0),
        0
    );

    return {
        statements: new vscode.TestCoverageCount(
            statements.filter(point =>
                point.hitCount > 0
            ).length,
            statements.length
        ),
        branches: totalBranchOutcomes === 0
            ? undefined
            : new vscode.TestCoverageCount(
                coveredBranchOutcomes,
                totalBranchOutcomes
            ),
        declarations: declarations.length === 0
            ? undefined
            : new vscode.TestCoverageCount(
                declarations.filter(point =>
                    point.hitCount > 0
                ).length,
                declarations.length
            )
    };
}

function nativeBranches(vscode, point, location) {
    if (!CONDITION_KINDS.has(point.kind)) {
        return undefined;
    }

    const labels = point.kind ===
        ExecutionCoverageKind.LOOP
        ? ["continúa", "termina"]
        : ["sí", "no"];

    return [
        new vscode.BranchCoverage(
            point.outcomeCounts.true,
            location,
            labels[0]
        ),
        new vscode.BranchCoverage(
            point.outcomeCounts.false,
            location,
            labels[1]
        )
    ];
}

function nativeRange(vscode, location) {
    const startLine = Math.max(
        0,
        location.startLine - 1
    );
    const startColumn = Math.max(
        0,
        location.startColumn - 1
    );
    const endLine = Math.max(
        startLine,
        location.endLine - 1
    );
    const endColumn = Math.max(
        endLine === startLine
            ? startColumn
            : 0,
        location.endColumn - 1
    );

    return new vscode.Range(
        startLine,
        startColumn,
        endLine,
        endColumn
    );
}
