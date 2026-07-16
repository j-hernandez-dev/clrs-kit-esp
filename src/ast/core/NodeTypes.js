/**
 * NodeTypes.js
 * ==================================
 * NODE TYPES
 * ==================================
 */

export const NodeTypes = {

    /**
     * =========================
     * CORE
     * =========================
     */
    PROGRAM: "Program",
    BLOCK: "Block",

    /**
     * =========================
     * EXPRESSIONS
     * =========================
     */
    IDENTIFIER: "Identifier",
    LOGICAL_EXPRESSION: "LogicalExpression",
    BINARY_EXPRESSION: "BinaryExpression",
    LOGICAL_NOT: "LogicalNot",
    FUNCTION_CALL: "FunctionCall",
    GROUP_EXPRESSION: "GroupExpression",
    ACCESS: "Access",
    UNARY: "UnaryExpression",

    /**
     * =========================
     * STATEMENTS
     * =========================
     */
    ASSIGNMENT: "Assignment",
    IF_STATEMENT: "IfStatement",
    WHILE_STATEMENT: "WhileStatement",
    FOR_STATEMENT: "ForStatement",
    RETURN_STATEMENT: "ReturnStatement",
    READ_STATEMENT: "ReadStatement",
    WRITE_STATEMENT: "WriteStatement",

    /**
     * =========================
     * DECLARATIONS
     * =========================
     */
    VARIABLE_DECLARATION: "VariableDeclaration",
    ARRAY_DECLARATION: "ArrayDeclaration",
    FUNCTION_DECLARATION: "FunctionDeclaration",
    PARAMETER: "Parameter",

    /**
     * =========================
     * LITERAL TYPES
     * =========================
     */
    NUMBER_LITERAL: "NumberLiteral",
    SCIENTIFIC_LITERAL: "ScientificLiteral",
    STRING_LITERAL: "StringLiteral",
    BOOLEAN_LITERAL: "BooleanLiteral"
};