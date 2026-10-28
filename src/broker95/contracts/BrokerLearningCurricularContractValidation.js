import {
    BrokerGameError
} from "../core/BrokerGameError.js";
import {
    findBrokerLearningToolReferences
} from "../learning/BrokerLearningToolRecommendation.js";

const PROGRAMMABLE_ACTION = Object.freeze([
    /\bprogram(?:ar|e|e el|e la)\b/u,
    /\bimplement(?:a|ar|e)\b/u,
    /\bdefin(?:e|ir)\b/u,
    /\b(?:crea|crear|construye|construir|diseña|diseñar|desarrolla|desarrollar|codifica|codificar)\b/u,
    /\b(?:lee|leer|escribe|escribir|muestra|mostrar|retorna|retornar)\b/u,
    /\b(?:calcula|calcular|determina|determinar|genera|generar|transforma|transformar)\b/u,
    /\b(?:recorre|recorrer|busca|buscar|ordena|ordenar|selecciona|seleccionar)\b/u,
    /\b(?:cuenta|contar|acumula|acumular|intercambia|intercambiar|inserta|insertar|elimina|eliminar)\b/u,
    /\b(?:entrada|salida|resultado)\b.{0,50}\b(?:debe|mostrar|contener|ser|producir)\b/u
]);

const THEORETICAL_ACTION = Object.freeze([
    /^\s*(?:explica|explicar|describe|describir|define|definir|enumera|enumerar|justifica|justificar|investiga|investigar|redacta|redactar|responde|responder)\b/u,
    /\b(?:ensayo|reporte te[oó]rico|respuesta te[oó]rica|sin escribir c[oó]digo)\b/u
]);

const OPTIONAL_GUIDANCE = Object.freeze([
    /\bopcional(?:mente)?\b/u,
    /\bpuedes\b/u,
    /\bsi (?:lo )?deseas\b/u,
    /\bsi (?:lo )?prefieres\b/u,
    /\bcomo apoyo\b/u,
    /\bsugerencia\b/u,
    /\bse recomienda\b/u
]);

const FORMAL_PROOF = Object.freeze([
    /\bdemostraci[oó]n formal\b/u,
    /\bdemuestra formalmente\b/u,
    /\bprueba formal(?:mente)?\b/u,
    /\binducci[oó]n matem[aá]tica formal\b/u,
    /\bformaliza (?:la )?correctitud\b/u
]);

const PERMANENTLY_OUT_OF_SCOPE = Object.freeze([
    /\bnp[\s-]?complet(?:o|a|itud)\b/u,
    /\breducci[oó]n polinomial formal\b/u,
    /\bteorema de cook\b/u
]);

const ALIGNMENT_STOP_WORDS = new Set([
    "algoritmo", "aplicar", "codigo", "comprender",
    "construir", "crear", "debe", "ejecutar",
    "ejercicio", "implementar",
    "programa", "problema", "realizar", "reconocer",
    "representar", "resolver", "resultado", "solucion",
    "utilizar", "valor", "valores"
]);

const FUTURE_STOP_WORDS = new Set([
    ...ALIGNMENT_STOP_WORDS,
    "analizar", "aprender", "combinar", "distinguir",
    "entender", "introducir", "manejar", "obtener",
    "producir", "relacionar", "trabajar", "para",
    "como", "desde", "hasta", "entre", "forma",
    "manera", "mediante", "puede", "permitir"
]);

export function assertBrokerLearningCurricularContract(
    content,
    curriculum,
    allowedKnowledge
) {
    requireInputs(
        content,
        curriculum,
        allowedKnowledge
    );

    const surfaces = learningSurfaces(content);

    assertProgrammaticContract(content);
    assertLessonAlignment(
        surfaces,
        curriculum
    );
    assertToolPolicy(
        surfaces,
        curriculum
    );
    assertFormalScope(
        surfaces,
        allowedKnowledge
    );
    assertFutureKnowledge(
        surfaces,
        curriculum
            .forbiddenFutureKnowledge
    );
    assertPedagogicalDifficulty(
        content,
        curriculum
            .pedagogicalDifficulty
    );

    return content;
}

