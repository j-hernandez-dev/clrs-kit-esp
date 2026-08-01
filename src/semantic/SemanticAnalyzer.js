import {
    NodeTypes
} from "../ast/core/NodeTypes.js";
import {
    SemanticError
} from "../errors/SemanticError.js";
import {
    DEFAULT_GLOBAL_SYMBOLS
} from "./StandardSymbols.js";
import {
    SemanticContext
} from "./SemanticContext.js";
import {
    SemanticModel
} from "./SemanticModel.js";
import {
    SemanticBindingCollector
} from "./visitors/SemanticBindingCollector.js";
import {
    SemanticReferenceResolver
} from "./visitors/SemanticReferenceResolver.js";

/**
 * Analizador semántico de dos pasadas.
 */
export class SemanticAnalyzer {

    constructor(options = {}) {
        this.globalNames =
            Object.freeze([
                ...DEFAULT_GLOBAL_SYMBOLS,
                ...(options.globalNames ?? [])
            ]);
    }

    analyze(ast) {
        if (ast == null) {
            throw SemanticError.astRequired();
        }

        if (ast.type !== NodeTypes.PROGRAM) {
            throw SemanticError
                .programRequired(ast);
        }

        const context =
            new SemanticContext(
                ast,
                this.globalNames
            );

        new SemanticBindingCollector(
            context
        ).collect(ast);

        new SemanticReferenceResolver(
            context
        ).resolve(ast);

        if (context.errors.length === 1) {
            throw context.errors[0];
        }

        if (context.errors.length > 1) {
            throw SemanticError.aggregate(
                context.errors
            );
        }

        return new SemanticModel(context);
    }
}
