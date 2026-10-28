import {
    NodeTypes
} from "../../src/ast/core/NodeTypes.js";
import {
    parseSource
} from "../../src/language/LanguageFrontend.js";
import {
    decodeLanguageStringLiteral
} from "../../src/language/StringLiteralSemantics.js";

const DEBUG_BINDING =
    "__CLRS_DEBUG_EXPRESSION__";

const SAFE_STANDARD_FUNCTIONS =
    new Set([
        "ABS",
        "MIN",
        "MAX",
        "REDONDEA",
        "PISO",
        "RAIZ",
        "RAIZCUB",
        "EXP",
        "LOGN",
        "LOG10",
        "LOG2",
        "SEN",
        "COS",
        "TAN",
        "ARC",
        "ARCOCOS",
        "RAD",
        "GRAD",
        "PI",
        "E",
        "PROM",
        "SUM",
        "MED",
        "VAR",
        "LONG",
        "CAR_EN",
        "SUBCAD",
        "MAYUS",
        "MINUS",
        "RECORTA",
        "REEMP",
        "DIV",
        "ES_CAD_NUM",
        "ES_VAC",
        "EMP_CON",
        "TERM_CON",
        "INDICE",
        "CONT",
        "COPIA",
        "UNE",
        "ES_NUM",
        "ES_CAD",
        "ES_LOG",
        "A_CAD",
        "A_NUM",
        "A_LOG"
    ]);

export class BreakpointExpressionCompiler {

    compileBreakpoint(breakpoint) {
        try {
            return {
                ok: true,
                value: {
                    condition:
                        this.compileOptionalExpression(
                            breakpoint?.condition,
                            "La condición"
                        ),
                    hitCondition:
                        compileHitCondition(
                            breakpoint?.hitCondition
                        ),
                    logSegments:
                        this.compileLogMessage(
                            breakpoint?.logMessage
                        )
                }
            };
        } catch (error) {
            return {
                ok: false,
                value: null,
                error:
                    publicErrorMessage(error)
            };
        }
    }

    compileOptionalExpression(
        source,
        label = "La expresión"
    ) {
        if (
            source == null ||
            String(source).trim() === ""
        ) {
            return null;
        }

        return this.compileExpression(
            String(source),
            label
        );
    }

    compileExpression(
        source,
        label = "La expresión"
    ) {
        let expression;

        try {
            expression = parseSource(
                `${DEBUG_BINDING} = ${source}`
            ).ast.statements[0]?.right;
        } catch (error) {
            throw new Error(
                `${label} no es una expresión CLRS válida: ` +
                publicErrorMessage(error)
            );
        }

        if (!expression) {
            throw new Error(
                `${label} no contiene una expresión.`
            );
        }

        return normalizeExpression(
            expression,
            label
        );
    }

    compileLogMessage(source) {
        if (
            source == null ||
            String(source) === ""
        ) {
            return null;
        }

        const message = String(source);
        const segments = [];
        let text = "";
        let index = 0;

        const flushText = () => {
            if (text === "") {
                return;
            }

            segments.push({
                type: "text",
                value: text
            });
            text = "";
        };

        while (index < message.length) {
            const character = message[index];
            const next = message[index + 1];

            if (
                character === "{" &&
                next === "{"
            ) {
                text += "{";
                index += 2;
                continue;
            }

            if (
                character === "}" &&
                next === "}"
            ) {
                text += "}";
                index += 2;
                continue;
            }

            if (character !== "{") {
                if (character === "}") {
                    throw new Error(
                        "El logpoint contiene una llave de cierre sin apertura. Usa «}}» para escribir una llave literal."
                    );
                }

                text += character;
                index += 1;
                continue;
            }

            flushText();
            const closing = findClosingBrace(
                message,
                index + 1
            );

            if (closing < 0) {
                throw new Error(
                    "El logpoint contiene una expresión sin llave de cierre. Usa «{{» para escribir una llave literal."
                );
            }

            const expressionSource =
                message
                    .slice(index + 1, closing)
                    .trim();

            if (expressionSource === "") {
                throw new Error(
                    "El logpoint contiene una expresión vacía."
                );
            }

            segments.push({
                type: "expression",
                expression:
                    this.compileExpression(
                        expressionSource,
                        "La expresión del logpoint"
                    )
            });
            index = closing + 1;
        }

        flushText();
        return segments;
    }
}

