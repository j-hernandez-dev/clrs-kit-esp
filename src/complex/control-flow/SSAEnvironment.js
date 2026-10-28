import {
    costExpressionKey
} from "../algebra/CostExpression.js";
import {
    SymbolicValueResolver
} from "../iteration/SymbolicValueResolver.js";
import {
    CostExpressionFactory as Cost
} from "../algebra/CostExpressionFactory.js";

/**
 * Estado SSA interno del análisis de complejidad.
 *
 * Las versiones identifican definiciones, pero nunca sustituyen los nombres
 * fuente dentro de las expresiones de costo. De este modo `n#2` no puede
 * filtrarse accidentalmente al clasificador asintótico.
 */
export class SSAEnvironment {

    constructor({
        resolver = new SymbolicValueResolver(),
        bindings = new Map(),
        allocator = null
    } = {}) {
        this.resolver = resolver;
        this.bindings = new Map(bindings);
        this.allocator = allocator ??
            new SSAVersionAllocator();
    }

    clone() {
        return new SSAEnvironment({
            resolver: this.resolver.clone(),
            bindings: this.bindings,
            allocator: this.allocator
        });
    }

    isReachable() {
        return this.resolver.isReachable();
    }

    defineParameter(name, node = null) {
        this.resolver.define(name);
        this.bindings.set(
            name,
            createBinding({
                name,
                version:
                    this.allocator.parameter(
                        name
                    ),
                expression:
                    this.resolver.get(name),
                abstractValue:
                    this.resolver
                        .getAbstract(name),
                definitions:
                    node == null ? [] : [node],
                source: "parameter"
            })
        );

        return this;
    }

    assign(name, expression, node) {
        this.resolver.assign(
            name,
            expression
        );
        this.bindings.set(
            name,
            createBinding({
                name,
                version:
                    this.allocator.definition(
                        node,
                        name
                    ),
                expression:
                    this.resolver.get(name),
                abstractValue:
                    this.resolver
                        .getAbstract(name),
                definitions: [node],
                source: "assignment"
            })
        );

        return this;
    }

    defineUnknown(name, node) {
        this.resolver.define(name);
        this.bindings.set(
            name,
            createBinding({
                name,
                version:
                    this.allocator.definition(
                        node,
                        name
                    ),
                expression:
                    this.resolver.get(name),
                abstractValue:
                    this.resolver
                        .getAbstract(name),
                definitions: [node],
                source: "input"
            })
        );

        return this;
    }

    assume(condition, truth) {
        this.resolver.assume(
            condition,
            truth
        );

        return this;
    }

    get(name) {
        return this.bindings.get(name) ??
            null;
    }

    resolve(node) {
        return this.resolver.resolve(node);
    }

    resolveAlternatives(node) {
        return resolveExpressionAlternatives(
            node,
            this
        );
    }

    snapshot() {
        return new SSAStateSnapshot({
            environment:
                this.resolver.snapshot(),
            bindings:
                [...this.bindings.values()],
            reachable:
                this.isReachable()
        });
    }

    widen(joinKey) {
        this.resolver.environment.constraints =
            new Map();

        for (const [name, binding] of this.bindings) {
            this.resolver.define(
                name,
                Cost.symbol(name),
                {
                    exact: false,
                    source:
                        "cfg-widening"
                }
            );
            const symbolic = this.resolver
                .getBinding(name);

            this.bindings.set(
                name,
                createBinding({
                    name,
                    version:
                        this.allocator.phi(
                            `widen:${joinKey}`,
                            name
                        ),
                    expression:
                        symbolic.expression,
                    abstractValue:
                        symbolic.abstractValue,
                    definitions:
                        binding.definitions,
                    alternatives: [
                        Cost.symbol(name)
                    ],
                    source:
                        "cfg-widening",
                    phi: true,
                    phiJoinKey:
                        `widen:${joinKey}`
                })
            );
        }

        return this;
    }

