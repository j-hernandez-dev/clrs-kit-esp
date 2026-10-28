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
    extensionUri,
    vscodeApi,
    options = {}
) {
    const build = () =>
        buildWebviewHtml(
            webview,
            extensionUri,
            vscodeApi,
            options
        );
    const monitor =
        options.performanceMonitor;

    return typeof monitor?.measure ===
        "function"
        ? monitor.measure(
            `webview.html.${options.mode ?? "diagram"}`,
            build
        )
        : build();
}

function buildWebviewHtml(
    webview,
    extensionUri,
    vscodeApi,
    options
) {
    const vscode = vscodeApi;

    //--------------------------------------------------
    // Ruta del build
    //--------------------------------------------------

    const distPath = vscode.Uri.joinPath(
        extensionUri,
        "frontend",
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

    const csp =
        createWebviewContentSecurityPolicy(
            webview,
            options
        );

    html = html.replace(
        "</head>",
        `<meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="referrer" content="no-referrer"></head>`
    );

    if (options.mode != null) {
        const mode = escapeHtmlAttribute(
            String(options.mode)
        );

        html = html.replace(
            "</head>",
            `<meta name="clrs-webview-mode" content="${mode}"></head>`
        );
    }

    return html;
}

export function createWebviewContentSecurityPolicy(
    webview,
    options = {}
) {
    const source = String(
        webview?.cspSource ?? ""
    ).trim();

    if (source.length === 0) {
        throw new TypeError(
            "A Webview CSP source is required."
        );
    }

    const brokerMode =
        options.mode === "broker95";
    const imageSources = brokerMode
        ? source
        : `${source} data: blob:`;
    const connectionSources = brokerMode
        ? "'none'"
        : source;

    return [
        "default-src 'none'",
        "base-uri 'none'",
        "object-src 'none'",
        "frame-src 'none'",
        "child-src 'none'",
        "worker-src 'none'",
        "media-src 'none'",
        "manifest-src 'none'",
        "form-action 'none'",
        `img-src ${imageSources}`,
        `font-src ${source}`,
        `style-src ${source}`,
        `style-src-elem ${source}`,
        "style-src-attr 'unsafe-inline'",
        `script-src ${source}`,
        "script-src-attr 'none'",
        `connect-src ${connectionSources}`
    ].join("; ");
}

function escapeHtmlAttribute(value) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}
