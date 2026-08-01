import test from "node:test";
import assert from "node:assert/strict";

import {
    NodeTypes
} from "../src/ast/core/NodeTypes.js";
import {
    ASTVisitor
} from "../src/ast/visitors/ASTVisitor.js";
import {
    DiagramGenerationError
} from "../src/errors/DiagramGenerationError.js";
import {
    DiagramContext
} from "../flow/src/visitor/DiagramContext.js";
import {
    DiagramControlFlowVisitor
} from "../flow/src/visitor/DiagramControlFlowVisitor.js";
import {
    DiagramDeclarationVisitor
} from "../flow/src/visitor/DiagramDeclarationVisitor.js";
import {
    DiagramExpressionVisitor
} from "../flow/src/visitor/DiagramExpressionVisitor.js";
import {
    DiagramStatementVisitor
} from "../flow/src/visitor/DiagramStatementVisitor.js";
import {
    DiagramVisitor
} from "../flow/src/visitor/DiagramVisitor.js";
import {
    parseSource
} from "../src/language/LanguageFrontend.js";

test("los visitors de diagramas especializan ASTVisitor", () => {
    const coordinator = new DiagramVisitor();

    assert.ok(coordinator instanceof ASTVisitor);
    assert.ok(
        coordinator.expressionVisitor
        instanceof DiagramExpressionVisitor
    );
    assert.ok(
        coordinator.statementVisitor
        instanceof DiagramStatementVisitor
    );
    assert.ok(
        coordinator.controlFlowVisitor
        instanceof DiagramControlFlowVisitor
    );
    assert.ok(
        coordinator.declarationVisitor
        instanceof DiagramDeclarationVisitor
    );

    assert.equal(
        coordinator.expressionVisitor
            .supports(NodeTypes.ACCESS),
        true
    );
    assert.equal(
        coordinator.statementVisitor
            .supports(NodeTypes.ASSIGNMENT),
        true
    );
    assert.equal(
        coordinator.statementVisitor
            .supports(NodeTypes.IF_STATEMENT),
        false
    );
    assert.equal(
        coordinator.controlFlowVisitor
            .supports(NodeTypes.IF_STATEMENT),
        true
    );
    assert.equal(
        coordinator.declarationVisitor
            .supports(
                NodeTypes.FUNCTION_DECLARATION
            ),
        true
    );
});

test("cada coordinador mantiene un DiagramContext aislado", () => {
    const first = new DiagramVisitor();
    const second = new DiagramVisitor();

    assert.ok(
        first.diagramContext
        instanceof DiagramContext
    );
    assert.notEqual(
        first.diagramContext,
        second.diagramContext
    );

    first.diagramContext.registerFunction(
        "SOLO_PRIMERO",
        {}
    );

    assert.equal(
        second.diagramContext.getFunction(
            "SOLO_PRIMERO"
        ),
        undefined
    );

    const ast = parseSource("dato <- 1").ast;

    assert.deepEqual(
        first.build(ast),
        second.build(ast)
    );
});

test("el coordinador conserva fachadas de instrucciones y expresiones", () => {
    const visitor = new DiagramVisitor();
    const ast = parseSource("dato <- 1").ast;
    const diagram =
        visitor.diagramContext
            .createDiagram();
    const assignment = ast.statements[0];

    assert.equal(
        visitor.getExpression(
            assignment.right
        ),
        "1"
    );
    assert.deepEqual(
        visitor.statementType(
            assignment,
            diagram
        ),
        {
            entry: "N1",
            exit: "N1"
        }
    );
});

test("raíces y nodos no soportados producen errores estructurados", () => {
    const visitor = new DiagramVisitor();

    assert.throws(
        () => visitor.build(null),
        error =>
            error instanceof
                DiagramGenerationError &&
            error.phase === "diagram" &&
            error.code ===
                "CLRS_DIAGRAM_AST_REQUIRED"
    );

    assert.throws(
        () => visitor.build({
            type: NodeTypes.IDENTIFIER,
            name: "dato",
            location: null
        }),
        error =>
            error instanceof
                DiagramGenerationError &&
            error.code ===
                "CLRS_DIAGRAM_PROGRAM_REQUIRED"
    );

    assert.throws(
        () => visitor.build({
            type: NodeTypes.PROGRAM,
            statements: [{
                type: NodeTypes.BLOCK,
                statements: [],
                location: null
            }],
            location: null
        }),
        error =>
            error instanceof
                DiagramGenerationError &&
            error.code ===
                "CLRS_UNSUPPORTED_DIAGRAM_NODE" &&
            error.nodeType === NodeTypes.BLOCK
    );
});

test("los errores de expresión también pertenecen a la fase diagram", () => {
    const visitor =
        new DiagramExpressionVisitor();

    assert.throws(
        () => visitor.visit(null),
        error =>
            error instanceof
                DiagramGenerationError &&
            error.phase === "diagram" &&
            error.code ===
                "CLRS_INVALID_DIAGRAM_NODE"
    );
});
