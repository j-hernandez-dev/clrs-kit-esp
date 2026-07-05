import path from "node:path";
import { TranspilerError } from "../errors/TranspilerError.js"
import { appendFile, mkdir, unlink, writeFile } from 'node:fs/promises';
import { dependencies, endProgram, standartLibrary } from "./StandartLibrary.js";
import * as Tokens from "../lexer/tokens/Index.js";

export class Transpiler {

    /**
     * @param {any} build
     */
    constructor(build) {
        this.JSFile = "runner-temp.js";
        this.JSDir = ".\\";

        if (build != null) {
            this.JSFile = path.basename(build);
            this.JSDir = path.dirname(build) + "\\build\\";
        }
    }

    /**
     * @param {number} milisecondues
     */
    freezeThread(milisecondues) {
        const inicio = Date.now()
        while (Date.now() - inicio < milisecondues) {
        }
    }

    /**
     * @param {any} content
     */
    async createFile(content, file = this.JSFile, dir = this.JSDir) {
        try {
            await mkdir(dir, { recursive: true });
            await writeFile(path.join(dir, file), content, 'utf8');
        } catch (error) {
            console.error('Error to write file', error);
        }
    }

    /**
     * @param {any} content
     */
    async writeFile(content, file = this.JSFile, dir = this.JSDir) {
        try {
            await mkdir(dir, { recursive: true });
            const linea = `${content}`;
            await appendFile(path.join(dir, file), linea, 'utf8');
        } catch (error) {
            console.error('Error to write file', error);
        }
    }

    async deleteFile(file = this.JSFile, dir = this.JSDir) {
        try {
            await mkdir(dir, { recursive: true });
            await unlink(path.join(dir, file));
        } catch (error) {
            // @ts-ignore
            if (error.code === 'ENOENT') {
            } else {
                // @ts-ignore
                console.error('Error trying to delete the file', error.message);
            }
        }
    }

    /**
     * @param {any} ast
     */
    transpile(ast) {

        if (!ast) {

            throw new TranspilerError(
                "There is no AST to analyze"
            );

        }

        if (
            ast.type !== "Program"
        ) {

            throw new TranspilerError(
                "The root node must be a Program"
            );

        }

        const program = ast.statements;

        let code = "";
        for (const statement of program) {

            code += this.statementType(statement);
        }

        const fileContent = dependencies + standartLibrary + code + endProgram;
        this.createFile(fileContent);
        //this.freezeThread(500);
    }

    /**
     * Despacha cada nodo del AST hacia su generador correspondiente.
     *
     * @param {any} statement
     */
    statementType(statement) {

        if (!statement || !statement.type) {
            throw new TranspilerError(
                "The statement node is not valid"
            );
        }

        const generators = {

            Assignment:
                this.assignment,

            FunctionDeclaration:
                this.functionsDeclaration,

            FunctionCall:
                this.functionCall,

            WriteStatement:
                this.writeStatement,

            ReadStatement:
                this.readStatement,

            IfStatement:
                this.ifStatement,

            WhileStatement:
                this.whileStatement,

            ForStatement:
                this.forStatement,

            ReturnStatement:
                this.returnStatement
        };

        // @ts-ignore
        const generator = generators[statement.type];

        if (!generator) {
            throw new TranspilerError(
                `There is no generator for the node: ${statement.type}`
            );
        }

        return generator.call(this, statement);
    }

