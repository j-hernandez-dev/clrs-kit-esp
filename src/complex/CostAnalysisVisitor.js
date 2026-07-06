import { ReportNode } from "./ReportNode.js";
import { CostNode } from "./CostNode.js";
import { BlockCostNode } from "./BlockCostNode.js";
import { ComplexAnalysisError } from "../errors/ComplexAnalysisError.js";
import { toSubscript } from "./Letter.js";
import { substitution } from "./LibrarySubstitution.js";

export class CostAnalysisVisitor {

    costAnalysis(ast) {
        if (!ast) {
            throw new ComplexAnalysisError(
                "There is no AST to analyze"
            );
        }

        if (ast.type !== "Program") {
            throw new ComplexAnalysisError(
                "The root node must be a Program"
            );
        }

        const program = ast.statements;

        const nodes = [];

        for (const statement of program) {

            const node = this.statementType(statement);

            if (node) {
                nodes.push(node);
            }
        }

        // console.log(JSON.stringify(nodes, null, 4));

        return new ReportNode(nodes);
    }

    statementType(statement) {

        if (!statement || !statement.type) {
            throw new ComplexAnalysisError(
                "The statement node is not valid"
            );
        }

        const generators = {

            Assignment:
                this.assignment,

            WriteStatement:
                this.writeStatement,

            ReadStatement:
                this.readStatement,

            ReturnStatement:
                this.returnStatement,

            FunctionCall:
                this.functionCall,

            FunctionDeclaration:
                this.functionsDeclaration,

            IfStatement:
                this.ifStatement,

            WhileStatement:
                this.whileStatement,

            ForStatement:
                this.forStatement,
        };

        // @ts-ignore
        const generator = generators[statement.type];

        if (!generator) {
            throw new ComplexAnalysisError(
                `No analyzer exists for the node: ${statement.type}`
            );
        }

        return generator.call(this, statement);
    }

    getFunctionCall(statement) {
        const functionName = statement.identifier.name;
        const sub = substitution(functionName);

        if(sub !== null){
            return sub;
        }

        return "T" + functionName + "(n)";
    }

    getFunctionCalls(statement) {

        let expression = "";

        if (!statement || typeof statement !== "object") {
            return expression;
        }

        if (statement.type === "FunctionCall") {
            expression += " + " + this.getFunctionCall(statement);
        }

        for (const value of Object.values(statement)) {
            expression += this.getFunctionCalls(value);
        }

        return expression;
    }

    /**
     * Genera una asignación.
     *
     * @param {any} statement
     */
    assignment(statement) {
        let expression = "c";

        expression += this.getFunctionCalls(statement.right);

        return this.costNodeFactory(
            statement.type,
            statement.location,
            expression
        );
    }

    /**
 * Genera una declaración de función o procedimiento.
 *
 * @param {any} statement
 */
    functionsDeclaration(statement) {

        const body =
            this.buildBlock(
                statement.body.statements
            );

        return this.blockNodeFactory(
            "FunctionDeclaration",
            statement.location,
            this.buildFunctionExpression(
                statement.identifier.name,
                body.expression
            ),
            body.instructions
        );

    }

    buildFunctionExpression(name, bodyExpression) {

        return `T${name}(n) = ${bodyExpression}`;

    }

    /**
     * Genera una instrucción de salida.
     *
     * @param {any} statement
     */
    writeStatement(statement) {
        const expressions =
            statement.expressions ?? [];

        let expression = "c";

        expression += this.getFunctionCalls(expressions);

        return this.costNodeFactory(
            statement.type,
            statement.location,
            expression
        );
    }

    /**
     * Genera una instrucción de lectura (input).
     *
     * @param {any} statement
     */
    readStatement(statement) {
        return this.costNodeFactory(
            statement.type,
            statement.location,
            "c"
        );
    }

    /**
     * @param {any} statement
     */
    returnStatement(statement) {
        const expr =
            statement.expression;

        let expression = "c";

        expression += this.getFunctionCalls(expr);

        return this.costNodeFactory(
            statement.type,
            statement.location,
            expression
        );
    }

    /**
     * @param {any} statement
     */
    functionCall(statement) {
        return this.costNodeFactory(
            statement.type,
            statement.location,
            this.getFunctionCall(statement),
        );
    }

    buildInstructions(statements = []) {

        const nodes = [];

        for (const statement of statements) {

            nodes.push(
                this.statementType(statement)
            );

        }

        return nodes;
    }

    buildBlockExpression(nodes = []) {

        if (nodes.length === 0) {
            return "0";
        }

        return nodes
            .map(node => node.expression)
            .join(" + ");
    }

    buildBlockCost(prefixExpression, instructions) {

        const blockExpression =
            this.buildBlockExpression(instructions);

        return `${prefixExpression} + (${blockExpression})`;
    }

    buildBlock(statements = []) {

        const instructions =
            this.buildInstructions(
                statements
            );

        return {

            instructions,

            expression:
                this.buildBlockExpression(
                    instructions
                )
        };

    }

    buildBlockNode(type, location, shortExpression, prefixExpression, statements) {

        const instructions =
            this.buildInstructions(
                statements
            );

        const expression =
            this.buildBlockCost(
                prefixExpression,
                instructions
            );

        const node =
            this.blockNodeFactory(
                type,
                location,
                shortExpression,
                instructions
            );

        return {
            node,
            expression,
            instructions
        };
    }

