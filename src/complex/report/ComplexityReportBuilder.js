import {
    costExpressionKey
} from "../algebra/CostExpression.js";
import {
    formatCostExpression
} from "../algebra/CostExpressionFormatter.js";
import {
    formatCostExpressionLatex
} from "./CostExpressionLatexFormatter.js";
import {
    presentComplexityResult
} from "./ComplexityResultPresentation.js";
import {
    formatOrder
} from "../asymptotic/AsymptoticOrder.js";

export const ComplexityReportStatus =
    Object.freeze({
        KNOWN: "known",
        CONDITIONAL: "conditional",
        PARTIAL: "partial",
        UNKNOWN: "unknown"
    });

/**
 * Convierte el informe rico del analizador en datos serializables y estables
 * para una versión concreta del documento. No vuelve a analizar el AST.
 */
export class ComplexityReportBuilder {

    build(costReport, document = {}) {
        requireCostReport(costReport);

        const functionNodes =
            costReport.statementsCost.filter(
                node =>
                    node.type ===
                    "FunctionDeclaration"
            );
        const functions = functionNodes.map(
            node => this.buildFunction(
                node,
                costReport
            )
        );

        return Object.freeze({
            kind: "complexity-report",
            document: Object.freeze({
                uri:
                    document.uri ?? null,
                fileName:
                    document.fileName ??
                    "Documento CLRS",
                version:
                    document.version ?? null
            }),
            status:
                combineStatuses(
                    functions.map(
                        item => item.status
                    )
                ),
            generatedAt:
                new Date().toISOString(),
            functions:
                Object.freeze(functions)
        });
    }

    buildFunction(node, report) {
        const summary =
            node.functionCostSummary;
        const graph =
            report.functionCallGraph;
        const provenance =
            report.interproceduralProvenance ??
            null;
        const vertex =
            graph?.getVertex(node) ?? null;
        const sourceName =
            vertex?.sourceName ??
            sourceFunctionName(
                summary?.name ??
                "FUNCIÓN"
            );
        const scenario =
            node.scenarioCost;
        const analysis =
            node.scenarioAsymptoticAnalysis;
        const unknownModel =
            report.unknownComplexityAnalysis;
        const reasons =
            unknownModel?.get(node) ?? [];
        const best = this.buildScenario({
            name: "best",
            original:
                node.bestScenarioCost
                    ?.expression ??
                scenario?.best ??
                node.costExpression,
            simplified:
                node.bestScenarioCost
                    ?.simplified ??
                scenario?.simplifiedBest ??
                node.simplifiedCostExpression,
            analysis:
                analysis?.best ??
                node.asymptoticAnalysis,
            confidence:
                analysis?.confidence?.best ??
                scenario?.confidence?.best ??
                "unknown",
            reasons,
            recurrence:
                node.bestRecurrenceAnalysis ??
                null,
            interprocedural:
                buildInterproceduralTrace(
                    provenance,
                    summary?.name,
                    "best"
                )
        });
        const worst = this.buildScenario({
            name: "worst",
            original:
                scenario?.worst ??
                node.costExpression,
            simplified:
                scenario?.simplifiedWorst ??
                node.simplifiedCostExpression,
            analysis:
                analysis?.worst ??
                node.asymptoticAnalysis,
            confidence:
                analysis?.confidence?.worst ??
                scenario?.confidence?.worst ??
                "unknown",
            reasons,
            recurrence:
                node.recurrenceAnalysis ??
                null,
            interprocedural:
                buildInterproceduralTrace(
                    provenance,
                    summary?.name,
                    "worst"
                )
        });

        return Object.freeze({
            id: summary?.name ?? sourceName,
            name: sourceName,
            costName:
                summary?.name ??
                `T${sourceName}`,
            parameters:
                Object.freeze([
                    ...(summary?.parameters ?? [])
                ]),
            signature:
                `${sourceName}(${(
                    summary?.parameters ?? []
                ).join(", ")})`,
            location:
                freezeLocation(node.location),
            status:
                combineStatuses([
                    best.status,
                    worst.status
                ]),
            best,
            worst,
            assumptions:
                freezeStrings(
                    [
                        ...(scenario?.assumptions ?? []),
                        ...(analysis?.best?.assumptions ?? []),
                        ...(analysis?.worst?.assumptions ?? [])
                    ]
                ),
            evidence:
                freezeStrings([
                    ...(
                        scenario?.evidence ?? []
                    ),
                    ...(
                        analysis?.evidence ?? []
                    )
                ]),
            callGraph:
                buildLocalCallGraph(
                    graph,
                    vertex
                )
        });
    }

