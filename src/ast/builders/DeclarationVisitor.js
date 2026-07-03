/**
 *
 * DeclarationVisitor.js
 *
 * ==================================
 * DECLARATION VISITOR
 * ==================================
 *
 * Convierte declaraciones del CST
 * generado por Chevrotain en nodos AST.
 *
 * CST Declaration
 *        ↓
 * AST Nodes
 *
 * No contiene análisis semántico.
 *
 * ==================================
 */


import { ASTFactory } from "../utils/ASTFactory.js";
import { CSTAdapter } from "../utils/CSTAdapter.js";
import { LocationHelper } from "../utils/LocationHelper.js";


export class DeclarationVisitor {


    /**
     * @param {any} expressionVisitor
     * @param {any} statementVisitor
     */
    constructor(expressionVisitor, statementVisitor) {

        this.expressionVisitor = expressionVisitor;
        this.statementVisitor = statementVisitor;
    }


    /**
     * =========================
     * DISPATCH
     * =========================
     *
     * @param {any} ctx
     */
    visitDeclaration(ctx) {


        if (!ctx) {

            throw new Error(
                "DeclarationVisitor received an empty context"
            );

        }


        switch (ctx.name) {

            case "functionDeclaration":

                return this.visitFunctionDeclaration(ctx);

            default:

                throw new Error(
                    `Delcaration not supported: ${ctx.name}`
                );

        }

    }

    /**
     * =========================
     * FUNCTION DECLARATION
     * =========================
     *
     * @param {any} ctx
     */
    visitFunctionDeclaration(ctx) {

        const identifier =
            CSTAdapter.token(
                ctx,
                "Identifier"
            );

        if (!identifier) {
            throw new Error(
                "FunctionDeclaration has no identifier"
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

        const parameters =
            CSTAdapter.has(
                ctx,
                "parameterList"
            )
                ?
                this.visitParameterList(
                    CSTAdapter.first(
                        ctx,
                        "parameterList"
                    )
                )
                :
                [];

        const body =
            CSTAdapter.has(
                ctx,
                "block"
            )
                ?
                this.visitBlock(
                    CSTAdapter.first(
                        ctx,
                        "block"
                    )
                )
                :
                null;

        const location = LocationHelper.from(ctx);

        return ASTFactory.functionDeclaration(
            identifierNode,
            parameters,
            body,
            location
        );

    }

    /**
     * =========================
     * PARAMETERS
     * =========================
     *
     * @param {any} ctx
     */
    visitParameterList(ctx) {

        return (
            CSTAdapter.get(
                ctx,
                "parameter"
            ) ?? []
        )
            .map(
                (/** @type {any} */ param) =>
                    this.visitParameter(param)
            );
    }

    /**
     * =========================
     * PARAMETER
     * =========================
     *
     * @param {any} ctx
     */
    visitParameter(ctx) {

        const identifier =
            CSTAdapter.token(
                ctx,
                "Identifier"
            );

        if (!identifier) {
            throw new Error(
                "Parameter has no identifier"
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

        const dimensionNode =
            CSTAdapter.first(
                ctx,
                "parameterDimensionList"
            );


        const dimensions =
            dimensionNode
                ?
                this.getParameterDimensions(dimensionNode)
                :
                [];

        const location = LocationHelper.from(ctx);

        return ASTFactory.parameter(
            identifierNode,
            dimensions,
            location
        );
    }

    /**
     * =========================
     * CONTAR DIMENSIONES
     * =========================
     *
     * @param {any} ctx
     */
    getParameterDimensions(ctx) {

        const brackets =
            CSTAdapter.get(
                ctx,
                "LBracket"
            ) ?? [];


        const expressions =
            CSTAdapter.get(
                ctx,
                "expression"
            ) ?? [];

        const dimensions = [];

        for (let i = 0; i < brackets.length; i++) {

            const expression =
                expressions[i];


            dimensions.push(
                expression
                    ?
                    this.expressionVisitor.visitExpression(expression)
                    :
                    null
            );
        }

        return dimensions;
    }
    
    /**
     * =========================
     * BLOCK
     * =========================
     *
     * @param {any} ctx
     */
    visitBlock(ctx) {

        const statements =
            CSTAdapter.get(
                ctx,
                "statement"
            );

        return ASTFactory.block(
            statements.map(
                (/** @type {any} */ stmt) =>
                    this.statementVisitor.visitStatement(stmt)
            )
        );

    }
}