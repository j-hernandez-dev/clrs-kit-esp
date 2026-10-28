import test from "node:test";
import assert from "node:assert/strict";

import {
    BrokerGameLoadSource,
    BrokerGameSession
} from "../src/broker95/application/BrokerGameSession.js";
import {
    createBrokerGameState,
    evolveBrokerGameState
} from "../src/broker95/core/BrokerGameState.js";
import {
    BrokerContractType,
    BrokerLearningRouteId,
    BrokerRisk,
    acceptBrokerContract,
    addBrokerContract,
    brokerCategoryCatalog,
    brokerLearningCatalog,
    createBrokerLearningRouteView,
    createInitialBrokerLearningProgress,
    createInitialBrokerLearningRoutesProgress,
    createBrokerPublicGameState,
    deleteBrokerContract,
    linkBrokerLearningContract,
    purgeBrokerContracts,
    replaceBrokerLearningRouteProgress,
    resetBrokerGameProgress,
    resolveBrokerLearningAttempt
} from "../src/broker95/index.js";
import {
    BrokerGamePersistenceError
} from "../src/broker95/persistence/BrokerGamePersistenceError.js";
import {
    BROKER_GAME_SNAPSHOT_FORMAT,
    BROKER_GAME_SNAPSHOT_VERSION,
    brokerGameStateSerializer
} from "../src/broker95/persistence/BrokerGameStateSerializer.js";
import {
    BROKER95_CORRUPT_STATE_KEY,
    BROKER95_GLOBAL_STATE_KEY,
    VSCodeGlobalStateBrokerGameRepository
} from "../extension/adapters/VSCodeGlobalStateBrokerGameRepository.js";
import {
    activateAlgorithmsLesson,
    completeActiveAlgorithmsLesson,
    createAlgorithmsLearningCatalogsFixture,
    createUnlockedAlgorithmsGameState
} from "./fixtures/broker95-algorithms-learning-fixture.js";

test("serializa y reconstruye el estado determinista sin compartir referencias", () => {
    const source = evolveBrokerGameState(
        createBrokerGameState(),
        { money: 250 }
    );
    const snapshot =
        brokerGameStateSerializer.encode(
            source
        );
    const decoded =
        brokerGameStateSerializer.decode(
            snapshot
        );

    assert.equal(
        snapshot.format,
        BROKER_GAME_SNAPSHOT_FORMAT
    );
    assert.equal(
        snapshot.formatVersion,
        BROKER_GAME_SNAPSHOT_VERSION
    );
    assert.deepEqual(decoded.state, source);
    assert.notEqual(
        decoded.state,
        source
    );
    assert.equal(
        Object.isFrozen(decoded.state),
        true
    );
    assert.equal(
        JSON.stringify(snapshot)
            .includes("apiKey"),
        false
    );
});

test("rechaza una partida antigua sin intentar migrarla", () => {
    const obsolete = createBrokerGameState({
        money: 75
    });

    assert.throws(
        () => brokerGameStateSerializer.decode(
            structuredClone(obsolete)
        ),
        error => error.code ===
            "BROKER95_PERSISTENCE_SNAPSHOT_INVALID"
    );
});

test("preserva una versión futura en lugar de degradarla o reiniciarla", async () => {
    const future = {
        format:
            BROKER_GAME_SNAPSHOT_FORMAT,
        formatVersion:
            BROKER_GAME_SNAPSHOT_VERSION + 1,
        state: structuredClone(
            createBrokerGameState()
        )
    };
    const memento = new FakeGlobalMemento({
        [BROKER95_GLOBAL_STATE_KEY]:
            future
    });
    const session = createSession(memento);

    await assert.rejects(
        session.initialize(),
        error =>
            error instanceof
                BrokerGamePersistenceError &&
            error.code ===
                "BROKER95_PERSISTENCE_VERSION_UNSUPPORTED"
    );
    assert.deepEqual(
        memento.get(
            BROKER95_GLOBAL_STATE_KEY
        ),
        future
    );
    assert.equal(memento.updates.length, 0);
});

