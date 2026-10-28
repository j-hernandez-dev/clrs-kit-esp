export const SemanticSymbolKind = Object.freeze({
    VARIABLE: "variable",
    FUNCTION: "function",
    PARAMETER: "parameter",
    BUILTIN: "builtin",
    GLOBAL: "global"
});

/**
 * Representa un único binding de JavaScript. Las redeclaraciones con `var`
 * agregan orígenes al mismo símbolo en lugar de crear un símbolo nuevo.
 */
export class SemanticSymbol {

    constructor({
        name,
        kind,
        scope,
        node = null
    }) {
        this.name = name;
        this.kind = kind;
        this.scope = scope;
        this.kinds = new Set();
        this.declarations = [];

        this.addDeclaration(kind, node);
    }

    addDeclaration(kind, node = null) {
        this.kinds.add(kind);

        if (node != null) {
            this.declarations.push({
                kind,
                node
            });
        }

        return this;
    }

    hasKind(kind) {
        return this.kinds.has(kind);
    }
}
