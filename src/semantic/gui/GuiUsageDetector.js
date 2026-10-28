import { NodeTypes } from "../../ast/core/NodeTypes.js";
import { SemanticSymbolKind } from "../SemanticSymbol.js";
import { getStandardLibraryContract } from "../../standard-library/StandardLibraryContracts.js";

export function resolvedGuiDefinition(node, model) {
    if (node?.type !== NodeTypes.FUNCTION_CALL) { return null; }
    return resolvedGuiIdentifierDefinition(node.identifier, model);
}

export function resolvedGuiIdentifierDefinition(identifier, model) {
    const symbol = model.getSymbol(identifier);
    if (!symbol?.hasKind(SemanticSymbolKind.BUILTIN) || symbol.declarations.length !== 0) { return null; }
    const definition = getStandardLibraryContract(symbol.name);
    return definition?.requiresGui ? definition : null;
}

/** Recorre el AST existente, incluidas ramas/arreglos; nunca inspecciona texto fuente. */
export function walkGuiAst(value, visit, owner = null, parent = null) {
    if (!value || typeof value !== "object") { return; }
    if (Array.isArray(value)) {
        value.forEach(child => walkGuiAst(child, visit, owner, parent));
        return;
    }
    if (value.type) { visit(value, owner, parent); }
    const childOwner = value.type === NodeTypes.FUNCTION_DECLARATION ? value : owner;
    for (const [key, child] of Object.entries(value)) {
        if (key !== "location") { walkGuiAst(child, visit, childOwner, value); }
    }
}

export function detectGuiUsage(ast, semanticModel) {
    const calls = [];
    walkGuiAst(ast, node => {
        const definition = resolvedGuiDefinition(node, semanticModel);
        if (definition) { calls.push(Object.freeze({ node, definition })); }
    });
    return Object.freeze({ requiresGui: calls.length > 0,
        capabilities: Object.freeze([...new Set(calls.flatMap(call => call.definition.capabilities ?? ["gui"]))]),
        functionNames: Object.freeze([...new Set(calls.map(call => call.definition.name))]),
        calls: Object.freeze(calls) });
}
