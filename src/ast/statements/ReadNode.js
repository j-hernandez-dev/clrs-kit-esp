/**
 * 
 * ReadNode.js
 * 
 * ==================================
 * READ NODE
 * ==================================
 *
 * Representa una instrucción de lectura
 * de datos dentro del AST.
 *
 * Ejemplos:
 *
 * Leer edad
 *
 * Leer nombre, apellido
 *
 * Leer x, y, z
 *
 * Contiene la lista de identificadores
 * donde se almacenarán los valores
 * ingresados.
 *
 * ==================================
 */

import { ASTNode } from "../core/ASTNode.js";
import { NodeTypes } from "../core/NodeTypes.js";


export class ReadNode extends ASTNode {


    /**
     * Crea un nodo Leer.
     *
     * @param {any[]} identifiers
     * Lista de identificadores destino.
     * 
     * @param {any} location
     */
    constructor(identifiers = [], location) {

        super(NodeTypes.READ_STATEMENT, location);


        /**
         * Variables destino.
         *
         * Ejemplo:
         *
         * [
         *   IdentifierNode("edad"),
         *   IdentifierNode("nombre")
         * ]
         *
         * @type {any[]}
         */
        this.identifiers = identifiers;

    }


    /**
     * Agrega un identificador
     * a la instrucción de lectura.
     *
     * @param {any} identifier
     */
    addIdentifier(identifier) {

        this.identifiers.push(identifier);

    }


}