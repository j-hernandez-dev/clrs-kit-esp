import {
    findDiagramNodeAtLocation,
    getDiagramNodes
} from "../interaction/DiagramSelection.js";
import {
    DIAGRAM_NODE_ROLES,
    getDiagramEdges
} from "../visitor/DiagramEditableIdentity.js";

const STATE_FLOW_KINDS = new Set([
    "wait",
    "resume",
    "idle",
    "paused"
]);

const PASS_THROUGH_NODE_TYPES = new Set([
    "merge"
]);

// La navegación sigue prefiriendo la declaración. La secuencia visual,
// en cambio, resuelve primero la identidad estructural normalizada.
export function findDiagramExecutionNode(
    diagram,
    step
) {
    const presentationNodeId =
        step?.presentation?.nodeId;

    if (presentationNodeId != null) {
        return getDiagramNodes(diagram)
            .find(node =>
                node.id === presentationNodeId
            ) ?? null;
    }

    const node = findDiagramNodeAtLocation(
        diagram,
        step?.location
    );

    if (
        !node ||
        (
            step?.flow &&
            !["statement", "return"]
                .includes(step.flow.kind)
        )
    ) {
        return node;
    }

    return getDiagramNodes(diagram)
        .find(candidate =>
            candidate.type === "call" &&
            candidate.synthetic === true &&
            candidate.reference?.name ===
                "PRINCIPAL" &&
            candidate.location?.startLine ===
                step.location?.startLine &&
            candidate.location?.startColumn ===
                step.location?.startColumn
        ) ?? node;
}

/**
 * Deriva la única secuencia que consume el diagramador. No modifica la
 * traza del runtime: agrega exclusivamente pasos estructurales existentes en
 * el modelo y deja en cada paso la transición entrante que lo hizo alcanzable.
 */
