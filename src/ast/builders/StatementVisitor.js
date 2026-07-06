/**
 *
 * StatementVisitor.js
 *
 * ==================================
 * STATEMENT VISITOR
 * ==================================
 */

import { NodeTypes } from "../core/NodeTypes.js";
import { ASTFactory } from "../utils/ASTFactory.js";
import { CSTAdapter } from "../utils/CSTAdapter.js";
import { LocationHelper } from "../utils/LocationHelper.js";

export class StatementVisitor {

    /**
     * @param {import("./ExpressionVisitor.js").ExpressionVisitor} expressionVisitor
     * @param {import("./DeclarationVisitor.js").DeclarationVisitor} declarationVisitor
     */
    constructor(expressionVisitor, declarationVisitor) {
        this.expressionVisitor = expressionVisitor;
        this.declarationVisitor = declarationVisitor;
    }

    /**
     * =========================
     * DISPATCH
     * =========================
     * @param {any} ctx
     */
    visitStatement(ctx) {

        const children = CSTAdapter.children(ctx);

        if (CSTAdapter.has(ctx, "assignmentStatement")) {
            return this.visitAssignment(CSTAdapter.first(ctx, "assignmentStatement"));
        }

        if (CSTAdapter.has(ctx, "ifStatement")) {
            return this.visitIf(CSTAdapter.first(ctx, "ifStatement"));
        }

        if (CSTAdapter.has(ctx, "whileStatement")) {
            return this.visitWhile(CSTAdapter.first(ctx, "whileStatement"));
        }

        if (CSTAdapter.has(ctx, "forStatement")) {
            return this.visitFor(CSTAdapter.first(ctx, "forStatement"));
        }

        if (CSTAdapter.has(ctx, "returnStatement")) {
            return this.visitReturn(CSTAdapter.first(ctx, "returnStatement"));
        }

        if (CSTAdapter.has(ctx, "readStatement")) {
            return this.visitRead(CSTAdapter.first(ctx, "readStatement"));
        }

        if (CSTAdapter.has(ctx, "writeStatement")) {
            return this.visitWrite(CSTAdapter.first(ctx, "writeStatement"));
        }

        if (CSTAdapter.has(ctx, "functionCall")) {

            return this.expressionVisitor.visitFunctionCall(
                CSTAdapter.first(ctx, "functionCall")
            );

        }

        if (
            CSTAdapter.has(ctx, "functionDeclaration")
        ) {

            // @ts-ignore
            const declaration = CSTAdapter.first(ctx, Object.keys(children).find(key =>
                [
                    "functionDeclaration",
                ].includes(key)
            ));


            return this.declarationVisitor.visitDeclaration(
                declaration
            );
        }

        throw new Error(
            "Statement not supported by StatementVisitor: " +
            JSON.stringify(Object.keys(children))
        );
    }

    /**
     * @param {any} ctx
     */
    visitAssignment(ctx) {

        const lvalue =
            CSTAdapter.first(
                ctx,
                "LValue"
            );


        const left =
            this.visitLValue(lvalue);



        const right =
            this.expressionVisitor.visitExpression(
                CSTAdapter.first(ctx, "expression")
            );



        return ASTFactory.assignment(
            left,
            right,
            LocationHelper.from(ctx)
        );

    }

    /**
     * =========================
     * IF
     * =========================
     * @param {any} ctx
     */
    visitIf(ctx) {

        // =========================
        // IF principal
        // =========================
        const condition =
            this.expressionVisitor.visitExpression(
                CSTAdapter.first(ctx, "expression")
            );

        const thenBlock =
            this.visitBlock(
                CSTAdapter.first(ctx, "block")
            );

        // =========================
        // ELSE IFs
        // =========================
        const elseIfBranches =
            (CSTAdapter.get(ctx, "elseIfClause") ?? []).map((/** @type {any} */ c) => {

                return {
                    condition: this.expressionVisitor.visitExpression(
                        CSTAdapter.first(c, "expression")
                    ),
                    block: this.visitBlock(
                        CSTAdapter.first(c, "block")
                    )
                };
            });

        // =========================
        // ELSE
        // =========================
        let elseBlock = null;

        if (CSTAdapter.has(ctx, "elseClause")) {

            const elseCtx =
                CSTAdapter.first(ctx, "elseClause");

            const elseToken =
                CSTAdapter.first(elseCtx, "Else");

            const elseLocation =
                LocationHelper.fromTokens(elseToken);

            elseBlock =
                this.visitBlock(
                    CSTAdapter.first(elseCtx, "block"),
                    elseLocation
                );
        }

        const location = LocationHelper.from(ctx);

        // =========================
        // AST FINAL
        // =========================
        return ASTFactory.if(
            condition,
            thenBlock,
            elseIfBranches,
            elseBlock,
            location
        );
    }

