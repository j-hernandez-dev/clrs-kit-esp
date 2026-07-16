/**
 *
 * ASTBuilder.js
 *
 * ==================================
 * AST BUILDER
 * ==================================
 *
 * CST (Chevrotain)
 *      ↓
 * AST Nodes
 *
 * Coordina:
 * - ExpressionVisitor
 * - StatementVisitor
 * - DeclarationVisitor
 *
 */

import { ASTContext } from "../core/ASTContext.js";
import { ASTFactory } from "../utils/ASTFactory.js";

import { ExpressionVisitor } from "./ExpressionVisitor.js";
import { StatementVisitor } from "./StatementVisitor.js";
import { DeclarationVisitor } from "./DeclarationVisitor.js";

import { CSTAdapter } from "../utils/CSTAdapter.js";
import { LocationHelper } from "../utils/LocationHelper.js";


export class ASTBuilder {


    /**
     * @param {import("../../parser/Parser.js").GaddisParser} parser
     */
    constructor(parser) {

        this.parser = parser;

        this.context = new ASTContext();


        this.expressionVisitor =
            new ExpressionVisitor();


        this.declarationVisitor =
            new DeclarationVisitor(
                this.expressionVisitor,
                null
            );


        this.statementVisitor =
            new StatementVisitor(
                this.expressionVisitor,
                this.declarationVisitor
            );


        this.declarationVisitor.statementVisitor =
            this.statementVisitor;

    }




    /**
     * =========================
     * BUILD
     * =========================
     * @param {any} cst
     */
    build(cst) {

        const program =
            this.visitProgram(cst);


        this.context.setRoot(program);


        return program;

    }




    /**
     * =========================
     * PROGRAM
     * =========================
     * @param {any} ctx
     */
    visitProgram(ctx) {


        const statements =
            CSTAdapter.get(
                ctx,
                "statement"
            );


        const nodes = [];


        for (const statement of statements) {


            const node =
                this.visitStatement(statement);


            if (node) {

                nodes.push(node);

            }

        }

        const location = LocationHelper.from(ctx);

        return ASTFactory.program(nodes, location);

    }




    /**
     * =========================
     * STATEMENT DISPATCH
     * =========================
     * @param {any} ctx
     */
    visitStatement(ctx) {


        const children =
            CSTAdapter.children(ctx);



        /**
         * =====================
         * DECLARATIONS
         * =====================
         *
         * IMPORTANTE:
         *
         * Se manda ctx completo.
         *
         */

        if (children.functionDeclaration) {

            return this.declarationVisitor.visitDeclaration(
                children.functionDeclaration[0]
            );

        }



        /**
         * =====================
         * ASSIGNMENT
         * =====================
         */

        if (children.assignmentStatement) {


            return this.statementVisitor
                .visitAssignment(
                    children.assignmentStatement[0]
                );

        }



        /**
         * =====================
         * IF
         * =====================
         */

        if (children.ifStatement) {


            return this.statementVisitor
                .visitIf(
                    children.ifStatement[0]
                );

        }



        /**
         * =====================
         * WHILE
         * =====================
         */

        if (children.whileStatement) {


            return this.statementVisitor
                .visitWhile(
                    children.whileStatement[0]
                );

        }



        /**
         * =====================
         * FOR
         * =====================
         */

        if (children.forStatement) {


            return this.statementVisitor
                .visitFor(
                    children.forStatement[0]
                );

        }


        /**
         * =====================
         * RETURN
         * =====================
         */

        if (children.returnStatement) {


            return this.statementVisitor
                .visitReturn(
                    children.returnStatement[0]
                );

        }



        /**
         * =====================
         * READ
         * =====================
         */

        if (children.readStatement) {


            return this.statementVisitor
                .visitRead(
                    children.readStatement[0]
                );

        }



        /**
         * =====================
         * WRITE
         * =====================
         */

        if (children.writeStatement) {


            return this.statementVisitor
                .visitWrite(
                    children.writeStatement[0]
                );

        }



        /**
         * =====================
         * FUNCTION CALL
         * =====================
         */

        if (children.functionCall) {


            return this.expressionVisitor
                .visitFunctionCall(
                    children.functionCall[0]
                );

        }



        throw new Error(
            "Statement not supported by ASTBuilder: "
            +
            JSON.stringify(
                Object.keys(children ?? {})
            )
        );

    }



    /**
     * =========================
     * GET AST
     * =========================
     */

    getAST() {

        return this.context.getRoot();

    }

}