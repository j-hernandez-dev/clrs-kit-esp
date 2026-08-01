
import {
    attachCostExpression
} from "./algebra/CostExpressionSupport.js";

export class BlockCostNode{
    constructor(
        type,
        location,
        expression,
        instructions = [], //costNode
    )
    {
        this.type = type;
        this.location = location;
        attachCostExpression(
            this,
            expression
        );
        this.instructions = instructions;
    }
}
