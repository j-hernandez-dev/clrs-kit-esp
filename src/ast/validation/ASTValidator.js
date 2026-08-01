import { NodeTypes } from "../core/NodeTypes.js";
import {
    isAssignableType,
    isExecutableType,
    isExpressionType,
    isValidatedNodeType
} from "./NodeSchemas.js";
import { ASTValidationError } from "./ASTValidationError.js";

/**
 * Valida el AST y devuelve el mismo objeto cuando cumple el contrato.
 *
 * @param {any} ast
 * @returns {any}
 * @throws {ASTValidationError}
 */
export function validateAST(ast) {
    const report = inspectAST(ast);

    if (!report.valid) {
        const first = report.diagnostics[0];

        throw new ASTValidationError(
            report.diagnostics.length === 1
                ? first.message
                : `The AST contains ${report.diagnostics.length} structural errors.`,
            first.location,
            {
                diagnostics: report.diagnostics
            }
        );
    }

    return ast;
}

/**
 * Inspecciona sin lanzar excepciones.
 *
 * @param {any} ast
 * @returns {{valid: boolean, diagnostics: any[]}}
 */
export function inspectAST(ast) {
    const diagnostics = [];
    const ancestors = new Set();

    if (!isNode(ast)) {
        addDiagnostic(
            diagnostics,
            "CLRS_AST_ROOT_REQUIRED",
            "The AST root must be a Program node.",
            "$",
            ast
        );
    } else if (ast.type !== NodeTypes.PROGRAM) {
        addDiagnostic(
            diagnostics,
            "CLRS_AST_INVALID_ROOT",
            `The AST root must be ${NodeTypes.PROGRAM}, not ${String(ast.type)}.`,
            "$",
            ast
        );
    } else {
        visitNode(ast, "$", diagnostics, ancestors);
    }

    return {
        valid: diagnostics.length === 0,
        diagnostics
    };
}

