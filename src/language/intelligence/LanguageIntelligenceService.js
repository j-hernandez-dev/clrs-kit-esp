import {
    getSemanticNavigationIndex
} from "../../semantic/SemanticNavigationIndex.js";
import {
    SemanticSymbolKind
} from "../../semantic/SemanticSymbol.js";
import {
    StandardLibraryCost,
    StandardLibraryReturnType
} from "../../standard-library/StandardLibraryCatalog.js";
import {
    CLRS_STANDARD_LIBRARY_HELP,
    getStandardLibraryHelp
} from "../../standard-library/StandardLibraryHelpCatalog.js";
import {
    analyzeTolerantSource,
    findCallContext,
    findFunctionCalls,
    findWordAtPosition
} from "./TolerantSourceAnalyzer.js";

export const LanguageCompletionKind =
    Object.freeze({
        FUNCTION: "function",
        VARIABLE: "variable",
        PARAMETER: "parameter",
        KEYWORD: "keyword"
    });

const LANGUAGE_WORDS = Object.freeze([
    keyword("si", "Inicia una estructura condicional."),
    keyword("sino", "Inicia una rama alternativa."),
    keyword("mientras", "Inicia un ciclo condicional."),
    keyword("para", "Inicia un ciclo controlado por una variable."),
    keyword("hasta", "Indica el límite ascendente de un ciclo para."),
    keyword("bajando", "Indica el límite descendente de un ciclo para."),
    keyword("retornar", "Devuelve un valor desde una función."),
    keyword("leer", "Lee un valor desde la entrada estándar."),
    keyword("escribir", "Escribe valores en la salida estándar."),
    keyword("y", "Operador lógico de conjunción."),
    keyword("o", "Operador lógico de disyunción."),
    keyword("no", "Operador lógico de negación."),
    keyword("VERDAD", "Valor lógico verdadero."),
    keyword("FALSO", "Valor lógico falso."),
    keyword("NULO", "Representa la ausencia de un valor.")
]);

/**
 * Fachada neutral para características de asistencia del editor.
 */
export class LanguageIntelligenceService {

    getCompletions(request = {}) {
        const sourceCode =
            String(
                request.sourceCode ??
                ""
            );
        const position =
            normalizePosition(
                request.position
            );
        const snapshot =
            request.snapshot ?? null;
        const tolerant =
            analyzeTolerantSource(
                sourceCode
            );
        const completions = new Map();

        if (
            snapshot?.ok &&
            snapshot.semanticModel != null
        ) {
            addSemanticCompletions(
                completions,
                getSemanticNavigationIndex(
                    snapshot
                ),
                position,
                tolerant
            );
        } else {
            addTolerantCompletions(
                completions,
                tolerant,
                position
            );
        }

        for (
            const help
            of Object.values(
                CLRS_STANDARD_LIBRARY_HELP
            )
        ) {
            addCompletion(
                completions,
                createStandardCompletion(
                    help
                )
            );
        }

        for (const item of LANGUAGE_WORDS) {
            addCompletion(
                completions,
                item
            );
        }

        const call = findCallContext(sourceCode, position);
        const callbackPosition = call?.name === "CONECTAR" && call.activeParameter === 2 &&
            !tolerant.functions.some(fn => fn.name === "CONECTAR");
        return Object.freeze(
            [...completions.values()].filter(item => !callbackPosition ||
                (item.kind === LanguageCompletionKind.FUNCTION && item.priority < 2)).map(item => callbackPosition
                ? Object.freeze({ ...item, insertAsReference: true }) : item)
                .sort(compareCompletions)
        );
    }

