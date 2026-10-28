import path from "node:path";

import {
    CLRS_TEST_DOCUMENT_SUFFIX,
    clrsTestDocumentDecoder
} from "../declarative/index.js";
import {
    CLRSTestDiscoveryError
} from "./CLRSTestDiscoveryError.js";

export const CLRSTestDiscoveryStatus =
    Object.freeze({
        READY: "ready",
        INVALID_DEFINITION:
            "invalid-definition",
        PROGRAM_MISSING: "program-missing",
        READ_FAILED: "read-failed",
        PROGRAM_CHECK_FAILED:
            "program-check-failed"
    });

/**
 * Índice de pruebas independiente del editor. Serializa escaneos y eventos
 * para que una lectura antigua nunca sobrescriba un cambio más reciente.
 */
export class CLRSTestDiscoveryService {

    constructor(options = {}) {
        this.workspace = requirePort(
            options.workspace,
            "workspace",
            [
                "listDefinitionPaths",
                "readText",
                "isFile"
            ]
        );
        this.decoder = requirePort(
            options.decoder ??
                clrsTestDocumentDecoder,
            "decoder",
            ["parse"]
        );
        this.path = options.path ?? path;
        this.entries = new Map();
        this.listeners = new Set();
        this.revision = 0;
        this.snapshot = createSnapshot(
            this.revision,
            []
        );
        this.queue = Promise.resolve();
        this.disposed = false;
    }

    discover() {
        return this.#enqueue(async () => {
            let sourcePaths;

            try {
                sourcePaths = await this.workspace
                    .listDefinitionPaths();
            } catch (error) {
                throw CLRSTestDiscoveryError
                    .scanFailed(error);
            }

            const definitionPaths =
                normalizeDefinitionPaths(
                    sourcePaths,
                    this.path
                );
            const loadedEntries =
                await Promise.all(
                    definitionPaths.map(
                        definitionPath =>
                            this.#loadEntry(
                                definitionPath
                            )
                    )
                );

            this.entries.clear();

            for (const entry of loadedEntries) {
                this.entries.set(
                    pathKey(
                        entry.definitionPath,
                        this.path
                    ),
                    entry
                );
            }

            return this.#publish();
        });
    }

    refresh(definitionPath) {
        return this.#enqueue(async () => {
            const normalizedPath =
                normalizeDefinitionPath(
                    definitionPath,
                    this.path
                );
            const entry = await this.#loadEntry(
                normalizedPath
            );

            this.entries.set(
                pathKey(normalizedPath, this.path),
                entry
            );

            return this.#publish();
        });
    }

    remove(definitionPath) {
        return this.#enqueue(() => {
            const normalizedPath =
                normalizeDefinitionPath(
                    definitionPath,
                    this.path
                );
            const removed = this.entries.delete(
                pathKey(normalizedPath, this.path)
            );

            return removed
                ? this.#publish()
                : this.snapshot;
        });
    }

    getSnapshot() {
        return this.snapshot;
    }

    findByDefinitionPath(definitionPath) {
        this.#ensureActive();
        const normalizedPath =
            normalizeDefinitionPath(
                definitionPath,
                this.path
            );

        return this.entries.get(
            pathKey(normalizedPath, this.path)
        ) ?? null;
    }

    subscribe(listener) {
        if (typeof listener !== "function") {
            throw CLRSTestDiscoveryError
                .invalidPort("listener", []);
        }

        this.#ensureActive();
        this.listeners.add(listener);

        let active = true;

        return Object.freeze({
            dispose: () => {
                if (!active) {
                    return;
                }

                active = false;
                this.listeners.delete(listener);
            }
        });
    }

    dispose() {
        if (this.disposed) {
            return;
        }

        this.disposed = true;
        this.listeners.clear();
        this.entries.clear();
    }

    async #loadEntry(definitionPath) {
        let sourceText;

        try {
            sourceText = await this.workspace
                .readText(definitionPath);
        } catch (error) {
            return createEntry({
                definitionPath,
                status:
                    CLRSTestDiscoveryStatus
                        .READ_FAILED,
                issue: createIssue(
                    error,
                    "CLRS_TEST_DEFINITION_READ_FAILED",
                    "No fue posible leer el archivo de pruebas CLRS.",
                    definitionPath
                )
            });
        }

        let suite;

        try {
            suite = this.decoder.parse(
                sourceText,
                definitionPath
            );
        } catch (error) {
            return createEntry({
                definitionPath,
                status:
                    CLRSTestDiscoveryStatus
                        .INVALID_DEFINITION,
                issue: createIssue(
                    error,
                    "CLRS_TEST_DEFINITION_INVALID",
                    "El archivo de pruebas CLRS no es válido.",
                    definitionPath
                )
            });
        }

        let programExists;

        try {
            programExists = await this.workspace
                .isFile(suite.programPath);
        } catch (error) {
            return createEntry({
                definitionPath,
                suite,
                status:
                    CLRSTestDiscoveryStatus
                        .PROGRAM_CHECK_FAILED,
                issue: createIssue(
                    error,
                    "CLRS_TEST_PROGRAM_CHECK_FAILED",
                    "No fue posible comprobar el programa asociado.",
                    definitionPath,
                    suite.programPath
                )
            });
        }

        if (programExists !== true) {
            return createEntry({
                definitionPath,
                suite,
                status:
                    CLRSTestDiscoveryStatus
                        .PROGRAM_MISSING,
                issue: createIssue(
                    null,
                    "CLRS_TEST_PROGRAM_NOT_FOUND",
                    "No se encontró el programa CLRS asociado.",
                    definitionPath,
                    suite.programPath
                )
            });
        }

        return createEntry({
            definitionPath,
            suite,
            status:
                CLRSTestDiscoveryStatus.READY
        });
    }

    #publish() {
        this.#ensureActive();
        this.revision += 1;
        this.snapshot = createSnapshot(
            this.revision,
            [...this.entries.values()]
        );

        for (const listener of this.listeners) {
            try {
                listener(this.snapshot);
            } catch {
                // Un consumidor no puede interrumpir el índice compartido.
            }
        }

        return this.snapshot;
    }

    #enqueue(operation) {
        const result = this.queue.then(async () => {
            this.#ensureActive();
            return await operation();
        });

        this.queue = result.catch(() => {});

        return result;
    }

    #ensureActive() {
        if (this.disposed) {
            throw CLRSTestDiscoveryError
                .disposed();
        }
    }
}