test("crea una partida global la primera vez y la restaura en otra sesión", async () => {
    const memento =
        new FakeGlobalMemento();
    const first = createSession(memento);
    const created = await first.initialize();

    assert.equal(
        created.source,
        BrokerGameLoadSource.CREATED
    );
    await first.transact(
        state => evolveBrokerGameState(
            state,
            { money: 125 }
        ),
        { expectedRevision: 0 }
    );

    const second = createSession(memento);
    const restored =
        await second.initialize();

    assert.equal(
        restored.source,
        BrokerGameLoadSource.RESTORED
    );
    assert.equal(restored.state.money, 125);
    assert.equal(restored.state.revision, 1);
});

test("pone en cuarentena una partida obsoleta y comienza desde cero", async () => {
    const obsolete = structuredClone(
        createBrokerGameState({
            money: 30
        })
    );
    const memento = new FakeGlobalMemento({
        [BROKER95_GLOBAL_STATE_KEY]:
            obsolete
    });
    const session = createSession(memento);
    const loaded = await session.initialize();

    assert.equal(
        loaded.source,
        BrokerGameLoadSource.RECOVERED
    );
    assert.equal(loaded.state.money, 0);
    assert.equal(
        loaded.recoveryCode,
        "BROKER95_PERSISTENCE_SNAPSHOT_INVALID"
    );
    assert.equal(
        memento.get(
            BROKER95_GLOBAL_STATE_KEY
        ).formatVersion,
        BROKER_GAME_SNAPSHOT_VERSION
    );
});

test("rechaza un snapshot anterior a Aprendizaje", () => {
    const current = addBrokerContract(
        createBrokerGameState({
            money: 175,
            alertLevel: 2
        }),
        clientContractDraft()
    );
    const legacyState = structuredClone(
        current
    );

    legacyState.schemaVersion = 1;
    delete legacyState.learningProgress;
    delete legacyState.contracts[0]
        .contractType;

    assert.throws(
        () => brokerGameStateSerializer.decode({
            format:
                BROKER_GAME_SNAPSHOT_FORMAT,
            formatVersion: 1,
            state: legacyState
        }),
        error => error.code ===
            "BROKER95_PERSISTENCE_SNAPSHOT_INVALID"
    );
});

test("rechaza contratos persistidos sin el discriminante actual", () => {
    const state = addBrokerContract(
        createBrokerGameState(),
        clientContractDraft()
    );
    const snapshot = structuredClone(
        brokerGameStateSerializer.encode(state)
    );

    delete snapshot.state.contracts[0]
        .contractType;

    assert.throws(
        () => brokerGameStateSerializer.decode(
            snapshot
        ),
        error => error.code ===
            "BROKER95_PERSISTENCE_SNAPSHOT_INVALID"
    );
});

test("rechaza contratos educativos persistidos sin ruta y no los migra", () => {
    const state = addBrokerContract(
        createBrokerGameState(),
        learningContractDraft()
    );
    const snapshot = structuredClone(
        brokerGameStateSerializer.encode(state)
    );

    delete snapshot.state.contracts[0]
        .learningRouteId;

    assert.throws(
        () => brokerGameStateSerializer.decode(
            snapshot
        ),
        error => error.code ===
            "BROKER95_PERSISTENCE_SNAPSHOT_INVALID"
    );
});

test("persiste progreso educativo completo en el mismo snapshot global", () => {
    const progress = completeFirstLesson();
    const source = evolveBrokerGameState(
        createBrokerGameState({
            money: 80
        }),
        { learningProgress: progress }
    );
    const decoded = brokerGameStateSerializer
        .decode(
            brokerGameStateSerializer
                .encode(source)
        );

    assert.deepEqual(
        decoded.state.learningProgress,
        progress
    );
    assert.equal(decoded.reconciled, false);
    assert.equal(
        createBrokerLearningRouteView(
            programming(decoded.state)
        ).completedLessons,
        1
    );
});

