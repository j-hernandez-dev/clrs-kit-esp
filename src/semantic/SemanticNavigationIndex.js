import {
    SemanticSymbolKind
} from "./SemanticSymbol.js";

export const SemanticOccurrenceKind =
    Object.freeze({
        DEFINITION: "definition",
        WRITE: "write",
        REFERENCE: "reference"
    });

const INDEX_STATE = new WeakMap();
const INDEX_BY_SNAPSHOT = new WeakMap();

/**
 * Índice neutral de navegación construido a partir del modelo semántico.
 * Todas las posiciones permanecen en el formato 1-based del AST.
 */
export class SemanticNavigationIndex {

    constructor(semanticModel = null) {
        const state =
            buildIndex(semanticModel);

        this.semanticModel =
            semanticModel;
        this.symbols =
            Object.freeze(state.symbols);
        this.occurrences =
            Object.freeze(state.occurrences);
        this.documentSymbols =
            Object.freeze(
                state.documentSymbols
            );

        INDEX_STATE.set(this, {
            definitionBySymbol:
                state.definitionBySymbol,
            occurrencesBySymbol:
                state.occurrencesBySymbol
        });

        Object.freeze(this);
    }

    findOccurrence(position) {
        if (!isValidPosition(position)) {
            return null;
        }

        let selected = null;

        for (
            const occurrence
            of this.occurrences
        ) {
            if (
                !containsPosition(
                    occurrence.location,
                    position
                )
            ) {
                continue;
            }

            if (
                selected == null ||
                locationSize(
                    occurrence.location
                ) <
                locationSize(
                    selected.location
                )
            ) {
                selected = occurrence;
            }
        }

        return selected;
    }

    findSymbol(position) {
        return (
            this.findOccurrence(position)
                ?.symbol ??
            null
        );
    }

    getDefinition(symbol) {
        return (
            INDEX_STATE.get(this)
                .definitionBySymbol
                .get(symbol) ??
            null
        );
    }

    getDefinitionAt(position) {
        const symbol =
            this.findSymbol(position);

        return symbol == null
            ? null
            : this.getDefinition(symbol);
    }

    getReferences(
        symbol,
        options = {}
    ) {
        const includeDefinition =
            options.includeDefinition ??
            false;
        const occurrences =
            INDEX_STATE.get(this)
                .occurrencesBySymbol
                .get(symbol) ??
            [];

        return Object.freeze(
            occurrences.filter(
                occurrence =>
                    includeDefinition ||
                    occurrence.kind !==
                        SemanticOccurrenceKind
                            .DEFINITION
            )
        );
    }

    getReferencesAt(
        position,
        options = {}
    ) {
        const symbol =
            this.findSymbol(position);

        return symbol == null
            ? Object.freeze([])
            : this.getReferences(
                symbol,
                options
            );
    }
}

/**
 * Reutiliza un único índice por snapshot documental.
 */
export function getSemanticNavigationIndex(
    snapshot
) {
    if (
        snapshot == null ||
        typeof snapshot !== "object"
    ) {
        return new SemanticNavigationIndex();
    }

    const cached =
        INDEX_BY_SNAPSHOT.get(snapshot);

    if (cached != null) {
        return cached;
    }

    const index =
        new SemanticNavigationIndex(
            snapshot.semanticModel
        );

    INDEX_BY_SNAPSHOT.set(
        snapshot,
        index
    );

    return index;
}

