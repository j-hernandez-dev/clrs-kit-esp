import {
    DEFAULT_DIRECTION
} from "../config/Directions.js";
import {
    shiftSourceLocation
} from "../interaction/DiagramSelection.js";
import {
    attachDiagramIdentity,
    DIAGRAM_EDGE_RELATIONS,
    DIAGRAM_ENTITY_TYPES,
    DIAGRAM_NODE_ROLES
} from "./DiagramEditableIdentity.js";

const TERMINAL_ROLES = new Set([
    DIAGRAM_NODE_ROLES.GLOBAL_END,
    DIAGRAM_NODE_ROLES.FUNCTION_END,
    DIAGRAM_NODE_ROLES.EXPLICIT_RETURN
]);

const TERMINAL_SOURCE_RELATIONS = new Set([
    DIAGRAM_EDGE_RELATIONS.SEQUENCE,
    DIAGRAM_EDGE_RELATIONS.LOOP_BACK,
    DIAGRAM_EDGE_RELATIONS.MERGE
]);

/**
 * Estado aislado de una generación de diagrama.
 */
export class DiagramContext {

    constructor(options = {}) {
        this.direction =
            options.direction ??
            DEFAULT_DIRECTION;
        this.sourceOrigin =
            options.sourceOrigin ?? null;
        this.reset();
    }

    reset() {
        this.nodeCounter = 0;
        this.edgeCounter = 0;
        this.functions = new Map();
        this.scopeStack = ["__main__"];
        this.blockStack = [];
        this.statementStack = [];
        this.protectedTerminalStack = [];
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
        const {
            location = null,
            synthetic = false,
            editableSynthetic = false,
            editableFigure = null,
            readOnly = false,
            deletable = true,
            editor = null,
            materialization = null,
            identityPath:
                requestedIdentityPath = null,
            identityContext:
                requestedIdentityContext = null,
            role = null,
            sourceType = null,
            ...nodeData
        } = node;
        const createdNode = {
            id,
            ...nodeData
        };

        if (location?.startLine != null) {
            Object.defineProperty(
                createdNode,
                "location",
                {
                    value:
                        Object.freeze(
                            shiftSourceLocation(
                                location,
                                this.sourceOrigin
                            )
                        ),
                    enumerable: false
                }
            );
        }

        if (synthetic) {
            Object.defineProperty(
                createdNode,
                "synthetic",
                {
                    value: true,
                    enumerable: false
                }
            );
        }

        const statementContext =
            this.getCurrentStatement();
        const blockContext =
            statementContext?.block ??
            this.getCurrentBlock();
        const resolvedIdentityContext =
            requestedIdentityContext ??
            blockContext;
        const shiftedLocation =
            createdNode.location ?? null;
        const editable = Boolean(
            editableFigure &&
            (!synthetic || editableSynthetic) &&
            (
                shiftedLocation ||
                materialization != null
            )
        );
        const identityPath =
            requestedIdentityPath ?? (
                statementContext
                ? this.nextStatementNodePath(
                    statementContext
                )
                : `${this.getCurrentScope()}` +
                    `/structure:${id}`
            );

        attachDiagramIdentity(
            createdNode,
            {
                schemaVersion: 1,
                entityType:
                    DIAGRAM_ENTITY_TYPES.NODE,
                id: `node:${identityPath}`,
                modelId: id,
                editable,
                readOnly:
                    editable && readOnly === true,
                deletable:
                    editable && deletable !== false,
                figure:
                    editable
                        ? editableFigure
                        : null,
                editor:
                    editable
                        ? editor
                        : null,
                materialization:
                    editable
                        ? materialization
                        : null,
                role,
                scopeId:
                    materialization?.insertion
                        ?.scopeId ??
                    resolvedIdentityContext
                        ?.scopeId ??
                    this.getCurrentScope(),
                containerId:
                    materialization?.insertion
                        ?.containerId ??
                    resolvedIdentityContext
                        ?.containerId ??
                    null,
                branch:
                    materialization?.insertion
                        ?.branch ??
                    resolvedIdentityContext
                        ?.branch ?? null,
                blockStatementCount:
                    resolvedIdentityContext
                        ?.statementCount ?? null,
                statementIndex:
                    materialization?.insertion
                        ?.index ??
                    requestedIdentityContext
                        ?.statementIndex ??
                    statementContext?.index ??
                    null,
                source: {
                    type:
                        sourceType ??
                        statementContext
                            ?.statement?.type ??
                        null,
                    location: shiftedLocation
                }
            }
        );

        diagram.nodes.push(createdNode);

        return id;
    }

    connect(
        diagram,
        source,
        target,
        label = null,
        options = {}
    ) {
        const sourceNode = diagram.nodes.find(
            node => node.id === source
        );
        const relation =
            options.relation ??
            DIAGRAM_EDGE_RELATIONS.FLOW;

        if (
            TERMINAL_SOURCE_RELATIONS.has(
                relation
            ) &&
            (
                sourceNode?.type === "return" ||
                TERMINAL_ROLES.has(
                    sourceNode?.identity?.role
                )
            )
        ) {
            return null;
        }

        const edge = {
            source,
            target,
            label
        };
        const edgeId =
            `E${++this.edgeCounter}`;
        const insertion =
            options.insertion ?? null;

        attachDiagramIdentity(
            edge,
            {
                schemaVersion: 1,
                entityType:
                    DIAGRAM_ENTITY_TYPES.EDGE,
                id: `edge:${edgeId}`,
                modelId: edgeId,
                editable: insertion != null,
                relation:
                    relation,
                sourceNodeId: source,
                targetNodeId: target,
                insertion
            }
        );

        diagram.edges.push(edge);

        return edgeId;
    }

