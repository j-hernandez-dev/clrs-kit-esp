import * as vscode from "vscode";
import path from "path";
import { loadWebviewHtml } from "./webview/WebViewContent.js";

export function registerDiagramCommands(context) {
    let panel = null;

    const toggleDiagram = vscode.commands.registerCommand(

        "CLRS.toggleDiagram",

        async () => {

            //--------------------------------------------------
            // Editor activo
            //--------------------------------------------------

            const editor =
                vscode.window.activeTextEditor;

            if (!editor) {

                vscode.window.showErrorMessage(
                    "No hay un proyecto abierto."
                );

                return;

            }

            //--------------------------------------------------
            // Panel
            //--------------------------------------------------

            const fileName =
                path.basename(editor.document.uri.fsPath);

            panel =
                vscode.window.createWebviewPanel(

                    "clrsDiagram",

                    `Diagrama de flujo - ${fileName}`,

                    vscode.ViewColumn.Beside,

                    {
                        enableScripts: true,

                        localResourceRoots: [

                            vscode.Uri.joinPath(

                                context.extensionUri,

                                "flow",

                                "dist"

                            )

                        ]

                    }

                );

            panel.webview.html =
                loadWebviewHtml(

                    panel.webview,

                    context.extensionUri

                );

            //--------------------------------------------------
            // Escuchar mensajes del WebView
            //--------------------------------------------------

            panel.webview.onDidReceiveMessage(

                async message => {

                    try {

                        switch (message.type) {

                            case "png": {

                                const uri =
                                    await vscode.window.showSaveDialog({

                                        saveLabel: "Guardar diagrama",

                                        filters: {

                                            PNG: ["png"]

                                        }

                                    });

                                if (!uri) {
                                    return;
                                }

                                const base64 =
                                    message.png.replace(
                                        /^data:image\/png;base64,/,
                                        ""
                                    );

                                await vscode.workspace.fs.writeFile(

                                    uri,

                                    Buffer.from(base64, "base64")

                                );

                                vscode.window.showInformationMessage(
                                    "Diagrama exportado correctamente."
                                );

                                break;
                            }

                        }

                    }
                    catch (error) {

                        vscode.window.showErrorMessage(
                            `Error al exportar: ${error.message}`
                        );

                    }

                }

            );

            //--------------------------------------------------
            // Enviar contenido inicial
            //--------------------------------------------------

            setTimeout(() => {

                panel.webview.postMessage({

                    type: "source",

                    source: getCurrentSource(editor)

                });

            }, 500);

            //--------------------------------------------------
            // Escuchar cambios del documento
            //--------------------------------------------------

            const documentListener =
                vscode.workspace.onDidChangeTextDocument(event => {

                    if (
                        event.document.uri.toString() !==
                        editor.document.uri.toString()
                    ) {
                        return;
                    }

                    panel.webview.postMessage({

                        type: "source",

                        source:
                            getCurrentSource(editor)

                    });

                });

            //--------------------------------------------------
            // Escuchar cambios de selección
            //--------------------------------------------------

            const selectionListener =
                vscode.window.onDidChangeTextEditorSelection(event => {

                    //--------------------------------------------------
                    // Ignorar otros editores
                    //--------------------------------------------------

                    if (event.textEditor !== editor) {
                        return;
                    }

                    //--------------------------------------------------
                    // Enviar selección o documento completo
                    //--------------------------------------------------

                    panel.webview.postMessage({

                        type: "source",

                        source:
                            getCurrentSource(editor)

                    });

                });

            //--------------------------------------------------
            // Liberar recursos al cerrar
            //--------------------------------------------------

            //--------------------------------------------------
            // Liberar recursos al cerrar
            //--------------------------------------------------

            panel.onDidDispose(() => {

                documentListener.dispose();

                selectionListener.dispose();

                panel = null;

            });

        }

    );

    context.subscriptions.push(toggleDiagram);

    const exportPNG = vscode.commands.registerCommand(
        "CLRS.exportPNG",
        async () => {

            if (!panel) {

                vscode.window.showErrorMessage(
                    "No hay ningún diagrama abierto."
                );

                return;

            }

            panel.webview.postMessage({

                type: "export-png"

            });

        }
    );

    context.subscriptions.push(exportPNG);
}

//--------------------------------------------------
// Obtiene el texto actual.
//
// Si existe una selección,
// devuelve únicamente la selección.
//
// En caso contrario,
// devuelve el documento completo.
//--------------------------------------------------

function getCurrentSource(editor) {

    const selection =
        editor.selection;

    if (!selection.isEmpty) {

        return editor.document.getText(selection);

    }

    return editor.document.getText();

}