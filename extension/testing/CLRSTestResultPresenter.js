import {
    CLRS_TEST_COMPARISON_LABELS,
    CLRSTestResultStatus
} from "../../src/testing/index.js";
import {
    requireObject,
    requirePort
} from "../../src/application/ports/ApplicationPorts.js";

export const CLRS_TEST_RESULT_PRESENTATION_LIMITS =
    Object.freeze({
        maximumOutputSectionCharacters: 65_536,
        maximumDiffCharacters: 262_144
    });

const STATUS_LABELS = Object.freeze({
    [CLRSTestResultStatus.PASSED]: "Aprobada",
    [CLRSTestResultStatus.FAILED]: "Fallida",
    [CLRSTestResultStatus.ERRORED]: "Error",
    [CLRSTestResultStatus.SKIPPED]: "Omitida",
    [CLRSTestResultStatus.CANCELLED]: "Cancelada"
});

/**
 * Proyecta un resultado neutral sobre TestRun. Mantiene en un único lugar el
 * texto educativo, las diferencias nativas y las ubicaciones navegables.
 */
export class CLRSTestResultPresenter {

    constructor(options = {}) {
        this.vscode = requireObject(
            options.vscodeApi,
            "vscodeApi"
        );
        this.workspace = requirePort(
            options.workspace,
            "testWorkspace",
            ["toUri"]
        );
    }

    present({
        testRun,
        item,
        testCase,
        result,
        programPath
    }) {
        testRun.appendOutput(
            buildResultOutput(testCase, result),
            result.failure?.location == null
                ? undefined
                : createLocation(
                    this.vscode,
                    this.workspace,
                    result.failure.location
                ),
            item
        );

        const duration = result.durationMs ??
            undefined;

        switch (result.status) {
            case CLRSTestResultStatus.PASSED:
                testRun.passed(item, duration);
                break;
            case CLRSTestResultStatus.FAILED:
                testRun.failed(
                    item,
                    this.#failureMessages(
                        result,
                        programPath
                    ),
                    duration
                );
                break;
            case CLRSTestResultStatus.ERRORED:
                testRun.errored(
                    item,
                    this.#failureMessages(
                        result,
                        programPath
                    ),
                    duration
                );
                break;
            default:
                testRun.skipped(item);
                break;
        }
    }

    #failureMessages(result, programPath) {
        const diagnostics = result.failure
            ?.diagnostics ?? [];
        const diagnosticMessages = diagnostics
            .map(diagnostic =>
                this.#diagnosticMessage(
                    diagnostic,
                    programPath
                )
            )
            .filter(message => message != null);

        if (diagnosticMessages.length > 0) {
            return diagnosticMessages;
        }

        const failure = result.failure;
        let evidenceMessage;

        if (
            failure?.expected != null &&
            failure?.actual != null
        ) {
            evidenceMessage = this.vscode.TestMessage.diff(
                failure.message,
                boundedText(
                    failure.expected,
                    CLRS_TEST_RESULT_PRESENTATION_LIMITS
                        .maximumDiffCharacters
                ),
                boundedText(
                    failure.actual,
                    CLRS_TEST_RESULT_PRESENTATION_LIMITS
                        .maximumDiffCharacters
                )
            );
        } else {
            evidenceMessage = new this.vscode.TestMessage(
                failure?.message ??
                    "La prueba no pudo completarse."
            );
        }

        if (failure?.location != null) {
            evidenceMessage.location = createLocation(
                this.vscode,
                this.workspace,
                failure.location
            );
        }

        if (failure?.pedagogicalExplanation == null) {
            return evidenceMessage;
        }

        return [
            pedagogicalMessage(
                this.vscode,
                failure.pedagogicalExplanation
            ),
            evidenceMessage
        ];
    }

    #diagnosticMessage(diagnostic, programPath) {
        if (
            diagnostic == null ||
            typeof diagnostic.message !== "string" ||
            diagnostic.message.trim().length === 0
        ) {
            return null;
        }

        const code = typeof diagnostic.code === "string" &&
            diagnostic.code.trim().length > 0
            ? `[${diagnostic.code.trim()}] `
            : "";
        const message = new this.vscode.TestMessage(
            `${code}${diagnostic.message.trim()}`
        );
        const location = diagnosticLocation(
            diagnostic,
            programPath
        );

        if (location != null) {
            message.location = createLocation(
                this.vscode,
                this.workspace,
                location
            );
        }

        return message;
    }
}