    getHover(request = {}) {
        const sourceCode =
            String(
                request.sourceCode ??
                ""
            );
        const position =
            normalizePosition(
                request.position
            );
        const word =
            findWordAtPosition(
                sourceCode,
                position
            );

        if (word == null) {
            return null;
        }

        const snapshot =
            request.snapshot ?? null;

        if (
            snapshot?.ok &&
            snapshot.semanticModel != null
        ) {
            const semanticHover =
                createSemanticHover(
                    getSemanticNavigationIndex(
                        snapshot
                    ),
                    word
                );

            if (semanticHover != null) {
                return semanticHover;
            }
        }

        const tolerantHover =
            createTolerantHover(
                analyzeTolerantSource(
                    sourceCode
                ),
                position,
                word
            );

        if (tolerantHover != null) {
            return tolerantHover;
        }

        const standardHelp =
            getStandardLibraryHelp(
                word.value
            );

        if (standardHelp != null) {
            return createHover(
                standardHelp.signature,
                formatStandardDocumentation(
                    standardHelp
                ),
                word.location
            );
        }

        const languageWord =
            LANGUAGE_WORDS.find(
                item =>
                    item.label ===
                    word.value
            );

        return languageWord == null
            ? null
            : createHover(
                languageWord.label,
                languageWord.documentation,
                word.location
            );
    }

    getSignatureHelp(request = {}) {
        const sourceCode =
            String(
                request.sourceCode ??
                ""
            );
        const position =
            normalizePosition(
                request.position
            );
        const call =
            findCallContext(
                sourceCode,
                position
            );

        if (call == null) {
            return null;
        }

        const tolerant =
            analyzeTolerantSource(
                sourceCode
            );
        const snapshot =
            request.snapshot ?? null;
        let signature = null;

        if (
            snapshot?.ok &&
            snapshot.semanticModel != null
        ) {
            signature =
                findSemanticSignature(
                    getSemanticNavigationIndex(
                        snapshot
                    ),
                    call.name
                );
        }

        signature ??=
            tolerant.functions.find(
                item =>
                    item.name === call.name
            ) ??
            getStandardLibraryHelp(
                call.name
            );

        if (signature == null) {
            return null;
        }

        const documentation =
            signature.returnType == null
                ? signature.documentation
                : formatStandardDocumentation(
                    signature
                );

        return Object.freeze({
            name: call.name,
            label:
                signature.signature,
            documentation,
            parameters:
                Object.freeze(
                    signature.parameters.map(
                        (label, index) =>
                            Object.freeze({
                                label,
                                documentation:
                                    signature.parameterDocumentation?.[index] ?? ("Parámetro «" +
                                    label +
                                    "».")
                            })
                    )
                ),
            activeParameter:
                call.activeParameter
        });
    }

    getInlayHints(request = {}) {
        const sourceCode =
            String(
                request.sourceCode ??
                ""
            );
        const tolerant =
            analyzeTolerantSource(
                sourceCode
            );
        const declarations = new Set(
            tolerant.functions.map(
                item =>
                    positionKey({
                        line:
                            item.selectionLocation
                                .startLine,
                        column:
                            item.selectionLocation
                                .startColumn
                    })
            )
        );
        const localFunctions = new Map(
            tolerant.functions.map(
                item => [item.name, item]
            )
        );
        const range = normalizeRange(
            request.range
        );
        const hints = [];

        for (
            const call
            of findFunctionCalls(sourceCode)
        ) {
            if (
                declarations.has(
                    positionKey(
                        call.nameLocation
                    )
                )
            ) {
                continue;
            }

            const signature =
                localFunctions.get(
                    call.name
                ) ??
                getStandardLibraryHelp(
                    call.name
                );

            if (signature == null) {
                continue;
            }

            for (
                let index = 0;
                index <
                    call.argumentLocations
                        .length;
                index += 1
            ) {
                const parameter =
                    signature.parameters[index];
                const position =
                    call.argumentLocations[index];

                if (
                    parameter == null ||
                    !containsRangePosition(
                        range,
                        position
                    )
                ) {
                    continue;
                }

                const name =
                    normalizeParameterName(
                        parameter
                    );

                if (name.length === 0) {
                    continue;
                }

                hints.push(
                    Object.freeze({
                        position,
                        label: name + ":",
                        parameterName: name,
                        functionName:
                            call.name
                    })
                );
            }
        }

        return Object.freeze(hints);
    }
}