function assertProgrammaticContract(content) {
    const requirementDiagnostics = [];
    let programmable = false;

    content.requirements.forEach(
        (requirement, index) => {
            const text = normalize(requirement);
            const hasProgrammaticAction =
                PROGRAMMABLE_ACTION.some(pattern =>
                    pattern.test(text)
                );
            const theoretical =
                THEORETICAL_ACTION.some(pattern =>
                    pattern.test(text)
                );

            programmable ||= hasProgrammaticAction;

            if (
                theoretical &&
                !hasProgrammaticAction
            ) {
                requirementDiagnostics.push({
                    field:
                        `requirements[${index}]`,
                    reason: "theoretical-only"
                });
            }
        }
    );

    if (
        !programmable ||
        requirementDiagnostics.length > 0
    ) {
        curricularInvalid(
            "BROKER95_LEARNING_CONTRACT_CURRICULUM_NOT_PROGRAMMABLE",
            [
                ...requirementDiagnostics,
                ...(!programmable
                    ? [{
                        field: "requirements",
                        reason:
                            "missing-clrs-practice"
                    }]
                    : [])
            ]
        );
    }
}

function assertLessonAlignment(
    surfaces,
    curriculum
) {
    const anchors = significantTokens(
        [
            curriculum.lesson.title,
            curriculum.lesson.objective,
            curriculum.lesson.expectedPractice
        ].join(" "),
        ALIGNMENT_STOP_WORDS
    );
    const contentTokens = new Set(
        significantTokens(
            surfaces.map(surface =>
                surface.text
            ).join(" "),
            new Set()
        )
    );

    if (
        anchors.length > 0 &&
        !anchors.some(anchor =>
            contentTokens.has(anchor)
        )
    ) {
        curricularInvalid(
            "BROKER95_LEARNING_CONTRACT_CURRICULUM_LESSON_MISMATCH",
            [{
                learningRouteId:
                    curriculum.learningRouteId,
                lessonId:
                    curriculum.lesson.lessonId
            }]
        );
    }
}

function assertToolPolicy(surfaces, curriculum) {
    const recommended = new Set(
        curriculum.optionalTools.map(tool =>
            tool.id
        )
    );

    for (const surface of surfaces) {
        const referenced =
            findBrokerLearningToolReferences(
                surface.text
            );

        if (referenced.length === 0) {
            continue;
        }

        const notRecommended = referenced.filter(
            toolId => !recommended.has(toolId)
        );

        if (notRecommended.length > 0) {
            curricularInvalid(
                "BROKER95_LEARNING_CONTRACT_CURRICULUM_TOOL_NOT_RECOMMENDED",
                [{
                    field: surface.field,
                    toolIds: notRecommended
                }]
            );
        }

        if (
            surface.kind !== "description" ||
            !OPTIONAL_GUIDANCE.some(pattern =>
                pattern.test(
                    normalize(surface.text)
                )
            )
        ) {
            curricularInvalid(
                "BROKER95_LEARNING_CONTRACT_CURRICULUM_TOOL_REQUIRED",
                [{
                    field: surface.field,
                    toolIds: referenced
                }]
            );
        }
    }
}

function assertFormalScope(
    surfaces,
    allowedKnowledge
) {
    const allowed = normalize(
        allowedKnowledge.join(" ")
    );
    const formalKnowledgeUnlocked =
        FORMAL_PROOF.some(pattern =>
            pattern.test(allowed)
        );

    for (const surface of surfaces) {
        const text = normalize(surface.text);

        if (
            PERMANENTLY_OUT_OF_SCOPE.some(
                pattern => pattern.test(text)
            ) ||
            (
                !formalKnowledgeUnlocked &&
                FORMAL_PROOF.some(pattern =>
                    pattern.test(text)
                )
            )
        ) {
            curricularInvalid(
                "BROKER95_LEARNING_CONTRACT_CURRICULUM_FORMAL_PROOF_OUT_OF_SCOPE",
                [{ field: surface.field }]
            );
        }
    }
}