    buildScenario({
        name,
        original,
        simplified,
        analysis,
        confidence,
        reasons,
        recurrence,
        interprocedural = null
    }) {
        const analysisStatus =
            analysis?.status ??
            "unknown";
        const known =
            analysisStatus ===
            "determined";
        const conditional =
            analysisStatus ===
            "conditional";
        const relevantReasons = reasons.filter(
            reason =>
                reason.scenario === name ||
                reason.scenario === "both"
        );
        const originalFormula =
            formula(original);
        const simplifiedFormula =
            formula(simplified);
        const changed =
            costExpressionKey(original) !==
            costExpressionKey(simplified);
        const asymptotic = Object.freeze({
            status:
                known
                    ? "known"
                    : conditional
                        ? "conditional"
                        : "unknown",
            notation:
                analysis?.notation ?? "O(?)",
            latex:
                asymptoticLatex(
                    analysis?.notation ?? "O(?)"
                ),
            code:
                analysis?.code ?? null,
            message:
                analysis?.message ?? null,
            conditions:
                freezeStrings(
                    analysis?.assumptions ?? []
                )
        });
        const status = known
            ? ComplexityReportStatus.KNOWN
            : conditional
                ? ComplexityReportStatus.CONDITIONAL
                : ComplexityReportStatus.UNKNOWN;
        const recurrenceSummary =
            buildRecurrenceSummary(
                recurrence
            );
        const effectiveConfidence =
            recurrenceSummary?.boundKind ===
                "upper"
                ? "upper-bound"
                : analysis?.boundKind ===
                    "upper"
                    ? "upper-bound"
                    : analysis?.boundKind ===
                        "lower"
                        ? "lower-bound"
                        : confidence;
        const presented =
            presentComplexityResult({
                analysis,
                confidence:
                    effectiveConfidence,
                boundKind:
                    recurrenceSummary
                        ?.boundKind ??
                    analysis?.boundKind ??
                    null
            });
        const conclusion =
            Object.freeze({
                ...presented,
                latex:
                    asymptoticLatex(
                        presented.notation
                    ),
                proof: Object.freeze({
                    status:
                        presented.proofStatus,
                    verified:
                        presented.verified,
                    analysisStatus,
                    confidence:
                        effectiveConfidence,
                    boundKind:
                        presented.boundKind ??
                        "unknown",
                    conditions:
                        freezeStrings(
                            analysis
                                ?.assumptions ?? []
                        ),
                    evidence:
                        freezeStrings([
                            ...(analysis
                                ?.evidence ?? []),
                            ...(recurrenceSummary
                                ?.evidence ?? [])
                        ])
                })
            });

        return Object.freeze({
            name,
            status,
            confidence:
                effectiveConfidence,
            recurrence:
                recurrenceSummary,
            original: originalFormula,
            simplified: simplifiedFormula,
            asymptotic,
            conclusion,
            explanations:
                Object.freeze([
                    Object.freeze({
                        stage: "model",
                        title:
                            "Función de costo",
                        formula:
                            originalFormula,
                        explanation:
                            "El analizador suma los costos constantes, llamadas y cantidades de iteraciones de los caminos de este escenario."
                    }),
                    Object.freeze({
                        stage: "algebra",
                        title:
                            "Simplificación algebraica",
                        formula:
                            simplifiedFormula,
                        explanation: changed
                            ? "Se aplanaron sumas y productos, se eliminaron elementos neutros y se combinaron términos equivalentes mediante identidades algebraicas seguras."
                            : "La expresión ya se encontraba en la forma algebraica más simple que el analizador puede justificar con seguridad."
                    }),
                    Object.freeze({
                        stage: "asymptotic",
                        title:
                            "Conclusión asintótica",
                        formula: Object.freeze({
                            text:
                                conclusion.notation,
                            latex:
                                conclusion.latex
                        }),
                        explanation:
                            conclusion.summary
                    })
                ]),
            interprocedural,
            reasons:
                Object.freeze(
                    relevantReasons.map(
                        reason =>
                            Object.freeze({
                                code: reason.code,
                                message:
                                    reason.message,
                                category:
                                    reason.category,
                                location:
                                    freezeLocation(
                                        reason.location
                                    )
                            })
                    )
                )
        });
    }
}

