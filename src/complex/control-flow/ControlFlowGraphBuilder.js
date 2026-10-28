import {
    NodeTypes
} from "../../ast/core/NodeTypes.js";
import {
    ControlFlowBlockKind as BlockKind,
    ControlFlowEdgeKind as EdgeKind,
    ControlFlowGraph
} from "./ControlFlowGraph.js";

export class ControlFlowGraphBuilder {

    build(functionNode) {
        this.functionNode = functionNode;
        this.name = functionNode.identifier.name;
        this.blocks = [];
        this.edges = [];
        this.blockSequence = 0;
        this.edgeSequence = 0;

        const entry = this.addBlock(
            BlockKind.ENTRY,
            functionNode,
            "function-entry",
            [functionNode]
        );
        const exit = this.addBlock(
            BlockKind.EXIT,
            functionNode,
            "function-exit",
            []
        );
        this.exitId = exit.id;
        const continuing = this.buildSequence(
            functionNode.body?.statements ?? [],
            [entry.id]
        );

        for (const blockId of continuing) {
            this.addEdge(
                blockId,
                exit.id,
                EdgeKind.NORMAL
            );
        }

        return new ControlFlowGraph({
            name: this.name,
            node: functionNode,
            entry: entry.id,
            exit: exit.id,
            blocks: this.blocks,
            edges: this.edges
        });
    }

    buildSequence(statements, incoming) {
        let current = [...incoming];

        for (const statement of statements) {
            if (current.length === 0) {
                break;
            }

            current = this.buildStatement(
                statement,
                current
            );
        }

        return current;
    }

    buildStatement(statement, incoming) {
        if (statement.type === NodeTypes.IF_STATEMENT) {
            return this.buildIf(
                statement,
                incoming
            );
        }

        if (statement.type === NodeTypes.WHILE_STATEMENT) {
            return this.buildWhile(
                statement,
                incoming
            );
        }

        if (statement.type === NodeTypes.FOR_STATEMENT) {
            return this.buildFor(
                statement,
                incoming
            );
        }

        const block = this.addBlock(
            BlockKind.STATEMENT,
            statement,
            statement.type,
            collectAstNodes(statement)
        );

        this.connectAll(
            incoming,
            block.id
        );

        if (
            statement.type ===
            NodeTypes.RETURN_STATEMENT
        ) {
            this.addEdge(
                block.id,
                this.exitId,
                EdgeKind.RETURN
            );
            return [];
        }

        return [block.id];
    }

    buildIf(statement, incoming) {
        const join = this.addBlock(
            BlockKind.JOIN,
            statement,
            "if-join",
            []
        );
        const branches = [
            {
                condition: statement.condition,
                block: statement.thenBlock,
                role: "if-condition"
            },
            ...(statement.elseIfBranches ?? [])
                .map((branch, index) => ({
                    condition: branch.condition,
                    block: branch.block,
                    role: `else-if-condition-${index}`
                }))
        ];
        const conditions = branches.map(
            (branch, index) =>
                this.addBlock(
                BlockKind.CONDITION,
                index === 0
                    ? statement
                    : branch.condition,
                branch.role,
                [
                    ...(index === 0
                        ? [statement]
                        : []),
                    ...collectAstNodes(
                        branch.condition
                    )
                ]
                )
        );

        this.connectAll(
            incoming,
            conditions[0].id
        );

        for (let index = 0; index < branches.length; index++) {
            const branch = branches[index];
            const condition = conditions[index];
            const bodyEntry = this.addBlock(
                BlockKind.STATEMENT,
                branch.block,
                `branch-entry-${index}`,
                []
            );

            this.addEdge(
                condition.id,
                bodyEntry.id,
                EdgeKind.TRUE,
                branch.condition,
                true
            );
            const branchEnds =
                this.buildSequence(
                    branch.block?.statements ?? [],
                    [bodyEntry.id]
                );

            this.connectAll(
                branchEnds,
                join.id
            );

            if (index < branches.length - 1) {
                this.addEdge(
                    condition.id,
                    conditions[index + 1].id,
                    EdgeKind.FALSE,
                    branch.condition,
                    false
                );
            }
        }

        this.finishElse(
            statement,
            [conditions.at(-1).id],
            branches.at(-1)?.condition,
            join
        );

        return [join.id];
    }

