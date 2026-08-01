import test from "node:test";
import assert from "node:assert/strict";

import { NodeTypes } from "../src/ast/core/NodeTypes.js";
import { ASTVisitor } from "../src/ast/visitors/ASTVisitor.js";
import {
    ASTVisitorError
} from "../src/ast/visitors/ASTVisitorError.js";
import {
    CostAnalysisVisitor
} from "../src/complex/CostAnalysisVisitor.js";
import {
    ComplexAnalysisError
} from "../src/errors/ComplexAnalysisError.js";
import { parseSource } from "../src/language/LanguageFrontend.js";

const location = Object.freeze({
    startLine: 1,
    startColumn: 1,
    endLine: 1,
    endColumn: 4
});

class LabelVisitor extends ASTVisitor {

    constructor() {
        super();

        this.registerHandlers({
            [NodeTypes.IDENTIFIER]:
                this.visitIdentifier,
            [NodeTypes.NUMBER_LITERAL]:
                this.visitNumber
        });
    }

    visitIdentifier(node, context) {
        return `${context.prefix}${node.name}`;
    }

    visitNumber(node, context) {
        return node.value * context.multiplier;
    }
}

test("ASTVisitor despacha handlers y conserva contexto y orden", () => {
    const visitor = new LabelVisitor();
    const nodes = [
        identifier("dato"),
        numberLiteral(4)
    ];
    const context = {
        prefix: "$",
        multiplier: 3
    };

    assert.equal(visitor.supports(NodeTypes.IDENTIFIER), true);
    assert.equal(visitor.supports(nodes[0]), true);
    assert.equal(visitor.supports(NodeTypes.BLOCK), false);
    assert.deepEqual(
        visitor.visitMany(nodes, context),
        ["$dato", 12]
    );
});

test("un nodo no soportado produce un ASTVisitorError estructurado", () => {
    const visitor = new LabelVisitor();
    const node = {
        type: NodeTypes.BLOCK,
        statements: [],
        location
    };

    assert.throws(
        () => visitor.visit(node),
        error => {
            assert.ok(error instanceof ASTVisitorError);
            assert.equal(error.phase, "ast-visitor");
            assert.equal(error.code, "CLRS_UNSUPPORTED_AST_NODE");
            assert.equal(error.nodeType, NodeTypes.BLOCK);
            assert.deepEqual(error.location, location);
            assert.equal(
                error.diagnostics[0].code,
                "CLRS_UNSUPPORTED_AST_NODE"
            );
            assert.deepEqual(error.toJSON(), {
                name: "ASTVisitorError",
                message: "The AST visitor does not support node Block.",
                phase: "ast-visitor",
                code: "CLRS_UNSUPPORTED_AST_NODE",
                location,
                diagnostics: error.diagnostics,
                nodeType: NodeTypes.BLOCK
            });

            return true;
        }
    );
});

test("nodos, listas y handlers inválidos tienen códigos específicos", () => {
    const visitor = new LabelVisitor();

    assert.throws(
        () => visitor.visit(null),
        error =>
            error instanceof ASTVisitorError &&
            error.code === "CLRS_INVALID_AST_VISITOR_NODE"
    );

    assert.throws(
        () => visitor.visitMany(null),
        error =>
            error instanceof ASTVisitorError &&
            error.code === "CLRS_AST_VISITOR_LIST_REQUIRED"
    );

    assert.throws(
        () => visitor.registerHandlers({
            Invalido: null
        }),
        error =>
            error instanceof ASTVisitorError &&
            error.code === "CLRS_INVALID_AST_VISITOR_HANDLER" &&
            error.nodeType === "Invalido"
    );
});

test("CostAnalysisVisitor usa ASTVisitor sin cambiar el informe", () => {
    const { ast } = parseSource([
        "PRINCIPAL()",
        "    dato <- 1",
        "    escribir dato"
    ].join("\n"));
    const visitor = new CostAnalysisVisitor();
    const report = visitor.costAnalysis(ast);

    assert.ok(visitor instanceof ASTVisitor);
    assert.equal(visitor.supports(NodeTypes.ASSIGNMENT), true);
    assert.equal(visitor.supports(NodeTypes.BLOCK), false);
    assert.equal(report.statementsCost.length, 1);
    assert.equal(
        report.statementsCost[0].expression,
        "TPRINCIPAL() = c + c"
    );
    assert.deepEqual(
        report.statementsCost[0].instructions.map(node => ({
            type: node.type,
            expression: node.expression
        })),
        [
            {
                type: NodeTypes.ASSIGNMENT,
                expression: "c"
            },
            {
                type: NodeTypes.WRITE_STATEMENT,
                expression: "c"
            }
        ]
    );

    const assignment = ast.statements[0].body.statements[0];

    assert.deepEqual(
        visitor.statementType(assignment),
        visitor.visit(assignment)
    );
});

test("CostAnalysisVisitor propaga errores de visitor para nodos no soportados", () => {
    const visitor = new CostAnalysisVisitor();

    assert.throws(
        () => visitor.statementType({
            type: NodeTypes.BLOCK,
            statements: [],
            location
        }),
        error =>
            error instanceof ASTVisitorError &&
            error.code === "CLRS_UNSUPPORTED_AST_NODE" &&
            error.nodeType === NodeTypes.BLOCK
    );
});

test("costAnalysis conserva la validación histórica de la raíz", () => {
    const visitor = new CostAnalysisVisitor();

    assert.throws(
        () => visitor.costAnalysis(identifier("dato")),
        error =>
            error instanceof ComplexAnalysisError &&
            error.code === "CLRS_COST_ANALYSIS_ERROR"
    );
});

function identifier(name) {
    return {
        type: NodeTypes.IDENTIFIER,
        name,
        location
    };
}

function numberLiteral(value) {
    return {
        type: NodeTypes.NUMBER_LITERAL,
        value,
        location
    };
}
