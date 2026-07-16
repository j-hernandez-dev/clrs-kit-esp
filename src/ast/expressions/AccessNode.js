/**
 * 
 * AccessNode.js
 * 
 * ==================================
 * ACCESS NODE
 * ==================================
 *
 * Representa el acceso a un identificador
 * o elemento de un arreglo dentro del AST.
 *
 * Ejemplos:
 *
 *     variable
 *
 *     arreglo[indice]
 *
 *     matriz[fila][columna]
 *
 * Los índices son expresiones del AST,
 * por lo que pueden contener operaciones,
 * llamadas a funciones u otros accesos.
 *
 * La validación de existencia del símbolo
 * y dimensiones corresponde al análisis
 * semántico.
 * ==================================
 */

import { ASTNode } from "../core/ASTNode.js";
import { NodeTypes } from "../core/NodeTypes.js";


export class AccessNode extends ASTNode {


    /**
     * Crea un nodo de acceso.
     *
     * @param {any} identifier
     * Nodo identificador base.
     *
     * @param {any[]} indexes
     * Lista de índices utilizados
     * para acceder al elemento.
     * 
     * @param {any} location
     */
    constructor(identifier, indexes = [], location) {

        super(NodeTypes.ACCESS, location);


        /**
         * Identificador base.
         *
         * Ejemplo:
         *
         * IdentifierNode("matriz")
         *
         * @type {any}
         */
        this.identifier = identifier;


        /**
         * Índices del acceso.
         *
         * Ejemplo:
         *
         * matriz[i][j]
         *
         * [
         *   IdentifierNode("i"),
         *   IdentifierNode("j")
         * ]
         *
         * @type {any[]}
         */
        this.indexes = indexes;

    }


    /**
     * Agrega un índice al acceso.
     *
     * @param {any} index
     * Expresión utilizada como índice.
     */
    addIndex(index) {

        this.indexes.push(index);

    }
}