export const complexityReportBuilder =
    new ComplexityReportBuilder();

function formula(expression) {
    return Object.freeze({
        text:
            formatCostExpression(expression),
        latex:
            formatCostExpressionLatex(
                expression
            )
    });
}

function buildLocalCallGraph(graph, vertex) {
    if (graph == null || vertex == null) {
        return null;
    }

    const relatedEdges = [
        ...graph.outgoing(vertex.name),
        ...graph.incoming(vertex.name)
    ].filter(
        (edge, index, edges) =>
            edges.findIndex(
                item => item.id === edge.id
            ) === index
    );

    if (relatedEdges.length === 0) {
        return null;
    }

    const names = [
        vertex.name,
        ...relatedEdges.flatMap(
            edge => [
                edge.caller,
                edge.callee
            ]
        )
    ];
    const uniqueNames =
        [...new Set(names)].slice(0, 8);
    const allowed = new Set(uniqueNames);

    return Object.freeze({
        nodes: Object.freeze(
            uniqueNames.map(name => {
                const item =
                    graph.getVertex(name);

                return Object.freeze({
                    id: name,
                    label:
                        item?.sourceName ??
                        sourceFunctionName(name),
                    current:
                        name === vertex.name,
                    location:
                        freezeLocation(
                            item?.node?.location
                        )
                });
            })
        ),
        edges: Object.freeze(
            relatedEdges
                .filter(edge =>
                    allowed.has(edge.caller) &&
                    allowed.has(edge.callee)
                )
                .map(edge =>
                    Object.freeze({
                        id: edge.id,
                        from: edge.caller,
                        to: edge.callee
                    })
                )
        )
    });
}

function buildInterproceduralTrace(
    model,
    costName,
    scenario
) {
    if (
        model == null ||
        costName == null
    ) {
        return null;
    }

    const traces = model
        .traceFor(costName, scenario)
        .filter(trace =>
            containsInterproceduralCall(trace)
        );

    if (traces.length === 0) {
        return null;
    }

    return Object.freeze({
        title:
            "Propagación entre funciones",
        summary:
            "Cada paso conserva la llamada, la sustitución de parámetros y el orden que pudo justificarse.",
        traces: Object.freeze(
            traces.map(
                serializeInterproceduralTrace
            )
        )
    });
}

function containsInterproceduralCall(trace) {
    return trace.children.length > 0;
}

function serializeInterproceduralTrace(trace) {
    return Object.freeze({
        id: trace.id,
        functionName:
            sourceFunctionName(
                trace.callee
            ),
        costName: trace.callee,
        caller:
            trace.caller == null
                ? null
                : Object.freeze({
                    name:
                        sourceFunctionName(
                            trace.caller
                        ),
                    costName: trace.caller
                }),
        location:
            freezeLocation(trace.location),
        kind: trace.kind,
        method: trace.method,
        result: Object.freeze({
            status: trace.status,
            notation: trace.notation,
            code: trace.code,
            message: trace.message,
            reusedFrom:
                trace.reusedFrom
        }),
        call:
            trace.call == null
                ? null
                : formula(trace.call),
        instantiated:
            trace.instantiatedExpression == null
                ? null
                : formula(
                    trace.instantiatedExpression
                ),
        bindings: Object.freeze(
            trace.bindings.map(binding =>
                Object.freeze({
                    parameter: binding.name,
                    argument: formula(
                        binding.expression
                    )
                })
            )
        ),
        missing: Object.freeze([
            ...trace.missing
        ]),
        transfer: Object.freeze({
            orderVariables: Object.freeze([
                ...trace.orderVariables
            ]),
            requiredParameters: Object.freeze([
                ...trace.requiredParameters
            ]),
            ignoredParameters: Object.freeze([
                ...trace.ignoredParameters
            ]),
            ignoredMissing: Object.freeze([
                ...trace.ignoredMissing
            ]),
            replacements: Object.freeze(
                trace.transferReplacements.map(
                    replacement =>
                        Object.freeze({
                            variable:
                                replacement.name,
                            notation:
                                replacement.order == null
                                    ? "O(?)"
                                    : formatOrder(
                                        replacement.order
                                    )
                        })
                )
            )
        }),
        extraArguments: Object.freeze(
            trace.extraArguments.map(
                formula
            )
        ),
        children: Object.freeze(
            trace.children.map(
                serializeInterproceduralTrace
            )
        )
    });
}

