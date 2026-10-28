import assert from "node:assert/strict";
import test from "node:test";

import {
    BrokerLearningContractValidator,
    BrokerLearningRouteId,
    BrokerLearningToolId,
    assertBrokerLearningCurricularContract,
    assertBrokerLearningKnowledgeScope,
    createBrokerLearningCurricularContext,
    createBrokerLearningContractGenerationRequest,
    createInitialBrokerLearningProgress,
    createInitialBrokerLearningRoutesProgress,
    linkBrokerLearningContract,
    replaceBrokerLearningRouteProgress,
    resolveBrokerLearningAttempt,
    getBrokerLearningAllowedKnowledge,
    getBrokerLearningToolRecommendations,
    validateBrokerLearningContractDraft
} from "../src/broker95/index.js";

test("valida contenido learning con el esquema común y fija a CIPHER como cliente", () => {
    const progress =
        createInitialBrokerLearningProgress();
    const request = learningRequest(
        progress,
        "lesson-001"
    );
    const content =
        validateBrokerLearningContractDraft(
            validDraft(),
            {
                lessonId: "lesson-001",
                request
            }
        );

    assert.equal(content.client, "CIPHER");
    assert.deepEqual(content.requirementIds, [
        "REQ-1"
    ]);
    assert.equal(content.testCases.length, 1);
    assert.equal(Object.isFrozen(content), true);
    assert.equal(
        Object.isFrozen(content.requirements),
        true
    );
});

test("rechaza identidad, criterios o paga propuestos por CIPHER", () => {
    const progress =
        createInitialBrokerLearningProgress();
    const request = learningRequest(
        progress,
        "lesson-001"
    );

    for (const injected of [
        { difficulty: "easy" },
        { familyId: "FND" },
        { categoryId: "FND-IO" },
        { payPotential: 250 },
        { evaluationCriteria: ["functionality"] },
        { client: "Otro cliente" },
        { contractType: "learning" }
    ]) {
        assert.throws(
            () =>
                validateBrokerLearningContractDraft(
                    {
                        ...validDraft(),
                        ...injected
                    },
                    {
                        lessonId: "lesson-001",
                        request
                    }
                ),
            error =>
                error.code ===
                "BROKER95_LEARNING_CONTRACT_DRAFT_FIELDS_INVALID"
        );
    }
});

test("liga dificultad, familia, categoría, objetivo y criterios a la lección", () => {
    const progress =
        createInitialBrokerLearningProgress();
    const request = learningRequest(
        progress,
        "lesson-001"
    );
    const mutations = [
        source => ({
            ...source,
            difficulty: "hard"
        }),
        source => ({
            ...source,
            category: {
                ...source.category,
                familyId: "DIV"
            }
        }),
        source => ({
            ...source,
            category: {
                ...source.category,
                categoryId: "FND-DATA"
            }
        }),
        source => ({
            ...source,
            lessonObjective: "Aprender recursión"
        }),
        source => ({
            ...source,
            accumulatedRouteKnowledge: [
                ...source
                    .accumulatedRouteKnowledge,
                "usar arreglos"
            ]
        }),
        source => ({
            ...source,
            optionalTools: [{
                id: "debugger",
                name: "Depurador",
                purpose: "Obligarlo"
            }]
        })
    ];

    for (const mutate of mutations) {
        const forged = {
            ...request,
            input: mutate(request.input)
        };

        assert.throws(
            () =>
                validateBrokerLearningContractDraft(
                    validDraft(),
                    {
                        lessonId: "lesson-001",
                        request: forged
                    }
                ),
            error =>
                error.code ===
                "BROKER95_LEARNING_CONTRACT_REQUEST_INVALID"
        );
    }

    const forgedCriteria = {
        ...request,
        context: {
            ...request.context,
            risk: {
                ...request.context.risk,
                activeCriteria: [
                    "functionality",
                    "design"
                ]
            }
        }
    };

    assert.throws(
        () =>
            validateBrokerLearningContractDraft(
                validDraft(),
                {
                    lessonId: "lesson-001",
                    request: forgedCriteria
                }
            ),
        error =>
            error.code ===
            "BROKER95_LEARNING_CONTRACT_REQUEST_INVALID"
    );
});

