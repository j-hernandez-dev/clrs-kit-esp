import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
    CLRSTestDiscoveryError,
    CLRSTestDiscoveryService,
    CLRSTestDiscoveryStatus
} from "../src/testing/index.js";
import {
    CLRSTestDiscoveryController,
    CLRSTestWorkspaceEventKind,
    VSCodeCLRSTestWorkspace
} from "../extension/testing/index.js";

const WORKSPACE_PATH = path.resolve(
    "test",
    "fixtures",
    "testing-discovery"
);
const FIRST_DEFINITION = path.join(
    WORKSPACE_PATH,
    "suma.clrs-tests.json"
);
const SECOND_DEFINITION = path.join(
    WORKSPACE_PATH,
    "resta.clrs-tests.json"
);
const SUM_PROGRAM = path.join(
    WORKSPACE_PATH,
    "suma.clrs"
);

test("descubre suites válidas sin detenerse por definiciones inválidas", async () => {
    const workspace = memoryWorkspace({
        definitions: new Map([
            [
                FIRST_DEFINITION,
                definitionSource({
                    id: "suite:suma",
                    name: "Pruebas de suma",
                    program: "./suma.clrs"
                })
            ],
            [SECOND_DEFINITION, "{"]
        ]),
        files: new Set([SUM_PROGRAM])
    });
    const discovery = new CLRSTestDiscoveryService({
        workspace
    });
    const snapshot = await discovery.discover();

    assert.equal(snapshot.revision, 1);
    assert.equal(snapshot.entries.length, 2);
    assert.equal(snapshot.suites.length, 1);
    assert.equal(snapshot.runnableSuites.length, 1);
    assert.equal(snapshot.issues.length, 1);
    assert.equal(
        snapshot.entries[0].status,
        CLRSTestDiscoveryStatus.INVALID_DEFINITION
    );
    assert.equal(
        snapshot.entries[1].status,
        CLRSTestDiscoveryStatus.READY
    );
    assert.equal(
        snapshot.issues[0].code,
        "CLRS_TEST_DOCUMENT_JSON_INVALID"
    );
    assert.equal(Object.isFrozen(snapshot), true);
    assert.equal(Object.isFrozen(snapshot.entries), true);
    assert.equal(
        Object.isFrozen(snapshot.entries[0]),
        true
    );
});

test("activa la Testing API sólo cuando aparece una prueba CLRS", async () => {
    const definitions = new Map();
    const files = new Set([SUM_PROGRAM]);
    const discovery = new CLRSTestDiscoveryService({
        workspace: memoryWorkspace({
            definitions,
            files
        })
    });
    const testHost = {
        subscribe(listener) {
            this.listener = listener;
            return disposable();
        },
        toUri(sourcePath) {
            return { fsPath: sourcePath };
        },
        describePath(sourcePath) {
            return path.basename(sourcePath);
        }
    };
    const fakeTests = createTestingApi();
    const activations = [];
    const controller = new CLRSTestDiscoveryController({
        vscodeApi: fakeTests.api,
        discovery,
        workspace: testHost,
        developerLogger: {
            error() {}
        }
    });
    const activation = controller.onDidActivate(
        nativeController => {
            activations.push(nativeController);
        }
    );

    await controller.start();

    assert.equal(fakeTests.createdCount, 0);
    assert.equal(controller.controller, null);
    assert.equal(controller.isActive, false);

    definitions.set(
        FIRST_DEFINITION,
        definitionSource()
    );
    testHost.listener({
        kind:
            CLRSTestWorkspaceEventKind
                .DEFINITION_CREATED,
        definitionPath: FIRST_DEFINITION
    });
    await waitFor(() =>
        fakeTests.createdCount === 1
    );

    assert.equal(fakeTests.createdCount, 1);
    assert.equal(controller.isActive, true);
    assert.equal(activations.length, 1);
    assert.equal(
        activations[0],
        fakeTests.controller
    );

    activation.dispose();
    controller.dispose();
});

