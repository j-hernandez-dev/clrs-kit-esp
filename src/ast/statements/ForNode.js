/**
 * 
 * ForNode.js
 * 
 * ==================================
 * FOR NODE
 * ==================================
 *
 * Representa una estructura repetitiva
 * Para dentro del AST.
 *
 * Ejemplo:
 *
 * Para i <- 1 Hasta 10 Paso 2
 *
 *     Escribir i
 *
 * Fin Para
 *
 * Contiene:
 *
 * - variable de control
 * - valor inicial
 * - límite del ciclo
 * - paso opcional
 * - bloque de instrucciones
 *
 * ==================================
 */

import { ASTNode } from "../core/ASTNode.js";
import { NodeTypes } from "../core/NodeTypes.js";


export class ForNode extends ASTNode {


    /**
     * Crea un nodo Para.
     *
     * @param {any} initializer
     *
     * @param {any} condition
     *
     * @param {any} increment
     *
     * @param {any} body
     * 
     * @param {any} location
     */
    constructor(
        initializer,
        condition,
        increment,
        body,
        location
    ) {

        super(NodeTypes.FOR_STATEMENT, location);


        this.initializer = initializer;

        this.condition = condition;

        this.increment = increment;

        this.body = body;

    }

}