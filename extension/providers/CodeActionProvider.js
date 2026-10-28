import {
    requireObject,
    requirePort
} from "../../src/application/ports/ApplicationPorts.js";
import {
    formatDeveloperError
} from "../../src/errors/ErrorFormatter.js";
import {
    createVSCodeRange
} from "./StaticDiagnosticsProvider.js";

export const CLRS_EXPLAIN_CORRECTION_COMMAND =
    "CLRS.explainCorrection";

/**
 * Proyecta planes neutrales como acciones rápidas nativas de VS Code.
 */
export class CLRSCodeActionProvider {

    constructor(options = {}) {
        this.vscode = requireObject(
            options.vscodeApi,
            "vscodeApi"
        );
        this.documentAnalysisService =
            requirePort(
                options.documentAnalysisService,
                "documentAnalysisService",
                ["analyzeDocument"]
            );
        this.correctionPlanner = requirePort(
            options.correctionPlanner,
            "correctionPlanner",
            ["planInequivocalCorrections"]
        );
        this.explanationPlanner = requirePort(
            options.explanationPlanner,
            "correctionExplanationPlanner",
            ["planExplanatoryCorrections"]
        );
        this.languageId = options.languageId;
        this.developerLogger =
            options.developerLogger ??
            console;
        this.disposed = false;
    }

    provideCodeActions(
        document,
        range,
        context,
        cancellationToken
    ) {
        if (
            !this.isSupported(document) ||
            cancellationToken
                ?.isCancellationRequested
        ) {
            return [];
        }

        try {
            const snapshot =
                this.documentAnalysisService
                    .analyzeDocument(document);
            const sourceCode =
                document.getText();
            const request = {
                sourceCode,
                diagnostics:
                    snapshot.diagnostics
            };
            const editPlans =
                this.correctionPlanner
                    .planInequivocalCorrections(
                        request
                    );
            const explanationPlans =
                this.explanationPlanner
                    .planExplanatoryCorrections(
                        request
                    );
            const actions = [
                ...editPlans
                    .filter(plan =>
                        isPlanRelevant(
                            plan,
                            range
                        )
                    )
                    .map(plan =>
                        this.createEditAction(
                            document,
                            plan,
                            context
                        )
                    ),
                ...explanationPlans
                    .filter(plan =>
                        isPlanRelevant(
                            plan,
                            range
                        )
                    )
                    .map(plan =>
                        this
                            .createExplanationAction(
                                plan,
                                context
                            )
                    )
            ];

            return actions;
        } catch (error) {
            this.developerLogger.error(
                formatDeveloperError(error)
            );

            return [];
        }
    }

    createEditAction(
        document,
        plan,
        context
    ) {
        const action =
            new this.vscode.CodeAction(
                plan.title,
                this.vscode
                    .CodeActionKind.QuickFix
            );
        const edit =
            new this.vscode.WorkspaceEdit();

        for (const item of plan.edits) {
            edit.replace(
                document.uri,
                createVSCodeRange(
                    this.vscode,
                    document,
                    item.location
                ),
                item.newText
            );
        }

        action.edit = edit;
        action.isPreferred =
            plan.preferred === true;
        action.diagnostics =
            matchingDiagnostics(
                context?.diagnostics,
                plan.diagnosticCode
            );

        return action;
    }

    createExplanationAction(plan, context) {
        const action =
            new this.vscode.CodeAction(
                plan.title,
                this.vscode
                    .CodeActionKind.QuickFix
            );

        action.isPreferred = false;
        action.diagnostics =
            matchingDiagnostics(
                context?.diagnostics,
                plan.diagnosticCode
            );
        action.command = {
            command:
                CLRS_EXPLAIN_CORRECTION_COMMAND,
            title: plan.title,
            arguments: [plan.explanation]
        };

        return action;
    }

    async presentExplanation(explanation) {
        if (
            this.disposed ||
            !isExplanation(explanation)
        ) {
            return false;
        }

        const detail = [
            explanation.summary,
            "",
            "Qué puedes revisar:",
            ...explanation.guidance.map(
                (item, index) =>
                    `${index + 1}. ${item}`
            )
        ].join("\n");

        await this.vscode.window
            .showInformationMessage(
                explanation.title,
                {
                    modal: true,
                    detail
                }
            );

        return true;
    }

    isSupported(document) {
        return (
            !this.disposed &&
            document != null &&
            document.languageId ===
                this.languageId
        );
    }

    dispose() {
        this.disposed = true;
    }
}

function isPlanRelevant(plan, range) {
    if (range == null) {
        return true;
    }

    return [
        plan.targetLocation,
        plan.diagnosticLocation
    ].some(location =>
        locationIntersectsRange(
            location,
            range
        )
    );
}

function locationIntersectsRange(
    location,
    range
) {
    if (
        location == null ||
        range?.start == null ||
        range?.end == null
    ) {
        return false;
    }

    const start = {
        line: location.startLine - 1,
        character:
            location.startColumn - 1
    };
    const end = {
        line:
            (location.endLine ??
                location.startLine) - 1,
        character:
            location.endColumn ??
            location.startColumn
    };

    return (
        comparePositions(
            end,
            range.start
        ) >= 0 &&
        comparePositions(
            start,
            range.end
        ) <= 0
    );
}

function comparePositions(left, right) {
    return left.line - right.line ||
        left.character -
            right.character;
}

function matchingDiagnostics(
    diagnostics,
    code
) {
    if (!Array.isArray(diagnostics)) {
        return [];
    }

    return diagnostics.filter(
        diagnostic =>
            diagnosticCodeValue(
                diagnostic.code
            ) === code
    );
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

function isExplanation(value) {
    return (
        value != null &&
        typeof value.title === "string" &&
        value.title.length > 0 &&
        typeof value.summary === "string" &&
        Array.isArray(value.guidance) &&
        value.guidance.every(
            item =>
                typeof item === "string" &&
                item.length > 0
        )
    );
}