function visitNode(node, path, diagnostics, ancestors) {
    if (!isNode(node)) {
        addDiagnostic(
            diagnostics,
            "CLRS_AST_NODE_REQUIRED",
            "An AST node was expected.",
            path,
            node
        );
        return;
    }

    if (ancestors.has(node)) {
        addDiagnostic(
            diagnostics,
            "CLRS_AST_CYCLE",
            "The AST contains a cyclic reference.",
            path,
            node
        );
        return;
    }

    if (typeof node.type !== "string" || node.type.length === 0) {
        addDiagnostic(
            diagnostics,
            "CLRS_AST_TYPE_REQUIRED",
            "Every AST node must declare a type.",
            path,
            node
        );
        return;
    }

    if (!isValidatedNodeType(node.type)) {
        addDiagnostic(
            diagnostics,
            "CLRS_AST_UNKNOWN_NODE",
            `No existe un contrato estructural para el nodo ${node.type}.`,
            path,
            node
        );
        return;
    }

    validateLocation(node.location, `${path}.location`, diagnostics, node);

    ancestors.add(node);

    switch (node.type) {
        case NodeTypes.PROGRAM:
        case NodeTypes.BLOCK:
            validateStatements(node.statements, `${path}.statements`, diagnostics, ancestors);
            break;

        case NodeTypes.IDENTIFIER:
            requireNonEmptyString(node.name, `${path}.name`, diagnostics, node);
            break;

        case NodeTypes.NUMBER_LITERAL:
        case NodeTypes.SCIENTIFIC_LITERAL:
            if (typeof node.value !== "number" || !Number.isFinite(node.value)) {
                addDiagnostic(
                    diagnostics,
                    "CLRS_AST_INVALID_NUMBER",
                    "A numeric literal must contain a finite number.",
                    `${path}.value`,
                    node
                );
            }
            break;

        case NodeTypes.STRING_LITERAL:
            if (typeof node.value !== "string") {
                addDiagnostic(
                    diagnostics,
                    "CLRS_AST_INVALID_STRING",
                    "A string literal must contain a string.",
                    `${path}.value`,
                    node
                );
            }
            break;

        case NodeTypes.BOOLEAN_LITERAL:
            validateBooleanLiteral(node, path, diagnostics);
            break;

        case NodeTypes.BINARY_EXPRESSION:
        case NodeTypes.LOGICAL_EXPRESSION:
            requireNonEmptyString(node.operator, `${path}.operator`, diagnostics, node);
            visitExpression(node.left, `${path}.left`, diagnostics, ancestors);
            visitExpression(node.right, `${path}.right`, diagnostics, ancestors);
            break;

        case NodeTypes.LOGICAL_NOT:
        case NodeTypes.UNARY:
            requireNonEmptyString(node.operator, `${path}.operator`, diagnostics, node);
            visitExpression(node.operand, `${path}.operand`, diagnostics, ancestors);
            break;

        case NodeTypes.GROUP_EXPRESSION:
            visitExpression(node.expression, `${path}.expression`, diagnostics, ancestors);
            break;

        case NodeTypes.FUNCTION_CALL:
            visitIdentifier(node.identifier, `${path}.identifier`, diagnostics, ancestors);
            visitExpressionArray(node.arguments, `${path}.arguments`, diagnostics, ancestors);
            break;

        case NodeTypes.ACCESS:
            visitIdentifier(node.identifier, `${path}.identifier`, diagnostics, ancestors);
            visitExpressionArray(node.indexes, `${path}.indexes`, diagnostics, ancestors, true);
            break;

        case NodeTypes.ASSIGNMENT:
            visitAssignable(node.left, `${path}.left`, diagnostics, ancestors);
            visitExpression(node.right, `${path}.right`, diagnostics, ancestors);
            break;

        case NodeTypes.IF_STATEMENT:
            validateIf(node, path, diagnostics, ancestors);
            break;

        case NodeTypes.WHILE_STATEMENT:
            visitExpression(node.condition, `${path}.condition`, diagnostics, ancestors);
            visitBlock(node.body, `${path}.body`, diagnostics, ancestors);
            break;

        case NodeTypes.FOR_STATEMENT:
            visitExpectedType(
                node.initializer,
                NodeTypes.ASSIGNMENT,
                `${path}.initializer`,
                diagnostics,
                ancestors
            );
            visitExpression(node.condition, `${path}.condition`, diagnostics, ancestors);
            visitExpectedType(
                node.increment,
                NodeTypes.ASSIGNMENT,
                `${path}.increment`,
                diagnostics,
                ancestors
            );
            visitBlock(node.body, `${path}.body`, diagnostics, ancestors);
            break;

        case NodeTypes.RETURN_STATEMENT:
            visitExpression(node.expression, `${path}.expression`, diagnostics, ancestors);
            break;

        case NodeTypes.READ_STATEMENT:
            visitAssignableArray(node.identifiers, `${path}.identifiers`, diagnostics, ancestors);
            break;

        case NodeTypes.WRITE_STATEMENT:
            visitExpressionArray(
                node.expressions,
                `${path}.expressions`,
                diagnostics,
                ancestors,
                true
            );
            break;

        case NodeTypes.FUNCTION_DECLARATION:
            validateFunction(node, path, diagnostics, ancestors);
            break;

        case NodeTypes.PARAMETER:
            visitIdentifier(node.identifier, `${path}.identifier`, diagnostics, ancestors);
            visitDimensions(node.dimensions, `${path}.dimensions`, diagnostics, ancestors, true);
            break;

        case NodeTypes.ARRAY_DECLARATION:
            visitIdentifier(node.identifier, `${path}.identifier`, diagnostics, ancestors);
            visitDimensions(
                node.dimensions,
                `${path}.dimensions`,
                diagnostics,
                ancestors,
                false,
                true
            );
            break;

        case NodeTypes.DECLARATION_ITEM:
            visitIdentifier(node.identifier, `${path}.identifier`, diagnostics, ancestors);
            visitDimensions(node.dimensions, `${path}.dimensions`, diagnostics, ancestors, false);
            break;
    }

    ancestors.delete(node);
}

