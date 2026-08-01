import {
    DEFAULT_DIRECTION
} from "../config/Directions.js";

/**
 * Estado aislado de una generación de diagrama.
 */
export class DiagramContext {

    constructor(options = {}) {
        this.direction =
            options.direction ??
            DEFAULT_DIRECTION;
        this.reset();
    }

    reset() {
        this.nodeCounter = 0;
        this.functions = new Map();
    }

    createDiagram() {
        return {
            direction: this.direction,
            nodes: [],
            edges: [],
            subgraphs: []
        };
    }

    registerFunction(name, value) {
        this.functions.set(name, value);
    }

    getFunction(name) {
        return this.functions.get(name);
    }

    createNode(diagram, node) {
        const id =
            `N${++this.nodeCounter}`;

        diagram.nodes.push({
            id,
            ...node
        });

        return id;
    }

    connect(
        diagram,
        source,
        target,
        label = null
    ) {
        diagram.edges.push({
            source,
            target,
            label
        });
    }

    createSubgraph(
        diagram,
        {
            id,
            title,
            nodes = [],
            edges = []
        }
    ) {
        if (!diagram) {
            throw new Error(
                "Diagram is required."
            );
        }

        if (!id) {
            throw new Error(
                "The subgraph id is required."
            );
        }

        return {
            id,
            title: title ?? "",
            nodes,
            edges
        };
    }

    addNodeToSubgraph(subgraph, node) {
        if (subgraph && node) {
            subgraph.nodes.push(node);
        }
    }

    addEdgeToSubgraph(subgraph, edge) {
        if (subgraph && edge) {
            subgraph.edges.push(edge);
        }
    }

    buildBlock(
        diagram,
        statements,
        statementVisitor
    ) {
        const list = statements ?? [];
        let first = null;
        let last = null;
        let lastExitLabel = null;

        for (const statement of list) {
            const result =
                statementVisitor(
                    statement,
                    diagram
                );

            if (!result) {
                continue;
            }

            if (!first) {
                first = result.entry;
            }

            if (last) {
                this.connect(
                    diagram,
                    last,
                    result.entry,
                    lastExitLabel
                );
            }

            last = result.exit;
            lastExitLabel =
                result.exitLabel ?? null;
        }

        return {
            first,
            last,
            lastExitLabel
        };
    }
}

//--------------------------------------------------
// Fachadas históricas
//--------------------------------------------------

const defaultContext = new DiagramContext();

export function createDiagram() {
    return defaultContext.createDiagram();
}

export function resetContext() {
    defaultContext.reset();
}

export function registerFunction(name, value) {
    defaultContext.registerFunction(name, value);
}

export function getFunction(name) {
    return defaultContext.getFunction(name);
}

export function createNode(diagram, node) {
    return defaultContext.createNode(
        diagram,
        node
    );
}

export function connect(
    diagram,
    source,
    target,
    label = null
) {
    return defaultContext.connect(
        diagram,
        source,
        target,
        label
    );
}

export function createSubgraph(
    diagram,
    options
) {
    return defaultContext.createSubgraph(
        diagram,
        options
    );
}

export function addNodeToSubgraph(
    subgraph,
    node
) {
    return defaultContext
        .addNodeToSubgraph(
            subgraph,
            node
        );
}

export function addEdgeToSubgraph(
    subgraph,
    edge
) {
    return defaultContext
        .addEdgeToSubgraph(
            subgraph,
            edge
        );
}

export function buildBlock(
    diagram,
    statements,
    statementVisitor
) {
    return defaultContext.buildBlock(
        diagram,
        statements,
        statementVisitor
    );
}
