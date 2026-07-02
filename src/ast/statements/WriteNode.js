/**
 * 
 * WriteNode.js
 * 
 * ==================================
 * WRITE NODE
 * ==================================
 *
 * Representa una instrucción de salida.
 *
 * Ejemplo:
 *
 * Escribir "Hola"
 *
 * Escribir nombre, edad
 *
 * Contiene una lista de expresiones
 * que serán evaluadas durante la ejecución.
 * ==================================
 */


import { ASTNode } from "../core/ASTNode.js";
import { NodeTypes } from "../core/NodeTypes.js";


export class WriteNode extends ASTNode {


    /**
     * @param {any[]} expressions
     * @param {any} location
     */
    constructor(expressions = [], location) {

        super(NodeTypes.WRITE_STATEMENT, location);


        /**
         * Expresiones a mostrar.
         *
         * Ejemplo:
         *
         * Escribir nombre, edad
         *
         * [
         *   IdentifierNode(nombre),
         *   IdentifierNode(edad)
         * ]
         *
         * @type {any[]}
         */
        this.expressions = expressions;

    }



    /**
     * =========================
     * ADD EXPRESSION
     * =========================
     *
     * Agrega una expresión
     * adicional a la salida.
     *
     * @param {any} expression
     */
    addExpression(expression) {

        this.expressions.push(expression);

    }



    /**
     * =========================
     * CHILDREN
     * =========================
     *
     * Devuelve los nodos hijos
     * contenidos dentro del nodo.
     *
     * Útil para:
     *
     * - recorridos AST
     * - análisis semántico
     * - optimizaciones
     *
     * @returns {any[]}
     */
    getChildren() {

        return this.expressions;

    }

}