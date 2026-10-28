import {
    requireObject,
    requirePort
} from "../../src/application/ports/ApplicationPorts.js";
import {
    formatDeveloperError
} from "../../src/errors/ErrorFormatter.js";
import {
    getSemanticCallGraph,
    SemanticCallVertexKind
} from "../../src/semantic/SemanticCallGraph.js";
import {
    createVSCodeRange
} from "./StaticDiagnosticsProvider.js";

/**
 * Adapta el grafo semántico compartido a la jerarquía nativa de llamadas.
 */
export class CLRSCallHierarchyProvider {

    constructor(options = {}) {
        this.vscode =
            requireObject(
                options.vscodeApi,
                "vscodeApi"
            );
        this.documentAnalysisService =
            requirePort(
                options.documentAnalysisService,
                "documentAnalysisService",
                ["analyzeDocument"]
            );
        this.languageId = options.languageId;
        this.developerLogger =
            options.developerLogger ?? console;
        this.sessions = new Map();
        this.vertexByItem = new WeakMap();
        this.disposed = false;
    }

    prepareCallHierarchy(
        document,
        position,
        token = null
    ) {
        if (
            !this.isSupported(document) ||
            isCancelled(token)
        ) {
            return null;
        }

        try {
            const snapshot =
                this.documentAnalysisService
                    .analyzeDocument(document);

            if (
                !snapshot.ok ||
                snapshot.semanticModel == null
            ) {
                return null;
            }

            const graph =
                getSemanticCallGraph(snapshot);
            const languagePosition =
                toLanguagePosition(position);
            const call =
                graph.findCallAt(
                    languagePosition
                );
            const vertex =
                call == null
                    ? graph.findVertexAt(
                        languagePosition
                    )
                    : graph.getVertex(
                        call.callee
                    );

            if (vertex == null) {
                return null;
            }

            const session = Object.freeze({
                document,
                graph
            });

            this.sessions.set(
                document.uri.toString(),
                session
            );

            return this.createItem(
                session,
                vertex
            );
        } catch (error) {
            this.report(error);
            return null;
        }
    }

    provideCallHierarchyIncomingCalls(
        item,
        token = null
    ) {
        return this.provideCalls(
            item,
            token,
            (session, vertex) =>
                groupCalls(
                    session.graph.incoming(
                        vertex
                    ),
                    edge => edge.caller
                ).map(group =>
                    new this.vscode
                        .CallHierarchyIncomingCall(
                            this.createItem(
                                session,
                                session.graph
                                    .getVertex(
                                        group.vertexId
                                    )
                            ),
                            this.createRanges(
                                session.document,
                                group.edges
                            )
                        )
                )
        );
    }

    provideCallHierarchyOutgoingCalls(
        item,
        token = null
    ) {
        return this.provideCalls(
            item,
            token,
            (session, vertex) =>
                groupCalls(
                    session.graph.outgoing(
                        vertex
                    ),
                    edge => edge.callee
                ).map(group =>
                    new this.vscode
                        .CallHierarchyOutgoingCall(
                            this.createItem(
                                session,
                                session.graph
                                    .getVertex(
                                        group.vertexId
                                    )
                            ),
                            this.createRanges(
                                session.document,
                                group.edges
                            )
                        )
                )
        );
    }

    provideCalls(
        item,
        token,
        operation
    ) {
        if (
            this.disposed ||
            item == null ||
            isCancelled(token)
        ) {
            return [];
        }

        try {
            const session =
                this.sessions.get(
                    item.uri?.toString()
                );
            const vertex =
                this.resolveVertex(
                    session,
                    item
                );

            return vertex == null
                ? []
                : operation(
                    session,
                    vertex
                );
        } catch (error) {
            this.report(error);
            return [];
        }
    }

    resolveVertex(session, item) {
        if (session == null) {
            return null;
        }

        return (
            this.vertexByItem.get(item) ??
            session.graph.getVertex(
                item.name
            ) ??
            session.graph.vertices.find(
                vertex =>
                    vertex.displayName ===
                    item.name
            ) ??
            null
        );
    }

    createItem(session, vertex) {
        const item =
            new this.vscode.CallHierarchyItem(
                vertex.kind ===
                    SemanticCallVertexKind
                        .FUNCTION
                    ? this.vscode.SymbolKind
                        .Function
                    : this.vscode.SymbolKind
                        .Module,
                vertex.displayName,
                vertex.detail,
                session.document.uri,
                createVSCodeRange(
                    this.vscode,
                    session.document,
                    vertex.location
                ),
                createVSCodeRange(
                    this.vscode,
                    session.document,
                    vertex.selectionLocation
                )
            );

        this.vertexByItem.set(item, vertex);

        return item;
    }

    createRanges(document, edges) {
        return edges.map(edge =>
            createVSCodeRange(
                this.vscode,
                document,
                edge.location
            )
        );
    }

    isSupported(document) {
        return (
            !this.disposed &&
            document != null &&
            document.languageId ===
                this.languageId
        );
    }

    report(error) {
        this.developerLogger.error(
            formatDeveloperError(error)
        );
    }

    dispose() {
        this.disposed = true;
        this.sessions.clear();
        this.vertexByItem = new WeakMap();
    }
}

function groupCalls(edges, getVertexId) {
    const groups = new Map();

    for (const edge of edges) {
        const vertexId = getVertexId(edge);
        const group = groups.get(vertexId);

        if (group == null) {
            groups.set(vertexId, {
                vertexId,
                edges: [edge]
            });
        } else {
            group.edges.push(edge);
        }
    }

    return [...groups.values()];
}

function toLanguagePosition(position) {
    return {
        line: (position?.line ?? -1) + 1,
        column:
            (position?.character ?? -1) +
            1
    };
}

function isCancelled(token) {
    return token?.isCancellationRequested ===
        true;
}
