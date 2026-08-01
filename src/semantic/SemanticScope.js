import {
    SemanticSymbol
} from "./SemanticSymbol.js";

export const SemanticScopeType = Object.freeze({
    GLOBAL: "global",
    FUNCTION: "function"
});

/**
 * Ámbito de nombres compatible con las declaraciones `var` emitidas:
 * únicamente existe un ámbito global y uno por función.
 */
export class SemanticScope {

    constructor({
        type,
        parent = null,
        node = null,
        name = null
    }) {
        this.type = type;
        this.parent = parent;
        this.node = node;
        this.name = name;
        this.symbols = new Map();
        this.children = [];

        if (parent != null) {
            parent.children.push(this);
        }
    }

    define(name, kind, node = null) {
        const existing =
            this.symbols.get(name);

        if (existing != null) {
            return existing.addDeclaration(
                kind,
                node
            );
        }

        const symbol = new SemanticSymbol({
            name,
            kind,
            scope: this,
            node
        });

        this.symbols.set(name, symbol);

        return symbol;
    }

    resolveOwn(name) {
        return this.symbols.get(name) ?? null;
    }

    resolve(name) {
        return (
            this.resolveOwn(name) ??
            this.parent?.resolve(name) ??
            null
        );
    }

    get enclosingFunction() {
        if (
            this.type ===
            SemanticScopeType.FUNCTION
        ) {
            return this;
        }

        return (
            this.parent?.enclosingFunction ??
            null
        );
    }
}
