import {
    NodeTypes
} from "../../ast/core/NodeTypes.js";
import {
    CostExpressionFactory as Cost
} from "../algebra/CostExpressionFactory.js";
import {
    simplifyCostExpression
} from "../algebra/CostExpressionSimplifier.js";
import {
    applyAbstractFunctionEffect,
    binaryAbstractValue,
    compareAbstractValues,
    constantAbstractValue,
    createAbstractConstraint,
    createAbstractInterval,
    unaryAbstractValue,
    unknownAbstractValue,
    withAbstractExpression
} from "../abstract-domain/index.js";
import {
    getStandardLibraryDefinition
} from "../../standard-library/StandardLibraryCatalog.js";
import {
    SymbolicEnvironment
} from "./SymbolicEnvironment.js";

const COMPARISON_OPERATORS =
    new Set([
        "<",
        "<=",
        ">",
        ">=",
        "==",
        "!="
    ]);

const INVERSE_OPERATORS =
    Object.freeze({
        "<": ">",
        "<=": ">=",
        ">": "<",
        ">=": "<=",
        "==": "==",
        "!=": "!="
    });

/**
 * Mantiene valores simbÃ³licos y hechos abstractos conocidos antes de cada
 * instrucciÃ³n. La expresiÃ³n histÃ³rica se conserva para el cÃ¡lculo de costo;
 * intervalos, signos y restricciones sÃ³lo agregan pruebas seguras.
 */
export class SymbolicValueResolver {

    static fromSnapshot(
        snapshot,
        options = {}
    ) {
        return new SymbolicValueResolver(
            SymbolicEnvironment.fromSnapshot(
                snapshot
            ),
            options
        );
    }

    constructor(
        environment =
            new SymbolicEnvironment(),
        options = {}
    ) {
        this.environment =
            environment instanceof
                SymbolicEnvironment
                ? environment
                : new SymbolicEnvironment(
                    environment
                );
        this.functionSummaryResolver =
            options.functionSummaryResolver ??
            null;
    }

    clone() {
        return new SymbolicValueResolver(
            this.environment.clone(),
            {
                functionSummaryResolver:
                    this.functionSummaryResolver
            }
        );
    }

    merge(resolvers) {
        this.environment.merge(
            resolvers.map(resolver =>
                resolver.environment
            )
        );

        return this;
    }

    snapshot() {
        return this.environment
            .snapshot();
    }

    define(
        name,
        expression = Cost.symbol(name),
        options = {}
    ) {
        return this.environment.define(
            name,
            expression,
            options
        );
    }

    forget(name) {
        this.environment.forget(name);
    }

    assign(name, astExpression) {
        const value = this.resolveAbstract(
            astExpression
        );
        const dependencies =
            this.resolveDependencies(
                astExpression
            );

        this.define(
            name,
            value.expression,
            {
                dependencies,
                source: "assignment",
                abstractValue: value
            }
        );

        return value.expression;
    }

    get(name) {
        return this.environment.get(name);
    }

    getAbstract(name) {
        return this.environment.getAbstract(name);
    }

    getBinding(name) {
        return this.environment
            .getBinding(name);
    }

    has(name) {
        return this.environment.has(name);
    }

    isReachable() {
        return this.environment.reachable;
    }

    getConstraints() {
        return this.environment
            .getConstraints();
    }

    /**
     * Registra una condiciÃ³n de camino y reduce intervalos cuando la forma es
     * una comparaciÃ³n directa con una variable. Las relaciones completas se
     * preservan incluso cuando aÃºn no existe un solver relacional.
     */
    assume(condition, truth = true) {
        this.assumeCondition(
            condition,
            truth
        );

        return this;
    }

    resolveDependencies(
        node,
        dependencies = new Set()
    ) {
        if (
            node == null ||
            typeof node !== "object"
        ) {
            return dependencies;
        }

        if (
            node.type ===
            NodeTypes.IDENTIFIER
        ) {
            dependencies.add(node.name);
            const binding =
                this.getBinding(node.name);

            for (
                const dependency
                of binding?.dependencies ?? []
            ) {
                dependencies.add(dependency);
            }

            return dependencies;
        }

        for (
            const [key, value]
            of Object.entries(node)
        ) {
            if (
                key === "location" ||
                key === "type"
            ) {
                continue;
            }

            if (Array.isArray(value)) {
                for (const item of value) {
                    this.resolveDependencies(
                        item,
                        dependencies
                    );
                }
            } else {
                this.resolveDependencies(
                    value,
                    dependencies
                );
            }
        }

        return dependencies;
    }