test("reconcilia enlaces faltantes desde contratos learning abiertos", () => {
    const source = addBrokerContract(
        createBrokerGameState(),
        learningContractDraft()
    );
    const snapshot = structuredClone(
        brokerGameStateSerializer.encode(
            source
        )
    );

    snapshot.state.learningProgress
        .routes.programming
        .lessonContractLinks = {};
    const decoded =
        brokerGameStateSerializer.decode(
            snapshot
        );

    assert.equal(decoded.reconciled, true);
    assert.deepEqual(
        programming(decoded.state)
            .lessonContractLinks["lesson-001"],
        {
            lessonId: "lesson-001",
            contractId: 1,
            learningAttempt: 1,
            repetition: false
        }
    );
});

test("la sesión reescribe inmediatamente una reconciliación restaurada", async () => {
    const source = addBrokerContract(
        createBrokerGameState(),
        learningContractDraft()
    );
    const stale = structuredClone(
        brokerGameStateSerializer.encode(
            source
        )
    );

    stale.state.learningProgress
        .routes.programming
        .lessonContractLinks = {};
    const memento = new FakeGlobalMemento({
        [BROKER95_GLOBAL_STATE_KEY]: stale
    });
    const loaded = await createSession(
        memento
    ).initialize();
    const persisted = memento.get(
        BROKER95_GLOBAL_STATE_KEY
    );

    assert.equal(
        loaded.source,
        BrokerGameLoadSource.RECONCILED
    );
    assert.equal(loaded.reconciled, true);
    assert.equal(
        persisted.state.learningProgress
            .routes.programming
            .lessonContractLinks["lesson-001"]
            .contractId,
        1
    );
});

test("delete y purge liberan automáticamente los enlaces persistidos", () => {
    let deletedState = addBrokerContract(
        createBrokerGameState(),
        learningContractDraft()
    );

    assert.equal(
        programming(deletedState)
            .lessonContractLinks["lesson-001"]
            .contractId,
        1
    );
    deletedState = deleteBrokerContract(
        deletedState,
        1
    );
    assert.deepEqual(
        programming(deletedState)
            .lessonContractLinks,
        {}
    );

    let purgedState = addBrokerContract(
        createBrokerGameState(),
        learningContractDraft()
    );

    purgedState = purgeBrokerContracts(
        purgedState
    );
    assert.deepEqual(
        programming(purgedState)
            .lessonContractLinks,
        {}
    );
});

test("elimina enlaces huérfanos sin borrar logros educativos", () => {
    const progress = completeFirstLesson();
    const snapshot = structuredClone(
        brokerGameStateSerializer.encode(
            createBrokerGameState({
                learningProgress: progress
            })
        )
    );

    snapshot.state.learningProgress
        .routes.programming
        .lessonContractLinks = {
            "lesson-001": {
                lessonId: "lesson-001",
                contractId: 99,
                learningAttempt: 2,
                repetition: true
            }
        };
    const decoded =
        brokerGameStateSerializer.decode(
            snapshot
        );

    assert.equal(decoded.reconciled, true);
    assert.deepEqual(
        programming(decoded.state)
            .lessonContractLinks,
        {}
    );
    assert.deepEqual(
        programming(decoded.state)
            .completedLessonIds,
        ["lesson-001"]
    );
    assert.equal(
        programming(decoded.state)
            .lessonAttempts["lesson-001"]
            .bestScore,
        85
    );
});

test("la proyección pública conserva el progreso en un ciclo JSON", () => {
    const state = createBrokerGameState({
        learningProgress:
            completeFirstLesson()
    });
    const first = createBrokerPublicGameState(
        state
    );
    const restored =
        createBrokerPublicGameState(
            JSON.parse(JSON.stringify(first))
        );

    assert.deepEqual(
        restored.learning,
        first.learning
    );
    assert.equal(
        restored.learning.progress.programming
            .completedLessons,
        1
    );
    assert.equal(
        Object.isFrozen(
            restored.learning.progress.programming
                .lessons
        ),
        true
    );
});

