import {
    NodeTypes
} from "../../ast/core/NodeTypes.js";
import {
    ControlFlowDataFlowAnalysis
} from "../control-flow/index.js";
import {
    SymbolicValueResolver
} from "../iteration/SymbolicValueResolver.js";

/**
 * Modelo de flujo deliberadamente pequeño para el cortafuegos de solidez.
 *
 * No intenta sustituir un CFG/SSA completo. Su contrato es más acotado:
 * conserva qué instrucciones son alcanzables, corta el flujo después de
 * `retornar` y registra los caminos de salida y las guardas que protegen las
 * llamadas. Los analizadores posteriores pueden rechazar una demostración
 * cuando esta evidencia no basta, en vez de publicar un resultado exacto.
 */
export class ComplexityControlFlowAnalysis {

    constructor({
        reachable = [],
        functions = [],
        analyses = []
    } = {}) {
        this.reachable = new WeakSet(
            reachable
        );
        this.functions = Object.freeze(
            functions.map(record =>
                freezeFunctionRecord(record)
            )
        );
        this.functionByName = new Map(
            this.functions.map(record => [
                record.name,
                record
            ])
        );
        this.functionByNode = new WeakMap(
            this.functions.map(record => [
                record.node,
                record
            ])
        );
        this.analysisByName = new Map(
            analyses.map(analysis => [
                analysis.graph.name,
                analysis
            ])
        );
        this.analysisByNode = new WeakMap(
            analyses.map(analysis => [
                analysis.graph.node,
                analysis
            ])
        );
        this.blockByNode = new WeakMap();
        this.stateBeforeByNode = new WeakMap();
        this.stateAfterByNode = new WeakMap();
        this.contextBeforeByNode = new WeakMap();
        this.contextAfterByNode = new WeakMap();
        this.loopEntryStateByNode = new WeakMap();
        this.callSiteByNode = new WeakMap();

        for (const analysis of analyses) {
            for (const site of analysis.callSites) {
                this.callSiteByNode.set(
                    site.node,
                    site
                );
            }

            for (const block of analysis.graph.blocks) {
                for (const node of block.astNodes) {
                    this.blockByNode.set(node, block);
                    const before = analysis
                        .stateBeforeByNode.get(node);
                    const after = analysis
                        .stateAfterByNode.get(node);
                    const beforeContext = analysis
                        .contextBeforeByNode.get(node);
                    const afterContext = analysis
                        .contextAfterByNode.get(node);

                    if (before != null) {
                        this.stateBeforeByNode.set(
                            node,
                            before
                        );
                    }
                    if (after != null) {
                        this.stateAfterByNode.set(
                            node,
                            after
                        );
                    }
                    if (beforeContext != null) {
                        this.contextBeforeByNode.set(
                            node,
                            beforeContext
                        );
                    }
                    if (afterContext != null) {
                        this.contextAfterByNode.set(
                            node,
                            afterContext
                        );
                    }
                }

                const loopEntry = analysis
                    .loopEntryStateByNode
                    .get(block.node);

                if (loopEntry != null) {
                    this.loopEntryStateByNode.set(
                        block.node,
                        loopEntry
                    );
                }
            }
        }
    }

    isReachable(node) {
        return this.reachable.has(node);
    }

    getFunction(value) {
        if (typeof value === "string") {
            return this.functionByName.get(
                value
            ) ?? null;
        }

        return this.functionByNode.get(
            value
        ) ?? null;
    }

    getGraph(value) {
        return this.getAnalysis(value)
            ?.graph ?? null;
    }

    getBlock(node) {
        return this.blockByNode.get(node) ??
            null;
    }

    getStateBefore(node) {
        return this.stateBeforeByNode
            .get(node) ?? null;
    }

    getStateAfter(node) {
        return this.stateAfterByNode
            .get(node) ?? null;
    }

    getContextBefore(node) {
        return this.contextBeforeByNode
            .get(node) ?? null;
    }

    getContextAfter(node) {
        return this.contextAfterByNode
            .get(node) ?? null;
    }

    createResolverBefore(node, options = {}) {
        return this.getStateBefore(node)
            ?.createResolver(options) ??
            null;
    }

    getLoopEntryState(node) {
        return this.loopEntryStateByNode
            .get(node) ?? null;
    }

    createResolverAtLoopEntry(
        node,
        options = {}
    ) {
        return this.getLoopEntryState(node)
            ?.createResolver(options) ??
            null;
    }

    getCallSite(node) {
        return this.callSiteByNode.get(node) ??
            null;
    }

    getAnalysis(value) {
        if (typeof value === "string") {
            return this.analysisByName.get(value) ??
                null;
        }

        return this.analysisByNode.get(value) ??
            null;
    }
}

export class ComplexityControlFlowAnalysisService {

