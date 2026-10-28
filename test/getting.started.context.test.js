import test from "node:test";
import assert from "node:assert/strict";

import {
    CLRS_CONTEXTUAL_START_COMMAND,
    registerContextualStartCommands
} from "../extension/commands/ContextualStartCommands.js";
import {
    CLRS_CONTEXTUAL_START_STATE,
    resolveCLRSContextualStart
} from "../extension/getting-started/CLRSContextualStart.js";

test("clasifica espacios vacíos, programas, suites y proyectos probados", () => {
    const programUri = uri("/curso/programa.clrs");
    const suiteUri = uri(
        "/curso/programa.clrs-tests.json"
    );
    const empty = resolveCLRSContextualStart();
    const available = resolveCLRSContextualStart({
        programUris: [programUri]
    });
    const tested = resolveCLRSContextualStart({
        programUris: [programUri],
        testSuiteUris: [suiteUri]
    });
    const activeProgram =
        resolveCLRSContextualStart({
            activeDocument: {
                languageId: "clrs-es",
                uri: programUri
            },
            testSuiteUris: [suiteUri]
        });
    const activeSuite =
        resolveCLRSContextualStart({
            activeDocument: {
                languageId: "json",
                uri: suiteUri
            },
            programUris: [programUri]
        });

    assert.equal(
        empty.state,
        CLRS_CONTEXTUAL_START_STATE.EMPTY
    );
    assert.equal(
        empty.actions[0].commandId,
        "CLRS.createExampleProject"
    );
    assert.match(
        empty.actions[0].label,
        /Crear proyecto CLRS de CLI/
    );
    assert.equal(
        available.state,
        CLRS_CONTEXTUAL_START_STATE
            .PROGRAM_AVAILABLE
    );
    assert.equal(
        available.actions[0].kind,
        "document"
    );
    assert.equal(
        tested.state,
        CLRS_CONTEXTUAL_START_STATE
            .TESTED_PROJECT
    );
    assert.equal(
        activeProgram.state,
        CLRS_CONTEXTUAL_START_STATE
            .PROGRAM_ACTIVE
    );
    assert.ok(
        activeProgram.actions.some(
            action =>
                action.commandId ===
                "workbench.view.testing.focus"
        )
    );
    assert.equal(
        activeSuite.state,
        CLRS_CONTEXTUAL_START_STATE
            .SUITE_ACTIVE
    );
    assert.equal(
        Object.isFrozen(
            activeSuite.actions
        ),
        true
    );
});

test("ejecuta la acción elegida para el contexto activo", async () => {
    const fixture = createFixture({
        activeDocument: {
            languageId: "clrs-es",
            uri: uri("/curso/programa.clrs")
        },
        testSuiteUris: [
            uri(
                "/curso/programa.clrs-tests.json"
            )
        ],
        select(actions) {
            return actions.find(
                action =>
                    action.commandId ===
                    "CLRS.toggleDiagram"
            );
        }
    });

    registerContextualStartCommands({
        vscodeApi: fixture.vscode,
        lifecycle: fixture.lifecycle
    });
    const result = await fixture.handlers.get(
        CLRS_CONTEXTUAL_START_COMMAND
    )();

    assert.deepEqual(result, {
        status: "selected",
        state: "program-active",
        action: "CLRS.toggleDiagram"
    });
    assert.deepEqual(fixture.executions, [
        "CLRS.toggleDiagram"
    ]);
    assert.equal(
        fixture.quickPickOptions.title,
        "Continúa con el programa activo"
    );
});

test("abre el programa encontrado sin ejecutar una acción distinta", async () => {
    const programUri =
        uri("/curso/programa.clrs");
    const fixture = createFixture({
        programUris: [programUri],
        select(actions) {
            return actions.find(
                action =>
                    action.kind === "document"
            );
        }
    });

    registerContextualStartCommands({
        vscodeApi: fixture.vscode,
        lifecycle: fixture.lifecycle
    });
    const result = await fixture.handlers.get(
        CLRS_CONTEXTUAL_START_COMMAND
    )();

    assert.equal(result.status, "selected");
    assert.equal(
        result.action,
        "file:///curso/programa.clrs"
    );
    assert.equal(
        fixture.shown.at(0).document.uri,
        programUri
    );
    assert.equal(fixture.executions.length, 0);
});

test("la cancelación no ejecuta comandos ni abre documentos", async () => {
    const fixture = createFixture({
        select() {
            return undefined;
        }
    });

    registerContextualStartCommands({
        vscodeApi: fixture.vscode,
        lifecycle: fixture.lifecycle
    });
    const result = await fixture.handlers.get(
        CLRS_CONTEXTUAL_START_COMMAND
    )();

    assert.deepEqual(result, {
        status: "cancelled",
        state: "empty"
    });
    assert.equal(fixture.executions.length, 0);
    assert.equal(fixture.shown.length, 0);
});

function createFixture(options = {}) {
    const handlers = new Map();
    const executions = [];
    const shown = [];
    const lifecycle = {
        resources: [],
        add(...resources) {
            this.resources.push(...resources);
        }
    };
    let quickPickOptions = null;
    const vscode = {
        commands: {
            registerCommand(command, handler) {
                handlers.set(command, handler);

                return {
                    dispose() {}
                };
            },
            async executeCommand(command) {
                executions.push(command);
            }
        },
        workspace: {
            async findFiles(pattern) {
                return pattern === "**/*.clrs"
                    ? options.programUris ?? []
                    : options.testSuiteUris ?? [];
            },
            async openTextDocument(documentUri) {
                return {
                    uri: documentUri
                };
            }
        },
        window: {
            activeTextEditor:
                options.activeDocument == null
                    ? null
                    : {
                        document:
                            options.activeDocument
                    },
            async showQuickPick(
                actions,
                quickPick
            ) {
                quickPickOptions = quickPick;

                return options.select(actions);
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
        executions,
        shown,
        get quickPickOptions() {
            return quickPickOptions;
        }
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
