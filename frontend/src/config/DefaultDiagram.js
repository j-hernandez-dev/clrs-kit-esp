import {
    attachDiagramIdentity,
    DIAGRAM_EDGE_RELATIONS,
    DIAGRAM_ENTITY_TYPES,
    DIAGRAM_NODE_ROLES
} from "../visitor/DiagramEditableIdentity.js";

export function createDefaultDiagram() {
    const start = {
        id: "N1",
        type: "start",
        label: "Inicio"
    };
    const end = {
        id: "N2",
        type: "return",
        label: "Fin"
    };
    const entryEdge = {
        source: "N1",
        target: "N2",
        label: null
    };

    attachDiagramIdentity(start, {
        schemaVersion: 1,
        entityType: DIAGRAM_ENTITY_TYPES.NODE,
        id: "node:__main__/start",
        modelId: "N1",
        editable: false,
        role: DIAGRAM_NODE_ROLES.GLOBAL_START
    });
    attachDiagramIdentity(end, {
        schemaVersion: 1,
        entityType: DIAGRAM_ENTITY_TYPES.NODE,
        id: "node:__main__/end",
        modelId: "N2",
        editable: false,
        role: DIAGRAM_NODE_ROLES.GLOBAL_END
    });

    attachDiagramIdentity(
        entryEdge,
        {
            schemaVersion: 1,
            entityType:
                DIAGRAM_ENTITY_TYPES.EDGE,
            id: "edge:E1",
            modelId: "E1",
            editable: true,
            relation:
                DIAGRAM_EDGE_RELATIONS.ENTRY,
            sourceNodeId: "N1",
            targetNodeId: "N2",
            insertion: {
                scopeId: "__main__",
                containerId: "__main__/body",
                branch: "body",
                index: 0,
                position: "end"
            }
        }
    );

    return {
        direction: "TB",
        nodes: [
            start,
            end
        ],
        edges: [entryEdge],
        subgraphs: []
    };
}

const DEFAULT_DIAGRAM =
    createDefaultDiagram();

export default DEFAULT_DIAGRAM;