test("conserva la suite descubierta y marca un programa ausente", async () => {
    const workspace = memoryWorkspace({
        definitions: new Map([[
            FIRST_DEFINITION,
            definitionSource()
        ]])
    });
    const discovery = new CLRSTestDiscoveryService({
        workspace
    });
    const snapshot = await discovery.discover();
    const [entry] = snapshot.entries;

    assert.equal(
        entry.status,
        CLRSTestDiscoveryStatus.PROGRAM_MISSING
    );
    assert.equal(entry.suite.cases.length, 2);
    assert.equal(snapshot.suites.length, 1);
    assert.equal(snapshot.runnableSuites.length, 0);
    assert.equal(
        entry.issue.code,
        "CLRS_TEST_PROGRAM_NOT_FOUND"
    );
    assert.equal(entry.issue.programPath, SUM_PROGRAM);
});

test("aísla fallos de lectura y comprobación por archivo", async () => {
    const workspace = memoryWorkspace({
        definitions: new Map([
            [FIRST_DEFINITION, definitionSource()],
            [SECOND_DEFINITION, definitionSource({
                id: "suite:resta",
                name: "Pruebas de resta",
                program: "./resta.clrs"
            })]
        ]),
        readFailures: new Set([FIRST_DEFINITION]),
        statFailures: new Set([
            path.join(WORKSPACE_PATH, "resta.clrs")
        ])
    });
    const discovery = new CLRSTestDiscoveryService({
        workspace
    });
    const snapshot = await discovery.discover();

    assert.deepEqual(
        snapshot.entries.map(entry => entry.status),
        [
            CLRSTestDiscoveryStatus
                .PROGRAM_CHECK_FAILED,
            CLRSTestDiscoveryStatus.READ_FAILED
        ]
    );
    assert.deepEqual(
        snapshot.issues.map(issue => issue.code),
        [
            "CLRS_TEST_PROGRAM_CHECK_FAILED",
            "CLRS_TEST_DEFINITION_READ_FAILED"
        ]
    );
});

test("refresca, elimina y vuelve a reconciliar el índice completo", async () => {
    const definitions = new Map([[
        FIRST_DEFINITION,
        definitionSource()
    ]]);
    const workspace = memoryWorkspace({
        definitions,
        files: new Set([SUM_PROGRAM])
    });
    const discovery = new CLRSTestDiscoveryService({
        workspace
    });
    const revisions = [];
    const subscription = discovery.subscribe(
        snapshot => revisions.push(snapshot.revision)
    );

    await discovery.discover();
    definitions.set(
        FIRST_DEFINITION,
        definitionSource({
            name: "Suma actualizada"
        })
    );
    await discovery.refresh(FIRST_DEFINITION);

    assert.equal(
        discovery.getSnapshot().suites[0].name,
        "Suma actualizada"
    );

    await discovery.remove(FIRST_DEFINITION);
    assert.equal(
        discovery.getSnapshot().entries.length,
        0
    );

    definitions.set(
        SECOND_DEFINITION,
        definitionSource({
            id: "suite:resta",
            name: "Resta",
            program: "./suma.clrs"
        })
    );
    await discovery.discover();

    assert.equal(
        discovery.findByDefinitionPath(
            SECOND_DEFINITION
        ).suite.id,
        "suite:resta"
    );
    assert.deepEqual(revisions, [1, 2, 3, 4]);

    subscription.dispose();
    discovery.dispose();

    await assert.rejects(
        () => discovery.discover(),
        error =>
            error instanceof CLRSTestDiscoveryError &&
            error.code ===
                "CLRS_TEST_DISCOVERY_DISPOSED"
    );
});

