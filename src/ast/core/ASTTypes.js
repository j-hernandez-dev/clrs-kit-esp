/**
 * Contrato documental del AST de CLRS.
 *
 * Este módulo no contiene comportamiento en tiempo de ejecución. Sus typedefs
 * constituyen el contrato compartido por transpilación, costo y diagramas.
 */

/**
 * @typedef {Object} SourceLocation
 * @property {number} startLine
 * @property {number} startColumn
 * @property {number} endLine
 * @property {number} endColumn
 */

/**
 * @typedef {Object} ASTNodeBase
 * @property {string} type
 * @property {SourceLocation|null} location
 */

/**
 * @typedef {ASTNodeBase & {
 *   type: "Identifier",
 *   name: string
 * }} IdentifierNode
 */

/**
 * @typedef {ASTNodeBase & {
 *   type: "NumberLiteral"|"ScientificLiteral"|"StringLiteral"|"BooleanLiteral",
 *   value: number|string|boolean
 * }} LiteralNode
 */

/**
 * @typedef {ASTNodeBase & {
 *   type: "BinaryExpression"|"LogicalExpression",
 *   operator: string,
 *   left: ASTExpression,
 *   right: ASTExpression
 * }} BinaryLikeNode
 */

/**
 * @typedef {ASTNodeBase & {
 *   type: "UnaryExpression"|"LogicalNot",
 *   operator: string,
 *   operand: ASTExpression
 * }} UnaryLikeNode
 */

/**
 * @typedef {ASTNodeBase & {
 *   type: "GroupExpression",
 *   expression: ASTExpression
 * }} GroupExpressionNode
 */

/**
 * @typedef {ASTNodeBase & {
 *   type: "FunctionCall",
 *   identifier: IdentifierNode,
 *   arguments: ASTExpression[]
 * }} FunctionCallNode
 */

/**
 * @typedef {ASTNodeBase & {
 *   type: "Access",
 *   identifier: IdentifierNode,
 *   indexes: ASTExpression[]
 * }} AccessNode
 */

/**
 * @typedef {
 *   IdentifierNode |
 *   LiteralNode |
 *   BinaryLikeNode |
 *   UnaryLikeNode |
 *   GroupExpressionNode |
 *   FunctionCallNode |
 *   AccessNode
 * } ASTExpression
 */

/**
 * @typedef {ASTNodeBase & {
 *   type: "Block",
 *   statements: ASTStatement[]
 * }} BlockNode
 */

/**
 * @typedef {ASTNodeBase & {
 *   type: "Assignment",
 *   left: IdentifierNode|AccessNode,
 *   right: ASTExpression
 * }} AssignmentNode
 */

/**
 * @typedef {Object} ElseIfBranch
 * @property {ASTExpression} condition
 * @property {BlockNode} block
 */

/**
 * @typedef {ASTNodeBase & {
 *   type: "IfStatement",
 *   condition: ASTExpression,
 *   thenBlock: BlockNode,
 *   elseIfBranches: ElseIfBranch[],
 *   elseBlock: BlockNode|null
 * }} IfNode
 */

/**
 * @typedef {ASTNodeBase & {
 *   type: "WhileStatement",
 *   condition: ASTExpression,
 *   body: BlockNode
 * }} WhileNode
 */

/**
 * @typedef {ASTNodeBase & {
 *   type: "ForStatement",
 *   initializer: AssignmentNode,
 *   condition: ASTExpression,
 *   increment: AssignmentNode,
 *   body: BlockNode
 * }} ForNode
 */

/**
 * @typedef {ASTNodeBase & {
 *   type: "ReturnStatement",
 *   expression: ASTExpression
 * }} ReturnNode
 */

/**
 * @typedef {ASTNodeBase & {
 *   type: "ReadStatement",
 *   identifiers: (IdentifierNode|AccessNode)[]
 * }} ReadNode
 */

/**
 * @typedef {ASTNodeBase & {
 *   type: "WriteStatement",
 *   expressions: ASTExpression[]
 * }} WriteNode
 */

/**
 * Una dimensión `null` representa `[]` en un parámetro de arreglo.
 *
 * @typedef {ASTNodeBase & {
 *   type: "Parameter",
 *   identifier: IdentifierNode,
 *   dimensions: (ASTExpression|null)[]
 * }} ParameterNode
 */

/**
 * @typedef {ASTNodeBase & {
 *   type: "FunctionDeclaration",
 *   identifier: IdentifierNode,
 *   parameters: ParameterNode[],
 *   body: BlockNode
 * }} FunctionDeclarationNode
 */

/**
 * @typedef {ASTNodeBase & {
 *   type: "ArrayDeclaration",
 *   identifier: IdentifierNode,
 *   dimensions: ASTExpression[],
 *   dataType: unknown
 * }} ArrayDeclarationNode
 */

/**
 * @typedef {ASTNodeBase & {
 *   type: "DeclarationItem",
 *   identifier: IdentifierNode,
 *   dimensions: ASTExpression[]
 * }} DeclarationItemNode
 */

/**
 * @typedef {
 *   AssignmentNode |
 *   IfNode |
 *   WhileNode |
 *   ForNode |
 *   ReturnNode |
 *   ReadNode |
 *   WriteNode |
 *   FunctionCallNode |
 *   FunctionDeclarationNode |
 *   ArrayDeclarationNode
 * } ASTStatement
 */

/**
 * @typedef {ASTNodeBase & {
 *   type: "Program",
 *   statements: ASTStatement[]
 * }} ProgramNode
 */

/**
 * @typedef {
 *   ProgramNode |
 *   BlockNode |
 *   ASTExpression |
 *   ASTStatement |
 *   ParameterNode |
 *   DeclarationItemNode
 * } ASTNode
 */

export {};
