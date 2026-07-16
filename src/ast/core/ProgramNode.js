/**
 *
 * ProgramNode.js
 *
 * ==================================
 * PROGRAM NODE
 * ==================================
 *
 * Representa el nodo raíz del AST.
 *
 * Contiene todas las declaraciones e
 * instrucciones pertenecientes al programa.
 *
 * Ejemplo:
 *
 * Declarar contador Como Entero
 *
 * Funcion Calcular()
 *     ...
 * Fin Funcion
 *
 * Escribir contador
 *
 * El árbol completo inicia desde este nodo.
 * ==================================
 */


import { ASTNode } from "./ASTNode.js";
import { NodeTypes } from "./NodeTypes.js";



export class ProgramNode extends ASTNode {

    /**
     * Crea un nodo programa.
     *
     * @param {any[]} statements
     * Lista de declaraciones e instrucciones
     * pertenecientes al programa.
     * @param {any} location
     */
    constructor(statements = [], location) {

        super(NodeTypes.PROGRAM, location);

        /**
         * Contenido principal
         * del programa.
         *
         * Puede contener:
         *
         * - VariableDeclarationNode
         * - ConstantDeclarationNode
         * - FunctionDeclarationNode
         * - ProcedureDeclarationNode
         * - AssignmentNode
         * - IfNode
         * - WhileNode
         * - etc.
         *
         * @type {any[]}
         */
        this.statements = statements;

    }

    /**
     * Agrega un nodo al programa.
     *
     * @param {any} statement
     * Nodo AST perteneciente al programa.
     */
    addStatement(statement) {

        this.statements.push(statement);

    }



}