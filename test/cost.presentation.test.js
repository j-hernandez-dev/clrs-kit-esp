import test from "node:test";
import assert from "node:assert/strict";

import {
    CLRSCostDecorator
} from "../extension/providers/DecoratorProvider.js";

test("el decorador separa Big O de los CodeLens y conserva los costos de línea", () => {
    const fake = createFakeVSCode();
    const report = {
        statementsCost: [{
            type: "FunctionDeclaration",
            expression:
                "TBINARIA(n) = c1 + c2",
            bigO: "O(log n)",
            location: {
                startLine: 1,
                endLine: 4
            },
            instructions: [{
                type: "WhileStatement",
                expression:
                    "c2 * log n",
                bigO: "O(log n)",
                location: {
                    startLine: 2,
                    endLine: 3
                },
                instructions: [{
                    type: "Assignment",
                    expression: "c2",
                    location: {
                        startLine: 3,
                        endLine: 3
                    }
                }]
            }, {
                type: "IfStatement",
                expression: "c3",
                bigO: "O(1)",
                location: {
                    startLine: 4,
                    endLine: 4
                },
                instructions: []
            }]
        }]
    };
    const decorator =
        new CLRSCostDecorator({
            analyzeCostUseCase: {
                execute() {
                    return {
                        ok: true,
                        value: report
                    };
                }
            },
            vscodeApi: fake.api,
            viewState: {
                showCost: true
            },
            languageId: "clrs-es"
        });
    const editor =
        createEditor([
            "BINARIA(n)",
            "    mientras n > 1",
            "        n <- n / 2",
            "    si n = 1"
        ]);

    decorator.update(editor);

    assert.deepEqual(
        editor.decorations.map(
            decoration => ({
                line:
                    decoration
                        .range.start.line,
                text:
                    decoration
                        .renderOptions
                        .after.contentText
            })
        ),
        [{
            line: 0,
            text: " ⟶ O(log n)"
        }, {
            line: 1,
            text: " ⟶ O(log n)"
        }, {
            line: 2,
            text: " ⟶ c2"
        }, {
            line: 3,
            text: " ⟶ O(1)"
        }]
    );
    assert.equal(
        editor.decorations.some(
            decoration =>
                decoration
                    .renderOptions
                    .after.contentText ===
                " ⟶ c3"
        ),
        false
    );

    decorator.dispose();
    assert.equal(
        fake.decoration.disposed,
        true
    );
});

test("el decorador limpia los resultados cuando el análisis está oculto", () => {
    const fake = createFakeVSCode();
    const viewState = {
        showCost: false
    };
    let executions = 0;
    const decorator =
        new CLRSCostDecorator({
            analyzeCostUseCase: {
                execute() {
                    executions += 1;
                    return {
                        ok: true,
                        value: {
                            statementsCost: []
                        }
                    };
                }
            },
            vscodeApi: fake.api,
            viewState,
            languageId: "clrs-es"
        });
    const editor =
        createEditor([
            "PRINCIPAL()"
        ]);

    decorator.update(editor);

    assert.deepEqual(
        editor.decorations,
        []
    );
    assert.equal(executions, 0);
});

function createEditor(lines) {
    return {
        document: {
            languageId: "clrs-es",
            lineCount: lines.length,
            getText() {
                return lines.join("\n");
            },
            lineAt(line) {
                return {
                    text: lines[line]
                };
            }
        },
        decorations: null,
        setDecorations(
            _decoration,
            decorations
        ) {
            this.decorations =
                decorations;
        }
    };
}

function createFakeVSCode() {
    const decoration = {
        disposed: false,
        dispose() {
            this.disposed = true;
        }
    };

    class Range {
        constructor(
            startLine,
            startCharacter,
            endLine,
            endCharacter
        ) {
            this.start = {
                line: startLine,
                character:
                    startCharacter
            };
            this.end = {
                line: endLine,
                character:
                    endCharacter
            };
        }
    }

    class ThemeColor {
        constructor(id) {
            this.id = id;
        }
    }

    return {
        decoration,
        api: {
            Range,
            ThemeColor,
            DecorationRangeBehavior: {
                OpenClosed:
                    "OpenClosed"
            },
            window: {
                createTextEditorDecorationType() {
                    return decoration;
                }
            }
        }
    };
}
