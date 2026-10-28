import path from "node:path";

import {
    requireObject,
    requirePort
} from "../../src/application/ports/ApplicationPorts.js";
import {
    CLRSTestWorkspaceEventKind
} from "./VSCodeCLRSTestWorkspace.js";

export const CLRS_TEST_CONTROLLER_ID =
    "clrs-tests";
export const CLRS_TEST_CONTROLLER_LABEL =
    "Pruebas CLRS";

/**
 * Proyecta el índice neutral en TestItem nativos. Este bloque descubre y
 * reconcilia el árbol; los perfiles de ejecución se añaden posteriormente.
 */
export class CLRSTestDiscoveryController {

    constructor(options = {}) {
        this.vscode = requireObject(
            options.vscodeApi,
            "vscodeApi"
        );
        this.discovery = requirePort(
            options.discovery,
            "testDiscovery",
            [
                "discover",
                "refresh",
                "remove",
                "getSnapshot",
                "subscribe"
            ]
        );
        this.workspace = requirePort(
            options.workspace,
            "testWorkspace",
            ["subscribe", "toUri", "describePath"]
        );
        this.developerLogger =
            options.developerLogger ?? console;
        this.changeDebounceMs =
            options.changeDebounceMs ?? 150;
        this.controllerId =
            options.controllerId ??
            CLRS_TEST_CONTROLLER_ID;
        this.controllerLabel =
            options.controllerLabel ??
            CLRS_TEST_CONTROLLER_LABEL;
        this.controller = null;
        this.activationListeners = new Set();
        this.metadata = new Map();
        this.externalSnapshots = new Map();
        this.externalSources = new Map();
        this.discoverySnapshot =
            this.discovery.getSnapshot();
        this.changeTimers = new Map();
        this.resources = [];
        this.ready = null;
        this.started = false;
        this.disposed = false;

    }

    start() {
        if (this.disposed) {
            throw new Error(
                "The CLRS test controller is disposed."
            );
        }

        if (this.started) {
            return this.ready;
        }

        this.started = true;
        this.resources.push(
            this.discovery.subscribe(
                snapshot => this.render(snapshot)
            ),
            this.workspace.subscribe(
                event => {
                    void this.#handleWorkspaceEvent(
                        event
                    ).catch(error => {
                        this.#report(error);
                    });
                }
            )
        );
        this.ready = this.discovery
            .discover()
            .catch(error => {
                this.#renderFatal(error);
                throw error;
            });

