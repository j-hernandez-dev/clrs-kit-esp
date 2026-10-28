import {
    findDiagramNodeAtLocation,
    getDiagramNodes
} from "./DiagramSelection.js";
import {
    DIAGRAM_ENTITY_TYPES,
    findDiagramEntityByIdentity,
    getDiagramEdges,
    isEditableDiagramEntity
} from "../visitor/DiagramEditableIdentity.js";
import { findDiagramExecutionNode, projectDiagramExecutionEdges } from "../execution/DiagramExecutionProjection.js";

const INTERACTIVE_CLASS =
    "clrs-diagram-node-interactive";
const EDITABLE_CLASS =
    "clrs-diagram-entity-editable";
const EDGE_EDITABLE_CLASS =
    "clrs-diagram-edge-editable";
const EDGE_HITBOX_CLASS =
    "clrs-diagram-edge-hitbox";
const EDGE_MARKER_CLASS =
    "clrs-diagram-edge-marker";
const EDGE_MARKER_ACTIVE_CLASS =
    "clrs-diagram-edge-marker-active";
const EDGE_MARKER_SELECTED_CLASS =
    "clrs-diagram-edge-marker-selected";
const SELECTED_CLASS =
    "clrs-diagram-entity-selected";
const ACTIVE_CLASS =
    "clrs-diagram-node-active";
const SEARCH_MATCH_CLASS =
    "clrs-diagram-search-match";
const SEARCH_ACTIVE_CLASS =
    "clrs-diagram-search-active";
const EXECUTION_VISITED_CLASS =
    "clrs-diagram-execution-visited";
const EXECUTION_ACTIVE_CLASS =
    "clrs-diagram-execution-active";
const EXECUTION_LIVE_CLASS =
    "clrs-diagram-execution-live";
const EXECUTION_ERROR_CLASS =
    "clrs-diagram-execution-error";
const EXECUTION_WAITING_CLASS = "clrs-diagram-execution-waiting";
const DIAGNOSTIC_ERROR_CLASS =
    "clrs-diagram-diagnostic-error";
const COVERAGE_COVERED_CLASS =
    "clrs-diagram-coverage-covered";
const COVERAGE_PARTIAL_CLASS =
    "clrs-diagram-coverage-partial";
const COVERAGE_UNCOVERED_CLASS =
    "clrs-diagram-coverage-uncovered";
const COVERAGE_UNKNOWN_CLASS =
    "clrs-diagram-coverage-unknown";
const COVERAGE_CLASSES = Object.freeze([
    COVERAGE_COVERED_CLASS,
    COVERAGE_PARTIAL_CLASS,
    COVERAGE_UNCOVERED_CLASS,
    COVERAGE_UNKNOWN_CLASS
]);

let edgeMarkerSequence = 0;
const executionStrokeOverrides = new WeakMap();

// Mermaid impone stroke con !important tanto inline como bajo el ID del SVG.
// Durante el resaltado se usa el estado CSS; al limpiar se restaura el tema exacto.
function applyExecutionStroke(element) {
    if (!element || executionStrokeOverrides.has(element)) { return; }
    const saved = [];
    const shapes = element.matches?.(".flowchart-link") ? [element] : element.querySelectorAll?.(
        ":scope > :is(rect, polygon, path, circle, ellipse), :scope > g > :is(rect, polygon, path, circle, ellipse)"
    ) ?? [];
    for (const shape of shapes) {
        for (const property of ["stroke", "stroke-width"]) {
            if (!shape.style) { continue; }
            const value = shape.style.getPropertyValue(property);
            const priority = shape.style.getPropertyPriority(property);
            saved.push({ shape, property, value, priority });
            const stateValue = property === "stroke-width" && shape === element
                ? "var(--clrs-edge-stroke-width, var(--clrs-execution-stroke-width))"
                : `var(--clrs-execution-${property})`;
            shape.style.setProperty(property, stateValue, "important");
        }
    }
    executionStrokeOverrides.set(element, saved);
}

function restoreExecutionStroke(element) {
    for (const { shape, property, value, priority } of executionStrokeOverrides.get(element) ?? []) {
        shape.style.setProperty(property, value, priority);
    }
    executionStrokeOverrides.delete(element);
}