function normalizeParameterName(parameter) {
    return String(parameter)
        .replace(/\[\]/g, "")
        .replace(/^\.\.\./, "")
        .trim();
}

function positionKey(position) {
    return (
        position.line +
        ":" +
        position.column
    );
}

function normalizeRange(range) {
    if (
        range?.start == null ||
        range?.end == null
    ) {
        return null;
    }

    return {
        start: normalizePosition(
            range.start
        ),
        end: normalizePosition(
            range.end
        )
    };
}

function containsRangePosition(
    range,
    position
) {
    return (
        range == null ||
        (
            compareLanguagePositions(
                position,
                range.start
            ) >= 0 &&
            compareLanguagePositions(
                position,
                range.end
            ) <= 0
        )
    );
}

function compareLanguagePositions(
    left,
    right
) {
    return (
        left.line - right.line ||
        left.column - right.column
    );
}

function addSemanticCompletions(
    completions,
    index,
    position,
    tolerant
) {
    const tolerantFunction =
        tolerant.findFunction(
            position.line
        );
    const enclosingFunction =
        index.documentSymbols.find(
            symbol =>
                symbol.kind ===
                    SemanticSymbolKind
                        .FUNCTION &&
                (
                    symbol.name ===
                        tolerantFunction
                            ?.name ||
                    containsPosition(
                        symbol.location,
                        position
                    )
                )
        );

    for (
        const symbol
        of enclosingFunction?.children ?? []
    ) {
        addCompletion(
            completions,
            createSymbolCompletion(
                symbol,
                0
            )
        );
    }

    for (
        const symbol
        of index.documentSymbols
    ) {
        addCompletion(
            completions,
            createSymbolCompletion(
                symbol,
                1
            )
        );
    }
}

function addTolerantCompletions(
    completions,
    tolerant,
    position
) {
    const enclosingFunction =
        tolerant.findFunction(
            position.line
        );

    for (
        const parameter
        of enclosingFunction
            ?.parameters ?? []
    ) {
        addCompletion(
            completions,
            Object.freeze({
                label:
                    parameter.replace(
                        /\[\]/g,
                        ""
                    ),
                kind:
                    LanguageCompletionKind
                        .PARAMETER,
                detail: "parámetro",
                documentation:
                    "Parámetro de " +
                    enclosingFunction.name +
                    ".",
                parameters:
                    Object.freeze([]),
                priority: 0
            })
        );
    }

    for (
        const variable
        of enclosingFunction
            ?.variables ?? []
    ) {
        addCompletion(
            completions,
            createTolerantVariableCompletion(
                variable,
                0
            )
        );
    }

    for (
        const variable
        of tolerant.globalVariables
    ) {
        addCompletion(
            completions,
            createTolerantVariableCompletion(
                variable,
                1
            )
        );
    }

    for (const item of tolerant.functions) {
        addCompletion(
            completions,
            Object.freeze({
                label: item.name,
                kind:
                    LanguageCompletionKind
                        .FUNCTION,
                detail: item.signature,
                documentation:
                    item.documentation,
                parameters:
                    item.parameters,
                priority: 1
            })
        );
    }
}

function createSymbolCompletion(
    symbol,
    priority
) {
    const kind =
        completionKindForSymbol(
            symbol.kind
        );
    const isFunction =
        kind ===
        LanguageCompletionKind.FUNCTION;
    const parameters =
        isFunction
            ? parametersFromDetail(
                symbol.detail
            )
            : [];

    return Object.freeze({
        label: symbol.name,
        kind,
        detail: isFunction
            ? symbol.name + symbol.detail
            : symbol.detail,
        documentation: isFunction
            ? "Función declarada en este documento."
            : symbol.kind ===
                SemanticSymbolKind.PARAMETER
                ? "Parámetro de la función actual."
                : "Variable declarada implícitamente mediante una asignación.",
        parameters:
            Object.freeze(parameters),
        priority
    });
}

