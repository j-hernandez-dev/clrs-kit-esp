import path from "node:path";

import {
    BrokerGameError
} from "../../src/broker95/core/BrokerGameError.js";

/**
 * Frontera de lectura para BROKER.95. Lee una sola vez el documento activo
 * de CLRS y nunca expone esta identidad local directamente al Webview.
 */
export class VSCodeBrokerDocumentHost {

    constructor(vscodeApi, options = {}) {
        this.vscode = vscodeApi;
        this.languageId = options.languageId;
        this.lastActiveDocument = null;
        this.resources = [];

        this.#rememberEditor(
            this.vscode.window.activeTextEditor
        );

        const activeEditorSubscription =
            this.vscode.window
                .onDidChangeActiveTextEditor?.(
                    editor => this.#rememberEditor(
                        editor,
                        { clearForOtherEditor: true }
                    )
                );
        const closeSubscription =
            this.vscode.workspace
                ?.onDidCloseTextDocument?.(
                    document => {
                        if (
                            this.lastActiveDocument ===
                            document
                        ) {
                            this.lastActiveDocument = null;
                        }
                    }
                );

        for (const resource of [
            activeEditorSubscription,
            closeSubscription
        ]) {
            if (resource?.dispose) {
                this.resources.push(resource);
            }
        }
    }

    captureActiveDocument() {
        const document = this.#activeDocument();

        return document == null
            ? null
            : createDocumentSnapshot(document);
    }

    getActiveDocumentReference() {
        const document = this.#activeDocument();

        return document == null
            ? null
            : createDocumentReference(document);
    }

    async captureDocument(documentSelector) {
        const uri = resolveWorkspaceDocumentUri(
            this.vscode,
            documentSelector
        );
        let document;

        try {
            document = await this.vscode.workspace
                .openTextDocument(uri);
        } catch {
            throw BrokerGameError.invalidRule(
                "BROKER95_DOCUMENT_NOT_FOUND",
                "No fue posible abrir el documento CLRS indicado.",
                [{ selector: documentSelector }]
            );
        }

        if (document.languageId !== this.languageId) {
            throw BrokerGameError.invalidRule(
                "BROKER95_DOCUMENT_LANGUAGE_INVALID",
                "El archivo indicado debe usar el lenguaje CLRS.",
                [{ selector: documentSelector }]
            );
        }

        return createDocumentSnapshot(document);
    }

    recaptureDocument(documentId) {
        const document = this.vscode.workspace
            ?.textDocuments?.find(candidate =>
                candidate.uri?.toString?.() ===
                    documentId &&
                candidate.isClosed !== true
            ) ?? null;

        return document == null
            ? null
            : createDocumentSnapshot(document);
    }

    dispose() {
        for (const resource of this.resources) {
            resource.dispose();
        }

        this.resources = [];
        this.lastActiveDocument = null;
    }

    #rememberEditor(
        editor,
        options = {}
    ) {
        const document = editor?.document;

        if (
            document?.languageId ===
                this.languageId &&
            document.isClosed !== true
        ) {
            this.lastActiveDocument = document;
        } else if (
            editor != null &&
            options.clearForOtherEditor === true
        ) {
            this.lastActiveDocument = null;
        }
    }

    #activeDocument() {
        const activeDocument = this.vscode.window
            .activeTextEditor?.document;

        if (activeDocument != null) {
            if (
                activeDocument.languageId !==
                this.languageId
            ) {
                return null;
            }

            this.lastActiveDocument = activeDocument;
            return activeDocument;
        }

        const document = this.#lastAvailableDocument() ??
            this.#singleVisibleClrsDocument();

        return document?.languageId === this.languageId
            ? document
            : null;
    }

    #lastAvailableDocument() {
        const document = this.lastActiveDocument;

        if (
            document == null ||
            document.isClosed === true ||
            document.languageId !== this.languageId
        ) {
            this.lastActiveDocument = null;
            return null;
        }

        return document;
    }

    #singleVisibleClrsDocument() {
        const documents = [
            ...new Set(
                (this.vscode.window
                    .visibleTextEditors ?? [])
                    .map(editor => editor?.document)
                    .filter(document =>
                        document?.languageId ===
                            this.languageId &&
                        document.isClosed !== true
                    )
            )
        ];

        return documents.length === 1
            ? documents[0]
            : null;
    }
}

