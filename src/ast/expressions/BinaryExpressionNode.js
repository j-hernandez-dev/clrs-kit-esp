/**
 *
 * BinaryExpressionNode.js
 *
 * ==================================
 * BINARY EXPRESSION NODE
 * ==================================
 *
 * Representa una expresión binaria del AST.
 *
 * SOLO operaciones:
 *  - Aritméticas: + - * / ^ %
 *  - Comparación: < > <= >= == !=
 *
 * Ejemplos:
 *  - x + 10
 *  - edad >= 18
 *
 * IMPORTANTE:
 * Las expresiones lógicas (Y, O) NO van aquí.
 * Usar LogicalExpressionNode.
 *
 * ==================================
 */

import { ASTNode } from "../core/ASTNode.js";
import { NodeTypes } from "../core/NodeTypes.js";

export class BinaryExpressionNode extends ASTNode {

    /**
     * @param {string} operator
     * @param {ASTNode} left
     * @param {ASTNode} right
     * @param {any} location
     */
    constructor(operator, left, right, location) {

        super(NodeTypes.BINARY_EXPRESSION, location);

        /**
         * Operador:
         * +, -, *, /, MOD, ^, <, >, <=, >=, ==, !=
         *
         * @type {string}
         */
        this.operator = operator;

        /**
         * Lado izquierdo
         * @type {import("../core/ASTNode.js").ASTNode}
         */
        this.left = left;

        /**
         * Lado derecho
         * @type {import("../core/ASTNode.js").ASTNode}
         */
        this.right = right;
    }
}