import { ASTNode } from "../core/ASTNode.js";
import { NodeTypes } from "../core/NodeTypes.js";

/**
 * Expresión literal de arreglo.
 *
 * Cada elemento es otra expresión del AST. Esta composición representa tanto
 * arreglos unidimensionales como arreglos anidados de profundidad arbitraria.
 */
export class ArrayExpressionNode extends ASTNode {
    /**
     * @param {any[]} elements
     * @param {any} location
     */
    constructor(elements = [], location) {
        super(NodeTypes.ARRAY_EXPRESSION, location);

        this.elements = elements;
    }
}
