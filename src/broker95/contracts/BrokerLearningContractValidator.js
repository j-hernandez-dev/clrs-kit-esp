import {
    BrokerGameError
} from "../core/BrokerGameError.js";
import {
    BrokerRisk
} from "../core/BrokerRiskRules.js";
import {
    brokerLearningCatalog
} from "../learning/BrokerLearningCatalog.js";
import {
    createBrokerLearningCurricularContext,
    getBrokerLearningAllowedKnowledge
} from "../learning/BrokerLearningCurricularContext.js";
import {
    BrokerLearningRouteId
} from "../learning/BrokerLearningRoutesProgress.js";
import {
    BROKER_LEARNING_CONTRACT_GENERATION_MODE,
    BrokerLearningContractSimplicity
} from "./BrokerContractGenerationRequest.js";
import {
    brokerContractValidator
} from "./BrokerContractValidator.js";
import {
    assertBrokerLearningCurricularContract
} from "./BrokerLearningCurricularContractValidation.js";

const LEARNING_DRAFT_FIELDS = Object.freeze([
    "title",
    "description",
    "requirements",
    "testCases"
]);

const LEARNING_INPUT_FIELDS = Object.freeze([
    "generationMode",
    "learningRouteId",
    "difficulty",
    "category",
    "lessonObjective",
    "expectedPractice",
    "prerequisiteKnowledge",
    "accumulatedRouteKnowledge",
    "forbiddenFutureKnowledge",
    "pedagogicalDifficulty",
    "optionalTools",
    "simplicity",
    "clientPolicy",
    "responseShape",
    "repair"
]);