function buildIndex(semanticModel) {
    const symbols =
        collectSymbols(semanticModel);
    const occurrences = [];
    const definitionBySymbol =
        new Map();
    const occurrencesBySymbol =
        new Map();

    for (const symbol of symbols) {
        const declarations =
            sortDeclarations(
                symbol.declarations
            );
        const primary =
            selectPrimaryDeclaration(
                symbol,
                declarations
            );
        const symbolOccurrences = [];

        for (
            const declaration
            of declarations
        ) {
            const occurrence =
                createOccurrence({
                    symbol,
                    node:
                        declaration.node,
                    kind:
                        declaration === primary
                            ? SemanticOccurrenceKind
                                .DEFINITION
                            : SemanticOccurrenceKind
                                .WRITE
                });

            if (occurrence == null) {
                continue;
            }

            if (declaration === primary) {
                definitionBySymbol.set(
                    symbol,
                    occurrence
                );
            }

            symbolOccurrences.push(
                occurrence
            );
            occurrences.push(occurrence);
        }

        occurrencesBySymbol.set(
            symbol,
            symbolOccurrences
        );
    }

    for (
        const reference
        of semanticModel?.references ?? []
    ) {
        const occurrence =
            createOccurrence({
                symbol:
                    reference.symbol,
                node:
                    reference.node,
                kind:
                    SemanticOccurrenceKind
                        .REFERENCE
            });

        if (occurrence == null) {
            continue;
        }

        const symbolOccurrences =
            occurrencesBySymbol.get(
                reference.symbol
            ) ?? [];

        if (
            !symbolOccurrences.some(
                item =>
                    item.node ===
                    occurrence.node
            )
        ) {
            symbolOccurrences.push(
                occurrence
            );
            occurrences.push(occurrence);
        }

        occurrencesBySymbol.set(
            reference.symbol,
            symbolOccurrences
        );
    }

    occurrences.sort(
        compareOccurrences
    );

    for (
        const [
            symbol,
            symbolOccurrences
        ]
        of occurrencesBySymbol
    ) {
        occurrencesBySymbol.set(
            symbol,
            Object.freeze(
                [...symbolOccurrences]
                    .sort(
                        compareOccurrences
                    )
            )
        );
    }

    return {
        symbols,
        occurrences,
        definitionBySymbol,
        occurrencesBySymbol,
        documentSymbols:
            buildDocumentSymbols(
                semanticModel,
                definitionBySymbol
            )
    };
}

function collectSymbols(semanticModel) {
    const symbols = [];
    const visited = new Set();

    for (
        const scope
        of semanticModel?.scopes ?? []
    ) {
        for (
            const symbol
            of scope.symbols.values()
        ) {
            if (visited.has(symbol)) {
                continue;
            }

            visited.add(symbol);
            symbols.push(symbol);
        }
    }

    return symbols;
}

function sortDeclarations(declarations) {
    return [...(declarations ?? [])]
        .filter(
            declaration =>
                declaration?.node != null &&
                normalizeLocation(
                    declaration.node
                        .location
                ) != null
        )
        .sort(
            (left, right) =>
                compareLocations(
                    left.node.location,
                    right.node.location
                )
        );
}

function selectPrimaryDeclaration(
    symbol,
    declarations
) {
    const effectiveKind =
        getEffectiveSymbolKind(symbol);
    const preferred =
        declarations.find(
            declaration =>
                declaration.kind ===
                effectiveKind
        );

    return (
        preferred ??
        declarations[0] ??
        null
    );
}

function createOccurrence({
    symbol,
    node,
    kind
}) {
    const location =
        normalizeLocation(
            node?.location
        );

    if (
        symbol == null ||
        location == null
    ) {
        return null;
    }

    return Object.freeze({
        name: symbol.name,
        symbol,
        symbolKind:
            getEffectiveSymbolKind(
                symbol
            ),
        kind,
        node,
        location
    });
}

function buildDocumentSymbols(
    semanticModel,
    definitionBySymbol
) {
    if (semanticModel?.globalScope == null) {
        return [];
    }

    return buildScopeSymbols(
        semanticModel.globalScope,
        semanticModel,
        definitionBySymbol
    );
}

function buildScopeSymbols(
    scope,
    semanticModel,
    definitionBySymbol
) {
    const result = [];

    for (
        const symbol
        of scope.symbols.values()
    ) {
        const definition =
            definitionBySymbol.get(symbol);

        if (definition == null) {
            continue;
        }

        const kind =
            getEffectiveSymbolKind(symbol);
        const functionScope =
            kind ===
            SemanticSymbolKind.FUNCTION
                ? findFunctionScope(
                    scope,
                    semanticModel,
                    symbol
                )
                : null;
        const functionNode =
            functionScope?.node ?? null;
        const fullLocation =
            createFunctionLocation(
                functionNode,
                definition.location
            ) ??
            definition.location;
        const children =
            functionScope == null
                ? []
                : buildScopeSymbols(
                    functionScope,
                    semanticModel,
                    definitionBySymbol
                );

        result.push(
            Object.freeze({
                name: symbol.name,
                detail:
                    createSymbolDetail(
                        kind,
                        functionNode
                    ),
                kind,
                symbol,
                location:
                    fullLocation,
                selectionLocation:
                    definition.location,
                children:
                    Object.freeze(
                        children
                    )
            })
        );
    }

    return result.sort(
        (left, right) =>
            compareLocations(
                left.selectionLocation,
                right.selectionLocation
            )
    );
}

