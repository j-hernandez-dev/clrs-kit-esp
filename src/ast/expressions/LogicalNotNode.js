/**
 * 
 * LogicalNotNode.js
 * 
 * ==================================
 * LOGICAL NOT NODE
 * ==================================
 *
 * Nodo del AST encargado de representar
 * la negación lógica.
 *
 * Representa el operador:
 *
 *     No
 *
 * Ejemplos:
 *
 * No Verdadero
 *
 * No (edad >= 18)
 *
 * ==================================
 */


import { ASTNode } from "../core/ASTNode.js";

import { NodeTypes } from "../core/NodeTypes.js";



export class LogicalNotNode extends ASTNode {


    /**
     * @param {any} operator
     * @param {any} operand
     * @param {any} location
     */
    constructor(operator, operand, location) {

        super(NodeTypes.LOGICAL_NOT, location);

        /**
         * Operando sobre el cual se aplica
         * la negación lógica.
         *
         * Puede ser cualquier expresión.
         *
         * Ejemplos:
         *
         * LiteralNode
         * IdentifierNode
         * BinaryExpressionNode
         *
         * @type {any}
         */
        this.operator = operator;
        this.operand = operand;
    }
}