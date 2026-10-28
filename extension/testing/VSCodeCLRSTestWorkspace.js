import path from "node:path";

import {
    requireObject,
    requirePort
} from "../../src/application/ports/ApplicationPorts.js";
import {
    CLRS_TEST_DOCUMENT_SUFFIX
} from "../../src/testing/index.js";

const TEST_DEFINITION_GLOB =
    `**/*${CLRS_TEST_DOCUMENT_SUFFIX}`;
const CLRS_PROGRAM_GLOB = "**/*.clrs";
const DISCOVERY_EXCLUDE_GLOB =
    "**/{.git,.clrs,node_modules}/**";

export const CLRSTestWorkspaceEventKind =
    Object.freeze({
        DEFINITION_CREATED:
            "definition-created",
        DEFINITION_CHANGED:
            "definition-changed",
        DEFINITION_DELETED:
            "definition-deleted",
        PROGRAM_CREATED: "program-created",
        PROGRAM_DELETED: "program-deleted",
        WORKSPACE_CHANGED:
            "workspace-changed"
    });

/**
 * Frontera de archivos para el descubrimiento. Conserva URI de VS Code en
 * el Host y entrega rutas locales normalizadas al núcleo de pruebas.
 */
export class VSCodeCLRSTestWorkspace {

    constructor(vscodeApi) {
        this.vscode = requireObject(
            vscodeApi,
            "vscodeApi"
        );
        this.workspace = requirePort(
            this.vscode.workspace,
            "vscodeApi.workspace",
            [
                "findFiles",
                "createFileSystemWatcher"
            ]
        );
        this.fileSystem = requirePort(
            this.workspace.fs,
            "vscodeApi.workspace.fs",
            ["readFile", "stat"]
        );
        this.uriByPath = new Map();
    }

    async listDefinitionPaths() {
        const uris = await this.workspace.findFiles(
            TEST_DEFINITION_GLOB,
            DISCOVERY_EXCLUDE_GLOB
        );

        return Object.freeze(
            uris
                .filter(uri =>
                    !isIgnoredPath(uri.fsPath)
                )
                .map(uri => this.#remember(uri))
        );
    }

    async readText(sourcePath) {
        const uri = this.toUri(sourcePath);
        const openDocument = (
            this.workspace.textDocuments ?? []
        ).find(document =>
            sameUri(document.uri, uri)
        );

        if (
            openDocument != null &&
            typeof openDocument.getText ===
                "function"
        ) {
            return openDocument.getText();
        }

        const bytes = await this.fileSystem
            .readFile(uri);

        return new TextDecoder("utf-8")
            .decode(bytes);
    }

    async isFile(sourcePath) {
        try {
            const stat = await this.fileSystem.stat(
                this.toUri(sourcePath)
            );
            const fileType =
                this.vscode.FileType?.File ?? 1;

            return (
                stat.type & fileType
            ) === fileType;
        } catch (error) {
            if (isMissingFile(error)) {
                return false;
            }

            throw error;
        }
    }

    toUri(sourcePath) {
        const normalizedPath = path.normalize(
            sourcePath
        );
        const key = pathKey(normalizedPath);
        const cached = this.uriByPath.get(key);

        if (cached != null) {
            return cached;
        }

        for (
            const folder
            of this.workspace.workspaceFolders ?? []
        ) {
            const relativePath = path.relative(
                folder.uri.fsPath,
                normalizedPath
            );

            if (!isInside(relativePath)) {
                continue;
            }

            const uri = this.vscode.Uri.joinPath(
                folder.uri,
                ...relativePath.split(/[\\/]/u)
            );

            this.uriByPath.set(key, uri);
            return uri;
        }

        const uri = this.vscode.Uri.file(
            normalizedPath
        );

        this.uriByPath.set(key, uri);
        return uri;
    }

    getWorkspaceFolder(sourcePath) {
        return this.workspace
            .getWorkspaceFolder?.(
                this.toUri(sourcePath)
            ) ?? undefined;
    }

    getDocumentVersion(sourcePath) {
        const uri = this.toUri(sourcePath);
        const document = (
            this.workspace.textDocuments ?? []
        ).find(candidate =>
            sameUri(candidate.uri, uri)
        );

        return Number.isSafeInteger(
            document?.version
        )
            ? document.version
            : null;
    }

    describePath(sourcePath) {
        const normalizedPath = path.normalize(
            sourcePath
        );

        for (
            const folder
            of this.workspace.workspaceFolders ?? []
        ) {
            const relativePath = path.relative(
                folder.uri.fsPath,
                normalizedPath
            );

            if (isInside(relativePath)) {
                return (
                    this.workspace.workspaceFolders
                        .length > 1
                        ? `${folder.name}/${relativePath}`
                        : relativePath
                ).replace(/\\/gu, "/");
            }
        }

        return path.basename(normalizedPath);
    }

    subscribe(listener) {
        if (typeof listener !== "function") {
            throw new TypeError(
                "The CLRS test workspace listener must be a function."
            );
        }

        const definitionWatcher = this.workspace
            .createFileSystemWatcher(
                TEST_DEFINITION_GLOB
            );
        const programWatcher = this.workspace
            .createFileSystemWatcher(
                CLRS_PROGRAM_GLOB
            );
        const resources = [
            definitionWatcher,
            programWatcher,
            definitionWatcher.onDidCreate(uri => {
                this.#emitDefinition(
                    listener,
                    CLRSTestWorkspaceEventKind
                        .DEFINITION_CREATED,
                    uri
                );
            }),
            definitionWatcher.onDidChange(uri => {
                this.#emitDefinition(
                    listener,
                    CLRSTestWorkspaceEventKind
                        .DEFINITION_CHANGED,
                    uri
                );
            }),
            definitionWatcher.onDidDelete(uri => {
                this.#emitDefinition(
                    listener,
                    CLRSTestWorkspaceEventKind
                        .DEFINITION_DELETED,
                    uri
                );
            }),
            programWatcher.onDidCreate(uri => {
                emitProgramEvent(
                    listener,
                    CLRSTestWorkspaceEventKind
                        .PROGRAM_CREATED,
                    uri
                );
            }),
            programWatcher.onDidDelete(uri => {
                emitProgramEvent(
                    listener,
                    CLRSTestWorkspaceEventKind
                        .PROGRAM_DELETED,
                    uri
                );
            })
        ];
        const documentSubscription =
            this.workspace
                .onDidChangeTextDocument?.(
                    event => {
                        const uri = event?.document?.uri;

                        if (
                            uri != null &&
                            isDefinitionPath(
                                uri.fsPath
                            )
                        ) {
                            this.#emitDefinition(
                                listener,
                                CLRSTestWorkspaceEventKind
                                    .DEFINITION_CHANGED,
                                uri
                            );
                        }
                    }
                );
        const foldersSubscription =
            this.workspace
                .onDidChangeWorkspaceFolders?.(
                    () => {
                        this.uriByPath.clear();
                        listener(Object.freeze({
                            kind:
                                CLRSTestWorkspaceEventKind
                                    .WORKSPACE_CHANGED,
                            definitionPath: null
                        }));
                    }
                );

        for (const resource of [
            documentSubscription,
            foldersSubscription
        ]) {
            if (resource?.dispose) {
                resources.push(resource);
            }
        }

        return disposableGroup(resources);
    }

    #remember(uri) {
        const normalizedPath = path.normalize(
            uri.fsPath
        );

        this.uriByPath.set(
            pathKey(normalizedPath),
            uri
        );

        return normalizedPath;
    }

    #emitDefinition(listener, kind, uri) {
        if (isIgnoredPath(uri.fsPath)) {
            return;
        }

        const definitionPath = this.#remember(uri);

        if (
            kind ===
                CLRSTestWorkspaceEventKind
                    .DEFINITION_DELETED
        ) {
            this.uriByPath.delete(
                pathKey(definitionPath)
            );
        }

        listener(Object.freeze({
            kind,
            definitionPath
        }));
    }
}

