import {
    useEffect,
    useState
} from "react";
import {
    useDiagramModel
} from "./hooks/useDiagramModel.js";
import DiagramDiagnostics
    from "./preview/DiagramDiagnostics.jsx";
import DiagramPreview
    from "./preview/DiagramPreview.jsx";

export default function App({
    application
}) {
    const [sourceCode, setSourceCode] =
        useState(
            application.config
                .initialSourceCode
        );
    const bridge =
        application.bridge;
    const diagramState =
        useDiagramModel(
            sourceCode,
            application.store
        );

    useEffect(
        () =>
            bridge.connect({
                onSource: setSourceCode
            }),
        [bridge]
    );

    return (
        <main className="flow-app">
            <DiagramPreview
                model={diagramState.model}
            />

            <DiagramDiagnostics
                status={
                    diagramState.status
                }
                errors={
                    diagramState.errors
                }
            />
        </main>
    );
}
