import {
    useCallback,
    useEffect,
    useMemo,
    useState
} from "react";
import {
    useDiagramModel
} from "./hooks/useDiagramModel.js";
import DiagramDiagnostics
    from "./preview/DiagramDiagnostics.jsx";
import DiagramPreview
    from "./preview/DiagramPreview.jsx";
import {
    createEmptyExecutionTrace,
    reduceExecutionTrace
} from "./execution/ExecutionTraceState.js";
import {
    findDiagramEntityByIdentity
} from "./visitor/DiagramEditableIdentity.js";
import {
    shiftSourceLocation
} from "./interaction/DiagramSelection.js";
import {
    createDiagramCoverageState
} from "./coverage/DiagramCoverageState.js";

export default function App({
    application
}) {
    const [sourceDocument, setSourceDocument] =
        useState({
            sourceCode:
                application.config
                    .initialSourceCode,
            sourceOrigin: null,
            version: null,
            wholeDocument: true,
            semanticDiagnostics: []
        });
    const [selection, setSelection] =
        useState(null);
    const [executionTrace, setExecutionTrace] =
        useState(createEmptyExecutionTrace);
    const [testCoverage, setTestCoverage] =
        useState(null);
    const [selectedEntityId, setSelectedEntityId] =
        useState(null);
    const [editOperation, setEditOperation] =
        useState(null);
    const [functionEditorOpen,
        setFunctionEditorOpen] = useState(false);
    const bridge =
        application.bridge;
    const diagramState =
        useDiagramModel(
            sourceDocument.sourceCode,
            application.store,
            sourceDocument.sourceOrigin
        );
    const diagramDiagnostics = useMemo(
        () => [
            ...(diagramState.errors ?? [])
                .map(diagnostic => ({
                    ...diagnostic,
                    location:
                        shiftSourceLocation(
                            diagnostic.location,
                            sourceDocument
                                .sourceOrigin
                        )
                })),
            ...sourceDocument
                .semanticDiagnostics
        ],
        [
            diagramState.errors,
            sourceDocument.sourceOrigin,
            sourceDocument.semanticDiagnostics
        ]
    );
    const diagramCoverage = useMemo(
        () => createDiagramCoverageState(
            testCoverage,
            sourceDocument.sourceOrigin
        ),
        [
            testCoverage,
            sourceDocument.sourceOrigin
        ]
    );

    const handleSource = useCallback(
        (
            nextSource,
            sourceOrigin,
            documentVersion,
            wholeDocument,
            semanticDiagnostics
        ) => {
            setSourceDocument({
                sourceCode: nextSource,
                sourceOrigin,
                version:
                    documentVersion ?? null,
                wholeDocument:
                    wholeDocument === true,
                semanticDiagnostics:
                    Array.isArray(
                        semanticDiagnostics
                    )
                        ? semanticDiagnostics
                        : []
            });
        },
        []
    );
    const handleNodeSelect = useCallback(
        node => {
            bridge.navigateToLocation(
                node.location,
                node.id
            );
        },
        [bridge]
    );
    const handleEntitySelect = useCallback(
        entity => {
            if (editOperation?.pending) {
                return;
            }

            setEditOperation(null);
            setFunctionEditorOpen(false);
            setSelectedEntityId(
                entity?.identity?.id ?? null
            );
        },
        [editOperation?.pending]
    );
    const handleFunctionEditorOpen =
        useCallback(() => {
            if (editOperation?.pending) {
                return;
            }

            setEditOperation(null);
            setSelectedEntityId(null);
            setFunctionEditorOpen(true);
        }, [editOperation?.pending]);
    const handleFunctionEditorClose =
        useCallback(() => {
            if (!editOperation?.pending) {
                setEditOperation(null);
                setFunctionEditorOpen(false);
            }
        }, [editOperation?.pending]);
    const submitDiagramEdit = useCallback(
        intent => {
            if (editOperation?.pending) {
                return;
            }

            const requestId =
                bridge.requestDiagramEdit(
                    intent,
                    sourceDocument.version
                );

            setEditOperation(
                requestId == null
                    ? {
                        requestId: null,
                        operation:
                            intent.operation,
                        identityId:
                            intent.identityId,
                        pending: false,
                        error:
                            "No fue posible comunicarse con VS Code."
                    }
                    : {
                        requestId,
                        operation:
                            intent.operation,
                        identityId:
                            intent.identityId,
                        pending: true,
                        error: null
                    }
            );
        },
        [
            bridge,
            editOperation?.pending,
            sourceDocument.version
        ]
    );
    const handleDiagramEditResult = useCallback(
        message => {
            if (
                editOperation?.requestId !==
                    message.requestId
            ) {
                return;
            }

            if (message.ok) {
                if (
                    editOperation.operation ===
                        "create-function"
                ) {
                    setFunctionEditorOpen(false);
                }

                setEditOperation(null);
                setSelectedEntityId(null);
                return;
            }

            setEditOperation({
                requestId:
                    editOperation.requestId,
                operation:
                    editOperation.operation,
                identityId:
                    editOperation.identityId,
                pending: false,
                error:
                    message.error ??
                    "No fue posible aplicar el cambio."
            });
        },
        [editOperation]
    );

    useEffect(() => {
        if (
            selectedEntityId &&
            !findDiagramEntityByIdentity(
                diagramState.model,
                selectedEntityId
            )
        ) {
            setSelectedEntityId(null);
        }
    }, [
        diagramState.model,
        selectedEntityId
    ]);

    useEffect(
        () =>
            bridge.connect({
                onSource: handleSource,
                onSelection: setSelection,
                onExecutionTrace: message => {
                    setExecutionTrace(
                        current =>
                            reduceExecutionTrace(
                                current,
                                message
                        )
                    );
                },
                onTestCoverage: message => {
                    setTestCoverage(
                        message.coverage ?? null
                    );
                },
                onDiagramEditResult:
                    handleDiagramEditResult
            }),
        [
            bridge,
            handleSource,
            handleDiagramEditResult
        ]
    );

    return (
        <main className="flow-app">
            <DiagramPreview
                model={diagramState.model}
                activeLocation={selection}
                onNodeSelect={
                    handleNodeSelect
                }
                selectedEntityId={
                    selectedEntityId
                }
                onEntitySelect={
                    handleEntitySelect
                }
                onNodeEditIntent={
                    submitDiagramEdit
                }
                onNodeDeleteIntent={
                    submitDiagramEdit
                }
                onEdgeInsertIntent={
                    submitDiagramEdit
                }
                onCreateFunctionIntent={
                    submitDiagramEdit
                }
                functionEditorOpen={
                    functionEditorOpen
                }
                onFunctionEditorOpen={
                    handleFunctionEditorOpen
                }
                onFunctionEditorClose={
                    handleFunctionEditorClose
                }
                onSaveDocument={() =>
                    bridge.requestDocumentSave()
                }
                onExportDiagram={() =>
                    bridge.handleMessage({ data: { type: "export-svg" } })
                }
                onRunCode={() =>
                    bridge.requestCodeExecution()
                }
                onStopCode={() =>
                    bridge.requestCodeStop()
                }
                canCreateFunction={
                    sourceDocument.wholeDocument
                }
                nodeEditOperation={
                    editOperation
                }
                executionTrace={
                    executionTrace
                }
                diagnostics={
                    diagramDiagnostics
                }
                testCoverage={diagramCoverage}
            />

            <DiagramDiagnostics
                status={
                    diagramState.status
                }
                errors={
                    diagramState.errors
                }
                semanticDiagnostics={
                    sourceDocument
                        .semanticDiagnostics
                }
            />
        </main>
    );
}
