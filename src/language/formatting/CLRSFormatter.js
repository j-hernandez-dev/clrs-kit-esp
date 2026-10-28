import {
    tokenize
} from "../../lexer/Lexer.js";

const BINARY_OPERATORS = new Set([
    "Assignment",
    "Plus",
    "Minus",
    "Multiply",
    "Divide",
    "Power",
    "Mod",
    "LessOrEqual",
    "GreaterOrEqual",
    "NotEqual",
    "LessThan",
    "GreaterThan",
    "Equal",
    "And",
    "Or"
]);

const PREFIX_CONTEXT = new Set([
    ...BINARY_OPERATORS,
    "LParen",
    "LBracket",
    "Comma",
    "Return",
    "Print",
    "If",
    "While",
    "To",
    "Downto",
    "Not"
]);

/**
 * Formateador neutral de documentos CLRS.
 *
 * El AST decide la profundidad estructural; los tokens reconstruyen sólo el
 * espacio sintáctico. Los comentarios y las cadenas permanecen como texto de
 * usuario para evitar que el formateo cambie su significado.
 */
export class CLRSFormatter {

    format(sourceCode, options = {}) {
        const source = String(sourceCode ?? "");
        const ast = options.ast;

        if (ast?.type !== "Program") {
            throw new TypeError(
                "CLRS formatting requires a parsed Program AST."
            );
        }

        const tabSize = normalizeTabSize(
            options.tabSize
        );
        const insertSpaces =
            options.insertSpaces !== false;
        const indentationUnit =
            insertSpaces
                ? " ".repeat(tabSize)
                : "\t";
        const lineEnding =
            source.includes("\r\n")
                ? "\r\n"
                : "\n";
        const endsWithLineBreak =
            /\r?\n$/u.test(source);
        const lines = source.split(/\r?\n/u);

        if (endsWithLineBreak) {
            lines.pop();
        }

        const {
            tokensByLine,
            continuationDepths
        } = groupTokensByLine(
            tokenize(source)
        );
        const depths = collectLineDepths(ast);
        const indentationSamples =
            collectIndentationSamples(
                lines,
                depths,
                tabSize
            );
        const formattedLines = lines.map(
            (line, index) =>
                formatLine({
                    line,
                    lineNumber: index + 1,
                    tokens:
                        tokensByLine.get(
                            index + 1
                        ) ?? [],
                    depth:
                        resolveLineDepth({
                            line,
                            lineNumber:
                                index + 1,
                            depths,
                            indentationSamples,
                            tabSize,
                            lines,
                            continuationDepths
                        }),
                    indentationUnit
                })
        );
        const formatted =
            formattedLines.join(lineEnding);

        return endsWithLineBreak
            ? formatted + lineEnding
            : formatted;
    }
}

function formatLine({
    line,
    tokens,
    depth,
    indentationUnit
}) {
    if (line.trim() === "") {
        return "";
    }

    const indentation =
        indentationUnit.repeat(
            Math.max(0, depth)
        );
    const comment = findLineComment(line);

    if (tokens.length === 0) {
        return indentation +
            (comment?.text.trimStart() ??
                line.trim());
    }

    const code = formatTokens(tokens);

    if (!comment) {
        return indentation + code;
    }

    return indentation + code + "  " +
        comment.text.trimStart();
}

function formatTokens(tokens) {
    let result = "";

    for (
        let index = 0;
        index < tokens.length;
        index += 1
    ) {
        const token = tokens[index];
        const previous =
            tokens[index - 1] ?? null;

        if (
            previous != null &&
            needsSpace(
                tokens,
                index
            )
        ) {
            result += " ";
        }

        result += token.image;
    }

    return result;
}

