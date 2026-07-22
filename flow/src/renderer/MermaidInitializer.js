import mermaid from "mermaid";

import {
    buildMermaidThemeVariables
} from "../themes/MermaidThemeVariables.js";

const FLOWCHART_CONFIG = {

    curve: "basis"

};

export function initializeMermaid(themeConfig) {

    const baseConfig = {

        startOnLoad:false,

        securityLevel:"loose",

        htmlLabels: true

    };



    if (!themeConfig) {

        mermaid.initialize({

            ...baseConfig,

            theme:"base"

        });

        return;

    }



    if (themeConfig.type === "mermaid") {

        mermaid.initialize({

            ...baseConfig,

            theme:
                themeConfig.theme,
            
            flowchart: FLOWCHART_CONFIG

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

            flowchart: FLOWCHART_CONFIG

        });

        return;

    }



    console.warn(
        "Unknown Mermaid theme configuration:",
        themeConfig
    );


    mermaid.initialize({

        ...baseConfig,

        theme:"default"

    });

}