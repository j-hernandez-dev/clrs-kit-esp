/**
 * Resultado consultable del análisis semántico.
 */
export class SemanticModel {

    constructor(context) {
        this.globalScope =
            context.globalScope;
        this.scopes =
            Object.freeze([
                ...context.scopes
            ]);
        this.references =
            Object.freeze([
                ...context.references
            ]);
        this.scopeByNode =
            context.scopeByNode;
        this.functionScopeByNode =
            context.functionScopeByNode;
        this.symbolByNode =
            context.symbolByNode;
    }

    getScope(node) {
        return (
            this.scopeByNode.get(node) ??
            null
        );
    }

    getFunctionScope(node) {
        return (
            this.functionScopeByNode
                .get(node) ??
            null
        );
    }

    getSymbol(node) {
        return (
            this.symbolByNode.get(node) ??
            null
        );
    }

    resolve(name, scope = this.globalScope) {
        return scope.resolve(name);
    }
}
