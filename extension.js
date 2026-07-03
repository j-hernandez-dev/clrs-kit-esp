import * as vscode from 'vscode';
import { build } from "./src/interpreter/Runtime.js";
import { CLRSCodeLensProvider } from "./providers/codeLensProvider.js";
import path from 'path';
/**
 * @param {vscode.ExtensionContext} context
 */
export function activate(context) {

    console.log('CLRS Kit actived successfully');

    const runCode = vscode.commands.registerCommand('CLRS.runCode', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        await editor.document.save();
        const actualFilePath = editor.document.fileName;

        const interpreterPath = path.join(context.extensionPath, 'src', 'interpreter', 'VSCodeRun.js');

        let terminal = vscode.window.terminals.find(t => t.name === 'CLRS');
        if (!terminal) {
            terminal = vscode.window.createTerminal('CLRS');
        }

        vscode.window.showInformationMessage("Ejecutando código");

        terminal.show();

        terminal.sendText(`node "${interpreterPath}" "${actualFilePath}"`);
    });

    context.subscriptions.push(runCode);

    const buildCode = vscode.commands.registerCommand('CLRS.buildCode', () => {

        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const code = editor.document.getText();

        vscode.window.showInformationMessage("Construyendo código");

        const actualFilePath = editor.document.uri.fsPath;
        const cleanName = path.parse(actualFilePath).name;

        const workspaceFolders = vscode.workspace.workspaceFolders;
        const projecRootPath = workspaceFolders ? workspaceFolders[0].uri.fsPath : undefined;

        if (!projecRootPath) {
            vscode.window.showErrorMessage(
                "No hay un proyecto abierto"
            );
            return;
        }

        // @ts-ignore
        build(code, path.join(projecRootPath, cleanName) + ".js");

        const terminal = vscode.window.createOutputChannel("CLRS");

        // 2. Limpiamos la consola previa y la mostramos en pantalla
        terminal.clear();
        terminal.show(true);

        // 3. Escribimos los mensajes de texto puro que quieras
        terminal.appendLine(`El código se generó en: ${projecRootPath}\\build\\${cleanName}.js`);
    });

    context.subscriptions.push(buildCode);

    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider(
            { language: "clrs-es" },
            new CLRSCodeLensProvider()
        )
    );
}

export function deactivate() { }