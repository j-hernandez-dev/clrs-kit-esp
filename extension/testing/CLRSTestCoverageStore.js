import path from "node:path";

import {
    createCLRSTestCoverage
} from "../../src/testing/index.js";

/**
 * Conserva la cobertura acumulada más reciente por programa CLRS. Es un
 * estado efímero del Extension Host: la Testing API continúa siendo quien
 * produce la evidencia y las vistas sólo consumen una proyección inmutable.
 */
export class CLRSTestCoverageStore {

    constructor(options = {}) {
        this.path = options.path ?? path;
        this.snapshots = new Map();
        this.listeners = new Set();
        this.revision = 0;
        this.disposed = false;
    }

    publish({
        sourcePath,
        documentVersion = null,
        coverage
    }) {
        this.#ensureActive();

        const normalizedPath =
            normalizeSourcePath(
                sourcePath,
                this.path
            );
        const normalizedVersion =
            normalizeDocumentVersion(
                documentVersion
            );
        const normalizedCoverage =
            createCLRSTestCoverage(coverage);
        const snapshot = Object.freeze({
            revision: ++this.revision,
            sourcePath: normalizedPath,
            documentVersion:
                normalizedVersion,
            coverage: normalizedCoverage
        });

        this.snapshots.set(
            pathKey(normalizedPath, this.path),
            snapshot
        );

        for (const listener of this.listeners) {
            try {
                listener(snapshot);
            } catch {
                // Una vista no puede interrumpir la publicación compartida.
            }
        }

        return snapshot;
    }

    getSnapshot(sourcePath) {
        this.#ensureActive();

        if (
            typeof sourcePath !== "string" ||
            sourcePath.trim().length === 0
        ) {
            return null;
        }

        return this.snapshots.get(
            pathKey(sourcePath, this.path)
        ) ?? null;
    }

    subscribe(listener) {
        this.#ensureActive();

        if (typeof listener !== "function") {
            throw new TypeError(
                "The CLRS test coverage listener must be a function."
            );
        }

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
        this.snapshots.clear();
        this.listeners.clear();
    }

    #ensureActive() {
        if (this.disposed) {
            throw new Error(
                "The CLRS test coverage store is disposed."
            );
        }
    }
}

function normalizeSourcePath(value, pathApi) {
    if (
        typeof value !== "string" ||
        value.trim().length === 0
    ) {
        throw new TypeError(
            "The CLRS test coverage source path is invalid."
        );
    }

    return pathApi.normalize(value);
}

function normalizeDocumentVersion(value) {
    if (value == null) {
        return null;
    }

    if (
        !Number.isSafeInteger(value) ||
        value < 0
    ) {
        throw new TypeError(
            "The CLRS test coverage document version is invalid."
        );
    }

    return value;
}

function pathKey(value, pathApi) {
    const normalized = pathApi.normalize(value);

    return pathApi.sep === "\\"
        ? normalized.toLocaleLowerCase("en-US")
        : normalized;
}
