/**
 * Tipos de conexión Mermaid.
 */
export const EDGE_TYPES = {

    NORMAL: "-->",

    DOTTED: "-.->",

    THICK: "==>",

    INVISIBLE: "---"

};


/**
 * Convierte un id del modelo
 * en un id seguro para Mermaid.
 *
 * Evita conflictos con palabras
 * reservadas como:
 *
 * call
 * return
 * class
 * end
 */
function normalizeId(id) {

    return `_${String(id)}`;

}


/**
 * Construye una conexión Mermaid.
 *
 * @param {Object} edge
 * @returns {string}
 */
export function buildEdge(edge) {

    if (!edge?.source || !edge?.target) {

        throw new Error(
            "Edge must contain source and target."
        );

    }


    //--------------------------------------------------
    // Tipo de conexión
    //--------------------------------------------------

    const connector =

        edge.type ??
        EDGE_TYPES.NORMAL;


    //--------------------------------------------------
    // IDs seguros
    //--------------------------------------------------

    const source =

        normalizeId(edge.source);

    const target =

        normalizeId(edge.target);


    //--------------------------------------------------
    // Etiqueta
    //--------------------------------------------------

    const label =

        edge.label?.trim();


    //--------------------------------------------------
    // Con etiqueta
    //--------------------------------------------------

    if (label) {

        return (

            `${source} ` +
            `${connector}|${label}| ` +
            `${target}`

        );

    }


    //--------------------------------------------------
    // Sin etiqueta
    //--------------------------------------------------

    return (

        `${source} ` +
        `${connector} ` +
        `${target}`

    );

}