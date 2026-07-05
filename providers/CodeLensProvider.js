import * as vscode from "vscode";
import { cost } from "../src/interpreter/Runtime.js";
import { ViewState } from "./ViewState.js";

export class CLRSCodeLensProvider {

    _onDidChangeCodeLenses = new vscode.EventEmitter();

    onDidChangeCodeLenses =
        this._onDidChangeCodeLenses.event;

    refresh() {
        this._onDidChangeCodeLenses.fire();
    }

    provideCodeLenses(document) {

        if (document.languageId !== "clrs-es") {
            return [];
        }

        const lenses = [];

        //========================================
        // BOTONES PRINCIPALES
        //========================================

        const topRange = new vscode.Range(0, 0, 0, 0);

        lenses.push(

            new vscode.CodeLens(topRange, {
                title: "$(run) Ejecutar",
                command: "CLRS.runCode"
            })

        );

        lenses.push(

            new vscode.CodeLens(topRange, {
                title: "$(tools) Construir",
                command: "CLRS.buildCode"
            })

        );

        lenses.push(

            new vscode.CodeLens(topRange, {

                title: ViewState.showCost
                    ? "$(eye) Costos: ON"
                    : "$(eye-closed) Costos: OFF",

                command: "CLRS.toggleCost"
            })

        );

        //========================================
        // ANÁLISIS DE COSTO
        //========================================

        if (!ViewState.showCost) {
            return lenses;
        }

        const tree =
            cost(
                document.getText()
            );

        if (tree !== null) {
            this.visit(
                tree.statementsCost,
                lenses
            );
        }

        return lenses;
    }

    visit(nodes, lenses) {

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
                    new vscode.CodeLens(
                        new vscode.Range(
                            node.location.startLine - 1,
                            0,
                            node.location.startLine - 1,
                            0
                        ),
                        {
                            title: `${node.expression}`,
                            command: "CLRS.copyCostExpression",
                            arguments: [node.expression]
                        }
                    )
                );
            }

            if (node.instructions) {
                this.visit(node.instructions, lenses);
            }
        }
    }
}