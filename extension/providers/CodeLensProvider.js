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

        const lenses = [];

        //========================================
        // ANÁLISIS DE COSTO
        //========================================

        if (!this.viewState.showCost) {
            return lenses;
        }

        const result =
            this.analyzeCostUseCase
                .execute({
                    sourceCode:
                        document.getText()
                });
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

    visit(
        nodes,
        lenses
    ) {

        for (const node of nodes) {

            const isLensNode =
                node.type === "FunctionDeclaration" ||
                node.type === "IfStatement" ||
                node.type === "ElseIfStatement" ||
                node.type === "ElseStatement" ||
                node.type === "WhileStatement" ||
                node.type === "ForStatement";

            if (isLensNode) {

                lenses.push(
                    this.createLens(
                        node.location
                            .startLine - 1,
                        node.expression,
                        node.expression
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
        title,
        copyValue
    ) {
        return new this.vscode.CodeLens(
            new this.vscode.Range(
                Math.max(0, line),
                0,
                Math.max(0, line),
                0
            ),
            {
                title,
                command:
                    "CLRS.copyCostExpression",
                arguments: [copyValue]
            }
        );
    }
}
