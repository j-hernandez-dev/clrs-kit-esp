/**
 * 
 * ReturnNode.js
 * 
 * ==================================
 * RETURN NODE
 * ==================================
 *
 * Representa una instrucción de retorno
 * dentro del AST.
 *
 * Ejemplo:
 *
 * Retornar promedio
 *
 * o:
 *
 * Retornar x + y
 *
 * Contiene la expresión cuyo valor será
 * devuelto por una función.
 *
 * ==================================
 */


import { ASTNode } from "../core/ASTNode.js";
import { NodeTypes } from "../core/NodeTypes.js";


export class ReturnNode extends ASTNode {


    /**
     * Crea un nodo Retornar.
     *
     * @param {any} expression
     * Expresión que será devuelta.
     *
     * Ejemplo:
     *
     * IdentifierNode
     *
     * BinaryExpressionNode
     *
     * LiteralNode
     * 
     * @param {any} location
     */
    constructor(expression, location) {

        super(NodeTypes.RETURN_STATEMENT, location);



        /**
         * Expresión retornada.
         *
         * Ejemplo:
         *
         * Retornar resultado
         *
         * @type {any}
         */
        this.expression = expression;

    }


}