test("serializa cambios concurrentes para preservar el contenido más reciente", async () => {
    let readCount = 0;
    let releaseFirstRead;
    const firstRead = new Promise(resolve => {
        releaseFirstRead = resolve;
    });
    const workspace = {
        async listDefinitionPaths() {
            return [FIRST_DEFINITION];
        },
        async readText() {
            readCount += 1;

            if (readCount === 1) {
                await firstRead;
                return definitionSource({
                    name: "Versión anterior"
                });
            }

            return definitionSource({
                name: "Versión reciente"
            });
        },
        async isFile() {
            return true;
        }
    };
    const discovery = new CLRSTestDiscoveryService({
        workspace
    });
    const older = discovery.refresh(FIRST_DEFINITION);
    const newer = discovery.refresh(FIRST_DEFINITION);

    await waitFor(() => readCount === 1);
    releaseFirstRead();
    await Promise.all([older, newer]);

    assert.equal(
        discovery.getSnapshot().suites[0].name,
        "Versión reciente"
    );
    assert.equal(readCount, 2);
});

test("el adaptador de VS Code busca, lee y publica cambios relevantes", async () => {
    const fake = createWorkspaceApi();
    const adapter = new VSCodeCLRSTestWorkspace(
        fake.api
    );
    const events = [];
    const subscription = adapter.subscribe(
        event => events.push(event)
    );
    const paths = await adapter.listDefinitionPaths();

    assert.deepEqual(paths, [FIRST_DEFINITION]);
    assert.equal(
        await adapter.readText(FIRST_DEFINITION),
        "contenido abierto"
    );
    assert.equal(await adapter.isFile(SUM_PROGRAM), true);
    assert.equal(
        adapter.describePath(FIRST_DEFINITION),
        "suma.clrs-tests.json"
    );

    fake.definitionWatcher.fireChange(
        fake.uri(FIRST_DEFINITION)
    );
    fake.programWatcher.fireDelete(
        fake.uri(SUM_PROGRAM)
    );
    fake.fireFoldersChanged();

    assert.deepEqual(
        events.map(event => event.kind),
        [
            CLRSTestWorkspaceEventKind
                .DEFINITION_CHANGED,
            CLRSTestWorkspaceEventKind
                .PROGRAM_DELETED,
            CLRSTestWorkspaceEventKind
                .WORKSPACE_CHANGED
        ]
    );

    subscription.dispose();
    assert.equal(
        fake.resources.every(resource =>
            resource.disposed
        ),
        true
    );
});

