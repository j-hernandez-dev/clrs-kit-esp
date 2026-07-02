/**
 * 
 * ASTContext.js
 * 
 * ==================================
 * AST CONTEXT
 * ==================================
 *
 * Contexto compartido durante la
 * construcción y transformación del AST.
 *
 * Mantiene información auxiliar que puede
 * ser utilizada por los distintos visitors.
 * ==================================
 */

export class ASTContext {

    constructor() {

        /**
         * Nodo raíz actual del AST
         */
        this.root = null;


        /**
         * Pila de nodos durante construcción.
         * 
         * Permite manejar estructuras
         * anidadas como:
         * 
         * Si
         * Mientras
         * Para
         * Funciones
         * Procedimientos
         * @type {any[]}
         */
        this.nodeStack = [];


        /**
         * Información adicional futura.
         *
         * Reservado para:
         *
         * - scopes
         * - símbolos
         * - referencias
         * - metadatos
         */
        this.metadata = {};

    }




    /**
     * =========================
     * STACK MANAGEMENT
     * =========================
     * @param {any} node
     */
    pushNode(node) {

        this.nodeStack.push(node);

    }


    popNode() {

        return this.nodeStack.pop();

    }


    currentNode() {

        return this.nodeStack[
            this.nodeStack.length - 1
        ];

    }




    /**
     * =========================
     * ROOT
     * =========================
     * @param {any} node
     */
    setRoot(node) {

        this.root = node;

    }


    getRoot() {

        return this.root;

    }

}