function createTolerantVariableCompletion(
    variable,
    priority
) {
    return Object.freeze({
        label: variable.name,
        kind:
            LanguageCompletionKind
                .VARIABLE,
        detail: variable.detail,
        documentation:
            "Variable declarada implícitamente mediante una asignación.",
        parameters:
            Object.freeze([]),
        priority
    });
}

function createStandardCompletion(help) {
    return Object.freeze({
        label: help.name,
        kind:
            LanguageCompletionKind
                .FUNCTION,
        detail:
            help.signature +
            " → " +
            (help.returnLabel ?? formatReturnType(
                help.returnType
            )),
        documentation:
            formatStandardDocumentation(
                help
            ),
        parameters:
            help.parameters,
        priority: 2
    });
}

function createSemanticHover(index, word) {
    const occurrence =
        index.findOccurrence({
            line:
                word.location.startLine,
            column:
                word.location.startColumn
        });

    if (occurrence == null) {
        return null;
    }

    const standardHelp =
        getStandardLibraryHelp(
            occurrence.name
        );

    if (
        occurrence.symbolKind ===
            SemanticSymbolKind.BUILTIN &&
        standardHelp != null
    ) {
        return createHover(
            standardHelp.signature,
            formatStandardDocumentation(
                standardHelp
            ),
            word.location
        );
    }

    const outline =
        findOutlineSymbol(
            index.documentSymbols,
            occurrence.symbol
        );
    const definition =
        index.getDefinition(
            occurrence.symbol
        );
    const definitionText =
        definition == null
            ? ""
            : " Definición: línea " +
                definition.location
                    .startLine +
                ".";

    switch (occurrence.symbolKind) {
        case SemanticSymbolKind.FUNCTION:
            return createHover(
                occurrence.name +
                    (outline?.detail ??
                        "()"),
                "Función declarada en este documento." +
                    definitionText,
                word.location
            );
        case SemanticSymbolKind.PARAMETER:
            return createHover(
                "parámetro " +
                    occurrence.name,
                "Parámetro formal de la función actual." +
                    definitionText,
                word.location
            );
        case SemanticSymbolKind.VARIABLE:
            return createHover(
                "variable " +
                    occurrence.name,
                "Variable declarada implícitamente mediante su primera asignación en este ámbito." +
                    definitionText,
                word.location
            );
        default:
            return createHover(
                occurrence.name,
                "Identificador proporcionado por el entorno de ejecución.",
                word.location
            );
    }
}

function createTolerantHover(
    tolerant,
    position,
    word
) {
    const functionItem =
        tolerant.functions.find(
            item =>
                item.name === word.value
        );

    if (functionItem != null) {
        return createHover(
            functionItem.signature,
            functionItem.documentation +
                " Definición: línea " +
                functionItem
                    .selectionLocation
                    .startLine +
                ".",
            word.location
        );
    }

    const enclosingFunction =
        tolerant.findFunction(
            position.line
        );
    const parameter =
        enclosingFunction?.parameters
            .find(
                item =>
                    item.replace(
                        /\[\]/g,
                        ""
                    ) === word.value
            );

    if (parameter != null) {
        return createHover(
            "parámetro " + parameter,
            "Parámetro formal de " +
                enclosingFunction.name +
                ".",
            word.location
        );
    }

    const variable = [
        ...(enclosingFunction
            ?.variables ?? []),
        ...tolerant.globalVariables
    ].find(
        item =>
            item.name === word.value
    );

    return variable == null
        ? null
        : createHover(
            "variable " +
                variable.name,
            "Variable declarada implícitamente. Primera asignación: línea " +
                variable.location
                    .startLine +
                ".",
            word.location
        );
}

function findSemanticSignature(
    index,
    name
) {
    const symbol =
        index.documentSymbols.find(
            item =>
                item.kind ===
                    SemanticSymbolKind
                        .FUNCTION &&
                item.name === name
        );

    if (symbol == null) {
        return null;
    }

    return Object.freeze({
        name,
        signature:
            name + symbol.detail,
        parameters:
            Object.freeze(
                parametersFromDetail(
                    symbol.detail
                )
            ),
        documentation:
            "Función declarada en este documento."
    });
}

