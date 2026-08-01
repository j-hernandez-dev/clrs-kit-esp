import assert from "node:assert/strict";

import * as vscode from "vscode";

const extensionId =
    "j-hernandez-dev.clrs-kit-esp";
const expectedCommands = [
    "CLRS.runCode",
    "CLRS.copyCostExpression",
    "CLRS.toggleCost",
    "CLRS.generateCodeDiagram",
    "CLRS.generateCode",
    "CLRS.toggleDiagram",
    "CLRS.exportSVG"
];

suite("CLRS Kit Extension Host", () => {
    let extension;
    let application;
    let sourceUri;
    let generatedUri;

    suiteSetup(async () => {
        extension =
            vscode.extensions
                .getExtension(extensionId);

        assert.ok(
            extension,
            `No se encontró ${extensionId}.`
        );

        const workspace =
            vscode.workspace
                .workspaceFolders?.[0];

        assert.ok(
            workspace,
            "La prueba requiere el workspace fixture."
        );

        sourceUri = vscode.Uri.joinPath(
            workspace.uri,
            "programa.clrs"
        );
        generatedUri =
            vscode.Uri.joinPath(
                workspace.uri,
                ".clrs",
                "js",
                "programa.js"
            );
    });

    suiteTeardown(async () => {
        try {
            await vscode.workspace.fs
                .delete(generatedUri, {
                    recursive: false,
                    useTrash: false
                });
        } catch {
            // El artefacto puede no existir si falló su prueba.
        }

        await vscode.commands
            .executeCommand(
                "workbench.action.closeAllEditors"
            );
    });

    test("activa la extensión desde un comando contribuido", async () => {
        const activationResult =
            await vscode.commands
                .executeCommand(
                    "CLRS.toggleCost"
                );

        assert.equal(
            activationResult.ok,
            true
        );
        assert.equal(
            extension.isActive,
            true
        );

        application =
            await extension.activate();

        assert.ok(application);
        assert.equal(
            application.config.languageId,
            "clrs-es"
        );

        const commands =
            await vscode.commands
                .getCommands(true);

        for (
            const command
            of expectedCommands
        ) {
            assert.ok(
                commands.includes(command),
                `Falta el comando ${command}.`
            );
        }

        if (
            !application
                .viewState.showCost
        ) {
            await vscode.commands
                .executeCommand(
                    "CLRS.toggleCost"
                );
        }
    });

    test("abre un documento CLRS y genera JavaScript", async () => {
        const document =
            await vscode.workspace
                .openTextDocument(
                    sourceUri
                );

        await vscode.window
            .showTextDocument(document);

        assert.equal(
            document.languageId,
            "clrs-es"
        );

        const result =
            await vscode.commands
                .executeCommand(
                    "CLRS.generateCode"
                );

        assert.equal(result.ok, true);

        const generated =
            await vscode.workspace.fs
                .readFile(generatedUri);
        const source =
            new TextDecoder()
                .decode(generated);

        assert.match(
            source,
            /async function PRINCIPAL/
        );
    });

    test("publica diagnósticos en línea y los elimina al corregir el documento", async () => {
        const document =
            await vscode.workspace
                .openTextDocument({
                    language:
                        "clrs-es",
                    content: [
                        "PRINCIPAL()",
                        "    escribir fantasma"
                    ].join("\n")
                });
        const editor =
            await vscode.window
                .showTextDocument(
                    document
                );
        const diagnostics =
            await waitForDiagnostics(
                document.uri,
                items =>
                    items.some(
                        diagnostic =>
                            diagnostic.code ===
                            "CLRS_UNDEFINED_IDENTIFIER"
                    )
            );
        const undefinedIdentifier =
            diagnostics.find(
                diagnostic =>
                    diagnostic.code ===
                    "CLRS_UNDEFINED_IDENTIFIER"
            );

        assert.ok(
            undefinedIdentifier
        );
        assert.equal(
            undefinedIdentifier.source,
            "CLRS"
        );
        assert.equal(
            undefinedIdentifier.message,
            "El identificador «fantasma» no está definido."
        );
        assert.equal(
            undefinedIdentifier.range
                .start.line,
            1
        );
        assert.equal(
            undefinedIdentifier.range
                .start.character,
            13
        );

        await editor.edit(
            editBuilder => {
                editBuilder.replace(
                    new vscode.Range(
                        document.positionAt(0),
                        document.positionAt(
                            document.getText()
                                .length
                        )
                    ),
                    [
                        "PRINCIPAL()",
                        "    dato <- 1",
                        "    escribir dato"
                    ].join("\n")
                );
            }
        );

        await waitForDiagnostics(
            document.uri,
            items =>
                items.filter(
                    diagnostic =>
                        diagnostic.source ===
                        "CLRS"
                ).length === 0
        );

        await vscode.commands
            .executeCommand(
                "workbench.action.closeActiveEditor"
            );
    });

    test("no confunde tabulaciones ni continuaciones con bloques nuevos", async () => {
        const document =
            await vscode.workspace
                .openTextDocument({
                    language:
                        "clrs-es",
                    content: [
                        "PRINCIPAL()",
                        "\tdato <- (",
                        "        1 + 2",
                        "    )",
                        "    escribir dato"
                    ].join("\n")
                });

        await vscode.window
            .showTextDocument(document);
        await application
            .providers
            .staticDiagnostics
            .refresh(document);

        const diagnostics =
            vscode.languages
                .getDiagnostics(
                    document.uri
                )
                .filter(
                    diagnostic =>
                        diagnostic.source ===
                        "CLRS"
                );

        assert.deepEqual(
            diagnostics,
            []
        );

        await vscode.commands
            .executeCommand(
                "workbench.action.closeActiveEditor"
            );
    });

    test("expone CodeLens y alterna el análisis de coste", async () => {
        if (
            !application
                .viewState.showCost
        ) {
            await vscode.commands
                .executeCommand(
                    "CLRS.toggleCost"
                );
        }

        const lenses =
            await vscode.commands
                .executeCommand(
                    "vscode.executeCodeLensProvider",
                    sourceUri
                );

        assert.ok(
            Array.isArray(lenses)
        );
        assert.ok(lenses.length > 0);
        assert.ok(
            lenses.every(lens =>
                !lens.command?.title
                    .includes("O(")
            )
        );
        const costLens =
            lenses.find(lens =>
                lens.command?.title
                    .startsWith(
                        "TPRINCIPAL() = "
                    )
            );

        assert.ok(costLens);
        assert.equal(
            costLens.range.start.line,
            0
        );

        const previous =
            application
                .viewState.showCost;
        const result =
            await vscode.commands
                .executeCommand(
                    "CLRS.toggleCost"
                );

        assert.equal(result.ok, true);
        assert.equal(
            application
                .viewState.showCost,
            !previous
        );

        await vscode.commands
            .executeCommand(
                "CLRS.toggleCost"
            );
    });

    test("conserva recurrencias resueltas fuera del CodeLens", async () => {
        const document =
            await vscode.workspace
                .openTextDocument({
                    language: "clrs-es",
                    content: [
                        "BINARIA(n)",
                        "    si n > 1",
                        "        retornar BINARIA(n / 2)",
                        "    retornar 0"
                    ].join("\n")
                });

        await vscode.window
            .showTextDocument(document);

        const lenses =
            await vscode.commands
                .executeCommand(
                    "vscode.executeCodeLensProvider",
                    document.uri
                );

        assert.ok(
            lenses.some(lens =>
                lens.command?.title
                    .startsWith(
                        "TBINARIA(n) = "
                    )
            )
        );
        assert.ok(
            lenses.every(lens =>
                lens.command?.title !==
                "TBINARIA(n) = O(log n)"
            )
        );

        await vscode.commands
            .executeCommand(
                "workbench.action.closeActiveEditor"
            );
    });

    test("abre el diagrama y acepta la solicitud de exportación", async () => {
        const document =
            await vscode.workspace
                .openTextDocument(
                    sourceUri
                );

        await vscode.window
            .showTextDocument(document);

        const opened =
            await vscode.commands
                .executeCommand(
                    "CLRS.toggleDiagram"
                );
        const exported =
            await vscode.commands
                .executeCommand(
                    "CLRS.exportSVG"
                );

        assert.equal(opened.ok, true);
        assert.equal(exported.ok, true);

        await vscode.commands
            .executeCommand(
                "workbench.action.closeActiveEditor"
            );
    });

    test("devuelve un error estructurado sin editor activo", async () => {
        await vscode.commands
            .executeCommand(
                "workbench.action.closeAllEditors"
            );

        const result =
            await vscode.commands
                .executeCommand(
                    "CLRS.generateCode"
                );

        assert.equal(result.ok, false);
        assert.equal(
            result.errors[0].code,
            "CLRS_NO_ACTIVE_DOCUMENT"
        );
    });

    test("desactiva y libera la aplicación de forma idempotente", async () => {
        const entry =
            await import(
                "../../extension/extension.js"
            );

        entry.deactivate();
        entry.deactivate();

        assert.equal(
            application
                .lifecycle.disposed,
            true
        );
    });
});

async function waitForDiagnostics(
    uri,
    predicate
) {
    const deadline =
        Date.now() + 5000;

    while (Date.now() < deadline) {
        const diagnostics =
            vscode.languages
                .getDiagnostics(uri);

        if (predicate(diagnostics)) {
            return diagnostics;
        }

        await new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    50
                )
        );
    }

    assert.fail(
        "Los diagnósticos no alcanzaron el estado esperado."
    );
}
