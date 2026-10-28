export function sortSubgraphEdges(subgraph) {
    if (!subgraph?.edges) {
        return;
    }

    const getNumber = id =>
        Number(
            String(id).replace("N", "")
        );

    subgraph.edges.sort((a, b) => {
        const sourceDifference =
            getNumber(a.source) -
            getNumber(b.source);

        if (sourceDifference !== 0) {
            return sourceDifference;
        }

        return (
            getNumber(a.target) -
            getNumber(b.target)
        );
    });
}

export function isTerminal(nodeId, diagram) {
    if (!nodeId) {
        return false;
    }

    const node = diagram.nodes.find(
        item => item.id === nodeId
    );

    return node?.type === "return";
}

/**
 * Indica si un bloque conserva una salida desde la que puede continuar el
 * flujo. Un bloque vacío continúa de forma implícita; uno no vacío con
 * `last === null` terminó dentro de una estructura anidada (por ejemplo, un
 * condicional cuyas ramas retornan) y no debe producir una unión huérfana.
 */
export function blockFallsThrough(
    block,
    diagram
) {
    if (typeof block?.fallsThrough === "boolean") {
        return block.fallsThrough;
    }

    if (!block?.first) {
        return true;
    }

    return Boolean(block.last) &&
        !isTerminal(block.last, diagram);
}
