import {

    useEffect,
    useRef,
    useState

} from "react";

import PreviewToolbar from "./PreviewToolbar.jsx";

import {
    getTheme,
    getAvailableThemes
} from "../themes/ThemeManager.js";

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
        useState("dark");

    const [direction, setDirection] =
        useState(
            DEFAULT_DIRECTION
        );

    //--------------------------------------------------
    // Configuración actual
    //--------------------------------------------------

    const themeConfig =
        getTheme(themeName);

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
        themeName
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

            diagram

        });


    }, [
        diagram,
        themeName,
        direction
    ]);

    const backgroundClass =
        themeName === "dark"
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