import {

    useEffect,
    useRef,
    useState

} from "react";

import PreviewToolbar from "./PreviewToolbar.jsx";

import {
    DEFAULT_THEME_ID,
    getTheme
} from "../themes/ThemeManager.js";
import {
    createDocumentColorResolver,
    getColorAppearance
} from "../themes/presets/VSCodeTheme.js";

import {
    initializeMermaid
} from "../renderer/MermaidInitializer.js";

import {
    renderMermaid
} from "../renderer/MermaidRenderer.js";

import {
    generateDiagram
} from "../builders/DiagramGenerator.js";
import {
    DEFAULT_DIRECTION
} from "../config/Directions.js";


/**
 * Vista previa del diagrama Mermaid.
 *
 * Responsabilidades:
 *
 * - Seleccionar tema.
 * - Inicializar Mermaid.
 * - Renderizar SVG.
 *
 * No genera Mermaid.
 *
 * @param {Object} props
 * @param {string} props.model
 */
export default function DiagramPreview({

    model

}) {

    const containerRef =
        useRef(null);

    const [themeName, setThemeName] =
        useState(
            DEFAULT_THEME_ID
        );

    const [
        themeRevision,
        setThemeRevision
    ] = useState(0);

    const [direction, setDirection] =
        useState(
            DEFAULT_DIRECTION
        );

    //--------------------------------------------------
    // Configuración actual
    //--------------------------------------------------

    const ownerDocument =
        containerRef.current
            ?.ownerDocument ??
        globalThis.document ??
        null;
    const themeConfig =
        getTheme(
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

    //--------------------------------------------------
    // Genera el diagrama
    //--------------------------------------------------

    const diagram =
        generateDiagram({
            ...model,
            direction,
            theme: themeConfig.theme
        });

    //--------------------------------------------------
    // Inicializar Mermaid
    //--------------------------------------------------

    useEffect(() => {

        initializeMermaid(
            themeConfig
        );

    }, [
        themeKey
    ]);

    //--------------------------------------------------
    // Sincronizar cambios del tema de VS Code
    //--------------------------------------------------

    useEffect(() => {

        if (
            themeName !==
                DEFAULT_THEME_ID ||
            !ownerDocument
        ) {
            return undefined;
        }

        const MutationObserverClass =
            ownerDocument
                .defaultView
                ?.MutationObserver;

        if (!MutationObserverClass) {
            return undefined;
        }

        const observer =
            new MutationObserverClass(
                () => {
                    setThemeRevision(
                        revision =>
                            revision + 1
                    );
                }
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

        return () => {
            observer.disconnect();
        };

    }, [
        themeName,
        ownerDocument
    ]);

    //--------------------------------------------------
    // Fondo completo del webview
    //--------------------------------------------------

    useEffect(() => {

        const ownerDocument =
            containerRef.current
                ?.ownerDocument;
        const root =
            ownerDocument
                ?.documentElement;

        root?.style.setProperty(
            "--diagram-background",
            canvasBackground
        );

        ownerDocument?.body
            ?.style.setProperty(
                "--diagram-background",
                canvasBackground
            );

    }, [
        canvasBackground
    ]);



    //--------------------------------------------------
    // Renderizar diagrama
    //--------------------------------------------------

    useEffect(() => {

        if (

            !diagram ||
            !containerRef.current

        ) {
            return;
        }


        renderMermaid({

            container:
                containerRef.current,

            diagram,

            themeConfig

        });


    }, [
        diagram,
        direction,
        themeKey
    ]);

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

        <div className={`diagram-preview ${backgroundClass}`}>


            <div className="diagram-toolbar-floating">

                <PreviewToolbar

                    theme={themeName}

                    direction={direction}

                    onThemeChange={
                        setThemeName
                    }

                    onDirectionChange={
                        setDirection
                    }

                />

            </div>


            <div className="diagram-canvas-container">


                <div

                    ref={containerRef}

                    className={`diagram-canvas ${backgroundClass}`}

                />


            </div>


        </div>

    );

}
