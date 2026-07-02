/**
 * 
 * BlockNode.js
 * 
 * ==================================
 * BLOCK NODE
 * ==================================
 *
 * Representa un bloque de instrucciones
 * dentro del AST.
 *
 * Ejemplos:
 *
 *     Si
 *     Mientras
 *     Para
 *     Funcion
 *     Procedimiento
 *
 * contienen bloques de instrucciones.
 *
 * El nodo mantiene el orden original
 * de las instrucciones.
 * ==================================
 */

import { NodeTypes } from "../core/NodeTypes.js";


export class BlockNode {

    /**
     * Crea un nodo de bloque.
     *
     * @param {any[]} statements
     * Lista de instrucciones contenidas
     * en el bloque.
     */
    constructor(statements = []) {
        
        this.type = NodeTypes.BLOCK;
        this.statements = statements;
        
    }
}