function buildResultOutput(testCase, result) {
    const lines = [
        `Prueba CLRS · ${testCase.name}`,
        `Identificador: ${testCase.id}`,
        `Estado: ${STATUS_LABELS[result.status]}`,
        `Comparación: ${formatComparison(
            testCase.expectation.comparison
        )}`,
        `Duración: ${formatDuration(result.durationMs)}`
    ];

    if (result.seed != null) {
        lines.push(`Semilla: ${result.seed}`);
    }

    if (result.exitCode != null) {
        lines.push(`Código de salida: ${result.exitCode}`);
    }

    if (result.signal != null) {
        lines.push(`Señal: ${result.signal}`);
    }

    lines.push(
        "",
        "Entrada:",
        displayData(testCase.input.stdin, "(sin entrada)"),
        "",
        "Salida esperada:",
        displayData(
            testCase.expectation.stdout,
            "(sin salida)"
        ),
        "",
        "Salida obtenida:",
        displayData(result.stdout, "(sin salida)")
    );

    if (result.failure != null) {
        lines.push(
            "",
            "Resultado:",
            result.failure.code == null
                ? result.failure.message
                : `[${result.failure.code}] ${result.failure.message}`
        );

        appendPedagogicalExplanation(
            lines,
            result.failure.pedagogicalExplanation
        );
    }

    if (result.stderr.length > 0) {
        lines.push(
            "",
            "Salida de error:",
            displayData(result.stderr, "(sin salida)")
        );
    }

    lines.push("", "");

    return terminalLines(lines.join("\n"));
}

function pedagogicalMessage(vscode, explanation) {
    return new vscode.TestMessage([
        explanation.title,
        explanation.summary,
        "",
        `Siguiente paso: ${explanation.guidance}`
    ].join("\n"));
}

function appendPedagogicalExplanation(
    lines,
    explanation
) {
    if (explanation == null) {
        return;
    }

    lines.push(
        "",
        "Primera divergencia:",
        explanation.title,
        explanation.summary,
        "",
        "Siguiente paso:",
        explanation.guidance,
        "",
        "Detalle técnico:",
        explanation.technicalDetail
    );
}

function displayData(value, emptyLabel) {
    if (value.length === 0) {
        return emptyLabel;
    }

    const normalized = normalizeLines(value)
        .replace(/\n$/u, "");

    return boundedText(
        normalized,
        CLRS_TEST_RESULT_PRESENTATION_LIMITS
            .maximumOutputSectionCharacters
    );
}

function boundedText(value, maximum) {
    if (value.length <= maximum) {
        return value;
    }

    return `${value.slice(0, maximum)}\n… [contenido truncado]`;
}

function formatDuration(value) {
    return value == null
        ? "no disponible"
        : `${value} ms`;
}

function formatComparison(value) {
    return CLRS_TEST_COMPARISON_LABELS[value] ?? value;
}

function diagnosticLocation(diagnostic, programPath) {
    const location = diagnostic.location;

    if (
        typeof programPath !== "string" ||
        !Number.isSafeInteger(location?.startLine) ||
        !Number.isSafeInteger(location?.startColumn)
    ) {
        return null;
    }

    return {
        sourcePath: programPath,
        startLine: location.startLine,
        startColumn: location.startColumn,
        endLine: location.endLine ??
            location.startLine,
        endColumn: location.endColumn ??
            location.startColumn
    };
}

function createLocation(vscode, workspace, location) {
    const startLine = Math.max(
        0,
        location.startLine - 1
    );
    const startColumn = Math.max(
        0,
        location.startColumn - 1
    );
    const endLine = Math.max(
        startLine,
        location.endLine - 1
    );
    const endColumn = Math.max(
        endLine === startLine
            ? startColumn
            : 0,
        location.endColumn - 1
    );

    return new vscode.Location(
        workspace.toUri(location.sourcePath),
        new vscode.Range(
            startLine,
            startColumn,
            endLine,
            endColumn
        )
    );
}

function normalizeLines(value) {
    return value
        .replace(/\r\n/gu, "\n")
        .replace(/\r/gu, "\n");
}

function terminalLines(value) {
    return normalizeLines(value)
        .replace(/\n/gu, "\r\n");
}
