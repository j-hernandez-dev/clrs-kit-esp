import {
    getSemanticCallGraph,
    SemanticCallVertexKind
} from "../../semantic/SemanticCallGraph.js";
import {
    LanguageDiagnosticSeverity
} from "./LanguageDiagnosticsService.js";

export const SemanticCallDiagnosticCode =
    Object.freeze({
        UNUSED_FUNCTION:
            "CLRS_UNUSED_FUNCTION",
        DIRECT_RECURSION:
            "CLRS_DIRECT_RECURSION",
        INDIRECT_RECURSION:
            "CLRS_INDIRECT_RECURSION"
    });

const DIAGNOSTIC_PHASE = "call-graph";
const EMPTY_LIST = Object.freeze([]);

/**
 * Deriva información demostrable del grafo de llamadas sin convertirla en
 * errores de compilación ni alterar el snapshot documental.
 */
export class SemanticCallDiagnosticsService {

    diagnose(snapshot) {
        if (
            snapshot?.ok !== true ||
            snapshot.semanticModel == null
        ) {
            return EMPTY_LIST;
        }

        const graph =
            getSemanticCallGraph(snapshot);
        const diagnostics = [
            ...createUnusedDiagnostics(
                graph
            ),
            ...createRecursionDiagnostics(
                graph
            )
        ];

        return Object.freeze(diagnostics);
    }
}

function createUnusedDiagnostics(graph) {
    const reachable =
        collectReachableVertices(graph);

    return graph.vertices
        .filter(
            vertex =>
                vertex.kind ===
                    SemanticCallVertexKind
                        .FUNCTION &&
                !reachable.has(vertex.id)
        )
        .map(vertex =>
            createDiagnostic({
                code:
                    SemanticCallDiagnosticCode
                        .UNUSED_FUNCTION,
                message:
                    `La función «${vertex.name}» no es alcanzable desde el flujo global ni desde PRINCIPAL.`,
                severity:
                    LanguageDiagnosticSeverity
                        .HINT,
                location:
                    vertex.selectionLocation,
                data: {
                    kind: "unused-function",
                    functionName: vertex.name
                }
            })
        );
}

function createRecursionDiagnostics(graph) {
    const diagnostics = [];

    for (
        const component
        of graph.recursiveComponents()
    ) {
        if (!component.mutual) {
            const vertex = component.vertices[0];

            diagnostics.push(
                createDiagnostic({
                    code:
                        SemanticCallDiagnosticCode
                            .DIRECT_RECURSION,
                    message:
                        `La función «${vertex.name}» se llama a sí misma: recursión directa.`,
                    severity:
                        LanguageDiagnosticSeverity
                            .INFORMATION,
                    location:
                        vertex.selectionLocation,
                    data: {
                        kind: "direct-recursion",
                        functionName:
                            vertex.name,
                        functions: [vertex.name]
                    }
                })
            );
            continue;
        }

        for (const vertex of component.vertices) {
            const related =
                component.vertices
                    .filter(
                        candidate =>
                            candidate !== vertex
                    )
                    .map(
                        candidate =>
                            candidate.name
                    );

            diagnostics.push(
                createDiagnostic({
                    code:
                        SemanticCallDiagnosticCode
                            .INDIRECT_RECURSION,
                    message:
                        `La función «${vertex.name}» participa en recursión indirecta con ${formatNames(related)}.`,
                    severity:
                        LanguageDiagnosticSeverity
                            .INFORMATION,
                    location:
                        vertex.selectionLocation,
                    data: {
                        kind:
                            "indirect-recursion",
                        functionName:
                            vertex.name,
                        functions:
                            component.vertices
                                .map(
                                    candidate =>
                                        candidate.name
                                )
                    }
                })
            );
        }
    }

    return diagnostics;
}

function collectReachableVertices(graph) {
    const roots = [
        graph.getVertex("program"),
        graph.getVertex("PRINCIPAL")
    ].filter(Boolean);
    const reachable = new Set();
    const pending = [...roots];

    while (pending.length > 0) {
        const vertex = pending.shift();

        if (reachable.has(vertex.id)) {
            continue;
        }

        reachable.add(vertex.id);

        for (
            const edge
            of graph.outgoing(vertex.id)
        ) {
            const target =
                graph.getVertex(edge.callee);

            if (
                target != null &&
                !reachable.has(target.id)
            ) {
                pending.push(target);
            }
        }
    }

    return reachable;
}

function createDiagnostic({
    code,
    message,
    severity,
    location,
    data
}) {
    const diagnosticData = {
        ...data
    };

    if (Array.isArray(data.functions)) {
        diagnosticData.functions =
            Object.freeze([
                ...data.functions
            ]);
    }

    return Object.freeze({
        code,
        message,
        phase: DIAGNOSTIC_PHASE,
        severity,
        location,
        data: Object.freeze(
            diagnosticData
        )
    });
}

function formatNames(names) {
    const quoted = names.map(
        name => `«${name}»`
    );

    if (quoted.length <= 1) {
        return quoted[0] ??
            "otra función";
    }

    return (
        quoted.slice(0, -1).join(", ") +
        " y " +
        quoted.at(-1)
    );
}