    /**
     * =========================
     * WHILE
     * =========================
     * @param {any} ctx
     */
    visitWhile(ctx) {

        const condition =
            this.expressionVisitor.visitExpression(
                CSTAdapter.first(ctx, "expression")
            );

        const body =
            this.visitBlock(
                CSTAdapter.first(ctx, "block")
            );

        const location = LocationHelper.from(ctx);

        return ASTFactory.while(condition, body, location);
    }

    /**
     * =========================
     * FOR
     * =========================
     * @param {any} ctx
     */
    visitFor(ctx) {

        const identifier =
            CSTAdapter.first(ctx, "Identifier");

        if (!identifier) {
            throw new Error(
                "For has no variable"
            );
        }

        const identifierLocation =
            LocationHelper.fromTokens(identifier);

        const variable =
            ASTFactory.identifier(
                identifier.image,
                identifierLocation
            );

        const expressions =
            CSTAdapter.get(
                ctx,
                "expression"
            ) ?? [];

        const start =
            this.expressionVisitor.visitExpression(
                expressions[0]
            );

        const limit =
            this.expressionVisitor.visitExpression(
                expressions[1]
            );

        const initializerLocation =
            LocationHelper.from(
                expressions[0]
            );

        const initializer =
            ASTFactory.assignment(
                variable,
                start,
                initializerLocation
            );

        const isDownTo = CSTAdapter.has(ctx, "Downto");

        const comparisonOperator =
            isDownTo
                ? ">="
                : "<=";

        const arithmeticOperator =
            isDownTo
                ? "-"
                : "+";

        const conditionLocation =
            LocationHelper.from(
                expressions[1]
            );

        const condition =
            ASTFactory.binary(
                comparisonOperator,
                variable,
                limit,
                conditionLocation
            );

        const increment =
            ASTFactory.assignment(
                variable,
                ASTFactory.binary(
                    arithmeticOperator,
                    variable,
                    ASTFactory.literal(
                        NodeTypes.NUMBER_LITERAL,
                        1,
                        conditionLocation
                    ),
                    conditionLocation
                ),
                conditionLocation
            );

        const body =
            this.visitBlock(
                CSTAdapter.first(
                    ctx,
                    "block"
                )
            );

        const location =
            LocationHelper.from(ctx);

        return ASTFactory.for(
            initializer,
            condition,
            increment,
            body,
            location
        );
    }


    /**
     * =========================
     * RETURN
     * =========================
     * @param {any} ctx
     */
    visitReturn(ctx) {

        const expr =
            CSTAdapter.has(ctx, "expression")
                ? this.expressionVisitor.visitExpression(
                    CSTAdapter.first(ctx, "expression")
                )
                : null;

        const location = LocationHelper.from(ctx);

        return ASTFactory.return(expr, location);
    }

    /**
     * =========================
     * READ
     * =========================
     *
     * Leer variable
     * Leer arreglo[i]
     *
     * @param {any} ctx
     */
    visitRead(ctx) {
        const lvalues =
            CSTAdapter.get(ctx, "LValue") ?? [];



        const targets =
            lvalues.map(
                (/** @type {any} */ lvalue) =>
                    this.visitLValue(lvalue)
            );



        const location =
            LocationHelper.from(ctx);



        return ASTFactory.read(
            targets,
            location
        );

    }

    /**
     * @param {any} ctx
     */
    visitLValue(ctx) {


        const identifier =
            CSTAdapter.first(
                ctx,
                "Identifier"
            );



        const identifierLocation =
            LocationHelper.fromTokens(
                identifier
            );



        const identifierNode =
            ASTFactory.identifier(
                identifier.image,
                identifierLocation
            );



        const indexes =
            CSTAdapter.get(
                ctx,
                "expression"
            ) ?? [];



        /*
         * Variable simple
         *
         * x
         */
        if (indexes.length === 0) {

            return identifierNode;

        }



        /*
         * Acceso a arreglo
         *
         * matriz[1][2]
         */
        const indexNodes =
            indexes.map(
                (/** @type {any} */ expr) =>
                    this.expressionVisitor
                        .visitExpression(expr)
            );



        return ASTFactory.access(
            identifierNode,
            indexNodes,
            LocationHelper.from(ctx)
        );

    }

    /**
     * =========================
     * WRITE
     * =========================
     * @param {any} ctx
     */
    visitWrite(ctx) {

        const expressions =
            (CSTAdapter.get(ctx, "expression") ?? [])
                .map((/** @type {any} */ expr) =>
                    this.expressionVisitor.visitExpression(expr)
                );

        const location = LocationHelper.from(ctx);

        return ASTFactory.write(expressions, location);
    }

    /**
     * =========================
     * BLOCK
     * =========================
     * @param {any} ctx
     */
    visitBlock(ctx, elseLocation = null) {

        const statements =
            CSTAdapter.get(
                ctx,
                "statement"
            );

        const location = elseLocation === null
        ? LocationHelper.from(ctx)
        : elseLocation;

        return ASTFactory.block(
            statements.map(
                (/** @type {any} */ stmt) =>
                    this.visitStatement(stmt)
            ),
            location
        );
    }
}