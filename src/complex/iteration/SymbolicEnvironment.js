import {
    requireCostExpression
} from "../algebra/CostExpression.js";
import {
    CostExpressionFactory as Cost
} from "../algebra/CostExpressionFactory.js";
import {
    areCostExpressionsEquivalent,
    canonicalizeCostExpression
} from "../algebra/CostExpressionCanonicalizer.js";
import {
    createAbstractValue,
    joinAbstractValues,
    refineAbstractValue,
    symbolicAbstractValue,
    withAbstractExpression
} from "../abstract-domain/index.js";
import {
    requireAbstractConstraint
} from "../abstract-domain/index.js";

export class SymbolicEnvironment {

    static fromSnapshot(snapshot) {
        if (
            snapshot?.kind !==
            "symbolic-environment"
        ) {
            throw new TypeError(
                "A symbolic environment snapshot is required."
            );
        }

        return new SymbolicEnvironment(
            new Map(
                snapshot.bindings.map(
                    binding => [
                        binding.name,
                        binding
                    ]
                )
            ),
            snapshot.constraints,
            snapshot.reachable
        );
    }

    constructor(
        bindings = new Map(),
        constraints = [],
        reachable = true
    ) {
        this.bindings =
            new Map(
                [...bindings.entries()]
                    .map(([name, value]) => [
                        name,
                        isBinding(value)
                            ? value
                            : createBinding(
                                name,
                                value
                            )
                    ])
            );
        this.constraints =
            new Map(
                [...constraints]
                    .map(constraint => {
                        requireAbstractConstraint(
                            constraint
                        );

                        return [
                            constraint.key,
                            constraint
                        ];
                    })
            );
        this.reachable = Boolean(reachable);
    }

    clone() {
        return new SymbolicEnvironment(
            this.bindings,
            this.constraints.values(),
            this.reachable
        );
    }

    define(
        name,
        expression = Cost.symbol(name),
        options = {}
    ) {
        const binding =
            createBinding(
                name,
                expression,
                options
            );

        this.bindings.set(
            name,
            binding
        );

        return binding.expression;
    }

    forget(name) {
        this.bindings.delete(name);
    }

    has(name) {
        return this.bindings.has(name);
    }

    get(name) {
        return this.getBinding(name)
            ?.expression ??
            Cost.symbol(name);
    }

    getAbstract(name) {
        return this.getBinding(name)
            ?.abstractValue ??
            symbolicAbstractValue(name);
    }

    getBinding(name) {
        return this.bindings.get(name) ??
            null;
    }

    assume(constraint) {
        requireAbstractConstraint(constraint);

        if (this.reachable) {
            this.constraints.set(
                constraint.key,
                constraint
            );
        }

        return this;
    }

    refine(name, interval) {
        const current = this.getAbstract(name);
        const refined = refineAbstractValue(
            current,
            interval
        );

        if (refined == null) {
            this.reachable = false;
            return null;
        }

        const binding = this.getBinding(name);

        this.define(
            name,
            current.expression,
            {
                dependencies:
                    binding?.dependencies ??
                    new Set([name]),
                exact: binding?.exact ??
                    current.exact,
                source:
                    binding?.source ??
                    "constraint-refinement",
                abstractValue: refined
            }
        );

        return refined;
    }

    getConstraints() {
        return [...this.constraints.values()];
    }

