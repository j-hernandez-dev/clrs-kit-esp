import {
    createTokenInstance
} from "chevrotain";
import {
    Dedent,
    Indent,
    LBracket,
    LParen,
    NewLine,
    RBracket,
    RParen
} from "./tokens/Index.js";
import {
    IndentationError
} from "../errors/FrontendErrors.js";

export const DEFAULT_TAB_WIDTH = 4;

/**
 * Agrega tokens INDENT y DEDENT.
 *
 * Reglas:
 *  - Los NewLine no se envían al parser.
 *  - Las líneas vacías y de comentarios se ignoran.
 *  - Las tabulaciones avanzan hasta el siguiente tabulador configurable.
 *  - La sangría dentro de () y [] es continuación, no un bloque.
 *  - Un aumento de sangría estructural genera un INDENT.
 *  - Una disminución genera uno o varios DEDENT.
 *  - Al terminar el archivo se cierran todos los bloques.
 *
 * @param {import("chevrotain").IToken[]} tokens
 * @param {string} [sourceCode]
 * @param {{tabWidth?: number}} [options]
 */
export function addIndentationTokens(
    tokens,
    sourceCode = "",
    options = {}
) {
    const result = [];
    const indentStack = [0];
    const sourceLines =
        splitSourceLines(sourceCode);
    const tabWidth =
        normalizeTabWidth(
            options.tabWidth
        );
    let lastProcessedLine = -1;
    let groupingDepth = 0;
    let lastContentToken = null;

    for (const token of tokens) {
        if (token.tokenType === NewLine) {
            continue;
        }

        const isFirstTokenOnLine =
            token.startLine !==
            lastProcessedLine;

        if (isFirstTokenOnLine) {
            lastProcessedLine =
                token.startLine;

            if (groupingDepth === 0) {
                processStructuralIndentation({
                    token,
                    sourceLines,
                    tabWidth,
                    indentStack,
                    result
                });
            }
        }

        result.push(token);
        groupingDepth =
            updateGroupingDepth(
                groupingDepth,
                token
            );
        lastContentToken = token;
    }

    while (indentStack.length > 1) {
        indentStack.pop();
        result.push(
            createSyntheticToken(
                Dedent,
                "<DEDENT>",
                lastContentToken,
                true
            )
        );
    }

    return result;
}

function processStructuralIndentation({
    token,
    sourceLines,
    tabWidth,
    indentStack,
    result
}) {
    const indent =
        getIndentationWidth(
            token,
            sourceLines,
            tabWidth
        );
    const currentIndent =
        indentStack[
            indentStack.length - 1
        ];

    if (indent > currentIndent) {
        indentStack.push(indent);
        result.push(
            createSyntheticToken(
                Indent,
                "<INDENT>",
                token
            )
        );

        return;
    }

    if (indent >= currentIndent) {
        return;
    }

    const openIndentLevels = [
        ...indentStack
    ];

    while (
        indent <
        indentStack[
            indentStack.length - 1
        ]
    ) {
        indentStack.pop();
        result.push(
            createSyntheticToken(
                Dedent,
                "<DEDENT>",
                token
            )
        );
    }

    if (
        indent !==
        indentStack[
            indentStack.length - 1
        ]
    ) {
        throw createIndentationError(
            token,
            indent,
            openIndentLevels
        );
    }
}

function getIndentationWidth(
    token,
    sourceLines,
    tabWidth
) {
    const sourceLine =
        sourceLines[
            (token.startLine ?? 1) - 1
        ];

    if (sourceLine == null) {
        return Math.max(
            (token.startColumn ?? 1) - 1,
            0
        );
    }

    const indentation =
        /^[ \t]*/u.exec(
            sourceLine
        )?.[0] ?? "";
    let width = 0;

    for (const character of indentation) {
        if (character === "\t") {
            width +=
                tabWidth -
                (width % tabWidth);
        } else {
            width += 1;
        }
    }

    return width;
}

function updateGroupingDepth(
    depth,
    token
) {
    if (
        token.tokenType === LParen ||
        token.tokenType === LBracket
    ) {
        return depth + 1;
    }

    if (
        token.tokenType === RParen ||
        token.tokenType === RBracket
    ) {
        return Math.max(
            depth - 1,
            0
        );
    }

    return depth;
}

function createSyntheticToken(
    tokenType,
    image,
    referenceToken,
    useEndPosition = false
) {
    const offset =
        useEndPosition
            ? referenceToken?.endOffset
            : referenceToken?.startOffset;
    const line =
        useEndPosition
            ? referenceToken?.endLine
            : referenceToken?.startLine;
    const column =
        useEndPosition
            ? referenceToken?.endColumn
            : referenceToken?.startColumn;

    return createTokenInstance(
        tokenType,
        image,
        offset ??
            referenceToken?.startOffset ??
            referenceToken?.endOffset ??
            0,
        offset ??
            referenceToken?.startOffset ??
            referenceToken?.endOffset ??
            0,
        line ??
            referenceToken?.startLine ??
            referenceToken?.endLine ??
            1,
        line ??
            referenceToken?.startLine ??
            referenceToken?.endLine ??
            1,
        column ??
            referenceToken?.startColumn ??
            referenceToken?.endColumn ??
            1,
        column ??
            referenceToken?.startColumn ??
            referenceToken?.endColumn ??
            1
    );
}

function createIndentationError(
    token,
    actualIndentation,
    expectedIndentationLevels
) {
    const location = {
        startLine:
            token.startLine,
        startColumn:
            token.startColumn,
        endLine:
            token.endLine,
        endColumn:
            token.endColumn
    };
    const expected =
        formatIndentationLevels(
            expectedIndentationLevels
        );

    return new IndentationError(
        `Indentación inválida en la línea ${token.startLine}.`,
        location,
        {
            diagnostics: [{
                message:
                    `La sangría ocupa ${actualIndentation} columnas; ` +
                    `se esperaba un nivel abierto de ${expected}.`,
                location,
                actualIndentation,
                expectedIndentationLevels:
                    Object.freeze([
                        ...expectedIndentationLevels
                    ])
            }]
        }
    );
}

function formatIndentationLevels(
    levels
) {
    if (levels.length === 1) {
        return `${levels[0]} columnas`;
    }

    const last =
        levels.at(-1);

    return (
        levels
            .slice(0, -1)
            .join(", ") +
        ` o ${last} columnas`
    );
}

function splitSourceLines(sourceCode) {
    return typeof sourceCode === "string"
        ? sourceCode.split(/\r?\n/u)
        : [];
}

function normalizeTabWidth(tabWidth) {
    return (
        Number.isInteger(tabWidth) &&
        tabWidth > 0
    )
        ? tabWidth
        : DEFAULT_TAB_WIDTH;
}