function validateStatements(statements, path, diagnostics, ancestors) {
    if (!requireArray(statements, path, diagnostics, null)) {
        return;
    }

    statements.forEach((statement, index) => {
        const itemPath = `${path}[${index}]`;

        if (!isNode(statement) || !isExecutableType(statement.type)) {
            addDiagnostic(
                diagnostics,
                "CLRS_AST_INVALID_STATEMENT",
                "Programs and blocks may only contain executable statements or declarations.",
                itemPath,
                statement
            );

            if (isNode(statement)) {
                visitNode(statement, itemPath, diagnostics, ancestors);
            }
            return;
        }

        visitNode(statement, itemPath, diagnostics, ancestors);
    });
}

function validateIf(node, path, diagnostics, ancestors) {
    visitExpression(node.condition, `${path}.condition`, diagnostics, ancestors);
    visitBlock(node.thenBlock, `${path}.thenBlock`, diagnostics, ancestors);

    if (requireArray(node.elseIfBranches, `${path}.elseIfBranches`, diagnostics, node)) {
        node.elseIfBranches.forEach((branch, index) => {
            const branchPath = `${path}.elseIfBranches[${index}]`;

            if (!branch || typeof branch !== "object" || Array.isArray(branch)) {
                addDiagnostic(
                    diagnostics,
                    "CLRS_AST_INVALID_ELSE_IF",
                    "Each else-if branch must contain a condition and a block.",
                    branchPath,
                    node
                );
                return;
            }

            visitExpression(
                branch.condition,
                `${branchPath}.condition`,
                diagnostics,
                ancestors
            );
            visitBlock(
                branch.block,
                `${branchPath}.block`,
                diagnostics,
                ancestors
            );
        });
    }

    if (node.elseBlock != null) {
        visitBlock(node.elseBlock, `${path}.elseBlock`, diagnostics, ancestors);
    }
}

function validateFunction(node, path, diagnostics, ancestors) {
    visitIdentifier(node.identifier, `${path}.identifier`, diagnostics, ancestors);

    if (requireArray(node.parameters, `${path}.parameters`, diagnostics, node)) {
        node.parameters.forEach((parameter, index) => {
            visitExpectedType(
                parameter,
                NodeTypes.PARAMETER,
                `${path}.parameters[${index}]`,
                diagnostics,
                ancestors
            );
        });
    }

    visitBlock(node.body, `${path}.body`, diagnostics, ancestors);
}

function validateBooleanLiteral(node, path, diagnostics) {
    const isBoolean =
        typeof node.value === "boolean" ||
        node.value === "TRUE" ||
        node.value === "FALSE";

    if (!isBoolean) {
        addDiagnostic(
            diagnostics,
            "CLRS_AST_INVALID_BOOLEAN",
            "A boolean literal must contain a boolean, TRUE, or FALSE.",
            `${path}.value`,
            node
        );
    }
}

function visitExpression(node, path, diagnostics, ancestors) {
    if (!isNode(node) || !isExpressionType(node.type)) {
        addDiagnostic(
            diagnostics,
            "CLRS_AST_EXPRESSION_REQUIRED",
            "An AST expression was expected.",
            path,
            node
        );
        return;
    }

    visitNode(node, path, diagnostics, ancestors);
}

function visitIdentifier(node, path, diagnostics, ancestors) {
    visitExpectedType(
        node,
        NodeTypes.IDENTIFIER,
        path,
        diagnostics,
        ancestors
    );
}

function visitAssignable(node, path, diagnostics, ancestors) {
    if (!isNode(node) || !isAssignableType(node.type)) {
        addDiagnostic(
            diagnostics,
            "CLRS_AST_ASSIGNABLE_REQUIRED",
            "An identifier or access node was expected as assignment target.",
            path,
            node
        );
        return;
    }

    visitNode(node, path, diagnostics, ancestors);
}

function visitBlock(node, path, diagnostics, ancestors) {
    visitExpectedType(
        node,
        NodeTypes.BLOCK,
        path,
        diagnostics,
        ancestors
    );
}