    /**
     * Genera código JavaScript a partir de un nodo expresión del AST.
     *
     * @param {any} expression
     * @returns {any}
     */
    getExpression(expression) {

        if (!expression || !expression.type) {
            throw new TranspilerError(
                "The expression is not valid"
            );
        }


        switch (expression.type) {

            case "LogicalNot":
            case "UnaryExpression": {
                const operator =
                    expression.operator === "Not"
                        ? "!"
                        : expression.operator;


                return (
                    operator +
                    this.getExpression(expression.operand)
                );
            }

            case "GroupExpression": {

                return (
                    "(" +
                    this.getExpression(expression.expression) +
                    ")"
                );
            }

            case "BinaryExpression":
            case "LogicalExpression": {

                const operator =
                    this.getOperator(expression.operator);


                return (
                    this.getExpression(expression.left) +
                    " " +
                    operator +
                    " " +
                    this.getExpression(expression.right)
                );
            }

            case "Identifier": {

                return expression.name;
            }

            case "FunctionCall": {

                const args =
                    expression.arguments
                        .map((/** @type {any} */ argument) =>
                            this.getExpression(argument)
                        )
                        .join(", ");

                return (
                    "await " +
                    expression.identifier.name +
                    "(" +
                    args +
                    ")"
                );
            }

            case "NumberLiteral":
            case "StringLiteral":
            case "BooleanLiteral": {

                return this.getLiteral(expression);
            }

            case "Access": {

                let result =
                    expression.identifier.name;

                for (const index of expression.indexes) {

                    result +=
                        `[${this.getExpression(index)}]`;
                }

                return result;
            }

            default:
                throw new TranspilerError(
                    `Unsupported expression: ${expression.type}`
                );
        }
    }

    /**
     * @param {any} operator
     */
    getOperator(operator) {

        const operators = {
            "=": "===",

            "^": "**"
        };


        // @ts-ignore
        return operators[operator] ?? operator;
    }

    /**
     * @param {any} literal
     */
    getLiteral(literal) {

        switch (literal.type) {

            case "StringLiteral":

                return `"${literal.value}"`;


            case "BooleanLiteral":

                return literal.value === "TRUE"
                    ? "true"
                    : "false";


            default:

                return String(literal.value);
        }
    }

    /**
     * Genera una declaración individual de variable.
     *
     * @param {string} identifier
     * @param {any[]} dimensions
     * @param {any} location
     */
    generateVariable(identifier, dimensions, location) {

        if (dimensions === 0) {

            return `var ${identifier};\n`;
        }

        return `var ${identifier} = cre_array_1029347226(${identifier}, ${dimensions});\n`;
    }

    /**
     * Genera una asignación.
     *
     * @param {any} statement
     */
    assignment(statement) {

        if (!statement.left || !statement.right) {

            throw new TranspilerError(
                "The assignment must have a left-hand side and a right-hand side"
            );
        }

        const target =
            this.getExpression(statement.left);

        const value =
            this.getExpression(statement.right);

        let instruction = "";

        const identifier = this.getReferenceName(statement.left);

        const dimensions = statement.left.indexes != undefined
            ? statement.left.indexes.length
            : 0;

        const location =
            statement.left.location;

        instruction +=
            this.generateVariable(identifier, dimensions, location);

        instruction += `${target} = ${value};\n`;

        return instruction;
    }

    /**
     * Genera una declaración de función o procedimiento.
     *
     * @param {any} statement
     */
    functionsDeclaration(statement) {

        const identifier =
            statement.identifier.name;


        const parameters =
            statement.parameters ?? [];


        let instruction =
            `async function ${identifier}(`;


        instruction +=
            parameters
                .map((/** @type {{ identifier: { name: any; }; }} */ parameter) =>
                    parameter.identifier.name
                )
                .join(", ");


        instruction += ") {\n";


        const statements =
            statement.body?.statements ?? [];


        for (const bodyStatement of statements) {

            instruction +=
                "\t" +
                this.statementType(bodyStatement);

        }


        instruction +=
            "}\n";


        if (
            statement.type === "FunctionDeclaration" &&
            (
                identifier === "main" ||
                identifier === "principal"
            )
        ) {

            instruction +=
                `await ${identifier}();\n`;

        }


        return instruction;
    }

    /**
     * Genera una llamada a procedimiento.
     *
     * @param {any} statement
     */
    functionCall(statement) {

        if (!statement.identifier) {

            throw new TranspilerError(
                "The function call does not have an identifier"
            );

        }

        const identifier =
            statement.identifier.name;

        const argumentsList =
            statement.arguments ?? [];

        const args =
            argumentsList
                .map((/** @type {any} */ argument) =>
                    this.getExpression(argument)
                )
                .join(", ");

        return `await ${identifier}(${args});\n`;
    }

