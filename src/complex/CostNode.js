
import {
    attachCostExpression
} from "./algebra/CostExpressionSupport.js";
import {
    attachScenarioCost
} from "./scenario/ScenarioCostSupport.js";

export class CostNode{
    constructor(
        type,
        location,
        expression,
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
    }
}
