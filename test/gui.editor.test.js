import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GUI_FUNCTION_DEFINITIONS } from "../src/standard-library/gui/GuiFunctionCatalog.js";
import { GUI_EDITOR_HELP, GUI_TEXTMATE_PATTERN, createGuiSnippets } from "../src/standard-library/gui/GuiEditorCatalog.js";
import { LanguageIntelligenceService } from "../src/language/intelligence/LanguageIntelligenceService.js";
import { SemanticTokenService } from "../src/language/intelligence/SemanticTokenService.js";
import { getSemanticNavigationIndex } from "../src/semantic/SemanticNavigationIndex.js";
import { SemanticAnalyzer } from "../src/semantic/SemanticAnalyzer.js";
import { parseSource } from "../src/language/LanguageFrontend.js";
import { CLRSLanguageIntelligenceProvider } from "../extension/providers/LanguageIntelligenceProvider.js";

const service = new LanguageIntelligenceService();
const snapshot = source => { const ast = parseSource(source).ast; return { ok: true, ast, semanticModel: new SemanticAnalyzer().analyze(ast) }; };
const source = ['CAMBIO(id, texto)', '    escribir texto', 'PRINCIPAL()', '    ENTRADA("e")', '    CONECTAR("e", "cambio", CAMBIO)'].join("\n");

test("GUI editor: todas las firmas, tipos y parámetros se proyectan desde el catálogo", () => {
    const completions = service.getCompletions({ sourceCode: "PRINCIPAL()\n    ", position: { line: 2, column: 5 } });
    for (const [name, definition] of Object.entries(GUI_FUNCTION_DEFINITIONS)) {
        const help = GUI_EDITOR_HELP[name], completion = completions.find(item => item.label === name);
        assert.equal(help.signature, definition.signature);
        assert.equal(completion.parameters.length, definition.parameters.length);
        assert.match(completion.detail, new RegExp("^" + name + "\\("));
        assert.doesNotMatch(completion.documentation, /undefined|Costo declarado|O\(1\)/);
        const call = name + "(";
        const signature = service.getSignatureHelp({ sourceCode: call, position: { line: 1, column: call.length + 1 } });
        assert.equal(signature.label, definition.signature);
        assert.ok(signature.parameters.every(p => p.documentation && !p.documentation.includes("undefined")));
    }
    assert.equal(completions.some(c => c.label === "VIDEO"), false);
    assert.match(GUI_EDITOR_HELP.ABRIR_ARCHIVO.returnLabel, /Cadena o NULO/);
    assert.match(GUI_EDITOR_HELP.OBTENER.returnLabel, /tipo de la propiedad/);
});

test("GUI editor: hover incluye propiedades y eventos públicos sin inventar objetos nativos", () => {
    const hover = service.getHover({ sourceCode: source, snapshot: snapshot(source), position: { line: 4, column: 7 } });
    assert.match(hover.signature, /^ENTRADA/);
    assert.match(hover.documentation, /\*\*texto\*\*/);
    assert.match(hover.documentation, /cambio\(id, texto\)/);
    assert.match(hover.documentation, /respuesta inmediata/);
    assert.doesNotMatch(hover.documentation, /GObject|GtkEntry|VIDEO|GStreamer/);
    const hints = service.getInlayHints({ sourceCode: source });
    assert.deepEqual(hints.filter(h => h.functionName === "CONECTAR").map(h => h.parameterName), ["componente", "evento", "FUNCION"]);
});

test("GUI editor: tokens, navegación y referencias mantienen la identidad del callback", () => {
    const analysis = snapshot(source), tokens = new SemanticTokenService().getDocumentTokens({ sourceCode: source, snapshot: analysis });
    assert.ok(tokens.some(t => t.name === "ENTRADA" && t.modifiers.includes("defaultLibrary")));
    const position = { line: 5, column: source.split("\n")[4].indexOf("CAMBIO") + 1 };
    const index = getSemanticNavigationIndex(analysis);
    assert.equal(index.getDefinitionAt(position).location.startLine, 1);
    const callbackToken = tokens.find(t => t.name === "CAMBIO" && t.location.startLine === 5);
    assert.equal(callbackToken.type, "function");
    assert.equal(callbackToken.modifiers.includes("defaultLibrary"), false);
    const incomplete = source + '\n    BOTON("b",';
    assert.ok(new SemanticTokenService().getDocumentTokens({ sourceCode: incomplete }).some(t => t.name === "BOTON" && t.modifiers.includes("defaultLibrary")));
});

test("GUI editor: CONECTAR completa una referencia sin paréntesis y respeta funciones homónimas", () => {
    const incomplete = source.slice(0, source.lastIndexOf("CAMBIO"));
    const position = { line: 5, column: incomplete.split("\n")[4].length + 1 };
    const completions = service.getCompletions({ sourceCode: incomplete, position });
    assert.ok(completions.find(c => c.label === "CAMBIO").insertAsReference);
    assert.equal(completions.some(c => c.label === "BOTON"), false);
    const item = CLRSLanguageIntelligenceProvider.prototype.createCompletionItem.call({ vscode: {
        CompletionItem: class { constructor(label) { this.label = label; } }, MarkdownString: class {}, CompletionItemKind: { Function: 3 }
    } }, completions.find(c => c.label === "CAMBIO"));
    assert.equal(item.insertText, undefined, "El editor inserta sólo el identificador por defecto");
    const local = 'BOTON(valor)\n    retornar valor\nPRINCIPAL()\n    BOTON(1)';
    const hover = service.getHover({ sourceCode: local, snapshot: snapshot(local), position: { line: 4, column: 6 } });
    assert.equal(hover.signature, "BOTON(valor)");
    assert.doesNotMatch(hover.documentation, /Propiedades|Crea un botón/);
});

test("GUI editor: snippets y gramática publican exactamente las 61 funciones canónicas", () => {
    const read = file => JSON.parse(readFileSync(new URL("../" + file, import.meta.url), "utf8"));
    const snippets = read("extension/snippets/clrs-gui.code-snippets");
    assert.deepEqual(snippets, createGuiSnippets());
    assert.equal(Object.keys(snippets).length, 61);
    const prefixes = Object.values(snippets).map(s => s.prefix);
    assert.equal(new Set(prefixes).size, prefixes.length);
    const grammar = read("extension/syntaxes/clrs.tmLanguage.json");
    assert.ok(grammar.repository.stdlib.patterns.some(rule => rule.match === GUI_TEXTMATE_PATTERN));
    const pattern = new RegExp(GUI_TEXTMATE_PATTERN);
    for (const name of Object.keys(GUI_FUNCTION_DEFINITIONS)) { assert.ok(pattern.test(name + "(")); assert.ok(!pattern.test("X" + name + "(")); }
    assert.equal(pattern.test("VIDEO("), false);
    for (const rule of grammar.repository.functions.patterns) { assert.ok(rule.patterns.some(p => p.include === "#stdlib")); }
    assert.ok(read("package.json").contributes.snippets.some(s => s.path.endsWith("clrs-gui.code-snippets")));
});