const CONCEPT_GATES = Object.freeze([
    conceptGate(
        "user-input",
        [
            /recibir entrada del usuario/u,
            /convertir valores/u
        ],
        [
            /\bleer\b/u,
            /entrada del usuario/u,
            /solicitar (?:un |una )?dato/u
        ]
    ),
    conceptGate(
        "variables",
        [/\bvariable/u],
        [
            /\bvariables?\b/u,
            /\breasign/u
        ]
    ),
    conceptGate(
        "data-types",
        [/tipos de datos b[aá]sicos/u],
        [
            /tipos? de datos?/u,
            /tipo (?:num[eé]rico|cadena|l[oó]gico)/u
        ]
    ),
    conceptGate(
        "string-concatenation",
        [/concatenar cadenas/u],
        [/\bconcaten/u]
    ),
    conceptGate(
        "string-inspection",
        [
            /obtener longitud/u,
            /acceder a posiciones/u,
            /transformar cadenas/u
        ],
        [
            /longitud de (?:la )?cadena/u,
            /posici[oó]n de (?:la )?cadena/u,
            /transformar (?:la |una )?cadena/u
        ]
    ),
    conceptGate(
        "escape-sequences",
        [/representar saltos de l[ií]nea/u],
        [
            /secuencias? de escape/u,
            /salto de l[ií]nea/u,
            /\btabulaci[oó]n\b/u
        ]
    ),
    conceptGate(
        "arithmetic",
        [
            /^sumar$/u,
            /^restar$/u,
            /^multiplicar$/u,
            /^dividir$/u
        ],
        [
            /\b(?:sumar|restar|multiplicar|dividir)\b/u,
            /operaci[oó]n aritm[eé]tica/u
        ]
    ),
    conceptGate(
        "comparisons",
        [/comparar valores/u],
        [
            /\bcomparar\b/u,
            /(?:mayor|menor|igual) que/u
        ]
    ),
    conceptGate(
        "compound-conditions",
        [/combinar expresiones l[oó]gicas/u],
        [
            /condici[oó]n compuesta/u,
            /operadores? l[oó]gicos?/u
        ]
    ),
    conceptGate(
        "conditionals",
        [/rama condicional/u],
        [
            /rama condicional/u,
            /\bcondicional(?:es)?\b/u,
            /\bsino si\b/u
        ]
    ),
    conceptGate(
        "while-loops",
        [/repetir mientras/u],
        [
            /ciclo mientras/u,
            /repetir mientras/u,
            /bucle mientras/u
        ]
    ),
    conceptGate(
        "counters",
        [/inicializar un contador/u],
        [/\bcontadores?\b/u]
    ),
    conceptGate(
        "accumulators",
        [/inicializar acumuladores/u],
        [/\bacumuladores?\b/u]
    ),
    conceptGate(
        "for-loops",
        [/variable de iteraci[oó]n/u],
        [
            /ciclo para/u,
            /recorrer un intervalo/u,
            /recorrido (?:ascendente|descendente)/u
        ]
    ),
    conceptGate(
        "nested-loops",
        [/dos niveles de iteraci[oó]n/u],
        [
            /ciclos? anidados?/u,
            /bucle dentro de otro/u
        ]
    ),
    conceptGate(
        "functions",
        [/definir una funci[oó]n/u],
        [
            /(?:crear|definir|declarar) una funci[oó]n/u,
            /cuerpo de (?:la |una )?funci[oó]n/u
        ]
    ),
    conceptGate(
        "parameters",
        [/declarar par[aá]metros/u],
        [
            /\bpar[aá]metros?\b/u,
            /\bargumentos?\b/u
        ]
    ),
    conceptGate(
        "return-values",
        [/devolver un resultado/u],
        [
            /\bretornar\b/u,
            /valor de retorno/u,
            /devolver (?:un |el )?resultado/u
        ]
    ),
    conceptGate(
        "scope",
        [/variables globales y locales/u],
        [
            /\b[aá]mbito\b/u,
            /variables? (?:globales?|locales?)/u
        ]
    ),
    conceptGate(
        "arrays",
        [/qu[eé] es un arreglo/u],
        [
            /\barreglos?\b/u,
            /\barrays?\b/u,
            /\bvectores?\b/u
        ]
    ),
    conceptGate(
        "array-operations",
        [/buscar posiciones/u],
        [
            /buscar (?:un |el )?elemento (?:en|dentro de) (?:un |el )?arreglo/u,
            /comprobar (?:la )?existencia (?:en|dentro de) (?:un |el )?arreglo/u,
            /(?:agregar|eliminar) elementos? (?:de|en|a) (?:un |el )?arreglo/u
        ]
    ),
    conceptGate(
        "matrices",
        [/dos dimensiones/u],
        [
            /\bmatri(?:z|ces)\b/u,
            /arreglo bidimensional/u
        ]
    )
]);

const ALWAYS_FORBIDDEN = Object.freeze([
    forbiddenConcept(
        "classes",
        [
            /(?:crear|definir|declarar) (?:una )?clase/u,
            /programaci[oó]n orientada a objetos/u
        ]
    ),
    forbiddenConcept(
        "recursion",
        [/\brecursi[oó]n\b/u, /\brecursiv/u]
    ),
    forbiddenConcept(
        "files",
        [
            /(?:crear|leer|escribir|abrir) (?:un |el )?archivo/u,
            /sistema de archivos/u
        ]
    ),
    forbiddenConcept(
        "advanced-structures",
        [
            /\b(?:pilas?|colas?|listas? enlazadas?|[aá]rboles?|grafos?)\b/u
        ]
    ),
    forbiddenConcept(
        "sorting",
        [
            /algoritmo de ordenamiento/u,
            /ordenar (?:un |el |los )?arreglo/u
        ]
    ),
    forbiddenConcept(
        "efficiency",
        [
            /\bbig o\b/u,
            /complejidad (?:temporal|espacial|algor[ií]tmica)/u,
            /optimiza(?:r|ci[oó]n)/u
        ]
    )
]);

