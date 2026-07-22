import * as vscode from "vscode";
import fs from "fs";

/**
 * Carga el index.html generado por Vite
 * y adapta sus recursos para WebView.
 *
 * @param {vscode.Webview} webview
 * @param {vscode.Uri} extensionUri
 * @returns {string}
 */
export function loadWebviewHtml(
    webview,
    extensionUri
) {

    //--------------------------------------------------
    // Ruta del build
    //--------------------------------------------------

    const distPath = vscode.Uri.joinPath(
        extensionUri,
        "flow",
        "dist"
    );

    //--------------------------------------------------
    // Leer index.html
    //--------------------------------------------------

    const indexPath = vscode.Uri.joinPath(
        distPath,
        "index.html"
    );

    let html = fs.readFileSync(
        indexPath.fsPath,
        "utf8"
    );

    //--------------------------------------------------
    // Convertir rutas assets
    //--------------------------------------------------

    html = html.replace(

        /(src|href)="(\.?\/?assets\/[^"]+)"/g,

        (_, attr, assetPath) => {

            const file = assetPath.replace(/^\.?\//, "");

            const uri = webview.asWebviewUri(

                vscode.Uri.joinPath(

                    distPath,

                    file

                )

            );

            return `${attr}="${uri}"`;

        }

    );

    return html;
}