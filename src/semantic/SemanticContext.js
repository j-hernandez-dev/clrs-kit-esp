import {
    SemanticScope,
    SemanticScopeType
} from "./SemanticScope.js";
import {
    SemanticSymbolKind
} from "./SemanticSymbol.js";

/**
 * Estado compartido por las dos pasadas del análisis.
 */
export class SemanticContext {

    constructor(ast, globalNames = []) {
        this.globalScope = new SemanticScope({
            type: SemanticScopeType.GLOBAL,
            node: ast,
            name: "<programa>"
        });
        this.currentScope = this.globalScope;
        this.scopes = [this.globalScope];
        this.scopeByNode = new WeakMap();
        this.functionScopeByNode =
            new WeakMap();
        this.symbolByNode = new WeakMap();
        this.references = [];
        this.errors = [];

        this.recordScope(ast);

        for (const name of globalNames) {
            this.globalScope.define(
                name,
                SemanticSymbolKind.BUILTIN
            );
        }
    }

    recordScope(node, scope = this.currentScope) {
        if (
            node != null &&
            typeof node === "object"
        ) {
            this.scopeByNode.set(node, scope);
        }

        return scope;
    }

    bind(node, symbol, reference = false) {
        if (
            node != null &&
            typeof node === "object"
        ) {
            this.symbolByNode.set(node, symbol);

            if (reference) {
                this.references.push({
                    node,
                    symbol,
                    scope: this.currentScope
                });
            }
        }

        return symbol;
    }

    define(name, kind, node = null) {
        return this.currentScope.define(
            name,
            kind,
            node
        );
    }

    createFunctionScope(node) {
        const existing =
            this.functionScopeByNode.get(node);

        if (existing != null) {
            return existing;
        }

        const scope = new SemanticScope({
            type: SemanticScopeType.FUNCTION,
            parent: this.currentScope,
            node,
            name:
                node?.identifier?.name ??
                "<función>"
        });

        this.scopes.push(scope);
        this.functionScopeByNode.set(
            node,
            scope
        );

        return scope;
    }

    getFunctionScope(node) {
        return (
            this.functionScopeByNode.get(node) ??
            null
        );
    }

    withScope(scope, operation) {
        const previous = this.currentScope;

        this.currentScope = scope;

        try {
            return operation();
        } finally {
            this.currentScope = previous;
        }
    }

    report(error) {
        this.errors.push(error);

        return error;
    }
}