    /**
 * Genera estructura if / else if / else.
 *
 * @param {any} statement
 */
    ifStatement(statement) {

        const branches = [];
        const expressions = [];

        //====================================
        // IF
        //====================================

        const ifConditionCost =
            "c" +
            this.getFunctionCalls(statement.condition);

        let branchNumber = 1;

        const ifShortExpression =
            ifConditionCost +
            " + T" +
            toSubscript(branchNumber) +
            "(n)";

        const ifBranch =
            this.buildBlockNode(
                "IfStatement",
                statement.location,
                ifShortExpression,
                ifConditionCost,
                statement.thenBlock.statements
            );

        branches.push(ifBranch.node);
        expressions.push(ifBranch.expression);

        //====================================
        // ELSE IF
        //====================================

        let accumulatedConditionCost = "";

        for (const elseIf of statement.elseIfBranches) {

            accumulatedConditionCost +=
                this.getFunctionCalls(
                    elseIf.condition
                );

            branchNumber++;

            const prefixExpression =
                branchNumber +
                ifConditionCost +
                accumulatedConditionCost;

            const shortExpression =
                prefixExpression +
                " + T" +
                toSubscript(branchNumber) +
                "(n)";

            const branch =
                this.buildBlockNode(
                    "ElseIfStatement",
                    elseIf.condition.location,
                    shortExpression,
                    prefixExpression,
                    elseIf.block.statements
                );

            branches.push(branch.node);
            expressions.push(branch.expression);
        }

        //====================================
        // ELSE
        //====================================

        if (statement.elseBlock) {

            const lastBranch =
                branchNumber + 1;

            const prefixExpression =
                (
                    statement.elseIfBranches.length === 0
                        ? ""
                        : branchNumber
                ) +
                ifConditionCost +
                accumulatedConditionCost;

            const shortExpression =
                prefixExpression +
                " + T" +
                toSubscript(lastBranch) +
                "(n)";

            const location = {

                startLine:
                    statement.elseBlock.location.startLine - 1,

                startColumn:
                    statement.elseBlock.location.startColumn,

                endLine:
                    statement.elseBlock.location.endLine,

                endColumn:
                    statement.elseBlock.location.endColumn
            };

            const branch =
                this.buildBlockNode(
                    "ElseStatement",
                    location,
                    shortExpression,
                    prefixExpression,
                    statement.elseBlock.statements
                );

            branches.push(branch.node);
            expressions.push(branch.expression);
        }

        //====================================
        // EXPRESIÓN DEL BLOQUE COMPLETO
        //====================================

        const blockExpression =
            expressions.length === 1
                ? expressions[0]
                : `max(${expressions.join(", ")})`;

        return this.blockNodeFactory(
            "IfBlock",
            statement.location,
            blockExpression,
            branches
        );
    }

    buildLoopExpression(iterations, conditionCost, bodyExpression) {

        return (
            conditionCost +
            " + " +
            iterations +
            "(" +
            conditionCost +
            " + (" +
            bodyExpression +
            "))"
        );

    }

    buildLoopNode(type, location, iterations, headerCost, statements) {

        const body =
            this.buildBlock(statements);

        const shortExpression =
            this.buildLoopExpression(
                iterations,
                headerCost,
                "T₁(n)"
            );

        const fullExpression =
            this.buildLoopExpression(
                iterations,
                headerCost,
                body.expression
            );

        const node =
            this.blockNodeFactory(
                type,
                location,
                shortExpression,
                body.instructions
            );

        return {

            node,

            expression:
                fullExpression,

            instructions:
                body.instructions
        };

    }

    /**
 * Genera estructura while.
 *
 * @param {any} statement
 */
    /**
 * Genera estructura while.
 *
 * @param {any} statement
 */
    whileStatement(statement) {

        const conditionCost =
            "c" +
            this.getFunctionCalls(
                statement.condition
            );

        const loop =
            this.buildLoopNode(
                "WhileStatement",
                statement.location,
                "n",
                conditionCost,
                statement.body.statements
            );

        return this.blockNodeFactory(
            "WhileBlock",
            statement.location,
            loop.expression,
            [loop.node]
        );

    }

    buildForExpression(initializerCost, conditionCost, incrementCost, bodyExpression) {

        return (
            initializerCost +
            " + " +
            "(n + 1)(" +
            conditionCost +
            ")" +
            " + " +
            "n(" +
            incrementCost +
            " + (" +
            bodyExpression +
            "))"
        );

    }

    /**
 * Genera estructura for.
 *
 * @param {any} statement
 */
    forStatement(statement) {

        //==============================
        // COSTO DE LA INICIALIZACIÓN
        //==============================

        const initializerCost =
            "c" +
            this.getFunctionCalls(
                statement.initializer
            );

        //==============================
        // COSTO DE LA CONDICIÓN
        //==============================

        const conditionCost =
            "c" +
            this.getFunctionCalls(
                statement.condition
            );

        //==============================
        // COSTO DEL INCREMENTO
        //==============================

        const incrementCost =
            "c" +
            this.getFunctionCalls(
                statement.increment
            );

        //==============================
        // CUERPO
        //==============================

        const body =
            this.buildBlock(
                statement.body.statements
            );

        //==============================
        // EXPRESIONES
        //==============================

        const shortExpression =
            this.buildForExpression(
                initializerCost,
                conditionCost,
                incrementCost,
                "T₁(n)"
            );

        const fullExpression =
            this.buildForExpression(
                initializerCost,
                conditionCost,
                incrementCost,
                body.expression
            );

        //==============================
        // NODO DEL FOR
        //==============================

        const forNode =
            this.blockNodeFactory(
                "ForStatement",
                statement.location,
                shortExpression,
                body.instructions
            );

        //==============================
        // BLOQUE COMPLETO
        //==============================

        return this.blockNodeFactory(
            "ForBlock",
            statement.location,
            fullExpression,
            [forNode]
        );

    }

    costNodeFactory(type, location, expression) {
        return new CostNode(type, location, expression);
    }

    blockNodeFactory(type, location, expression, instructions) {
        return new BlockCostNode(type, location, expression, instructions);
    }
}