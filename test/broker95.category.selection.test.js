import test from "node:test";
import assert from "node:assert/strict";

import {
    BROKER_CATEGORY_COUNT,
    BROKER_CLIENT_CATEGORY_COUNT,
    BROKER_FAMILY_COUNT,
    BROKER_LEARNING_CATEGORY_COUNT,
    BrokerCategorySelector,
    BrokerCategoryAudience,
    BrokerRisk,
    brokerCategoryCatalog,
    createBrokerContract,
    createBrokerGameState,
    getBrokerExerciseDifficultyProfile
} from "../src/broker95/index.js";

const EXPECTED_FAMILY_COUNTS = Object.freeze({
    FND: 12,
    NUM: 10,
    CTRL: 3,
    GEOFORM: 2,
    ARRAY: 4,
    MATRIX: 4,
    STRING: 6,
    SEARCH: 2,
    SORT: 2,
    SELECT: 3,
    LINEAR: 3,
    HASH: 2,
    TREE: 5,
    MATHD: 6,
    NUMERIC: 4,
    LINALG: 2,
    DP: 4,
    OPT: 5,
    CSP: 1,
    "GRAPH-F": 4,
    "GRAPH-O": 3,
    "GRAPH-S": 4,
    "GRAPH-N": 2,
    GEO: 5,
    CRYPTO: 3,
    COMP: 5,
    DATA: 6,
    RAND: 4,
    STREAM: 5,
    SYS: 2,
    ADAPT: 3,
    ML: 4,
    SIGNAL: 5,
    BIO: 3,
    STATE: 3,
    GAME: 2,
    NETWORK: 2,
    VOTE: 3,
    FIN: 3
});

test("publica 139 categorías de cliente y 12 categorías educativas", () => {
    assert.equal(
        brokerCategoryCatalog.size,
        BROKER_CATEGORY_COUNT
    );
    assert.equal(BROKER_CATEGORY_COUNT, 151);
    assert.equal(
        brokerCategoryCatalog.families.length,
        BROKER_FAMILY_COUNT
    );
    assert.equal(BROKER_FAMILY_COUNT, 39);
    assert.deepEqual(
        Object.fromEntries(
            brokerCategoryCatalog.families.map(
                family => [
                    family.familyId,
                    family.categoryCount
                ]
            )
        ),
        EXPECTED_FAMILY_COUNTS
    );
    assert.equal(
        brokerCategoryCatalog.listCategories({
            audience: BrokerCategoryAudience.CLIENT
        }).length,
        BROKER_CLIENT_CATEGORY_COUNT
    );
    assert.equal(BROKER_CLIENT_CATEGORY_COUNT, 139);
    assert.equal(
        brokerCategoryCatalog.listCategories({
            audience: BrokerCategoryAudience.LEARNING
        }).length,
        BROKER_LEARNING_CATEGORY_COUNT
    );
    assert.equal(BROKER_LEARNING_CATEGORY_COUNT, 12);
    assert.equal(
        brokerCategoryCatalog.categories.at(-1).categoryId,
        "FIN-ARB"
    );
    assert.equal(
        brokerCategoryCatalog.categories.at(-1).ordinal,
        151
    );
    assert.equal(
        Object.isFrozen(brokerCategoryCatalog.categories),
        true
    );
});

test("reserva toda la familia FND exclusivamente para aprendizaje", () => {
    assert.equal(
        brokerCategoryCatalog.listCategories({
            familyId: "FND",
            audience: BrokerCategoryAudience.CLIENT
        }).length,
        0
    );
    assert.equal(
        brokerCategoryCatalog.listCategories({
            familyId: "FND",
            audience: BrokerCategoryAudience.LEARNING
        }).length,
        12
    );
});

test("distingue dificultad base y compatibilidad acumulativa de cliente", () => {
    const baseCounts = Object.fromEntries(
        Object.values(BrokerRisk).map(risk => [
            risk,
            brokerCategoryCatalog.listCategories({
                baseRisk: risk,
                audience: BrokerCategoryAudience.CLIENT
            }).length
        ])
    );
    const compatibleCounts = Object.fromEntries(
        Object.values(BrokerRisk).map(risk => [
            risk,
            brokerCategoryCatalog.listCategories({
                risk,
                audience: BrokerCategoryAudience.CLIENT
            }).length
        ])
    );

    assert.deepEqual(baseCounts, {
        low: 10,
        medium: 29,
        high: 40,
        extreme: 60
    });
    assert.deepEqual(compatibleCounts, {
        low: 10,
        medium: 39,
        high: 79,
        extreme: 139
    });
    assert.equal(
        brokerCategoryCatalog.supportsRisk(
            "RAND-ALG",
            BrokerRisk.LOW
        ),
        false
    );
    assert.equal(
        brokerCategoryCatalog.supportsRisk(
            "RAND-ALG",
            BrokerRisk.HIGH
        ),
        true
    );
});

test("define fronteras pedagógicas explícitas para los cuatro niveles", () => {
    const easy = getBrokerExerciseDifficultyProfile(BrokerRisk.LOW);
    const intermediate = getBrokerExerciseDifficultyProfile(BrokerRisk.MEDIUM);
    const hard = getBrokerExerciseDifficultyProfile(BrokerRisk.HIGH);
    const extreme = getBrokerExerciseDifficultyProfile(BrokerRisk.EXTREME);

    assert.equal(easy.difficultyId, "easy");
    assert.equal(easy.programShape.collections, "forbidden");
    assert.match(
        easy.forbiddenTechniques.join(" "),
        /búsqueda u ordenamiento/u
    );
    assert.equal(intermediate.programShape.collections, "allowed");
    assert.match(
        intermediate.typicalTechniques.join(" "),
        /burbuja/u
    );
    assert.equal(hard.programShape.recursion, "allowed");
    assert.match(extreme.typicalTechniques.join(" "), /grafos/u);
    assert.equal(Object.isFrozen(easy), true);
    assert.equal(Object.isFrozen(easy.typicalTechniques), true);
});