    finishElse(
        statement,
        pendingFalse,
        condition,
        join
    ) {
        if (statement.elseBlock == null) {
            for (const from of pendingFalse) {
                this.addEdge(
                    from,
                    join.id,
                    EdgeKind.FALSE,
                    condition,
                    false
                );
            }
            return;
        }

        const elseEntry = this.addBlock(
            BlockKind.STATEMENT,
            statement.elseBlock,
            "else-entry",
            []
        );

        for (const from of pendingFalse) {
            this.addEdge(
                from,
                elseEntry.id,
                EdgeKind.FALSE,
                condition,
                false
            );
        }
        const ends = this.buildSequence(
            statement.elseBlock.statements ?? [],
            [elseEntry.id]
        );

        this.connectAll(ends, join.id);
    }

    buildWhile(statement, incoming) {
        const header = this.addBlock(
            BlockKind.LOOP_HEADER,
            statement,
            "while-condition",
            [
                statement,
                ...collectAstNodes(
                    statement.condition
                )
            ]
        );
        const bodyEntry = this.addBlock(
            BlockKind.LOOP_BODY,
            statement.body,
            "while-body",
            []
        );
        const after = this.addBlock(
            BlockKind.JOIN,
            statement,
            "while-exit",
            []
        );

        this.connectAll(incoming, header.id);
        this.addEdge(
            header.id,
            bodyEntry.id,
            EdgeKind.TRUE,
            statement.condition,
            true
        );
        this.addEdge(
            header.id,
            after.id,
            EdgeKind.FALSE,
            statement.condition,
            false
        );
        const bodyEnds = this.buildSequence(
            statement.body?.statements ?? [],
            [bodyEntry.id]
        );

        for (const end of bodyEnds) {
            this.addEdge(
                end,
                header.id,
                EdgeKind.BACK,
                null,
                null,
                true
            );
        }

        return [after.id];
    }

    buildFor(statement, incoming) {
        const initializer = this.addBlock(
            BlockKind.FOR_INITIALIZER,
            statement.initializer,
            "for-initializer",
            collectAstNodes(
                statement.initializer
            )
        );
        const header = this.addBlock(
            BlockKind.LOOP_HEADER,
            statement,
            "for-condition",
            [
                statement,
                ...collectAstNodes(
                    statement.condition
                )
            ]
        );
        const bodyEntry = this.addBlock(
            BlockKind.LOOP_BODY,
            statement.body,
            "for-body",
            []
        );
        const increment = this.addBlock(
            BlockKind.FOR_INCREMENT,
            statement.increment,
            "for-increment",
            collectAstNodes(
                statement.increment
            )
        );
        const after = this.addBlock(
            BlockKind.JOIN,
            statement,
            "for-exit",
            []
        );

        this.connectAll(incoming, initializer.id);
        this.addEdge(
            initializer.id,
            header.id,
            EdgeKind.NORMAL
        );
        this.addEdge(
            header.id,
            bodyEntry.id,
            EdgeKind.TRUE,
            statement.condition,
            true
        );
        this.addEdge(
            header.id,
            after.id,
            EdgeKind.FALSE,
            statement.condition,
            false
        );
        const bodyEnds = this.buildSequence(
            statement.body?.statements ?? [],
            [bodyEntry.id]
        );

        this.connectAll(bodyEnds, increment.id);
        this.addEdge(
            increment.id,
            header.id,
            EdgeKind.BACK,
            null,
            null,
            true
        );

        return [after.id];
    }

    addBlock(kind, node, role, astNodes) {
        const block = {
            id: `${this.name}:b${this.blockSequence++}`,
            kind,
            node,
            role,
            astNodes:
                [...new Set(
                    astNodes.filter(Boolean)
                )],
            location:
                node?.location ?? null
        };

        this.blocks.push(block);
        return block;
    }

    addEdge(
        from,
        to,
        kind,
        condition = null,
        truth = null,
        backEdge = false
    ) {
        this.edges.push({
            id: `${this.name}:e${this.edgeSequence++}`,
            from,
            to,
            kind,
            condition,
            truth,
            backEdge
        });
    }

    connectAll(fromIds, toId) {
        for (const from of fromIds) {
            this.addEdge(
                from,
                toId,
                EdgeKind.NORMAL
            );
        }
    }
}

function collectAstNodes(
    value,
    nodes = []
) {
    if (Array.isArray(value)) {
        for (const item of value) {
            collectAstNodes(item, nodes);
        }
        return nodes;
    }

    if (
        value == null ||
        typeof value !== "object"
    ) {
        return nodes;
    }

    nodes.push(value);

    for (const [key, child] of Object.entries(value)) {
        if (
            key === "location" ||
            key === "body" ||
            key === "thenBlock" ||
            key === "elseBlock" ||
            key === "elseIfBranches"
        ) {
            continue;
        }

        collectAstNodes(child, nodes);
    }

    return nodes;
}
