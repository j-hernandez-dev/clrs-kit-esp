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
     * @param {string} type
     * @param {import("./ASTTypes.js").SourceLocation|null} location
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
