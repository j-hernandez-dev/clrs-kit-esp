/**
 * 
 * ArrayDeclarationNode.js
 * 
 * ==================================
 * ARRAY DECLARATION NODE
 * ==================================
 *
 * Representa una declaración de arreglo
 * dentro del AST.
 *
 * Ejemplos:
 *
 * Declarar edades[10] Como Entero
 *
 * Declarar matriz[3][3] Como Real
 *
 * Contiene:
 *
 * - identificador del arreglo
 * - lista de dimensiones
 * - tipo de dato almacenado
 *
 * ==================================
 */


import { ASTNode } from "../core/ASTNode.js";
import { NodeTypes } from "../core/NodeTypes.js";


export class ArrayDeclarationNode extends ASTNode {


    /**
     * Crea un nodo de declaración
     * de arreglo.
     *
     * @param {any} identifier
     * Nombre del arreglo declarado.
     *
     * @param {any[]} dimensions
     * Lista de expresiones que representan
     * las dimensiones del arreglo.
     *
     * @param {any} dataType
     * Tipo de dato almacenado.
     * 
     * @param {any} location
     */
    constructor(
        identifier,
        dimensions = [],
        dataType,
        location
    ) {

        super(NodeTypes.ARRAY_DECLARATION, location);



        /**
         * Identificador del arreglo.
         *
         * Ejemplo:
         *
         * IdentifierNode("matriz")
         *
         * @type {any}
         */
        this.identifier = identifier;



        /**
         * Dimensiones del arreglo.
         *
         * Ejemplo:
         *
         * [
         *    LiteralNode(3),
         *    LiteralNode(3)
         * ]
         *
         * Representa:
         *
         * matriz[3][3]
         *
         * @type {any[]}
         */
        this.dimensions = dimensions;



        /**
         * Tipo de dato almacenado.
         *
         * Ejemplo:
         *
         * Entero
         * Real
         *
         * @type {any}
         */
        this.dataType = dataType;

    }



    /**
     * Agrega una dimensión
     * al arreglo.
     *
     * @param {any} dimension
     */
    addDimension(dimension) {

        this.dimensions.push(dimension);

    }

}