function visitExpectedType(node, type, path, diagnostics, ancestors) {
    if (!isNode(node) || node.type !== type) {
        addDiagnostic(
            diagnostics,
            "CLRS_AST_UNEXPECTED_NODE",
            `A ${type} node was expected.`,
            path,
            node
        );
        return;
    }

    visitNode(node, path, diagnostics, ancestors);
}

function visitExpressionArray(
    values,
    path,
    diagnostics,
    ancestors,
    requireNonEmpty = false
) {
    if (!requireArray(values, path, diagnostics, null, requireNonEmpty)) {
        return;
    }

    values.forEach((value, index) => {
        visitExpression(value, `${path}[${index}]`, diagnostics, ancestors);
    });
}

function visitAssignableArray(values, path, diagnostics, ancestors) {
    if (!requireArray(values, path, diagnostics, null, true)) {
        return;
    }

    values.forEach((value, index) => {
        visitAssignable(value, `${path}[${index}]`, diagnostics, ancestors);
    });
}

function visitDimensions(
    values,
    path,
    diagnostics,
    ancestors,
    allowNull,
    requireNonEmpty = false
) {
    if (!requireArray(
        values,
        path,
        diagnostics,
        null,
        requireNonEmpty
    )) {
        return;
    }

    values.forEach((value, index) => {
        if (allowNull && value === null) {
            return;
        }

        visitExpression(value, `${path}[${index}]`, diagnostics, ancestors);
    });
}

function validateLocation(location, path, diagnostics, node) {
    if (location == null) {
        return;
    }

    if (typeof location !== "object" || Array.isArray(location)) {
        addDiagnostic(
            diagnostics,
            "CLRS_AST_INVALID_LOCATION",
            "The source location must be an object or null.",
            path,
            node
        );
        return;
    }

    const keys = [
        "startLine",
        "startColumn",
        "endLine",
        "endColumn"
    ];

    if (
        keys.some(key =>
            !Number.isInteger(location[key]) ||
            location[key] < 1
        )
    ) {
        addDiagnostic(
            diagnostics,
            "CLRS_AST_INVALID_LOCATION",
            "The source location must contain positive integer lines and columns.",
            path,
            node
        );
        return;
    }

    const endsBeforeStart =
        location.endLine < location.startLine ||
        (
            location.endLine === location.startLine &&
            location.endColumn < location.startColumn
        );

    if (endsBeforeStart) {
        addDiagnostic(
            diagnostics,
            "CLRS_AST_REVERSED_LOCATION",
            "The node source location ends before it starts.",
            path,
            node
        );
    }
}

function requireArray(
    value,
    path,
    diagnostics,
    node,
    requireNonEmpty = false
) {
    if (!Array.isArray(value)) {
        addDiagnostic(
            diagnostics,
            "CLRS_AST_ARRAY_REQUIRED",
            "An array was expected.",
            path,
            node
        );
        return false;
    }

    if (requireNonEmpty && value.length === 0) {
        addDiagnostic(
            diagnostics,
            "CLRS_AST_NON_EMPTY_ARRAY_REQUIRED",
            "El arreglo debe contener al menos un elemento.",
            path,
            node
        );
        return false;
    }

    return true;
}

function requireNonEmptyString(value, path, diagnostics, node) {
    if (typeof value !== "string" || value.trim().length === 0) {
        addDiagnostic(
            diagnostics,
            "CLRS_AST_NON_EMPTY_STRING_REQUIRED",
            "A non-empty string was expected.",
            path,
            node
        );
    }
}

function addDiagnostic(
    diagnostics,
    code,
    message,
    path,
    node
) {
    diagnostics.push({
        code,
        message,
        path,
        nodeType: isNode(node)
            ? node.type ?? null
            : null,
        location:
            isNode(node) &&
            node.location &&
            typeof node.location === "object"
                ? node.location
                : null
    });
}

function isNode(value) {
    return (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value)
    );
}