    resolve(node) {
        return this.resolveAbstract(node)
            .expression;
    }

    resolveAbstract(node) {
        if (
            node == null ||
            typeof node !== "object"
        ) {
            return unknownAbstractValue();
        }

        switch (node.type) {
            case NodeTypes.NUMBER_LITERAL:
            case NodeTypes.SCIENTIFIC_LITERAL:
                return constantAbstractValue(
                    Number(node.value)
                );
            case NodeTypes.BOOLEAN_LITERAL:
                return constantAbstractValue(
                    node.value === "TRUE"
                        ? 1
                        : 0
                );
            case NodeTypes.IDENTIFIER:
                return this.getAbstract(
                    node.name
                );
            case NodeTypes.GROUP_EXPRESSION:
                return this.resolveGroupAbstract(
                    node
                );
            case NodeTypes.UNARY:
                return this.resolveUnaryAbstract(
                    node
                );
            case NodeTypes.LOGICAL_NOT:
                return this.resolveLogicalNotAbstract(
                    node
                );
            case NodeTypes.LOGICAL_EXPRESSION:
                return this.resolveLogicalAbstract(
                    node
                );
            case NodeTypes.BINARY_EXPRESSION:
                return this.resolveBinaryAbstract(
                    node
                );
            case NodeTypes.FUNCTION_CALL:
                return this.resolveCallAbstract(
                    node
                );
            case NodeTypes.ACCESS:
                return unknownAbstractValue();
            default:
                return unknownAbstractValue();
        }
    }

    resolveUnary(node) {
        return this.resolveUnaryAbstract(node)
            .expression;
    }

    resolveBinary(node) {
        return this.resolveBinaryAbstract(node)
            .expression;
    }

    resolveLogicalNot(node) {
        return this.resolveLogicalNotAbstract(node)
            .expression;
    }

    resolveLogical(node) {
        return this.resolveLogicalAbstract(node)
            .expression;
    }

    resolveGroupAbstract(node) {
        const value = this.resolveAbstract(
            node.expression
        );

        return withAbstractExpression(
            value,
            Cost.group(value.expression)
        );
    }

    resolveUnaryAbstract(node) {
        const operand = this.resolveAbstract(
            node.operand
        );
        const expression = node.operator === "+"
            ? operand.expression
            : node.operator === "-"
                ? simplifyCostExpression(
                    Cost.product([
                        Cost.constant(-1),
                        operand.expression
                    ])
                )
                : Cost.unknown();

        return unaryAbstractValue(
            node.operator,
            operand,
            expression
        );
    }

    resolveBinaryAbstract(node) {
        const left = this.resolveAbstract(
            node.left
        );
        const right = this.resolveAbstract(
            node.right
        );

        if (COMPARISON_OPERATORS.has(node.operator)) {
            const comparison =
                compareAbstractValues(
                    left,
                    right,
                    node.operator
                );

            return comparison == null
                ? unknownAbstractValue()
                : constantAbstractValue(
                    comparison ? 1 : 0
                );
        }

        const expression = binaryExpression(
            node.operator,
            left.expression,
            right.expression
        );

        return binaryAbstractValue(
            node.operator,
            left,
            right,
            expression
        );
    }

    resolveLogicalNotAbstract(node) {
        const truth = this.evaluateCondition(
            node.operand
        );

        return truth == null
            ? unknownAbstractValue()
            : constantAbstractValue(
                truth ? 0 : 1
            );
    }

    resolveLogicalAbstract(node) {
        const left = this.evaluateCondition(
            node.left
        );
        const right = this.evaluateCondition(
            node.right
        );

        if (node.operator === "&&") {
            if (left === false || right === false) {
                return constantAbstractValue(0);
            }

            return left === true && right === true
                ? constantAbstractValue(1)
                : unknownAbstractValue();
        }

        if (node.operator === "||") {
            if (left === true || right === true) {
                return constantAbstractValue(1);
            }

            return left === false && right === false
                ? constantAbstractValue(0)
                : unknownAbstractValue();
        }

        return unknownAbstractValue();
    }

    resolveCallAbstract(node) {
        const args = (node.arguments ?? [])
            .map(argument =>
                this.resolveAbstract(argument)
            );
        const expression = Cost.call(
            node.identifier.name,
            args.map(argument =>
                argument.expression
            )
        );
        const definition =
            getStandardLibraryDefinition(
                node.identifier.name
            );

        if (definition == null) {
            const resolved =
                this.functionSummaryResolver
                    ?.resolveCall(
                        node.identifier.name,
                        args
                    ) ??
                null;

            if (resolved != null) {
                return resolved;
            }
        }

        return applyAbstractFunctionEffect(
            definition?.symbolicEffect,
            args,
            expression
        );
    }

