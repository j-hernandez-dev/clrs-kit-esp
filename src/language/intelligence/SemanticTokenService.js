import {
    getSemanticNavigationIndex,
    SemanticOccurrenceKind
} from "../../semantic/SemanticNavigationIndex.js";
import {
    SemanticSymbolKind
} from "../../semantic/SemanticSymbol.js";
import {
    getStandardLibraryHelp
} from "../../standard-library/StandardLibraryHelpCatalog.js";
import {
    analyzeTolerantSource
} from "./TolerantSourceAnalyzer.js";

export const SemanticTokenType =
    Object.freeze({
        FUNCTION: "function",
        VARIABLE: "variable",
        PARAMETER: "parameter"
    });

export const SemanticTokenModifier =
    Object.freeze({
        DECLARATION: "declaration",
        MODIFICATION: "modification",
        DEFAULT_LIBRARY:
            "defaultLibrary"
    });

export const CLRS_SEMANTIC_TOKEN_TYPES =
    Object.freeze([
        SemanticTokenType.FUNCTION,
        SemanticTokenType.VARIABLE,
        SemanticTokenType.PARAMETER
    ]);

export const CLRS_SEMANTIC_TOKEN_MODIFIERS =
    Object.freeze([
        SemanticTokenModifier.DECLARATION,
        SemanticTokenModifier.MODIFICATION,
        SemanticTokenModifier.DEFAULT_LIBRARY
    ]);

const LANGUAGE_WORDS = new Set([
    "si",
    "sino",
    "mientras",
    "para",
    "hasta",
    "bajando",
    "retornar",
    "leer",
    "escribir",
    "y",
    "o",
    "no",
    "VERDAD",
    "FALSO",
    "NULO"
]);
const TOKENS_BY_SNAPSHOT = new WeakMap();

/**
 * Produce tokens semánticos neutrales con ubicaciones 1-based.
 */
export class SemanticTokenService {

    getDocumentTokens(request = {}) {
        const sourceCode = String(
            request.sourceCode ?? ""
        );
        const snapshot =
            request.snapshot ?? null;
        const cached =
            snapshot != null &&
            typeof snapshot === "object"
                ? TOKENS_BY_SNAPSHOT.get(
                    snapshot
                )
                : null;

        if (cached != null) {
            return cached;
        }

        const tokens =
            snapshot?.ok &&
            snapshot.semanticModel != null
                ? createModelTokens(
                    getSemanticNavigationIndex(
                        snapshot
                    )
                )
                : createTolerantTokens(
                    sourceCode
                );

        const result = Object.freeze(
            deduplicateTokens(tokens)
                .sort(compareTokens)
        );

        if (
            snapshot != null &&
            typeof snapshot === "object"
        ) {
            TOKENS_BY_SNAPSHOT.set(
                snapshot,
                result
            );
        }

        return result;
    }
}

function createModelTokens(index) {
    const tokens = [];

    for (
        const occurrence
        of index.occurrences
    ) {
        const type =
            tokenTypeForOccurrence(
                occurrence
            );

        if (
            type == null ||
            !isSingleLineLocation(
                occurrence.location
            )
        ) {
            continue;
        }

        const modifiers = [];

        if (
            occurrence.kind ===
            SemanticOccurrenceKind
                .DEFINITION
        ) {
            modifiers.push(
                SemanticTokenModifier
                    .DECLARATION
            );
        } else if (
            occurrence.kind ===
            SemanticOccurrenceKind.WRITE
        ) {
            modifiers.push(
                SemanticTokenModifier
                    .MODIFICATION
            );
        }

        if (
            occurrence.symbolKind ===
            SemanticSymbolKind.BUILTIN
        ) {
            modifiers.push(
                SemanticTokenModifier
                    .DEFAULT_LIBRARY
            );
        }

        tokens.push(
            createToken(
                occurrence.name,
                type,
                occurrence.location,
                modifiers
            )
        );
    }

    return tokens;
}