test("proyecta suites, casos e incidencias en TestItem nativos", async () => {
    const definitions = new Map([[
        FIRST_DEFINITION,
        definitionSource()
    ]]);
    const files = new Set([SUM_PROGRAM]);
    const workspacePort = memoryWorkspace({
        definitions,
        files
    });
    const discovery = new CLRSTestDiscoveryService({
        workspace: workspacePort
    });
    const events = [];
    const testHost = {
        subscribe(listener) {
            this.listener = listener;
            return disposable();
        },
        toUri(sourcePath) {
            return { fsPath: sourcePath };
        },
        describePath(sourcePath) {
            return path.basename(sourcePath);
        },
        emit(event) {
            events.push(event);
            this.listener(event);
        }
    };
    const fakeTests = createTestingApi();
    const controller = new CLRSTestDiscoveryController({
        vscodeApi: fakeTests.api,
        discovery,
        workspace: testHost,
        developerLogger: {
            error() {}
        },
        changeDebounceMs: 10
    });

    await controller.start();

    const root = [...fakeTests.controller.items][0];
    const cases = [...root.children];

    assert.equal(root.label, "Pruebas de suma");
    assert.equal(root.error, undefined);
    assert.equal(cases.length, 2);
    assert.equal(cases[0].label, "Suma positivos");
    assert.equal(
        controller.getMetadata(cases[0]).kind,
        "case"
    );
    assert.equal(
        controller.getMetadata(cases[0]).runnable,
        true
    );

    definitions.set(
        FIRST_DEFINITION,
        definitionSource({
            name: "Suite actualizada"
        })
    );
    testHost.emit({
        kind:
            CLRSTestWorkspaceEventKind
                .DEFINITION_CHANGED,
        definitionPath: FIRST_DEFINITION
    });
    testHost.emit({
        kind:
            CLRSTestWorkspaceEventKind
                .DEFINITION_CHANGED,
        definitionPath: FIRST_DEFINITION
    });
    await waitFor(() =>
        controller.getSnapshot().revision === 2
    );

    assert.equal(
        [...fakeTests.controller.items][0].label,
        "Suite actualizada"
    );

    files.delete(SUM_PROGRAM);
    testHost.emit({
        kind:
            CLRSTestWorkspaceEventKind
                .PROGRAM_DELETED,
        definitionPath: null
    });
    await waitFor(() =>
        controller.getSnapshot().revision === 3
    );

    const missingRoot = [
        ...fakeTests.controller.items
    ][0];

    assert.match(
        missingRoot.error,
        /No se encontró/u
    );
    assert.equal(
        controller.getMetadata(
            [...missingRoot.children][0]
        ).runnable,
        false
    );

    testHost.emit({
        kind:
            CLRSTestWorkspaceEventKind
                .DEFINITION_CHANGED,
        definitionPath: FIRST_DEFINITION
    });
    definitions.delete(FIRST_DEFINITION);
    testHost.emit({
        kind:
            CLRSTestWorkspaceEventKind
                .DEFINITION_DELETED,
        definitionPath: FIRST_DEFINITION
    });
    await waitFor(() =>
        controller.getSnapshot().revision === 4
    );

    await new Promise(resolve =>
        setTimeout(resolve, 30)
    );

    assert.equal(fakeTests.controller.items.size, 0);
    assert.equal(events.length, 5);

    let externalListener = null;
    let externalSnapshot = {
        sourceId: "broker95",
        revision: 1,
        roots: [{
            id: "contract:7",
            sourceKey: "7",
            label: "BROKER.95 · Contrato activo",
            description: "Casos públicos",
            runnable: true,
            cases: [{
                id: "TC-1",
                label: "TC-1 · normal",
                description: "Caso público",
                runnable: true
            }]
        }]
    };
    const externalSource = {
        id: "broker95",
        start() {
            return externalSnapshot;
        },
        getSnapshot() {
            return externalSnapshot;
        },
        subscribe(listener) {
            externalListener = listener;
            return disposable();
        }
    };

    await controller.attachExternalSource(
        externalSource
    );

    const brokerRoot = [
        ...fakeTests.controller.items
    ][0];
    const brokerCase = [...brokerRoot.children][0];

    assert.equal(
        brokerRoot.label,
        "BROKER.95 · Contrato activo"
    );
    assert.equal(
        controller.getMetadata(brokerCase).sourceId,
        "broker95"
    );
    assert.equal(
        controller.getMetadata(brokerCase).sourceKey,
        "7"
    );

    externalSnapshot = {
        sourceId: "broker95",
        revision: 2,
        roots: []
    };
    externalListener(externalSnapshot);
    assert.equal(fakeTests.controller.items.size, 0);

    controller.dispose();
    assert.equal(fakeTests.controller.disposed, true);
});

function memoryWorkspace(options = {}) {
    const definitions = options.definitions ??
        new Map();
    const files = options.files ?? new Set();
    const readFailures = options.readFailures ??
        new Set();
    const statFailures = options.statFailures ??
        new Set();

    return {
        async listDefinitionPaths() {
            return [...definitions.keys()];
        },
        async readText(definitionPath) {
            if (readFailures.has(definitionPath)) {
                throw new Error("read failed");
            }

            return definitions.get(definitionPath);
        },
        async isFile(sourcePath) {
            if (statFailures.has(sourcePath)) {
                throw new Error("stat failed");
            }

            return files.has(sourcePath);
        }
    };
}

function definitionSource(overrides = {}) {
    return JSON.stringify({
        version: 1,
        id: overrides.id ?? "suite:suma",
        name: overrides.name ?? "Pruebas de suma",
        program: overrides.program ?? "./suma.clrs",
        cases: overrides.cases ?? [
            {
                id: "case:positivos",
                name: "Suma positivos",
                input: ["4", "5"],
                expectedOutput: ["9"]
            },
            {
                id: "case:cero",
                name: "Suma con cero",
                input: ["0", "2"],
                expectedOutput: ["2"]
            }
        ]
    });
}