export function bindDiagramInteractions({
    svgElement,
    diagram,
    onNodeSelect,
    onEntitySelect
}) {
    const bindings = [];
    const nonEditableMarkers = [];

    for (
        const node
        of getDiagramNodes(diagram)
    ) {
        const editable =
            isEditableDiagramEntity(node);

        // Los finales implícitos no tienen una instrucción propia en la
        // fuente, pero sí materializan un `retornar` al editarlos. Por eso
        // deben conservar interacción aunque todavía no posean `location`.
        if (
            node.location?.startLine == null &&
            !editable
        ) {
            continue;
        }

        const element =
            findNodeElement(
                svgElement,
                node.id
            );

        if (!element) {
            continue;
        }

        const activate = event => {
            event?.preventDefault?.();
            event?.stopPropagation?.();

            if (editable && onEntitySelect) {
                onEntitySelect(node);
                return;
            }

            onNodeSelect?.(node);
        };
        const handleKeyDown = event => {
            if (
                event?.key === "Enter" ||
                event?.key === " "
            ) {
                activate(event);
                return;
            }

            if (
                editable &&
                event?.key === "Escape"
            ) {
                event?.preventDefault?.();
                event?.stopPropagation?.();
                onEntitySelect?.(null);
            }
        };
        const stopPointerSelection = event => {
            event?.stopPropagation?.();
        };

        element.classList.add(
            INTERACTIVE_CLASS
        );

        if (editable) {
            prepareEditableElement(
                element,
                node.identity
            );
        }

        element.setAttribute(
            "role",
            "button"
        );
        element.setAttribute(
            "tabindex",
            "0"
        );
        element.setAttribute(
            "aria-label",
            editable
                ? getEditableNodeLabel(node)
                : getAccessibleLabel(node)
        );
        element.addEventListener(
            "click",
            activate
        );
        element.addEventListener(
            "keydown",
            handleKeyDown
        );
        element.addEventListener(
            "mousedown",
            stopPointerSelection
        );

        const title = appendTitle(
            element,
            editable
                ? "Seleccionar figura para editar. " +
                    getLocationLabel(
                        node.location
                    )
                : getLocationLabel(
                    node.location
                )
        );

        bindings.push({
            element,
            activate,
            handleKeyDown,
            stopPointerSelection,
            title
        });
    }

    for (const edge of getDiagramEdges(diagram)) {
        if (!isEditableDiagramEntity(edge)) {
            const element = findEdgeElement(svgElement, edge.identity?.modelId);
            if (element) {
                nonEditableMarkers.push(createEditableEdgeMarker({
                    svgElement, element, identityId: edge.identity?.id
                }));
            }
            continue;
        }

        const element = findEdgeElement(
            svgElement,
            edge.identity.modelId
        );

        if (!element) {
            continue;
        }

        const activate = event => {
            event?.preventDefault?.();
            event?.stopPropagation?.();
            onEntitySelect?.(edge);
        };
        const handleKeyDown = event => {
            if (
                event?.key === "Enter" ||
                event?.key === " "
            ) {
                activate(event);
                return;
            }

            if (event?.key === "Escape") {
                event?.preventDefault?.();
                event?.stopPropagation?.();
                onEntitySelect?.(null);
            }
        };
        const stopPointerSelection = event => {
            event?.stopPropagation?.();
        };

        prepareEditableElement(
            element,
            edge.identity
        );
        element.classList.add(
            EDGE_EDITABLE_CLASS
        );
        element.setAttribute("role", "button");
        element.setAttribute("tabindex", "0");
        element.setAttribute(
            "aria-label",
            getEditableEdgeLabel(edge)
        );
        element.addEventListener(
            "click",
            activate
        );
        element.addEventListener(
            "keydown",
            handleKeyDown
        );
        element.addEventListener(
            "mousedown",
            stopPointerSelection
        );
        const hitTarget =
            createEdgeHitTarget(element);
        const markerBinding =
            createEditableEdgeMarker({
                svgElement,
                element,
                hitTarget,
                identityId: edge.identity.id
            });

        hitTarget?.addEventListener(
            "click",
            activate
        );
        hitTarget?.addEventListener(
            "mousedown",
            stopPointerSelection
        );

        const title = appendTitle(
            element,
            "Seleccionar conexión para insertar una figura"
        );

        bindings.push({
            element,
            activate,
            handleKeyDown,
            stopPointerSelection,
            hitTarget,
            markerBinding,
            title
        });
    }

    const clearSelection = event => {
        if (
            event?.target?.closest?.(
                `.${EDITABLE_CLASS}`
            )
        ) {
            return;
        }

        onEntitySelect?.(null);
    };

    svgElement?.addEventListener?.(
        "click",
        clearSelection
    );

    return {
        dispose() {
            for (const marker of nonEditableMarkers) { marker?.dispose(); }
            for (const binding of bindings) {
                binding.element
                    .removeEventListener(
                        "click",
                        binding.activate
                    );
                binding.element
                    .removeEventListener(
                        "keydown",
                        binding.handleKeyDown
                    );
                binding.element
                    .removeEventListener(
                        "mousedown",
                        binding
                            .stopPointerSelection
                    );
                binding.element
                    .classList.remove(
                        INTERACTIVE_CLASS,
                        EDITABLE_CLASS,
                        EDGE_EDITABLE_CLASS,
                        SELECTED_CLASS,
                        ACTIVE_CLASS,
                        SEARCH_MATCH_CLASS,
                        SEARCH_ACTIVE_CLASS,
                        EXECUTION_VISITED_CLASS,
                        EXECUTION_ACTIVE_CLASS,
                        EXECUTION_LIVE_CLASS,
                        EXECUTION_ERROR_CLASS,
                        EXECUTION_WAITING_CLASS,
                        DIAGNOSTIC_ERROR_CLASS,
                        ...COVERAGE_CLASSES
                    );
                binding.hitTarget
                    ?.removeEventListener(
                        "click",
                        binding.activate
                    );
                binding.hitTarget
                    ?.removeEventListener(
                        "mousedown",
                        binding
                            .stopPointerSelection
                    );
                binding.hitTarget?.remove?.();
                binding.markerBinding
                    ?.dispose?.();
                binding.element.removeAttribute?.(
                    "data-clrs-identity-id"
                );
                binding.element.removeAttribute?.(
                    "data-clrs-entity-type"
                );
                binding.element.removeAttribute?.(
                    "aria-pressed"
                );
                binding.title?.remove?.();
            }

            svgElement?.removeEventListener?.(
                "click",
                clearSelection
            );
        }
    };
}

