import {
    ASTVisitor
} from "../../../src/ast/visitors/ASTVisitor.js";
import {
    ASTVisitorError
} from "../../../src/ast/visitors/ASTVisitorError.js";
import {
    DiagramGenerationError
} from "../../../src/errors/DiagramGenerationError.js";

/**
 * Adapta los errores internos de ASTVisitor al dominio de diagramas.
 */
export class DiagramASTVisitor extends ASTVisitor {

    visit(node, context = undefined) {
        try {
            return super.visit(node, context);
        } catch (error) {
            if (
                error instanceof
                DiagramGenerationError
            ) {
                throw error;
            }

            if (error instanceof ASTVisitorError) {
                throw DiagramGenerationError
                    .invalidNode(
                        node,
                        error
                    );
            }

            throw error;
        }
    }

    visitUnsupported(node) {
        throw DiagramGenerationError
            .unsupportedNode(node);
    }
}
