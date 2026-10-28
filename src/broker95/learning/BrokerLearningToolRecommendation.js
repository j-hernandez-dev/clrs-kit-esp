import {
    BrokerGameError
} from "../core/BrokerGameError.js";

export const BrokerLearningToolId =
    Object.freeze({
        FLOWCHART: "flowchart",
        EXECUTION_TRACE: "execution-trace",
        DEBUGGER: "debugger",
        CALL_STACK: "call-stack",
        ALGORITHMIC_COST:
            "algorithmic-cost",
        COMPLEXITY_REPORT:
            "complexity-report",
        CODE_DIAGRAM_NAVIGATION:
            "code-diagram-navigation"
    });

export const BROKER_LEARNING_TOOL_IDS =
    Object.freeze(
        Object.values(BrokerLearningToolId)
    );

const TOOL_BY_ID = new Map([
    tool(
        BrokerLearningToolId.FLOWCHART,
        "Visualizador de diagramas de flujo",
        "Observar la estructura y las decisiones del algoritmo."
    ),
    tool(
        BrokerLearningToolId.EXECUTION_TRACE,
        "Visualización de la ejecución",
        "Recorrer visualmente los pasos ejecutados por el programa."
    ),
    tool(
        BrokerLearningToolId.DEBUGGER,
        "Depurador",
        "Inspeccionar paso a paso la ubicación y las variables del programa."
    ),
    tool(
        BrokerLearningToolId.CALL_STACK,
        "Pila de llamadas",
        "Observar llamadas, retornos y marcos de funciones durante la depuración."
    ),
    tool(
        BrokerLearningToolId.ALGORITHMIC_COST,
        "Visualizador de costo algorítmico",
        "Contrastar el conteo simbólico de operaciones con el análisis propio."
    ),
    tool(
        BrokerLearningToolId.COMPLEXITY_REPORT,
        "Informe de complejidad algorítmica",
        "Comparar una estimación propia con el informe asintótico de CLRS."
    ),
    tool(
        BrokerLearningToolId
            .CODE_DIAGRAM_NAVIGATION,
        "Navegación entre código y diagrama",
        "Relacionar instrucciones del código con sus nodos del diagrama."
    )
]);

const TOOL_REFERENCE_PATTERNS = new Map([
    [BrokerLearningToolId.FLOWCHART, Object.freeze([
        /\bdiagrama(?:s)? de flujo\b/u,
        /\bdiagramador\b/u,
        /\bvisualizador de diagramas\b/u
    ])],
    [BrokerLearningToolId.EXECUTION_TRACE, Object.freeze([
        /\bvisualizaci[oó]n (?:paso a paso )?de (?:la )?ejecuci[oó]n\b/u,
        /\btraza de ejecuci[oó]n\b/u,
        /\brecorrido de ejecuci[oó]n\b/u
    ])],
    [BrokerLearningToolId.DEBUGGER, Object.freeze([
        /\bdepurador\b/u,
        /\bdepuraci[oó]n\b/u,
        /\bstep (?:into|over|out)\b/u,
        /\bbreakpoints?\b/u,
        /\bpuntos? de interrupci[oó]n\b/u
    ])],
    [BrokerLearningToolId.CALL_STACK, Object.freeze([
        /\bpila de llamadas\b/u,
        /\bmarcos? de (?:la )?pila\b/u
    ])],
    [BrokerLearningToolId.ALGORITHMIC_COST, Object.freeze([
        /\bvisualizador de cost[oa] algor[ií]tmic[oa]\b/u,
        /\bmostrar cost[oa]\b/u,
        /\bcost[oa] algor[ií]tmic[oa] inline\b/u
    ])],
    [BrokerLearningToolId.COMPLEXITY_REPORT, Object.freeze([
        /\binforme de complejidad\b/u,
        /\breporte de complejidad\b/u,
        /\ban[aá]lisis de complejidad del visor\b/u
    ])],
    [BrokerLearningToolId.CODE_DIAGRAM_NAVIGATION, Object.freeze([
        /\bnavegaci[oó]n entre c[oó]digo y diagrama\b/u,
        /\bsincronizaci[oó]n entre (?:el )?editor y (?:el )?diagrama\b/u
    ])]
]);

export function createBrokerLearningToolIds(
    source = []
) {
    if (
        !Array.isArray(source) ||
        source.length >
            BROKER_LEARNING_TOOL_IDS.length ||
        new Set(source).size !== source.length ||
        source.some(
            value =>
                typeof value !== "string" ||
                !BROKER_LEARNING_TOOL_IDS
                    .includes(value)
        )
    ) {
        invalid(
            "BROKER95_LEARNING_TOOLS_INVALID"
        );
    }

    return Object.freeze([...source]);
}

export function getBrokerLearningToolRecommendations(
    source = []
) {
    const toolIds =
        createBrokerLearningToolIds(source);

    return Object.freeze(
        toolIds.map(toolId =>
            TOOL_BY_ID.get(toolId)
        )
    );
}

export function findBrokerLearningToolReferences(
    source
) {
    if (
        typeof source !== "string" ||
        source.includes("\u0000")
    ) {
        throw new TypeError(
            "Invalid BROKER.95 learning tool reference text."
        );
    }

    const text = source
        .normalize("NFKC")
        .toLocaleLowerCase("es-MX");

    return Object.freeze(
        [...TOOL_REFERENCE_PATTERNS]
            .filter(([, patterns]) =>
                patterns.some(pattern =>
                    pattern.test(text)
                )
            )
            .map(([toolId]) => toolId)
    );
}

function tool(id, name, purpose) {
    const descriptor = Object.freeze({
        id,
        name,
        purpose
    });

    return [id, descriptor];
}

function invalid(code) {
    throw BrokerGameError.invalidRule(
        code,
        "La recomendación de herramientas de aprendizaje no es válida.",
        []
    );
}