    /**
     * Genera una instrucción de salida.
     *
     * @param {any} statement
     */
    writeStatement(statement) {

        const expressions =
            statement.expressions ?? [];


        const values =
            expressions
                .map((/** @type {any} */ expression) =>
                    this.getExpression(expression)
                )
                .join("+ ");

        let instruction = `console.log(${values});\n`;

        return instruction;
    }

    /**
     * Genera una instrucción de lectura (input).
     *
     * @param {any} statement
     */
    readStatement(statement) {
        const location = statement.location;

        const identifiers =
            statement.identifiers ?? [];

        return identifiers
            .map((/** @type {any} */ identifier) => {
                const expr = this.getExpression(identifier);
                return `
${expr} = String(await inputData_1029347226());

if (${expr}.trim() !== "" && !Number.isNaN(Number(${expr}))) {
    ${expr} = Number(${expr});
} else if (${expr} === "${Tokens.FalseLiteral.LABEL}") {
    ${expr} = false;
} else if (${expr} === "${Tokens.TrueLiteral.LABEL}") {
    ${expr} = true;
}
`}).join("");
    }

    /**
     * @param {any} expression
     */
    getReferenceName(expression) {

        switch (expression.type) {

            case "Identifier":

                return expression.name;

            case "Access":

                return expression.identifier.name;

            default:

                throw new TranspilerError(
                    "Invalid assignment/read target."
                );
        }

    }

    /**
     * Genera estructura if / else if / else.
     *
     * @param {any} statement
     */
    ifStatement(statement) {

        const condition =
            this.getExpression(statement.condition);

        const thenBlock =
            this.buildBlock(statement.thenBlock?.statements);


        const elseIfBranches =
            statement.elseIfBranches ?? [];


        const elseBlock =
            statement.elseBlock?.statements;


        let instruction =
            `if (${condition}) {\n${thenBlock}\n}\n`;


        instruction += elseIfBranches
            .map((/** @type {{ condition: any; block: { statements: any[] | undefined; }; }} */ branch) => {

                const cond =
                    this.getExpression(branch.condition);


                const body =
                    this.buildBlock(branch.block?.statements);


                return `else if (${cond}) {\n${body}\n}\n`;
            })
            .join("");


        if (elseBlock) {

            instruction +=
                `else {\n${this.buildBlock(elseBlock)}\n}\n`;

        }


        return instruction;
    }

    /**
     * Genera un bloque de statements con indentación.
     *
     * @param {any[]} statements
     */
    buildBlock(statements = []) {

        return statements
            .map(stmt =>
                "\t" + this.statementType(stmt)
            )
            .join("");
    }

    /**
     * Genera estructura while.
     *
     * @param {any} statement
     */
    whileStatement(statement) {

        const condition =
            this.getExpression(statement.condition);


        const body =
            this.buildBlock(statement.body?.statements);


        return `while (${condition}) {\n${body}\n}\n`;
    }

    /**
     * Genera estructura for.
     *
     * @param {any} statement
     * @returns {any}
     */
    forStatement(statement) {

        const variable =
            statement.initializer?.left?.name;

        const condOperator =
            statement.condition?.operator;

        const unaryOperator =
            statement.increment?.right?.operator;

        const start =
            this.getExpression(statement.initializer?.right);

        const end =
            this.getExpression(statement.condition?.right);

        const incrementValue =
            this.getExpression(statement.increment?.right?.right);

        const body =
            this.buildBlock(statement.body?.statements);


        return `for (var ${variable} = ${start}; ${variable} ${condOperator} ${end}; ${variable} = ${variable} ${unaryOperator} ${incrementValue}) {\n${body}\n}\n`;
    }

    /**
     * @param {any} statement
     */
    returnStatement(statement) {

        const expression =
            statement.expression
                ? this.getExpression(statement.expression)
                : "";

        return `return ${expression};\n`;
    }
}