test("rechaza requisitos explícitos de conocimientos futuros", () => {
    const progress =
        createInitialBrokerLearningProgress();
    const request = learningRequest(
        progress,
        "lesson-001"
    );
    const futureDrafts = [
        draftWithRequirement(
            "Crear un arreglo con tres valores."
        ),
        draftWithRequirement(
            "Leer un dato introducido por el usuario."
        ),
        draftWithRequirement(
            "Definir una función recursiva."
        ),
        draftWithRequirement(
            "Optimizar la complejidad algorítmica."
        )
    ];

    for (const proposal of futureDrafts) {
        assert.throws(
            () =>
                validateBrokerLearningContractDraft(
                    proposal,
                    {
                        lessonId: "lesson-001",
                        request
                    }
                ),
            error =>
                error.code ===
                    "BROKER95_LEARNING_CONTRACT_FUTURE_KNOWLEDGE" &&
                error.diagnostics.length > 0
        );
    }
});

test("acepta un concepto cuando ya pertenece al conocimiento acumulado", () => {
    const progress = completeUntil(37);
    const request = learningRequest(
        progress,
        "lesson-038"
    );
    const content =
        validateBrokerLearningContractDraft(
            draftWithRequirement(
                "Crear un arreglo con tres valores y mostrarlo."
            ),
            {
                lessonId: "lesson-038",
                request
            }
        );

    assert.equal(
        content.requirements[0],
        "Crear un arreglo con tres valores y mostrarlo."
    );

    assert.throws(
        () =>
            validateBrokerLearningContractDraft(
                draftWithRequirement(
                    "Definir una clase para almacenar el arreglo."
                ),
                {
                    lessonId: "lesson-038",
                    request
                }
            ),
        error =>
            error.code ===
            "BROKER95_LEARNING_CONTRACT_FUTURE_KNOWLEDGE"
    );
});

test("conserva los errores estructurados del contenido y casos de prueba", () => {
    const progress =
        createInitialBrokerLearningProgress();
    const request = learningRequest(
        progress,
        "lesson-001"
    );
    const validator =
        new BrokerLearningContractValidator();

    assert.throws(
        () => validator.validate(
            {
                ...validDraft(),
                requirements: []
            },
            {
                lessonId: "lesson-001",
                request
            }
        ),
        error =>
            error.code ===
            "BROKER95_CONTRACT_DRAFT_REQUIREMENTS_INVALID"
    );

    assert.throws(
        () => validator.validate(
            {
                ...validDraft(),
                testCases: []
            },
            {
                lessonId: "lesson-001",
                request
            }
        ),
        error =>
            error.code ===
            "BROKER95_TEST_CASES_INVALID"
    );
});

test("rechaza cuestionarios teÃ³ricos y contratos ajenos a la lecciÃ³n", () => {
    const { curriculum, knowledge } =
        curricularFixture();

    assertCurricularError(
        () => assertBrokerLearningCurricularContract(
            draftWithRequirement(
                "Explicar el concepto de programa."
            ),
            curriculum,
            knowledge
        ),
        "BROKER95_LEARNING_CONTRACT_CURRICULUM_NOT_PROGRAMMABLE"
    );

    assertCurricularError(
        () => assertBrokerLearningCurricularContract(
            {
                ...validDraft(),
                title: "Promedio del clima",
                description:
                    "Calcula temperaturas de varias ciudades.",
                requirements: [
                    "Calcular el promedio de tres temperaturas."
                ],
                testCases: [{
                    ...validDraft().testCases[0],
                    explanation:
                        "Comprueba el promedio de temperaturas."
                }]
            },
            curriculum,
            knowledge
        ),
        "BROKER95_LEARNING_CONTRACT_CURRICULUM_LESSON_MISMATCH"
    );
});

