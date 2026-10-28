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
} from "../frontend/src/visitor/DiagramContext.js";
import {
    DiagramControlFlowVisitor
} from "../frontend/src/visitor/DiagramControlFlowVisitor.js";
import {
    DiagramDeclarationVisitor
} from "../frontend/src/visitor/DiagramDeclarationVisitor.js";
import {
    DiagramExpressionVisitor
} from "../frontend/src/visitor/DiagramExpressionVisitor.js";
import {
    DiagramStatementVisitor
} from "../frontend/src/visitor/DiagramStatementVisitor.js";
import {
    DiagramVisitor
} from "../frontend/src/visitor/DiagramVisitor.js";
import {
    DIAGRAM_NODE_ROLES
} from "../frontend/src/visitor/DiagramEditableIdentity.js";
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
        coordinator.expressionVisitor
            .supports(
                NodeTypes.ARRAY_EXPRESSION
            ),
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

    const ast = parseSource("dato = 1").ast;

    assert.deepEqual(
        first.build(ast),
        second.build(ast)
    );
});

test("el coordinador conserva fachadas de instrucciones y expresiones", () => {
    const visitor = new DiagramVisitor();
    const ast = parseSource("dato = 1").ast;
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

test("el visitor representa arreglos literales anidados y sus llamadas", () => {
    const visitor = new DiagramVisitor();
    const ast = parseSource([
        "DUPLICA(valor)",
        "    retornar valor * 2",
        "PRINCIPAL()",
        "    datos = [1, [2, 3], DUPLICA(4)]"
    ].join("\n")).ast;
    const assignment =
        ast.statements[1]
            .body.statements[0];

    assert.equal(
        visitor.getExpression(
            assignment.right
        ),
        "[1, [2, 3], DUPLICA(4)]"
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

test("modela para ascendente y descendente con preparación, decisión y salida explícitas", () => {
    const source = [
        "PRINCIPAL()",
        "    para i = 0 hasta 2",
        "        escribir i",
        "    escribir \"entre ciclos\"",
        "    para j = 2 bajando 0",
        "        escribir j"
    ].join("\n");
    const first = new DiagramVisitor().build(
        parseSource(source).ast
    );
    const second = new DiagramVisitor().build(
        parseSource(source).ast
    );
    const flow = first.subgraphs.find(
        item => item.id === "function_PRINCIPAL"
    );
    const preparations = flow.nodes.filter(
        node => node.type === "preparation"
    );
    const decisions = flow.nodes.filter(
        node =>
            node.identity.role ===
            DIAGRAM_NODE_ROLES.LOOP_DECISION
    );

    assert.deepEqual(second, first);
    assert.deepEqual(
        preparations.map(node => node.label),
        [
            "Para i = 0 hasta 2",
            "Para j = 2 bajando 0"
        ]
    );
    assert.deepEqual(
        decisions.map(node => node.label),
        ["i <= 2", "j >= 0"]
    );
    assert.deepEqual(
        preparations.map(node =>
            node.identity.figure
        ),
        ["for-to", "for-downto"]
    );
    assert.ok(preparations.every(node =>
        node.identity.editable === true &&
        node.identity.role ===
            DIAGRAM_NODE_ROLES.FOR_PREPARATION
    ));
    assert.ok(decisions.every(node =>
        node.identity.editable === false
    ));

    const edges = flow.edges.map(edge => ({
        source: edge.source,
        target: edge.target,
        label: edge.label,
        relation: edge.identity.relation
    }));

    assert.deepEqual(edges, [
        edgeModel("N1", "N2", null, "entry"),
        edgeModel("N2", "N3", null, "sequence"),
        edgeModel("N3", "N4", "Sí", "loop-entry"),
        edgeModel("N3", "N5", "No", "loop-exit"),
        edgeModel("N4", "N2", null, "loop-back"),
        edgeModel("N5", "N6", null, "sequence"),
        edgeModel("N6", "N7", null, "sequence"),
        edgeModel("N7", "N8", "Sí", "loop-entry"),
        edgeModel("N7", "N9", "No", "loop-exit"),
        edgeModel("N8", "N6", null, "loop-back")
    ]);

    const loopExits = flow.edges.filter(
        edge => edge.identity.relation ===
            "loop-exit"
    );

    assert.deepEqual(
        loopExits.map(edge => edge.identity.insertion),
        [
            {
                scopeId: "function_PRINCIPAL",
                containerId: "function_PRINCIPAL/body",
                branch: "body",
                index: 1,
                position: "between"
            },
            {
                scopeId: "function_PRINCIPAL",
                containerId: "function_PRINCIPAL/body",
                branch: "body",
                index: 3,
                position: "end"
            }
        ]
    );
});

test("un retorno corta secuencias y retornos de ciclo aunque el AST conserve sentencias posteriores", () => {
    const source = [
        "CALCULAR()",
        "    retornar 1",
        "    escribir \"inalcanzable\"",
        "PRINCIPAL()",
        "    mientras VERDAD",
        "        retornar 2",
        "        escribir \"tampoco\"",
        "    escribir \"continuación falsa\""
    ].join("\n");
    const visitor = new DiagramVisitor();
    const diagram = visitor.build(
        parseSource(source).ast
    );
    const calcular = diagram.subgraphs.find(
        item => item.id === "function_CALCULAR"
    );
    const principal = diagram.subgraphs.find(
        item => item.id === "function_PRINCIPAL"
    );
    const calcularReturn = calcular.nodes.find(
        node => node.label === "Retornar 1"
    );
    const unreachable = calcular.nodes.find(
        node => node.label ===
            'Salida "inalcanzable"'
    );
    const loopReturn = principal.nodes.find(
        node => node.label === "Retornar 2"
    );

    assert.ok(calcularReturn);
    assert.ok(unreachable);
    assert.equal(
        calcular.nodes.some(node =>
            node.identity.role ===
                DIAGRAM_NODE_ROLES.FUNCTION_END
        ),
        false
    );
    assert.deepEqual(
        calcular.edges.map(edge => [
            edge.source,
            edge.target
        ]),
        [["N1", calcularReturn.id]]
    );
    assert.equal(
        visitor.diagramContext.getFunction(
            "CALCULAR"
        ).exit,
        calcularReturn.id
    );
    assert.ok(
        [...calcular.edges, ...principal.edges]
            .every(edge =>
                edge.source !== calcularReturn.id &&
                edge.source !== loopReturn.id
            )
    );

    const loopExit = principal.edges.find(
        edge => edge.identity.relation ===
            "loop-exit"
    );
    const falseContinuation =
        principal.nodes.find(node =>
            node.label ===
                'Salida "continuación falsa"'
        );

    assert.equal(loopExit.label, "No");
    assert.equal(
        loopExit.target,
        falseContinuation.id
    );
    assert.equal(
        principal.nodes.filter(node =>
            node.identity.role ===
                DIAGRAM_NODE_ROLES.FUNCTION_END
        ).length,
        1
    );
});

test("expone roles estructurales de inicios y finales sin serializarlos en Mermaid", () => {
    const diagram = new DiagramVisitor().build(
        parseSource([
            "AUX()",
            "    escribir 1",
            "PRINCIPAL()",
            "    AUX()"
        ].join("\n")).ast
    );
    const allNodes = diagram.subgraphs.flatMap(
        subgraph => subgraph.nodes
    );
    const roles = allNodes.map(node =>
        node.identity.role
    );

    assert.equal(
        roles.filter(role =>
            role === DIAGRAM_NODE_ROLES.GLOBAL_START
        ).length,
        1
    );
    assert.equal(
        roles.filter(role =>
            role === DIAGRAM_NODE_ROLES.GLOBAL_END
        ).length,
        1
    );
    assert.equal(
        roles.filter(role =>
            role === DIAGRAM_NODE_ROLES.FUNCTION_START
        ).length,
        2
    );
    assert.equal(
        roles.filter(role =>
            role === DIAGRAM_NODE_ROLES.FUNCTION_END
        ).length,
        2
    );
    assert.ok(allNodes.every(node =>
        !Object.keys(node).includes("identity")
    ));
    assert.deepEqual(
        allNodes
            .filter(node => node.identity.role)
            .map(node => node.identity.id),
        [
            "node:function_AUX/declaration",
            "node:function_AUX/end",
            "node:function_PRINCIPAL/declaration",
            "node:function_PRINCIPAL/end",
            "node:top_level/start",
            "node:top_level/end"
        ]
    );
});

test("conserva loop-exit al cerrar el ámbito o atravesar una unión condicional", () => {
    const globalDiagram = new DiagramVisitor().build(
        parseSource([
            "i = 0",
            "mientras i < 1",
            "    i = i + 1"
        ].join("\n")).ast
    );
    const globalDecision =
        globalDiagram.nodes.find(node =>
            node.identity.role ===
                DIAGRAM_NODE_ROLES.LOOP_DECISION
        );
    const globalEnd = globalDiagram.nodes.find(
        node => node.identity.role ===
            DIAGRAM_NODE_ROLES.GLOBAL_END
    );
    const globalExit = globalDiagram.edges.find(
        edge => edge.source === globalDecision.id &&
            edge.target === globalEnd.id
    );

    assert.equal(globalExit.label, "No");
    assert.equal(
        globalExit.identity.relation,
        "loop-exit"
    );
    assert.equal(
        globalExit.identity.insertion.position,
        "end"
    );

    const nestedDiagram = new DiagramVisitor().build(
        parseSource([
            "PRINCIPAL()",
            "    si VERDAD",
            "        mientras FALSO",
            "            escribir 1",
            "    escribir 2"
        ].join("\n")).ast
    );
    const flow = nestedDiagram.subgraphs.find(
        item => item.id === "function_PRINCIPAL"
    );
    const loopDecision = flow.nodes.find(node =>
        node.label === "FALSO"
    );
    const loopExit = flow.edges.find(edge =>
        edge.source === loopDecision.id &&
        edge.identity.relation === "loop-exit"
    );

    assert.equal(loopExit.label, "No");
    assert.equal(
        flow.nodes.find(node =>
            node.id === loopExit.target
        ).type,
        "merge"
    );
    assert.equal(
        flow.nodes.filter(node =>
            node.identity.role ===
                DIAGRAM_NODE_ROLES.FUNCTION_END
        ).length,
        1
    );
});

function edgeModel(
    source,
    target,
    label,
    relation
) {
    return {
        source,
        target,
        label,
        relation
    };
}