export function highlightDiagramEntitySelection({
    svgElement,
    diagram,
    identityId = null
}) {
    for (
        const element
        of svgElement?.querySelectorAll?.(
            `.${SELECTED_CLASS}`
        ) ?? []
    ) {
        element.classList.remove(
            SELECTED_CLASS
        );
        element.setAttribute?.(
            "aria-pressed",
            "false"
        );
    }

    for (
        const marker
        of svgElement?.querySelectorAll?.(
            `.${EDGE_MARKER_SELECTED_CLASS}`
        ) ?? []
    ) {
        marker.classList.remove(
            EDGE_MARKER_SELECTED_CLASS
        );
    }

    if (!identityId) {
        return null;
    }

    const entity =
        findDiagramEntityByIdentity(
            diagram,
            identityId
        );

    if (!isEditableDiagramEntity(entity)) {
        return null;
    }

    const element =
        entity.identity.entityType ===
            DIAGRAM_ENTITY_TYPES.NODE
            ? findNodeElement(
                svgElement,
                entity.id
            )
            : findEdgeElement(
                svgElement,
                entity.identity.modelId
            );

    element?.classList.add(SELECTED_CLASS);
    element?.setAttribute(
        "aria-pressed",
        "true"
    );

    if (
        entity.identity.entityType ===
            DIAGRAM_ENTITY_TYPES.EDGE
    ) {
        findEditableEdgeMarker(
            svgElement,
            element
        )?.classList.add(
            EDGE_MARKER_SELECTED_CLASS
        );
    }

    return element ? entity : null;
}

export function highlightDiagramSearch({
    svgElement,
    matches = [],
    activeNodeId = null
}) {
    for (
        const element
        of svgElement
            ?.querySelectorAll?.(
                `.${SEARCH_MATCH_CLASS}, ` +
                `.${SEARCH_ACTIVE_CLASS}`
            ) ?? []
    ) {
        element.classList.remove(
            SEARCH_MATCH_CLASS,
            SEARCH_ACTIVE_CLASS
        );
    }

    for (const node of matches) {
        const element =
            findNodeElement(
                svgElement,
                node.id
            );

        element?.classList.add(
            SEARCH_MATCH_CLASS
        );

        if (node.id === activeNodeId) {
            element?.classList.add(
                SEARCH_ACTIVE_CLASS
            );
        }
    }

    return activeNodeId == null
        ? null
        : matches.find(node =>
            node.id === activeNodeId
        ) ?? null;
}

