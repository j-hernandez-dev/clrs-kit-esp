
import {
    attachCostExpression
} from "./algebra/CostExpressionSupport.js";

export class CostNode{
    constructor(
        type,
        location,
        expression
    )
    {
        this.type = type;
        this.location = location;
        attachCostExpression(
            this,
            expression
        );
    }
}
