import {
    getDiagramNodes
} from "../interaction/DiagramSelection.js";

export const ALL_DIAGRAM_SCOPE = "__all__";

export function getDiagramScopes(diagram) {
    const scopes = [{
        id: ALL_DIAGRAM_SCOPE,
        label: "Diagrama completo",
        type: "all"
    }];

    if (
        (diagram?.nodes?.length ?? 0) > 0
    ) {
        scopes.push({
            id: "__main__",
            label: "Flujo principal",
            type: "main"
        });
    }

    for (
        const subgraph
        of diagram?.subgraphs ?? []
    ) {
        scopes.push({
            id: subgraph.id,
            label:
                subgraph.id === "top_level"
                    ? "Flujo global"
                    : `Función ${subgraph.title}`,
            type:
                subgraph.id === "top_level"
                    ? "global"
                    : "function"
        });
    }

    return scopes;
}

export function focusDiagram(
    diagram,
    scopeId
) {
    if (
        !diagram ||
        scopeId === ALL_DIAGRAM_SCOPE
    ) {
        return diagram;
    }

    if (scopeId === "__main__") {
        return {
            ...diagram,
            subgraphs: []
        };
    }

    const subgraph =
        (diagram.subgraphs ?? [])
            .find(item =>
                item.id === scopeId
            );

    if (!subgraph) {
        return diagram;
    }

    return {
        ...diagram,
        nodes: [],
        edges: [],
        subgraphs: [subgraph]
    };
}

export function searchDiagramNodes(
    diagram,
    query
) {
    const normalizedQuery =
        normalizeSearchText(query);

    if (normalizedQuery === "") {
        return [];
    }

    return getDiagramNodes(diagram)
        .filter(node =>
            normalizeSearchText([
                node.id,
                node.type,
                node.label,
                node.reference?.name
            ].filter(Boolean).join(" "))
                .includes(normalizedQuery)
        );
}

export function normalizeSearchIndex(
    index,
    resultCount
) {
    if (resultCount <= 0) {
        return 0;
    }

    return (
        (index % resultCount) +
        resultCount
    ) % resultCount;
}

function normalizeSearchText(value) {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("es")
        .trim();
}
