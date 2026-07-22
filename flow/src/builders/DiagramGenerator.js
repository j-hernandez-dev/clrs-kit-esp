import { buildDiagram } from "./DiagramBuilder.js";
import { buildNode, buildNodeClass } from "./NodeBuilder.js";
import { buildEdge } from "./EdgeBuilder.js";
import { buildMermaidClasses } from "./MermaidClassBuilder.js";
import { buildSubgraph } from "./SubgraphBuilder.js";


/**
 * Genera un documento Mermaid completo
 * a partir de un modelo de diagrama.
 *
 * @param {Object} options
 * @param {Object[]} options.nodes
 * @param {Object[]} options.edges
 * @param {Object[]} options.subgraphs
 * @param {Object} options.theme
 * @param {string} options.direction
 *
 * @returns {string}
 */
export function generateDiagram({

    nodes = [],

    edges = [],

    subgraphs = [],

    theme,

    direction

}) {


    //--------------------------------------------------
    // Normaliza tema
    //--------------------------------------------------

    const diagramTheme =

        theme?.theme ??
        theme;



    //--------------------------------------------------
    // Construcción del flujo principal
    //--------------------------------------------------

    const mainFlow = [];


    for (const node of nodes) {

        mainFlow.push(

            buildNode(node)

        );

    }


    for (const edge of edges) {

        mainFlow.push(

            buildEdge(edge)

        );

    }



    //--------------------------------------------------
    // Construcción de subgrafos
    //--------------------------------------------------

    const builtSubgraphs =

    subgraphs.map(subgraph => (

        buildSubgraph({

            ...subgraph,

            direction

        })

    ));



    //--------------------------------------------------
    // Extras
    //--------------------------------------------------

    const extras = [];



    //--------------------------------------------------
    // Clases de nodos
    //
    // Incluye:
    // - nodos del flujo principal
    // - nodos internos de subgraphs
    //--------------------------------------------------

    const allNodes = [

        ...nodes,

        ...subgraphs.flatMap(

            subgraph =>
                subgraph.nodes ?? []

        )

    ];



    for (const node of allNodes) {

        extras.push(

            buildNodeClass(node)

        );

    }



    //--------------------------------------------------
    // Clases Mermaid del tema
    //--------------------------------------------------

    if (diagramTheme?.nodes) {

        extras.push(

            ...buildMermaidClasses(

                diagramTheme

            )

        );

    }



    //--------------------------------------------------
    // Documento final
    //--------------------------------------------------

    return buildDiagram({

        direction,

        mainFlow,

        subgraphs: builtSubgraphs,

        extras

    });

}