export function highlightDiagramExecution({
    svgElement,
    diagram,
    steps = [],
    resolvedNodes = null,
    activeIndex = -1,
    status = "idle",
    presentationState = null
}) {
    for (
        const element
        of svgElement
            ?.querySelectorAll?.(
                `.${EXECUTION_VISITED_CLASS}, ` +
                `.${EXECUTION_ACTIVE_CLASS}, ` +
                `.${EXECUTION_LIVE_CLASS}, ` +
                `.${EXECUTION_ERROR_CLASS}, .${EXECUTION_WAITING_CLASS}`
            ) ?? []
    ) {
        restoreExecutionStroke(element);
        element.classList.remove(
            EXECUTION_VISITED_CLASS,
            EXECUTION_ACTIVE_CLASS,
            EXECUTION_LIVE_CLASS,
            EXECUTION_ERROR_CLASS,
            EXECUTION_WAITING_CLASS
        );
    }

    const lastIndex = Math.min(
        activeIndex,
        steps.length - 1
    );
    let activeElement = null;
    const executionNodes = resolvedNodes ?? steps.map(step => findDiagramExecutionNode(diagram, step));
    const executionProjection = projectDiagramExecutionEdges(
        diagram,
        steps,
        executionNodes,
        lastIndex,
        presentationState
    );
    const activeNode = executionProjection.activeNode;

    const showsLiveState =
        lastIndex === steps.length - 1 &&
        presentationState?.flow;

    for (const nodeId of executionProjection.visitedNodeIds) {
        const element = findNodeElement(
            svgElement,
            nodeId
        );
        element?.classList.add(EXECUTION_VISITED_CLASS);
        applyExecutionStroke(element);
    }

    for (const edge of executionProjection.visited) {
        const element = findEdgeElement(svgElement, edge.identity?.modelId);
        element?.classList.add(EXECUTION_VISITED_CLASS);
        applyExecutionStroke(element);
        findEditableEdgeMarker(svgElement, element)?.classList.add(EXECUTION_VISITED_CLASS);
    }

    activeElement = activeNode
        ? findNodeElement(
            svgElement,
            activeNode.id
        )
        : null;

    activeElement?.classList.add(
        EXECUTION_ACTIVE_CLASS
    );
    // El nodo activo ya no depende incidentalmente de ser también visitado
    // para neutralizar los estilos inline !important emitidos por Mermaid.
    applyExecutionStroke(activeElement);

    const isError = status === "error" && lastIndex === steps.length - 1;
    const activeFlow = showsLiveState
        ? presentationState.flow
        : steps[lastIndex]?.flow;
    const isWaiting = !isError &&
        ["wait", "paused"].includes(
            activeFlow?.kind
        );
    if (isWaiting) { activeElement?.classList.add(EXECUTION_WAITING_CLASS); }
    if (status === "running" && lastIndex === steps.length - 1 && !isWaiting) {
        activeElement?.classList.add(
            EXECUTION_LIVE_CLASS
        );
    }

    if (isError) {
        activeElement?.classList.add(
            EXECUTION_ERROR_CLASS
        );
    }

    return activeNode;
}

export function highlightDiagramDiagnostics({
    svgElement,
    diagram,
    diagnostics = []
}) {
    for (
        const element
        of svgElement
            ?.querySelectorAll?.(
                `.${DIAGNOSTIC_ERROR_CLASS}`
            ) ?? []
    ) {
        element.classList.remove(
            DIAGNOSTIC_ERROR_CLASS
        );
        element.removeAttribute?.(
            "aria-invalid"
        );
        element.removeAttribute?.(
            "data-clrs-diagnostic-count"
        );
    }

    const nodes = new Map();

    for (const diagnostic of diagnostics) {
        const node =
            findDiagramNodeAtLocation(
                diagram,
                diagnostic?.location
            );

        if (!node) {
            continue;
        }

        nodes.set(
            node.id,
            (nodes.get(node.id) ?? 0) + 1
        );
    }

    const highlighted = [];

    for (const [nodeId, count] of nodes) {
        const element = findNodeElement(
            svgElement,
            nodeId
        );

        if (!element) {
            continue;
        }

        element.classList.add(
            DIAGNOSTIC_ERROR_CLASS
        );
        element.setAttribute?.(
            "aria-invalid",
            "true"
        );
        element.setAttribute?.(
            "data-clrs-diagnostic-count",
            String(count)
        );
        highlighted.push(nodeId);
    }

    return Object.freeze(highlighted);
}

