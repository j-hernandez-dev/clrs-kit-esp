const IDENTIFIER_PATTERN =
    /^[A-Za-z_][A-Za-z0-9_]*$/;
const FUNCTION_HEADER_PATTERN =
    /^(\s*)([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*$/;
const ASSIGNMENT_PATTERN =
    /(?:^\s*|\bpara\s+)([A-Za-z_][A-Za-z0-9_]*)(?:\s*\[[^\]]*\])*\s*=(?!=)/;

/**
 * Extrae firmas y bindings aun cuando el documento todavía no puede
 * convertirse en un AST completo.
 */
export function analyzeTolerantSource(
    sourceCode
) {
    const lines =
        String(sourceCode).split("\n");
    const functions =
        findFunctions(lines);
    const globalVariables = [];

    for (
        let lineIndex = 0;
        lineIndex < lines.length;
        lineIndex += 1
    ) {
        const variable =
            findAssignment(
                lines[lineIndex],
                lineIndex + 1
            );

        if (variable == null) {
            continue;
        }

        const owner =
            findContainingFunction(
                functions,
                lineIndex + 1
            );

        addUniqueSymbol(
            owner?.variables ??
                globalVariables,
            variable
        );
    }

    const finalizedFunctions =
        Object.freeze(
            functions.map(
                item =>
                    Object.freeze({
                        ...item,
                        variables:
                            Object.freeze(
                                item.variables
                            )
                    })
            )
        );

    return Object.freeze({
        functions: finalizedFunctions,
        globalVariables:
            Object.freeze(
                globalVariables
            ),
        findFunction(line) {
            return findContainingFunction(
                finalizedFunctions,
                line
            );
        }
    });
}

export function findWordAtPosition(
    sourceCode,
    position
) {
    const lines =
        String(sourceCode).split("\n");
    const lineNumber =
        position?.line;

    if (
        !Number.isFinite(lineNumber) ||
        lineNumber < 1 ||
        lineNumber > lines.length
    ) {
        return null;
    }

    const text = lines[lineNumber - 1];
    let index = Math.min(
        Math.max(
            (position?.column ?? 1) - 1,
            0
        ),
        text.length
    );

    if (
        !isIdentifierCharacter(
            text[index]
        ) &&
        index > 0 &&
        isIdentifierCharacter(
            text[index - 1]
        )
    ) {
        index -= 1;
    }

    if (
        !isIdentifierCharacter(
            text[index]
        )
    ) {
        return null;
    }

    let start = index;
    let end = index;

    while (
        start > 0 &&
        isIdentifierCharacter(
            text[start - 1]
        )
    ) {
        start -= 1;
    }

    while (
        end + 1 < text.length &&
        isIdentifierCharacter(
            text[end + 1]
        )
    ) {
        end += 1;
    }

    const value =
        text.slice(start, end + 1);

    if (!IDENTIFIER_PATTERN.test(value)) {
        return null;
    }

    return Object.freeze({
        value,
        location:
            Object.freeze({
                startLine: lineNumber,
                startColumn: start + 1,
                endLine: lineNumber,
                endColumn: end + 1
            })
    });
}

/**
 * Encuentra la llamada abierta más interna ignorando cadenas y comentarios.
 */
export function findCallContext(
    sourceCode,
    position
) {
    const source = String(sourceCode);
    const limit = offsetAt(
        source,
        position
    );
    const stack = [];
    let quote = null;
    let escaped = false;
    let lineComment = false;

    for (
        let index = 0;
        index < limit;
        index += 1
    ) {
        const character = source[index];
        const next = source[index + 1];

        if (lineComment) {
            if (character === "\n") {
                lineComment = false;
            }

            continue;
        }

        if (quote != null) {
            if (escaped) {
                escaped = false;
            } else if (character === "\\") {
                escaped = true;
            } else if (character === quote) {
                quote = null;
            }

            continue;
        }

        if (
            character === "/" &&
            next === "/"
        ) {
            lineComment = true;
            index += 1;
            continue;
        }

        if (character === "\"") {
            quote = character;
            continue;
        }

        if (character === "(") {
            stack.push({
                delimiter: character,
                name:
                    precedingIdentifier(
                        source,
                        index
                    ),
                activeParameter: 0
            });
            continue;
        }

        if (character === "[") {
            stack.push({
                delimiter: character,
                name: null,
                activeParameter: 0
            });
            continue;
        }

        if (
            character === ")" ||
            character === "]"
        ) {
            closeDelimiter(
                stack,
                character
            );
            continue;
        }

        if (
            character === "," &&
            stack.at(-1)
                ?.delimiter === "("
        ) {
            stack.at(-1)
                .activeParameter += 1;
        }
    }

    const call =
        [...stack].reverse()
            .find(
                item =>
                    item.delimiter ===
                        "(" &&
                    item.name != null
            );

    return call == null
        ? null
        : Object.freeze({
            name: call.name,
            activeParameter:
                call.activeParameter
        });
}

/**
 * Encuentra llamadas y el inicio de cada argumento sin exigir que el
 * documento pueda convertirse todavía en un AST completo. Las posiciones
 * se mantienen en el sistema 1-based utilizado por el núcleo del lenguaje.
 */
export function findFunctionCalls(
    sourceCode
) {
    const source = String(sourceCode);
    const lineStarts =
        collectLineStarts(source);
    const stack = [];
    const calls = [];
    let quote = null;
    let escaped = false;
    let lineComment = false;

    for (
        let index = 0;
        index < source.length;
        index += 1
    ) {
        const character = source[index];
        const next = source[index + 1];

        if (lineComment) {
            if (character === "\n") {
                lineComment = false;
            }

            continue;
        }

        if (quote != null) {
            if (escaped) {
                escaped = false;
            } else if (character === "\\") {
                escaped = true;
            } else if (character === quote) {
                quote = null;
            }

            continue;
        }

        if (
            character === "/" &&
            next === "/"
        ) {
            lineComment = true;
            index += 1;
            continue;
        }

        if (/\s/.test(character)) {
            continue;
        }

        if (character === "\"") {
            markArgumentStart(
                stack,
                index
            );
            quote = character;
            continue;
        }

        if (character === "(") {
            markArgumentStart(
                stack,
                index
            );
            const identifier =
                precedingIdentifierInfo(
                    source,
                    index
                );

            stack.push({
                delimiter: character,
                call: identifier == null
                    ? null
                    : {
                        name:
                            identifier.name,
                        nameOffset:
                            identifier.offset,
                        argumentOffsets: [],
                        awaitingArgument:
                            true
                    }
            });
            continue;
        }

        if (character === "[") {
            markArgumentStart(
                stack,
                index
            );
            stack.push({
                delimiter: character,
                call: null
            });
            continue;
        }

        if (
            character === "," &&
            stack.at(-1)?.delimiter ===
                "(" &&
            stack.at(-1)?.call != null
        ) {
            stack.at(-1)
                .call.awaitingArgument =
                true;
            continue;
        }

        if (
            character === ")" ||
            character === "]"
        ) {
            closeCallDelimiter(
                stack,
                character,
                calls
            );
            continue;
        }

        markArgumentStart(
            stack,
            index
        );
    }

    for (const entry of stack) {
        if (entry.call != null) {
            calls.push(entry.call);
        }
    }

    return Object.freeze(
        calls
            .map(call =>
                freezeFunctionCall(
                    lineStarts,
                    call
                )
            )
            .sort((left, right) =>
                comparePositions(
                    left.nameLocation,
                    right.nameLocation
                )
            )
    );
}

function findFunctions(lines) {
    const functions = [];

    for (
        let index = 0;
        index < lines.length;
        index += 1
    ) {
        const sourceLine =
            stripLineComment(
                lines[index]
            );
        const match =
            FUNCTION_HEADER_PATTERN.exec(
                sourceLine
            );

        if (match == null) {
            continue;
        }

        const headerIndent =
            indentationWidth(match[1]);
        const bodyStart =
            findNextCodeLine(
                lines,
                index + 1
            );

        if (
            bodyStart == null ||
            indentationWidth(
                lines[bodyStart]
            ) <= headerIndent
        ) {
            continue;
        }

        const bounds =
            findFunctionEnd(
                lines,
                bodyStart,
                headerIndent
            );
        const parameters =
            parseParameters(match[3]);
        const nameColumn =
            sourceLine.indexOf(
                match[2]
            ) + 1;

        functions.push({
            name: match[2],
            signature:
                formatSignature(
                    match[2],
                    parameters
                ),
            parameters:
                Object.freeze(parameters),
            documentation:
                "Función declarada en este documento.",
            location:
                Object.freeze({
                    startLine: index + 1,
                    startColumn: nameColumn,
                    endLine:
                        bounds.endIndex +
                        1,
                    endColumn:
                        lines[
                            bounds.endIndex
                        ]
                            ?.length ??
                        match[2].length
                }),
            selectionLocation:
                Object.freeze({
                    startLine: index + 1,
                    startColumn: nameColumn,
                    endLine: index + 1,
                    endColumn:
                        nameColumn +
                        match[2].length -
                        1
                }),
            variables: [],
            headerIndent,
            scopeEndLine:
                bounds.scopeEndIndex +
                1
        });
    }

    return functions;
}

function findAssignment(line, lineNumber) {
    const sourceLine =
        stripLineComment(line);
    const match =
        ASSIGNMENT_PATTERN.exec(
            sourceLine
        );

    if (match == null) {
        return null;
    }

    const column =
        sourceLine.indexOf(
            match[1],
            match.index
        ) + 1;

    return Object.freeze({
        name: match[1],
        kind: "variable",
        detail: "variable implícita",
        location:
            Object.freeze({
                startLine: lineNumber,
                startColumn: column,
                endLine: lineNumber,
                endColumn:
                    column +
                    match[1].length -
                    1
            })
    });
}

function parseParameters(source) {
    if (source.trim().length === 0) {
        return [];
    }

    return source.split(",")
        .map(value => value.trim())
        .filter(value =>
            /^[A-Za-z_][A-Za-z0-9_]*(?:\[\])*$/.test(
                value
            )
        );
}

function findContainingFunction(
    functions,
    line
) {
    return (
        functions.find(
            item =>
                line >=
                    item.location
                        .startLine &&
                line <=
                    item.scopeEndLine
        ) ??
        null
    );
}

function findFunctionEnd(
    lines,
    bodyStart,
    headerIndent
) {
    let endIndex = bodyStart;
    let scopeEndIndex =
        lines.length - 1;

    for (
        let index = bodyStart;
        index < lines.length;
        index += 1
    ) {
        if (
            stripLineComment(
                lines[index]
            ).trim().length === 0
        ) {
            continue;
        }

        if (
            indentationWidth(
                lines[index]
            ) <= headerIndent
        ) {
            scopeEndIndex = index - 1;
            break;
        }

        endIndex = index;
    }

    return {
        endIndex,
        scopeEndIndex:
            Math.max(
                scopeEndIndex,
                endIndex
            )
    };
}

function findNextCodeLine(lines, start) {
    for (
        let index = start;
        index < lines.length;
        index += 1
    ) {
        if (
            stripLineComment(
                lines[index]
            ).trim().length > 0
        ) {
            return index;
        }
    }

    return null;
}

function indentationWidth(line) {
    const prefix =
        /^\s*/.exec(line)?.[0] ??
        "";
    let width = 0;

    for (const character of prefix) {
        width += character === "\t"
            ? 4 - (width % 4)
            : 1;
    }

    return width;
}

function addUniqueSymbol(symbols, symbol) {
    if (
        !symbols.some(
            item =>
                item.name === symbol.name
        )
    ) {
        symbols.push(symbol);
    }
}

function stripLineComment(line) {
    return String(line).replace(
        /\/\/.*$/,
        ""
    );
}

function formatSignature(name, parameters) {
    return (
        name +
        "(" +
        parameters.join(", ") +
        ")"
    );
}

function precedingIdentifier(source, index) {
    return (
        /([A-Za-z_][A-Za-z0-9_]*)\s*$/.exec(
            source.slice(0, index)
        )?.[1] ??
        null
    );
}

function precedingIdentifierInfo(
    source,
    index
) {
    const match =
        /([A-Za-z_][A-Za-z0-9_]*)\s*$/.exec(
            source.slice(0, index)
        );

    if (match == null) {
        return null;
    }

    return {
        name: match[1],
        offset:
            index -
            match[0].length
    };
}

function markArgumentStart(stack, offset) {
    const entry = stack.at(-1);

    if (
        entry?.delimiter !== "(" ||
        entry.call == null ||
        !entry.call.awaitingArgument
    ) {
        return;
    }

    entry.call.argumentOffsets.push(
        offset
    );
    entry.call.awaitingArgument = false;
}

function closeCallDelimiter(
    stack,
    closing,
    calls
) {
    const opening =
        closing === ")" ? "(" : "[";
    const entry = stack.at(-1);

    if (entry?.delimiter !== opening) {
        return;
    }

    stack.pop();

    if (entry.call != null) {
        calls.push(entry.call);
    }
}

function freezeFunctionCall(
    lineStarts,
    call
) {
    return Object.freeze({
        name: call.name,
        nameLocation:
            locationAtOffset(
                lineStarts,
                call.nameOffset
            ),
        argumentLocations:
            Object.freeze(
                call.argumentOffsets.map(
                    offset =>
                        locationAtOffset(
                            lineStarts,
                            offset
                        )
                )
            )
    });
}

function collectLineStarts(source) {
    const starts = [0];

    for (
        let index = 0;
        index < source.length;
        index += 1
    ) {
        if (source[index] === "\n") {
            starts.push(index + 1);
        }
    }

    return starts;
}

function locationAtOffset(
    lineStarts,
    offset
) {
    let low = 0;
    let high = lineStarts.length - 1;

    while (low < high) {
        const middle = Math.ceil(
            (low + high) / 2
        );

        if (lineStarts[middle] <= offset) {
            low = middle;
        } else {
            high = middle - 1;
        }
    }

    return Object.freeze({
        line: low + 1,
        column:
            offset -
            lineStarts[low] +
            1
    });
}

function comparePositions(left, right) {
    return (
        left.line - right.line ||
        left.column - right.column
    );
}

function closeDelimiter(stack, closing) {
    const opening =
        closing === ")" ? "(" : "[";

    if (
        stack.at(-1)?.delimiter ===
        opening
    ) {
        stack.pop();
    }
}

function offsetAt(sourceCode, position) {
    const targetLine = Math.max(
        (position?.line ?? 1) - 1,
        0
    );
    const targetColumn = Math.max(
        (position?.column ?? 1) - 1,
        0
    );
    const lines = sourceCode.split("\n");
    let offset = 0;

    for (
        let line = 0;
        line < targetLine &&
            line < lines.length;
        line += 1
    ) {
        offset += lines[line].length + 1;
    }

    return Math.min(
        offset + targetColumn,
        sourceCode.length
    );
}

function isIdentifierCharacter(character) {
    return (
        typeof character === "string" &&
        /[A-Za-z0-9_]/.test(character)
    );
}