function needsSpace(tokens, index) {
    const current = tokens[index];
    const previous = tokens[index - 1];
    const currentName = tokenName(current);
    const previousName = tokenName(previous);

    if (
        currentName === "RParen" ||
        currentName === "RBracket" ||
        currentName === "Comma" ||
        currentName === "Semicolon" ||
        currentName === "Colon" ||
        currentName === "Dot"
    ) {
        return false;
    }

    if (
        previousName === "LParen" ||
        previousName === "LBracket" ||
        previousName === "Dot"
    ) {
        return false;
    }

    if (
        currentName === "LParen"
    ) {
        return previousName !== "Identifier";
    }

    if (currentName === "LBracket") {
        return ![
            "Identifier",
            "RBracket"
        ].includes(previousName);
    }

    if (
        previousName === "Comma" ||
        previousName === "Colon" ||
        previousName === "Semicolon"
    ) {
        return true;
    }

    if (
        BINARY_OPERATORS.has(
            currentName
        ) &&
        !isUnarySign(tokens, index)
    ) {
        return true;
    }

    if (
        isUnarySign(tokens, index - 1)
    ) {
        return false;
    }

    if (
        BINARY_OPERATORS.has(
            previousName
        )
    ) {
        return true;
    }

    return true;
}

function isUnarySign(tokens, index) {
    const token = tokens[index];
    const name = tokenName(token);

    if (
        name !== "Plus" &&
        name !== "Minus"
    ) {
        return false;
    }

    if (index === 0) {
        return true;
    }

    return PREFIX_CONTEXT.has(
        tokenName(tokens[index - 1])
    );
}

function groupTokensByLine(tokens) {
    const tokensByLine = new Map();

    for (const token of tokens) {
        if (tokenName(token) === "NewLine") {
            continue;
        }

        const line = token.startLine;
        const lineTokens =
            tokensByLine.get(line) ?? [];

        lineTokens.push(token);
        tokensByLine.set(line, lineTokens);
    }

    const continuationDepths = new Map();
    let groupingDepth = 0;

    for (
        const [line, lineTokens]
        of tokensByLine
    ) {
        const leadingClosures =
            countLeadingClosures(
                lineTokens
            );

        if (groupingDepth > 0) {
            continuationDepths.set(
                line,
                Math.max(
                    0,
                    groupingDepth -
                        leadingClosures
                )
            );
        }

        for (const token of lineTokens) {
            const name = tokenName(token);

            if (
                name === "LParen" ||
                name === "LBracket"
            ) {
                groupingDepth += 1;
            } else if (
                name === "RParen" ||
                name === "RBracket"
            ) {
                groupingDepth = Math.max(
                    0,
                    groupingDepth - 1
                );
            }
        }
    }

    return {
        tokensByLine,
        continuationDepths
    };
}

function countLeadingClosures(tokens) {
    let count = 0;

    for (const token of tokens) {
        const name = tokenName(token);

        if (
            name !== "RParen" &&
            name !== "RBracket"
        ) {
            break;
        }

        count += 1;
    }

    return count;
}

function collectLineDepths(ast) {
    const depths = new Map();

    for (const statement of ast.statements) {
        visitStatement(
            statement,
            0,
            depths
        );
    }

    return depths;
}

function visitStatement(
    statement,
    depth,
    depths
) {
    markLine(
        depths,
        statement.location?.startLine,
        depth
    );

    switch (statement.type) {
        case "FunctionDeclaration":
            visitBlock(
                statement.body,
                depth + 1,
                depths
            );
            break;

        case "IfStatement":
            visitBlock(
                statement.thenBlock,
                depth + 1,
                depths
            );

            for (
                const branch of
                    statement.elseIfBranches
            ) {
                markLine(
                    depths,
                    branch.condition
                        .location?.startLine,
                    depth
                );
                visitBlock(
                    branch.block,
                    depth + 1,
                    depths
                );
            }

            if (statement.elseBlock) {
                markLine(
                    depths,
                    statement.elseBlock
                        .location?.startLine,
                    depth
                );
                visitBlock(
                    statement.elseBlock,
                    depth + 1,
                    depths
                );
            }
            break;

        case "WhileStatement":
        case "ForStatement":
            visitBlock(
                statement.body,
                depth + 1,
                depths
            );
            break;

        default:
            break;
    }
}

function visitBlock(block, depth, depths) {
    for (const statement of block?.statements ?? []) {
        visitStatement(
            statement,
            depth,
            depths
        );
    }
}

function markLine(depths, line, depth) {
    if (!Number.isInteger(line) || line < 1) {
        return;
    }

    const current = depths.get(line);

    if (current == null || depth < current) {
        depths.set(line, depth);
    }
}

