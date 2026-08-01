import {
    CostExpressionFactory as Cost
} from "./algebra/CostExpressionFactory.js";
import {
    formatCostExpression
} from "./algebra/CostExpressionFormatter.js";
import {
    StandardLibraryCost,
    getStandardLibraryDefinition
} from "../standard-library/StandardLibraryCatalog.js";

const C = Cost.symbol("c");
const K = Cost.symbol("k");
const M = Cost.symbol("m");
const N = Cost.symbol("n");
const N_LOG_N =
    Cost.group(
        Cost.product([
            N,
            Cost.logarithm(N)
        ])
    );
const TWO_N =
    Cost.group(
        Cost.product([
            Cost.constant(2),
            N
        ])
    );

const COST_EXPRESSIONS =
    Object.freeze({
        [StandardLibraryCost.CONSTANT]:
            C,
        [StandardLibraryCost.LINEAR_N]:
            N,
        [StandardLibraryCost.LINEAR_M]:
            M,
        [StandardLibraryCost.LINEAR_K]:
            K,
        [StandardLibraryCost.N_LOG_N]:
            N_LOG_N,
        [StandardLibraryCost.TWO_N]:
            TWO_N
    });

/**
 * Contrato estructurado utilizado por el analizador.
 */
export function costSubstitution(name) {
    const definition =
        getStandardLibraryDefinition(
            name
        );

    return definition == null
        ? null
        : COST_EXPRESSIONS[
            definition.cost
        ] ??
        null;
}

/**
 * Fachada textual histórica.
 */
export function substitution(name) {
    const expression =
        costSubstitution(name);

    return expression == null
        ? null
        : formatCostExpression(
            expression
        );
}
