import {
    NodeTypes
} from "../../ast/core/NodeTypes.js";
import {
    CostExpressionFactory as Cost
} from "../algebra/CostExpressionFactory.js";
import {
    simplifyCostExpression
} from "../algebra/CostExpressionSimplifier.js";

/**
 * Mantiene valores simbólicos conocidos antes de cada instrucción.
 * Una asignación se resuelve al momento de registrarse para evitar que
 * cambios posteriores alteren retrospectivamente su significado.
 */
export class SymbolicValueResolver {

    constructor(bindings = new Map()) {
        this.bindings =
            new Map(bindings);
    }

    clone() {
        return new SymbolicValueResolver(
            this.bindings
        );
    }

    define(
        name,
        expression = Cost.symbol(name)
    ) {
        this.bindings.set(
            name,
            expression
        );

        return expression;
    }

    forget(name) {
        this.bindings.delete(name);
    }

    assign(name, astExpression) {
        const expression =
            this.resolve(astExpression);

        this.define(
            name,
            expression
        );

        return expression;
    }

    get(name) {
        return (
            this.bindings.get(name) ??
            Cost.symbol(name)
        );
    }

    resolve(node) {
        if (
            node == null ||
            typeof node !== "object"
        ) {
            return Cost.unknown();
        }

        switch (node.type) {
            case NodeTypes.NUMBER_LITERAL:
            case NodeTypes.SCIENTIFIC_LITERAL:
                return Cost.constant(
                    Number(node.value)
                );
            case NodeTypes.IDENTIFIER:
                return this.get(
                    node.name
                );
            case NodeTypes.GROUP_EXPRESSION:
                return Cost.group(
                    this.resolve(
                        node.expression
                    )
                );
            case NodeTypes.UNARY:
                return this.resolveUnary(
                    node
                );
            case NodeTypes.BINARY_EXPRESSION:
                return this.resolveBinary(
                    node
                );
            case NodeTypes.FUNCTION_CALL:
                return Cost.call(
                    node.identifier.name,
                    (node.arguments ?? [])
                        .map(argument =>
                            this.resolve(
                                argument
                            )
                        )
                );
            default:
                return Cost.unknown();
        }
    }

    resolveUnary(node) {
        const operand =
            this.resolve(node.operand);

        if (node.operator === "+") {
            return operand;
        }

        if (node.operator === "-") {
            return simplifyCostExpression(
                Cost.product([
                    Cost.constant(-1),
                    operand
                ])
            );
        }

        return Cost.unknown();
    }

    resolveBinary(node) {
        const left =
            this.resolve(node.left);
        const right =
            this.resolve(node.right);
        let expression;

        switch (node.operator) {
            case "+":
                expression =
                    Cost.sum([
                        left,
                        right
                    ]);
                break;
            case "-":
                expression =
                    Cost.difference(
                        left,
                        right
                    );
                break;
            case "*":
                expression =
                    Cost.product([
                        left,
                        right
                    ]);
                break;
            case "/":
                expression =
                    Cost.quotient(
                        left,
                        right
                    );
                break;
            case "^":
                expression =
                    Cost.power(
                        left,
                        right
                    );
                break;
            default:
                return Cost.unknown();
        }

        return simplifyCostExpression(
            expression
        );
    }
}
