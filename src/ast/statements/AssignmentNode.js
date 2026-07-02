/**
 * 
 * AssignmentNode.js
 * 
 * ==================================
 * ASSIGNMENT NODE
 * ==================================
 *
 * Representa una asignación dentro
 * del AST.
 *
 * Ejemplos:
 *
 *     x <- 10
 *
 *     resultado <- a + b
 *
 *     arreglo[i] <- valor
 *
 * El nodo almacena:
 *
 * - destino de la asignación
 * - expresión que produce el valor
 *
 * La validación de:
 *
 * - existencia de variables
 * - modificación de constantes
 * - compatibilidad de tipos
 *
 * corresponde al análisis semántico.
 * ==================================
 */

import { ASTNode } from "../core/ASTNode.js";
import { NodeTypes } from "../core/NodeTypes.js";


export class AssignmentNode extends ASTNode {


    /**
     * Crea un nodo de asignación.
     *
     * @param {any} left
     * Nodo destino de la asignación.
     *
     * Puede ser:
     *
     * IdentifierNode
     * AccessNode
     *
     * @param {any} right
     * Expresión que produce el valor
     * asignado.
     * 
     * @param {any} location
     */
    constructor(left, right, location) {

        super(NodeTypes.ASSIGNMENT, location);


        /**
         * Destino de la asignación.
         *
         * Ejemplo:
         *
         * IdentifierNode("x")
         *
         * o
         *
         * AccessNode(array, [index])
         *
         * @type {any}
         */
        this.left = left;


        /**
         * Valor asignado.
         *
         * Ejemplo:
         *
         * BinaryExpressionNode
         * LiteralNode
         * FunctionCallNode
         *
         * @type {any}
         */
        this.right = right;

    }


}