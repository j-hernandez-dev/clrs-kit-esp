export default function CallGraph({
    graph,
    onNavigate
}) {
    if (
        graph == null ||
        graph.edges.length === 0
    ) {
        return null;
    }

    const byId = new Map(
        graph.nodes.map(node => [
            node.id,
            node
        ])
    );

    return (
        <details className="report-section">
            <summary>
                <span>Grafo de llamadas</span>
                <small>
                    Relaciones directas
                </small>
            </summary>

            <div className="call-graph">
                {graph.edges.map(edge => {
                    const from =
                        byId.get(edge.from);
                    const to =
                        byId.get(edge.to);

                    return (
                        <div
                            className="call-edge"
                            key={edge.id}
                        >
                            <GraphNode
                                node={from}
                                onNavigate={
                                    onNavigate
                                }
                            />
                            <span
                                className="call-arrow"
                                aria-label="llama a"
                            >
                                →
                            </span>
                            <GraphNode
                                node={to}
                                onNavigate={
                                    onNavigate
                                }
                            />
                        </div>
                    );
                })}
            </div>
        </details>
    );
}

function GraphNode({ node, onNavigate }) {
    if (!node) return null;

    return (
        <button
            className={
                node.current
                    ? "call-node current"
                    : "call-node"
            }
            type="button"
            onClick={() =>
                onNavigate(node.location)
            }
        >
            {node.label}
        </button>
    );
}
