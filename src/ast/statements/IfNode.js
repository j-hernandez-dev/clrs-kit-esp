/**
 * 
 * IfNode.js
 * 
 * ==================================
 * IF NODE
 * ==================================
 *
 * Representa una estructura condicional
 * dentro del AST.
 *
 * Soporta:
 *
 *     Si
 *     Sino Si
 *     Sino
 *
 * Ejemplo:
 *
 * Si edad >= 18 Entonces
 *
 *     Escribir "Adulto"
 *
 * Sino
 *
 *     Escribir "Menor"
 *
 * Fin Si
 *
 * ==================================
 */

import { ASTNode } from "../core/ASTNode.js";
import { NodeTypes } from "../core/NodeTypes.js";


export class IfNode extends ASTNode {


    /**
     * Crea un nodo condicional.
     *
     * @param {any} condition
     * Expresión que determina la ejecución
     * del bloque principal.
     *
     * @param {any} thenBlock
     * Bloque ejecutado cuando la condición
     * es verdadera.
     *
     * @param {any[]} elseIfBranches
     * Lista de ramas alternativas.
     * 
     * @param {any} location
     *
     * Cada elemento tiene:
     *
     * {
     *    condition,
     *    block
     * }
     *
     * @param {any} elseBlock
     * Bloque ejecutado cuando ninguna
     * condición anterior se cumple.
     */
    constructor(
        condition,
        thenBlock,
        elseIfBranches = [],
        elseBlock = null,
        location
    ) {

        super(NodeTypes.IF_STATEMENT, location);


        /**
         * Condición principal.
         *
         * Ejemplo:
         *
         * BinaryExpressionNode(>=)
         *
         * @type {any}
         */
        this.condition = condition;


        /**
         * Bloque principal.
         *
         * @type {any}
         */
        this.thenBlock = thenBlock;


        /**
         * Ramas else-if.
         *
         * Ejemplo:
         *
         * [
         *    {
         *       condition,
         *       block
         *    }
         * ]
         *
         * @type {any[]}
         */
        this.elseIfBranches = elseIfBranches;


        /**
         * Bloque else opcional.
         *
         * @type {any}
         */
        this.elseBlock = elseBlock;

    }


    /**
     * Agrega una rama else-if.
     *
     * @param {any} condition
     * Condición alternativa.
     *
     * @param {any} block
     * Bloque asociado.
     */
    addElseIf(condition, block) {

        this.elseIfBranches.push({
            condition,
            block
        });

    }


    /**
     * Define el bloque else.
     *
     * @param {any} block
     * Bloque alternativo final.
     */
    setElse(block) {

        this.elseBlock = block;

    }


}