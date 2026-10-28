import {
    DirectedCallGraph
} from "../call-graph/index.js";
import {
    getSemanticNavigationIndex
} from "./SemanticNavigationIndex.js";
import {
    SemanticSymbolKind
} from "./SemanticSymbol.js";

export const SemanticCallVertexKind =
    Object.freeze({
        PROGRAM: "program",
        FUNCTION: "function"
    });

const GRAPH_STATE = new WeakMap();
const GRAPH_BY_SNAPSHOT = new WeakMap();
const PROGRAM_VERTEX_ID = "program";
const EMPTY_LIST = Object.freeze([]);

/**
 * Proyección compartida del grafo de llamadas resuelto por el análisis
 * semántico. Conserva rangos fuente y símbolos, pero delega toda la topología
 * dirigida al mismo núcleo que utiliza el análisis de complejidad.
 */
export class SemanticCallGraph {

    constructor(snapshot = null) {
        const sourceKey =
            snapshot?.key ?? null;
        const documentVersion =
            snapshot?.version ?? null;
        const semanticModel =
            snapshot?.semanticModel ?? null;
        const navigation =
            getSemanticNavigationIndex(
                snapshot
            );
        const vertices = buildVertices({
            ast: snapshot?.ast ?? null,
            semanticModel,
            navigation,
            sourceKey
        });
        const vertexBySymbol = new Map(
            vertices
                .filter(
                    vertex =>
                        vertex.symbol != null
                )
                .map(vertex => [
                    vertex.symbol,
                    vertex
                ])
        );
        const vertexByNode = new WeakMap(
            vertices
                .filter(
                    vertex =>
                        vertex.node != null
                )
                .map(vertex => [
                    vertex.node,
                    vertex
                ])
        );
        const vertexByName = new Map(
            vertices.map(vertex => [
                vertex.name,
                vertex
            ])
        );
        const edges = buildEdges({
            semanticModel,
            vertexBySymbol,
            sourceKey
        });
        const topology = new DirectedCallGraph({
            vertices,
            edges,
            getVertexId: vertex => vertex.id,
            getEdgeSource: edge => edge.caller,
            getEdgeTarget: edge => edge.callee
        });

        this.sourceKey = sourceKey;
        this.documentVersion = documentVersion;
        this.vertices = topology.vertices;
        this.edges = topology.edges;
        this.components = topology.components;
        this.evaluationOrder =
            topology.evaluationOrder;

        GRAPH_STATE.set(this, {
            topology,
            vertexBySymbol,
            vertexByNode,
            vertexByName
        });

        Object.freeze(this);
    }

    getVertex(value) {
        const state = GRAPH_STATE.get(this);

        if (typeof value === "string") {
            return (
                state.topology.getVertex(value) ??
                state.vertexByName.get(value) ??
                null
            );
        }

        if (
            value == null ||
            typeof value !== "object"
        ) {
            return null;
        }

        return (
            state.vertexBySymbol.get(value) ??
            state.vertexByNode.get(value) ??
            state.vertexByNode.get(
                value.identifier
            ) ??
            state.vertexBySymbol.get(
                value.symbol
            ) ??
            null
        );
    }

    outgoing(value) {
        const vertex = this.getVertex(value);

        return vertex == null
            ? EMPTY_LIST
            : GRAPH_STATE.get(this)
                .topology.outgoing(vertex.id);
    }

    incoming(value) {
        const vertex = this.getVertex(value);

        return vertex == null
            ? EMPTY_LIST
            : GRAPH_STATE.get(this)
                .topology.incoming(vertex.id);
    }

    getComponent(value) {
        const vertex = this.getVertex(value);

        return vertex == null
            ? null
            : GRAPH_STATE.get(this)
                .topology.getComponent(
                    vertex.id
                );
    }

    recursiveComponents() {
        return GRAPH_STATE.get(this)
            .topology.recursiveComponents();
    }

    findCallAt(position) {
        return selectSmallestRange(
            this.edges,
            position,
            edge => edge.location
        );
    }

    findVertexAt(position) {
        const functions =
            this.vertices.filter(
                vertex =>
                    vertex.kind ===
                    SemanticCallVertexKind
                        .FUNCTION
            );
        const selected = selectSmallestRange(
            functions,
            position,
            vertex =>
                vertex.selectionLocation
        );

        if (selected != null) {
            return selected;
        }

        const program = this.getVertex(
            PROGRAM_VERTEX_ID
        );

        return containsPosition(
            program?.selectionLocation,
            position
        )
            ? program
            : null;
    }
}

/**
 * Reutiliza exactamente un grafo semántico por snapshot inmutable.
 */
export function getSemanticCallGraph(snapshot) {
    if (
        snapshot == null ||
        typeof snapshot !== "object"
    ) {
        return new SemanticCallGraph();
    }

    const cached =
        GRAPH_BY_SNAPSHOT.get(snapshot);

    if (cached != null) {
        return cached;
    }

    const graph =
        new SemanticCallGraph(snapshot);

    GRAPH_BY_SNAPSHOT.set(snapshot, graph);

    return graph;
}