function collectIndentationSamples(
    lines,
    depths,
    tabSize
) {
    const samples = new Map();

    for (const [lineNumber, depth] of depths) {
        const line = lines[lineNumber - 1];

        if (line == null) {
            continue;
        }

        const width = indentationWidth(
            line,
            tabSize
        );
        const candidates =
            samples.get(width) ?? [];

        candidates.push(depth);
        samples.set(width, candidates);
    }

    return samples;
}

function resolveLineDepth({
    line,
    lineNumber,
    depths,
    indentationSamples,
    tabSize,
    lines,
    continuationDepths
}) {
    const known = depths.get(lineNumber);

    if (known != null) {
        return known;
    }

    if (
        continuationDepths.has(
            lineNumber
        )
    ) {
        const owner = findNearestDepth(
            depths,
            lineNumber,
            -1,
            lines
        );

        if (owner) {
            return owner.depth +
                continuationDepths.get(
                    lineNumber
                );
        }
    }

    const width = indentationWidth(
        line,
        tabSize
    );
    const exact = indentationSamples.get(width);

    if (exact?.length > 0) {
        return mostFrequent(exact);
    }

    const previous = findNearestDepth(
        depths,
        lineNumber,
        -1,
        lines
    );
    const next = findNearestDepth(
        depths,
        lineNumber,
        1,
        lines
    );

    if (previous && next) {
        const previousWidth =
            indentationWidth(
                previous.line,
                tabSize
            );
        const nextWidth =
            indentationWidth(
                next.line,
                tabSize
            );

        if (width === nextWidth) {
            return next.depth;
        }

        if (width > previousWidth) {
            return previous.depth + 1;
        }

        return width < previousWidth
            ? next.depth
            : previous.depth;
    }

    if (previous) {
        const previousWidth =
            indentationWidth(
                previous.line,
                tabSize
            );

        return width > previousWidth
            ? previous.depth + 1
            : previous.depth;
    }

    return next?.depth ?? 0;
}

function findNearestDepth(
    depths,
    lineNumber,
    direction,
    lines
) {
    const entries = [...depths.entries()]
        .filter(([candidate]) =>
            direction < 0
                ? candidate < lineNumber
                : candidate > lineNumber
        )
        .sort((left, right) =>
            Math.abs(left[0] - lineNumber) -
            Math.abs(right[0] - lineNumber)
        );
    const entry = entries[0];

    if (!entry) {
        return null;
    }

    return {
        lineNumber: entry[0],
        line: lines[entry[0] - 1] ?? "",
        depth: entry[1]
    };
}

function indentationWidth(line, tabSize) {
    const indentation =
        /^[ \t]*/u.exec(line)?.[0] ?? "";
    let width = 0;

    for (const character of indentation) {
        width += character === "\t"
            ? tabSize - (width % tabSize)
            : 1;
    }

    return width;
}

function mostFrequent(values) {
    const counts = new Map();

    for (const value of values) {
        counts.set(
            value,
            (counts.get(value) ?? 0) + 1
        );
    }

    return [...counts.entries()]
        .sort((left, right) =>
            right[1] - left[1] ||
            left[0] - right[0]
        )[0][0];
}

function findLineComment(line) {
    let inString = false;
    let escaped = false;

    for (
        let index = 0;
        index < line.length - 1;
        index += 1
    ) {
        const character = line[index];

        if (inString) {
            if (escaped) {
                escaped = false;
            } else if (character === "\\") {
                escaped = true;
            } else if (character === '"') {
                inString = false;
            }

            continue;
        }

        if (character === '"') {
            inString = true;
            continue;
        }

        if (
            character === "/" &&
            line[index + 1] === "/"
        ) {
            return {
                index,
                text: line.slice(index)
            };
        }
    }

    return null;
}

function tokenName(token) {
    return token?.tokenType?.name ?? "";
}

function normalizeTabSize(value) {
    const parsed = Number(value);

    return Number.isInteger(parsed) &&
        parsed >= 1 &&
        parsed <= 16
        ? parsed
        : 4;
}
