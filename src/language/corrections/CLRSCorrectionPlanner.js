import {
    tokenizeSource,
    tryParseSource
} from "../LanguageFrontend.js";
import {
    CLRSCorrectionSafety,
    resolveCLRSCorrectionDefinitions
} from "./CLRSCorrectionCatalog.js";

const CONDITIONAL_TOKEN_NAMES =
    new Set(["If", "While"]);
const ASSIGNMENT_TOKEN_NAME =
    "Assignment";

/**
 * Planifica ediciones neutrales que no requieren adivinar la intención del
 * usuario. El resultado no depende de VS Code y nunca modifica el documento.
 */
export class CLRSCorrectionPlanner {

    constructor(options = {}) {
        this.tokenizeSource =
            options.tokenizeSource ??
            tokenizeSource;
        this.tryParseSource =
            options.tryParseSource ??
            tryParseSource;
    }

    planInequivocalCorrections(
        request = {}
    ) {
        const sourceCode =
            requireSourceCode(
                request.sourceCode
            );
        const diagnostics =
            normalizeDiagnostics(request);
        let tokens;

        try {
            tokens = this.tokenizeSource(
                sourceCode
            );
        } catch {
            return EMPTY_PLANS;
        }

        const lines = sourceCode.split(
            /\r?\n/u
        );
        const tokensByLine = groupTokensByLine(
            tokens
        );
        const plans = [];

        for (const diagnostic of diagnostics) {
            const definition =
                resolveSafeConditionalDefinition(
                    diagnostic
                );

            if (definition == null) {
                continue;
            }

            /*
             * Chevrotain puede ubicar un error recuperado en el inicio del
             * bloque anterior. La aplicabilidad no se deduce de esa posición:
             * se comprueba directamente cada condición tokenizada.
             */
            for (
                const [lineNumber, lineTokens]
                of tokensByLine
            ) {
                const candidate =
                    findConditionalAssignments(
                        lineTokens
                    );

                if (
                    candidate == null ||
                    !conditionBecomesValid({
                        sourceLine:
                            lines[lineNumber - 1] ??
                            "",
                        candidate,
                        tryParseSource:
                            this.tryParseSource
                    })
                ) {
                    continue;
                }

                plans.push(
                    createPlan({
                        definition,
                        diagnostic,
                        assignments:
                            candidate.assignments
                    })
                );
            }
        }

        return Object.freeze(
            deduplicatePlans(plans)
        );
    }
}

function resolveSafeConditionalDefinition(
    diagnostic
) {
    return resolveCLRSCorrectionDefinitions(
        diagnostic,
        {
            syntaxKind:
                "assignment-in-condition"
        }
    ).find(
        definition =>
            definition.safety ===
                CLRSCorrectionSafety.SAFE
    ) ?? null;
}

function findConditionalAssignments(tokens) {
    let controlIndex = -1;

    for (
        let index = 0;
        index < tokens.length;
        index += 1
    ) {
        if (
            CONDITIONAL_TOKEN_NAMES.has(
                tokenName(tokens[index])
            )
        ) {
            controlIndex = index;
        }
    }

    if (controlIndex < 0) {
        return null;
    }

    const control = tokens[controlIndex];
    const conditionTokens = tokens.slice(
        controlIndex + 1
    );
    const assignments =
        conditionTokens.filter(
            token =>
                tokenName(token) ===
                    ASSIGNMENT_TOKEN_NAME
        );

    if (
        conditionTokens.length < 3 ||
        assignments.length === 0
    ) {
        return null;
    }

    const last = conditionTokens.at(-1);

    return {
        control,
        conditionEndColumn:
            last.endColumn,
        assignments
    };
}

function conditionBecomesValid({
    sourceLine,
    candidate,
    tryParseSource: parse
}) {
    const correctedLine = applyLineEdits(
        sourceLine,
        candidate.assignments.map(
            assignment => ({
                start:
                    assignment.startColumn - 1,
                end:
                    assignment.endColumn,
                newText: "=="
            })
        )
    );
    const condition = correctedLine
        .slice(
            candidate.control.endColumn,
            candidate.conditionEndColumn +
                candidate.assignments.length
        )
        .trim();

    if (condition.length === 0) {
        return false;
    }

    return parse([
        "__CORRECCION_CLRS__()",
        `    si ${condition}`,
        "        escribir 0"
    ].join("\n")).ok === true;
}

function createPlan({
    definition,
    diagnostic,
    assignments
}) {
    const edits = Object.freeze(
        assignments.map(
            assignment =>
                Object.freeze({
                    location:
                        tokenLocation(
                            assignment
                        ),
                    newText: "=="
                })
        )
    );
    const first = edits[0].location;
    const last = edits.at(-1).location;

    return Object.freeze({
        id:
            `${definition.id}:` +
            `${first.startLine}:` +
            `${first.startColumn}`,
        correctionId: definition.id,
        title: definition.title,
        preferred:
            definition.preferred,
        safety: definition.safety,
        diagnosticCode:
            diagnosticCodeValue(
                diagnostic.code
            ),
        diagnosticLocation:
            freezeLocation(
                diagnostic.location
            ),
        targetLocation:
            Object.freeze({
                startLine:
                    first.startLine,
                startColumn:
                    first.startColumn,
                endLine: last.endLine,
                endColumn: last.endColumn
            }),
        edits
    });
}

function groupTokensByLine(tokens) {
    const grouped = new Map();

    for (const token of tokens) {
        if (
            !Number.isFinite(
                token.startLine
            ) ||
            token.image.startsWith("<")
        ) {
            continue;
        }

        const lineTokens =
            grouped.get(token.startLine) ??
            [];

        lineTokens.push(token);
        grouped.set(
            token.startLine,
            lineTokens
        );
    }

    return grouped;
}

function applyLineEdits(line, edits) {
    let result = line;

    for (
        const edit
        of [...edits].sort(
            (left, right) =>
                right.start - left.start
        )
    ) {
        result =
            result.slice(0, edit.start) +
            edit.newText +
            result.slice(edit.end);
    }

    return result;
}

function deduplicatePlans(plans) {
    const unique = new Map();

    for (const plan of plans) {
        if (!unique.has(plan.id)) {
            unique.set(plan.id, plan);
        }
    }

    return [...unique.values()];
}

function normalizeDiagnostics(request) {
    const source = Array.isArray(
        request.diagnostics
    )
        ? request.diagnostics
        : request.diagnostic == null
            ? []
            : [request.diagnostic];

    return source.filter(
        diagnostic =>
            diagnostic != null &&
            Number.isFinite(
                diagnostic.location
                    ?.startLine
            )
    );
}

function tokenLocation(token) {
    return Object.freeze({
        startLine: token.startLine,
        startColumn: token.startColumn,
        endLine: token.endLine,
        endColumn: token.endColumn
    });
}

function freezeLocation(location) {
    if (location == null) {
        return null;
    }

    return Object.freeze({
        startLine:
            location.startLine ?? null,
        startColumn:
            location.startColumn ?? null,
        endLine:
            location.endLine ?? null,
        endColumn:
            location.endColumn ?? null
    });
}

function tokenName(token) {
    return token.tokenType?.name ?? "";
}

function diagnosticCodeValue(code) {
    if (
        code != null &&
        typeof code === "object"
    ) {
        return String(code.value ?? "");
    }

    return typeof code === "string"
        ? code
        : "";
}

function requireSourceCode(value) {
    if (typeof value !== "string") {
        throw new TypeError(
            "La planificación de correcciones requiere código fuente."
        );
    }

    return value;
}

const EMPTY_PLANS = Object.freeze([]);
