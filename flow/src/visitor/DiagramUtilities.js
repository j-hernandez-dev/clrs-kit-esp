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