export function highlightDiagramCoverage({
    svgElement,
    diagram,
    coverage = null
}) {
    for (
        const element
        of svgElement
            ?.querySelectorAll?.(
                COVERAGE_CLASSES
                    .map(name => `.${name}`)
                    .join(", ")
            ) ?? []
    ) {
        element.classList.remove(
            ...COVERAGE_CLASSES
        );
        element.removeAttribute?.(
            "data-clrs-coverage"
        );
        element.removeAttribute?.(
            "data-clrs-coverage-hits"
        );
        element.removeAttribute?.(
            "aria-description"
        );
    }

    if (!Array.isArray(coverage?.points)) {
        return Object.freeze([]);
    }

    const pointsByNode = new Map();

    for (const point of coverage.points) {
        const node = findDiagramNodeAtLocation(
            diagram,
            point?.location
        );

        if (!node) {
            continue;
        }

        const points = pointsByNode.get(node.id) ?? [];

        points.push(point);
        pointsByNode.set(node.id, points);
    }

    const result = [];

    for (const [nodeId, points] of pointsByNode) {
        const element = findNodeElement(
            svgElement,
            nodeId
        );

        if (!element) {
            continue;
        }

        const status = coverageStatus(
            coverage,
            points
        );
        const hits = points.reduce(
            (total, point) =>
                total + point.hitCount,
            0
        );

        element.classList.add(
            coverageClass(status)
        );
        element.setAttribute?.(
            "data-clrs-coverage",
            status
        );
        element.setAttribute?.(
            "data-clrs-coverage-hits",
            String(hits)
        );
        element.setAttribute?.(
            "aria-description",
            coverageDescription(status, hits)
        );
        result.push(Object.freeze({
            nodeId,
            status,
            hitCount: hits
        }));
    }

    return Object.freeze(result);
}

function coverageStatus(coverage, points) {
    const anyHit = points.some(point =>
        point.hitCount > 0
    );

    if (!anyHit) {
        return coverage.complete &&
            !coverage.truncated
            ? "uncovered"
            : "unknown";
    }

    const allPointsHit = points.every(point =>
        point.hitCount > 0
    );
    const allOutcomesCovered = points.every(point =>
        !isCoverageCondition(point) ||
        (
            point.outcomeCounts?.true > 0 &&
            point.outcomeCounts?.false > 0
        )
    );

    return allPointsHit && allOutcomesCovered
        ? "covered"
        : "partial";
}

function isCoverageCondition(point) {
    return point.kind === "branch" ||
        point.kind === "loop";
}

function coverageClass(status) {
    return ({
        covered: COVERAGE_COVERED_CLASS,
        partial: COVERAGE_PARTIAL_CLASS,
        uncovered: COVERAGE_UNCOVERED_CLASS,
        unknown: COVERAGE_UNKNOWN_CLASS
    })[status];
}

function coverageDescription(status, hits) {
    return ({
        covered:
            `Cubierto por las pruebas; ${hits} ejecuciones.`,
        partial:
            `Cobertura parcial; ${hits} ejecuciones.`,
        uncovered:
            "No fue ejecutado por las pruebas.",
        unknown:
            "Sin evidencia concluyente de cobertura."
    })[status];
}

export function highlightDiagramLocation({
    svgElement,
    diagram,
    location
}) {
    for (
        const element
        of svgElement
            ?.querySelectorAll?.(
                `.${ACTIVE_CLASS}`
            ) ?? []
    ) {
        element.classList.remove(
            ACTIVE_CLASS
        );
        element.removeAttribute?.(
            "aria-current"
        );
    }

    const node =
        findDiagramNodeAtLocation(
            diagram,
            location
        );

    if (!node) {
        return null;
    }

    const element =
        findNodeElement(
            svgElement,
            node.id
        );

    element?.classList.add(ACTIVE_CLASS);
    element?.setAttribute(
        "aria-current",
        "location"
    );

    return element ? node : null;
}

export function findNodeElement(
    svgElement,
    nodeId
) {
    const expected = String(nodeId);
    const normalized = `_${expected}`;

    for (
        const element
        of svgElement
            ?.querySelectorAll?.(".node") ?? []
    ) {
        const candidates = [
            element.getAttribute?.("data-id"),
            element.getAttribute?.("id")
        ].filter(Boolean);

        if (
            candidates.some(candidate =>
                candidate === expected ||
                candidate === normalized ||
                candidate.includes(
                    `-${normalized}-`
                )
            )
        ) {
            return element;
        }
    }

    return null;
}