        return this.ready;
    }

    async refresh() {
        if (this.disposed) {
            return this.discovery.getSnapshot();
        }

        try {
            return await this.discovery.discover();
        } catch (error) {
            this.#renderFatal(error);
            throw error;
        }
    }

    render(snapshot) {
        if (this.disposed) {
            return;
        }

        this.discoverySnapshot = snapshot;
        this.#renderAll();
    }

    attachExternalSource(source) {
        const normalized = requirePort(
            source,
            "externalTestSource",
            ["start", "getSnapshot", "subscribe"]
        );
        const sourceId = String(normalized.id ?? "").trim();

        if (sourceId.length === 0) {
            throw new TypeError(
                "The external test source identifier is invalid."
            );
        }

        if (this.externalSources.has(sourceId)) {
            return Promise.resolve(
                this.externalSnapshots.get(sourceId)
            );
        }

        this.externalSources.set(sourceId, normalized);
        this.externalSnapshots.set(
            sourceId,
            normalized.getSnapshot()
        );
        const subscription = normalized.subscribe(
            snapshot => {
                this.externalSnapshots.set(
                    sourceId,
                    snapshot
                );
                this.#renderAll();
            }
        );

        this.resources.push(subscription);
        this.#renderAll();

        return Promise.resolve(normalized.start())
            .then(snapshot => {
                this.externalSnapshots.set(
                    sourceId,
                    snapshot
                );
                this.#renderAll();
                return snapshot;
            });
    }

    #renderAll() {
        if (this.disposed) {
            return;
        }

        if (!this.#hasTests()) {
            this.metadata.clear();
            this.controller?.items.replace([]);
            return;
        }

        const controller =
            this.#ensureController();

        const nextMetadata = new Map();
        const rootItems = this.discoverySnapshot
            .entries.map(
            entry => this.#entryItem(
                entry,
                nextMetadata
            )
        );

        for (const snapshot of this.externalSnapshots.values()) {
            for (const root of snapshot?.roots ?? []) {
                rootItems.push(
                    this.#externalRootItem(
                        snapshot.sourceId,
                        root,
                        nextMetadata
                    )
                );
            }
        }

        this.metadata = nextMetadata;
        controller.items.replace(rootItems);
    }

    onDidActivate(listener) {
        if (typeof listener !== "function") {
            throw new TypeError(
                "The CLRS test activation listener must be a function."
            );
        }

        if (this.disposed) {
            return Object.freeze({
                dispose() {}
            });
        }

        this.activationListeners.add(listener);

        if (this.controller != null) {
            listener(this.controller);
        }

        return Object.freeze({
            dispose: () => {
                this.activationListeners.delete(
                    listener
                );
            }
        });
    }

    get isActive() {
        return this.controller != null;
    }

    getMetadata(testItemOrId) {
        const id = typeof testItemOrId === "string"
            ? testItemOrId
            : testItemOrId?.id;

        return this.metadata.get(id) ?? null;
    }

    getSnapshot() {
        return this.discovery.getSnapshot();
    }

    dispose() {
        if (this.disposed) {
            return;
        }

        this.disposed = true;

        for (const timer of this.changeTimers.values()) {
            clearTimeout(timer);
        }

        this.changeTimers.clear();

        for (const resource of this.resources.reverse()) {
            resource.dispose();
        }

        this.resources = [];
        this.metadata.clear();
        this.externalSnapshots.clear();
        this.externalSources.clear();
        this.activationListeners.clear();
        this.controller?.dispose();
        this.controller = null;
    }

    #hasTests() {
        if (
            this.discoverySnapshot
                .entries.length > 0
        ) {
            return true;
        }

        for (
            const snapshot
            of this.externalSnapshots.values()
        ) {
            if ((snapshot?.roots?.length ?? 0) > 0) {
                return true;
            }
        }

        return false;
    }

    #ensureController() {
        if (this.controller != null) {
            return this.controller;
        }

        const controller = this.vscode.tests
            .createTestController(
                this.controllerId,
                this.controllerLabel
            );

        controller.resolveHandler =
            async item => {
                if (item == null) {
                    await this.refresh();
                }
            };
        controller.refreshHandler =
            async () => {
                await this.refresh();
            };
        this.controller = controller;

        for (
            const listener
            of this.activationListeners
        ) {
            listener(controller);
        }

        return controller;
    }

    #entryItem(entry, nextMetadata) {
        const id = suiteItemId(
            entry.definitionPath
        );
        const existing = this.controller.items
            .get(id);
        const label = entry.suite?.name ??
            definitionLabel(entry.definitionPath);
        const item = existing ??
            this.controller.createTestItem(
                id,
                label,
                this.workspace.toUri(
                    entry.definitionPath
                )
            );

        item.label = label;
        item.description = this.workspace
            .describePath(entry.definitionPath);
        item.error = entry.issue?.message;
        item.canResolveChildren = false;
        item.busy = false;
        nextMetadata.set(
            id,
            Object.freeze({
                kind: "suite",
                sourceId: "declarative",
                sourceKey:
                    entry.definitionPath,
                definitionPath:
                    entry.definitionPath,
                suiteId: entry.suite?.id ?? null,
                caseId: null,
                runnable:
                    entry.status === "ready"
            })
        );

        const children = entry.suite == null
            ? []
            : entry.suite.cases.map(
                testCase => this.#caseItem(
                    item,
                    entry,
                    testCase,
                    nextMetadata
                )
            );

        item.children.replace(children);

        return item;
    }

    #caseItem(
        parent,
        entry,
        testCase,
        nextMetadata
    ) {
        const id = caseItemId(
            entry.definitionPath,
            testCase.id
        );
        const existing = parent.children.get(id);
        const item = existing ??
            this.controller.createTestItem(
                id,
                testCase.name,
                this.workspace.toUri(
                    entry.definitionPath
                )
            );

        item.label = testCase.name;
        item.description = testCase.id;
        item.error = entry.issue?.message;
        item.canResolveChildren = false;
        item.busy = false;
        nextMetadata.set(
            id,
            Object.freeze({
                kind: "case",
                sourceId: "declarative",
                sourceKey:
                    entry.definitionPath,
                definitionPath:
                    entry.definitionPath,
                suiteId: entry.suite.id,
                caseId: testCase.id,
                runnable:
                    entry.status === "ready"
            })
        );

        return item;
    }

    #externalRootItem(
        sourceId,
        root,
        nextMetadata
    ) {
        const id = `clrs-external:${encodeURIComponent(
            sourceId
        )}:${encodeURIComponent(root.id)}`;
        const existing = this.controller.items.get(id);
        const item = existing ??
            this.controller.createTestItem(
                id,
                root.label
            );

        item.label = root.label;
        item.description = root.description;
        item.error = root.error ?? undefined;
        item.canResolveChildren = false;
        item.busy = false;
        nextMetadata.set(id, Object.freeze({
            kind: "suite",
            sourceId,
            sourceKey: root.sourceKey,
            definitionPath: null,
            suiteId: root.id,
            caseId: null,
            runnable: root.runnable === true
        }));

        const children = (root.cases ?? []).map(
            sourceCase => {
                const caseId = `${id}:case:${encodeURIComponent(
                    sourceCase.id
                )}`;
                const existingCase = item.children
                    .get(caseId);
                const caseItem = existingCase ??
                    this.controller.createTestItem(
                        caseId,
                        sourceCase.label
                    );

                caseItem.label = sourceCase.label;
                caseItem.description =
                    sourceCase.description;
                caseItem.error =
                    sourceCase.error ?? undefined;
                caseItem.canResolveChildren = false;
                caseItem.busy = false;
                nextMetadata.set(
                    caseId,
                    Object.freeze({
                        kind: "case",
                        sourceId,
                        sourceKey: root.sourceKey,
                        definitionPath: null,
                        suiteId: root.id,
                        caseId: sourceCase.id,
                        runnable:
                            root.runnable === true &&
                            sourceCase.runnable === true
                    })
                );
                return caseItem;
            }
        );

        item.children.replace(children);
        return item;
    }

    async #handleWorkspaceEvent(event) {
        switch (event?.kind) {
            case CLRSTestWorkspaceEventKind
                .DEFINITION_CREATED:
                this.#cancelScheduledRefresh(
                    event.definitionPath
                );
                await this.discovery.refresh(
                    event.definitionPath
                );
                break;
            case CLRSTestWorkspaceEventKind
                .DEFINITION_CHANGED:
                this.#scheduleRefresh(
                    event.definitionPath
                );
                break;
            case CLRSTestWorkspaceEventKind
                .DEFINITION_DELETED:
                this.#cancelScheduledRefresh(
                    event.definitionPath
                );
                await this.discovery.remove(
                    event.definitionPath
                );
                break;
            default:
                this.#cancelAllScheduledRefreshes();
                await this.discovery.discover();
                break;
        }
    }

    #scheduleRefresh(definitionPath) {
        const previous = this.changeTimers.get(
            definitionPath
        );

        if (previous != null) {
            clearTimeout(previous);
        }

        const timer = setTimeout(() => {
            this.changeTimers.delete(
                definitionPath
            );
            void this.discovery.refresh(
                definitionPath
            ).catch(error => {
                this.#report(error);
            });
        }, this.changeDebounceMs);

        this.changeTimers.set(
            definitionPath,
            timer
        );
    }

    #cancelScheduledRefresh(definitionPath) {
        const timer = this.changeTimers.get(
            definitionPath
        );

        if (timer == null) {
            return;
        }

        clearTimeout(timer);
        this.changeTimers.delete(definitionPath);
    }

    #cancelAllScheduledRefreshes() {
        for (
            const definitionPath
            of this.changeTimers.keys()
        ) {
            this.#cancelScheduledRefresh(
                definitionPath
            );
        }
    }

    #renderFatal(error) {
        if (this.disposed) {
            return;
        }

        if (this.controller == null) {
            this.#report(error);
            return;
        }

        const id = "clrs-discovery:error";
        const item = this.controller.items.get(id) ??
            this.controller.createTestItem(
                id,
                CLRS_TEST_CONTROLLER_LABEL
            );

        item.error =
            error?.publicMessage ??
            "No fue posible descubrir las pruebas CLRS.";
        item.canResolveChildren = false;
        item.children.replace([]);
        this.metadata.clear();
        this.controller.items.replace([item]);
        this.#report(error);
    }

    #report(error) {
        try {
            this.developerLogger.error?.(
                "CLRS test discovery failed.",
                error
            );
        } catch {
            // El registro técnico no modifica el árbol de pruebas.
        }
    }
}

function suiteItemId(definitionPath) {
    return `clrs-suite:${encodeURIComponent(
        definitionPath
    )}`;
}

function caseItemId(definitionPath, caseId) {
    return `${suiteItemId(definitionPath)}:case:${encodeURIComponent(
        caseId
    )}`;
}

function definitionLabel(definitionPath) {
    const name = path.basename(definitionPath);

    return name.replace(
        /\.clrs-tests\.json$/iu,
        ""
    ) || name;
}
