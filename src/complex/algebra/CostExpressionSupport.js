import {
    isCostExpression
} from "./CostExpression.js";
import {
    CostExpressionFactory as Cost
} from "./CostExpressionFactory.js";
import {
    formatCostExpression
} from "./CostExpressionFormatter.js";
import {
    simplifyCostExpression
} from "./CostExpressionSimplifier.js";

/**
 * Conserva `expression` como contrato textual y adjunta el nuevo modelo como
 * metadatos no enumerables para no alterar JSON ni consumidores históricos.
 */
export function attachCostExpression(
    target,
    expression
) {
    const costExpression =
        isCostExpression(expression)
            ? expression
            : Cost.raw(
                String(expression)
            );
    const simplifiedCostExpression =
        simplifyCostExpression(
            costExpression
        );

    target.expression =
        isCostExpression(expression)
            ? formatCostExpression(
                costExpression
            )
            : String(expression);

    Object.defineProperties(
        target,
        {
            costExpression: {
                value:
                    costExpression
            },
            simplifiedCostExpression: {
                value:
                    simplifiedCostExpression
            },
            simplifiedExpression: {
                value:
                    formatCostExpression(
                        simplifiedCostExpression
                    )
            }
        }
    );

    return target;
}
