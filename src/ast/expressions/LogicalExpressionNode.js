/**
 * LogicalExpressionNode.js
 * ==================================
 * NODO DE EXPRESIÓN LÓGICA
 * ==================================
 *
 * Representa operaciones lógicas entre
 * dos expresiones booleanas.
 *
 * Ejemplos:
 *  - A Y B
 *  - X O Y
 *
 * ==================================
 */

import { ASTNode } from "../core/ASTNode.js";
import { NodeTypes } from "../core/NodeTypes.js";

export class LogicalExpressionNode extends ASTNode {

    /**
     * @param {string} operator
     * @param {any} left
     * @param {any} right
     * @param {any} location
     */
    constructor(operator, left, right, location) {

        super(NodeTypes.LOGICAL_EXPRESSION, location);

        /**
         * Operador lógico:
         * "Y" | "O"
         *
         * @type {string}
         */
        this.operator = operator;

        /**
         * Lado izquierdo de la expresión
         * @type {any}
         */
        this.left = left;

        /**
         * Lado derecho de la expresión
         * @type {any}
         */
        this.right = right;
    }
}