    getCurrentScope() {
        return this.scopeStack.at(-1) ??
            "__main__";
    }

    getCurrentBlock() {
        return this.blockStack.at(-1) ?? null;
    }

    getCurrentStatement() {
        return this.statementStack.at(-1) ??
            null;
    }

    getProtectedFunctionTerminal() {
        return this.protectedTerminalStack
            .at(-1) ?? null;
    }

    withProtectedFunctionTerminal(
        statement,
        callback
    ) {
        this.protectedTerminalStack.push(
            statement ?? null
        );

        try {
            return callback();
        } finally {
            this.protectedTerminalStack.pop();
        }
    }

    withScope(scopeId, callback) {
        this.scopeStack.push(
            scopeId ?? this.getCurrentScope()
        );

        try {
            return callback();
        } finally {
            this.scopeStack.pop();
        }
    }

    withBlock(options = {}, callback) {
        const scopeId =
            options.scopeId ??
            this.getCurrentScope();
        const block = Object.freeze({
            scopeId,
            containerId:
                options.containerId ??
                `${scopeId}/body`,
            branch:
                options.branch ?? "body",
            statementCount:
                Number.isInteger(
                    options.statementCount
                )
                    ? options.statementCount
                    : null
        });

        this.blockStack.push(block);

        try {
            return callback(block);
        } finally {
            this.blockStack.pop();
        }
    }

    withStatement(
        statement,
        index,
        callback
    ) {
        const block =
            this.getCurrentBlock() ??
            Object.freeze({
                scopeId:
                    this.getCurrentScope(),
                containerId:
                    `${this.getCurrentScope()}` +
                    "/body",
                branch: "body"
            });
        const context = {
            statement,
            index,
            block,
            path:
                `${block.containerId}` +
                `/statement:${index}`,
            nodeOrdinal: 0
        };

        this.statementStack.push(context);

        try {
            return callback(context);
        } finally {
            this.statementStack.pop();
        }
    }

    createChildBlockOptions(
        branch,
        qualifier = null
    ) {
        const parent =
            this.getCurrentStatement()?.path ??
            this.getCurrentBlock()?.containerId ??
            `${this.getCurrentScope()}/body`;
        const suffix = qualifier == null
            ? branch
            : `${branch}:${qualifier}`;

        return {
            scopeId: this.getCurrentScope(),
            containerId: `${parent}/${suffix}`,
            branch
        };
    }

    createInsertionPoint(
        index,
        position = "between"
    ) {
        const block = this.getCurrentBlock();

        if (!block) {
            return null;
        }

        return {
            scopeId: block.scopeId,
            containerId: block.containerId,
            branch: block.branch,
            index,
            position
        };
    }

    nextStatementNodePath(context) {
        const ordinal = context.nodeOrdinal++;

        return ordinal === 0
            ? context.path
            : `${context.path}/part:${ordinal}`;
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
        statementVisitor,
        options = {}
    ) {
        const list = statements ?? [];

        return this.withBlock(
            {
                ...options,
                statementCount: list.length
            },
            () => {
                let first = null;
                let last = null;
                let lastExitLabel = null;
                let lastExitRelation =
                    DIAGRAM_EDGE_RELATIONS.SEQUENCE;
                let reachable = true;
                let terminal = null;

                for (
                    let index = 0;
                    index < list.length;
                    index += 1
                ) {
                    const statement = list[index];
                    const result =
                        this.withStatement(
                            statement,
                            index,
                            () => statementVisitor(
                                statement,
                                diagram
                            )
                        );

                    if (!result) {
                        continue;
                    }

                    if (!first) {
                        first = result.entry;
                    }

                    if (!reachable) {
                        continue;
                    }

                    if (last) {
                        this.connect(
                            diagram,
                            last,
                            result.entry,
                            lastExitLabel,
                            {
                                relation:
                                    lastExitRelation,
                                insertion:
                                    this.createInsertionPoint(
                                        index
                                    )
                            }
                        );
                    }

                    const fallsThrough =
                        result.fallsThrough ??
                        (
                            Boolean(result.exit) &&
                            !TERMINAL_ROLES.has(
                                diagram.nodes.find(
                                    node =>
                                        node.id === result.exit
                                )?.identity?.role
                            ) &&
                            diagram.nodes.find(
                                node =>
                                    node.id === result.exit
                            )?.type !== "return"
                        );

                    if (!fallsThrough) {
                        terminal = result.exit ?? null;
                        last = null;
                        lastExitLabel = null;
                        reachable = false;
                        continue;
                    }

                    last = result.exit;
                    lastExitLabel =
                        result.exitLabel ?? null;
                    lastExitRelation =
                        result.exitRelation ??
                        DIAGRAM_EDGE_RELATIONS.SEQUENCE;
                }

                return {
                    first,
                    last,
                    lastExitLabel,
                    lastExitRelation,
                    fallsThrough: reachable,
                    terminal,
                    insertionStart:
                        this.createInsertionPoint(
                            0,
                            "start"
                        ),
                    insertionEnd:
                        this.createInsertionPoint(
                            list.length,
                            "end"
                        )
                };
            }
        );
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
    label = null,
    options = {}
) {
    return defaultContext.connect(
        diagram,
        source,
        target,
        label,
        options
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
    statementVisitor,
    options = {}
) {
    return defaultContext.buildBlock(
        diagram,
        statements,
        statementVisitor,
        options
    );
}
