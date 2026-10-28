import assert from "node:assert/strict";

import * as vscode from "vscode";

const extensionId =
    "j-hernandez-dev.clrs-kit-esp";
const expectedCommands = [
    "CLRS.runCode",
    "CLRS.stopCode",
    "CLRS.copyCostExpression",
    "CLRS.toggleCost",
    "CLRS.generateCodeDiagram",
    "CLRS.generateCode",
    "CLRS.toggleDiagram",
    "CLRS.exportSVG",
    "CLRS.showComplexityReport",
    "CLRS.playBroker95",
    "CLRS.debugCode",
    "CLRS.openWalkthrough",
    "CLRS.createFirstProgram",
    "CLRS.createFirstTestSuite",
    "CLRS.createExampleProject",
    "CLRS.createGuiProject",
    "CLRS.openContextualStart"
];

suite("CLRS Kit Extension Host", () => {
    let extension;
    let application;
    let sourceUri;
    let generatedUri;
    let generatedProjectUri;
    let hierarchyUri;
    let advancedDebugUri;
    let advancedBreakpointsUri;

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
        generatedProjectUri = vscode.Uri.joinPath(
            workspace.uri,
            "app",
            "programa"
        );
        generatedUri = vscode.Uri.joinPath(
            generatedProjectUri,
            "programa.js"
        );
        hierarchyUri = vscode.Uri.joinPath(
            workspace.uri,
            "jerarquia.clrs"
        );
        advancedDebugUri =
            vscode.Uri.joinPath(
                workspace.uri,
                "depuracion-avanzada.clrs"
            );
        advancedBreakpointsUri =
            vscode.Uri.joinPath(
                workspace.uri,
                "breakpoints-avanzados.clrs"
            );
    });

    suiteTeardown(async () => {
        try {
            await vscode.workspace.fs
                .delete(generatedProjectUri, {
                    recursive: true,
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

    test("abre una sola instancia global de BROKER.95", async () => {
        const first =
            await vscode.commands
                .executeCommand(
                    "CLRS.playBroker95"
                );
        const second =
            await vscode.commands
                .executeCommand(
                    "CLRS.playBroker95"
                );

        assert.equal(first.ok, true);
        assert.equal(first.value.reused, false);
        assert.equal(second.ok, true);
        assert.equal(second.value.reused, true);
        assert.equal(
            first.value.sessionId,
            second.value.sessionId
        );
    });

    test("crea las plantillas del inicio guiado como documentos sin guardar", async () => {
        const program =
            await vscode.commands
                .executeCommand(
                    "CLRS.createFirstProgram"
                );

        assert.equal(
            program.languageId,
            "clrs-es"
        );
        assert.equal(
            program.getText(),
            [
                "PRINCIPAL()",
                "    escribir \"¡Hola mundo!\"",
                ""
            ].join("\n")
        );

        await vscode.commands
            .executeCommand(
                "workbench.action.closeActiveEditor"
            );

        const suite =
            await vscode.commands
                .executeCommand(
                    "CLRS.createFirstTestSuite"
                );
        const suiteData = JSON.parse(
            suite.getText()
        );

        assert.equal(suite.languageId, "json");
        assert.equal(
            suiteData.program,
            "programa.clrs"
        );
        assert.deepEqual(
            suiteData.cases[0]
                .expectedOutput,
            ["¡Hola mundo!"]
        );
        assert.equal(
            suiteData.cases[0].comparison,
            "exact"
        );

        await vscode.commands
            .executeCommand(
                "workbench.action.closeActiveEditor"
            );
    });

    test("descubre suites declarativas en el Explorador de pruebas", async () => {
        const snapshot =
            await application.testing.ready;

        assert.equal(snapshot.issues.length, 0);
        assert.equal(snapshot.runnableSuites.length, 1);
        assert.equal(
            snapshot.runnableSuites[0].id,
            "suite:programa-extension"
        );
        assert.equal(
            snapshot.runnableSuites[0].cases.length,
            2
        );

        const roots = [];

        application.testing.controller
            .controller.items.forEach(item => {
                roots.push(item);
            });

        assert.equal(roots.length, 1);
        assert.equal(
            roots[0].label,
            "Pruebas del programa CLRS"
        );
        assert.equal(roots[0].children.size, 2);
        assert.equal(
            application.testing.runProfile.label,
            "Ejecutar"
        );
        assert.equal(
            application.testing.runProfile.kind,
            vscode.TestRunProfileKind.Run
        );
        assert.equal(
            application.testing.debugProfile.label,
            "Depurar"
        );
        assert.equal(
            application.testing.debugProfile.kind,
            vscode.TestRunProfileKind.Debug
        );
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
            /async function \$clrs\$0\$f\$5052494e434950414c/
        );
        assert.match(
            source,
            /function setRuntimeLocation_\d+/
        );
        assert.match(
            source,
            /Línea \$\{location\.startLine\}/
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
                        "    dato = 1",
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

    test("expone correcciones y explicaciones mediante acciones rápidas nativas", async () => {
        const editableDocument =
            await vscode.workspace
                .openTextDocument({
                    language:
                        "clrs-es",
                    content: [
                        "PRINCIPAL()",
                        "    edad = 18",
                        "    si edad = 18",
                        "        escribir edad"
                    ].join("\n")
                });

        await vscode.window
            .showTextDocument(
                editableDocument
            );
        await waitForDiagnostics(
            editableDocument.uri,
            items =>
                items.some(
                    diagnostic =>
                        diagnostic.code ===
                            "CLRS_PARSER_ERROR"
                )
        );

        const editActions =
            await vscode.commands
                .executeCommand(
                    "vscode.executeCodeActionProvider",
                    editableDocument.uri,
                    new vscode.Range(
                        2,
                        12,
                        2,
                        13
                    )
                );
        const equality = editActions.find(
            action =>
                action.title ===
                    "Cambiar «=» por «==» en esta condición"
        );

        assert.ok(equality);
        assert.equal(
            equality.isPreferred,
            true
        );
        assert.ok(equality.edit);
        assert.equal(
            await vscode.workspace
                .applyEdit(equality.edit),
            true
        );
        assert.equal(
            editableDocument.lineAt(2)
                .text,
            "    si edad == 18"
        );

        await vscode.commands
            .executeCommand(
                "workbench.action.closeActiveEditor"
            );

        const explanatoryDocument =
            await vscode.workspace
                .openTextDocument({
                    language:
                        "clrs-es",
                    content: [
                        "PRINCIPAL()",
                        "    escribir total"
                    ].join("\n")
                });

        await vscode.window
            .showTextDocument(
                explanatoryDocument
            );
        await waitForDiagnostics(
            explanatoryDocument.uri,
            items =>
                items.some(
                    diagnostic =>
                        diagnostic.code ===
                            "CLRS_UNDEFINED_IDENTIFIER"
                )
        );

        const explanationActions =
            await vscode.commands
                .executeCommand(
                    "vscode.executeCodeActionProvider",
                    explanatoryDocument.uri,
                    new vscode.Range(
                        1,
                        13,
                        1,
                        18
                    )
                );
        const explanation =
            explanationActions.find(
                action =>
                    action.title ===
                        "Explicar cómo inicializar «total»"
            );

        assert.ok(explanation);
        assert.equal(
            explanation.edit,
            undefined
        );
        assert.equal(
            explanation.isPreferred,
            false
        );
        assert.equal(
            explanation.command.command,
            "CLRS.explainCorrection"
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
                        "\tdato = (",
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

    test("expone CodeLens para el informe y alterna los costos locales", async () => {
        if (
            !application
                .viewState.showCost
        ) {
            await vscode.commands
                .executeCommand(
                    "CLRS.toggleCost"
                );
        }

        const document =
            await vscode.workspace
                .openTextDocument(
                    sourceUri
                );
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
                lens.command?.title ===
                    "Ver análisis de complejidad" &&
                lens.command?.command ===
                    "CLRS.showComplexityReport"
            );

        assert.ok(costLens);
        assert.equal(
            costLens.range.start.line,
            0
        );
        assert.equal(
            costLens.command
                .arguments[0]
                .functionId,
            "TPRINCIPAL"
        );
        const sharedSnapshot =
            application
                .documentAnalysisService
                .peek(
                    document.uri
                        .toString()
                );

        assert.ok(sharedSnapshot);
        assert.equal(
            sharedSnapshot.version,
            document.version
        );
        assert.equal(
            sharedSnapshot
                .hasCostAnalysis,
            true
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

        const hiddenLenses =
            await vscode.commands
                .executeCommand(
                    "vscode.executeCodeLensProvider",
                    sourceUri
                );

        assert.deepEqual(
            hiddenLenses,
            []
        );

        await vscode.commands
            .executeCommand(
                "CLRS.toggleCost"
            );

        const visibleLenses =
            await vscode.commands
                .executeCommand(
                    "vscode.executeCodeLensProvider",
                    sourceUri
                );

        assert.ok(
            visibleLenses.some(lens =>
                lens.command?.title ===
                    "Ver análisis de complejidad"
            )
        );
    });

    test("expone símbolos, definiciones y referencias del documento", async () => {
        await vscode.workspace
            .openTextDocument(sourceUri);

        const symbols =
            await vscode.commands
                .executeCommand(
                    "vscode.executeDocumentSymbolProvider",
                    sourceUri
                );
        const principal =
            symbols.find(
                symbol =>
                    symbol.name ===
                    "PRINCIPAL"
            );

        assert.ok(principal);
        assert.equal(
            principal.kind,
            vscode.SymbolKind.Function
        );
        assert.ok(
            principal.children.some(
                symbol =>
                    symbol.name ===
                        "dato" &&
                    symbol.kind ===
                        vscode.SymbolKind
                            .Variable
            )
        );

        const position =
            new vscode.Position(2, 13);
        const definitions =
            await vscode.commands
                .executeCommand(
                    "vscode.executeDefinitionProvider",
                    sourceUri,
                    position
                );

        assert.ok(
            Array.isArray(definitions)
        );
        assert.equal(
            definitions[0].range
                .start.line,
            1
        );
        assert.equal(
            definitions[0].range
                .start.character,
            4
        );

        const references =
            await vscode.commands
                .executeCommand(
                    "vscode.executeReferenceProvider",
                    sourceUri,
                    position
                );

        assert.ok(
            references.some(
                location =>
                    location.range.start
                        .line === 2 &&
                    location.range.start
                        .character === 13
            )
        );
    });

    test("expone la jerarquía nativa de llamadas", async () => {
        await vscode.workspace
            .openTextDocument(hierarchyUri);

        const prepared =
            await vscode.commands
                .executeCommand(
                    "_executePrepareCallHierarchy",
                    hierarchyUri,
                    new vscode.Position(0, 1)
                );
        const base = prepared.find(
            item => item.name === "BASE"
        );

        assert.ok(base);
        assert.equal(
            base.kind,
            vscode.SymbolKind.Function
        );

        const incoming =
            await vscode.commands
                .executeCommand(
                    "_executeProvideIncomingCalls",
                    base
                );

        assert.equal(incoming.length, 1);
        assert.equal(
            incoming[0].from.name,
            "DOBLE"
        );
        assert.deepEqual(
            incoming[0].fromRanges.map(
                range =>
                    range.start?.character ??
                    range.startColumn - 1
            ),
            [13, 23]
        );

        const outgoing =
            await vscode.commands
                .executeCommand(
                    "_executeProvideOutgoingCalls",
                    incoming[0].from
                );

        assert.equal(outgoing.length, 1);
        assert.equal(outgoing[0].to.name, "BASE");
        assert.equal(
            outgoing[0].fromRanges.length,
            2
        );
    });

    test("publica diagnósticos derivados del grafo de llamadas", async () => {
        const document =
            await vscode.workspace
                .openTextDocument({
                    language: "clrs-es",
                    content: [
                        "DIRECTA(n)",
                        "    retornar DIRECTA(n)",
                        "HUERFANA()",
                        "    retornar 0",
                        "PRINCIPAL()",
                        "    escribir 1"
                    ].join("\n")
                });

        await vscode.window
            .showTextDocument(document);

        const diagnostics =
            await waitForDiagnostics(
                document.uri,
                items => {
                    const codes = new Set(
                        items.map(
                            diagnostic =>
                                diagnostic.code
                        )
                    );

                    return (
                        codes.has(
                            "CLRS_UNUSED_FUNCTION"
                        ) &&
                        codes.has(
                            "CLRS_DIRECT_RECURSION"
                        )
                    );
                }
            );
        const unused = diagnostics.filter(
            diagnostic =>
                diagnostic.code ===
                    "CLRS_UNUSED_FUNCTION"
        );
        const recursion = diagnostics.find(
            diagnostic =>
                diagnostic.code ===
                    "CLRS_DIRECT_RECURSION"
        );

        assert.equal(unused.length, 2);
        assert.ok(
            unused.every(
                diagnostic =>
                    diagnostic.severity ===
                        vscode
                            .DiagnosticSeverity
                            .Hint
            )
        );
        assert.equal(
            recursion.severity,
            vscode.DiagnosticSeverity
                .Information
        );
        assert.equal(recursion.source, "CLRS");

        await vscode.commands
            .executeCommand(
                "workbench.action.closeActiveEditor"
            );
    });

    test("expone autocompletado, hover y ayuda de parámetros", async () => {
        await vscode.workspace
            .openTextDocument(sourceUri);

        const completionResult =
            await vscode.commands
                .executeCommand(
                    "vscode.executeCompletionItemProvider",
                    sourceUri,
                    new vscode.Position(
                        2,
                        13
                    )
                );
        const completions =
            completionResult.items ??
            completionResult;

        assert.ok(
            completions.some(
                item =>
                    item.label === "dato" &&
                    item.kind ===
                        vscode
                            .CompletionItemKind
                            .Variable
            )
        );
        assert.ok(
            completions.some(
                item =>
                    item.label === "LONG" &&
                    item.kind ===
                        vscode
                            .CompletionItemKind
                            .Function
            )
        );

        const hovers =
            await vscode.commands
                .executeCommand(
                    "vscode.executeHoverProvider",
                    sourceUri,
                    new vscode.Position(
                        2,
                        13
                    )
                );

        assert.ok(Array.isArray(hovers));
        assert.ok(hovers.length > 0);
        assert.ok(
            hovers.some(hover =>
                hover.contents.some(
                    content =>
                        typeof content ===
                            "object" &&
                        content.value
                            .includes(
                                "variable dato"
                            )
                )
            )
        );

        const sourceLines = [
            "SUMA(a, b)",
            "    retornar a + b",
            "PRINCIPAL()",
            "    resultado = SUMA(1, "
        ];
        const signatureDocument =
            await vscode.workspace
                .openTextDocument({
                    language: "clrs-es",
                    content:
                        sourceLines.join("\n")
                });
        const signature =
            await vscode.commands
                .executeCommand(
                    "vscode.executeSignatureHelpProvider",
                    signatureDocument.uri,
                    new vscode.Position(
                        3,
                        sourceLines[3].length
                    ),
                    ","
                );

        assert.ok(signature);
        assert.equal(
            signature.signatures[0]
                .label,
            "SUMA(a, b)"
        );
        assert.equal(
            signature.activeParameter,
            1
        );

        await vscode.commands
            .executeCommand(
                "workbench.action.closeActiveEditor"
            );
    });

    test("publica tokens semánticos para los bindings CLRS", async () => {
        await vscode.workspace
            .openTextDocument(sourceUri);

        const semanticTokens =
            await vscode.commands
                .executeCommand(
                    "vscode.provideDocumentSemanticTokens",
                    sourceUri
                );

        assert.ok(semanticTokens);
        assert.ok(
            semanticTokens.data.length > 0
        );

        const decoded =
            decodeSemanticTokens(
                semanticTokens.data
            );

        assert.ok(
            decoded.some(token =>
                token.line === 0 &&
                token.character === 0 &&
                token.length === 9 &&
                token.type === 0 &&
                token.modifiers === 1
            )
        );
        assert.ok(
            decoded.some(token =>
                token.line === 1 &&
                token.character === 4 &&
                token.length === 4 &&
                token.type === 1 &&
                token.modifiers === 1
            )
        );
        assert.ok(
            decoded.some(token =>
                token.line === 2 &&
                token.character === 13 &&
                token.length === 4 &&
                token.type === 1 &&
                token.modifiers === 0
            )
        );
    });

    test("genera un WorkspaceEdit para renombrado seguro", async () => {
        await vscode.workspace
            .openTextDocument(sourceUri);

        const workspaceEdit =
            await vscode.commands
                .executeCommand(
                    "vscode.executeDocumentRenameProvider",
                    sourceUri,
                    new vscode.Position(
                        2,
                        13
                    ),
                    "valor"
                );

        assert.ok(workspaceEdit);

        const entries =
            workspaceEdit.entries();

        assert.equal(entries.length, 1);
        assert.equal(
            entries[0][0].toString(),
            sourceUri.toString()
        );
        assert.deepEqual(
            entries[0][1].map(edit => [
                edit.range.start.line,
                edit.range.start.character,
                edit.newText
            ]),
            [
                [1, 4, "valor"],
                [2, 13, "valor"]
            ]
        );
    });

    test("expone el formateador documental nativo de CLRS", async () => {
        assert.ok(
            (
                await vscode.commands
                    .getCommands(true)
            ).includes(
                "CLRS.formatDocument"
            )
        );
        const document =
            await vscode.workspace
                .openTextDocument({
                    language: "clrs-es",
                    content: [
                        "PRINCIPAL( valor )",
                        "  si valor==1",
                        "      escribir \"uno\" // salida",
                        "  sino",
                        "      escribir valor"
                    ].join("\n")
                });
        const edits =
            await vscode.commands
                .executeCommand(
                    "vscode.executeFormatDocumentProvider",
                    document.uri,
                    {
                        tabSize: 4,
                        insertSpaces: true
                    }
                );

        assert.ok(edits.length > 0);
        const workspaceEdit = new vscode.WorkspaceEdit();
        workspaceEdit.set(document.uri, edits);
        assert.equal(
            await vscode.workspace.applyEdit(workspaceEdit),
            true
        );
        assert.equal(
            document.getText(),
            [
                "PRINCIPAL(valor)",
                "    si valor == 1",
                "        escribir \"uno\"  // salida",
                "    sino",
                "        escribir valor"
            ].join("\n")
        );
    });

    test("conserva recurrencias resueltas dentro del informe", async () => {
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
                lens.command?.title ===
                    "Ver análisis de complejidad" &&
                lens.command
                    ?.arguments?.[0]
                    ?.functionId ===
                    "TBINARIA"
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

    test("abre el informe de complejidad desde el comando del editor", async () => {
        const document =
            await vscode.workspace
                .openTextDocument(sourceUri);

        await vscode.window
            .showTextDocument(document);

        const opened =
            await vscode.commands
                .executeCommand(
                    "CLRS.showComplexityReport",
                    {
                        functionId:
                            "TPRINCIPAL"
                    }
                );

        assert.equal(opened.ok, true);
        assert.equal(
            application.controllers
                .complexityReport
                .document.version,
            document.version
        );
        assert.equal(
            application.controllers
                .complexityReport
                .selectedFunctionId,
            "TPRINCIPAL"
        );

        application.controllers
            .complexityReport
            .disposePanel();
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
        const navigated =
            await application.controllers
                .diagram
                .handlePanelMessage({
                    type: "navigate",
                    location: {
                        startLine: 2,
                        startColumn: 5,
                        endLine: 2,
                        endColumn: 13
                    },
                    nodeId: "N2"
                });
        const exported =
            await vscode.commands
                .executeCommand(
                    "CLRS.exportSVG"
                );

        assert.equal(opened.ok, true);
        assert.equal(
            navigated.value.navigated,
            true
        );
        assert.equal(exported.ok, true);
        assert.equal(
            vscode.window.activeTextEditor
                ?.document.uri.toString(),
            sourceUri.toString()
        );
        assert.deepEqual(
            [
                vscode.window
                    .activeTextEditor
                    .selection.active.line,
                vscode.window
                    .activeTextEditor
                    .selection.active
                    .character
            ],
            [1, 4]
        );

        await vscode.commands
            .executeCommand(
                "workbench.action.closeActiveEditor"
            );
    });

    test("controla un breakpoint y avanza desde VS Code", async () => {
        const document =
            await vscode.workspace
                .openTextDocument(sourceUri);

        await vscode.window
            .showTextDocument(document);

        const breakpoint =
            new vscode.SourceBreakpoint(
                new vscode.Location(
                    sourceUri,
                    new vscode.Position(1, 0)
                )
            );

        vscode.debug.addBreakpoints([
            breakpoint
        ]);

        const diagramPanelBefore =
            application.controllers
                .diagram.panel;
        const diagramTraceBefore =
            application.executionTraceService
                .getSnapshot()?.traceId ?? null;
        let session = null;
        const observer = observeDebugSession(
            candidate =>
                candidate.type === "clrs" &&
                candidate.configuration
                    .program === sourceUri.fsPath
        );

        try {
            const result =
                await vscode.commands
                    .executeCommand(
                        "CLRS.debugCode"
                    );
            session =
                await withTimeout(
                    observer.started,
                    5000,
                    "La sesión DAP CLRS no inició."
                );

            assert.equal(result.ok, true);
            assert.equal(session.type, "clrs");
            assert.equal(
                session.configuration.program,
                sourceUri.fsPath
            );
            assert.equal(
                application.controllers
                    .diagram.panel,
                diagramPanelBefore
            );

            const breakpointFrame =
                await waitForStackLine(
                    session,
                    2,
                    () => application
                        .debugExecutionTraceService
                        .getSnapshot()
                );

            assert.equal(
                breakpointFrame.source.path,
                sourceUri.fsPath
            );

            const beforeAssignment =
                await getScopeVariables(
                    session,
                    breakpointFrame,
                    "Variables locales"
                );

            assert.deepEqual(
                beforeAssignment.map(variable =>
                    [variable.name, variable.value]
                ),
                [["dato", "indefinido"]]
            );
            assert.equal(
                application
                    .debugExecutionTraceService
                    .getSnapshot()
                    .debug.status,
                "paused"
            );
            assert.equal(
                application
                    .debugExecutionTraceService
                    .getSnapshot()
                    .debug.location
                    .startLine,
                2
            );

            assert.equal(
                application.executionTraceService
                    .getSnapshot()?.traceId ?? null,
                diagramTraceBefore
            );

            await vscode.commands.executeCommand(
                "workbench.action.debug.stepOver"
            );

            const nextFrame =
                await waitForStackLine(
                    session,
                    3
                );

            assert.equal(nextFrame.line, 3);

            const afterAssignment =
                await getScopeVariables(
                    session,
                    nextFrame,
                    "Variables locales"
                );

            assert.deepEqual(
                afterAssignment.map(variable =>
                    [variable.name, variable.value]
                ),
                [["dato", "1"]]
            );

            await vscode.commands.executeCommand(
                "workbench.action.debug.continue"
            );

            const terminatedSession =
                await withTimeout(
                    observer.ended,
                    10000,
                    "La sesión DAP CLRS no finalizó con la ejecución."
                );

            assert.equal(
                terminatedSession.id,
                session.id
            );
        } finally {
            observer.dispose();
            vscode.debug.removeBreakpoints([
                breakpoint
            ]);

            if (
                session &&
                vscode.debug
                    .activeDebugSession?.id ===
                    session.id
            ) {
                await vscode.debug
                    .stopDebugging(session);
            }
        }
    });

    test("distingue Step Into, Step Over y Step Out entre funciones", async () => {
        const document =
            await vscode.workspace
                .openTextDocument(
                    advancedDebugUri
                );

        await vscode.window
            .showTextDocument(document);

        const breakpoint =
            new vscode.SourceBreakpoint(
                new vscode.Location(
                    advancedDebugUri,
                    new vscode.Position(5, 0)
                )
            );

        vscode.debug.addBreakpoints([
            breakpoint
        ]);

        let firstRun = null;
        let secondRun = null;

        try {
            firstRun =
                await launchCLRSSession(
                    advancedDebugUri,
                    document.version,
                    false
                );
            await waitForStackLine(
                firstRun.session,
                6
            );
            await vscode.commands
                .executeCommand(
                    "workbench.action.debug.stepOver"
                );

            const overFrame =
                await waitForStackLine(
                    firstRun.session,
                    7
                );

            assert.equal(
                overFrame.name,
                "PRINCIPAL"
            );

            await vscode.commands
                .executeCommand(
                    "workbench.action.debug.continue"
                );
            await withTimeout(
                firstRun.ended,
                10000,
                "Step Over no permitió finalizar la sesión."
            );
            firstRun.dispose();
            firstRun = null;

            secondRun =
                await launchCLRSSession(
                    advancedDebugUri,
                    document.version,
                    false
                );
            await waitForStackLine(
                secondRun.session,
                6
            );
            await vscode.commands
                .executeCommand(
                    "workbench.action.debug.stepInto"
                );

            const insideFrame =
                await waitForStackLine(
                    secondRun.session,
                    2
                );
            const insideStack =
                await secondRun.session
                    .customRequest(
                        "stackTrace",
                        {
                            threadId: 1,
                            startFrame: 0,
                            levels: 10
                        }
                    );

            assert.equal(
                insideFrame.name,
                "DOBLE"
            );
            assert.deepEqual(
                insideStack.stackFrames
                    .slice(0, 2)
                    .map(frame => frame.name),
                ["DOBLE", "PRINCIPAL"]
            );

            await vscode.commands
                .executeCommand(
                    "workbench.action.debug.stepOut"
                );

            const outFrame =
                await waitForStackLine(
                    secondRun.session,
                    7
                );

            assert.equal(
                outFrame.name,
                "PRINCIPAL"
            );

            await vscode.commands
                .executeCommand(
                    "workbench.action.debug.continue"
                );
            await withTimeout(
                secondRun.ended,
                10000,
                "Step Out no permitió finalizar la sesión."
            );
        } finally {
            firstRun?.dispose();
            secondRun?.dispose();
            vscode.debug.removeBreakpoints([
                breakpoint
            ]);

            if (
                vscode.debug
                    .activeDebugSession
                    ?.type === "clrs"
            ) {
                await vscode.debug
                    .stopDebugging(
                        vscode.debug
                            .activeDebugSession
                    );
            }
        }
    });

    test("integra condiciones, impactos y logpoints con VS Code", async () => {
        const document =
            await vscode.workspace
                .openTextDocument(
                    advancedBreakpointsUri
                );

        await vscode.window
            .showTextDocument(document);

        const conditional =
            new vscode.SourceBreakpoint(
                new vscode.Location(
                    advancedBreakpointsUri,
                    new vscode.Position(2, 0)
                ),
                true,
                "i >= 2",
                "2"
            );
        const logpoint =
            new vscode.SourceBreakpoint(
                new vscode.Location(
                    advancedBreakpointsUri,
                    new vscode.Position(3, 0)
                ),
                true,
                undefined,
                undefined,
                "Iteración {i}: {valor}"
            );
        const adapterMessages = [];
        const tracker =
            vscode.debug
                .registerDebugAdapterTrackerFactory(
                    "clrs",
                    {
                        createDebugAdapterTracker() {
                            return {
                                onDidSendMessage(message) {
                                    adapterMessages.push(
                                        message
                                    );
                                }
                            };
                        }
                    }
                );

        vscode.debug.addBreakpoints([
            conditional,
            logpoint
        ]);

        let run = null;

        try {
            run = await launchCLRSSession(
                advancedBreakpointsUri,
                document.version,
                false
            );

            const frame =
                await waitForStackLine(
                    run.session,
                    3
                );
            const variables =
                await getScopeVariables(
                    run.session,
                    frame,
                    "Variables locales"
                );

            assert.equal(
                variables.find(variable =>
                    variable.name === "i"
                ).value,
                "3"
            );

            await vscode.commands
                .executeCommand(
                    "workbench.action.debug.continue"
                );
            await withTimeout(
                run.ended,
                10000,
                "Los breakpoints avanzados no permitieron finalizar la sesión."
            );

            const logMessages =
                adapterMessages
                    .filter(message =>
                        message.type === "event" &&
                        message.event === "output" &&
                        message.body?.output
                            ?.startsWith(
                                "Iteración "
                            )
                    )
                    .map(message =>
                        message.body.output
                    );

            assert.deepEqual(
                logMessages,
                [
                    "Iteración 1: 10\n",
                    "Iteración 2: 20\n",
                    "Iteración 3: 30\n",
                    "Iteración 4: 40\n"
                ]
            );
        } finally {
            run?.dispose();
            tracker.dispose();
            vscode.debug.removeBreakpoints([
                conditional,
                logpoint
            ]);

            if (
                vscode.debug
                    .activeDebugSession
                    ?.type === "clrs"
            ) {
                await vscode.debug
                    .stopDebugging(
                        vscode.debug
                            .activeDebugSession
                    );
            }
        }
    });

    test("detener desde VS Code cancela solamente la sesión DAP", async () => {
        const document =
            await vscode.workspace
                .openTextDocument(sourceUri);

        await vscode.window
            .showTextDocument(document);

        const diagramTraceBefore =
            application.executionTraceService
                .getSnapshot()?.traceId ?? null;
        let session = null;
        const observer = observeDebugSession(
            candidate =>
                candidate.type === "clrs" &&
                candidate.configuration
                    .program === sourceUri.fsPath
        );

        try {
            await vscode.commands
                .executeCommand(
                    "CLRS.debugCode"
                );
            session = await withTimeout(
                observer.started,
                5000,
                "La sesión DAP CLRS no inició."
            );
            await waitForStackLine(
                session,
                2
            );

            const debugTraceId = application
                .debugExecutionTraceService
                .getSnapshot().traceId;
            const openedDiagram =
                await vscode.commands
                    .executeCommand(
                        "CLRS.toggleDiagram"
                    );

            assert.equal(
                openedDiagram.ok,
                true
            );
            application.controllers.diagram
                .disposePanel();
            assert.equal(
                application.controllers
                    .diagram.panel,
                null
            );
            assert.equal(
                application
                    .debugExecutionTraceService
                    .getSnapshot().traceId,
                debugTraceId
            );
            assert.equal(
                application
                    .debugExecutionTraceService
                    .getSnapshot().debug.status,
                "paused"
            );

            const reopenedDiagram =
                await vscode.commands
                    .executeCommand(
                        "CLRS.toggleDiagram"
                    );

            assert.equal(
                reopenedDiagram.ok,
                true
            );
            assert.equal(
                application
                    .debugExecutionTraceService
                    .getSnapshot().traceId,
                debugTraceId
            );

            await vscode.debug
                .stopDebugging(session);
            const terminatedSession =
                await withTimeout(
                    observer.ended,
                    10000,
                    "La sesión DAP CLRS no se detuvo."
                );
            const trace = application
                .debugExecutionTraceService
                .getSnapshot();

            assert.equal(
                terminatedSession.id,
                session.id
            );
            assert.equal(
                trace.status,
                "cancelled"
            );
            assert.equal(
                trace.debug.status,
                "ended"
            );
            assert.equal(
                application.executionTraceService
                    .getSnapshot()?.traceId ?? null,
                diagramTraceBefore
            );
        } finally {
            observer.dispose();

            if (
                session &&
                vscode.debug
                    .activeDebugSession?.id ===
                    session.id
            ) {
                await vscode.debug
                    .stopDebugging(session);
            }
        }
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
                "../../extension-dist/extension.js"
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

async function launchCLRSSession(
    uri,
    documentVersion,
    stopOnEntry
) {
    const runId =
        `clrs-extension-test-${nextDebugRunId++}`;
    const observer = observeDebugSession(
        candidate =>
            candidate.type === "clrs" &&
            candidate.configuration
                .__clrsTestRunId === runId
    );
    const launched =
        await vscode.debug
            .startDebugging(
                vscode.workspace
                    .getWorkspaceFolder(uri),
                {
                    type: "clrs",
                    request: "launch",
                    name:
                        "Prueba DAP avanzada",
                    program: uri.fsPath,
                    __clrsDocumentVersion:
                        documentVersion,
                    __clrsTestRunId: runId,
                    stopOnEntry
                }
            );

    if (!launched) {
        observer.dispose();
        assert.fail(
            "VS Code rechazó la sesión DAP CLRS."
        );
    }

    const session = await withTimeout(
        observer.started,
        5000,
        "La sesión DAP CLRS no inició."
    );

    return {
        session,
        ended: observer.ended,
        dispose() {
            observer.dispose();
        }
    };
}

let nextDebugRunId = 1;

function observeDebugSession(predicate) {
    let observedSession = null;
    let resolveStarted;
    let resolveEnded;
    const terminatedBeforeStart =
        new Map();
    const started = new Promise(resolve => {
        resolveStarted = resolve;
    });
    const ended = new Promise(resolve => {
        resolveEnded = resolve;
    });
    const startSubscription = vscode.debug
        .onDidStartDebugSession(candidate => {
            if (
                observedSession != null ||
                !predicate(candidate)
            ) {
                return;
            }

            observedSession = candidate;
            resolveStarted(candidate);

            const terminated =
                terminatedBeforeStart.get(
                    candidate.id
                );

            if (terminated) {
                resolveEnded(terminated);
            }
        });
    const endSubscription = vscode.debug
        .onDidTerminateDebugSession(
            candidate => {
                if (!predicate(candidate)) {
                    return;
                }

                if (
                    observedSession?.id ===
                    candidate.id
                ) {
                    resolveEnded(candidate);
                    return;
                }

                terminatedBeforeStart.set(
                    candidate.id,
                    candidate
                );
            }
        );

    return {
        started,
        ended,
        dispose() {
            startSubscription.dispose();
            endSubscription.dispose();
            terminatedBeforeStart.clear();
        }
    };
}

async function waitForStackLine(
    session,
    expectedLine,
    getDebugSnapshot = () => null
) {
    const deadline = Date.now() + 10000;
    let lastResult = null;
    let lastError = null;

    while (Date.now() < deadline) {
        try {
            const result =
                await session.customRequest(
                    "stackTrace",
                    {
                        threadId: 1,
                        startFrame: 0,
                        levels: 1
                    }
                );
            lastResult = result;
            const frame =
                result.stackFrames?.[0];

            if (frame?.line === expectedLine) {
                return frame;
            }
        } catch (error) {
            lastError = error;
            // La sesión todavía puede estar iniciando o reanudándose.
        }

        await new Promise(resolve =>
            setTimeout(resolve, 50)
        );
    }

    assert.fail(
        `La sesión DAP ${session.id} no se detuvo en la línea ${expectedLine}. ` +
        `Última pila: ${JSON.stringify(lastResult)}. ` +
        `Último error: ${String(lastError ?? "ninguno")}. ` +
        `Traza: ${JSON.stringify(getDebugSnapshot())}.`
    );
}

async function getScopeVariables(
    session,
    frame,
    scopeName
) {
    const scopeResult =
        await session.customRequest(
            "scopes",
            { frameId: frame.id }
        );
    const scope =
        scopeResult.scopes.find(item =>
            item.name === scopeName
        );

    assert.ok(
        scope,
        `No se encontró el ámbito ${scopeName}.`
    );

    const variableResult =
        await session.customRequest(
            "variables",
            {
                variablesReference:
                    scope.variablesReference
            }
        );

    return variableResult.variables;
}

function decodeSemanticTokens(data) {
    const tokens = [];
    let line = 0;
    let character = 0;

    for (
        let index = 0;
        index < data.length;
        index += 5
    ) {
        const deltaLine = data[index];
        const deltaCharacter =
            data[index + 1];

        line += deltaLine;
        character = deltaLine === 0
            ? character + deltaCharacter
            : deltaCharacter;
        tokens.push({
            line,
            character,
            length: data[index + 2],
            type: data[index + 3],
            modifiers: data[index + 4]
        });
    }

    return tokens;
}

async function withTimeout(
    promise,
    timeoutMs,
    message
) {
    let timeout;

    try {
        return await Promise.race([
            promise,
            new Promise((resolve, reject) => {
                timeout = setTimeout(
                    () => reject(
                        new Error(message)
                    ),
                    timeoutMs
                );
            })
        ]);
    } finally {
        clearTimeout(timeout);
    }
}
