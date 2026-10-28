const TOOL_DESCRIPTORS = Object.freeze({
    flowchart: Object.freeze({
        name: "Diagramador de flujo",
        purpose:
            "Observa decisiones, ciclos y estructura del algoritmo."
    }),
    "execution-trace": Object.freeze({
        name: "Visualización de ejecución",
        purpose:
            "Recorre los pasos ejecutados y relaciónalos con el código."
    }),
    debugger: Object.freeze({
        name: "Depurador",
        purpose:
            "Inspecciona variables y flujo paso a paso."
    }),
    "call-stack": Object.freeze({
        name: "Pila de llamadas",
        purpose:
            "Observa llamadas, retornos y marcos recursivos."
    }),
    "algorithmic-cost": Object.freeze({
        name: "Costo algorítmico",
        purpose:
            "Contrasta tu conteo manual con el costo simbólico."
    }),
    "complexity-report": Object.freeze({
        name: "Informe de complejidad",
        purpose:
            "Compara tu análisis previo con el reporte asintótico."
    }),
    "code-diagram-navigation": Object.freeze({
        name: "Navegación código-diagrama",
        purpose:
            "Relaciona instrucciones del editor con nodos del diagrama."
    })
});

export function getBroker95LearningToolDescriptor(
    toolId
) {
    return TOOL_DESCRIPTORS[toolId] ?? null;
}