    evaluateCondition(node) {
        if (
            node?.type ===
            NodeTypes.LOGICAL_NOT
        ) {
            const value = this.evaluateCondition(
                node.operand
            );

            return value == null
                ? null
                : !value;
        }

        if (
            node?.type ===
            NodeTypes.LOGICAL_EXPRESSION
        ) {
            const left = this.evaluateCondition(
                node.left
            );
            const right = this.evaluateCondition(
                node.right
            );

            if (node.operator === "&&") {
                return left === false || right === false
                    ? false
                    : left === true && right === true
                        ? true
                        : null;
            }

            if (node.operator === "||") {
                return left === true || right === true
                    ? true
                    : left === false && right === false
                        ? false
                        : null;
            }
        }

        if (
            node?.type ===
                NodeTypes.BINARY_EXPRESSION &&
            COMPARISON_OPERATORS.has(
                node.operator
            )
        ) {
            return compareAbstractValues(
                this.resolveAbstract(node.left),
                this.resolveAbstract(node.right),
                node.operator
            );
        }

        const expression = this.resolve(node);
        const numeric = constantNumber(expression);

        return numeric == null
            ? null
            : Boolean(numeric);
    }

    assumeCondition(node, truth) {
        if (!this.isReachable()) {
            return;
        }

        if (
            node?.type ===
            NodeTypes.LOGICAL_NOT
        ) {
            this.assumeCondition(
                node.operand,
                !truth
            );
            return;
        }

        if (
            node?.type ===
            NodeTypes.LOGICAL_EXPRESSION
        ) {
            if (
                node.operator === "&&" &&
                truth ||
                node.operator === "||" &&
                !truth
            ) {
                this.assumeCondition(
                    node.left,
                    truth
                );
                this.assumeCondition(
                    node.right,
                    truth
                );
            }

            return;
        }

        if (
            node?.type !==
                NodeTypes.BINARY_EXPRESSION ||
            !COMPARISON_OPERATORS.has(
                node.operator
            )
        ) {
            return;
        }

        const operator = truth
            ? node.operator
            : inverseComparison(
                node.operator
            );
        const left = this.resolveAbstract(
            node.left
        );
        const right = this.resolveAbstract(
            node.right
        );
        const evaluated =
            compareAbstractValues(
                left,
                right,
                operator
            );

        if (evaluated === false) {
            this.environment.reachable = false;
            return;
        }

        this.environment.assume(
            createAbstractConstraint({
                left: left.expression,
                operator,
                right: right.expression
            })
        );
        this.refineDirectComparison(
            node.left,
            operator,
            right,
            node.right
        );
    }

    refineDirectComparison(
        leftNode,
        operator,
        rightValue,
        rightNode
    ) {
        if (
            leftNode?.type ===
            NodeTypes.IDENTIFIER
        ) {
            this.refineIdentifier(
                leftNode.name,
                operator,
                rightValue.interval
            );
            return;
        }

        if (
            rightNode?.type ===
            NodeTypes.IDENTIFIER
        ) {
            this.refineIdentifier(
                rightNode.name,
                inverseComparison(operator),
                this.resolveAbstract(
                    leftNode
                ).interval
            );
        }
    }

    refineIdentifier(name, operator, interval) {
        let refinement = null;

        switch (operator) {
            case "<":
            case "<=":
                refinement = createAbstractInterval(
                    -Infinity,
                    interval.upper
                );
                break;
            case ">":
            case ">=":
                refinement = createAbstractInterval(
                    interval.lower,
                    Infinity
                );
                break;
            case "==":
                refinement = interval;
                break;
            default:
                return;
        }

        this.environment.refine(
            name,
            refinement
        );
    }
}

function binaryExpression(
    operator,
    left,
    right
) {
    switch (operator) {
        case "+":
            return Cost.sum([
                left,
                right
            ]);
        case "-":
            return Cost.difference(
                left,
                right
            );
        case "*":
            return Cost.product([
                left,
                right
            ]);
        case "/":
            return Cost.quotient(
                left,
                right
            );
        case "^":
            return Cost.power(
                left,
                right
            );
        default:
            return Cost.unknown();
    }
}

function inverseComparison(operator) {
    return INVERSE_OPERATORS[operator] ??
        operator;
}

function constantNumber(expression) {
    const simplified =
        simplifyCostExpression(expression);

    return simplified.kind ===
        "constant"
        ? simplified.value
        : null;
}