function findOutlineSymbol(
    symbols,
    semanticSymbol
) {
    for (const item of symbols) {
        if (item.symbol === semanticSymbol) {
            return item;
        }

        const child =
            findOutlineSymbol(
                item.children,
                semanticSymbol
            );

        if (child != null) {
            return child;
        }
    }

    return null;
}

function createHover(
    signature,
    documentation,
    location
) {
    return Object.freeze({
        signature,
        documentation,
        location
    });
}

function keyword(label, documentation) {
    return Object.freeze({
        label,
        kind:
            LanguageCompletionKind
                .KEYWORD,
        detail: "palabra del lenguaje",
        documentation,
        parameters:
            Object.freeze([]),
        priority: 3
    });
}

function addCompletion(map, completion) {
    if (!map.has(completion.label)) {
        map.set(
            completion.label,
            completion
        );
    }
}

function compareCompletions(left, right) {
    return (
        left.priority - right.priority ||
        left.label.localeCompare(
            right.label
        )
    );
}

function completionKindForSymbol(kind) {
    switch (kind) {
        case SemanticSymbolKind.FUNCTION:
            return LanguageCompletionKind
                .FUNCTION;
        case SemanticSymbolKind.PARAMETER:
            return LanguageCompletionKind
                .PARAMETER;
        default:
            return LanguageCompletionKind
                .VARIABLE;
    }
}

function parametersFromDetail(detail) {
    const source = String(detail);

    if (
        !source.startsWith("(") ||
        !source.endsWith(")")
    ) {
        return [];
    }

    const content = source.slice(1, -1)
        .trim();

    return content.length === 0
        ? []
        : content.split(",")
            .map(value => value.trim());
}

function containsPosition(
    location,
    position
) {
    return (
        position.line >=
            location.startLine &&
        position.line <=
            location.endLine &&
        (
            position.line !==
                location.startLine ||
            position.column >=
                location.startColumn
        ) &&
        (
            position.line !==
                location.endLine ||
            position.column <=
                location.endColumn + 1
        )
    );
}

function normalizePosition(position) {
    return Object.freeze({
        line: Number.isFinite(
            position?.line
        )
            ? position.line
            : 1,
        column: Number.isFinite(
            position?.column
        )
            ? position.column
            : 1
    });
}

function formatStandardDocumentation(help) {
    if (help.capability === "gui") {
        return help.documentation + "\n\nDevuelve: **" + help.returnLabel + "**." +
            "\n\nCosto directo (modelo GUI): **" + help.cost.formula + "**. " + help.cost.detail +
            " No incluye espera humana, renderizado nativo ni el cuerpo de callbacks.";
    }
    return (
        help.documentation +
        "\n\nDevuelve: **" +
        formatReturnType(
            help.returnType
        ) +
        "**. Costo declarado: **" +
        formatCost(help.cost) +
        "**."
    );
}

function formatReturnType(returnType) {
    switch (returnType) {
        case StandardLibraryReturnType.VOID:
            return "sin valor";
        case StandardLibraryReturnType.NEVER:
            return "no retorna";
        case StandardLibraryReturnType.NUMBER:
            return "Número";
        case StandardLibraryReturnType.STRING:
            return "Cadena";
        case StandardLibraryReturnType.BOOLEAN:
            return "Lógico";
        case StandardLibraryReturnType.ARRAY:
            return "Arreglo";
        default:
            return "desconocido";
    }
}

function formatCost(cost) {
    switch (cost) {
        case StandardLibraryCost.LINEAR_M:
            return "O(m)";
        case StandardLibraryCost.LINEAR_K:
            return "O(k)";
        case StandardLibraryCost.LINEAR_N:
        case StandardLibraryCost.TWO_N:
            return "O(n)";
        case StandardLibraryCost.N_LOG_N:
            return "O(n log n)";
        default:
            return "O(1)";
    }
}
