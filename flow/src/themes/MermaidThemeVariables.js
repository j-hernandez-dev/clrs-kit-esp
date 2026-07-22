/**
 * Convierte un tema del proyecto
 * al formato de variables esperado
 * por Mermaid.
 *
 * Este archivo únicamente adapta
 * el objeto de tema a Mermaid.
 *
 * @param {Object} theme
 * @returns {Object}
 */
export function buildMermaidThemeVariables(theme) {

    if (!theme) {

        throw new Error(
            "A diagram theme is required."
        );

    }


    const process =
        theme.nodes.process;

    const call =
        theme.nodes.call;

    const decision =
        theme.nodes.decision;


    return {

        //--------------------------------------------------
        // Canvas
        //--------------------------------------------------

        //background: theme.canvas.background,


        //--------------------------------------------------
        // Tipografía
        //--------------------------------------------------

        fontFamily:
            "JetBrains Mono, Segoe UI, sans-serif",


        //--------------------------------------------------
        // Colores principales Mermaid
        //--------------------------------------------------

        primaryColor:
            process.fill,

        primaryBorderColor:
            process.stroke,

        primaryTextColor:
            process.text,


        secondaryColor:
            call.fill,

        secondaryBorderColor:
            call.stroke,

        secondaryTextColor:
            call.text,


        tertiaryColor:
            decision.fill,

        tertiaryBorderColor:
            decision.stroke,

        tertiaryTextColor:
            decision.text,


        //--------------------------------------------------
        // Flowchart
        //--------------------------------------------------

        nodeBorder:
            process.stroke,

        nodeTextColor:
            process.text,


        mainBkg:
            process.fill,


        lineColor:
            theme.arrow.color,


        defaultLinkColor:
            theme.arrow.color,


        //--------------------------------------------------
        // Etiquetas de conexiones
        //--------------------------------------------------

        edgeLabelBackground:
            theme.arrow.colorLabel,

        edgeLabelText:
            theme.arrow.color,


        //--------------------------------------------------
        // Texto general
        //--------------------------------------------------

        textColor:
            process.text,

        labelTextColor:
            process.text,


        //--------------------------------------------------
        // Subgraphs
        //--------------------------------------------------

        clusterBkg:
            theme.subgraph?.fill ??
            theme.canvas.background,

        clusterBorder:
            theme.subgraph?.stroke ??
            theme.arrow.color,

        titleColor:
            theme.subgraph?.text ??
            process.text

    };

}