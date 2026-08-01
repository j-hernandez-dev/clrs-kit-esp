import { NodeTypes } from "../core/NodeTypes.js";

export const LITERAL_NODE_TYPES = Object.freeze([
    NodeTypes.NUMBER_LITERAL,
    NodeTypes.SCIENTIFIC_LITERAL,
    NodeTypes.STRING_LITERAL,
    NodeTypes.BOOLEAN_LITERAL
]);

export const EXPRESSION_NODE_TYPES = Object.freeze([
    NodeTypes.IDENTIFIER,
    ...LITERAL_NODE_TYPES,
    NodeTypes.LOGICAL_EXPRESSION,
    NodeTypes.BINARY_EXPRESSION,
    NodeTypes.LOGICAL_NOT,
    NodeTypes.FUNCTION_CALL,
    NodeTypes.GROUP_EXPRESSION,
    NodeTypes.ACCESS,
    NodeTypes.UNARY
]);

export const ASSIGNABLE_NODE_TYPES = Object.freeze([
    NodeTypes.IDENTIFIER,
    NodeTypes.ACCESS
]);

export const EXECUTABLE_NODE_TYPES = Object.freeze([
    NodeTypes.ASSIGNMENT,
    NodeTypes.IF_STATEMENT,
    NodeTypes.WHILE_STATEMENT,
    NodeTypes.FOR_STATEMENT,
    NodeTypes.RETURN_STATEMENT,
    NodeTypes.READ_STATEMENT,
    NodeTypes.WRITE_STATEMENT,
    NodeTypes.FUNCTION_CALL,
    NodeTypes.FUNCTION_DECLARATION,
    NodeTypes.ARRAY_DECLARATION
]);

export const VALIDATED_NODE_TYPES = Object.freeze([
    NodeTypes.PROGRAM,
    NodeTypes.BLOCK,
    ...EXPRESSION_NODE_TYPES,
    ...EXECUTABLE_NODE_TYPES,
    NodeTypes.PARAMETER,
    NodeTypes.DECLARATION_ITEM
]);

const expressionTypes = new Set(EXPRESSION_NODE_TYPES);
const assignableTypes = new Set(ASSIGNABLE_NODE_TYPES);
const executableTypes = new Set(EXECUTABLE_NODE_TYPES);
const validatedTypes = new Set(VALIDATED_NODE_TYPES);

export function isExpressionType(type) {
    return expressionTypes.has(type);
}

export function isAssignableType(type) {
    return assignableTypes.has(type);
}

export function isExecutableType(type) {
    return executableTypes.has(type);
}

export function isValidatedNodeType(type) {
    return validatedTypes.has(type);
}
