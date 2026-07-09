import * as vscode from "vscode";
import { cost } from "../src/interpreter/Runtime.js";
import { ViewState } from "./ViewState.js";

export class CLRSCostDecorator {

    constructor() {
        this.decoration = vscode.window.createTextEditorDecorationType({
            after: {
                margin: "0 0 0 2em",
                color: new vscode.ThemeColor("editorCodeLens.foreground"),
                fontStyle: "normal",
                fontWeight: "normal"
            },
            rangeBehavior: vscode.DecorationRangeBehavior.OpenClosed
        });
    }

    update(editor) {

        if (!ViewState.showCost) {
            editor.setDecorations(
                this.decoration,
                []
            );
            return;
        }

        if (!editor) return;
        if (editor.document.languageId !== "clrs-es") return;

        const tree = cost(editor.document.getText());
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

            const isLeaf =
                !node.instructions ||
                node.instructions.length === 0;

            if (isLeaf) {

                const line =
                    node.location.endLine - 1;

                decorations.push({

                    range: new vscode.Range(
                        line,
                        maxLength,
                        line,
                        maxLength
                    ),

                    renderOptions: {
                        after: {
                            contentText:
                                ` ⟶ ${node.expression}`
                        }
                    }
                });
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
}