export function findEdgeElement(
    svgElement,
    edgeId
) {
    const expected = String(edgeId);
    const normalized = `_${expected}`;

    for (
        const element
        of svgElement?.querySelectorAll?.(
            ".flowchart-link, .edgePath"
        ) ?? []
    ) {
        const candidates = [
            element.getAttribute?.("data-id"),
            element.getAttribute?.("id")
        ].filter(Boolean);

        if (
            candidates.some(candidate =>
                candidate === expected ||
                candidate === normalized
            )
        ) {
            return getEdgeInteractiveElement(
                element
            );
        }
    }

    return null;
}

function prepareEditableElement(
    element,
    identity
) {
    element.classList.add(EDITABLE_CLASS);
    element.setAttribute(
        "data-clrs-identity-id",
        identity.id
    );
    element.setAttribute(
        "data-clrs-entity-type",
        identity.entityType
    );
    element.setAttribute(
        "aria-pressed",
        "false"
    );
}

function getEdgeInteractiveElement(element) {
    if (
        element.classList?.contains?.(
            "flowchart-link"
        )
    ) {
        return element;
    }

    return element.querySelector?.(
        ".flowchart-link, path"
    ) ?? element;
}

function createEdgeHitTarget(element) {
    const parent = element?.parentNode;

    if (
        typeof element?.cloneNode !==
            "function" ||
        typeof parent?.insertBefore !==
            "function"
    ) {
        return null;
    }

    const identityId =
        element.getAttribute?.(
            "data-clrs-identity-id"
        ) ?? "";
    const hitTarget = element.cloneNode(false);

    for (const attribute of [
        "id",
        "data-id",
        "style",
        "marker-start",
        "marker-mid",
        "marker-end",
        "role",
        "tabindex",
        "aria-label",
        "aria-pressed",
        "data-clrs-identity-id",
        "data-clrs-entity-type"
    ]) {
        hitTarget.removeAttribute?.(attribute);
    }

    hitTarget.classList?.remove(
        EDGE_EDITABLE_CLASS,
        SELECTED_CLASS
    );
    hitTarget.classList?.add(
        EDITABLE_CLASS,
        EDGE_HITBOX_CLASS
    );
    hitTarget.setAttribute?.(
        "aria-hidden",
        "true"
    );
    hitTarget.setAttribute?.(
        "focusable",
        "false"
    );
    hitTarget.setAttribute?.(
        "data-clrs-edge-hitbox-for",
        identityId
    );
    parent.insertBefore(hitTarget, element);

    return hitTarget;
}

