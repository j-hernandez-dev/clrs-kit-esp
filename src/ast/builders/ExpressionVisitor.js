/**
 *
 * ExpressionVisitor.js
 *
 * ==================================
 * EXPRESSION VISITOR
 * ==================================
 *
 * Convierte CST de expresiones
 * generado por Chevrotain a AST.
 *
 */

import { ASTFactory } from "../utils/ASTFactory.js";
import { CSTAdapter } from "../utils/CSTAdapter.js";
import { NodeTypes } from "../core/NodeTypes.js";
import { LocationHelper } from "../utils/LocationHelper.js";


export class ExpressionVisitor {


    /**
     * Punto de entrada general.
     * @param {any} ctx
     * @returns {any}
     */
    visitExpression(ctx) {

        if (!ctx) {
            throw new Error(
                "visitExpression received null"
            );
        }

        /*
         * expression
         *     -> logical
         */
        const logical =
            CSTAdapter.first(ctx, "logical");


        if (logical) {
            return this.visitLogical(logical);
        }


        /*
         * Permitir recibir reglas internas
         */
        if (CSTAdapter.has(ctx, "logicalOr")) {
            return this.visitLogicalOr(ctx);
        }


        if (CSTAdapter.has(ctx, "logicalAnd")) {
            return this.visitLogicalAnd(ctx);
        }


        if (CSTAdapter.has(ctx, "comparison")) {
            return this.visitComparison(ctx);
        }


        if (CSTAdapter.has(ctx, "additive")) {
            return this.visitAdditive(ctx);
        }


        throw new Error(
            `Expression node not supported: ${ctx.name}`
        );
    }

    /**
     * @param {any} ctx
     * @returns {any}
     */
    visitLogical(ctx) {

        const logicalOr =
            CSTAdapter.first(ctx, "logicalOr");


        return this.visitLogicalOr(
            logicalOr ?? ctx
        );
    }

    /**
     * @param {any} ctx
     * @returns {any}
     */
    visitLogicalOr(ctx) {

        let node =
            this.visitLogicalAnd(
                CSTAdapter.first(ctx, "logicalAnd")
            );


        const operators =
            CSTAdapter.get(ctx, "Or");


        const operands =
            CSTAdapter.get(ctx, "logicalAnd");


        for (let i = 0; i < operators.length; i++) {


            const right =
                this.visitLogicalAnd(
                    operands[i + 1]
                );


            const location =
                LocationHelper.fromMerge(
                    node.location,
                    right.location
                );


            node =
                ASTFactory.logical(
                    "||",
                    node,
                    right,
                    location
                );
        }


        return node;
    }


    /**
     * @param {any} ctx
     * @returns {any}
     */
    visitLogicalAnd(ctx) {

        let node =
            this.visitLogicalNot(
                CSTAdapter.first(ctx, "logicalNot")
            );

        const operators =
            CSTAdapter.get(ctx, "And");

        const operands =
            CSTAdapter.get(ctx, "logicalNot");

        for (let i = 0; i < operators.length; i++) {

            const right =
                this.visitLogicalNot(
                    operands[i + 1]
                );


            const location =
                LocationHelper.fromMerge(
                    node.location,
                    right.location
                );


            node =
                ASTFactory.logical(
                    "&&",
                    node,
                    right,
                    location
                );
        }

        return node;
    }

    /**
     * @param {any} ctx
     * @returns {any}
     */
    visitLogicalNot(ctx) {


        if (CSTAdapter.has(ctx, "Not")) {

            let node =
                CSTAdapter.first(
                    ctx,
                    "logicalNot"
                )
                ??
                CSTAdapter.first(
                    ctx,
                    "comparison"
                );

            const operand =
                this.visitLogicalNot(node);

            const notToken = CSTAdapter.token(
                ctx,
                "Not"
            )

            const location =
                LocationHelper.fromMerge(
                    LocationHelper.fromTokens(notToken),
                    operand.location
                );

            return ASTFactory.logicalNot(
                "!",
                operand,
                location
            );
        }

        return this.visitComparison(
            CSTAdapter.first(ctx, "comparison")
        );
    }

    /**
     * @param {any} ctx
     * @returns {any}
     */
    visitComparison(ctx) {

        let node =
            this.visitAdditive(
                CSTAdapter.first(ctx, "additive")
            );

        const operands =
            CSTAdapter.get(ctx, "additive");

        if (operands.length > 1) {


            const operator =
                [
                    "LessThan",
                    "GreaterThan",
                    "Equal",
                    "NotEqual",
                    "LessOrEqual",
                    "GreaterOrEqual"
                ]
                    .map(
                        x => CSTAdapter.first(ctx, x)
                    )
                    .find(Boolean);

            const right =
                this.visitAdditive(
                    operands[1]
                );

            const location =
                LocationHelper.fromMerge(
                    node.location,
                    right.location
                );

            node =
                ASTFactory.binary(
                    operator.image,
                    node,
                    right,
                    location
                );
        }

        return node;
    }