test("el protocolo conserva el discriminante y enlace de un contrato learning", () => {
    const state = addBrokerContract(
        createBrokerGameState(),
        learningContractDraft()
    );
    const first = createBrokerPublicGameState(
        state
    );
    const restored =
        createBrokerPublicGameState(
            JSON.parse(JSON.stringify(first))
        );

    assert.equal(
        restored.contracts[0].contractType,
        BrokerContractType.LEARNING
    );
    assert.equal(
        restored.contracts[0].lessonId,
        "lesson-001"
    );
    assert.equal(
        restored.contracts[0].learningRouteId,
        "programming"
    );
    assert.equal(
        restored.learning.progress.programming
            .lessons[0].activeContractId,
        1
    );
});

test("borrar progreso reinicia también Aprendizaje sin tocar su configuración externa", () => {
    const state = createBrokerGameState({
        money: 100,
        learningProgress:
            completeFirstLesson()
    });
    const reset = resetBrokerGameProgress(
        state
    );

    assert.equal(reset.money, 0);
    assert.deepEqual(
        programming(reset)
            .completedLessonIds,
        []
    );
    assert.equal(
        programming(reset)
            .currentLessonId,
        "lesson-001"
    );
    assert.equal(
        reset.learningProgress.revision,
        state.learningProgress.revision + 1
    );
});

test("game over reinicia la partida normal pero conserva los logros educativos", () => {
    const category =
        brokerCategoryCatalog.requireCategory(
            "SORT-ELEM"
        );
    let state = createBrokerGameState({
        alertLevel: 9,
        learningProgress:
            completeFirstLesson()
    });

    state = addBrokerContract(state, {
        title: "Exposición final",
        categoryId: category.categoryId,
        categoryName: category.categoryName,
        familyId: category.familyId,
        familyName: category.familyName,
        risk: BrokerRisk.HIGH,
        description:
            "Resolver una tarea de ordenamiento.",
        requirements: ["Ordenar los datos."],
        client: "Nombre filtrado",
        payPotential: 1000
    });
    state = acceptBrokerContract(state, 1);

    assert.equal(state.status, "game_over");
    assert.deepEqual(state.contracts, []);
    assert.deepEqual(
        programming(state)
            .completedLessonIds,
        ["lesson-001"]
    );
    assert.equal(
        programming(state)
            .currentLessonId,
        "lesson-002"
    );
});

test("pone en cuarentena un snapshot corrupto antes de recuperar la partida", async () => {
    const corrupt = {
        format:
            BROKER_GAME_SNAPSHOT_FORMAT,
        formatVersion:
            BROKER_GAME_SNAPSHOT_VERSION,
        state: {
            ...structuredClone(
                createBrokerGameState()
            ),
            money: -1
        }
    };
    const memento = new FakeGlobalMemento({
        [BROKER95_GLOBAL_STATE_KEY]:
            corrupt
    });
    const session = createSession(memento);
    const loaded = await session.initialize();
    const quarantine = memento.get(
        BROKER95_CORRUPT_STATE_KEY
    );

    assert.equal(
        loaded.source,
        BrokerGameLoadSource.RECOVERED
    );
    assert.equal(loaded.state.money, 0);
    assert.equal(
        loaded.recoveryCode,
        "BROKER95_PERSISTENCE_SNAPSHOT_INVALID"
    );
    assert.deepEqual(
        quarantine.snapshot,
        corrupt
    );
    assert.equal(
        memento.updates[0].key,
        BROKER95_CORRUPT_STATE_KEY
    );
    assert.equal(
        memento.updates[1].key,
        BROKER95_GLOBAL_STATE_KEY
    );
});

test("no destruye el snapshot corrupto si falla su cuarentena", async () => {
    const corrupt = { unexpected: true };
    const memento = new FakeGlobalMemento({
        [BROKER95_GLOBAL_STATE_KEY]:
            corrupt
    });

    memento.failOnKey =
        BROKER95_CORRUPT_STATE_KEY;
    const session = createSession(memento);

    await assert.rejects(
        session.initialize(),
        error =>
            error.code ===
                "BROKER95_PERSISTENCE_STORAGE_ERROR" &&
            error.diagnostics[0]
                .operation ===
                "quarantine"
    );
    assert.deepEqual(
        memento.get(
            BROKER95_GLOBAL_STATE_KEY
        ),
        corrupt
    );
});

