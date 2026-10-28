import test from "node:test";
import assert from "node:assert/strict";

import {
    CLRS_GETTING_STARTED_COMMANDS,
    registerGettingStartedCommands
} from "../extension/commands/GettingStartedCommands.js";
import {
    CLRS_CLI_PROGRAM_SOURCE,
    CLRS_CLI_PROJECT,
    CLRS_CLI_TEST_SUITE_SOURCE,
    CLRS_GUI_PROGRAM_SOURCE,
    CLRS_GUI_PROJECT,
    CLRS_GUI_TEST_SUITE_SOURCE
} from "../extension/getting-started/CLRSExampleProject.js";
import {
    CLRSNodeTestProcessRunner,
    CLRSTestExecutor,
    CLRSTestRunStatus,
    parseCLRSTestDocument
} from "../src/testing/index.js";
import {
    DocumentAnalysisService
} from "../src/language/analysis/DocumentAnalysisService.js";
import {
    LanguageDiagnosticsService
} from "../src/language/diagnostics/LanguageDiagnosticsService.js";
import {
    JavaScriptGenerator
} from "../src/compiler/JavaScriptGenerator.js";

test("el proyecto CLI es mínimo y aprueba su comparación exacta", async () => {
    const suite = parseCLRSTestDocument(
        CLRS_CLI_TEST_SUITE_SOURCE,
        "C:/ejemplo/programa.clrs-tests.json"
    );
    const executor = new CLRSTestExecutor({
        documentAnalysisService:
            new DocumentAnalysisService({
                languageDiagnosticsService:
                    new LanguageDiagnosticsService(),
                analyzeCost() {
                    return null;
                }
            }),
        javaScriptGenerator:
            new JavaScriptGenerator(),
        processRunner:
            new CLRSNodeTestProcessRunner()
    });
    const result = await executor.execute({
        suite,
        sourceCode: CLRS_CLI_PROGRAM_SOURCE,
        sourceVersion: 1,
        seed: 61
    });

    assert.equal(
        result.status,
        CLRSTestRunStatus.COMPLETED
    );
    assert.deepEqual(result.summary, {
        total: 1,
        passed: 1,
        failed: 0,
        errored: 0,
        skipped: 0,
        cancelled: 0
    });
    assert.equal(
        suite.cases[0].expectation.comparison,
        "exact"
    );
    assert.deepEqual(
        CLRS_CLI_PROJECT.files.map(
            item => item.relativePath
        ),
        [
            "programa.clrs",
            "programa.clrs-tests.json"
        ]
    );
});

test("el proyecto GUI conserva el programa solicitado y una suite válida", () => {
    const analysis =
        new LanguageDiagnosticsService()
            .analyze(CLRS_GUI_PROGRAM_SOURCE);
    const suite = parseCLRSTestDocument(
        CLRS_GUI_TEST_SUITE_SOURCE,
        "C:/ejemplo/programa.clrs-tests.json"
    );

    assert.equal(analysis.ok, true);
    assert.equal(
        analysis.semanticModel.gui.usage.requiresGui,
        true
    );
    assert.equal(
        suite.cases[0].expectation.comparison,
        "exact"
    );
    assert.deepEqual(
        CLRS_GUI_PROJECT.files.map(
            item => item.relativePath
        ),
        [
            "programa.clrs",
            "programa.clrs-tests.json"
        ]
    );
    assert.match(
        CLRS_GUI_PROGRAM_SOURCE,
        /CONECTAR\(saludarBoton, "clic", SALUDAR\)/
    );
});

