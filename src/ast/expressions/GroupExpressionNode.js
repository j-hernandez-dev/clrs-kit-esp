/**
 * 
 * GroupExpressionNode.js
 * 
 * ==================================
 * GROUP EXPRESSION NODE
 * ==================================
 *
 * Representa una expresión agrupada
 * mediante paréntesis.
 *
 * Ejemplo:
 *
 *     (a + b)
 *
 * El nodo conserva la agrupación
 * sintáctica encontrada en el CST.
 *
 * La evaluación o transformación
 * corresponde a fases posteriores.
 * ==================================
 */

import { ASTNode } from "../core/ASTNode.js";
import { NodeTypes } from "../core/NodeTypes.js";


export class GroupExpressionNode extends ASTNode {


    /**
     * Crea un nodo de agrupación.
     *
     * @param {any} expression
     * @param {any} location
     * Expresión contenida dentro
     * del grupo.
     */
    constructor(expression, location) {

        super(NodeTypes.GROUP_EXPRESSION, location);


        /**
         * Expresión interna.
         *
         * Puede ser cualquier nodo
         * de expresión del AST.
         *
         * Ejemplo:
         *
         * BinaryExpressionNode
         * LiteralNode
         * FunctionCallNode
         *
         * @type {any}
         */
        this.expression = expression;
        this.location = location;

    }


}