function createWorkspaceApi() {
    const resources = [];
    const uri = sourcePath => ({
        fsPath: path.normalize(sourcePath),
        path: path.normalize(sourcePath),
        toString() {
            return `file://${this.fsPath}`;
        }
    });
    const definitionWatcher = watcher(resources);
    const programWatcher = watcher(resources);
    let watcherCount = 0;
    let foldersListener = null;
    const workspaceFolder = {
        name: "testing-discovery",
        uri: uri(WORKSPACE_PATH)
    };
    const api = {
        workspace: {
            workspaceFolders: [workspaceFolder],
            textDocuments: [{
                uri: uri(FIRST_DEFINITION),
                getText() {
                    return "contenido abierto";
                }
            }],
            fs: {
                async readFile() {
                    return new TextEncoder()
                        .encode("contenido guardado");
                },
                async stat() {
                    return { type: 1 };
                }
            },
            async findFiles() {
                return [
                    uri(FIRST_DEFINITION),
                    uri(path.join(
                        WORKSPACE_PATH,
                        "node_modules",
                        "oculto.clrs-tests.json"
                    ))
                ];
            },
            createFileSystemWatcher() {
                const result = watcherCount === 0
                    ? definitionWatcher
                    : programWatcher;
                watcherCount += 1;
                return result;
            },
            onDidChangeTextDocument() {
                return trackedDisposable(resources);
            },
            onDidChangeWorkspaceFolders(listener) {
                foldersListener = listener;
                return trackedDisposable(resources);
            }
        },
        Uri: {
            file: uri,
            joinPath(base, ...segments) {
                return uri(path.join(
                    base.fsPath,
                    ...segments
                ));
            }
        },
        FileType: {
            File: 1
        }
    };

    return {
        api,
        uri,
        resources,
        definitionWatcher,
        programWatcher,
        fireFoldersChanged() {
            foldersListener();
        }
    };
}

function watcher(resources) {
    const listeners = {
        create: null,
        change: null,
        delete: null
    };
    const result = trackedDisposable(resources);

    result.onDidCreate = listener => {
        listeners.create = listener;
        return trackedDisposable(resources);
    };
    result.onDidChange = listener => {
        listeners.change = listener;
        return trackedDisposable(resources);
    };
    result.onDidDelete = listener => {
        listeners.delete = listener;
        return trackedDisposable(resources);
    };
    result.fireChange = uri => listeners.change(uri);
    result.fireDelete = uri => listeners.delete(uri);

    return result;
}

function createTestingApi() {
    let createdCount = 0;
    const controller = {
        items: collection(),
        disposed: false,
        createTestItem(id, label, uri) {
            return {
                id,
                label,
                uri,
                children: collection(),
                canResolveChildren: false,
                busy: false
            };
        },
        dispose() {
            this.disposed = true;
        }
    };

    return {
        controller,
        get createdCount() {
            return createdCount;
        },
        api: {
            tests: {
                createTestController() {
                    createdCount += 1;
                    return controller;
                }
            }
        }
    };
}

function collection() {
    const values = new Map();

    return {
        get size() {
            return values.size;
        },
        get(id) {
            return values.get(id);
        },
        replace(items) {
            values.clear();

            for (const item of items) {
                values.set(item.id, item);
            }
        },
        [Symbol.iterator]() {
            return values.values();
        }
    };
}

function trackedDisposable(resources) {
    const resource = {
        disposed: false,
        dispose() {
            resource.disposed = true;
        }
    };

    resources.push(resource);
    return resource;
}

function disposable() {
    return {
        dispose() {}
    };
}

async function waitFor(predicate) {
    const timeoutAt = Date.now() + 2_000;

    while (!predicate()) {
        if (Date.now() >= timeoutAt) {
            assert.fail("La condición esperada no se cumplió.");
        }

        await new Promise(resolve =>
            setTimeout(resolve, 5)
        );
    }
}
