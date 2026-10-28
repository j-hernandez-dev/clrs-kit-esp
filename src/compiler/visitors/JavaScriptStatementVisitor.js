import { NodeTypes } from "../../ast/core/NodeTypes.js";
import { ASTVisitor } from "../../ast/visitors/ASTVisitor.js";
import { TranspilerError } from "../../errors/TranspilerError.js";
import * as Tokens from "../../lexer/tokens/Index.js";
import {
    JavaScriptExpressionVisitor
} from "./JavaScriptExpressionVisitor.js";
import {
    RuntimeLocationInstrumentation
} from "../runtime/RuntimeLocationInstrumentation.js";
import {
    RuntimeCoverageInstrumentation
} from "../runtime/RuntimeCoverageInstrumentation.js";
import {
    RuntimeStateInstrumentation
} from "../runtime/RuntimeStateInstrumentation.js";
import {
    normalizeJavaScriptIdentifierResolver
} from "../JavaScriptIdentifierResolver.js";

/**
 * Emite instrucciones y bloques JavaScript.
 */
export class JavaScriptStatementVisitor extends ASTVisitor {

    constructor(
        expressionVisitor =
            new JavaScriptExpressionVisitor(),
        options = {}
    ) {
        super();

        if (
            !expressionVisitor ||
            typeof expressionVisitor.visit !== "function"
        ) {
            throw new TranspilerError(
                "A JavaScript expression visitor is required."
            );
        }

        this.expressionVisitor =
            expressionVisitor;
        this.runtimeLocations =
            options.runtimeLocations ??
            new RuntimeLocationInstrumentation();
        this.runtimeCoverage =
            options.runtimeCoverage ??
            new RuntimeCoverageInstrumentation();
        this.runtimeState =
            options.runtimeState ??
            new RuntimeStateInstrumentation();
        this.identifierResolver =
            normalizeJavaScriptIdentifierResolver(
                options.identifierResolver
            );
        this.setIdentifierResolver(
            this.identifierResolver
        );

        this.registerHandlers({
            [NodeTypes.ASSIGNMENT]:
                this.assignment,
            [NodeTypes.FUNCTION_DECLARATION]:
                this.functionsDeclaration,
            [NodeTypes.FUNCTION_CALL]:
                this.functionCall,
            [NodeTypes.WRITE_STATEMENT]:
                this.writeStatement,
            [NodeTypes.READ_STATEMENT]:
                this.readStatement,
            [NodeTypes.IF_STATEMENT]:
                this.ifStatement,
            [NodeTypes.WHILE_STATEMENT]:
                this.whileStatement,
            [NodeTypes.FOR_STATEMENT]:
                this.forStatement,
            [NodeTypes.RETURN_STATEMENT]:
                this.returnStatement
        });
    }

    emitProgram(statements) {
        return (
            this.runtimeState
                .registerGlobals(statements) +
            this.visitMany(statements).join("")
        );
    }

    generateVariable(identifier, dimensions) {
        const emittedIdentifier =
            this.identifierResolver.resolve(
                identifier
            );

        if (dimensions === 0) {
            return `var ${emittedIdentifier};\n`;
        }

        return `var ${emittedIdentifier} = cre_array_${globalThis.ProgramKey}(${emittedIdentifier}, ${dimensions});\n`;
    }

    assignment(statement) {
        if (!statement.left || !statement.right) {
            throw new TranspilerError(
                "The assignment must have a left-hand side and a right-hand side",
                statement.location
            );
        }

        const target =
            this.expressionVisitor.visit(statement.left);
        const value =
            this.expressionVisitor.visit(statement.right);
        const identifier =
            statement.left?.type ===
                NodeTypes.ACCESS
                ? statement.left.identifier
                : statement.left;
        const dimensions =
            statement.left.indexes != undefined
                ? statement.left.indexes.length
                : 0;

        return (
            this.markStatement(
                statement.location
            ) +
            this.generateVariable(
                identifier,
                dimensions
            ) +
            `${target} = ${value};\n`
        );
    }