export function createDiagramPlaybackTrace(
    diagram,
    trace
) {
    if (!diagram) {
        return {
            ...trace,
            steps: []
        };
    }

    const model = createExecutionModel(diagram);
    const rawSteps = trace?.steps ?? [];
    const visualSteps = [];
    const lastByContextAndScope = new Map();
    const lastByScope = new Map();
    const framesByContext = new Map();
    let nextSyntheticFrameId =
        rawSteps.reduce(
            (maximum, step) => Math.max(
                maximum,
                Number.isSafeInteger(
                    step?.flow?.frameId
                )
                    ? step.flow.frameId
                    : 0
            ),
            0
        ) + 1;
    let activeContextId = 0;
    let lastGlobalNodeId = null;
    let presentationState = null;

    const setLastNode = (
        contextId,
        scope,
        nodeId,
        frame = null
    ) => {
        lastByContextAndScope.set(
            contextScopeKey(
                contextId,
                scope.id,
                frame?.id ?? null
            ),
            nodeId
        );
        if (!frame) {
            lastByScope.set(scope.id, nodeId);
        }

        if (scope === model.globalScope) {
            lastGlobalNodeId = nodeId;
        }
    };

    const getLastNode = (
        contextId,
        scope,
        frame = null
    ) => lastByContextAndScope.get(
        contextScopeKey(
            contextId,
            scope.id,
            frame?.id ?? null
        )
    ) ?? (
        frame
            ? null
            : lastByScope.get(scope.id) ?? null
    );

    const append = ({
        node,
        rawStep = null,
        kind = null,
        contextId = 0,
        frame = null,
        transitionKind = "none",
        edges = []
    }) => {
        if (!node) {
            return null;
        }

        const visualStep = {
            index: visualSteps.length,
            location:
                rawStep?.location
                    ? { ...rawStep.location }
                    : null,
            ...(rawStep?.flow
                ? { flow: { ...rawStep.flow } }
                : {}),
            presentation: {
                kind:
                    kind ??
                    getPresentationKind(node),
                nodeId: node.id,
                contextId,
                ...(frame?.id != null
                    ? { frameId: frame.id }
                    : {}),
                ...(frame?.parentFrameId != null
                    ? {
                        parentFrameId:
                            frame.parentFrameId
                    }
                    : {}),
                originIndex:
                    Number.isInteger(rawStep?.index)
                        ? rawStep.index
                        : null,
                incomingTransition: {
                    kind: transitionKind,
                    edgeIds: edges
                        .map(edge =>
                            edge.identity?.modelId
                        )
                        .filter(Boolean)
                },
                ...(node.identity?.scopeId
                    ? {
                        scopeId:
                            node.identity.scopeId
                    }
                    : {}),
                ...(kind === "function-entry"
                    ? {
                        functionName:
                            rawStep?.flow
                                ?.functionName ??
                            model.scopeByNode
                                .get(node.id)
                                ?.title ??
                            node.label
                    }
                    : {})
            }
        };

        visualSteps.push(visualStep);

        const scope = model.scopeByNode.get(node.id);
        if (scope) {
            setLastNode(
                contextId,
                scope,
                node.id,
                frame
            );
        }

        return visualStep;
    };

    const appendPath = (
        path,
        target,
        rawStep,
        contextId,
        frame = null
    ) => {
        let pendingEdges = [];

        for (const edge of path) {
            pendingEdges.push(edge);
            const node = model.byId.get(
                edge.target
            );

            if (!node) {
                continue;
            }

            const isTarget =
                node.id === target.id;

            if (
                !isTarget &&
                !isVisualStructuralNode(node)
            ) {
                continue;
            }

            append({
                node,
                rawStep:
                    isTarget
                        ? rawStep
                        : null,
                contextId,
                frame,
                transitionKind: "model-path",
                edges: pendingEdges
            });
            pendingEdges = [];
        }
    };

    const appendObservedNode = (
        node,
        rawStep,
        contextId,
        frame = null
    ) => {
        const scope = model.scopeByNode.get(node.id);
        if (!scope) {
            return null;
        }

        const previousId = getLastNode(
            contextId,
            scope,
            frame
        ) ?? findScopeEntryNode(scope)?.id ?? null;
        const path = previousId &&
            previousId !== node.id
            ? structuralPath(
                previousId,
                node.id,
                model
            )
            : [];
        const includesForPreparation =
            path.some(edge =>
                model.byId.get(edge.target)
                    ?.identity?.role ===
                DIAGRAM_NODE_ROLES
                    .FOR_PREPARATION
            );

        if (
            previousId &&
            previousId !== node.id &&
            path.length > 0
        ) {
            if (
                includesForPreparation &&
                node.identity?.role ===
                    DIAGRAM_NODE_ROLES
                        .LOOP_DECISION
            ) {
                const preparationIndex =
                    path.findIndex(edge =>
                        model.byId.get(edge.target)
                            ?.identity?.role ===
                        DIAGRAM_NODE_ROLES
                            .FOR_PREPARATION
                    );
                const preparation =
                    model.byId.get(
                        path[preparationIndex]
                            .target
                    );

                // El incremento y la condición de `para`
                // comparten coordenada fuente. Tras el cuerpo,
                // el primer evento representa la actualización:
                // termina en Preparación por `loop-back`.
                // El evento siguiente representará por separado
                // la evaluación y recorrerá Preparación ->
                // Decisión por `sequence`.
                appendPath(
                    path.slice(
                        0,
                        preparationIndex + 1
                    ),
                    preparation,
                    rawStep,
                    contextId,
                    frame
                );

                return visualSteps.at(-1) ?? null;
            }

            appendPath(
                path,
                node,
                rawStep,
                contextId,
                frame
            );

            return visualSteps.at(-1) ?? null;
        }

        return append({
            node,
            rawStep,
            contextId,
            frame,
            transitionKind:
                previousId &&
                previousId !== node.id
                    ? "gap"
                    : "none"
        });
    };

    const annotateLastStep = (
        rawStep,
        frame = null
    ) => {
        const stepIndex = frame
            ? visualSteps.findLastIndex(step =>
                step.presentation?.frameId ===
                    frame.id
            )
            : visualSteps.length - 1;
        const lastStep = visualSteps[stepIndex];
        if (!lastStep || !rawStep?.flow) {
            return;
        }

        visualSteps[stepIndex] = {
            ...lastStep,
            flow: { ...rawStep.flow },
            presentation: {
                ...lastStep.presentation,
                stateOriginIndex:
                    Number.isInteger(rawStep.index)
                        ? rawStep.index
                        : null
            }
        };
    };

    const hasExecution =
        trace?.traceId != null ||
        rawSteps.length > 0 ||
        trace?.status === "correct";
    const globalEntry = findScopeEntryNode(
        model.globalScope
    );

    if (hasExecution && globalEntry) {
        append({
            node: globalEntry,
            kind: "entry",
            contextId: 0
        });
    }

    for (const rawStep of rawSteps) {
        const flowKind = rawStep?.flow?.kind;

        if (STATE_FLOW_KINDS.has(flowKind)) {
            const stateNode =
                findDiagramExecutionNode(
                    diagram,
                    rawStep
                );
            const contextId = resolveContextId(
                rawStep,
                activeContextId,
                framesByContext
            );
            presentationState = {
                flow: { ...rawStep.flow },
                nodeId: stateNode?.id ?? null,
                contextId,
                ...(rawStep.flow.frameId != null
                    ? {
                        frameId:
                            rawStep.flow.frameId
                    }
                    : {}),
                originIndex:
                    Number.isInteger(rawStep.index)
                        ? rawStep.index
                        : null
            };
            continue;
        }

        presentationState = null;

        if (flowKind === "enter") {
            const contextId = rawStep.flow.contextId;
            const scope = model.functionScopes.get(
                rawStep.flow.functionName
            );
            const entry = findScopeEntryNode(scope);
            const stack = getContextFrames(
                framesByContext,
                contextId
            );
            const parentFrame = resolveParentFrame(
                stack,
                rawStep.flow.parentFrameId
            );
            const frame = {
                id:
                    rawStep.flow.frameId ??
                    nextSyntheticFrameId++,
                parentFrameId:
                    rawStep.flow.parentFrameId ??
                    parentFrame?.id ??
                    null,
                scopeId: scope?.id ?? null,
                functionName:
                    rawStep.flow.functionName
            };

            activeContextId = contextId;
            stack.push(frame);
            if (entry) {
                append({
                    node: entry,
                    rawStep,
                    kind: "function-entry",
                    contextId,
                    frame,
                    transitionKind: "inter-scope"
                });
            }
            continue;
        }

        if (flowKind === "return") {
            const contextId = rawStep.flow.contextId;
            const scope = model.functionScopes.get(
                rawStep.flow.functionName
            );
            const stack = getContextFrames(
                framesByContext,
                contextId
            );
            const frame = resolveReturningFrame(
                stack,
                rawStep.flow.frameId,
                scope?.id
            );
            const previousId = scope
                ? getLastNode(
                    contextId,
                    scope,
                    frame
                )
                : null;
            const previous = model.byId.get(
                previousId
            );
            const terminal = findScopeEndNode(scope);

            if (
                terminal &&
                previous &&
                previous.identity?.role !==
                    DIAGRAM_NODE_ROLES
                        .EXPLICIT_RETURN &&
                !["error", "cancelled"]
                    .includes(trace?.status)
            ) {
                const path = structuralPath(
                    previous.id,
                    terminal.id,
                    model
                );

                if (
                    previous.id === terminal.id
                ) {
                    annotateLastStep(rawStep, frame);
                } else if (path.length > 0) {
                    appendPath(
                        path,
                        terminal,
                        rawStep,
                        contextId,
                        frame
                    );
                }
            } else {
                annotateLastStep(rawStep, frame);
            }

            popFunctionFrame(
                stack,
                frame?.id
            );
            activeContextId = contextId;
            continue;
        }

        const node = findDiagramExecutionNode(
            diagram,
            rawStep
        );
        if (!node) {
            continue;
        }

        const contextId = resolveContextId(
            rawStep,
            activeContextId,
            framesByContext
        );
        activeContextId = contextId;
        const frame = resolveActiveFrame(
            framesByContext.get(contextId),
            rawStep?.flow?.frameId
        );

        appendObservedNode(
            node,
            rawStep,
            contextId,
            frame
        );
    }

    if (
        trace?.status === "correct" &&
        trace?.truncated !== true
    ) {
        const globalEnd = findScopeEndNode(
            model.globalScope
        );
        const previousId =
            lastGlobalNodeId ??
            globalEntry?.id ??
            null;

        if (
            globalEnd &&
            previousId &&
            previousId !== globalEnd.id
        ) {
            const path = structuralPath(
                previousId,
                globalEnd.id,
                model
            );
            if (path.length > 0) {
                appendPath(
                    path,
                    globalEnd,
                    null,
                    0
                );
            }
        }
    }

    return {
        ...trace,
        steps: visualSteps,
        presentationState:
            trace?.status === "running"
                ? presentationState
                : null
    };
}

