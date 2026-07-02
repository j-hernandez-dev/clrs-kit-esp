import * as vscode from "vscode";

export class CLRSCodeLensProvider {

    provideCodeLenses(document) {

        if (document.languageId !== "clrs-es") {
            return [];
        }

        if (document.lineCount === 0) {
            return [];
        }

        const range = new vscode.Range(0, 0, 0, 0);

        return [

            new vscode.CodeLens(range, {
                title: "$(run) Ejecutar",
                command: "CLRS.runCode"
            }),

            new vscode.CodeLens(range, {
                title: "$(tools) Construir",
                command: "CLRS.buildCode"
            })

        ];
    }
}