    constructor(options = {}) {
        this.dataFlowAnalyzer =
            options.dataFlowAnalyzer ??
            new ControlFlowDataFlowAnalysis();
    }

    analyze(ast, options = {}) {
        if (ast?.type !== NodeTypes.PROGRAM) {
            throw new TypeError(
                "Complexity control-flow analysis requires a Program AST."
            );
        }

        const reachable = [];
        const reachableSet = new WeakSet();
        const functions = [];
        const analyses = [];
        const markReachable = node => {
            if (
                node != null &&
                typeof node === "object" &&
                !reachableSet.has(node)
            ) {
                reachableSet.add(node);
                reachable.push(node);
            }
        };

        for (const statement of ast.statements ?? []) {
            markReachable(statement);

            if (
                statement.type !==
                NodeTypes.FUNCTION_DECLARATION
            ) {
                continue;
            }

            const paths = analyzeFunction(
                statement,
                markReachable
            );
            const dataFlow =
                this.dataFlowAnalyzer
                    .analyzeFunction(
                        statement,
                        {
                            createResolver: () =>
                                new SymbolicValueResolver(
                                    undefined,
                                    {
                                        functionSummaryResolver:
                                            options
                                                .functionSummaryResolver ??
                                            null
                                    }
                                ),
                            functionSummaryResolver:
                                options
                                    .functionSummaryResolver ??
                                null
                        }
                    );
            const sitesByNode = new WeakMap(
                dataFlow.callSites.map(site => [
                    site.node,
                    site
                ])
            );

            analyses.push(dataFlow);
            for (const node of dataFlow.reachable) {
                markReachable(node);
            }
            functions.push({
                ...paths,
                graph: dataFlow.graph,
                callSites: paths.callSites.map(site => ({
                    ...site,
                    symbolic:
                        sitesByNode.get(site.node) ??
                        null
                }))
            });
        }

        return new ComplexityControlFlowAnalysis({
            reachable,
            functions,
            analyses
        });
    }
}

function analyzeFunction(node, markReachable) {
    const exits = [];
    const callSites = [];
    const initial = [createPathState()];
    const continuing = processStatements(
        node.body?.statements ?? [],
        initial,
        exits,
        callSites,
        markReachable
    );

    exits.push(
        ...continuing.map(state => ({
            ...state,
            kind: "fallthrough",
            location:
                node.body?.location ??
                node.location ??
                null
        }))
    );

    return {
        name: node.identifier.name,
        node,
        exits,
        callSites
    };
}

function processStatements(
    statements,
    states,
    exits,
    callSites,
    markReachable
) {
    let current = states;

    for (const statement of statements) {
        if (current.length === 0) {
            break;
        }

        markReachable(statement);
        current = processStatement(
            statement,
            current,
            exits,
            callSites,
            markReachable
        );
    }

    return deduplicateStates(current);
}

function processStatement(
    statement,
    states,
    exits,
    callSites,
    markReachable
) {
    if (
        statement.type ===
        NodeTypes.IF_STATEMENT
    ) {
        return processIf(
            statement,
            states,
            exits,
            callSites,
            markReachable
        );
    }

    if (
        statement.type ===
            NodeTypes.WHILE_STATEMENT ||
        statement.type ===
            NodeTypes.FOR_STATEMENT
    ) {
        return processLoop(
            statement,
            states,
            exits,
            callSites,
            markReachable
        );
    }

    const withCalls = addCalls(
        states,
        statement,
        callSites
    );

    if (
        statement.type !==
        NodeTypes.RETURN_STATEMENT
    ) {
        return withCalls;
    }

    exits.push(
        ...withCalls.map(state => ({
            ...state,
            kind: "return",
            location:
                statement.location ?? null
        }))
    );

    return [];
}

function processIf(
    statement,
    states,
    exits,
    callSites,
    markReachable
) {
    const branches = [
        {
            condition: statement.condition,
            block: statement.thenBlock
        },
        ...(statement.elseIfBranches ?? [])
            .map(branch => ({
                condition: branch.condition,
                block: branch.block
            }))
    ];
    const outputs = [];
    let remaining = states;

    for (const branch of branches) {
        const evaluated = addCalls(
            remaining,
            branch.condition,
            callSites
        );
        const selected = evaluated.map(state =>
            withConstraint(
                state,
                branch.condition,
                true
            )
        );

        outputs.push(
            ...processStatements(
                branch.block?.statements ?? [],
                selected,
                exits,
                callSites,
                markReachable
            )
        );
        remaining = evaluated.map(state =>
            withConstraint(
                state,
                branch.condition,
                false
            )
        );
    }

    if (statement.elseBlock != null) {
        outputs.push(
            ...processStatements(
                statement.elseBlock.statements ?? [],
                remaining,
                exits,
                callSites,
                markReachable
            )
        );
    } else {
        outputs.push(...remaining);
    }

    return deduplicateStates(outputs);
}