const ADVANCED_CONCEPT_UNLOCK = Object.freeze({
    classes: Object.freeze([
        /orientada a objetos/u,
        /(?:crear|definir|declarar) clases/u,
        /objetos y clases/u
    ]),
    recursion: Object.freeze([
        /\brecursion\b/u,
        /\brecursiv/u
    ]),
    files: Object.freeze([
        /\barchivos?\b/u
    ]),
    sorting: Object.freeze([
        /\bordenamiento\b/u,
        /\bordenar\b/u
    ]),
    efficiency: Object.freeze([
        /\bbig o\b/u,
        /\bcomplejidad\b/u,
        /\basintotic/u,
        /cost[oa] algoritmic/u
    ])
});

const ADVANCED_STRUCTURE_GATES = Object.freeze([
    conceptGate(
        "stacks",
        [/\bpilas?\b/u],
        [/\bpilas?\b/u]
    ),
    conceptGate(
        "queues",
        [/\bcolas?\b/u],
        [/\bcolas?\b/u]
    ),
    conceptGate(
        "linked-lists",
        [/listas? enlazadas?/u],
        [/listas? enlazadas?/u]
    ),
    conceptGate(
        "trees",
        [/\barboles?\b/u],
        [/\barboles?\b/u]
    ),
    conceptGate(
        "graphs",
        [/\bgrafos?\b/u],
        [/\bgrafos?\b/u]
    )
]);

export class BrokerLearningContractValidator {

    constructor(options = {}) {
        this.catalog = options.catalog ??
            brokerLearningCatalog;
        this.catalogs = Object.freeze({
            ...options.catalogs,
            [BrokerLearningRouteId.PROGRAMMING]:
                options.catalogs?.[
                    BrokerLearningRouteId
                        .PROGRAMMING
                ] ?? this.catalog
        });
        this.categoryCatalog =
            options.categoryCatalog;
        this.contentValidator =
            options.contentValidator ??
            brokerContractValidator;

        if (
            typeof this.catalog.requireLesson !==
                "function" ||
            typeof this.catalog
                .getAccumulatedKnowledge !==
                "function" ||
            typeof this.contentValidator.validate !==
                "function"
        ) {
            throw new TypeError(
                "Invalid BROKER.95 learning contract validator configuration."
            );
        }
    }

    validate(proposal, options = {}) {
        const curriculum =
            createBrokerLearningCurricularContext(
                {
                    learningRouteId:
                        options.request?.input
                            ?.learningRouteId,
                    lessonId: options.lessonId
                },
                {
                    catalogs: this.catalogs,
                    categoryCatalog:
                        this.categoryCatalog
                }
            );
        const knowledge =
            getBrokerLearningAllowedKnowledge(
                curriculum
            );

        validateLearningRequest(
            options.request,
            curriculum
        );

        const source = requireExactDraft(
            proposal
        );
        const content =
            this.contentValidator.validate(
                {
                    ...source,
                    client: "CIPHER"
                },
                { risk: BrokerRisk.LOW }
            );

        validatePedagogicalScope(
            content,
            knowledge
        );
        assertBrokerLearningCurricularContract(
            content,
            curriculum,
            knowledge
        );

        return content;
    }
}

export const brokerLearningContractValidator =
    Object.freeze(
        new BrokerLearningContractValidator()
    );

export function validateBrokerLearningContractDraft(
    proposal,
    options
) {
    return brokerLearningContractValidator.validate(
        proposal,
        options
    );
}

/**
 * Aplica la misma frontera curricular a cualquier texto producido por
 * CIPHER. Las superficies indican qué fragmentos son realmente
 * prescriptivos; por ejemplo, el review sólo entrega recomendaciones y
 * siguientes pasos para evitar rechazar evidencia que describa el código
 * que el estudiante ya escribió.
 */
