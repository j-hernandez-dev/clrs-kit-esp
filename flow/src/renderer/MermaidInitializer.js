import mermaid from "mermaid";

import {
    buildMermaidThemeVariables
} from "../themes/MermaidThemeVariables.js";

const FLOWCHART_CONFIG = {

    curve: "basis",

    // El valor predeterminado de Mermaid (200 px) fuerza el ajuste
    // antes de calcular la geometría y puede dejar etiquetas largas
    // fuera de símbolos inclinados.
    wrappingWidth: 640,

    padding: 28

};

export function initializeMermaid(
    themeConfig,
    options = {}
) {

    const htmlLabels =
        options.htmlLabels ?? true;

    const baseConfig = {

        startOnLoad:false,

        securityLevel:"loose",

        htmlLabels

    };

    const flowchartConfig = {

        ...FLOWCHART_CONFIG,

        htmlLabels

    };



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
