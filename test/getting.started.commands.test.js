import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
    CLRS_EXTENSION_ID,
    CLRS_FIRST_PROGRAM_SOURCE,
    CLRS_FIRST_TEST_SUITE_SOURCE,
    CLRS_GETTING_STARTED_COMMANDS,
    CLRS_WALKTHROUGH_ID,
    registerGettingStartedCommands
} from "../extension/commands/GettingStartedCommands.js";
import {
    createExtensionConfiguration
} from "../extension/config/ExtensionConfiguration.js";
import {
    createViewState
} from "../extension/providers/ViewState.js";

test("registra el inicio guiado y abre documentos iniciales sin guardarlos", async () => {
    const fixture = createFixture();
    const registration =
        registerGettingStartedCommands({
            vscodeApi: fixture.vscode,
            lifecycle: fixture.lifecycle,
            languageId: "clrs-es"
        });

    assert.equal(
        registration.walkthroughId,
        CLRS_WALKTHROUGH_ID
    );
    assert.deepEqual(
        registration.commandIds,
        Object.values(
            CLRS_GETTING_STARTED_COMMANDS
        )
    );
    assert.equal(
        fixture.lifecycle.resources.length,
        5
    );

    await fixture.handlers.get(
        CLRS_GETTING_STARTED_COMMANDS
            .OPEN_WALKTHROUGH
    )();

    assert.deepEqual(
        fixture.executions,
        [{
            command:
                "workbench.action.openWalkthrough",
            args: [
                `${CLRS_EXTENSION_ID}#${CLRS_WALKTHROUGH_ID}`,
                false
            ]
        }]
    );

    const program = await fixture.handlers.get(
        CLRS_GETTING_STARTED_COMMANDS
            .CREATE_PROGRAM
    )();
    const suite = await fixture.handlers.get(
        CLRS_GETTING_STARTED_COMMANDS
            .CREATE_TEST_SUITE
    )();

    assert.equal(
        program.languageId,
        "clrs-es"
    );
    assert.equal(
        program.getText(),
        CLRS_FIRST_PROGRAM_SOURCE
    );
    assert.equal(suite.languageId, "json");
    assert.deepEqual(
        JSON.parse(suite.getText()),
        JSON.parse(
            CLRS_FIRST_TEST_SUITE_SOURCE
        )
    );
    assert.equal(fixture.shown.length, 2);
    assert.ok(
        fixture.shown.every(
            item =>
                item.options.preview ===
                    false &&
                item.options
                    .preserveFocus === false
        )
    );
});

test("el manifiesto publica seis pasos nativos accionables", () => {
    const manifest = JSON.parse(
        fs.readFileSync(
            new URL(
                "../package.json",
                import.meta.url
            ),
            "utf8"
        )
    );
    const walkthrough =
        manifest.contributes
            .walkthroughs.find(
                item =>
                    item.id ===
                    CLRS_WALKTHROUGH_ID
            );

    assert.ok(walkthrough);
    assert.equal(walkthrough.steps.length, 6);
    assert.deepEqual(
        walkthrough.steps.map(
            step => step.id
        ),
        [
            "createProgram",
            "runProgram",
            "openDiagram",
            "debugProgram",
            "createTests",
            "openLearning"
        ]
    );
    assert.ok(
        walkthrough.steps.every(
            step =>
                typeof step.media
                    ?.markdown === "string" &&
                step.media.markdown.length > 0 &&
                fs.existsSync(
                    new URL(
                        `../${step.media.markdown}`,
                        import.meta.url
                    )
                ) &&
                step.completionEvents
                    .some(event =>
                        event.startsWith(
                            "onCommand:"
                        )
                    )
        )
    );

    const contributed = new Set(
        manifest.contributes.commands.map(
            command => command.command
        )
    );

    assert.ok(
        Object.values(
            CLRS_GETTING_STARTED_COMMANDS
        ).every(command =>
            contributed.has(command)
        )
    );
});

