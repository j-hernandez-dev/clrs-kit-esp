import test from "node:test";
import assert from "node:assert/strict";

import {
    CLRSCostDecorator
} from "../extension/providers/DecoratorProvider.js";
import {
    CLRSCodeLensProvider
} from "../extension/providers/CodeLensProvider.js";

test("el decorador muestra costos locales y de bloques sin Big O inline", () => {
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
            "        n = n / 2",
            "    si n == 1"
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
            line: 1,
            text: " ⟶ c2 * log n"
        }, {
            line: 2,
            text: " ⟶ c2"
        }, {
            line: 3,
            text: " ⟶ c3"
        }]
    );

    decorator.dispose();
    assert.equal(
        fake.decoration.disposed,
        true
    );
});

test("el decorador muestra if, sino si, sino y ambos sentidos de para", () => {
    const fake = createFakeVSCode();
    const decorator =
        new CLRSCostDecorator({
            analyzeCostUseCase: {
                execute() {
                    return {
                        ok: true,
                        value: {
                            statementsCost: [{
                                type: "IfStatement",
                                expression: "c_if",
                                location: {
                                    startLine: 1,
                                    endLine: 6
                                },
                                instructions: [{
                                    type:
                                        "ElseIfStatement",
                                    expression: "c_sino_si",
                                    location: {
                                        startLine: 2,
                                        endLine: 3
                                    },
                                    instructions: [{
                                        type:
                                            "ElseStatement",
                                        expression: "c_sino",
                                        location: {
                                            startLine: 3,
                                            endLine: 3
                                        },
                                        instructions: []
                                    }]
                                }, {
                                    type: "ForStatement",
                                    direction: "to",
                                    expression: "c_para_hasta",
                                    location: {
                                        startLine: 4,
                                        endLine: 4
                                    },
                                    instructions: []
                                }, {
                                    type: "ForStatement",
                                    direction: "downto",
                                    expression:
                                        "c_para_descendente",
                                    location: {
                                        startLine: 5,
                                        endLine: 5
                                    },
                                    instructions: []
                                }]
                            }]
                        }
                    };
                }
            },
            vscodeApi: fake.api,
            viewState: {
                showCost: true
            },
            languageId: "clrs-es"
        });
    const editor = createEditor([
        "si condicion",
        "sino si otra",
        "sino",
        "para i = 0 hasta n",
        "para i = n bajando hasta 0"
    ]);

    decorator.update(editor);

    assert.deepEqual(
        editor.decorations.map(
            decoration => ({
                line:
                    decoration.range.start.line,
                text:
                    decoration.renderOptions
                        .after.contentText
            })
        ),
        [{
            line: 0,
            text: " ⟶ c_if"
        }, {
            line: 1,
            text: " ⟶ c_sino_si"
        }, {
            line: 2,
            text: " ⟶ c_sino"
        }, {
            line: 3,
            text: " ⟶ c_para_hasta"
        }, {
            line: 4,
            text: " ⟶ c_para_descendente"
        }]
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

test("el CodeLens comparte la visibilidad del costo algorítmico", () => {
    const fake = createFakeVSCode();
    const viewState = {
        showCost: false
    };
    let executions = 0;
    const provider =
        new CLRSCodeLensProvider({
            analyzeCostUseCase: {
                execute() {
                    executions += 1;
                    return {
                        ok: true,
                        value: {
                            statementsCost: [{
                                type:
                                    "FunctionDeclaration",
                                location: {
                                    startLine: 1,
                                    endLine: 1
                                },
                                functionCostSummary: {
                                    name: "TPRINCIPAL"
                                },
                                instructions: []
                            }]
                        }
                    };
                }
            },
            vscodeApi: fake.api,
            viewState,
            languageId: "clrs-es"
        });
    const document =
        createEditor([
            "PRINCIPAL()"
        ]).document;

    assert.deepEqual(
        provider.provideCodeLenses(
            document
        ),
        []
    );
    assert.equal(executions, 0);

    viewState.showCost = true;

    const lenses =
        provider.provideCodeLenses(
            document
        );

    assert.equal(executions, 1);
    assert.equal(lenses.length, 1);
    assert.equal(
        lenses[0].command.title,
        "Ver análisis de complejidad"
    );

    provider.dispose();
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

    class EventEmitter {
        constructor() {
            this.event = () => {};
        }

        fire() {}

        dispose() {}
    }

    class CodeLens {
        constructor(range, command) {
            this.range = range;
            this.command = command;
        }
    }

    return {
        decoration,
        api: {
            Range,
            ThemeColor,
            EventEmitter,
            CodeLens,
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
