import { NODE_CLASSES, NODE_SHAPES } from "./NodeTypes.js";

/**
 * Delimitadores Mermaid para cada figura.
 */
const SHAPE_DELIMITERS = {
    circle: {
        open: "((",
        close: "))"
    },

    rect: {
        open: "[",
        close: "]"
    },

    subroutine: {
        open: "[[",
        close: "]]"
    },

    terminal: {
        open: "([",
        close: "])"
    },

    diamond: {
        open: "{",
        close: "}"
    },

    hexagon: {
        open: "{{",
        close: "}}"
    },

    parallelogram: {
        open: "[/",
        close: "/]"
    }

};

const MINIMUM_SIZED_NODE_TYPES = new Set([
    "process",
    "call",
    "start",
    "return",
    "preparation",
    "read",
    "write"
]);

const MINIMUM_LABEL_COLUMNS = 12;


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
 * Escapa caracteres especiales para Mermaid.
 */
function escapeLabel(text) {

    return String(text)

        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

}


/**
 * Construye un nodo Mermaid.
 */
export function buildNode(node) {

    if (!node) {

        throw new Error(
            "Node is required."
        );

    }

    if (!node.id) {

        throw new Error(
            "Node id is required."
        );

    }

    const shape =
        NODE_SHAPES[node.type];

    if (!shape) {

        throw new Error(
            `Unsupported node type: ${node.type}`
        );

    }

    const delimiters =
        SHAPE_DELIMITERS[shape];

    const label =
        escapeLabel(
            normalizeLabelSize(
                node,
                node.label ?? ""
            )
        );

    const id =
        normalizeId(node.id);


    if (shape === "circle") {

        return (
            `${id}` +
            `${delimiters.open}` +
            ` ` +
            `${delimiters.close}`
        );

    }

    return (
        `${id}` +
        `${delimiters.open}` +
        `"${label}"` +
        `${delimiters.close}`
    );

}


/**
 * Construye la asociación entre
 * un nodo y una clase Mermaid.
 */
export function buildNodeClass(node) {

    const className =
        NODE_CLASSES[node.type];

    if (!className) {

        throw new Error(
            `Unsupported node type: ${node.type}`
        );

    }

    return (

        `class ${normalizeId(node.id)} ${className}`

    );

}


/**
 * Reserva un ancho mínimo antes de que Mermaid calcule la figura y sus
 * conectores. Los espacios no separables son invisibles, funcionan tanto
 * con etiquetas HTML como con texto SVG puro y evitan que terminales breves
 * como `Fin` degeneren visualmente en un círculo con una base diminuta.
 */
function normalizeLabelSize(
    node,
    text
) {

    const source = String(text);

    if (
        !MINIMUM_SIZED_NODE_TYPES.has(
            node.type
        )
    ) {
        return source;
    }

    const lines = source.split("\n");
    const targetColumns = Math.max(
        MINIMUM_LABEL_COLUMNS,
        ...lines.map(line =>
            Array.from(line).length
        )
    );

    return lines
        .map(line => {
            const length =
                Array.from(line).length;

            if (
                length >=
                    targetColumns
            ) {
                return line;
            }

            const missing =
                targetColumns -
                length;
            const left =
                Math.floor(missing / 2);
            const right =
                missing - left;

            return (
                "\u00a0".repeat(left) +
                line +
                "\u00a0".repeat(right)
            );
        })
        .join("\n");

}
