import {
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";

import PreviewToolbar from "./PreviewToolbar.jsx";
import ExecutionToolbar from "./ExecutionToolbar.jsx";
import DiagramNodeEditor from "./DiagramNodeEditor.jsx";
import DiagramInsertionEditor
    from "./DiagramInsertionEditor.jsx";
import DiagramFunctionEditor
    from "./DiagramFunctionEditor.jsx";
import DiagramEditorPresence
    from "./DiagramEditorPresence.jsx";
import DiagramCoverageLegend
    from "./DiagramCoverageLegend.jsx";
import {
    DIAGRAM_FUNCTION_IDENTITY
} from "../editor/DiagramFunctionEditorModel.js";
import {
    DEFAULT_THEME_ID,
    getTheme
} from "../themes/ThemeManager.js";
import {
    createDocumentColorResolver,
    getColorAppearance
} from "../themes/presets/VSCodeTheme.js";
import {
    renderMermaid
} from "../renderer/MermaidRenderer.js";
import {
    generateDiagram
} from "../builders/DiagramGenerator.js";
import {
    DEFAULT_DIRECTION
} from "../config/Directions.js";
import {
    DEFAULT_CONNECTION_STYLE
} from "../config/ConnectionStyles.js";
import {
    bindDiagramInteractions,
    findNodeElement,
    highlightDiagramDiagnostics,
    highlightDiagramCoverage,
    highlightDiagramEntitySelection,
    highlightDiagramExecution,
    highlightDiagramLocation,
    highlightDiagramSearch
} from "../interaction/DiagramDomInteraction.js";
import {
    findDiagramNodeAtLocation,
    getDiagramNodes
} from "../interaction/DiagramSelection.js";
import {
    DIAGRAM_ENTITY_TYPES,
    findDiagramEntityByIdentity
} from "../visitor/DiagramEditableIdentity.js";
import {
    ALL_DIAGRAM_SCOPE,
    focusDiagram,
    getDiagramScopes,
    normalizeSearchIndex,
    searchDiagramNodes
} from "../navigation/DiagramNavigation.js";
import {
    createDiagramMinimap
} from "../navigation/DiagramMinimap.js";
import {
    createDiagramPlaybackTrace,
    findDiagramExecutionNode,
    projectDiagramExecutionEdges
} from "../execution/DiagramExecutionProjection.js";
import { createDiagramPlaybackAnimation, getDiagramPlaybackDuration } from "../execution/DiagramPlaybackAnimation.js";
import { moveDiagramPlaybackIndex } from "../execution/DiagramPlaybackNavigation.js";

export default function DiagramPreview({
    model,
    activeLocation = null,
    onNodeSelect = null,
    selectedEntityId = null,
    onEntitySelect = null,
    onNodeEditIntent = null,
    onNodeDeleteIntent = null,
    onEdgeInsertIntent = null,
    onCreateFunctionIntent = null,
    functionEditorOpen = false,
    onFunctionEditorOpen = null,
    onFunctionEditorClose = null,
    onSaveDocument = null,
    onExportDiagram = null,
    onRunCode = null,
    onStopCode = null,
    canCreateFunction = true,
    nodeEditOperation = null,
    executionTrace = EMPTY_EXECUTION_TRACE,
    diagnostics = EMPTY_DIAGNOSTICS,
    testCoverage = null
}) {
    const containerRef = useRef(null);
    const minimapContainerRef =
        useRef(null);
    const interactionRef = useRef(null);
    const minimapBindingRef = useRef(null);
    const viewportRef = useRef(null);
    const svgElementRef = useRef(null);
    const activeLocationRef =
        useRef(activeLocation);
    const selectedEntityIdRef =
        useRef(selectedEntityId);
    const diagnosticsRef =
        useRef(diagnostics);
    const testCoverageRef =
        useRef(testCoverage);
    const searchStateRef = useRef({
        matches: [],
        activeNodeId: null
    });
    const lastCenteredExecutionNodeRef =
        useRef(null);
    const executionScopeStepRef = useRef(null);
    const playbackAnimationRef = useRef(null);
    const playbackStepRef = useRef(null);
    const executionNodeCacheRef = useRef({
        traceId: null,
        diagram: null,
        nodes: []
    });

    activeLocationRef.current =
        activeLocation;
    selectedEntityIdRef.current =
        selectedEntityId;
    diagnosticsRef.current = diagnostics;
    testCoverageRef.current = testCoverage;

    const [themeName, setThemeName] =
        useState(DEFAULT_THEME_ID);
    const [themeRevision, setThemeRevision] =
        useState(0);
    const [direction, setDirection] =
        useState(DEFAULT_DIRECTION);
    const [
        connectionStyle,
        setConnectionStyle
    ] = useState(
        DEFAULT_CONNECTION_STYLE
    );
    const [scopeId, setScopeId] =
        useState(ALL_DIAGRAM_SCOPE);
    const [searchQuery, setSearchQuery] =
        useState("");
    const [searchIndex, setSearchIndex] =
        useState(0);
    const [showMinimap, setShowMinimap] =
        useState(true);
    const [renderRevision, setRenderRevision] =
        useState(0);
    const [executionIndex, setExecutionIndex] =
        useState(-1);
    const [isExecutionPlaying, setExecutionPlaying] =
        useState(false);
    const [followExecution, setFollowExecution] =
        useState(true);
    const [executionSpeed, setExecutionSpeed] =
        useState(500);

    const scopes = useMemo(
        () => getDiagramScopes(model),
        [model]
    );
    const focusedModel = useMemo(
        () => focusDiagram(model, scopeId),
        [model, scopeId]
    );
    const searchMatches = useMemo(
        () => searchDiagramNodes(
            focusedModel,
            searchQuery
        ),
        [focusedModel, searchQuery]
    );
    const activeSearchIndex =
        normalizeSearchIndex(
            searchIndex,
            searchMatches.length
        );
    const activeSearchNode =
        searchMatches[activeSearchIndex] ??
        null;
    const activeEditorNode = useMemo(
        () => findDiagramNodeAtLocation(
            focusedModel,
            activeLocation
        ),
        [focusedModel, activeLocation]
    );
    const selectedEntity = useMemo(
        () => findDiagramEntityByIdentity(
            focusedModel,
            selectedEntityId
        ),
        [focusedModel, selectedEntityId]
    );
    const selectedEditableNode =
        selectedEntity?.identity?.entityType ===
            DIAGRAM_ENTITY_TYPES.NODE &&
        selectedEntity.identity.editable === true
            ? selectedEntity
            : null;
    const selectedEditableEdge =
        selectedEntity?.identity?.entityType ===
            DIAGRAM_ENTITY_TYPES.EDGE &&
        selectedEntity.identity.editable === true &&
        selectedEntity.identity.insertion
            ? selectedEntity
            : null;
    const selectedEntityOperation =
        nodeEditOperation?.identityId ===
            selectedEntity?.identity?.id
            ? nodeEditOperation
            : null;
    const functionOperation =
        nodeEditOperation?.identityId ===
            DIAGRAM_FUNCTION_IDENTITY
            ? nodeEditOperation
            : null;
    const playbackTrace = useMemo(
        () => createDiagramPlaybackTrace(
            focusedModel,
            executionTrace
        ),
        [focusedModel, executionTrace]
    );
    const boundedExecutionIndex = Math.min(
        executionIndex,
        playbackTrace.steps.length - 1
    );
    const resolvedExecutionNodes =
        resolveExecutionNodes(
            executionNodeCacheRef,
            playbackTrace.traceId,
            focusedModel,
            playbackTrace.steps
        );
    const activeExecutionNode =
        boundedExecutionIndex >= 0
            ? resolvedExecutionNodes[
                boundedExecutionIndex
            ] ?? null
            : null;
    // Todos los focos, terminales y recorridos proceden del mismo prefijo de
    // pasos visuales normalizados.
    const activeExecutionProjection = useMemo(
        () => projectDiagramExecutionEdges(
            focusedModel,
            playbackTrace.steps,
            resolvedExecutionNodes,
            boundedExecutionIndex,
            playbackTrace.presentationState
        ),
        [
            focusedModel,
            playbackTrace.steps,
            resolvedExecutionNodes,
            boundedExecutionIndex,
            playbackTrace.presentationState
        ]
    );
    const activeExecutionFocusNode =
        activeExecutionProjection.activeNode;

    useEffect(() => {
        const key = `${executionTrace.traceId}:${boundedExecutionIndex}`;
        if (executionScopeStepRef.current === key) { return; }
        executionScopeStepRef.current = key;
        const location = playbackTrace.steps[boundedExecutionIndex]?.location;
        // Un salto real puede salir del filtro de función. Mostrar el diagrama
        // completo conserva sus nodos/aristas originales y hace visible el destino.
        if (scopeId !== ALL_DIAGRAM_SCOPE && location &&
            !findDiagramNodeAtLocation(focusedModel, location) && findDiagramNodeAtLocation(model, location)) {
            setScopeId(ALL_DIAGRAM_SCOPE);
        }
    }, [boundedExecutionIndex, playbackTrace.traceId, playbackTrace.steps, focusedModel, model, scopeId]);

    searchStateRef.current = {
        matches: searchMatches,
        activeNodeId:
            activeSearchNode?.id ?? null
    };

    const ownerDocument =
        containerRef.current
            ?.ownerDocument ??
        globalThis.document ??
        null;
    const themeConfig = getTheme(
        themeName,
        {
            resolveColor:
                createDocumentColorResolver(
                    ownerDocument
                )
        }
    );
    const canvasBackground =
        themeConfig.theme
            ?.canvas?.background ??
        "#FFFFFF";
    const themeKey =
        `${themeRevision}:` +
        JSON.stringify(themeConfig);
    const diagram = generateDiagram({
        ...focusedModel,
        direction,
        theme: themeConfig.theme
    });

    useEffect(() => {
        if (
            !scopes.some(scope =>
                scope.id === scopeId
            )
        ) {
            setScopeId(
                ALL_DIAGRAM_SCOPE
            );
        }
    }, [scopes, scopeId]);

    useEffect(() => {
        setSearchIndex(0);
    }, [searchQuery, scopeId]);

    useEffect(() => {
        setExecutionIndex(-1);
        setExecutionPlaying(false);
        setFollowExecution(true);
        lastCenteredExecutionNodeRef.current =
            null;
    }, [executionTrace.traceId]);

    useEffect(() => {
        if (followExecution) {
            setExecutionIndex(
                playbackTrace.steps.length - 1
            );
        }
    }, [
        playbackTrace.steps,
        followExecution
    ]);

    useEffect(() => {
        if (
            !isExecutionPlaying ||
            playbackTrace.steps.length === 0
        ) {
            return undefined;
        }

        if (
            boundedExecutionIndex >=
                playbackTrace.steps.length - 1
        ) {
            if (
                executionTrace.status !==
                "running"
            ) {
                setExecutionPlaying(false);
            }

            return undefined;
        }

        const timeoutId = setTimeout(
            () => {
                setExecutionIndex(current =>
                    moveDiagramPlaybackIndex(
                        playbackTrace.steps.length,
                        current,
                        "next"
                    )
                );
            },
            executionSpeed
        );

        return () => clearTimeout(timeoutId);
    }, [
        isExecutionPlaying,
        boundedExecutionIndex,
        playbackTrace.steps.length,
        executionTrace.status,
        executionSpeed
    ]);

    useEffect(() => {
        if (
            themeName !== DEFAULT_THEME_ID ||
            !ownerDocument
        ) {
            return undefined;
        }

        const MutationObserverClass =
            ownerDocument.defaultView
                ?.MutationObserver;

        if (!MutationObserverClass) {
            return undefined;
        }

        const observer =
            new MutationObserverClass(
                () => setThemeRevision(
                    revision => revision + 1
                )
            );
        const observation = {
            attributes: true,
            attributeFilter: [
                "class",
                "style"
            ]
        };

        observer.observe(
            ownerDocument.documentElement,
            observation
        );

        if (ownerDocument.body) {
            observer.observe(
                ownerDocument.body,
                observation
            );
        }

        return () => observer.disconnect();
    }, [themeName, ownerDocument]);

    useEffect(() => {
        const document =
            containerRef.current
                ?.ownerDocument;
        const root =
            document?.documentElement;

        root?.style.setProperty(
            "--diagram-background",
            canvasBackground
        );
        document?.body?.style.setProperty(
            "--diagram-background",
            canvasBackground
        );
    }, [canvasBackground]);

    useEffect(() => {
        if (
            !diagram ||
            !containerRef.current
        ) {
            return undefined;
        }

        let cancelled = false;
        let renderedViewport = null;

        disposeRenderedBindings();

        void renderMermaid({
            container: containerRef.current,
            diagram,
            themeConfig,
            connectionStyle,
            direction
        }).then(result => {
            if (cancelled) {
                result?.viewport?.dispose();
                return;
            }

            if (!result) {
                return;
            }

            const {
                svgElement,
                viewport
            } = result;

            renderedViewport = viewport;
            svgElementRef.current =
                svgElement;
            viewportRef.current = viewport;
            interactionRef.current =
                bindDiagramInteractions({
                    svgElement,
                    diagram: focusedModel,
                    onNodeSelect,
                    onEntitySelect
                });

            highlightDiagramLocation({
                svgElement,
                diagram: focusedModel,
                location:
                    activeLocationRef.current
            });
            highlightDiagramSearch({
                svgElement,
                ...searchStateRef.current
            });
            highlightDiagramEntitySelection({
                svgElement,
                diagram: focusedModel,
                identityId:
                    selectedEntityIdRef.current
            });
            highlightDiagramDiagnostics({
                svgElement,
                diagram: focusedModel,
                diagnostics:
                    diagnosticsRef.current
            });
            highlightDiagramCoverage({
                svgElement,
                diagram: focusedModel,
                coverage:
                    testCoverageRef.current
            });
            setRenderRevision(
                revision => revision + 1
            );
        });

        return () => {
            cancelled = true;
            playbackAnimationRef.current?.cancel();
            interactionRef.current
                ?.dispose?.();
            interactionRef.current = null;
            minimapBindingRef.current
                ?.dispose?.();
            minimapBindingRef.current = null;
            renderedViewport?.dispose();

            if (
                viewportRef.current ===
                    renderedViewport
            ) {
                viewportRef.current = null;
                svgElementRef.current = null;
            }
        };
    }, [
        diagram,
        themeKey,
        focusedModel,
        onNodeSelect,
        onEntitySelect,
        connectionStyle,
        direction
    ]);

    useEffect(() => {
        const svgElement =
            svgElementRef.current;

        if (!svgElement) {
            return;
        }

        highlightDiagramDiagnostics({
            svgElement,
            diagram: focusedModel,
            diagnostics
        });
    }, [
        focusedModel,
        diagnostics,
        renderRevision
    ]);

    useEffect(() => {
        const svgElement =
            svgElementRef.current;

        if (!svgElement) {
            return;
        }

        highlightDiagramCoverage({
            svgElement,
            diagram: focusedModel,
            coverage: testCoverage
        });
    }, [
        focusedModel,
        testCoverage,
        renderRevision
    ]);

    useEffect(() => {
        const svgElement =
            svgElementRef.current;

        if (!svgElement) {
            return;
        }

        highlightDiagramEntitySelection({
            svgElement,
            diagram: focusedModel,
            identityId: selectedEntityId
        });
    }, [
        focusedModel,
        selectedEntityId,
        renderRevision
    ]);

    useEffect(() => {
        const svgElement =
            svgElementRef.current;

        if (!svgElement) {
            return;
        }

        highlightDiagramLocation({
            svgElement,
            diagram: focusedModel,
            location: activeLocation
        });
    }, [
        focusedModel,
        activeLocation,
        renderRevision
    ]);

    useEffect(() => {
        const svgElement =
            svgElementRef.current;

        if (!svgElement) {
            return;
        }

        highlightDiagramSearch({
            svgElement,
            matches: searchMatches,
            activeNodeId:
                activeSearchNode?.id ?? null
        });

        if (activeSearchNode) {
            viewportRef.current
                ?.centerNode(
                    findNodeElement(
                        svgElement,
                        activeSearchNode.id
                    )
                );
        }
    }, [
        searchMatches,
        activeSearchNode,
        renderRevision
    ]);

    useEffect(() => {
        const svgElement =
            svgElementRef.current;

        if (!svgElement) {
            return;
        }

        const node =
            highlightDiagramExecution({
                svgElement,
                diagram: focusedModel,
                steps: playbackTrace.steps,
                resolvedNodes:
                    resolvedExecutionNodes,
                activeIndex:
                    boundedExecutionIndex,
                status:
                    playbackTrace.status,
                presentationState:
                    playbackTrace
                        .presentationState
            });
        const centerNode = activeExecutionFocusNode ?? node;
        const centerKey = centerNode
            ? `${renderRevision}:${centerNode.id}`
            : null;

        if (
            centerNode &&
            centerKey !==
                lastCenteredExecutionNodeRef
                    .current
        ) {
            viewportRef.current
                ?.centerNode(
                    findNodeElement(
                        svgElement,
                        centerNode.id
                    )
                );
            lastCenteredExecutionNodeRef.current =
                centerKey;
        }
    }, [
        focusedModel,
        playbackTrace.steps,
        playbackTrace.status,
        playbackTrace.presentationState,
        boundedExecutionIndex,
        activeExecutionFocusNode,
        renderRevision
    ]);

    useEffect(() => {
        const animation = createDiagramPlaybackAnimation(svgElementRef.current);
        playbackAnimationRef.current = animation;
        playbackStepRef.current = null;
        return () => animation.cancel();
    }, [renderRevision, executionTrace.traceId, followExecution]);

    useEffect(() => {
        const previous = playbackStepRef.current;
        playbackStepRef.current = boundedExecutionIndex;
        if (followExecution || previous == null || previous === boundedExecutionIndex) { return; }
        if (boundedExecutionIndex !== previous + 1) {
            playbackAnimationRef.current?.cancel();
            return;
        }
        const { activePath, activeTargetId } = projectDiagramExecutionEdges(
            focusedModel,
            playbackTrace.steps,
            resolvedExecutionNodes,
            boundedExecutionIndex
        );
        void playbackAnimationRef.current?.play(
            activePath,
            activeTargetId ?? activeExecutionNode?.id,
            getDiagramPlaybackDuration(executionSpeed)
        );
    }, [boundedExecutionIndex, renderRevision, playbackTrace.traceId, playbackTrace.status,
        executionSpeed, followExecution, focusedModel]);

    useEffect(() => {
        minimapBindingRef.current
            ?.dispose?.();
        minimapBindingRef.current = null;

        if (
            !showMinimap ||
            !minimapContainerRef.current ||
            !svgElementRef.current ||
            !viewportRef.current
        ) {
            return undefined;
        }

        const binding =
            createDiagramMinimap({
                container:
                    minimapContainerRef.current,
                svgElement:
                    svgElementRef.current,
                viewport:
                    viewportRef.current
            });

        minimapBindingRef.current =
            binding;

        return () => {
            binding?.dispose?.();

            if (
                minimapBindingRef.current ===
                    binding
            ) {
                minimapBindingRef.current =
                    null;
            }
        };
    }, [
        showMinimap,
        renderRevision,
        testCoverage
    ]);

    const moveSearch = increment => {
        setSearchIndex(current =>
            normalizeSearchIndex(
                current + increment,
                searchMatches.length
            )
        );
    };
    const fitSelection = () => {
        const node =
            activeSearchNode ??
            activeExecutionFocusNode ??
            activeEditorNode;
        const element = node
            ? findNodeElement(
                svgElementRef.current,
                node.id
            )
            : null;

        viewportRef.current
            ?.focusNode(element);
    };
    const appearance =
        themeConfig.theme
            ?.appearance ??
        getColorAppearance(
            canvasBackground
        );
    const backgroundClass =
        appearance === "dark"
            ? "dark-mode"
            : "light-mode";

    return (
        <div
            className={
                `diagram-preview ${backgroundClass}`
            }
        >
            <div className="diagram-toolbar-floating">
                <PreviewToolbar
                    theme={themeName}
                    direction={direction}
                    connectionStyle={
                        connectionStyle
                    }
                    scopes={scopes}
                    scopeId={scopeId}
                    searchQuery={searchQuery}
                    searchResultCount={
                        searchMatches.length
                    }
                    searchResultIndex={
                        activeSearchIndex
                    }
                    showMinimap={showMinimap}
                    canFitSelection={Boolean(
                        activeSearchNode ??
                        activeExecutionFocusNode ??
                        activeEditorNode
                    )}
                    onThemeChange={setThemeName}
                    onDirectionChange={
                        setDirection
                    }
                    onConnectionStyleChange={
                        setConnectionStyle
                    }
                    onScopeChange={setScopeId}
                    onSearchChange={
                        setSearchQuery
                    }
                    onPreviousResult={() =>
                        moveSearch(-1)
                    }
                    onNextResult={() =>
                        moveSearch(1)
                    }
                    onFitAll={() =>
                        viewportRef.current
                            ?.fitAll()
                    }
                    onFitSelection={fitSelection}
                    onToggleMinimap={() =>
                        setShowMinimap(
                            visible => !visible
                        )
                    }
                    onCreateFunction={() => {
                        onEntitySelect?.(null);
                        onFunctionEditorOpen?.();
                    }}
                    onSaveDocument={
                        onSaveDocument
                    }
                    onExportDiagram={onExportDiagram}
                    editPending={
                        nodeEditOperation?.pending ===
                            true
                    }
                    canCreateFunction={
                        canCreateFunction
                    }
                />
            </div>

            <div className="diagram-canvas-container">
                <div
                    ref={containerRef}
                    className={
                        `diagram-canvas ${backgroundClass}`
                    }
                />
            </div>

            <ExecutionToolbar
                trace={playbackTrace}
                onRunCode={onRunCode}
                onStopCode={onStopCode}
                stepIndex={boundedExecutionIndex}
                isPlaying={isExecutionPlaying}
                speed={executionSpeed}
                onSpeedChange={setExecutionSpeed}
                onFirst={() => {
                    setExecutionPlaying(false);
                    setFollowExecution(false);
                    setExecutionIndex(
                        moveDiagramPlaybackIndex(
                            playbackTrace.steps.length,
                            boundedExecutionIndex,
                            "first"
                        )
                    );
                }}
                onPrevious={() => {
                    setExecutionPlaying(false);
                    setFollowExecution(false);
                    setExecutionIndex(current =>
                        moveDiagramPlaybackIndex(
                            playbackTrace.steps.length,
                            current,
                            "previous"
                        )
                    );
                }}
                onTogglePlay={() => {
                    if (isExecutionPlaying) {
                        setExecutionPlaying(false);
                        return;
                    }

                    setFollowExecution(false);
                    setExecutionIndex(current =>
                        moveDiagramPlaybackIndex(
                            playbackTrace.steps.length,
                            current,
                            "replay"
                        )
                    );
                    setExecutionPlaying(true);
                }}
                onNext={() => {
                    setExecutionPlaying(false);
                    setFollowExecution(false);
                    setExecutionIndex(current =>
                        moveDiagramPlaybackIndex(
                            playbackTrace.steps.length,
                            current,
                            "next"
                        )
                    );
                }}
                onLatest={() => {
                    setExecutionPlaying(false);
                    setFollowExecution(true);
                    setExecutionIndex(
                        moveDiagramPlaybackIndex(
                            playbackTrace.steps.length,
                            boundedExecutionIndex,
                            "latest"
                        )
                    );
                }}
            />

            <DiagramCoverageLegend
                coverage={testCoverage}
            />

            {showMinimap && (
                <div
                    ref={minimapContainerRef}
                    className="diagram-minimap"
                />
            )}

            <DiagramEditorPresence>
                {selectedEditableNode && (
                    <DiagramNodeEditor
                        key={
                            selectedEditableNode
                                .identity?.id
                        }
                        node={selectedEditableNode}
                        onGoTo={onNodeSelect}
                        onCancel={() =>
                            onEntitySelect?.(null)
                        }
                        onAccept={
                            selectedEditableNode
                                .identity?.readOnly === true
                                ? null
                                : onNodeEditIntent
                        }
                        onDelete={
                            selectedEditableNode
                                .identity?.deletable === false
                                ? null
                                : onNodeDeleteIntent
                        }
                        operation={
                            selectedEntityOperation
                        }
                    />
                )}
            </DiagramEditorPresence>

            <DiagramEditorPresence>
                {selectedEditableEdge && (
                    <DiagramInsertionEditor
                        key={
                            selectedEditableEdge
                                .identity?.id
                        }
                        edge={selectedEditableEdge}
                        onCancel={() =>
                            onEntitySelect?.(null)
                        }
                        onAccept={onEdgeInsertIntent}
                        operation={
                            selectedEntityOperation
                        }
                    />
                )}
            </DiagramEditorPresence>

            <DiagramEditorPresence>
                {functionEditorOpen && (
                    <DiagramFunctionEditor
                        key="create-function"
                        onCancel={
                            onFunctionEditorClose
                        }
                        onAccept={
                            onCreateFunctionIntent
                        }
                        operation={functionOperation}
                    />
                )}
            </DiagramEditorPresence>
        </div>
    );

    function disposeRenderedBindings() {
        playbackAnimationRef.current?.cancel();
        interactionRef.current
            ?.dispose?.();
        interactionRef.current = null;
        minimapBindingRef.current
            ?.dispose?.();
        minimapBindingRef.current = null;
        viewportRef.current
            ?.dispose?.();
        viewportRef.current = null;
        svgElementRef.current = null;
    }
}

const EMPTY_EXECUTION_TRACE = Object.freeze({
    traceId: null,
    status: "idle",
    steps: Object.freeze([]),
    truncated: false,
    maxSteps: 0
});

const EMPTY_DIAGNOSTICS = Object.freeze([]);

function resolveExecutionNodes(
    cacheRef,
    traceId,
    diagram,
    steps
) {
    let cache = cacheRef.current;

    if (
        cache.traceId !== traceId ||
        cache.diagram !== diagram ||
        steps.length < cache.nodes.length
    ) {
        cache = {
            traceId,
            diagram,
            nodes: []
        };
        cacheRef.current = cache;
    }

    for (
        let index = cache.nodes.length;
        index < steps.length;
        index += 1
    ) {
        cache.nodes.push(
            findDiagramExecutionNode(
                diagram,
                steps[index]
            )
        );
    }

    return cache.nodes;
}