test("las herramientas son contexto opcional y nunca requisitos evaluables", () => {
    const { curriculum, knowledge } =
        curricularFixture();
    const debuggerCurriculum = {
        ...curriculum,
        optionalTools:
            getBrokerLearningToolRecommendations([
                BrokerLearningToolId.DEBUGGER
            ])
    };

    assert.doesNotThrow(
        () => assertBrokerLearningCurricularContract(
            {
                ...validDraft(),
                description:
                    "Produce una salida bÃ¡sica. Sugerencia opcional: puedes usar el depurador como apoyo."
            },
            debuggerCurriculum,
            knowledge
        )
    );

    assertCurricularError(
        () => assertBrokerLearningCurricularContract(
            {
                ...validDraft(),
                requirements: [
                    "Mostrar el mensaje Hola y usar el depurador."
                ]
            },
            debuggerCurriculum,
            knowledge
        ),
        "BROKER95_LEARNING_CONTRACT_CURRICULUM_TOOL_REQUIRED"
    );

    assertCurricularError(
        () => assertBrokerLearningCurricularContract(
            {
                ...validDraft(),
                description:
                    "Produce una salida bÃ¡sica. Puedes usar el informe de complejidad."
            },
            debuggerCurriculum,
            knowledge
        ),
        "BROKER95_LEARNING_CONTRACT_CURRICULUM_TOOL_NOT_RECOMMENDED"
    );
});

test("limita dificultad, pruebas formales y conceptos avanzados hasta desbloquearlos", () => {
    const { curriculum, knowledge } =
        curricularFixture();

    assertCurricularError(
        () => assertBrokerLearningCurricularContract(
            draftWithRequirement(
                "Mostrar Hola y presentar una demostracion formal de correctitud."
            ),
            curriculum,
            knowledge
        ),
        "BROKER95_LEARNING_CONTRACT_CURRICULUM_FORMAL_PROOF_OUT_OF_SCOPE"
    );

    assertCurricularError(
        () => assertBrokerLearningCurricularContract(
            {
                ...validDraft(),
                requirements: [
                    "Mostrar el mensaje Hola.",
                    "Escribir una segunda salida.",
                    "Mostrar el resultado final.",
                    "Crear otra salida adicional."
                ]
            },
            curriculum,
            knowledge
        ),
        "BROKER95_LEARNING_CONTRACT_CURRICULUM_DIFFICULTY_EXCEEDED"
    );

    assert.doesNotThrow(
        () => assertBrokerLearningKnowledgeScope(
            [{
                field: "requirements[0]",
                text:
                    "Definir una funciÃ³n recursiva."
            }],
            [
                "comprender la recursiÃ³n",
                "definir funciones recursivas"
            ]
        )
    );
});

function learningRequest(progress, lessonId) {
    return createBrokerLearningContractGenerationRequest({
        requestId: `learning:${lessonId}`,
        model: "modelo-local",
        learningProgress:
            toRoutesProgress(progress),
        learningRouteId:
            BrokerLearningRouteId.PROGRAMMING,
        lessonId
    });
}

function curricularFixture() {
    const curriculum =
        createBrokerLearningCurricularContext({
            learningRouteId:
                BrokerLearningRouteId.PROGRAMMING,
            lessonId: "lesson-001"
        });

    return {
        curriculum,
        knowledge:
            getBrokerLearningAllowedKnowledge(
                curriculum
            )
    };
}

function assertCurricularError(operation, code) {
    assert.throws(
        operation,
        error => error.code === code
    );
}

function toRoutesProgress(programmingProgress) {
    return replaceBrokerLearningRouteProgress(
        createInitialBrokerLearningRoutesProgress(),
        BrokerLearningRouteId.PROGRAMMING,
        programmingProgress
    );
}

function completeUntil(count) {
    let progress =
        createInitialBrokerLearningProgress();

    for (let index = 1; index <= count; index += 1) {
        const lessonId = `lesson-${String(index)
            .padStart(3, "0")}`;
        const contractId = index;

        progress = linkBrokerLearningContract(
            progress,
            {
                lessonId,
                contractId,
                createdAt: `created-${index}`
            }
        );
        progress = resolveBrokerLearningAttempt(
            progress,
            {
                lessonId,
                contractId,
                score: 90,
                resolvedAt: `resolved-${index}`
            }
        );
    }

    return progress;
}

function validDraft() {
    return {
        title: "Mensaje de bienvenida",
        description:
            "Produce una salida básica para comprobar la primera instrucción.",
        requirements: [
            "Mostrar el mensaje Hola."
        ],
        testCases: [{
            id: "TC-1",
            kind: "normal",
            requirementIds: ["REQ-1"],
            explanation:
                "Comprueba que el mensaje esperado se muestra.",
            stdin: "",
            expected: "Hola\n",
            comparison: "exact",
            timeoutMs: 1_000
        }]
    };
}

function draftWithRequirement(requirement) {
    return {
        ...validDraft(),
        requirements: [requirement]
    };
}