    static merge(
        environments,
        allocator,
        joinKey,
        options = {}
    ) {
        const candidates = environments
            .filter(environment =>
                environment?.isReachable()
            );

        if (candidates.length === 0) {
            const unreachable =
                new SSAEnvironment({
                    allocator
                });

            unreachable.resolver
                .environment.reachable = false;
            return unreachable;
        }

        if (candidates.length === 1) {
            return candidates[0].clone();
        }

        const resolver = candidates[0]
            .resolver.clone()
            .merge(
                candidates.map(
                    candidate =>
                        candidate.resolver
                )
            );
        const commonNames = [
            ...candidates[0]
                .bindings.keys()
        ].filter(name =>
            candidates.every(candidate =>
                candidate.bindings.has(name)
            )
        );
        const bindings = new Map();

        for (const name of commonNames) {
            const incoming = candidates.map(
                candidate =>
                    candidate.bindings.get(name)
            );
            const signatures = new Set(
                incoming.map(binding =>
                    binding.version
                )
            );

            if (signatures.size === 1) {
                bindings.set(
                    name,
                    incoming[0]
                );
                continue;
            }

            const alternatives =
                deduplicateAlternatives(
                    incoming.flatMap(binding =>
                        binding.alternatives
                    )
                );
            const existingPhi = incoming.find(
                binding =>
                    binding.phiJoinKey ===
                    joinKey
            );

            if (options.widen === true) {
                resolver.define(
                    name,
                    Cost.symbol(name),
                    {
                        exact: false,
                        source:
                            "loop-phi-widening"
                    }
                );
            }
            const safeMerged = resolver
                .getBinding(name);

            bindings.set(
                name,
                createBinding({
                    name,
                    version:
                        existingPhi?.version ??
                        allocator.phi(
                            joinKey,
                            name
                        ),
                    expression:
                        safeMerged.expression,
                    abstractValue:
                        safeMerged.abstractValue,
                    definitions:
                        incoming.flatMap(
                            binding =>
                                binding.definitions
                        ),
                    alternatives,
                    source: "phi",
                    phi: true,
                    phiJoinKey: joinKey
                })
            );
        }

        return new SSAEnvironment({
            resolver,
            bindings,
            allocator
        });
    }
}

export class SSAStateSnapshot {

    constructor({
        environment,
        bindings = [],
        reachable = true
    }) {
        this.kind = "ssa-state";
        this.environment = environment;
        this.bindings = Object.freeze([
            ...bindings
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

    getConstraints() {
        return this.environment
            .getConstraints();
    }

    createResolver(options = {}) {
        return SymbolicValueResolver
            .fromSnapshot(
                this.environment,
                options
            );
    }

    resolve(node, options = {}) {
        return this.createResolver(options)
            .resolve(node);
    }

    resolveAlternatives(node, options = {}) {
        if (node?.type === "Identifier") {
            return this.get(node.name)
                ?.alternatives ??
                [this.resolve(node, options)];
        }

        return [this.resolve(node, options)];
    }
}

export class SSAVersionAllocator {

    constructor() {
        this.nextVersion = 1;
        this.parameters = new Map();
        this.definitions = new WeakMap();
        this.phis = new Map();
    }

    parameter(name) {
        if (!this.parameters.has(name)) {
            this.parameters.set(
                name,
                this.nextVersion++
            );
        }

        return this.parameters.get(name);
    }

    definition(node, name) {
        let versions =
            this.definitions.get(node);

        if (versions == null) {
            versions = new Map();
            this.definitions.set(
                node,
                versions
            );
        }

        if (!versions.has(name)) {
            versions.set(
                name,
                this.nextVersion++
            );
        }

        return versions.get(name);
    }

    phi(joinKey, name) {
        const key = `${joinKey}:${name}`;

        if (!this.phis.has(key)) {
            this.phis.set(
                key,
                this.nextVersion++
            );
        }

        return this.phis.get(key);
    }
}

function createBinding({
    name,
    version,
    expression,
    abstractValue,
    definitions = [],
    alternatives = null,
    source,
    phi = false,
    phiJoinKey = null
}) {
    const normalizedAlternatives =
        alternatives == null
            ? [expression]
            : alternatives;

    return Object.freeze({
        kind: "ssa-binding",
        name,
        version,
        displayName: `${name}#${version}`,
        expression,
        abstractValue,
        definitions:
            Object.freeze([
                ...new Set(definitions)
            ]),
        alternatives:
            Object.freeze(
                deduplicateAlternatives(
                    normalizedAlternatives
                )
            ),
        source,
        phi: Boolean(phi),
        phiJoinKey
    });
}

function deduplicateAlternatives(values) {
    const unique = new Map();

    for (const value of values) {
        unique.set(
            costExpressionKey(value),
            value
        );
    }

    return [...unique.values()];
}

function resolveExpressionAlternatives(
    node,
    environment
) {
    if (node?.type === "Identifier") {
        return environment.get(node.name)
            ?.alternatives ??
            [environment.resolve(node)];
    }

    // La expansión combinatoria de expresiones compuestas pertenece a la IR
    // de recurrencias. El CFG conserva la alternativa exacta cuando el
    // argumento es el nombre unido por φ y mantiene una expresión segura para
    // el resto.
    return [environment.resolve(node)];
}