function normalizeExpression(node, label) {
    switch (node?.type) {
        case NodeTypes.NUMBER_LITERAL:
        case NodeTypes.SCIENTIFIC_LITERAL:
        case NodeTypes.BOOLEAN_LITERAL:
        case NodeTypes.NULL_LITERAL:
            return {
                type: node.type,
                value: node.value
            };

        case NodeTypes.STRING_LITERAL:
            return {
                type: node.type,
                value:
                    decodeLanguageStringLiteral(
                        node.value
                    )
            };

        case NodeTypes.ARRAY_EXPRESSION:
            return {
                type: node.type,
                elements:
                    (node.elements ?? [])
                        .map(element =>
                            normalizeExpression(
                                element,
                                label
                            )
                        )
            };

        case NodeTypes.IDENTIFIER:
            return {
                type: node.type,
                name: node.name
            };

        case NodeTypes.ACCESS:
            return {
                type: node.type,
                name: node.identifier?.name,
                indexes:
                    (node.indexes ?? [])
                        .map(index =>
                            normalizeExpression(
                                index,
                                label
                            )
                        )
            };

        case NodeTypes.GROUP_EXPRESSION:
            return {
                type: node.type,
                expression:
                    normalizeExpression(
                        node.expression,
                        label
                    )
            };

        case NodeTypes.LOGICAL_NOT:
        case NodeTypes.UNARY:
            return {
                type: node.type,
                operator: node.operator,
                operand:
                    normalizeExpression(
                        node.operand,
                        label
                    )
            };

        case NodeTypes.BINARY_EXPRESSION:
        case NodeTypes.LOGICAL_EXPRESSION:
            return {
                type: node.type,
                operator: node.operator,
                left:
                    normalizeExpression(
                        node.left,
                        label
                    ),
                right:
                    normalizeExpression(
                        node.right,
                        label
                    )
            };

        case NodeTypes.FUNCTION_CALL: {
            const name =
                node.identifier?.name;

            if (!SAFE_STANDARD_FUNCTIONS.has(name)) {
                throw new Error(
                    `${label} sólo puede llamar funciones estándar sin efectos secundarios; «${name ?? "desconocida"}» no está permitida.`
                );
            }

            return {
                type: node.type,
                name,
                arguments:
                    (node.arguments ?? [])
                        .map(argument =>
                            normalizeExpression(
                                argument,
                                label
                            )
                        )
            };
        }

        default:
            throw new Error(
                `${label} contiene una construcción que el depurador no puede evaluar.`
            );
    }
}

function compileHitCondition(source) {
    if (
        source == null ||
        String(source).trim() === ""
    ) {
        return null;
    }

    const normalized =
        String(source).trim();
    const match = normalized.match(
        /^(?:(>=|<=|>|<|===|==|=|%)\s*)?(\d+)$/
    );

    if (!match) {
        throw new Error(
            "El conteo de impactos debe usar N, = N, > N, >= N, < N, <= N o % N."
        );
    }

    const value = Number(match[2]);
    const operator = match[1] ?? "=";

    if (!Number.isSafeInteger(value)) {
        throw new Error(
            "El conteo de impactos está fuera del rango admitido."
        );
    }

    if (operator === "%" && value === 0) {
        throw new Error(
            "El divisor del conteo de impactos debe ser mayor que cero."
        );
    }

    return {
        operator,
        value
    };
}

function findClosingBrace(source, start) {
    let quote = null;
    let escaped = false;

    for (
        let index = start;
        index < source.length;
        index += 1
    ) {
        const character = source[index];

        if (escaped) {
            escaped = false;
            continue;
        }

        if (
            quote != null &&
            character === "\\"
        ) {
            escaped = true;
            continue;
        }

        if (character === '"') {
            quote = quote == null
                ? character
                : null;
            continue;
        }

        if (
            quote == null &&
            character === "}"
        ) {
            return index;
        }
    }

    return -1;
}

function publicErrorMessage(error) {
    const message =
        error?.publicMessage ??
        error?.message ??
        String(error);

    return String(message)
        .replace(/\s+/g, " ")
        .trim();
}