function createFunctionLocation(
    functionNode,
    definitionLocation
) {
    if (functionNode == null) {
        return null;
    }

    const statements =
        functionNode.body?.statements ??
        [];
    const lastStatement =
        statements[statements.length - 1];
    const endLocation =
        normalizeLocation(
            lastStatement?.location
        ) ??
        normalizeLocation(
            functionNode.location
        );

    if (endLocation == null) {
        return null;
    }

    return Object.freeze({
        startLine:
            definitionLocation.startLine,
        startColumn:
            definitionLocation.startColumn,
        endLine:
            endLocation.endLine,
        endColumn:
            endLocation.endColumn
    });
}

function findFunctionScope(
    parentScope,
    semanticModel,
    symbol
) {
    return (
        parentScope.children.find(
            child =>
                semanticModel.getSymbol(
                    child.node
                ) === symbol
        ) ??
        null
    );
}

function createSymbolDetail(
    kind,
    functionNode
) {
    switch (kind) {
        case SemanticSymbolKind.FUNCTION:
            return (
                "(" +
                (functionNode
                    ?.parameters ?? [])
                    .map(formatParameter)
                    .join(", ") +
                ")"
            );
        case SemanticSymbolKind.PARAMETER:
            return "parámetro";
        case SemanticSymbolKind.VARIABLE:
            return "variable implícita";
        default:
            return "";
    }
}

function formatParameter(parameter) {
    const dimensions =
        parameter?.dimensions?.length ??
        0;

    return (
        parameter?.identifier?.name ??
        "?"
    ) + "[]".repeat(dimensions);
}

function getEffectiveSymbolKind(symbol) {
    if (
        symbol?.hasKind?.(
            SemanticSymbolKind.FUNCTION
        )
    ) {
        return SemanticSymbolKind.FUNCTION;
    }

    if (
        symbol?.hasKind?.(
            SemanticSymbolKind.PARAMETER
        )
    ) {
        return SemanticSymbolKind.PARAMETER;
    }

    if (
        symbol?.hasKind?.(
            SemanticSymbolKind.VARIABLE
        )
    ) {
        return SemanticSymbolKind.VARIABLE;
    }

    return (
        symbol?.kind ??
        SemanticSymbolKind.GLOBAL
    );
}

function normalizeLocation(location) {
    if (
        !Number.isFinite(
            location?.startLine
        ) ||
        !Number.isFinite(
            location?.startColumn
        ) ||
        !Number.isFinite(
            location?.endLine
        ) ||
        !Number.isFinite(
            location?.endColumn
        )
    ) {
        return null;
    }

    return Object.freeze({
        startLine:
            location.startLine,
        startColumn:
            location.startColumn,
        endLine:
            location.endLine,
        endColumn:
            location.endColumn
    });
}

function isValidPosition(position) {
    return (
        Number.isFinite(position?.line) &&
        Number.isFinite(position?.column)
    );
}

function containsPosition(
    location,
    position
) {
    if (
        position.line <
            location.startLine ||
        position.line >
            location.endLine
    ) {
        return false;
    }

    if (
        position.line ===
            location.startLine &&
        position.column <
            location.startColumn
    ) {
        return false;
    }

    if (
        position.line ===
            location.endLine &&
        position.column >
            location.endColumn
    ) {
        return false;
    }

    return true;
}

function locationSize(location) {
    return (
        (
            location.endLine -
            location.startLine
        ) *
        1_000_000 +
        (
            location.endColumn -
            location.startColumn
        )
    );
}

function compareOccurrences(
    left,
    right
) {
    return compareLocations(
        left.location,
        right.location
    );
}

function compareLocations(
    left,
    right
) {
    return (
        left.startLine -
            right.startLine ||
        left.startColumn -
            right.startColumn ||
        left.endLine -
            right.endLine ||
        left.endColumn -
            right.endColumn
    );
}
