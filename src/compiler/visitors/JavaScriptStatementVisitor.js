import { NodeTypes } from "../../ast/core/NodeTypes.js";
import { ASTVisitor } from "../../ast/visitors/ASTVisitor.js";
import { TranspilerError } from "../../errors/TranspilerError.js";
import * as Tokens from "../../lexer/tokens/Index.js";
import {
    JavaScriptExpressionVisitor
} from "./JavaScriptExpressionVisitor.js";

/**
 * Emite instrucciones y bloques JavaScript.
 */
export class JavaScriptStatementVisitor extends ASTVisitor {

    constructor(
        expressionVisitor =
            new JavaScriptExpressionVisitor()
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
        return this.visitMany(statements).join("");
    }

    generateVariable(identifier, dimensions) {
        if (dimensions === 0) {
            return `var ${identifier};\n`;
        }

        return `var ${identifier} = cre_array_${globalThis.ProgramKey}(${identifier}, ${dimensions});\n`;
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
            this.expressionVisitor.getReferenceName(
                statement.left
            );
        const dimensions =
            statement.left.indexes != undefined
                ? statement.left.indexes.length
                : 0;

        return (
            this.generateVariable(
                identifier,
                dimensions
            ) +
            `${target} = ${value};\n`
        );
    }

    functionsDeclaration(statement) {
        const identifier =
            statement.identifier.name;
        const parameters =
            statement.parameters ?? [];

        let instruction =
            `async function ${identifier}(`;

        instruction +=
            parameters
                .map(parameter =>
                    parameter.identifier.name
                )
                .join(", ");

        instruction += ") {\n";

        for (
            const bodyStatement
            of statement.body?.statements ?? []
        ) {
            instruction +=
                "\t" +
                this.visit(bodyStatement);
        }

        instruction += "}\n";

        if (identifier === "PRINCIPAL") {
            instruction +=
                `await ${identifier}();\n`;
        }

        return instruction;
    }

    functionCall(statement) {
        return (
            this.expressionVisitor.visit(statement) +
            ";\n"
        );
    }

    writeStatement(statement) {
        const values =
            this.expressionVisitor
                .visitMany(statement.expressions ?? [])
                .join(", ");

        return `console.log(${values});\n`;
    }

    readStatement(statement) {
        const identifiers =
            statement.identifiers ?? [];

        return identifiers
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
            .join("");
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

        let instruction =
            `if (${condition}) {\n${thenBlock}\n}\n`;

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

                return `else if (${branchCondition}) {\n${body}\n}\n`;
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
                "\t" + instruction
            )
            .join("");
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

        return `while (${condition}) {\n${body}\n}\n`;
    }

    forStatement(statement) {
        const variable =
            statement.initializer?.left?.name;
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

        return `for (var ${variable} = ${start}; ${variable} ${conditionOperator} ${end}; ${variable} = ${variable} ${incrementOperator} ${incrementValue}) {\n${body}\n}\n`;
    }

    returnStatement(statement) {
        const expression =
            statement.expression
                ? this.expressionVisitor.visit(
                    statement.expression
                )
                : "";

        return `return ${expression};\n`;
    }
}