    /**
     * @param {any} ctx
     * @returns {any}
     */
    visitAdditive(ctx) {

        let node =
            this.visitMultiplicative(
                CSTAdapter.first(
                    ctx,
                    "multiplicative"
                )
            );


        const operands =
            CSTAdapter.get(
                ctx,
                "multiplicative"
            );


        const operators =
            [
                ...CSTAdapter.get(ctx, "Plus"),
                ...CSTAdapter.get(ctx, "Minus")
            ]
                .sort(
                    (a, b) =>
                        a.startOffset - b.startOffset
                );



        for (
            let i = 0;
            i < operators.length;
            i++
        ) {

            const right = this.visitMultiplicative(operands[i + 1]);

            const location =
                LocationHelper.fromMerge(
                    node.location,
                    right.location
                );

            node =
                ASTFactory.binary(
                    operators[i].image,
                    node,
                    right,
                    location
                );
        }


        return node;
    }

    /**
     * @param {any} ctx
     * @returns {any}
     */
    visitMultiplicative(ctx) {
        let node =
            this.visitUnary(
                CSTAdapter.first(
                    ctx,
                    "unary"
                )
            );

        const operands =
            CSTAdapter.get(
                ctx,
                "unary"
            );

        const operators =
            [
                ...CSTAdapter.get(ctx, "Multiply"),
                ...CSTAdapter.get(ctx, "Divide"),
                ...CSTAdapter.get(ctx, "Mod")
            ]
                .sort(
                    (a, b) =>
                        a.startOffset - b.startOffset
                );

        for (
            let i = 0;
            i < operators.length;
            i++
        ) {

            const right = this.visitUnary(operands[i + 1]);

            const location =
                LocationHelper.fromMerge(
                    node.location,
                    right.location
                );

            node =
                ASTFactory.binary(
                    operators[i].image,
                    node,
                    right,
                    location
                );
        }

        return node;
    }

    /**
     * @param {any} ctx
     * @returns {any}
     */
    visitUnary(ctx) {

        if (
            CSTAdapter.has(ctx, "Minus")
            ||
            CSTAdapter.has(ctx, "Plus")
        ) {

            const operator =
                CSTAdapter.token(ctx, "Minus")
                ??
                CSTAdapter.token(ctx, "Plus");

            const operand =
                this.visitUnary(
                    CSTAdapter.first(ctx, "unary")
                );

            const location =
                LocationHelper.fromMerge(
                    LocationHelper.fromTokens(operator),
                    operand.location
                );

            return ASTFactory.unary(
                operator.image,
                operand,
                location
            );
        }

        return this.visitPower(
            CSTAdapter.first(ctx, "power")
        );
    }

    /**
     * @param {any} ctx
     * @returns {any}
     */
    visitPower(ctx) {

        const access =
            CSTAdapter.first(
                ctx,
                "access"
            );


        let node =
            this.visitAccess(access);



        const power =
            CSTAdapter.first(
                ctx,
                "power"
            );


        if (!power) {
            return node;
        }

        const right = this.visitPower(power);

        const location =
            LocationHelper.fromMerge(
                node.location,
                right.location
            );

        return ASTFactory.binary(
            "^",
            node,
            right,
            location
        );
    }

    /**
     * @param {any} ctx
     * @returns {any}
     * =========================
     * ACCESS
     * =========================
     * @param {any} ctx
     */
    visitAccess(ctx) {


        if (!ctx) {
            throw new Error(
                "visitAccess received null"
            );
        }


        const primary =
            CSTAdapter.first(
                ctx,
                "primary"
            );


        if (!primary) {
            throw new Error(
                "Access without primary"
            );
        }


        const base =
            this.visitPrimary(primary);



        const indexes =
            (
                CSTAdapter.get(
                    ctx,
                    "expression"
                ) ?? []
            )
                .map((/** @type {any} */ expr) =>
                    this.visitExpression(expr)
                );

        /**
         * Si no tiene índices:
         *
         * x
         *
         * devuelve Identifier
         */
        if (indexes.length === 0) {

            return base;

        }

        const location = LocationHelper.from(ctx);

        /**
         * Si tiene índices:
         *
         * arr[0]
         *
         * matriz[i][j]
         *
         */
        return ASTFactory.access(
            base,
            indexes,
            location
        );
    }

