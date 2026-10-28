import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";

import { NodeTypes } from "../src/ast/core/NodeTypes.js";
import { validateAST } from "../src/ast/validation/ASTValidator.js";
import { parseSource, tokenizeSource } from "../src/language/LanguageFrontend.js";
import { SemanticAnalyzer } from "../src/semantic/SemanticAnalyzer.js";
import { Transpiler } from "../src/compiler/Transpiler.js";
import { JavaScriptGenerator } from "../src/compiler/JavaScriptGenerator.js";
import { CostAnalysisVisitor } from "../src/complex/CostAnalysisVisitor.js";
import { guiConstantValue } from "../src/semantic/gui/GuiSemanticAnalysis.js";
import { DiagramExpressionVisitor } from "../frontend/src/visitor/DiagramExpressionVisitor.js";
import { BreakpointExpressionCompiler } from "../extension/debug/BreakpointExpressionCompiler.js";
import { LanguageIntelligenceService } from "../src/language/intelligence/LanguageIntelligenceService.js";
import { SemanticTokenService } from "../src/language/intelligence/SemanticTokenService.js";
import { collectBrokerStaticAstEvidence } from "../src/broker95/submission/BrokerStaticEvidenceCollector.js";

const SOURCE = [
    "PRINCIPAL()",
    "    ausencia = NULO",
    "    valores = [1, NULO, [NULO]]",
    "    si ausencia == NULO",
    "        escribir NULO"
].join("\n");

test("NULO: lexer y AST reservan únicamente la forma canónica en mayúsculas", () => {
    const tokens = tokenizeSource("mayuscula = NULO\nmixta = Nulo");
    assert.deepEqual(tokens.filter(token => ["NullLiteral", "Identifier"].includes(token.tokenType.name))
        .map(token => [token.tokenType.name, token.image]), [
        ["Identifier", "mayuscula"], ["NullLiteral", "NULO"],
        ["Identifier", "mixta"], ["Identifier", "Nulo"]
    ]);
    const ast = parseSource(SOURCE).ast;
    const literal = ast.statements[0].body.statements[0].right;
    assert.equal(literal.type, NodeTypes.NULL_LITERAL);
    assert.equal(literal.value, null);
    assert.equal(validateAST(ast), ast);
    const invalid = structuredClone(ast);
    invalid.statements[0].body.statements[0].right.value = "NULO";
    assert.throws(() => validateAST(invalid), error =>
        error.diagnostics?.[0]?.code === "CLRS_AST_INVALID_NULL");
});

test("NULO: semántica, JavaScript, GUI y depuración conservan el valor null", () => {
    const ast = parseSource(SOURCE).ast;
    const model = new SemanticAnalyzer().analyze(ast);
    const statements = ast.statements[0].body.statements;
    const literal = statements[0].right;
    const array = statements[1].right;
    const transpiler = new Transpiler("nulo.clrs", false);
    assert.equal(transpiler.getExpression(literal), "null");
    assert.equal(transpiler.getExpression(array), "[1, null, [null]]");
    const generated = new JavaScriptGenerator().generate(ast).generatedCode;
    const execution = spawnSync(process.execPath, ["--input-type=module"], {
        input: generated,
        encoding: "utf8",
        timeout: 5000,
        windowsHide: true
    });
    assert.equal(execution.status, 0, execution.stderr);
    assert.equal(execution.stdout.trim(), "null");
    assert.deepEqual(guiConstantValue(literal), { known: true, value: null });
    const breakpoint = new BreakpointExpressionCompiler().compileBreakpoint({ condition: "dato == NULO" });
    assert.equal(breakpoint.ok, true);
    assert.equal(breakpoint.value.condition.right.type, NodeTypes.NULL_LITERAL);
    assert.equal(breakpoint.value.condition.right.value, null);
    assert.doesNotThrow(() => new CostAnalysisVisitor().costAnalysis(ast));
    assert.doesNotThrow(() => collectBrokerStaticAstEvidence(ast, model));
});

test("NULO: diagramador y características del editor muestran la grafía pública", async () => {
    const literal = parseSource("dato = NULO").ast.statements[0].right;
    assert.equal(new DiagramExpressionVisitor().visit(literal), "NULO");
    const completions = new LanguageIntelligenceService().getCompletions({
        sourceCode: "dato = ", position: { line: 1, column: 8 }
    });
    const completion = completions.find(item => item.label === "NULO");
    assert.equal(completion?.detail, "palabra del lenguaje");
    const semanticTokens = new SemanticTokenService().getDocumentTokens({ sourceCode: "dato = NULO" });
    assert.equal(semanticTokens.some(token => token.text === "NULO"), false);
    const grammar = JSON.parse(await readFile(new URL("../extension/syntaxes/clrs.tmLanguage.json", import.meta.url)));
    assert.ok(grammar.patterns.some(pattern => pattern.include === "#null"));
    assert.equal(grammar.repository.null.patterns[0].match, "\\bNULO\\b");
});
