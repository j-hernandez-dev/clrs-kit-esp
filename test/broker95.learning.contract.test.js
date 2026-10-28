import assert from "node:assert/strict";
import test from "node:test";

import {
    BROKER_CONTRACT_TYPES,
    BrokerContractState,
    BrokerContractType,
    BrokerRisk,
    addBrokerContract,
    brokerCategoryCatalog,
    brokerLearningCatalog,
    createBrokerContract,
    createBrokerGameState,
    isBrokerClientContract,
    isBrokerLearningContract,
    updateBrokerContract
} from "../src/broker95/index.js";

test("construye un contrato client canónico", () => {
    const contract = createBrokerContract(
        clientContractDraft()
    );

    assert.deepEqual(
        BROKER_CONTRACT_TYPES,
        ["client", "learning"]
    );
    assert.equal(
        contract.contractType,
        BrokerContractType.CLIENT
    );
    assert.equal(
        isBrokerClientContract(contract),
        true
    );
    assert.equal(
        isBrokerLearningContract(contract),
        false
    );
    assert.equal(
        Object.hasOwn(contract, "lessonId"),
        false
    );
    assert.equal(
        Object.hasOwn(
            contract,
            "learningRouteId"
        ),
        false
    );
});

test("crea un contrato learning dentro del modelo canónico", () => {
    const contract = createBrokerContract(
        learningContractDraft()
    );

    assert.equal(
        contract.contractType,
        BrokerContractType.LEARNING
    );
    assert.equal(
        isBrokerLearningContract(contract),
        true
    );
    assert.deepEqual(
        contract.weights,
        { functionality: 1 }
    );
    assert.deepEqual(
        learningIdentity(contract),
        {
            learningRouteId: "programming",
            lessonId: "lesson-001",
            sectionId: "section-001",
            learningAttempt: 1,
            baseReward: 10,
            effectiveReward: 10,
            payPotential: 10
        }
    );
    assert.equal(Object.isFrozen(contract), true);
});

test("exige una ruta educativa explícita y catalogada", () => {
    const {
        learningRouteId: omitted,
        ...withoutRoute
    } = learningContractDraft();

    assert.equal(omitted, "programming");
    assertContractError(
        () => createBrokerContract(withoutRoute),
        "BROKER95_LEARNING_ROUTE_ID_INVALID"
    );
    assertContractError(
        () => createBrokerContract(
            learningContractDraft({
                learningRouteId: "unknown"
            })
        ),
        "BROKER95_LEARNING_ROUTE_ID_INVALID"
    );
    assertContractError(
        () => createBrokerContract(
            learningContractDraft({
                learningRouteId: "algorithms"
            })
        ),
        "BROKER95_LEARNING_CONTRACT_ROUTE_NOT_CATALOGED"
    );

    const catalogedAlgorithms =
        createBrokerContract(
            learningContractDraft({
                learningRouteId: "algorithms"
            }),
            {
                catalogs: {
                    algorithms:
                        brokerLearningCatalog
                }
            }
        );

    assert.equal(
        catalogedAlgorithms.learningRouteId,
        "algorithms"
    );
});

test("rechaza recompensas reducidas de formatos educativos obsoletos", () => {
    assertContractError(
        () => createBrokerContract(
            learningContractDraft({
                learningAttempt: 2,
                effectiveReward: 5,
                payPotential: 5
            })
        ),
        "BROKER95_LEARNING_CONTRACT_REWARD_MISMATCH"
    );
});

test("valida la lección, sección, categoría y recompensa autoritativas", () => {
    const wrongCategory =
        brokerCategoryCatalog.requireCategory(
            "FND-DATA"
        );

    for (const [overrides, code] of [
        [
            { lessonId: "lesson-999" },
            "BROKER95_LEARNING_CONTRACT_LESSON_INVALID"
        ],
        [
            { sectionId: "section-002" },
            "BROKER95_LEARNING_CONTRACT_CURRICULUM_MISMATCH"
        ],
        [
            {
                categoryId:
                    wrongCategory.categoryId,
                categoryName:
                    wrongCategory.categoryName,
                familyId:
                    wrongCategory.familyId,
                familyName:
                    wrongCategory.familyName
            },
            "BROKER95_LEARNING_CONTRACT_CURRICULUM_MISMATCH"
        ],
        [
            { baseReward: 12 },
            "BROKER95_LEARNING_CONTRACT_REWARD_MISMATCH"
        ],
        [
            { payPotential: 11 },
            "BROKER95_LEARNING_CONTRACT_PAY_MISMATCH"
        ],
        [
            { learningAttempt: 0 },
            "BROKER95_LEARNING_CONTRACT_ATTEMPT_INVALID"
        ]
    ]) {
        assertContractError(
            () => createBrokerContract(
                learningContractDraft(
                    overrides
                )
            ),
            code
        );
    }
});

test("impone riesgo bajo y la audiencia correcta según el origen", () => {
    assertContractError(
        () => createBrokerContract(
            learningContractDraft({
                risk: BrokerRisk.MEDIUM
            })
        ),
        "BROKER95_LEARNING_CONTRACT_RISK_INVALID"
    );

    const learningOnlyCategory =
        brokerCategoryCatalog.requireCategory(
            "FND-IO"
        );

    assertContractError(
        () => createBrokerContract(
            clientContractDraft({
                categoryId:
                    learningOnlyCategory
                        .categoryId,
                categoryName:
                    learningOnlyCategory
                        .categoryName,
                familyId:
                    learningOnlyCategory
                        .familyId,
                familyName:
                    learningOnlyCategory
                        .familyName
            })
        ),
        "BROKER95_CONTRACT_CATEGORY_AUDIENCE_MISMATCH"
    );
});

