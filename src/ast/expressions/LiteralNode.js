/**
 *
 * LiteralNode.js
 *
 * ==================================
 * LITERAL NODE
 * ==================================
 *
 * Nodo del AST encargado de representar
 * valores literales tipados.
 *
 * Ejemplos:
 *
 * 10
 * 3.14
 * "Hola"
 * Verdadero
 * Falso
 * Nulo
 *
 * IMPORTANTE:
 * El tipo del nodo NO es genérico "Literal",
 * sino el tipo específico:
 *
 * NumberLiteral | StringLiteral | BooleanLiteral | NullLiteral
 *
 * ==================================
 */

import { ASTNode } from "../core/ASTNode.js";

export class LiteralNode extends ASTNode {

    /**
     * @param {string} literalType
     * @param {string} dataType
     * @param {any} value
     * @param {any} location
     */
    constructor(literalType, value, location) {

        /**
         * IMPORTANTE:
         * El type del nodo ES el literal específico.
         *
         * Ejemplo:
         * NumberLiteral
         * StringLiteral
         * BooleanLiteral
         */
        super(literalType, location);

        /**
         * Valor real del literal.
         *
         * number | string | boolean 
         *
         * @type {any}
         */
        this.value = value;
    }
}