/**
 * ASTNode.js
 * 
 * ==================================
 * AST NODE
 * ==================================
 *
 * Clase base para todos los nodos
 * pertenecientes al AST.
 *
 * Los nodos concretos deberán extender
 * esta clase.
 * ==================================
 */

export class ASTNode {

    /**
     * @param {any} type
     * @param {object} location
     */
    constructor(type, location) {

        this.type = type;
        this.location = location;

    }


    toJSON() {

        return {
            ...this
        };

    }

}