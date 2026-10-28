import mermaid from "mermaid";

import {
    buildMermaidThemeVariables
} from "../themes/MermaidThemeVariables.js";
import {
    DEFAULT_CONNECTION_STYLE,
    getMermaidCurve
} from "../config/ConnectionStyles.js";

export const FLOWCHART_CONFIG = Object.freeze({

    curve: getMermaidCurve(
        DEFAULT_CONNECTION_STYLE
    ),

    // El valor predeterminado de Mermaid (200 px) fuerza el ajuste
    // antes de calcular la geometría y puede dejar etiquetas largas
    // fuera de símbolos inclinados.
    wrappingWidth: 640,

    // Mantiene compactas las figuras de una sola línea. Mermaid conserva
    // este valor dentro de su cálculo de geometría, por lo que también
    // recoloca correctamente etiquetas, rombos y puntos de conexión.
    padding: 8

});

export function createFlowchartConfig(
    options = {}
) {
    const htmlLabels =
        options.htmlLabels ?? true;
    const curve = getMermaidCurve(
        options.connectionStyle ??
            DEFAULT_CONNECTION_STYLE,
        options.direction
    );

    return {
        ...FLOWCHART_CONFIG,
        curve,
        htmlLabels
    };
}

export function initializeMermaid(
    themeConfig,
    options = {}
) {

    const htmlLabels =
        options.htmlLabels ?? true;

    const baseConfig = {

        startOnLoad:false,

        securityLevel:"loose",

        // Mermaid ha incorporado apariencias alternativas que modifican
        // sombras, bordes y marcadores. El diagramador conserva de forma
        // explÃ­cita la estÃ©tica clÃ¡sica utilizada por CLRS Kit.
        look:"classic",

        htmlLabels

    };

    const flowchartConfig =
        createFlowchartConfig({
            ...options,
            htmlLabels
        });



    if (!themeConfig) {

        mermaid.initialize({

            ...baseConfig,

            theme:"base",

            flowchart:
                flowchartConfig

        });

        return;

    }



    if (themeConfig.type === "mermaid") {

        mermaid.initialize({

            ...baseConfig,

            theme:
                themeConfig.theme,
            
            flowchart:
                flowchartConfig

        });

        return;

    }



    if (themeConfig.type === "custom") {

        mermaid.initialize({

            ...baseConfig,

            theme:"base",

            themeVariables:
                buildMermaidThemeVariables(
                    themeConfig.theme
                ),

            flowchart:
                flowchartConfig

        });

        return;

    }



    console.warn(
        "Unknown Mermaid theme configuration:",
        themeConfig
    );


    mermaid.initialize({

        ...baseConfig,

        theme:"default",

        flowchart:
            flowchartConfig

    });

}
