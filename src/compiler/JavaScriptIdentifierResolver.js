import {
    SemanticSymbolKind
} from "../semantic/SemanticSymbol.js";
import {
    TranspilerError
} from "../errors/TranspilerError.js";

const ROLE_CODES = Object.freeze({
    [SemanticSymbolKind.FUNCTION]: "f",
    [SemanticSymbolKind.PARAMETER]: "p",
    [SemanticSymbolKind.VARIABLE]: "v",
    [SemanticSymbolKind.GLOBAL]: "g"
});

/**
 * Resolvedor neutro utilizado por las fachadas de bajo nivel de los visitors.
 * Permite inspeccionar nodos aislados sin exigir un modelo semántico completo.
 */
export const IDENTITY_JAVASCRIPT_IDENTIFIER_RESOLVER =
    Object.freeze({
        resolve(identifier) {
            return publicIdentifierName(identifier);
        }
    });

/**
 * Proyecta los símbolos definidos por el usuario a un espacio de nombres que
 * no puede escribirse desde CLRS. El AST y el modelo semántico conservan en
 * todo momento el identificador público original.
 */
export class JavaScriptIdentifierResolver {

    constructor(semanticModel) {
        if (
            semanticModel == null ||
            typeof semanticModel.getSymbol !== "function" ||
            !Array.isArray(semanticModel.scopes)
        ) {
            throw new TranspilerError(
                "A semantic model is required to resolve JavaScript identifiers."
            );
        }

        this.semanticModel = semanticModel;
        this.scopeIds = new WeakMap();
        this.emittedNames = new WeakMap();

        semanticModel.scopes.forEach(
            (scope, index) => {
                this.scopeIds.set(scope, index);
            }
        );
    }

    resolve(identifier) {
        const publicName =
            publicIdentifierName(identifier);

        if (
            identifier == null ||
            typeof identifier !== "object"
        ) {
            return publicName;
        }

        const symbol =
            this.semanticModel.getSymbol(
                identifier
            );

        if (!isUserBinding(symbol)) {
            return publicName;
        }

        const existing =
            this.emittedNames.get(symbol);

        if (existing != null) {
            return existing;
        }

        const emitted = this.createName(symbol);

        this.emittedNames.set(symbol, emitted);

        return emitted;
    }

    createName(symbol) {
        const scopeId =
            this.scopeIds.get(symbol.scope);

        if (!Number.isInteger(scopeId)) {
            throw new TranspilerError(
                `The semantic scope for '${symbol.name}' is not registered.`
            );
        }

        return (
            "$clrs$" +
            scopeId.toString(36) +
            "$" +
            symbolRole(symbol) +
            "$" +
            encodeIdentifier(symbol.name)
        );
    }
}

export function normalizeJavaScriptIdentifierResolver(
    resolver
) {
    if (resolver == null) {
        return IDENTITY_JAVASCRIPT_IDENTIFIER_RESOLVER;
    }

    if (typeof resolver.resolve !== "function") {
        throw new TranspilerError(
            "The JavaScript identifier resolver must provide resolve(identifier)."
        );
    }

    return resolver;
}

function isUserBinding(symbol) {
    return (
        symbol != null &&
        Array.isArray(symbol.declarations) &&
        symbol.declarations.length > 0
    );
}

function symbolRole(symbol) {
    const preference = [
        SemanticSymbolKind.FUNCTION,
        SemanticSymbolKind.PARAMETER,
        SemanticSymbolKind.VARIABLE,
        SemanticSymbolKind.GLOBAL
    ];

    for (const kind of preference) {
        if (symbol.hasKind(kind)) {
            return ROLE_CODES[kind];
        }
    }

    return "u";
}

function encodeIdentifier(name) {
    return [...String(name)]
        .map(character =>
            character
                .codePointAt(0)
                .toString(16)
                .padStart(2, "0")
        )
        .join("");
}

function publicIdentifierName(identifier) {
    if (typeof identifier === "string") {
        return identifier;
    }

    if (
        typeof identifier?.name !== "string" ||
        identifier.name.length === 0
    ) {
        throw new TranspilerError(
            "A non-empty identifier is required."
        );
    }

    return identifier.name;
}