function assertFutureKnowledge(
    surfaces,
    futureKnowledge
) {
    const surfaceTokens = surfaces
        .filter(surface =>
            ["requirement", "test"]
                .includes(surface.kind)
        )
        .map(surface =>
            Object.freeze({
                field: surface.field,
                tokens: new Set(
                    significantTokens(
                        surface.text,
                        new Set()
                    )
                )
            })
        );
    const diagnostics = [];

    futureKnowledge.forEach(
        (knowledge, index) => {
            const anchors = significantTokens(
                knowledge,
                FUTURE_STOP_WORDS
            );

            if (anchors.length === 0) {
                return;
            }

            for (const surface of surfaceTokens) {
                const matches = anchors.filter(
                    anchor =>
                        surface.tokens.has(anchor)
                );
                const confident = anchors.length === 1
                    ? anchors[0].length >= 8 &&
                        matches.length === 1
                    : matches.length >=
                        Math.min(3, anchors.length);

                if (confident) {
                    diagnostics.push({
                        concept:
                            `future-${index + 1}`,
                        field: surface.field
                    });
                }
            }
        }
    );

    if (diagnostics.length > 0) {
        curricularInvalid(
            "BROKER95_LEARNING_CONTRACT_CURRICULUM_FUTURE_KNOWLEDGE",
            diagnostics.slice(0, 16)
        );
    }
}

function assertPedagogicalDifficulty(
    content,
    difficulty
) {
    if (
        content.requirements.length >
            difficulty.maximumRequirements ||
        content.testCases.length >
            difficulty.maximumTestCases
    ) {
        curricularInvalid(
            "BROKER95_LEARNING_CONTRACT_CURRICULUM_DIFFICULTY_EXCEEDED",
            [{
                requirements:
                    content.requirements.length,
                maximumRequirements:
                    difficulty.maximumRequirements,
                testCases:
                    content.testCases.length,
                maximumTestCases:
                    difficulty.maximumTestCases,
                stage: difficulty.stage
            }]
        );
    }
}

function learningSurfaces(content) {
    return Object.freeze([
        Object.freeze({
            kind: "title",
            field: "title",
            text: content.title
        }),
        Object.freeze({
            kind: "description",
            field: "description",
            text: content.description
        }),
        ...content.requirements.map(
            (text, index) => Object.freeze({
                kind: "requirement",
                field: `requirements[${index}]`,
                text
            })
        ),
        ...content.testCases.map(
            (testCase, index) =>
                Object.freeze({
                    kind: "test",
                    field:
                        `testCases[${index}].explanation`,
                    text: testCase.explanation
                })
        )
    ]);
}

function significantTokens(source, stopWords) {
    return [...new Set(
        normalize(source)
            .split(/[^a-z0-9]+/u)
            .filter(token =>
                token.length >= 4 &&
                !stopWords.has(token)
            )
            .map(stem)
            .filter(token =>
                token.length >= 4 &&
                !stopWords.has(token)
            )
    )];
}

function stem(token) {
    if (token.length > 6 && token.endsWith("es")) {
        return token.slice(0, -2);
    }

    if (token.length > 5 && token.endsWith("s")) {
        return token.slice(0, -1);
    }

    return token;
}

function normalize(value) {
    return value.normalize("NFKC")
        .toLocaleLowerCase("es-MX")
        .normalize("NFD")
        .replace(/\p{M}+/gu, "")
        .replace(/\s+/gu, " ")
        .trim();
}

function requireInputs(
    content,
    curriculum,
    allowedKnowledge
) {
    if (
        content == null ||
        !Array.isArray(content.requirements) ||
        !Array.isArray(content.testCases) ||
        typeof content.title !== "string" ||
        typeof content.description !== "string" ||
        curriculum == null ||
        curriculum.lesson == null ||
        !Array.isArray(curriculum.optionalTools) ||
        !Array.isArray(
            curriculum.forbiddenFutureKnowledge
        ) ||
        curriculum.pedagogicalDifficulty == null ||
        !Array.isArray(allowedKnowledge)
    ) {
        throw new TypeError(
            "Invalid BROKER.95 curricular contract validation input."
        );
    }
}

function curricularInvalid(code, diagnostics) {
    throw BrokerGameError.invalidRule(
        code,
        "CIPHER propuso un contrato fuera del alcance curricular de la lección.",
        diagnostics
    );
}
