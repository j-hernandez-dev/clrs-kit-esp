import {
    costExpressionKey
} from "../algebra/CostExpression.js";
import {
    NodeTypes
} from "../../ast/core/NodeTypes.js";
import {
    ControlFlowGraphBuilder
} from "./ControlFlowGraphBuilder.js";
import {
    ControlFlowBlockKind
} from "./ControlFlowGraph.js";
import {
    RelationalContext
} from "./RelationalContext.js";
import {
    SSAEnvironment,
    SSAVersionAllocator
} from "./SSAEnvironment.js";

const MAX_DATA_FLOW_STEPS = 1024;
const MAX_BLOCK_REVISITS = 32;

export class ControlFlowDataFlowAnalysis {

    constructor(options = {}) {
        this.graphBuilder =
            options.graphBuilder ??
            new ControlFlowGraphBuilder();
    }

    analyzeFunction(
        functionNode,
        options = {}
    ) {
        const graph = this.graphBuilder
            .build(functionNode);
        const allocator =
            new SSAVersionAllocator();
        const initial = new SSAEnvironment({
            resolver:
                options.createResolver(),
            allocator
        });

        for (
            const parameter
            of functionNode.parameters ?? []
        ) {
            const name =
                parameter.identifier?.name;

            if (name != null) {
                initial.defineParameter(
                    name,
                    parameter
                );
            }
        }

        const result = solveDataFlow(
            graph,
            initial,
            allocator,
            {
                functionSummaryResolver:
                    options
                        .functionSummaryResolver ??
                    null
            }
        );

        return Object.freeze({
            graph,
            ...result
        });
    }
}

function solveDataFlow(
    graph,
    initial,
    allocator,
    resolverOptions = {}
) {
    const incomingByEdge = new Map();
    const inputByBlock = new Map([
        [graph.entry, initial]
    ]);
    const outputByBlock = new Map();
    const queue = [graph.entry];
    const queued = new Set(queue);
    const visitsByBlock = new Map();
    let steps = 0;

    while (queue.length > 0) {
        if (steps++ > MAX_DATA_FLOW_STEPS) {
            throw new Error(
                `Control-flow data-flow analysis did not converge for ${graph.name}.`
            );
        }

        const blockId = queue.shift();
        queued.delete(blockId);
        const block = graph.getBlock(blockId);
        const input = inputByBlock.get(blockId);

        if (input == null) {
            continue;
        }

        const visits =
            (visitsByBlock.get(blockId) ?? 0) +
            1;

        visitsByBlock.set(blockId, visits);
        const output = transferBlock(
            block,
            input
        );

        if (visits > MAX_BLOCK_REVISITS) {
            output.widen(blockId);
        }
        const previousOutput =
            outputByBlock.get(blockId);

        if (
            previousOutput != null &&
            statesEqual(
                previousOutput,
                output
            )
        ) {
            continue;
        }

        outputByBlock.set(blockId, output);

        for (const edge of graph.successors(block)) {
            const edgeState = transferEdge(
                edge,
                output
            );

            incomingByEdge.set(
                edge.id,
                edgeState
            );
            const incoming = graph
                .predecessors(edge.to)
                .map(predecessor =>
                    incomingByEdge.get(
                        predecessor.id
                    )
                )
                .filter(Boolean);
            const merged = SSAEnvironment.merge(
                incoming,
                allocator,
                edge.to,
                {
                    widen:
                        graph.getBlock(edge.to)
                            ?.kind ===
                            ControlFlowBlockKind
                                .LOOP_HEADER &&
                        graph.predecessors(edge.to)
                            .some(predecessor =>
                                predecessor.backEdge
                            )
                }
            );
            const previous =
                inputByBlock.get(edge.to);

            if (
                previous == null ||
                !statesEqual(previous, merged)
            ) {
                inputByBlock.set(
                    edge.to,
                    merged
                );

                if (!queued.has(edge.to)) {
                    queue.push(edge.to);
                    queued.add(edge.to);
                }
            }
        }
    }

    const stateBeforeByNode = new WeakMap();
    const stateAfterByNode = new WeakMap();
    const contextBeforeByNode = new WeakMap();
    const contextAfterByNode = new WeakMap();
    const loopEntryStateByNode = new WeakMap();
    const callSites = [];
    const reachable = [];
    const seenReachable = new WeakSet();
    const seenCalls = new WeakSet();

    for (const block of graph.blocks) {
        const before = inputByBlock.get(block.id)
            ?.snapshot() ?? null;
        const after = outputByBlock.get(block.id)
            ?.snapshot() ?? null;

        if (before == null || !before.reachable) {
            continue;
        }

        const beforeContext =
            new RelationalContext(
                before,
                resolverOptions
            );
        const afterContext =
            new RelationalContext(
                after ?? before,
                resolverOptions
            );

        if (
            block.kind ===
            ControlFlowBlockKind.LOOP_HEADER
        ) {
            const loopEntry =
                findLoopEntryState(
                    graph,
                    block,
                    inputByBlock,
                    incomingByEdge,
                    allocator
                );

            if (loopEntry != null) {
                loopEntryStateByNode.set(
                    block.node,
                    loopEntry.snapshot()
                );
            }
        }

        for (const node of block.astNodes) {
            stateBeforeByNode.set(
                node,
                before
            );
            stateAfterByNode.set(
                node,
                after ?? before
            );
            contextBeforeByNode.set(
                node,
                beforeContext
            );
            contextAfterByNode.set(
                node,
                afterContext
            );

            if (!seenReachable.has(node)) {
                seenReachable.add(node);
                reachable.push(node);
            }

            if (
                node.type ===
                    NodeTypes.FUNCTION_CALL &&
                !seenCalls.has(node)
            ) {
                seenCalls.add(node);
                callSites.push(
                    createCallSite(
                        node,
                        before,
                        beforeContext,
                        resolverOptions
                    )
                );
            }
        }
    }

    return {
        inputByBlock,
        outputByBlock,
        stateBeforeByNode,
        stateAfterByNode,
        contextBeforeByNode,
        contextAfterByNode,
        loopEntryStateByNode,
        callSites:
            Object.freeze(callSites),
        reachable:
            Object.freeze(reachable)
    };
}