    functionsDeclaration(statement) {
        const previousAwaitCalls = this.expressionVisitor.awaitCalls;
        const symbol = this.identifierResolver.semanticModel?.getSymbol(statement.identifier);
        this.expressionVisitor.awaitCalls = !this.expressionVisitor.gui?.synchronousFunctions.has(symbol);
        try {
            return this.emitFunctionDeclaration(statement);
        } finally {
            this.expressionVisitor.awaitCalls = previousAwaitCalls;
        }
    }

    emitFunctionDeclaration(statement) {
        const publicIdentifier =
            statement.identifier.name;
        const identifier =
            this.identifierResolver.resolve(
                statement.identifier
            );
        const parameters =
            statement.parameters ?? [];

        let instruction =
            `${this.expressionVisitor.awaitCalls ? "async " : ""}function ${identifier}(`;

        instruction +=
            parameters
                .map(parameter =>
                    this.identifierResolver
                        .resolve(
                            parameter.identifier
                        )
                )
                .join(", ");

        instruction += ") {\n";
        instruction +=
            this.indentInstruction(
                this.runtimeCoverage
                    .markFunction(statement)
            );
        instruction +=
            this.indentInstruction(
                this.runtimeState
                    .enterFrame(statement)
            );
        instruction += "\ttry {\n";
        instruction +=
            this.indentInstruction(
                this.buildBlock(
                    statement.body
                        ?.statements
                )
            );
        if (this.expressionVisitor.gui?.usage.requiresGui) {
            instruction += `\t} catch ($clrs$gui$error) {\n\t\tthrow locateRuntimeError_${globalThis.ProgramKey}($clrs$gui$error);\n`;
        }
        instruction += "\t} finally {\n";
        instruction +=
            this.indentInstruction(
                this.indentInstruction(
                    this.runtimeState
                        .leaveFrame()
                )
            );
        instruction += "\t}\n";
        instruction += "}\n";

        if (publicIdentifier === "PRINCIPAL") {
            instruction +=
                this.runtimeLocations.mark(
                    statement.location,
                    { debug: false }
                ) +
                `${this.expressionVisitor.awaitCalls ? "await " : ""}${identifier}();\n`;
        }

        return instruction;
    }

    functionCall(statement) {
        return (
            this.markStatement(
                statement.location
            ) +
            this.expressionVisitor.visit(statement) +
            ";\n"
        );
    }

    writeStatement(statement) {
        const values =
            this.expressionVisitor
                .visitMany(statement.expressions ?? [])
                .join(", ");

        return (
            this.markStatement(
                statement.location
            ) +
            `console.log(${values});\n`
        );
    }

    readStatement(statement) {
        const identifiers =
            statement.identifiers ?? [];

        return (
            this.markStatement(
                statement.location
            ) +
            identifiers
            .map(identifier => {
                const expression =
                    this.expressionVisitor.visit(
                        identifier
                    );

                return `
${expression} = String(await inputData_${globalThis.ProgramKey}());

if (${expression}.trim() !== "" && !Number.isNaN(Number(${expression}))) {
    ${expression} = Number(${expression});
} else if (${expression} === "${Tokens.FalseLiteral.LABEL}") {
    ${expression} = false;
} else if (${expression} === "${Tokens.TrueLiteral.LABEL}") {
    ${expression} = true;
}
`;
            })
            .join("")
        );
    }

