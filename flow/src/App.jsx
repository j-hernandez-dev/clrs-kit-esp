import { useEffect, useMemo, useState } from "react";
import { getAST } from "../../src/compiler/BrowserPipeline.js";
import DEFAULT_DIAGRAM from "./config/DefaultDiagram.js";
import DiagramPreview from "./preview/DiagramPreview.jsx";
import { build } from "./visitor/DiagramVisitor.js";
import { initializeBridge } from "./extension/Bridge.js";

export default function App() {

    //--------------------------------------------------
    // Código recibido desde VS Code
    //--------------------------------------------------

    const [sourceCode, setSourceCode] = useState("");

    //--------------------------------------------------
    // Escuchar mensajes del Webview
    //--------------------------------------------------

    useEffect(() => {

        const listener = (event) => {

            const message = event.data;

            switch (message?.type) {

                case "source":

                    setSourceCode(message.source);

                    break;

                default:

                    break;

            }

        };

        window.addEventListener(
            "message",
            listener
        );

        initializeBridge();

        return () =>
            window.removeEventListener(
                "message",
                listener
            );

    }, []);



    //--------------------------------------------------
    // Construcción del AST
    //--------------------------------------------------

    const model = useMemo(() => {

        if (!sourceCode.trim()) {
            return DEFAULT_DIAGRAM;
        }

        try {

            const ast = getAST(sourceCode);

            if (!ast) {
                return DEFAULT_DIAGRAM;
            }

            return build(ast);

        }
        catch {

            return DEFAULT_DIAGRAM;

        }

    }, [sourceCode]);

    //--------------------------------------------------
    // Modelo mostrado
    //--------------------------------------------------

    return (

        <DiagramPreview

            model={model}

        />
    );
}