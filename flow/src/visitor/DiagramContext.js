import { DEFAULT_DIRECTION } from "../config/Directions.js";

/**
 * Crea el modelo interno del diagrama.
 *
 * @returns {Object}
 */
export function createDiagram() {

    return {

        direction: DEFAULT_DIRECTION,

        nodes: [],

        edges: [],

        subgraphs: []

    };

}


/**
 * Contador interno para los identificadores
 * de los nodos.
 */
let nodeCounter = 0;


/**
 * Contador interno para los subgrafos.
 */
let subgraphCounter = 0;


/**
 * Reinicia el estado interno.
 */
export function resetContext() {

    functions.clear();

    nodeCounter = 0;

    subgraphCounter = 0;

}


/**
 * Agrega un nodo a un subgrafo.
 *
 * @param {Object} subgraph
 * @param {Object} node
 */
export function addNodeToSubgraph(
    subgraph,
    node
) {

    if (!subgraph || !node) {

        return;

    }

    subgraph.nodes.push(node);

}


/**
 * Agrega una edge a un subgrafo.
 *
 * @param {Object} subgraph
 * @param {Object} edge
 */
export function addEdgeToSubgraph(
    subgraph,
    edge
) {

    if (!subgraph || !edge) {

        return;

    }

    subgraph.edges.push(edge);

}

const functions = new Map();


export function registerFunction(
    name,
    value
) {

    functions.set(
        name,
        value
    );

}


export function getFunction(name) {

    return functions.get(name);

}


/**
 * Crea un nodo dentro del diagrama.
 *
 * @param {Object} diagram
 * @param {Object} node
 *
 * @returns {String}
 */
export function createNode(
    diagram,
    node
) {

    const id =
        `N${++nodeCounter}`;

    diagram.nodes.push({

        id,

        ...node

    });

    return id;

}


/**
 * Conecta dos nodos.
 *
 * @param {Object} diagram
 * @param {String} from
 * @param {String} to
 * @param {String|null} label
 */
export function connect(
    diagram,
    source,
    target,
    label = null
) {

    diagram.edges.push({

        source,

        target,

        label

    });

}


/**
 * Crea un subgraph de una función.
 *
 * Un subgraph representa el flujo interno
 * de una función declarada.
 *
 * @param {Object} options
 * @param {string} options.id
 * @param {string} options.title
 * @param {Object[]} [options.nodes]
 * @param {Object[]} [options.edges]
 *
 * @returns {Object}
 */
export function createSubgraph(
    diagram,
    {

    id,

    title,

    nodes = [],

    edges = []

}) {

    if (!diagram) {

        throw new Error(
            "Diagram is required."
        );

    }

    if (!id) {

        throw new Error(
            "The subgraph id is required."
        );

    }


    return {

        id,

        title:
            title ?? "",

        nodes,

        edges

    };

}


/**
 * Construye una secuencia de sentencias.
 *
 * Devuelve el primer y último nodo creados
 * para poder conectar con otros bloques.
 *
 * @param {Object} diagram
 * @param {Array<any>} statements
 * @param {Function} statementType
 *
 * @returns {{
 *      first: String|null,
 *      last: String|null
 * }}
 */
export function buildBlock(
    diagram,
    statements,
    statementType
) {

    const list =
        statements ?? [];

    let first = null;

    let last = null;

    for (const statement of list) {

        const result =
            statementType(
                statement,
                diagram
            );

        if (!result) {

            continue;

        }

        if (!first) {

            first = result.entry;

        }

        if (last) {

            connect(
                diagram,
                last,
                result.entry
            );

        }

        last =
            result.exit;

    }

    return {

        first,

        last

    };

}