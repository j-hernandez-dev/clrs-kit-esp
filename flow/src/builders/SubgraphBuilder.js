import { buildNode } from "./NodeBuilder.js";
import { buildEdge } from "./EdgeBuilder.js";


/**
 * Construye un subgrafo Mermaid.
 *
 * Un subgrafo contiene sus propios nodos
 * y conexiones internas.
 *
 * @param {Object} subgraph
 * @param {string} subgraph.id
 * @param {string} subgraph.title
 * @param {Object[]} subgraph.nodes
 * @param {Object[]} subgraph.edges
 *
 * @returns {string}
 */
export function buildSubgraph({

    id,

    title,

    nodes = [],

    edges = [],

    direction

}) {

    const output = [

        `subgraph ${id}["${title}"]`,

        `    direction ${direction}`

    ];


    for (const node of nodes) {

        output.push(
            `    ${buildNode(node)}`
        );

    }


    for (const edge of edges) {

        output.push(
            `    ${buildEdge(edge)}`
        );

    }


    output.push("end");


    return output.join("\n");

}



/**
 * Escapa caracteres especiales para Mermaid.
 */
function escapeLabel(text) {

    return String(text)

        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "#quot;");

}


/**
 * Agrega una indentación a un
 * bloque Mermaid.
 *
 * @param {string} block
 * @returns {string}
 */
function indent(block) {

    return block

        .split("\n")

        .map(line => `    ${line}`)

        .join("\n");

}