export function assertBrokerLearningKnowledgeScope(
    surfaces,
    accumulatedKnowledge,
    options = {}
) {
    if (
        !Array.isArray(surfaces) ||
        !Array.isArray(accumulatedKnowledge)
    ) {
        throw new TypeError(
            "Invalid BROKER.95 learning knowledge scope."
        );
    }

    const normalizedKnowledge =
        accumulatedKnowledge.map(
            normalizeForMatching
        );
    const normalizedSurfaces = surfaces.map(
        (surface, index) => {
            if (
                !isRecord(surface) ||
                typeof surface.field !== "string" ||
                typeof surface.text !== "string"
            ) {
                throw new TypeError(
                    "Invalid BROKER.95 learning knowledge surface."
                );
            }

            return {
                field: surface.field ||
                    `surfaces[${index}]`,
                text: normalizeForMatching(
                    surface.text
                )
            };
        }
    );
    const diagnostics = [];

    for (const gate of [
        ...CONCEPT_GATES,
        ...ADVANCED_STRUCTURE_GATES
    ]) {
        const unlocked = gate.unlock.some(
            pattern =>
                normalizedKnowledge.some(
                    item => pattern.test(item)
                )
        );

        if (!unlocked) {
            collectMatches(
                diagnostics,
                normalizedSurfaces,
                gate.id,
                gate.references
            );
        }
    }

    for (const concept of ALWAYS_FORBIDDEN) {
        if (
            concept.id ===
                "advanced-structures"
        ) {
            continue;
        }

        const unlockPatterns =
            ADVANCED_CONCEPT_UNLOCK[
                concept.id
            ] ?? concept.unlock;
        const unlocked = unlockPatterns.some(
            pattern =>
                normalizedKnowledge.some(
                    item => pattern.test(item)
                )
        );

        if (unlocked) {
            continue;
        }

        collectMatches(
            diagnostics,
            normalizedSurfaces,
            concept.id,
            concept.references
        );
    }

    if (diagnostics.length > 0) {
        throw BrokerGameError.invalidRule(
            options.code ??
                "BROKER95_LEARNING_CONTRACT_FUTURE_KNOWLEDGE",
            options.publicMessage ??
                "CIPHER propuso contenido que requiere conocimientos todavía no disponibles.",
            diagnostics.slice(0, 16)
        );
    }
}

function validateLearningRequest(
    request,
    curriculum
) {
    const input = request?.input;
    const context = request?.context;
    const inputKeys = isRecord(input)
        ? Object.keys(input)
        : [];
    const activeCriteria =
        context?.risk?.activeCriteria;

    if (
        !isRecord(request) ||
        !isRecord(input) ||
        !isRecord(context) ||
        inputKeys.some(
            key =>
                !LEARNING_INPUT_FIELDS.includes(
                    key
                )
        ) ||
        input.generationMode !==
            BROKER_LEARNING_CONTRACT_GENERATION_MODE ||
        input.learningRouteId !==
            curriculum.learningRouteId ||
        input.difficulty !== "easy" ||
        !sameJsonValue(
            input.category,
            curriculum.category
        ) ||
        input.lessonObjective !==
            curriculum.lesson.objective ||
        input.expectedPractice !==
            curriculum.lesson.expectedPractice ||
        !sameJsonValue(
            input.prerequisiteKnowledge,
            curriculum.prerequisiteKnowledge
        ) ||
        !sameStringList(
            input.accumulatedRouteKnowledge,
            curriculum
                .accumulatedRouteKnowledge
        ) ||
        !sameStringList(
            input.forbiddenFutureKnowledge,
            curriculum
                .forbiddenFutureKnowledge
        ) ||
        !sameJsonValue(
            input.pedagogicalDifficulty,
            curriculum
                .pedagogicalDifficulty
        ) ||
        !sameJsonValue(
            input.optionalTools,
            curriculum.optionalTools
        ) ||
        input.simplicity !==
            BrokerLearningContractSimplicity
                .VERY_HIGH ||
        input.clientPolicy !== "anonymous" ||
        context?.risk?.value !==
            BrokerRisk.LOW ||
        !sameStringList(
            activeCriteria,
            ["functionality"]
        ) ||
        context?.constraints
            ?.functionalityOnly !== true ||
        context?.constraints
            ?.noFutureKnowledge !== true ||
        context?.constraints
            ?.noPaymentAuthority !== true ||
        context?.pedagogy
            ?.allowedKnowledgeOnly !== true ||
        context?.pedagogy
            ?.learningRouteId !==
            curriculum.learningRouteId ||
        context?.pedagogy
            ?.exerciseHistoryIncluded !== false ||
        !sameJsonValue(
            context?.pedagogy?.toolPolicy,
            curriculum.toolPolicy
        ) ||
        request.stream !== false ||
        !Array.isArray(request.conversation) ||
        request.conversation.length !== 0
    ) {
        invalid(
            "BROKER95_LEARNING_CONTRACT_REQUEST_INVALID",
            [{
                lessonId:
                    curriculum.lesson.lessonId,
                learningRouteId:
                    curriculum.learningRouteId
            }]
        );
    }
}

