const GRAPH_STATE = new WeakMap();

/**
 * Topología dirigida neutral para grafos de llamadas. No conoce AST, símbolos,
 * costos ni APIs de editor: conserva las entidades originales y aporta índices,
 * componentes fuertemente conexos y orden de dependencias compartidos.
 */
export class DirectedCallGraph {

    constructor(options = {}) {
        const vertices = Object.freeze([
            ...(options.vertices ?? [])
        ]);
        const edges = Object.freeze([
            ...(options.edges ?? [])
        ]);
        const getVertexId = requireSelector(
            options.getVertexId,
            "getVertexId"
        );
        const getEdgeSource = requireSelector(
            options.getEdgeSource,
            "getEdgeSource"
        );
        const getEdgeTarget = requireSelector(
            options.getEdgeTarget,
            "getEdgeTarget"
        );
        const vertexById = new Map();
        const orderById = new Map();

        vertices.forEach((vertex, index) => {
            const id = requireId(
                getVertexId(vertex),
                "vertex"
            );

            if (vertexById.has(id)) {
                throw new TypeError(
                    `The call graph vertex '${id}' is duplicated.`
                );
            }

            vertexById.set(id, vertex);
            orderById.set(id, index);
        });

        const outgoingById = createGroups(
            vertexById.keys()
        );
        const incomingById = createGroups(
            vertexById.keys()
        );

        for (const edge of edges) {
            const source = requireId(
                getEdgeSource(edge),
                "edge source"
            );
            const target = requireId(
                getEdgeTarget(edge),
                "edge target"
            );

            if (
                !vertexById.has(source) ||
                !vertexById.has(target)
            ) {
                throw new TypeError(
                    "A call graph edge references an unknown vertex."
                );
            }

            outgoingById.get(source).push(edge);
            incomingById.get(target).push(edge);
        }

        freezeGroups(outgoingById);
        freezeGroups(incomingById);

        const rawComponents =
            stronglyConnectedComponents({
                vertexIds: [...vertexById.keys()],
                outgoingById,
                getEdgeTarget,
                orderById
            });
        const componentIdByVertex = new Map();

        rawComponents.forEach((vertexIds, index) => {
            for (const vertexId of vertexIds) {
                componentIdByVertex.set(
                    vertexId,
                    `scc:${index}`
                );
            }
        });

        const components = Object.freeze(
            rawComponents.map((vertexIds, index) => {
                const id = `scc:${index}`;
                const internalEdges = edges.filter(edge =>
                    componentIdByVertex.get(
                        getEdgeSource(edge)
                    ) === id &&
                    componentIdByVertex.get(
                        getEdgeTarget(edge)
                    ) === id
                );
                const dependencies = unique(
                    edges
                        .filter(edge =>
                            componentIdByVertex.get(
                                getEdgeSource(edge)
                            ) === id &&
                            componentIdByVertex.get(
                                getEdgeTarget(edge)
                            ) !== id
                        )
                        .map(edge =>
                            componentIdByVertex.get(
                                getEdgeTarget(edge)
                            )
                        )
                );

                return Object.freeze({
                    id,
                    vertexIds:
                        Object.freeze(vertexIds),
                    vertices: Object.freeze(
                        vertexIds.map(vertexId =>
                            vertexById.get(vertexId)
                        )
                    ),
                    recursive:
                        vertexIds.length > 1 ||
                        internalEdges.some(edge =>
                            getEdgeSource(edge) ===
                            getEdgeTarget(edge)
                        ),
                    mutual: vertexIds.length > 1,
                    internalEdges:
                        Object.freeze(internalEdges),
                    dependencies:
                        Object.freeze(dependencies)
                });
            })
        );
        const componentById = new Map(
            components.map(component => [
                component.id,
                component
            ])
        );
        const componentByVertexId = new Map(
            components.flatMap(component =>
                component.vertexIds.map(vertexId => [
                    vertexId,
                    component
                ])
            )
        );
        const evaluationOrder = Object.freeze(
            dependenciesFirst(
                components,
                componentById
            )
        );

        this.vertices = vertices;
        this.edges = edges;
        this.components = components;
        this.evaluationOrder = evaluationOrder;

        GRAPH_STATE.set(this, {
            vertexById,
            outgoingById,
            incomingById,
            componentByVertexId
        });

        Object.freeze(this);
    }