function processLoop(
    statement,
    states,
    exits,
    callSites,
    markReachable
) {
    const condition = statement.condition;
    const evaluated = addCalls(
        states,
        [
            statement.initializer,
            condition,
            statement.increment
        ],
        callSites
    );
    const zeroIteration = evaluated.map(state =>
        withConstraint(
            state,
            condition,
            false
        )
    );
    const bodyStates = evaluated.map(state =>
        withConstraint(
            state,
            condition,
            true
        )
    );
    const afterBody = processStatements(
        statement.body?.statements ?? [],
        bodyStates,
        exits,
        callSites,
        markReachable
    ).map(state =>
        withConstraint(
            state,
            condition,
            false
        )
    );

    return deduplicateStates([
        ...zeroIteration,
        ...afterBody
    ]);
}

function addCalls(
    states,
    value,
    callSites
) {
    const calls = collectFunctionCalls(value);

    if (calls.length === 0) {
        return states;
    }

    return states.map(state => {
        let current = state;

        for (const call of calls) {
            callSites.push({
                node: call,
                name: call.identifier.name,
                constraints:
                    current.constraints
            });
            current = {
                ...current,
                calls: new Set([
                    ...current.calls,
                    call.identifier.name
                ])
            };
        }

        return current;
    });
}

function collectFunctionCalls(
    value,
    calls = []
) {
    if (Array.isArray(value)) {
        for (const item of value) {
            collectFunctionCalls(
                item,
                calls
            );
        }

        return calls;
    }

    if (
        value == null ||
        typeof value !== "object" ||
        value.type ===
            NodeTypes.FUNCTION_DECLARATION
    ) {
        return calls;
    }

    if (
        value.type ===
        NodeTypes.FUNCTION_CALL
    ) {
        calls.push(value);
    }

    for (const [key, child] of Object.entries(value)) {
        if (
            key === "location" ||
            key === "identifier" ||
            key === "body" ||
            key === "thenBlock" ||
            key === "elseBlock" ||
            key === "elseIfBranches"
        ) {
            continue;
        }

        collectFunctionCalls(child, calls);
    }

    return calls;
}

function createPathState() {
    return {
        calls: new Set(),
        constraints: Object.freeze([])
    };
}

function withConstraint(
    state,
    condition,
    truth
) {
    if (condition == null) {
        return state;
    }

    return {
        ...state,
        constraints: Object.freeze([
            ...state.constraints,
            Object.freeze({
                condition,
                truth: Boolean(truth),
                identifiers:
                    Object.freeze([
                        ...collectIdentifierNames(
                            condition
                        )
                    ].sort())
            })
        ])
    };
}

function collectIdentifierNames(
    node,
    names = new Set()
) {
    if (
        node == null ||
        typeof node !== "object"
    ) {
        return names;
    }

    if (node.type === NodeTypes.IDENTIFIER) {
        names.add(node.name);
        return names;
    }

    for (const [key, value] of Object.entries(node)) {
        if (
            key === "location" ||
            key === "type" ||
            key === "identifier"
        ) {
            continue;
        }

        if (Array.isArray(value)) {
            for (const item of value) {
                collectIdentifierNames(
                    item,
                    names
                );
            }
        } else {
            collectIdentifierNames(
                value,
                names
            );
        }
    }

    return names;
}

function deduplicateStates(states) {
    const unique = new Map();

    for (const state of states) {
        const key = JSON.stringify({
            calls: [...state.calls].sort(),
            constraints:
                state.constraints.map(item => ({
                    line:
                        item.condition?.location
                            ?.startLine ?? null,
                    truth: item.truth,
                    identifiers:
                        item.identifiers
                }))
        });

        unique.set(key, state);
    }

    return [...unique.values()];
}

function freezeFunctionRecord(record) {
    return Object.freeze({
        name: record.name,
        node: record.node,
        graph: record.graph ?? null,
        exits: Object.freeze(
            record.exits.map(exit =>
                freezePath(exit)
            )
        ),
        callSites: Object.freeze(
            record.callSites.map(site =>
                Object.freeze({
                    node: site.node,
                    name: site.name,
                    constraints:
                        Object.freeze([
                            ...site.constraints
                        ]),
                    symbolic:
                        site.symbolic ?? null
                })
            )
        )
    });
}

function freezePath(path) {
    return Object.freeze({
        kind: path.kind,
        calls: Object.freeze([
            ...path.calls
        ].sort()),
        constraints:
            Object.freeze([
                ...path.constraints
            ]),
        location:
            path.location == null
                ? null
                : Object.freeze({
                    ...path.location
                })
    });
}