/**
 * El estado visual es un plegado puro del prefijo normalizado. No completa
 * terminales ni entradas por una ruta paralela.
 */
export function projectDiagramExecutionEdges(
    diagram,
    steps,
    nodes,
    lastIndex,
    presentationState = null
) {
    const edgeById = new Map(
        getDiagramEdges(diagram)
            .map(edge => [
                edge.identity?.modelId,
                edge
            ])
    );
    const visited = new Set();
    const visitedNodeIds = new Set();
    const boundedIndex = Math.min(
        lastIndex,
        steps.length - 1
    );

    for (
        let index = 0;
        index <= boundedIndex;
        index += 1
    ) {
        // El destino del prefijo es activo, no visitado por el mero hecho de
        // ser el paso actual. Si la misma figura apareció antes (por ejemplo,
        // al reevaluar un ciclo), conserva correctamente ambos estados.
        if (index < boundedIndex) {
            const nodeId = nodes[index]?.id;
            if (nodeId != null) {
                visitedNodeIds.add(nodeId);
            }
        }

        for (
            const edgeId of getIncomingEdgeIds(
                steps[index]
            )
        ) {
            const edge = edgeById.get(edgeId);
            if (edge) {
                visited.add(edge);
            }
        }
    }

    const activeStep =
        boundedIndex >= 0
            ? steps[boundedIndex]
            : null;
    const sequenceActiveNode =
        boundedIndex >= 0
            ? nodes[boundedIndex] ?? null
            : null;
    const showsLiveState =
        boundedIndex === steps.length - 1 &&
        presentationState?.flow;
    const activeNode = showsLiveState
        ? presentationState.flow.kind === "idle"
            ? null
            : getDiagramNodes(diagram).find(node =>
                node.id === presentationState.nodeId
            ) ?? sequenceActiveNode
        : sequenceActiveNode;

    if (
        sequenceActiveNode &&
        sequenceActiveNode.id !== activeNode?.id
    ) {
        visitedNodeIds.add(sequenceActiveNode.id);
    }

    const activePath = (
        activeNode?.id === sequenceActiveNode?.id
            ? getIncomingEdgeIds(activeStep)
            : []
    )
        .map(edgeId => edgeById.get(edgeId))
        .filter(Boolean);
    const isIdle =
        showsLiveState
            ? presentationState.flow.kind === "idle"
            : activeStep?.flow?.kind === "idle";

    return {
        visited: [...visited],
        visitedNodeIds: [...visitedNodeIds],
        activePath,
        activeNode,
        sequenceActiveNode,
        activeTargetId:
            isIdle
                ? null
                : activeNode?.id ?? null,
        activeFocusId:
            isIdle
                ? null
                : activeNode?.id ?? null
    };
}