function isDefinitionPath(sourcePath) {
    return typeof sourcePath === "string" &&
        sourcePath.toLocaleLowerCase("en-US")
            .endsWith(CLRS_TEST_DOCUMENT_SUFFIX);
}

function emitProgramEvent(listener, kind, uri) {
    if (isIgnoredPath(uri?.fsPath)) {
        return;
    }

    listener(Object.freeze({
        kind,
        definitionPath: null
    }));
}

function isIgnoredPath(sourcePath) {
    return /(?:^|[\\/])(?:\.git|\.clrs|node_modules)(?:[\\/]|$)/iu
        .test(sourcePath);
}

function isInside(relativePath) {
    return relativePath.length > 0 &&
        relativePath !== ".." &&
        !relativePath.startsWith(`..${path.sep}`) &&
        !path.isAbsolute(relativePath);
}

function sameUri(left, right) {
    const leftValue = left?.toString?.() ??
        left?.fsPath;
    const rightValue = right?.toString?.() ??
        right?.fsPath;

    return leftValue === rightValue ||
        (
            typeof left?.fsPath === "string" &&
            typeof right?.fsPath === "string" &&
            pathKey(left.fsPath) ===
                pathKey(right.fsPath)
        );
}

function pathKey(value) {
    const normalized = path.normalize(value);

    return path.sep === "\\"
        ? normalized.toLocaleLowerCase("en-US")
        : normalized;
}

function isMissingFile(error) {
    return error?.code === "ENOENT" ||
        error?.code === "FileNotFound" ||
        error?.name === "EntryNotFound (FileSystemError)";
}

function disposableGroup(resources) {
    let disposed = false;

    return Object.freeze({
        dispose() {
            if (disposed) {
                return;
            }

            disposed = true;

            for (const resource of resources.reverse()) {
                resource?.dispose?.();
            }
        }
    });
}