test("las categorías curriculares avanzadas conservan riesgo bajo en contratos learning", () => {
    const catalogs = {
        algorithms: {
            requireLesson(lessonId) {
                assert.equal(
                    lessonId,
                    "algorithm-lesson-001"
                );

                return {
                    id: lessonId,
                    sectionId:
                        "algorithm-section-001",
                    categoryId:
                        "FND-ALG-RECUR",
                    familyId: "FND",
                    baseReward: 100
                };
            }
        }
    };
    const category = brokerCategoryCatalog
        .requireCategory("FND-ALG-RECUR");
    const contract = createBrokerContract(
        {
            ...learningContractDraft(),
            learningRouteId: "algorithms",
            lessonId: "algorithm-lesson-001",
            sectionId:
                "algorithm-section-001",
            categoryId: category.categoryId,
            categoryName: category.categoryName,
            familyId: category.familyId,
            familyName: category.familyName,
            risk: BrokerRisk.LOW,
            baseReward: 100,
            effectiveReward: 100,
            payPotential: 100
        },
        { catalogs }
    );

    assert.equal(contract.risk, BrokerRisk.LOW);
    assert.equal(
        contract.categoryId,
        "FND-ALG-RECUR"
    );
});

test("no permite mezclar campos learning en contratos client", () => {
    assertContractError(
        () => createBrokerContract(
            clientContractDraft({
                lessonId: "lesson-001"
            })
        ),
        "BROKER95_CLIENT_CONTRACT_LEARNING_FIELDS_FORBIDDEN"
    );
    assertContractError(
        () => createBrokerContract(
            clientContractDraft({
                learningRouteId: "programming"
            })
        ),
        "BROKER95_CLIENT_CONTRACT_LEARNING_FIELDS_FORBIDDEN"
    );
    assertContractError(
        () => createBrokerContract(
            clientContractDraft({
                contractType: "training"
            })
        ),
        "BROKER95_CONTRACT_TYPE_INVALID"
    );
});

test("conserva inmutable el origen educativo al actualizar el ciclo de vida", () => {
    const contract = createBrokerContract(
        learningContractDraft()
    );
    const active = updateBrokerContract(
        contract,
        {
            contractType:
                BrokerContractType.CLIENT,
            learningRouteId: "algorithms",
            lessonId: "lesson-002",
            sectionId: "section-999",
            state: BrokerContractState.ACTIVE,
            acceptedAt:
                "2026-08-11T10:00:00.000Z"
        }
    );

    assert.equal(
        active.contractType,
        BrokerContractType.LEARNING
    );
    assert.equal(active.lessonId, "lesson-001");
    assert.equal(
        active.sectionId,
        "section-001"
    );
    assert.equal(
        active.learningRouteId,
        "programming"
    );
    assert.equal(
        active.state,
        BrokerContractState.ACTIVE
    );
});

test("hidrata estados actuales con contratos client y learning", () => {
    const state = createBrokerGameState({
        contracts: [clientContractDraft()],
        nextContractId: 2
    });

    assert.equal(
        state.contracts[0].contractType,
        BrokerContractType.CLIENT
    );

    const mixed = addBrokerContract(
        state,
        learningContractDraft()
    );

    assert.deepEqual(
        mixed.contracts.map(
            contract => contract.contractType
        ),
        [
            BrokerContractType.CLIENT,
            BrokerContractType.LEARNING
        ]
    );
    assert.equal(mixed.contracts[1].id, 2);
});

function clientContractDraft(overrides = {}) {
    const category =
        brokerCategoryCatalog.requireCategory(
            "NUM-ARITH"
        );

    return {
        id: 1,
        contractType:
            BrokerContractType.CLIENT,
        title: "Contrato de cliente",
        categoryId: category.categoryId,
        categoryName: category.categoryName,
        familyId: category.familyId,
        familyName: category.familyName,
        risk: BrokerRisk.LOW,
        description:
            "Resolver una operación aritmética.",
        requirements: [
            "Mostrar el resultado solicitado."
        ],
        client: "Northstar",
        payPotential: 200,
        ...overrides
    };
}

function learningContractDraft(overrides = {}) {
    const lesson =
        brokerLearningCatalog.requireLesson(
            "lesson-001"
        );
    const category =
        brokerCategoryCatalog.requireCategory(
            lesson.categoryId
        );

    return {
        id: 1,
        contractType:
            BrokerContractType.LEARNING,
        title: "Primer mensaje",
        categoryId: category.categoryId,
        categoryName: category.categoryName,
        familyId: category.familyId,
        familyName: category.familyName,
        risk: BrokerRisk.LOW,
        description:
            "Mostrar un mensaje sencillo.",
        requirements: [
            "Mostrar el texto indicado."
        ],
        client: "CIPHER",
        payPotential: lesson.baseReward,
        learningRouteId: "programming",
        lessonId: lesson.id,
        sectionId: lesson.sectionId,
        learningAttempt: 1,
        baseReward: lesson.baseReward,
        effectiveReward:
            lesson.baseReward,
        ...overrides
    };
}

function learningIdentity(contract) {
    return {
        learningRouteId:
            contract.learningRouteId,
        lessonId: contract.lessonId,
        sectionId: contract.sectionId,
        learningAttempt:
            contract.learningAttempt,
        baseReward: contract.baseReward,
        effectiveReward:
            contract.effectiveReward,
        payPotential: contract.payPotential
    };
}

function assertContractError(action, code) {
    assert.throws(
        action,
        error => error?.code === code
    );
}