test("expone alcance y ejemplos representativos como datos inmutables", () => {
    const graph = brokerCategoryCatalog.requireFamily("GRAPH-F");
    const sorting = brokerCategoryCatalog.requireCategory("SORT-ELEM");

    assert.equal(graph.familyName, "Fundamentos de grafos");
    assert.equal(graph.categoryCount, 4);
    assert.equal(sorting.categoryName, "Ordenamiento elemental");
    assert.match(sorting.scope, /ciclos anidados/u);
    assert.match(sorting.representativeExamples, /Bubble Sort/u);
    assert.equal(Object.isFrozen(sorting.compatibleRisks), true);
});

test("un contrato debe usar la identidad canónica de su categoría", () => {
    assert.throws(
        () => createBrokerContract({
            id: 1,
            ...contractDraft({ categoryName: "Nombre inventado" })
        }),
        error => error.code === "BROKER95_CONTRACT_CATEGORY_MISMATCH"
    );
    assert.throws(
        () => createBrokerContract({
            id: 1,
            ...contractDraft({
                categoryId: "RAND-ALG",
                categoryName: "Algoritmos aleatorizados",
                familyId: "RAND",
                familyName: "Aleatorización y aproximación"
            })
        }),
        error =>
            error.code ===
            "BROKER95_CONTRACT_CATEGORY_RISK_MISMATCH"
    );
});

test("una misma entrada aleatoria produce la misma selección", () => {
    const first = new BrokerCategorySelector({
        random: () => 0
    }).select({ risk: BrokerRisk.LOW });
    const repeated = new BrokerCategorySelector({
        random: () => 0
    }).select({ risk: BrokerRisk.LOW });
    const last = new BrokerCategorySelector({
        random: () => 0.999999
    }).select({ risk: BrokerRisk.LOW });

    assert.equal(first.category.categoryId, "NUM-ARITH");
    assert.equal(
        repeated.category.categoryId,
        first.category.categoryId
    );
    assert.equal(last.category.categoryId, "GEOFORM-MEASURE");
    assert.equal(first.candidateCount, 10);
});

test("reduce el peso de categorías frecuentes, completadas y recientes", () => {
    const selector = new BrokerCategorySelector({
        random: () => 0.5,
        recentWindow: 2
    });
    const candidates = selector.getCandidates({
        risk: BrokerRisk.LOW,
        history: {
            "NUM-ARITH": historyEntry({
                categoryId: "NUM-ARITH",
                generatedCount: 8,
                acceptedCount: 4,
                completedCount: 3,
                lastGenerated: 20,
                lastCompleted: 18
            }),
            "NUM-CONV": historyEntry({
                categoryId: "NUM-CONV",
                generatedCount: 1,
                lastGenerated: 10
            })
        }
    });
    const arithmetic = findCandidate(candidates, "NUM-ARITH");
    const conversion = findCandidate(candidates, "NUM-CONV");
    const rule = findCandidate(candidates, "CTRL-RULE");

    assert.equal(arithmetic.recentFactor, 1 / 3);
    assert.equal(conversion.recentFactor, 2 / 3);
    assert.equal(rule.recentFactor, 1);
    assert.ok(arithmetic.practiceFactor < conversion.practiceFactor);
    assert.ok(arithmetic.weight < conversion.weight);
    assert.ok(conversion.weight < rule.weight);
});

test("permite excluir categorías sin alterar el catálogo", () => {
    const selection = new BrokerCategorySelector({
        random: () => 0
    }).select({
        risk: BrokerRisk.LOW,
        excludeCategoryIds: ["NUM-ARITH", "NUM-CONV"]
    });

    assert.equal(selection.category.categoryId, "NUM-DIGIT");
    assert.equal(selection.candidateCount, 8);
    assert.equal(brokerCategoryCatalog.size, 151);
});

test("rechaza catálogo, azar e historial desconocidos", () => {
    assert.throws(
        () => brokerCategoryCatalog.requireCategory("NO-EXISTE"),
        error => error.code === "BROKER95_CATEGORY_NOT_FOUND"
    );
    assert.throws(
        () => new BrokerCategorySelector({ random: () => 1 }).select({
            risk: BrokerRisk.LOW
        }),
        error => error.code === "BROKER95_CATEGORY_RANDOM_INVALID"
    );
    assert.throws(
        () => createBrokerGameState({
            categoryHistory: {
                "NO-EXISTE": {
                    categoryId: "NO-EXISTE",
                    familyId: "NO"
                }
            }
        }),
        error => error.code === "BROKER95_CATEGORY_NOT_FOUND"
    );
});

function findCandidate(candidates, categoryId) {
    return candidates.find(candidate =>
        candidate.category.categoryId === categoryId
    );
}

function historyEntry(overrides = {}) {
    return {
        categoryId: "NUM-ARITH",
        familyId: "NUM",
        generatedCount: 0,
        acceptedCount: 0,
        completedCount: 0,
        failedCount: 0,
        lastGenerated: null,
        lastCompleted: null,
        ...overrides
    };
}

function contractDraft(overrides = {}) {
    return {
        title: "Contrato de catálogo",
        categoryId: "NUM-ARITH",
        categoryName: "Aritmética",
        familyId: "NUM",
        familyName: "Procesamiento numérico",
        risk: BrokerRisk.LOW,
        description: "Resolver una tarea algorítmica.",
        requirements: ["Leer la entrada.", "Mostrar la respuesta."],
        client: "Northstar",
        payPotential: 200,
        ...overrides
    };
}
