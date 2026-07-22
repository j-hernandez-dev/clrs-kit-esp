const DEFAULT_DIAGRAM = {
    direction: "TB",
    nodes: [
        {
            "id": "N1",
            "type": "start",
            "label": "Inicio"
        },
        {
            "id": "N2",
            "type": "return",
            "label": "Fin"
        }
    ],
    edges: [
        {
            "source": "N1",
            "target": "N2",
            "label": null
        },
    ],
    subgraphs: []
}

export default DEFAULT_DIAGRAM;