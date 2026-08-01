export function createDefaultDiagram() {
    return {
        direction: "TB",
        nodes: [
            {
                id: "N1",
                type: "start",
                label: "Inicio"
            },
            {
                id: "N2",
                type: "return",
                label: "Fin"
            }
        ],
        edges: [
            {
                source: "N1",
                target: "N2",
                label: null
            }
        ],
        subgraphs: []
    };
}

const DEFAULT_DIAGRAM =
    createDefaultDiagram();

export default DEFAULT_DIAGRAM;