function buildVertices({
    ast,
    semanticModel,
    navigation,
    sourceKey
}) {
    if (
        ast == null ||
        semanticModel == null
    ) {
        return [];
    }

    const program = Object.freeze({
        id: PROGRAM_VERTEX_ID,
        kind:
            SemanticCallVertexKind.PROGRAM,
        name: "<programa>",
        displayName: "Programa CLRS",
        detail: "flujo global",
        sourceKey,
        symbol: null,
        node: ast,
        parameters: EMPTY_LIST,
        location:
            normalizeLocation(ast.location),
        selectionLocation:
            createStartLocation(ast.location)
    });
    const functionSymbols =
        navigation.documentSymbols.filter(
            item =>
                item.kind ===
                SemanticSymbolKind.FUNCTION
        );
    const functions = functionSymbols.map(
        item => {
            const functionScope =
                semanticModel.scopes.find(
                    scope =>
                        scope.node != null &&
                        semanticModel.getSymbol(
                            scope.node
                        ) === item.symbol
                );
            const node =
                functionScope?.node ?? null;
            const parameters = Object.freeze(
                (node?.parameters ?? [])
                    .map(parameter =>
                        Object.freeze({
                            name:
                                parameter.identifier
                                    ?.name ?? "?",
                            dimensions:
                                parameter.dimensions
                                    ?.length ?? 0,
                            location:
                                normalizeLocation(
                                    parameter.location
                                )
                        })
                    )
            );

            return Object.freeze({
                id: functionVertexId(
                    item.name
                ),
                kind:
                    SemanticCallVertexKind
                        .FUNCTION,
                name: item.name,
                displayName: item.name,
                detail: item.detail,
                sourceKey,
                symbol: item.symbol,
                node,
                parameters,
                location: item.location,
                selectionLocation:
                    item.selectionLocation
            });
        }
    );

    return [program, ...functions];
}

function buildEdges({
    semanticModel,
    vertexBySymbol,
    sourceKey
}) {
    const edges = [];

    for (
        const reference
        of semanticModel?.references ?? []
    ) {
        const callee =
            vertexBySymbol.get(
                reference.symbol
            );

        if (callee == null) {
            continue;
        }

        const callerSymbol =
            semanticModel.getSymbol(
                reference.scope
                    ?.enclosingFunction
                    ?.node
            );
        const caller =
            vertexBySymbol.get(
                callerSymbol
            );
        const callerId =
            caller?.id ?? PROGRAM_VERTEX_ID;
        const location =
            normalizeLocation(
                reference.node?.location
            );

        if (location == null) {
            continue;
        }

        edges.push(Object.freeze({
            id: `call:${edges.length}`,
            caller: callerId,
            callee: callee.id,
            callerName:
                caller?.name ?? "<programa>",
            calleeName: callee.name,
            sourceKey,
            node: reference.node,
            location,
            synthetic: false
        }));
    }

    return edges;
}

function functionVertexId(name) {
    return `function:${encodeURIComponent(name)}`;
}

function selectSmallestRange(
    values,
    position,
    getLocation
) {
    if (!isValidPosition(position)) {
        return null;
    }

    let selected = null;

    for (const value of values) {
        const location = getLocation(value);

        if (
            !containsPosition(
                location,
                position
            )
        ) {
            continue;
        }

        if (
            selected == null ||
            locationSize(location) <
                locationSize(
                    getLocation(selected)
                )
        ) {
            selected = value;
        }
    }

    return selected;
}

function normalizeLocation(location) {
    if (
        !Number.isFinite(
            location?.startLine
        ) ||
        !Number.isFinite(
            location?.startColumn
        ) ||
        !Number.isFinite(
            location?.endLine
        ) ||
        !Number.isFinite(
            location?.endColumn
        )
    ) {
        return null;
    }

    return Object.freeze({
        startLine: location.startLine,
        startColumn: location.startColumn,
        endLine: location.endLine,
        endColumn: location.endColumn
    });
}

function createStartLocation(location) {
    const normalized =
        normalizeLocation(location);

    if (normalized == null) {
        return null;
    }

    return Object.freeze({
        startLine: normalized.startLine,
        startColumn: normalized.startColumn,
        endLine: normalized.startLine,
        endColumn: normalized.startColumn
    });
}

function isValidPosition(position) {
    return (
        Number.isFinite(position?.line) &&
        Number.isFinite(position?.column)
    );
}

function containsPosition(
    location,
    position
) {
    if (
        location == null ||
        !isValidPosition(position)
    ) {
        return false;
    }

    if (
        position.line < location.startLine ||
        position.line > location.endLine
    ) {
        return false;
    }

    if (
        position.line === location.startLine &&
        position.column < location.startColumn
    ) {
        return false;
    }

    if (
        position.line === location.endLine &&
        position.column > location.endColumn
    ) {
        return false;
    }

    return true;
}

function locationSize(location) {
    return (
        (
            location.endLine -
            location.startLine
        ) *
        1_000_000 +
        (
            location.endColumn -
            location.startColumn
        )
    );
}
