/**
 * 
 * FunctionCallNode.js
 * 
 * ==================================
 * FUNCTION CALL NODE
 * ==================================
 *
 * Representa una llamada a función
 * dentro del AST.
 *
 * Ejemplo:
 *
 *     Sumar(a, b)
 *
 * Se utiliza dentro de expresiones,
 * ya que una función devuelve un valor.
 *
 * La validación de existencia de la función
 * y tipos de argumentos corresponde al
 * análisis semántico.
 * ==================================
 */

import { ASTNode } from "../core/ASTNode.js";
import { NodeTypes } from "../core/NodeTypes.js";


export class FunctionCallNode extends ASTNode {


    /**
     * Crea un nodo de llamada a función.
     *
     * @param {string} identifier
     * Nombre de la función llamada.
     *
     * @param {any[]} argumentsList
     * Lista de argumentos enviados
     * a la función.
     * @param {any} location
     */
    constructor(identifier, argumentsList = [], location) {

        super(NodeTypes.FUNCTION_CALL, location);


        /**
         * Nombre de la función.
         *
         * Ejemplo:
         *
         * CalcularPromedio
         */
        this.identifier = identifier;


        /**
         * Argumentos de la llamada.
         *
         * Cada elemento representa
         * otro nodo del AST.
         *
         * Ejemplo:
         *
         * [
         *    IdentifierNode("x"),
         *    LiteralNode(10)
         * ]
         *
         * @type {any[]}
         */
        this.arguments = argumentsList;

    }


    /**
     * Agrega un argumento
     * a la llamada.
     *
     * @param {any} argument
     */
    addArgument(argument) {

        this.arguments.push(argument);

    }


}