function sameJsonValue(left, right) {
    try {
        return JSON.stringify(left) ===
            JSON.stringify(right);
    } catch {
        return false;
    }
}

function requireExactDraft(value) {
    if (!isRecord(value)) {
        invalid(
            "BROKER95_LEARNING_CONTRACT_DRAFT_INVALID"
        );
    }

    const keys = Object.keys(value);

    if (
        keys.length !==
            LEARNING_DRAFT_FIELDS.length ||
        keys.some(
            key =>
                !LEARNING_DRAFT_FIELDS.includes(
                    key
                )
        ) ||
        LEARNING_DRAFT_FIELDS.some(
            key => !Object.hasOwn(value, key)
        )
    ) {
        invalid(
            "BROKER95_LEARNING_CONTRACT_DRAFT_FIELDS_INVALID"
        );
    }

    return value;
}

function validatePedagogicalScope(
    content,
    knowledge
) {
    const surfaces = learningTextSurfaces(
        content
    );

    assertBrokerLearningKnowledgeScope(
        surfaces,
        knowledge
    );
}

function learningTextSurfaces(content) {
    return [
        ["title", content.title],
        ["description", content.description],
        ...content.requirements.map(
            (requirement, index) => [
                `requirements[${index}]`,
                requirement
            ]
        ),
        ...content.testCases.map(
            (testCase, index) => [
                `testCases[${index}].explanation`,
                testCase.explanation
            ]
        )
    ].map(([field, text]) => ({
        field,
        text
    }));
}

function collectMatches(
    diagnostics,
    surfaces,
    concept,
    patterns
) {
    for (const surface of surfaces) {
        if (
            patterns.some(
                pattern =>
                    pattern.test(surface.text)
            )
        ) {
            diagnostics.push({
                concept,
                field: surface.field
            });
        }
    }
}

function conceptGate(id, unlock, references) {
    return Object.freeze({
        id,
        unlock: Object.freeze(unlock),
        references: Object.freeze(references)
    });
}

function forbiddenConcept(
    id,
    references,
    unlock = []
) {
    return Object.freeze({
        id,
        references: Object.freeze(references),
        unlock: Object.freeze(unlock)
    });
}

function sameStringList(left, right) {
    return Array.isArray(left) &&
        left.length === right.length &&
        left.every(
            (item, index) =>
                item === right[index]
        );
}

function normalizeForMatching(value) {
    return value.normalize("NFKC")
        .toLocaleLowerCase("es-MX")
        .normalize("NFD")
        .replace(/\p{M}+/gu, "")
        .replace(/\s+/gu, " ")
        .trim();
}

function isRecord(value) {
    return value != null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        (
            Object.getPrototypeOf(value) ===
                Object.prototype ||
            Object.getPrototypeOf(value) ===
                null
        );
}

function invalid(code, diagnostics = []) {
    throw BrokerGameError.invalidRule(
        code,
        "CIPHER devolvió un contrato de aprendizaje que no pudo validarse.",
        diagnostics
    );
}
