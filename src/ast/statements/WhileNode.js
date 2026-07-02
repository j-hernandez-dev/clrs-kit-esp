/**
 * 
 * WhileNode.js
 * 
 * ==================================
 * WHILE NODE
 * ==================================
 *
 * Representa una estructura repetitiva
 * Mientras dentro del AST.
 *
 * Ejemplo:
 *
 * Mientras contador < 10
 *
 *     Escribir contador
 *
 * Fin Mientras
 *
 * Contiene:
 *
 * - condición de repetición
 * - bloque de instrucciones
 *
 * ==================================
 */

import { ASTNode } from "../core/ASTNode.js";
import { NodeTypes } from "../core/NodeTypes.js";


export class WhileNode extends ASTNode {


    /**
     * Crea un nodo Mientras.
     *
     * @param {any} condition
     * Expresión evaluada antes de cada
     * iteración.
     *
     * @param {any} body
     * Bloque de instrucciones ejecutado
     * mientras la condición sea verdadera.
     * 
     * @param {any} location
     */
    constructor(condition, body, location) {
        super(NodeTypes.WHILE_STATEMENT, location);


        /**
         * Condición del ciclo.
         *
         * Ejemplo:
         *
         * BinaryExpressionNode
         *
         * contador < 10
         *
         * @type {any}
         */
        this.condition = condition;


        /**
         * Cuerpo del ciclo.
         *
         * Normalmente corresponde
         * a un BlockNode.
         *
         * @type {any}
         */
        this.body = body;

    }

}