function createEntry({
    definitionPath,
    status,
    suite = null,
    issue = null
}) {
    return Object.freeze({
        definitionPath,
        status,
        suite,
        issue
    });
}

function createIssue(
    error,
    fallbackCode,
    fallbackMessage,
    definitionPath,
    programPath = null
) {
    return Object.freeze({
        code:
            typeof error?.code === "string"
                ? error.code
                : fallbackCode,
        message:
            typeof error?.publicMessage === "string"
                ? error.publicMessage
                : fallbackMessage,
        definitionPath,
        programPath,
        field:
            typeof error?.field === "string"
                ? error.field
                : null
    });
}

function createSnapshot(revision, entries) {
    const sortedEntries = Object.freeze(
        [...entries].sort((left, right) =>
            left.definitionPath.localeCompare(
                right.definitionPath,
                "en-US"
            )
        )
    );
    const suites = Object.freeze(
        sortedEntries
            .filter(entry => entry.suite != null)
            .map(entry => entry.suite)
    );
    const runnableSuites = Object.freeze(
        sortedEntries
            .filter(entry =>
                entry.status ===
                    CLRSTestDiscoveryStatus.READY
            )
            .map(entry => entry.suite)
    );
    const issues = Object.freeze(
        sortedEntries
            .filter(entry => entry.issue != null)
            .map(entry => entry.issue)
    );

    return Object.freeze({
        revision,
        entries: sortedEntries,
        suites,
        runnableSuites,
        issues
    });
}

function normalizeDefinitionPaths(value, pathService) {
    if (!Array.isArray(value)) {
        throw CLRSTestDiscoveryError
            .invalidPort(
                "workspace.listDefinitionPaths",
                ["return an array"]
            );
    }

    const byKey = new Map();

    for (const sourcePath of value) {
        const normalizedPath =
            normalizeDefinitionPath(
                sourcePath,
                pathService
            );

        byKey.set(
            pathKey(normalizedPath, pathService),
            normalizedPath
        );
    }

    return [...byKey.values()].sort(
        (left, right) =>
            left.localeCompare(right, "en-US")
    );
}

function normalizeDefinitionPath(value, pathService) {
    if (
        typeof value !== "string" ||
        value.trim().length === 0 ||
        value.includes("\u0000") ||
        !pathService.isAbsolute(value) ||
        !value.toLocaleLowerCase("en-US")
            .endsWith(CLRS_TEST_DOCUMENT_SUFFIX)
    ) {
        throw CLRSTestDiscoveryError
            .invalidPath(value);
    }

    return pathService.normalize(value);
}

function pathKey(value, pathService) {
    const normalized = pathService.normalize(value);

    return pathService.sep === "\\"
        ? normalized.toLocaleLowerCase("en-US")
        : normalized;
}

function requirePort(value, name, methods) {
    if (
        value == null ||
        methods.some(method =>
            typeof value[method] !== "function"
        )
    ) {
        throw CLRSTestDiscoveryError
            .invalidPort(name, methods);
    }

    return value;
}
