import { NODE_CLASSES } from "./NodeTypes.js";

/**
 * Relación entre los tipos de nodo
 * del proyecto y las clases Mermaid.
 */


/**
 * Construye un classDef Mermaid.
 *
 * @param {string} name
 * @param {Object} style
 * @returns {string}
 */
function buildClassDef(name, style) {

    return (

        `classDef ${name} ` +
        `fill:${style.fill},` +
        `stroke:${style.stroke},` +
        `color:${style.text},` +
        `stroke-width:${style.strokeWidth ?? 2}px`

    );

}


/**
 * Construye todas las definiciones de clases Mermaid
 * correspondientes al tema del diagrama.
 *
 * Las clases son globales en Mermaid, por lo que
 * no dependen de si los nodos están en el flujo
 * principal o dentro de subgraphs.
 *
 * @param {Object} theme
 *
 * @returns {string[]}
 */
export function buildMermaidClasses(theme) {

    if (!theme) {

        throw new Error(
            "A diagram theme is required."
        );

    }


    if (!theme.nodes) {

        return [];

    }


    const lines = [];


    //--------------------------------------------------
    // Definiciones de clases de nodos
    //--------------------------------------------------

    for (const [

        nodeType,

        className

    ] of Object.entries(NODE_CLASSES)) {


        const style =
            theme.nodes[nodeType];


        if (!style) {

            continue;

        }


        lines.push(

            buildClassDef(

                className,

                style

            )

        );

    }


    return lines;

}