function buildRecurrenceSummary(analysis) {
    if (analysis == null) {
        return null;
    }

    return Object.freeze({
        status: analysis.status,
        scenario:
            analysis.scenario ?? null,
        method: analysis.method,
        boundKind:
            analysis.boundKind ??
            "tight",
        tight:
            analysis.tight ??
            analysis.boundKind !== "upper",
        characteristic:
            analysis.characteristic ??
            null,
        evidence:
            freezeStrings(
                analysis.evidence ?? []
            )
    });
}

function asymptoticLatex(notation) {
    const text = String(notation);

    if (text === "No determinado") {
        return "\\text{No determinado}";
    }

    if (text === "O(?)") {
        return "\\mathcal{O}\\left(?\\right)";
    }

    const match = text.match(
        /^([OΘΩ])\((.*)\)$/
    );

    if (match == null) {
        return "\\text{Resultado no representable}";
    }

    const [, operator, expression] =
        match;
    const latexOperator =
        operator === "Θ"
            ? "\\Theta"
            : operator === "Ω"
                ? "\\Omega"
                : "\\mathcal{O}";

    const content = replaceIteratedLogs(
        expression
        .replace(
            /([A-Za-z][A-Za-z0-9_]*)\^\(([-0-9.]+) log_([-0-9.]+) \1 \+ ([-0-9.]+)\)/g,
            (_, name, coefficient, base, exponent) =>
                `{${name}}^{${coefficient} \\log_{${base}}(${name}) + ${exponent}}`
        )
    )
        .replace(
            /\blog\s+([A-Za-z][A-Za-z0-9_]*)/g,
            "\\log\\left($1\\right)"
        )
        .replace(/([A-Za-z][A-Za-z0-9_]*)\^([^\s+]+)/g, "{$1}^{$2}")
        .replaceAll("!", "!");

    return `${latexOperator}\\left(${content}\\right)`;
}

function replaceIteratedLogs(expression) {
    return String(expression).replace(
        /\b((?:log\s+){2,})([A-Za-z][A-Za-z0-9_]*)/g,
        (_, prefix, name) => {
            const count =
                prefix.match(/log/g)
                    ?.length ?? 0;
            let latex = name;

            for (
                let index = 0;
                index < count;
                index++
            ) {
                latex =
                    `\\log\\left(${latex}\\right)`;
            }

            return latex;
        }
    );
}

function combineStatuses(statuses) {
    if (
        statuses.length > 0 &&
        statuses.every(
            status =>
                status ===
                ComplexityReportStatus.KNOWN
        )
    ) {
        return ComplexityReportStatus.KNOWN;
    }

    if (statuses.length === 0) {
        return ComplexityReportStatus.UNKNOWN;
    }

    if (
        statuses.every(
            status =>
                status ===
                ComplexityReportStatus.UNKNOWN
        )
    ) {
        return ComplexityReportStatus.UNKNOWN;
    }

    if (
        !statuses.includes(
            ComplexityReportStatus.UNKNOWN
        ) &&
        statuses.includes(
            ComplexityReportStatus.CONDITIONAL
        )
    ) {
        return ComplexityReportStatus.CONDITIONAL;
    }

    return ComplexityReportStatus.PARTIAL;
}

function sourceFunctionName(name) {
    const value = String(name);

    return value.startsWith("T")
        ? value.slice(1)
        : value;
}

function freezeLocation(location) {
    return location == null
        ? null
        : Object.freeze({
            ...location
        });
}

function freezeStrings(values) {
    return Object.freeze([
        ...new Set(
            values.map(String)
        )
    ]);
}

function requireCostReport(report) {
    if (
        !Array.isArray(
            report?.statementsCost
        )
    ) {
        throw new TypeError(
            "ComplexityReportBuilder requires a cost report."
        );
    }
}