function createTolerantTokens(sourceCode) {
    const tolerant =
        analyzeTolerantSource(
            sourceCode
        );
    const functions = new Map(
        tolerant.functions.map(
            item => [item.name, item]
        )
    );
    const globalVariables = new Map(
        tolerant.globalVariables.map(
            item => [item.name, item]
        )
    );
    const lines = sourceCode.split("\n");
    const tokens = [];

    for (
        const identifier
        of scanIdentifiers(sourceCode)
    ) {
        if (LANGUAGE_WORDS.has(identifier.name)) {
            continue;
        }

        const currentFunction =
            tolerant.findFunction(
                identifier.location
                    .startLine
            );
        const localParameter =
            findParameter(
                currentFunction,
                identifier.name
            );
        const localVariable =
            currentFunction?.variables
                .find(
                    item =>
                        item.name ===
                        identifier.name
                ) ??
            null;
        const userFunction =
            functions.get(
                identifier.name
            ) ??
            null;
        const globalVariable =
            globalVariables.get(
                identifier.name
            ) ??
            null;
        let type = null;
        const modifiers = [];

        if (
            isFunctionDeclaration(
                userFunction,
                identifier
            )
        ) {
            type = SemanticTokenType
                .FUNCTION;
            modifiers.push(
                SemanticTokenModifier
                    .DECLARATION
            );
        } else if (
            isParameterDeclaration(
                currentFunction,
                localParameter,
                identifier
            )
        ) {
            type = SemanticTokenType
                .PARAMETER;
            modifiers.push(
                SemanticTokenModifier
                    .DECLARATION
            );
        } else if (localParameter != null) {
            type = SemanticTokenType
                .PARAMETER;
            addModificationModifier(
                modifiers,
                identifier,
                lines
            );
        } else if (localVariable != null) {
            type = SemanticTokenType
                .VARIABLE;
            addAssignmentModifier(
                modifiers,
                identifier,
                localVariable,
                lines
            );
        } else if (userFunction != null) {
            type = SemanticTokenType
                .FUNCTION;
        } else if (globalVariable != null) {
            type = SemanticTokenType
                .VARIABLE;
            addAssignmentModifier(
                modifiers,
                identifier,
                globalVariable,
                lines
            );
        } else if (
            getStandardLibraryHelp(
                identifier.name
            ) != null
        ) {
            type = SemanticTokenType
                .FUNCTION;
            modifiers.push(
                SemanticTokenModifier
                    .DEFAULT_LIBRARY
            );
        }

        if (type != null) {
            tokens.push(
                createToken(
                    identifier.name,
                    type,
                    identifier.location,
                    modifiers
                )
            );
        }
    }

    return tokens;
}

function scanIdentifiers(sourceCode) {
    const tokens = [];
    const lines = String(sourceCode)
        .split("\n");

    for (
        let lineIndex = 0;
        lineIndex < lines.length;
        lineIndex += 1
    ) {
        const line = lines[lineIndex];
        let index = 0;
        let inString = false;
        let escaped = false;

        while (index < line.length) {
            const character = line[index];

            if (inString) {
                if (escaped) {
                    escaped = false;
                } else if (
                    character === "\\"
                ) {
                    escaped = true;
                } else if (
                    character === "\""
                ) {
                    inString = false;
                }

                index += 1;
                continue;
            }

            if (
                character === "/" &&
                line[index + 1] === "/"
            ) {
                break;
            }

            if (character === "\"") {
                inString = true;
                index += 1;
                continue;
            }

            if (!isIdentifierStart(character)) {
                index += 1;
                continue;
            }

            const start = index;

            index += 1;

            while (
                index < line.length &&
                isIdentifierPart(
                    line[index]
                )
            ) {
                index += 1;
            }

            const name = line.slice(
                start,
                index
            );

            tokens.push({
                name,
                location: {
                    startLine:
                        lineIndex + 1,
                    startColumn:
                        start + 1,
                    endLine:
                        lineIndex + 1,
                    endColumn: index
                }
            });
        }
    }

    return tokens;
}