test("agrupa las acciones del editor y conserva su orden visual", () => {
    const manifest = JSON.parse(
        fs.readFileSync(
            new URL(
                "../package.json",
                import.meta.url
            ),
            "utf8"
        )
    );
    const menus = manifest.contributes.menus;

    assert.deepEqual(
        menus["editor/title"].map(
            item => item.submenu ?? item.command
        ),
        [
            "clrs.editor.execute",
            "clrs.editor.analyze",
            "clrs.editor.diagram",
            "CLRS.playBroker95",
            "clrs.editor.create",
            "clrs.editor.start"
        ]
    );
    assert.deepEqual(
        menus["clrs.editor.execute"].map(
            item => item.command
        ),
        [
            "CLRS.runCode",
            "CLRS.stopCode",
            "CLRS.debugCode",
            "CLRS.generateCode"
        ]
    );
    assert.equal(
        menus["clrs.editor.execute"][2].group,
        "navigation@3"
    );
    assert.equal(
        menus["clrs.editor.execute"][3].group,
        "generation@1"
    );
    assert.deepEqual(
        menus["clrs.editor.start"].map(
            item => item.command
        ),
        [
            "CLRS.openWalkthrough",
            "CLRS.openContextualStart",
            "CLRS.installCopilotCliSupport"
        ]
    );
    assert.notEqual(
        menus["clrs.editor.start"][1]
            .group.split("@")[0],
        menus["clrs.editor.start"][2]
            .group.split("@")[0]
    );
    assert.deepEqual(
        menus["clrs.editor.create"].map(
            item => item.command
        ),
        [
            "CLRS.createExampleProject",
            "CLRS.createGuiProject",
            "CLRS.createFirstProgram",
            "CLRS.createFirstTestSuite"
        ]
    );
    const commandTitles = Object.fromEntries(
        manifest.contributes.commands.map(
            item => [item.command, item.title]
        )
    );
    assert.equal(
        commandTitles["CLRS.createExampleProject"],
        "Crear proyecto CLRS de CLI"
    );
    assert.equal(
        commandTitles["CLRS.createGuiProject"],
        "Crear proyecto CLRS de GUI"
    );
    assert.deepEqual(
        menus["clrs.editor.analyze"].map(
            item => item.command
        ),
        [
            "CLRS.showComplexityReport",
            "CLRS.toggleCost"
        ]
    );
    assert.deepEqual(
        menus["clrs.editor.diagram"].map(
            item => item.command
        ),
        [
            "CLRS.toggleDiagram",
            "CLRS.exportSVG"
        ]
    );

    const submenuIcons = Object.fromEntries(
        manifest.contributes.submenus.map(
            submenu => [
                submenu.id,
                submenu.icon
            ]
        )
    );
    assert.deepEqual(submenuIcons, {
        "clrs.editor.execute": "$(play)",
        "clrs.editor.start": "$(rocket)",
        "clrs.editor.create": "$(diff-added)",
        "clrs.editor.analyze": "$(graph-line)",
        "clrs.editor.diagram":
            "$(type-hierarchy-sub)"
    });
});

test("oculta inicialmente el costo algorítmico", () => {
    assert.equal(
        createExtensionConfiguration()
            .initialShowCost,
        false
    );
    assert.equal(
        createViewState().showCost,
        false
    );
});

function createFixture() {
    const handlers = new Map();
    const executions = [];
    const shown = [];
    const lifecycle = {
        resources: [],
        add(...resources) {
            this.resources.push(...resources);
        }
    };
    const vscode = {
        commands: {
            registerCommand(command, handler) {
                handlers.set(command, handler);

                return {
                    dispose() {}
                };
            },
            executeCommand(command, ...args) {
                executions.push({
                    command,
                    args
                });

                return true;
            }
        },
        workspace: {
            async openTextDocument(options) {
                return {
                    languageId:
                        options.language,
                    getText() {
                        return options.content;
                    }
                };
            }
        },
        window: {
            async showTextDocument(
                document,
                options
            ) {
                shown.push({
                    document,
                    options
                });

                return {
                    document
                };
            }
        }
    };

    return {
        vscode,
        lifecycle,
        handlers,
        executions,
        shown
    };
}
