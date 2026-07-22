import * as vscode from 'vscode';
import path from 'path';
import { ViewState } from "../providers/ViewState.js";
import { CLRSCodeLensProvider } from "../providers/CodeLensProvider.js";
import { CLRSCostDecorator } from '../providers/DecoratorProvider.js';
import { generate } from "../../src/compiler/Pipeline.js";

/**
 * @param {vscode.ExtensionContext} context
 */
export function registerCodeCommands(context) {

    // EJECUTAR CÓDIGO
    const runCode = vscode.commands.registerCommand('CLRS.runCode', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage(
                "No hay un proyecto abierto.",
                3000
            );
            return;
        }

        await editor.document.save();

        const actualFilePath = editor.document.fileName;
        const interpreterPath = path.join(context.extensionPath, 'src', 'compiler', 'CliEntry.js');

        let terminal = vscode.window.terminals.find(t => t.name === 'CLRS');
        if (!terminal) {
            terminal = vscode.window.createTerminal('CLRS');
        }

        terminal.show();

        let command = process.platform === "win32"
            ? `cls`
            : `clear`;

        terminal.sendText(command);

        command = `node "${interpreterPath}" "${actualFilePath}"`;

        terminal.sendText(command);

        vscode.window.showInformationMessage("Ejecutando código.", 3000);
    });

    context.subscriptions.push(runCode);

    // CODE LENS
    const codeLensProvider = new CLRSCodeLensProvider();

    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider(
            { language: "clrs-es" },
            codeLensProvider
        )
    );

    // DECORATOR
    const costDecorator = new CLRSCostDecorator();

    function updateDecorations() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        if (editor.document.languageId !== "clrs-es") return;

        costDecorator.update(editor);
    }

    // ACTUALIZAR CUANDO
    vscode.window.onDidChangeActiveTextEditor(updateDecorations, null, context.subscriptions);

    vscode.workspace.onDidChangeTextDocument(updateDecorations, null, context.subscriptions);

    vscode.window.onDidChangeVisibleTextEditors(editors => {
        for (const editor of editors) {
            if (editor.document.languageId === "clrs-es") {
                costDecorator.update(editor);
            }
        }
    });

    // ACTUALIZACIÓN INICIAL
    updateDecorations();

    // COPIAR EXPRESION
    const copyCost = vscode.commands.registerCommand(
        "CLRS.copyCostExpression",
        async (text) => {

            await vscode.env.clipboard.writeText(text);

            vscode.window.showInformationMessage(
                "Expresión copiada al portapapeles",
                3000
            );
        }
    );

    context.subscriptions.push(copyCost);

    // BOTON MOSTRAR ANALISIS
    const toggleCost = vscode.commands.registerCommand(
        "CLRS.toggleCost",
        async () => {

            ViewState.showCost = !ViewState.showCost;

            vscode.window.showInformationMessage(
                ViewState.showCost
                    ? "Mostrando costo algorítmico."
                    : "Ocultando costo algorítmico.",
                3000
            );

            codeLensProvider.refresh();

            updateDecorations();
        }

    );

    // GENERAR DIAGRAMA DESDE CÓDIGO
    const generateCodeDiagram = vscode.commands.registerCommand('CLRS.generateCodeDiagram', async () => { });

    context.subscriptions.push(generateCodeDiagram);

    // GENERAR ARCHIVO JS
    const generateCode = vscode.commands.registerCommand('CLRS.generateCode', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage(
                "No hay un proyecto abierto.",
                3000
            );
            return;
        }

        const code = editor.document.getText();

        vscode.window.showInformationMessage("Generando código.");

        // Nombre base del archivo actual
        const actualFilePath = editor.document.uri.fsPath;
        const fileName = path.basename(actualFilePath);

        // Carpeta raíz del proyecto actual
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const projecRootPath = workspaceFolders ? workspaceFolders[0].uri.fsPath : undefined;

        if (!projecRootPath) {
            vscode.window.showErrorMessage(
                "No hay un proyecto abierto.",
                3000
            );
            return;
        }

        // Generar en carpeta raíz, pasando el archivo .clrs
        await generate(code, path.join(projecRootPath, fileName));

        // 1. Crear consola nueva
        const terminal = vscode.window.createOutputChannel("CLRS");

        // 2. Limpiar consola previa y mostrar en pantalla
        terminal.clear();
        terminal.show(true);

        // Ruta que se generará con la extensión .js
        const cleanName = path.parse(actualFilePath).name;
        const pathGenerate = path.join(projecRootPath, '.clrs', 'js', cleanName + ".js");

        // 3. Escribir mensaje
        terminal.appendLine(`El código se generó en: ${pathGenerate}`);
    });

    context.subscriptions.push(generateCode);
}