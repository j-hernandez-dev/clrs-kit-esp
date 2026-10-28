
import {
    attachCostExpression
} from "./algebra/CostExpressionSupport.js";
import {
    attachScenarioCost
} from "./scenario/ScenarioCostSupport.js";

export class BlockCostNode{
    constructor(
        type,
        location,
        expression,
        instructions = [], //costNode
        scenarioCost = null
    )
    {
        this.type = type;
        this.location = location;
        attachCostExpression(
            this,
            expression
        );
        attachScenarioCost(
            this,
            scenarioCost,
            this.costExpression
        );
        this.instructions = instructions;
    }
}