function tokenTypeForOccurrence(
    occurrence
) {
    switch (occurrence.symbolKind) {
        case SemanticSymbolKind.FUNCTION:
            return SemanticTokenType
                .FUNCTION;
        case SemanticSymbolKind.PARAMETER:
            return SemanticTokenType
                .PARAMETER;
        case SemanticSymbolKind.VARIABLE:
        case SemanticSymbolKind.GLOBAL:
            return SemanticTokenType
                .VARIABLE;
        case SemanticSymbolKind.BUILTIN:
            return getStandardLibraryHelp(
                occurrence.name
            ) == null
                ? SemanticTokenType.VARIABLE
                : SemanticTokenType.FUNCTION;
        default:
            return null;
    }
}

function findParameter(
    currentFunction,
    name
) {
    return (
        currentFunction?.parameters.find(
            parameter =>
                parameter.replace(
                    /\[\]/g,
                    ""
                ) === name
        ) ??
        null
    );
}

function isFunctionDeclaration(
    functionItem,
    identifier
) {
    return (
        functionItem != null &&
        sameStart(
            functionItem
                .selectionLocation,
            identifier.location
        )
    );
}

function isParameterDeclaration(
    currentFunction,
    parameter,
    identifier
) {
    return (
        currentFunction != null &&
        parameter != null &&
        identifier.location.startLine ===
            currentFunction
                .selectionLocation
                .startLine &&
        identifier.location.startColumn >
            currentFunction
                .selectionLocation
                .endColumn
    );
}

function addAssignmentModifier(
    modifiers,
    identifier,
    declaration,
    lines
) {
    if (
        sameStart(
            identifier.location,
            declaration.location
        )
    ) {
        modifiers.push(
            SemanticTokenModifier
                .DECLARATION
        );
        return;
    }

    addModificationModifier(
        modifiers,
        identifier,
        lines
    );
}

function addModificationModifier(
    modifiers,
    identifier,
    lines
) {
    const line =
        lines[
            identifier.location.startLine -
            1
        ] ??
        "";
    const suffix = line.slice(
        identifier.location.endColumn
    );

    if (
        /^\s*(?:\[[^\]]*\]\s*)*=(?!=)/.test(
            suffix
        )
    ) {
        modifiers.push(
            SemanticTokenModifier
                .MODIFICATION
        );
    }
}

function createToken(
    name,
    type,
    location,
    modifiers
) {
    return Object.freeze({
        name,
        type,
        modifiers:
            Object.freeze([
                ...new Set(modifiers)
            ]),
        location:
            Object.freeze({
                startLine:
                    location.startLine,
                startColumn:
                    location.startColumn,
                endLine:
                    location.endLine,
                endColumn:
                    location.endColumn
            })
    });
}

function deduplicateTokens(tokens) {
    const byLocation = new Map();

    for (const token of tokens) {
        const key = [
            token.location.startLine,
            token.location.startColumn,
            token.location.endColumn
        ].join(":");

        if (!byLocation.has(key)) {
            byLocation.set(key, token);
        }
    }

    return [...byLocation.values()];
}

function compareTokens(left, right) {
    return (
        left.location.startLine -
            right.location.startLine ||
        left.location.startColumn -
            right.location.startColumn
    );
}

function sameStart(left, right) {
    return (
        left?.startLine ===
            right?.startLine &&
        left?.startColumn ===
            right?.startColumn
    );
}

function isSingleLineLocation(location) {
    return (
        Number.isFinite(
            location?.startLine
        ) &&
        Number.isFinite(
            location?.startColumn
        ) &&
        location.startLine ===
            location.endLine &&
        location.endColumn >=
            location.startColumn
    );
}

function isIdentifierStart(character) {
    return (
        typeof character === "string" &&
        /[A-Za-z_]/.test(character)
    );
}

function isIdentifierPart(character) {
    return (
        typeof character === "string" &&
        /[A-Za-z0-9_]/.test(character)
    );
}