function createDocumentSnapshot(document) {
    const documentId = document.uri?.toString?.() ??
        String(document.uri ?? "");
    const uriPath = document.uri?.path ??
        document.uri?.fsPath ??
        document.fileName ??
        "";
    const name = path.basename(uriPath) ||
        "Documento CLRS";

    return Object.freeze({
        documentId,
        name,
        languageId: document.languageId,
        version: document.version,
        sourceCode: document.getText()
    });
}

function createDocumentReference(document) {
    const snapshot = createDocumentSnapshot(document);
    const filePath = document.uri?.fsPath ??
        document.fileName;

    if (
        typeof filePath !== "string" ||
        filePath.trim().length === 0
    ) {
        return null;
    }

    return Object.freeze({
        ...snapshot,
        filePath
    });
}

function resolveWorkspaceDocumentUri(
    vscode,
    documentSelector
) {
    const selector = normalizeSelector(
        documentSelector
    );
    const workspaceFolders = vscode.workspace
        .workspaceFolders ?? [];

    if (workspaceFolders.length === 0) {
        documentError(
            "BROKER95_DOCUMENT_WORKSPACE_REQUIRED",
            "Abre una carpeta de trabajo para seleccionar un archivo mediante una ruta relativa."
        );
    }

    const segments = selector.split("/");
    let workspaceFolder;

    if (workspaceFolders.length === 1) {
        [workspaceFolder] = workspaceFolders;

        if (
            segments[0] === workspaceFolder.name &&
            segments.length > 1
        ) {
            segments.shift();
        }
    } else {
        const folderName = segments.shift();
        const exact = workspaceFolders.filter(folder =>
            folder.name === folderName
        );
        const insensitive = workspaceFolders.filter(folder =>
            folder.name.toLocaleLowerCase() ===
                folderName.toLocaleLowerCase()
        );
        const candidates = exact.length > 0
            ? exact
            : insensitive;

        if (candidates.length !== 1) {
            documentError(
                candidates.length === 0
                    ? "BROKER95_DOCUMENT_WORKSPACE_FOLDER_UNKNOWN"
                    : "BROKER95_DOCUMENT_WORKSPACE_FOLDER_AMBIGUOUS",
                candidates.length === 0
                    ? "En un workspace con varias carpetas, la ruta debe comenzar con el nombre de una carpeta abierta."
                    : "El nombre inicial de la carpeta de trabajo es ambiguo."
            );
        }

        [workspaceFolder] = candidates;
    }

    if (segments.length === 0) {
        documentError(
            "BROKER95_DOCUMENT_PATH_INVALID",
            "La ruta relativa debe identificar un archivo .clrs."
        );
    }

    return vscode.Uri.joinPath(
        workspaceFolder.uri,
        ...segments
    );
}

function normalizeSelector(value) {
    if (
        typeof value !== "string" ||
        value.trim().length === 0 ||
        value.length > 2_048 ||
        value.includes("\u0000")
    ) {
        documentError(
            "BROKER95_DOCUMENT_PATH_INVALID",
            "La ruta relativa del documento no es válida."
        );
    }

    let selector = value.trim()
        .replace(/\\/gu, "/");

    while (selector.startsWith("./")) {
        selector = selector.slice(2);
    }

    if (
        path.win32.isAbsolute(selector) ||
        path.posix.isAbsolute(selector) ||
        /^[A-Za-z][A-Za-z0-9+.-]*:/u.test(selector)
    ) {
        documentError(
            "BROKER95_DOCUMENT_PATH_INVALID",
            "La ruta del documento debe ser relativa a una carpeta abierta."
        );
    }

    const segments = selector.split("/");

    if (
        segments.some(segment =>
            segment.length === 0 ||
            segment === "." ||
            segment === ".."
        ) ||
        !segments.at(-1)
            .toLocaleLowerCase()
            .endsWith(".clrs")
    ) {
        documentError(
            "BROKER95_DOCUMENT_PATH_INVALID",
            "La ruta relativa debe permanecer dentro del workspace y terminar en .clrs."
        );
    }

    return segments.join("/");
}

function documentError(code, publicMessage) {
    throw BrokerGameError.invalidRule(
        code,
        publicMessage,
        []
    );
}