test("crea los proyectos CLI y GUI con programa.clrs y sin README", async () => {
    const scenarios = [
        {
            command:
                CLRS_GETTING_STARTED_COMMANDS
                    .CREATE_CLI_PROJECT,
            program: CLRS_CLI_PROGRAM_SOURCE,
            suite: CLRS_CLI_TEST_SUITE_SOURCE
        },
        {
            command:
                CLRS_GETTING_STARTED_COMMANDS
                    .CREATE_GUI_PROJECT,
            program: CLRS_GUI_PROGRAM_SOURCE,
            suite: CLRS_GUI_TEST_SUITE_SOURCE
        }
    ];

    for (const scenario of scenarios) {
        const fixture = createFixture({
            informationAction: "Abrir programa"
        });

        registerGettingStartedCommands({
            vscodeApi: fixture.vscode,
            lifecycle: fixture.lifecycle
        });

        const result = await fixture.handlers.get(
            scenario.command
        )();

        assert.equal(result.status, "created");
        assert.equal(result.files.length, 2);
        assert.deepEqual(
            [...fixture.files.entries()],
            [
                [
                    "/proyecto/programa.clrs",
                    scenario.program
                ],
                [
                    "/proyecto/programa.clrs-tests.json",
                    scenario.suite
                ]
            ]
        );
        assert.equal(
            fixture.shown.at(0).document.uri.path,
            "/proyecto/programa.clrs"
        );
        assert.equal(fixture.executions.length, 0);
        assert.equal(
            fixture.files.has("/proyecto/README.md"),
            false
        );
    }
});

test("no sobrescribe una carpeta ocupada y respeta la cancelación", async () => {
    const occupied = createFixture({
        entries: [["existente.txt", 1]]
    });

    registerGettingStartedCommands({
        vscodeApi: occupied.vscode,
        lifecycle: occupied.lifecycle
    });

    const occupiedResult =
        await occupied.handlers.get(
            CLRS_GETTING_STARTED_COMMANDS
                .CREATE_CLI_PROJECT
        )();

    assert.equal(
        occupiedResult.status,
        "not-empty"
    );
    assert.equal(occupied.files.size, 0);
    assert.equal(occupied.warnings.length, 1);

    const cancelled = createFixture({
        selection: undefined
    });

    registerGettingStartedCommands({
        vscodeApi: cancelled.vscode,
        lifecycle: cancelled.lifecycle
    });

    const cancelledResult =
        await cancelled.handlers.get(
            CLRS_GETTING_STARTED_COMMANDS
                .CREATE_GUI_PROJECT
        )();

    assert.equal(
        cancelledResult.status,
        "cancelled"
    );
    assert.equal(cancelled.files.size, 0);
});

function createFixture(options = {}) {
    const projectUri = uri("/proyecto");
    const handlers = new Map();
    const files = new Map();
    const shown = [];
    const warnings = [];
    const executions = [];
    const lifecycle = {
        add() {}
    };
    const vscode = {
        Uri: {
            joinPath(base, relativePath) {
                return uri(
                    `${base.path}/${relativePath}`
                );
            }
        },
        commands: {
            registerCommand(command, handler) {
                handlers.set(command, handler);

                return {
                    dispose() {}
                };
            },
            async executeCommand(
                command,
                ...args
            ) {
                executions.push({
                    command,
                    args
                });
            }
        },
        workspace: {
            fs: {
                async readDirectory() {
                    return options.entries ?? [];
                },
                async writeFile(fileUri, bytes) {
                    files.set(
                        fileUri.path,
                        new TextDecoder()
                            .decode(bytes)
                    );
                }
            },
            async openTextDocument(fileUri) {
                return {
                    uri: fileUri,
                    getText() {
                        return files.get(
                            fileUri.path
                        );
                    }
                };
            }
        },
        window: {
            async showOpenDialog() {
                return Object.hasOwn(
                    options,
                    "selection"
                )
                    ? options.selection
                    : [projectUri];
            },
            async showWarningMessage(message) {
                warnings.push(message);
            },
            async showInformationMessage() {
                return options
                    .informationAction;
            },
            async showTextDocument(
                document,
                editorOptions
            ) {
                shown.push({
                    document,
                    options: editorOptions
                });
            }
        }
    };

    return {
        vscode,
        lifecycle,
        handlers,
        files,
        shown,
        warnings,
        executions
    };
}

function uri(path) {
    return Object.freeze({
        path,
        toString() {
            return `file://${path}`;
        }
    });
}
