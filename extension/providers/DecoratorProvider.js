import {
    requireObject,
    requirePort
} from "../../src/application/ports/ApplicationPorts.js";

export class CLRSCostDecorator {

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
        this.decoration = this.vscode.window.createTextEditorDecorationType({
            after: {
                margin: "0 0 0 2em",
                color: new this.vscode.ThemeColor("editorCodeLens.foreground"),
                fontStyle: "normal",
                fontWeight: "normal"
            },
            rangeBehavior: this.vscode.DecorationRangeBehavior.OpenClosed
        });
    }

    update(editor) {

        if (!editor) return;

        if (!this.viewState.showCost) {
            editor.setDecorations(
                this.decoration,
                []
            );
            return;
        }

        if (
            editor.document.languageId !==
            this.languageId
        ) return;

        const result =
            this.analyzeCostUseCase
                .execute({
                    sourceCode:
                        editor.document
                            .getText()
                });
        const tree =
            result.ok
                ? result.value
                : null;
        if (!tree) {
            editor.setDecorations(
                this.decoration,
                []
            );
            return;
        }

        //==========================================
        // Longitud de la línea más larga
        //==========================================

        let maxLength = 0;

        for (let i = 0; i < editor.document.lineCount; i++) {

            maxLength = Math.max(
                maxLength,
                editor.document.lineAt(i).text.length
            );
        }

        const decorations = [];

        this.visit(
            tree.statementsCost,
            decorations,
            maxLength
        );

        editor.setDecorations(
            this.decoration,
            decorations
        );
    }

    visit(nodes, decorations, maxLength) {

        for (const node of nodes) {

            const isSummaryNode =
                node.type === "FunctionDeclaration" ||
                node.type === "IfStatement" ||
                node.type === "ElseIfStatement" ||
                node.type === "ElseStatement" ||
                node.type === "WhileStatement" ||
                node.type === "ForStatement";
            const isLeaf =
                !node.instructions ||
                node.instructions.length === 0;

            if (
                isSummaryNode &&
                node.bigO != null
            ) {
                this.addDecoration(
                    decorations,
                    node.location.startLine - 1,
                    maxLength,
                    node.bigO
                );
            } else if (isLeaf) {

                this.addDecoration(
                    decorations,
                    node.location.endLine - 1,
                    maxLength,
                    node.expression
                );
            }

            if (node.instructions) {

                this.visit(
                    node.instructions,
                    decorations,
                    maxLength
                );
            }
        }
    }

    addDecoration(
        decorations,
        line,
        maxLength,
        value
    ) {
        decorations.push({
            range: new this.vscode.Range(
                line,
                maxLength,
                line,
                maxLength
            ),
            renderOptions: {
                after: {
                    contentText:
                        ` ⟶ ${value}`
                }
            }
        });
    }

    dispose() {
        this.decoration.dispose();
    }
}