function createExecutionModel(diagram) {
    const graphs = [
        diagram,
        ...(diagram?.subgraphs ?? [])
    ];
    const nodes = getDiagramNodes(diagram);
    const edges = getDiagramEdges(diagram);
    const byId = new Map(
        nodes.map(node => [node.id, node])
    );
    const scopeByNode = new Map();
    const graphById = new Map();
    const outgoing = new Map();

    for (const graph of graphs) {
        const graphId = graph.id ?? "__main__";
        graphById.set(graphId, graph);
        for (const node of graph.nodes ?? []) {
            scopeByNode.set(node.id, graph);
        }
    }

    for (const edge of edges) {
        if (!outgoing.has(edge.source)) {
            outgoing.set(edge.source, []);
        }
        outgoing.get(edge.source).push(edge);
    }

    const globalEntry = nodes.find(node =>
        node.identity?.role ===
            DIAGRAM_NODE_ROLES.GLOBAL_START
    );
    const globalScope =
        scopeByNode.get(globalEntry?.id) ??
        graphById.get("top_level") ??
        diagram;
    const functionScopes = new Map();

    for (const graph of graphs) {
        const entry = graph.nodes?.find(node =>
            node.identity?.role ===
                DIAGRAM_NODE_ROLES
                    .FUNCTION_START
        );
        if (entry) {
            functionScopes.set(
                graph.title ??
                    entry.label.replace(/\(.*/u, ""),
                graph
            );
        }
    }

    return {
        byId,
        outgoing,
        scopeByNode,
        globalScope,
        functionScopes
    };
}

function findScopeEntryNode(graph) {
    return graph?.nodes?.find(node =>
        [
            DIAGRAM_NODE_ROLES.GLOBAL_START,
            DIAGRAM_NODE_ROLES.FUNCTION_START
        ].includes(node.identity?.role)
    ) ?? graph?.nodes?.find(node =>
        node.type === "start"
    ) ?? null;
}

function findScopeEndNode(graph) {
    return graph?.nodes?.find(node =>
        [
            DIAGRAM_NODE_ROLES.GLOBAL_END,
            DIAGRAM_NODE_ROLES.FUNCTION_END
        ].includes(node.identity?.role)
    ) ?? null;
}

function getPresentationKind(node) {
    switch (node.identity?.role) {
        case DIAGRAM_NODE_ROLES.GLOBAL_START:
            return "entry";
        case DIAGRAM_NODE_ROLES.GLOBAL_END:
            return "end";
        case DIAGRAM_NODE_ROLES.FUNCTION_START:
            return "function-entry";
        case DIAGRAM_NODE_ROLES.FUNCTION_END:
            return "function-end";
        case DIAGRAM_NODE_ROLES.EXPLICIT_RETURN:
            return "return";
        case DIAGRAM_NODE_ROLES.FOR_PREPARATION:
            return "for-preparation";
        case DIAGRAM_NODE_ROLES.LOOP_DECISION:
            return "loop-decision";
        default:
            return "runtime";
    }
}

function isVisualStructuralNode(node) {
    return [
        DIAGRAM_NODE_ROLES.FOR_PREPARATION,
        DIAGRAM_NODE_ROLES.LOOP_DECISION,
        DIAGRAM_NODE_ROLES.GLOBAL_END,
        DIAGRAM_NODE_ROLES.FUNCTION_END
    ].includes(node.identity?.role);
}

function structuralPath(
    from,
    to,
    model,
    seen = new Set()
) {
    if (seen.has(from)) {
        return [];
    }

    const nextSeen = new Set(seen);
    nextSeen.add(from);
    const candidates = [];

    for (
        const edge of model.outgoing.get(from) ?? []
    ) {
        if (edge.target === to) {
            candidates.push([edge]);
            continue;
        }

        const middle = model.byId.get(edge.target);
        if (!canTraverseIntermediate(middle)) {
            continue;
        }

        const rest = structuralPath(
            edge.target,
            to,
            model,
            nextSeen
        );
        if (rest.length > 0) {
            candidates.push([edge, ...rest]);
        }
    }

    return candidates.length === 1
        ? candidates[0]
        : [];
}

function canTraverseIntermediate(node) {
    return Boolean(node) &&
        (
            PASS_THROUGH_NODE_TYPES.has(
                node.type
            ) ||
            node.identity?.role ===
                DIAGRAM_NODE_ROLES
                    .FOR_PREPARATION
        );
}

function getIncomingEdgeIds(step) {
    return step?.presentation
        ?.incomingTransition
        ?.edgeIds ?? [];
}

function contextScopeKey(
    contextId,
    scopeId,
    frameId
) {
    return `${contextId}:${frameId ?? "global"}:${scopeId}`;
}

function resolveContextId(
    step,
    activeContextId,
    framesByContext
) {
    if (step?.flow?.contextId != null) {
        return step.flow.contextId;
    }
    if (
        framesByContext.get(activeContextId)
            ?.length > 0
    ) {
        return activeContextId;
    }

    const activeContexts = [
        ...framesByContext.entries()
    ].filter(([, frames]) =>
        frames.length > 0
    );

    return activeContexts.length === 1
        ? activeContexts[0][0]
        : activeContextId;
}

function getContextFrames(framesByContext, contextId) {
    if (!framesByContext.has(contextId)) {
        framesByContext.set(contextId, []);
    }

    return framesByContext.get(contextId);
}

function resolveActiveFrame(stack, frameId) {
    if (!stack || stack.length === 0) {
        return null;
    }

    if (frameId != null) {
        return stack.find(frame =>
            frame.id === frameId
        ) ?? null;
    }

    return stack.at(-1) ?? null;
}

function resolveParentFrame(stack, parentFrameId) {
    if (parentFrameId != null) {
        return stack.find(frame =>
            frame.id === parentFrameId
        ) ?? null;
    }

    return stack.at(-1) ?? null;
}

function resolveReturningFrame(
    stack,
    frameId,
    scopeId
) {
    if (!stack || stack.length === 0) {
        return null;
    }

    if (frameId != null) {
        return [...stack].reverse().find(frame =>
            frame.id === frameId
        ) ?? null;
    }

    return [...stack].reverse().find(frame =>
        frame.scopeId === scopeId
    ) ?? stack.at(-1) ?? null;
}

function popFunctionFrame(stack, frameId) {
    if (!stack || frameId == null) {
        return;
    }

    const index = stack.findLastIndex(frame =>
        frame.id === frameId
    );
    if (index >= 0) {
        stack.splice(index, 1);
    }
}
