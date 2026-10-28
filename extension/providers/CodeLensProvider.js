import {
    requireObject,
    requirePort
} from "../../src/application/ports/ApplicationPorts.js";

export class CLRSCodeLensProvider {

    constructor(options = {}) {
        this.analyzeCostUseCase =
            requirePort(
                options.analyzeCostUseCase,
                "analyzeCostUseCase",
                ["execute"]
            );
        this.documentAnalysisService =
            options.documentAnalysisService == null
                ? null
                : requirePort(
                    options
                        .documentAnalysisService,
                    "documentAnalysisService",
                    ["analyzeDocument"]
                );
        this.vscode =
            requireObject(
                options.vscodeApi,
                "vscodeApi"
            );
        this.viewState =
            requireObject(
                options.viewState,
                "viewState"
            );
        this.languageId =
            options.languageId;
        this.eventEmitter =
            new this.vscode.EventEmitter();
        this.onDidChangeCodeLenses =
            this.eventEmitter.event;
    }

    refresh() {
        this.eventEmitter.fire();
    }

    dispose() {
        this.eventEmitter.dispose();
    }

    provideCodeLenses(document) {

        if (
            document.languageId !==
            this.languageId
        ) {
            return [];
        }

        if (!this.viewState.showCost) {
            return [];
        }

        const lenses = [];

        const result =
            this.getCostAnalysisResult(
                document
            );
        const tree =
            result.ok
                ? result.value
                : null;

        if (tree !== null) {
            this.visit(
                tree.statementsCost,
                lenses
            );
        }

        return lenses;
    }

    getCostAnalysisResult(document) {
        if (
            this.documentAnalysisService != null
        ) {
            try {
                return this
                    .documentAnalysisService
                    .analyzeDocument(document)
                    .getCostAnalysisResult();
            } catch (error) {
                return failedAnalysis(error);
            }
        }

        return this.analyzeCostUseCase
            .execute({
                sourceCode:
                    document.getText()
            });
    }

    visit(
        nodes,
        lenses
    ) {

        for (const node of nodes) {

            const isLensNode =
                node.type ===
                "FunctionDeclaration";

            if (isLensNode) {

                lenses.push(
                    this.createLens(
                        node.location
                            .startLine - 1,
                        node.functionCostSummary
                            ?.name ?? null
                    )
                );
            }

            if (node.instructions) {
                this.visit(
                    node.instructions,
                    lenses
                );
            }
        }
    }

    createLens(
        line,
        functionId
    ) {
        return new this.vscode.CodeLens(
            new this.vscode.Range(
                Math.max(0, line),
                0,
                Math.max(0, line),
                0
            ),
            {
                title:
                    "Ver análisis de complejidad",
                command:
                    "CLRS.showComplexityReport",
                arguments: [{
                    functionId
                }]
            }
        );
    }
}

function failedAnalysis(error) {
    return {
        ok: false,
        value: null,
        errors: [error]
    };
}