function findLoopEntryState(
    graph,
    block,
    inputByBlock,
    incomingByEdge,
    allocator
) {
    if (block.role === "for-condition") {
        const initializerEdge = graph
            .predecessors(block)
            .find(edge =>
                !edge.backEdge
            );
        const initializer = initializerEdge == null
            ? null
            : graph.getBlock(
                initializerEdge.from
            );

        return initializer == null
            ? null
            : inputByBlock.get(
                initializer.id
            ) ?? null;
    }

    const incoming = graph
        .predecessors(block)
        .filter(edge =>
            !edge.backEdge
        )
        .map(edge =>
            incomingByEdge.get(edge.id)
        )
        .filter(Boolean);

    return incoming.length === 0
        ? null
        : SSAEnvironment.merge(
            incoming,
            allocator,
            `${block.id}:entry`
        );
}

function transferBlock(block, input) {
    const output = input.clone();
    const node = block.node;

    if (
        node?.type === NodeTypes.ASSIGNMENT &&
        node.left?.type === NodeTypes.IDENTIFIER
    ) {
        output.assign(
            node.left.name,
            node.right,
            node
        );
        return output;
    }

    if (node?.type === NodeTypes.READ_STATEMENT) {
        for (const target of node.identifiers ?? []) {
            if (target.type === NodeTypes.IDENTIFIER) {
                output.defineUnknown(
                    target.name,
                    target
                );
            }
        }
    }

    return output;
}

function transferEdge(edge, output) {
    const result = output.clone();

    if (
        edge.condition != null &&
        edge.truth != null
    ) {
        result.assume(
            edge.condition,
            edge.truth
        );
    }

    return result;
}

function statesEqual(left, right) {
    return stateKey(left) ===
        stateKey(right);
}

function stateKey(state) {
    const snapshot = state.snapshot();

    return JSON.stringify({
        reachable: snapshot.reachable,
        bindings: snapshot.bindings
            .map(binding => ({
                name: binding.name,
                version: binding.version,
                expression:
                    costExpressionKey(
                        binding.expression
                    ),
                alternatives:
                    binding.alternatives.map(
                        costExpressionKey
                    ),
                interval:
                    binding.abstractValue
                        .interval
            }))
            .sort((left, right) =>
                left.name.localeCompare(
                    right.name
                )
            ),
        constraints:
            snapshot.getConstraints()
                .map(constraint =>
                    constraint.key
                )
                .sort()
    });
}

function createCallSite(
    node,
    state,
    context,
    resolverOptions
) {
    const argumentsList =
        node.arguments ?? [];

    return Object.freeze({
        node,
        name: node.identifier.name,
        arguments:
            Object.freeze(
                argumentsList.map(
                    argument =>
                        state.resolve(
                            argument,
                            resolverOptions
                        )
                )
            ),
        argumentAlternatives:
            Object.freeze(
                argumentsList.map(
                    argument =>
                        Object.freeze(
                            state.resolveAlternatives(
                                argument,
                                resolverOptions
                            )
                        )
                )
            ),
        context,
        ssaState: state
    });
}