    getVertex(vertexId) {
        return GRAPH_STATE.get(this)
            .vertexById.get(vertexId) ?? null;
    }

    outgoing(vertexId) {
        return GRAPH_STATE.get(this)
            .outgoingById.get(vertexId) ??
            EMPTY_LIST;
    }

    incoming(vertexId) {
        return GRAPH_STATE.get(this)
            .incomingById.get(vertexId) ??
            EMPTY_LIST;
    }

    getComponent(vertexId) {
        return GRAPH_STATE.get(this)
            .componentByVertexId.get(vertexId) ??
            null;
    }

    recursiveComponents() {
        return this.components.filter(
            component => component.recursive
        );
    }
}

const EMPTY_LIST = Object.freeze([]);

function requireSelector(value, name) {
    if (typeof value !== "function") {
        throw new TypeError(
            `The call graph requires ${name}().`
        );
    }

    return value;
}

function requireId(value, label) {
    if (
        typeof value !== "string" ||
        value.length === 0
    ) {
        throw new TypeError(
            `The call graph ${label} identifier is invalid.`
        );
    }

    return value;
}

function createGroups(vertexIds) {
    return new Map(
        [...vertexIds].map(vertexId => [
            vertexId,
            []
        ])
    );
}

function freezeGroups(groups) {
    for (const [id, values] of groups) {
        groups.set(id, Object.freeze(values));
    }
}

function stronglyConnectedComponents({
    vertexIds,
    outgoingById,
    getEdgeTarget,
    orderById
}) {
    let nextIndex = 0;
    const indices = new Map();
    const lowLinks = new Map();
    const stack = [];
    const onStack = new Set();
    const components = [];

    const connect = vertexId => {
        indices.set(vertexId, nextIndex);
        lowLinks.set(vertexId, nextIndex);
        nextIndex += 1;
        stack.push(vertexId);
        onStack.add(vertexId);

        for (
            const edge
            of outgoingById.get(vertexId) ?? []
        ) {
            const target = getEdgeTarget(edge);

            if (!indices.has(target)) {
                connect(target);
                lowLinks.set(
                    vertexId,
                    Math.min(
                        lowLinks.get(vertexId),
                        lowLinks.get(target)
                    )
                );
            } else if (onStack.has(target)) {
                lowLinks.set(
                    vertexId,
                    Math.min(
                        lowLinks.get(vertexId),
                        indices.get(target)
                    )
                );
            }
        }

        if (
            lowLinks.get(vertexId) !==
            indices.get(vertexId)
        ) {
            return;
        }

        const component = [];
        let current;

        do {
            current = stack.pop();
            onStack.delete(current);
            component.push(current);
        } while (current !== vertexId);

        component.sort(
            (left, right) =>
                orderById.get(left) -
                orderById.get(right)
        );
        components.push(component);
    };

    for (const vertexId of vertexIds) {
        if (!indices.has(vertexId)) {
            connect(vertexId);
        }
    }

    components.sort(
        (left, right) =>
            orderById.get(left[0]) -
            orderById.get(right[0])
    );

    return components;
}

function dependenciesFirst(
    components,
    componentById
) {
    const visited = new Set();
    const ordered = [];

    const visit = component => {
        if (visited.has(component.id)) {
            return;
        }

        visited.add(component.id);

        for (
            const dependencyId
            of component.dependencies
        ) {
            visit(componentById.get(dependencyId));
        }

        ordered.push(component);
    };

    for (const component of components) {
        visit(component);
    }

    return ordered;
}

function unique(values) {
    return [...new Set(values)];
}