    ifStatement(statement) {
        const condition =
            this.expressionVisitor.visit(
                statement.condition
            );
        const thenBlock =
            this.buildBlock(
                statement.thenBlock?.statements
            );
        const elseIfBranches =
            statement.elseIfBranches ?? [];
        const elseBlock =
            statement.elseBlock?.statements;

        const trackedCondition =
            this.runtimeLocations.wrap(
                this.runtimeCoverage
                    .wrapBranch(
                        condition,
                        statement.condition
                            ?.location ??
                            statement.location
                    ),
                statement.condition?.location ??
                    statement.location
            );
        let instruction =
            `if (${trackedCondition}) {\n${thenBlock}\n}\n`;

        instruction += elseIfBranches
            .map(branch => {
                const branchCondition =
                    this.expressionVisitor.visit(
                        branch.condition
                    );
                const body =
                    this.buildBlock(
                        branch.block?.statements
                    );
                const trackedBranchCondition =
                    this.runtimeLocations.wrap(
                        this.runtimeCoverage
                            .wrapBranch(
                                branchCondition,
                                branch.condition
                                    ?.location ??
                                    branch.location ??
                                    statement.location
                            ),
                        branch.condition?.location ??
                            branch.location ??
                            statement.location
                    );

                return `else if (${trackedBranchCondition}) {\n${body}\n}\n`;
            })
            .join("");

        if (elseBlock) {
            instruction +=
                `else {\n${this.buildBlock(elseBlock)}\n}\n`;
        }

        return instruction;
    }

    buildBlock(statements = []) {
        return this.visitMany(statements)
            .map(instruction =>
                this.indentInstruction(
                    instruction
                )
            )
            .join("");
    }

    indentInstruction(instruction) {
        return String(instruction)
            .split("\n")
            .map(line =>
                line === ""
                    ? ""
                    : "\t" + line
            )
            .join("\n");
    }

    whileStatement(statement) {
        const condition =
            this.expressionVisitor.visit(
                statement.condition
            );
        const body =
            this.buildBlock(
                statement.body?.statements
            );

        const trackedCondition =
            this.runtimeLocations.wrap(
                this.runtimeCoverage
                    .wrapLoop(
                        condition,
                        statement.condition
                            ?.location ??
                            statement.location
                    ),
                statement.condition?.location ??
                    statement.location
            );

        return `while (${trackedCondition}) {\n${body}\n}\n`;
    }

    forStatement(statement) {
        const variable =
            this.identifierResolver.resolve(
                statement.initializer?.left
            );
        const conditionOperator =
            statement.condition?.operator;
        const incrementOperator =
            statement.increment?.right?.operator;
        const start =
            this.expressionVisitor.visit(
                statement.initializer?.right
            );
        const end =
            this.expressionVisitor.visit(
                statement.condition?.right
            );
        const incrementValue =
            this.expressionVisitor.visit(
                statement.increment?.right?.right
            );
        const body =
            this.buildBlock(
                statement.body?.statements
            );
        const trackedCondition =
            this.runtimeLocations.wrap(
                this.runtimeCoverage
                    .wrapLoop(
                        `${variable} ${conditionOperator} ${end}`,
                        statement.condition
                            ?.location ??
                            statement.location
                    ),
                statement.condition?.location ??
                    statement.location
            );
        const trackedIncrement =
            this.runtimeLocations.wrap(
                `${variable} ${incrementOperator} ${incrementValue}`,
                statement.increment?.location ??
                    statement.location
            );

        return (
            this.markStatement(
                statement.initializer?.location ??
                    statement.location
            ) +
            `for (var ${variable} = ${start}; ${trackedCondition}; ${variable} = ${trackedIncrement}) {\n${body}\n}\n`
        );
    }

    returnStatement(statement) {
        const expression =
            this.expressionVisitor.visit(
                statement.expression
            );

        return (
            this.markStatement(
                statement.location
            ) +
            `return ${expression};\n`
        );
    }

    markStatement(location) {
        return (
            this.runtimeLocations.mark(location) +
            this.runtimeCoverage
                .markStatement(location)
        );
    }

    setIdentifierResolver(resolver) {
        const previous =
            this.identifierResolver;

        this.identifierResolver =
            normalizeJavaScriptIdentifierResolver(
                resolver
            );
        this.expressionVisitor
            .setIdentifierResolver(
                this.identifierResolver
            );
        this.runtimeState
            .setIdentifierResolver(
                this.identifierResolver
            );

        return previous;
    }
}
