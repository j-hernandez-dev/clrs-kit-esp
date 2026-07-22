/**
 * Relación entre tipos de nodo
 * internos y figuras Mermaid.
 */
export const NODE_SHAPES = {
    merge: "circle",

    process: "rect",

    call: "subroutine",

    start: "terminal",

    return: "terminal",

    decision: "diamond",

    preparation: "hexagon",

    read: "parallelogram",

    write: "parallelogram"

};


/**
 * Relación entre tipos de nodo
 * internos y clases Mermaid.
 */
export const NODE_CLASSES = {
    merge: "node-merge",

    process: "node-process",

    call: "node-call",

    start: "node-start",

    return: "node-return",

    decision: "node-decision",

    preparation: "node-preparation",

    read: "node-read",

    write: "node-write"

};