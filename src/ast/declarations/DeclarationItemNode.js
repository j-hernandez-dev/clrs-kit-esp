import { ASTNode } from "../core/ASTNode.js";
import { NodeTypes } from "../core/NodeTypes.js";


export class DeclarationItemNode extends ASTNode {


    /**
     * @param {any} identifier
     * @param {any} dimensions
     * @param {any} location
     */
    constructor(
        identifier,
        dimensions = [],
        location
    ) {

        super(NodeTypes.DECLARATION_ITEM, location);

        this.identifier = identifier;

        this.dimensions = dimensions;

    }

    isArray() {

        return this.dimensions.length > 0;

    }

}