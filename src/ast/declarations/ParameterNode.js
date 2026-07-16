/**
 * 
 * ParameterNode.js
 * 
 * ==================================
 * PARAMETER NODE
 * ==================================
 *
 * Representa un parámetro formal
 * dentro de una función o procedimiento.
 *
 * Ejemplos:
 *
 * Funcion Sumar(a Entero, b Entero)
 *
 * Procedimiento Ordenar(lista[10] Entero)
 *
 * Contiene:
 *
 * - identificador del parámetro
 * - dimensiones opcionales
 * - tipo de dato
 *
 * ==================================
 */


import { ASTNode } from "../core/ASTNode.js";
import { NodeTypes } from "../core/NodeTypes.js";


export class ParameterNode extends ASTNode {


    /**
     * Crea un nodo parámetro.
     *
     * @param {any} identifier
     * Identificador del parámetro.
     *
     * @param {any[]} dimensions
     * Dimensiones opcionales en caso
     * de ser un parámetro arreglo.
     *
     * @param {any} dataType
     * Tipo de dato del parámetro.
     * 
     * @param {any} location
     */
    constructor(
        identifier,
        dimensions = [],
        location
    ) {

        super(NodeTypes.PARAMETER, location);



        /**
         * Nombre del parámetro.
         *
         * Ejemplo:
         *
         * IdentifierNode("edad")
         *
         * @type {any}
         */
        this.identifier = identifier;



        /**
         * Dimensiones del parámetro.
         *
         * Ejemplo:
         *
         * lista[10]
         *
         * [
         *    LiteralNode(10)
         * ]
         *
         * @type {any[]}
         */
        this.dimensions = dimensions;
    }
}