    merge(environments) {
        const candidates =
            environments
                .map(environment =>
                    environment instanceof
                        SymbolicEnvironment
                        ? environment
                        : environment.environment
                )
                .filter(environment =>
                    environment?.reachable
                );

        if (candidates.length === 0) {
            this.bindings = new Map();
            this.constraints = new Map();
            this.reachable = false;
            return this;
        }

        const commonNames =
            [...candidates[0]
                .bindings.keys()]
                .filter(name =>
                    candidates.every(
                        environment =>
                            environment.has(name)
                    )
                );
        const merged = new Map();

        for (const name of commonNames) {
            const bindings =
                candidates.map(environment =>
                    environment.getBinding(name)
                );
            const first = bindings[0];
            const equivalent = bindings.every(binding =>
                areCostExpressionsEquivalent(
                    binding.expression,
                    first.expression
                )
            );
            const expression = equivalent
                ? first.expression
                : Cost.symbol(name);
            const abstractValue =
                joinAbstractValues(
                    bindings.map(binding =>
                        binding.abstractValue
                    ),
                    expression
                );

            merged.set(
                name,
                createBinding(
                    name,
                    abstractValue.expression,
                    {
                        dependencies:
                            new Set(
                                bindings.flatMap(binding =>
                                    binding.dependencies
                                )
                            ),
                        exact:
                            equivalent &&
                            bindings.every(binding =>
                                binding.exact
                            ),
                        source: "branch-merge",
                        abstractValue
                    }
                )
            );
        }

        this.bindings = merged;
        this.constraints = commonConstraints(
            candidates
        );
        this.reachable = true;

        return this;
    }

    entries() {
        return [...this.bindings.values()];
    }

    snapshot() {
        return new SymbolicEnvironmentSnapshot(
            this.entries(),
            this.getConstraints(),
            this.reachable
        );
    }
}

export class SymbolicEnvironmentSnapshot {

    constructor(
        bindings = [],
        constraints = [],
        reachable = true
    ) {
        this.kind = "symbolic-environment";
        this.bindings =
            Object.freeze([
                ...bindings
            ]);
        this.constraints =
            Object.freeze([
                ...constraints
            ]);
        this.reachable = Boolean(reachable);

        Object.freeze(this);
    }

    get(name) {
        return this.bindings.find(
            binding =>
                binding.name === name
        ) ?? null;
    }

    has(name) {
        return this.get(name) != null;
    }

    getConstraints() {
        return this.constraints;
    }
}

function createBinding(
    name,
    expression,
    options = {}
) {
    requireCostExpression(
        expression,
        `symbolic binding ${name}`
    );

    const canonical =
        canonicalizeCostExpression(
            expression
        );
    const dependencies =
        options.dependencies == null
            ? collectCostSymbols(canonical)
            : new Set(options.dependencies);
    const abstractValue =
        options.abstractValue == null
            ? createAbstractValue({
                expression: canonical,
                exact: options.exact !== false
            })
            : withAbstractExpression(
                options.abstractValue,
                canonical,
                {
                    exact:
                        options.exact ??
                        options.abstractValue.exact
                }
            );

    return Object.freeze({
        kind: "symbolic-binding",
        name,
        expression: canonical,
        abstractValue,
        dependencies:
            Object.freeze([
                ...dependencies
            ]),
        exact:
            options.exact ??
            abstractValue.exact,
        source:
            options.source ??
            "assignment"
    });
}

function commonConstraints(environments) {
    const first = environments[0];
    const common = new Map();

    for (const constraint of first.getConstraints()) {
        if (
            environments.every(environment =>
                environment.constraints.has(
                    constraint.key
                )
            )
        ) {
            common.set(
                constraint.key,
                constraint
            );
        }
    }

    return common;
}

function collectCostSymbols(
    expression,
    names = new Set()
) {
    if (expression.kind === "symbol") {
        names.add(expression.name);
        return names;
    }

    for (const value of Object.values(expression)) {
        if (Array.isArray(value)) {
            for (const item of value) {
                if (
                    item != null &&
                    typeof item === "object" &&
                    typeof item.kind === "string"
                ) {
                    collectCostSymbols(
                        item,
                        names
                    );
                }
            }
        } else if (
            value != null &&
            typeof value === "object" &&
            typeof value.kind === "string"
        ) {
            collectCostSymbols(
                value,
                names
            );
        }
    }

    return names;
}

function isBinding(value) {
    return value?.kind ===
        "symbolic-binding";
}
