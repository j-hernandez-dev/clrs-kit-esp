import {
    LanguageError
} from "../../../src/errors/LanguageError.js";
import {
    DiagramGenerationError
} from "../../../src/errors/DiagramGenerationError.js";
import {
    tryParseSource
} from "../../../src/language/LanguageFrontend.js";
import {
    createDefaultDiagram
} from "../config/DefaultDiagram.js";
import {
    DiagramVisitor
} from "../visitor/DiagramVisitor.js";

/**
 * Convierte código fuente en AST y modelo de diagrama sin depender de React.
 */
export class DiagramService {

    constructor(options = {}) {
        this.parseSource =
            options.parseSource ??
            tryParseSource;
        this.diagramVisitorFactory =
            options.diagramVisitorFactory ??
            (() => new DiagramVisitor());
        this.defaultDiagramFactory =
            options.defaultDiagramFactory ??
            createDefaultDiagram;
    }

    buildFromSource(sourceCode) {
        if (
            typeof sourceCode === "string" &&
            sourceCode.trim() === ""
        ) {
            return success({
                sourceCode,
                ast: null,
                diagram:
                    this.defaultDiagramFactory(),
                empty: true
            });
        }

        try {
            const frontendResult =
                this.parseSource(sourceCode);

            if (!frontendResult.ok) {
                return failure(
                    frontendResult.errors
                );
            }

            const ast =
                frontendResult.value.ast;
            const diagram =
                this.diagramVisitorFactory()
                    .build(ast);

            return success({
                sourceCode,
                tokens:
                    frontendResult.value.tokens,
                cst:
                    frontendResult.value.cst,
                ast,
                diagram,
                empty: false
            });
        } catch (error) {
            return failure([
                normalizeDiagramError(error)
            ]);
        }
    }
}

function success(value) {
    return {
        ok: true,
        value,
        errors: []
    };
}

function failure(errors) {
    return {
        ok: false,
        value: null,
        errors
    };
}

function normalizeDiagramError(error) {
    if (error instanceof LanguageError) {
        return error;
    }

    return new DiagramGenerationError(
        error instanceof Error
            ? error.message
            : "Unknown diagram generation error.",
        null,
        { cause: error }
    );
}