    /**
     * @param {any} ctx
     * @returns {any}
     */
    visitPrimary(ctx) {

        /*
         * =========================
         * NUMBER
         * =========================
         */

        if (CSTAdapter.has(ctx, "NumberLiteral")) {

            const token =
                CSTAdapter.token(
                    ctx,
                    "NumberLiteral"
                );

            const location = LocationHelper.fromTokens(token);

            return ASTFactory.literal(
                NodeTypes.NUMBER_LITERAL,
                Number(token.image),
                location
            );

        }

        /*
         * =========================
         * SCIENTIFIC
         * =========================
         */

        if (CSTAdapter.has(ctx, "ScientificLiteral")) {

            const token =
                CSTAdapter.token(
                    ctx,
                    "ScientificLiteral"
                );

            const location = LocationHelper.fromTokens(token);

            return ASTFactory.literal(
                NodeTypes.SCIENTIFIC_LITERAL,
                Number(token.image),
                location
            );

        }

        /*
         * =========================
         * STRING
         * =========================
         */

        if (CSTAdapter.has(ctx, "StringLiteral")) {

            const token =
                CSTAdapter.token(
                    ctx,
                    "StringLiteral"
                );

            const location = LocationHelper.fromTokens(token);

            return ASTFactory.literal(
                NodeTypes.STRING_LITERAL,
                token.image.substring(1, token.image.length - 1),
                location
            );

        }

        /*
         * =========================
         * BOOLEAN
         * =========================
         */

        if (CSTAdapter.has(ctx, "TrueLiteral")) {

            const token =
                CSTAdapter.token(
                    ctx,
                    "TrueLiteral"
                );

            const location = LocationHelper.fromTokens(token);
            const value = "TRUE";

            return ASTFactory.literal(
                NodeTypes.BOOLEAN_LITERAL,
                value,
                location
            );

        }

        if (CSTAdapter.has(ctx, "FalseLiteral")) {

            const token =
                CSTAdapter.token(
                    ctx,
                    "FalseLiteral"
                );

            const location = LocationHelper.fromTokens(token);
            const value = "FALSE";


            return ASTFactory.literal(
                NodeTypes.BOOLEAN_LITERAL,
                value,
                location
            );
        }

        /*
        * =========================
        * ARRAY ACCESS
        * =========================
        */

        if (
            CSTAdapter.has(ctx, "access")
        ) {

            return this.visitAccess(
                CSTAdapter.first(
                    ctx,
                    "access"
                )
            );

        }

        /*
         * =========================
         * IDENTIFIER
         * =========================
         */

        if (CSTAdapter.has(ctx, "Identifier")) {

            const identifier =
                CSTAdapter.token(
                    ctx,
                    "Identifier"
                );

            const identifierLocation =
                LocationHelper.fromTokens(
                    identifier
                );

            return ASTFactory.identifier(
                identifier.image,
                identifierLocation
            );

        }

        /*
         * =========================
         * FUNCTION CALL
         * =========================
         */

        if (CSTAdapter.has(ctx, "functionCall")) {

            return this.visitFunctionCall(
                CSTAdapter.first(
                    ctx,
                    "functionCall"
                )
            );

        }

        /*
         * =========================
         * GROUP EXPRESSION
         * =========================
         */
        if (CSTAdapter.has(ctx, "expression")) {


            const expression =
                this.visitExpression(
                    CSTAdapter.first(ctx, "expression")
                );


            const leftParen =
                CSTAdapter.token(
                    ctx,
                    "LParen"
                );


            const rightParen =
                CSTAdapter.token(
                    ctx,
                    "RParen"
                );


            const location =
                LocationHelper.fromMerge(
                    LocationHelper.fromTokens(leftParen),
                    LocationHelper.fromTokens(rightParen)
                );


            return ASTFactory.group(
                expression,
                location
            );
        }

        throw new Error(
            `Primary not supported: ${ctx.name}`
        );

    }

    /**
     * @param {any} ctx
     * @returns {any}
     */
    visitFunctionCall(ctx) {

        const identifier =
            CSTAdapter.token(
                ctx,
                "Identifier"
            );

        if (!identifier) {
            throw new Error(
                "FunctionCall has no identifier"
            );
        }

        const identifierLocation =
            LocationHelper.fromTokens(
                identifier
            );

        const identifierNode = ASTFactory.identifier(
            identifier.image,
            identifierLocation
        );

        const argumentList =
            CSTAdapter.first(ctx, "argumentsList");

        let args = [];

        if (argumentList) {

            const expressions =
                CSTAdapter.get(
                    argumentList,
                    "expression"
                ) ?? [];

            args =
                expressions.map(
                    (/** @type {any} */ expr) =>
                        this.visitExpression(expr)
                );
        }

        const location = LocationHelper.from(ctx);

        return ASTFactory.functionCall(
            identifierNode,
            args,
            location
        );
    }
}