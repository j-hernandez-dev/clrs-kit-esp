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
        if (!tree) return;

        const decorations = [];

        this.visit(tree.statementsCost, decorations);

        editor.setDecorations(this.decoration, decorations);
    }

    visit(nodes, decorations) {

        for (const node of nodes) {

            const isLeaf =
                !node.instructions || node.instructions.length === 0;

            if (isLeaf) {

                const line = node.location.endLine - 1;
                const col = node.location.endColumn;

                decorations.push({
                    range: new vscode.Range(line, col, line, col),
                    renderOptions: {
                        after: {
                            contentText: ` ⟶ ${node.expression}`
                        }
                    }
                });
            }

            if (node.instructions) {
                this.visit(node.instructions, decorations);
            }
        }
    }
}