test("serializa transacciones concurrentes sin perder actualizaciones", async () => {
    const memento =
        new FakeGlobalMemento();
    const session = createSession(memento);

    await session.initialize();
    await Promise.all([
        session.transact(state =>
            evolveBrokerGameState(
                state,
                { money: state.money + 1 }
            )
        ),
        session.transact(state =>
            evolveBrokerGameState(
                state,
                { money: state.money + 1 }
            )
        )
    ]);

    assert.equal(session.getState().money, 2);
    assert.equal(
        session.getState().revision,
        2
    );
    assert.equal(
        memento.get(
            BROKER95_GLOBAL_STATE_KEY
        ).state.money,
        2
    );
});

test("rechaza revisiones obsoletas sin escribir", async () => {
    const memento =
        new FakeGlobalMemento();
    const session = createSession(memento);

    await session.initialize();
    const writesBefore =
        memento.updates.length;

    await assert.rejects(
        session.transact(
            state => evolveBrokerGameState(
                state,
                { money: 1 }
            ),
            { expectedRevision: 7 }
        ),
        error =>
            error.code ===
                "BROKER95_SESSION_REVISION_CONFLICT"
    );
    assert.equal(
        memento.updates.length,
        writesBefore
    );
    assert.equal(session.getState().money, 0);
});

test("una escritura fallida no publica ni cambia el estado en memoria", async () => {
    const memento =
        new FakeGlobalMemento();
    const session = createSession(memento);
    const observed = [];

    session.subscribe(state => {
        observed.push(state.revision);
    });
    await session.initialize();
    memento.failOnKey =
        BROKER95_GLOBAL_STATE_KEY;

    await assert.rejects(
        session.transact(state =>
            evolveBrokerGameState(
                state,
                { money: 99 }
            )
        ),
        error =>
            error.code ===
                "BROKER95_PERSISTENCE_STORAGE_ERROR"
    );
    assert.equal(session.getState().money, 0);
    assert.deepEqual(observed, [0]);
});

test("publica una revisión únicamente después de persistirla", async () => {
    const memento =
        new FakeGlobalMemento();
    const session = createSession(memento);
    const observed = [];

    await session.initialize();
    session.subscribe(state => {
        observed.push({
            notified: state.revision,
            persisted:
                memento.get(
                    BROKER95_GLOBAL_STATE_KEY
                ).state.revision
        });
    });
    await session.transact(state =>
        evolveBrokerGameState(
            state,
            { money: 1 }
        )
    );

    assert.deepEqual(observed, [{
        notified: 1,
        persisted: 1
    }]);
});

test("una transición sin cambios no produce una escritura redundante", async () => {
    const memento =
        new FakeGlobalMemento();
    const session = createSession(memento);

    await session.initialize();
    const writesBefore =
        memento.updates.length;
    const state = await session.transact(
        current => current
    );

    assert.equal(state.revision, 0);
    assert.equal(
        memento.updates.length,
        writesBefore
    );
});

test("la sesión entrega sus catálogos a las transiciones autoritativas", async () => {
    const catalogs =
        createAlgorithmsLearningCatalogsFixture();
    const learned = completeActiveAlgorithmsLesson(
        activateAlgorithmsLesson(
            createUnlockedAlgorithmsGameState(
                catalogs
            ),
            "algorithm-lesson-001",
            catalogs
        ),
        catalogs,
        { score: 100 }
    );
    const memento = new FakeGlobalMemento();
    const session = new BrokerGameSession({
        repository:
            new VSCodeGlobalStateBrokerGameRepository(
                memento
            ),
        catalogs,
        createInitialState: () => learned,
        developerLogger: {
            error() {}
        }
    });

    await session.initialize();
    const reset = await session.transact(
        resetBrokerGameProgress
    );

    assert.deepEqual(
        reset.learningProgress.routes.algorithms
            .completedLessonIds,
        []
    );
    assert.equal(
        reset.learningProgress.routes.algorithms
            .currentLessonId,
        "algorithm-lesson-001"
    );
    assert.deepEqual(
        reset.learningProgress.availableRouteIds,
        [BrokerLearningRouteId.PROGRAMMING]
    );
});

