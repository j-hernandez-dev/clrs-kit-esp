export const ControlFlowBlockKind =
    Object.freeze({
        ENTRY: "entry",
        EXIT: "exit",
        STATEMENT: "statement",
        CONDITION: "condition",
        JOIN: "join",
        LOOP_HEADER: "loop-header",
        LOOP_BODY: "loop-body",
        FOR_INITIALIZER: "for-initializer",
        FOR_INCREMENT: "for-increment"
    });

export const ControlFlowEdgeKind =
    Object.freeze({
        NORMAL: "normal",
        TRUE: "true",
        FALSE: "false",
        BACK: "back",
        RETURN: "return"
    });

export class ControlFlowGraph {

    constructor({
        name,
        node,
        entry,
        exit,
        blocks,
        edges
    }) {
        this.kind = "control-flow-graph";
        this.name = name;
        this.node = node;
        this.entry = entry;
        this.exit = exit;
        this.edges = Object.freeze(
            edges.map(freezeEdge)
        );
        this.blocks = Object.freeze(
            blocks.map(block =>
                freezeBlock(
                    block,
                    this.edges.filter(edge =>
                        edge.from === block.id
                    )
                )
            )
        );
        this.blockById = new Map(
            this.blocks.map(block => [
                block.id,
                block
            ])
        );
        this.predecessorEdges = groupEdges(
            this.edges,
            "to"
        );
        this.successorEdges = groupEdges(
            this.edges,
            "from"
        );
        this.blockByAstNode = new WeakMap();

        for (const block of this.blocks) {
            for (const astNode of block.astNodes) {
                this.blockByAstNode.set(
                    astNode,
                    block
                );
            }
        }
    }

    getBlock(value) {
        if (typeof value === "string") {
            return this.blockById.get(value) ??
                null;
        }

        return this.blockByAstNode.get(value) ??
            null;
    }

    predecessors(value) {
        const id = typeof value === "string"
            ? value
            : value?.id;

        return this.predecessorEdges
            .get(id) ?? [];
    }

    successors(value) {
        const id = typeof value === "string"
            ? value
            : value?.id;

        return this.successorEdges
            .get(id) ?? [];
    }
}

function freezeBlock(block, outgoing) {
    return Object.freeze({
        id: block.id,
        kind: block.kind,
        role: block.role ?? null,
        node: block.node ?? null,
        astNodes:
            Object.freeze([
                ...block.astNodes
            ]),
        location: block.location ?? null,
        terminator:
            createTerminator(outgoing)
    });
}

function createTerminator(outgoing) {
    if (outgoing.length === 0) {
        return Object.freeze({
            kind: "exit",
            targets: Object.freeze([])
        });
    }

    const returned = outgoing.find(edge =>
        edge.kind ===
        ControlFlowEdgeKind.RETURN
    );

    if (returned != null) {
        return Object.freeze({
            kind: "return",
            targets:
                Object.freeze([
                    returned.to
                ])
        });
    }

    if (
        outgoing.length > 1 ||
        outgoing.some(edge =>
            edge.truth != null
        )
    ) {
        return Object.freeze({
            kind: "branch",
            condition:
                outgoing.find(edge =>
                    edge.condition != null
                )?.condition ?? null,
            targets:
                Object.freeze(
                    outgoing.map(edge =>
                        Object.freeze({
                            block: edge.to,
                            truth: edge.truth
                        })
                    )
                )
        });
    }

    return Object.freeze({
        kind:
            outgoing[0].backEdge
                ? "back"
                : "goto",
        targets:
            Object.freeze([
                outgoing[0].to
            ])
    });
}

function freezeEdge(edge) {
    return Object.freeze({
        id: edge.id,
        from: edge.from,
        to: edge.to,
        kind: edge.kind,
        condition: edge.condition ?? null,
        truth:
            edge.truth == null
                ? null
                : Boolean(edge.truth),
        backEdge:
            Boolean(edge.backEdge)
    });
}

function groupEdges(edges, property) {
    const grouped = new Map();

    for (const edge of edges) {
        const key = edge[property];
        const values = grouped.get(key) ?? [];

        values.push(edge);
        grouped.set(
            key,
            values
        );
    }

    for (const [key, values] of grouped) {
        grouped.set(
            key,
            Object.freeze(values)
        );
    }

    return grouped;
}