function createEditableEdgeMarker({
    svgElement,
    element,
    hitTarget,
    identityId
}) {
    const attributeReference =
        element.getAttribute?.("marker-end");
    const styleReference =
        element.style?.markerEnd ?? "";
    const markerId = readMarkerId(
        styleReference || attributeReference
    );
    const sourceMarker = findMarkerById(
        svgElement,
        markerId
    );
    const markerParent =
        sourceMarker?.parentNode;

    if (
        !sourceMarker ||
        typeof sourceMarker.cloneNode !==
            "function" ||
        typeof markerParent?.appendChild !==
            "function"
    ) {
        return null;
    }

    edgeMarkerSequence += 1;
    const safeIdentity = String(
        identityId ?? "edge"
    ).replace(/[^a-zA-Z0-9_-]+/gu, "-");
    const clonedMarker =
        sourceMarker.cloneNode(true);
    const clonedMarkerId =
        `${markerId}-clrs-${safeIdentity}-` +
        edgeMarkerSequence;
    const clonedReference =
        `url(#${clonedMarkerId})`;

    clonedMarker.setAttribute(
        "id",
        clonedMarkerId
    );
    clonedMarker.setAttribute(
        "overflow",
        "visible"
    );
    clonedMarker.classList.add(
        EDGE_MARKER_CLASS
    );
    const edgeColor = element.style?.getPropertyValue?.("--clrs-edge-theme-stroke");
    if (edgeColor) { clonedMarker.style?.setProperty?.("--clrs-edge-theme-stroke", edgeColor); }
    markerParent.appendChild(clonedMarker);

    element.setAttribute(
        "marker-end",
        clonedReference
    );
    element.setAttribute(
        "data-clrs-edge-marker-id",
        clonedMarkerId
    );

    if (styleReference) {
        element.style.markerEnd =
            clonedReference;
    }

    let pointerActive = false;
    let focusActive = false;
    const syncState = () => {
        clonedMarker.classList.toggle(
            EDGE_MARKER_ACTIVE_CLASS,
            pointerActive || focusActive
        );
    };
    const handlePointerEnter = () => {
        pointerActive = true;
        syncState();
    };
    const handlePointerLeave = () => {
        pointerActive = false;
        syncState();
    };
    const handleFocus = () => {
        focusActive = true;
        syncState();
    };
    const handleBlur = () => {
        focusActive = false;
        syncState();
    };
    const pointerTargets = [
        element,
        hitTarget
    ].filter(Boolean);

    for (const target of pointerTargets) {
        target.addEventListener?.(
            "pointerenter",
            handlePointerEnter
        );
        target.addEventListener?.(
            "pointerleave",
            handlePointerLeave
        );
    }

    element.addEventListener?.(
        "focus",
        handleFocus
    );
    element.addEventListener?.(
        "blur",
        handleBlur
    );

    return {
        marker: clonedMarker,
        dispose() {
            for (const target of pointerTargets) {
                target.removeEventListener?.(
                    "pointerenter",
                    handlePointerEnter
                );
                target.removeEventListener?.(
                    "pointerleave",
                    handlePointerLeave
                );
            }

            element.removeEventListener?.(
                "focus",
                handleFocus
            );
            element.removeEventListener?.(
                "blur",
                handleBlur
            );

            if (attributeReference == null) {
                element.removeAttribute?.(
                    "marker-end"
                );
            } else {
                element.setAttribute?.(
                    "marker-end",
                    attributeReference
                );
            }

            if (styleReference) {
                element.style.markerEnd =
                    styleReference;
            }

            element.removeAttribute?.(
                "data-clrs-edge-marker-id"
            );
            clonedMarker.remove?.();
        }
    };
}

function readMarkerId(reference) {
    return String(reference ?? "")
        .match(
            /url\(\s*["']?[^#"')]*#([^"')\s]+)["']?\s*\)/u
        )?.[1] ?? null;
}

function findMarkerById(svgElement, markerId) {
    if (!markerId) {
        return null;
    }

    for (
        const marker
        of svgElement?.querySelectorAll?.(
            "marker"
        ) ?? []
    ) {
        if (
            marker.getAttribute?.("id") ===
            markerId
        ) {
            return marker;
        }
    }

    return null;
}

function findEditableEdgeMarker(
    svgElement,
    element
) {
    return findMarkerById(
        svgElement,
        element?.getAttribute?.(
            "data-clrs-edge-marker-id"
        )
    );
}

function getEditableNodeLabel(node) {
    return (
        `Editar figura ${getFigureLabel(
            node.identity?.figure
        )}: ${String(node.label ?? "")}. ` +
        getLocationLabel(node.location)
    );
}

function getEditableEdgeLabel(edge) {
    const branch =
        edge.identity?.insertion?.branch;
    const suffix = branch && branch !== "body"
        ? `, rama ${branch}`
        : "";

    return (
        "Insertar una figura en esta conexión" +
        suffix
    );
}

function getFigureLabel(figure) {
    return ({
        return: "retorno",
        assignment: "proceso",
        read: "entrada",
        write: "salida",
        if: "decisión",
        while: "decisión en bucle",
        "for-to": "preparación ascendente",
        "for-downto":
            "preparación descendente",
        "function-call": "subproceso"
    })[figure] ?? "de diagrama";
}

function getAccessibleLabel(node) {
    return (
        `${String(node.label ?? node.type)}. ` +
        getLocationLabel(node.location)
    );
}

function getLocationLabel(location) {
    if (location?.startLine == null) {
        return "Sin instrucción asociada todavía";
    }

    return (
        `Línea ${location.startLine}, ` +
        `columna ${location.startColumn ?? 1}`
    );
}

function appendTitle(element, label) {
    const document = element.ownerDocument;

    if (
        typeof document?.createElementNS !==
        "function"
    ) {
        return null;
    }

    const title = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "title"
    );

    title.textContent = label;
    title.setAttribute(
        "data-clrs-location-title",
        "true"
    );
    element.prepend(title);

    return title;
}