test("el repositorio usa exclusivamente las claves del globalState del perfil", async () => {
    const memento =
        new FakeGlobalMemento();
    const repository =
        new VSCodeGlobalStateBrokerGameRepository(
            memento
        );
    const snapshot =
        brokerGameStateSerializer.encode(
            createBrokerGameState()
        );

    await repository.write(snapshot);
    assert.deepEqual(
        await repository.read(),
        snapshot
    );
    assert.deepEqual(
        memento.updates.map(
            update => update.key
        ),
        [BROKER95_GLOBAL_STATE_KEY]
    );
});

test("la sesión exige inicialización y deja de admitir operaciones al cerrarse", async () => {
    const session = createSession(
        new FakeGlobalMemento()
    );

    assert.throws(
        () => session.getState(),
        error =>
            error.code ===
                "BROKER95_SESSION_NOT_READY"
    );
    await session.initialize();
    session.dispose();
    assert.throws(
        () => session.getState(),
        error =>
            error.code ===
                "BROKER95_SESSION_DISPOSED"
    );
});

function createSession(memento) {
    return new BrokerGameSession({
        repository:
            new VSCodeGlobalStateBrokerGameRepository(
                memento
            ),
        developerLogger: {
            error() {}
        }
    });
}

function completeFirstLesson() {
    let progress =
        createInitialBrokerLearningProgress();

    progress = linkBrokerLearningContract(
        progress,
        {
            lessonId: "lesson-001",
            contractId: 1,
            createdAt: "learning-start"
        }
    );

    const completed = resolveBrokerLearningAttempt(
        progress,
        {
            lessonId: "lesson-001",
            contractId: 1,
            score: 85,
            resolvedAt: "learning-complete"
        }
    );

    return replaceBrokerLearningRouteProgress(
        createInitialBrokerLearningRoutesProgress(),
        BrokerLearningRouteId.PROGRAMMING,
        completed
    );
}

function programming(state) {
    return state.learningProgress.routes.programming;
}

function clientContractDraft() {
    const category =
        brokerCategoryCatalog.requireCategory(
            "NUM-ARITH"
        );

    return {
        title: "Contrato persistido",
        categoryId: category.categoryId,
        categoryName: category.categoryName,
        familyId: category.familyId,
        familyName: category.familyName,
        risk: BrokerRisk.LOW,
        description:
            "Resolver una operación sencilla.",
        requirements: ["Mostrar el resultado."],
        client: "Northstar",
        payPotential: 200
    };
}

function learningContractDraft() {
    const lesson =
        brokerLearningCatalog.requireLesson(
            "lesson-001"
        );
    const category =
        brokerCategoryCatalog.requireCategory(
            lesson.categoryId
        );

    return {
        contractType:
            BrokerContractType.LEARNING,
        learningRouteId: "programming",
        title: "Práctica persistida",
        categoryId: category.categoryId,
        categoryName: category.categoryName,
        familyId: category.familyId,
        familyName: category.familyName,
        risk: BrokerRisk.LOW,
        description:
            "Mostrar un mensaje sencillo.",
        requirements: ["Mostrar el texto."],
        client: "CIPHER",
        payPotential: lesson.baseReward,
        lessonId: lesson.id,
        sectionId: lesson.sectionId,
        learningAttempt: 1,
        baseReward: lesson.baseReward,
        effectiveReward:
            lesson.baseReward,
        createdAt: "learning-contract"
    };
}

class FakeGlobalMemento {

    constructor(initial = {}) {
        this.values = new Map(
            Object.entries(initial).map(
                ([key, value]) => [
                    key,
                    structuredClone(value)
                ]
            )
        );
        this.updates = [];
        this.failOnKey = null;
    }

    get(key) {
        const value = this.values.get(key);

        return value === undefined
            ? undefined
            : structuredClone(value);
    }

    async update(key, value) {
        if (key === this.failOnKey) {
            throw new Error(
                "simulated memento failure"
            );
        }

        const stored = value === undefined
            ? undefined
            : structuredClone(value);

        this.updates.push({ key, value: stored });

        if (stored === undefined) {
            this.values.delete(key);
        } else {
            this.values.set(key, stored);
        }
    }
}
