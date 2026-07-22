
/**
 * Construye un documento Mermaid completo.
 *
 * Este builder únicamente organiza las
 * diferentes secciones del documento.
 *
 * No conoce el AST, Mermaid Renderer,
 * temas ni estilos.
 *
 * @param {Object} options
 * @param {string} options.direction
 * @param {string[]} [options.mainFlow]
 * @param {string[]} [options.subgraphs]
 * @param {string[]} [options.extras]
 *
 * @returns {string}
 */
export function buildDiagram({

    direction,

    mainFlow = [],

    subgraphs = [],

    extras = []

}) {


    const lines = [

        `flowchart ${direction}`

    ];



    //--------------------------------------------------
    // Flujo principal
    //--------------------------------------------------

    if (mainFlow.length > 0) {

        lines.push("");

        lines.push(
            ...mainFlow
        );

    }



    //--------------------------------------------------
    // Separador antes de subgraphs
    //--------------------------------------------------

    if (subgraphs.length > 0) {

        lines.push("");

        lines.push(
            ...subgraphs
        );

    }



    //--------------------------------------------------
    // Extras Mermaid
    //
    // - classDef
    // - class
    // - linkStyle
    // - comentarios
    //--------------------------------------------------

    if (extras.length > 0) {

        lines.push("");

        lines.push(
            ...extras
        );

    }



    return lines

        .join("\n")

        .trim();

}