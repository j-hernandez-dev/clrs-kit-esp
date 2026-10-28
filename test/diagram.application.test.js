import test from "node:test";
import assert from "node:assert/strict";

import {
    createDefaultDiagram
} from "../frontend/src/config/DefaultDiagram.js";
import {
    createWebviewApplication
} from "../frontend/src/composition/createWebviewApplication.js";
import {
    WebviewBridge
} from "../frontend/src/extension/Bridge.js";
import {
    DiagramService
} from "../frontend/src/services/DiagramService.js";
import {
    DiagramSourceEditService
} from "../src/diagram/editing/DiagramSourceEditService.js";
import {
    createDiagramNodeDeleteIntent,
    createDiagramNodeEditIntent,
    createDiagramNodeEditorDraft,
    updateDiagramNodeEditorDraft
} from "../frontend/src/editor/DiagramNodeEditorModel.js";
import {
    createDiagramInsertionDraft,
    createDiagramInsertionIntent,
    getDiagramInsertionFigures,
    getDiagramInsertionPlacement,
    selectDiagramInsertionFigure,
    updateDiagramInsertionDraft
} from "../frontend/src/editor/DiagramInsertionEditorModel.js";
import {
    createDiagramFunctionDraft,
    createDiagramFunctionIntent,
    updateDiagramFunctionDraft
} from "../frontend/src/editor/DiagramFunctionEditorModel.js";
import {
    getDiagramEntities
} from "../frontend/src/visitor/DiagramEditableIdentity.js";
import {
    DiagramModelStatus
} from "../frontend/src/state/DiagramModelStore.js";
import {
    DiagramGenerationError
} from "../src/errors/DiagramGenerationError.js";
import {
    ParserError
} from "../src/errors/FrontendErrors.js";

test("DiagramService distingue fuente vacía y programa válido", () => {
    const service = new DiagramService();
    const empty =
        service.buildFromSource("   ");
    const valid =
        service.buildFromSource(
            "dato = 1"
        );

    assert.equal(empty.ok, true);
    assert.equal(empty.value.empty, true);
    assert.equal(empty.value.ast, null);
    assert.deepEqual(
        empty.value.diagram,
        createDefaultDiagram()
    );

    assert.equal(valid.ok, true);
    assert.equal(valid.value.empty, false);
    assert.equal(
        valid.value.ast.type,
        "Program"
    );
    assert.equal(
        valid.value.diagram.nodes[1].label,
        "dato = 1"
    );
});

test("la flecha inicial de un documento vacío permite insertar la primera figura", () => {
    const source = "";
    const result = new DiagramService()
        .buildFromSource(source);
    const edge = getDiagramEntities(
        result.value.diagram
    ).find(entity =>
        entity.identity?.entityType ===
            "edge" &&
        entity.identity?.editable === true
    );

    assert.ok(edge);
    assert.deepEqual(
        edge.identity.insertion,
        {
            scopeId: "__main__",
            containerId: "__main__/body",
            branch: "body",
            index: 0,
            position: "end"
        }
    );

    const draft =
        selectDiagramInsertionFigure(
            createDiagramInsertionDraft(edge),
            "assignment"
        );
    const plan = new DiagramSourceEditService()
        .plan({
            sourceCode: source,
            sourceOrigin: {
                startLine: 1,
                startColumn: 1
            },
            documentVersion: 1,
            expectedDocumentVersion: 1,
            intent:
                createDiagramInsertionIntent(
                    draft
                )
        });

    assert.equal(
        applyPlan(source, plan),
        "resultado = valor\n"
    );
});

test("DiagramService traslada las ubicaciones de un fragmento al documento original", () => {
    const result =
        new DiagramService()
            .buildFromSource(
                "dato = 1\nescribir dato",
                {
                    sourceOrigin: {
                        startLine: 8,
                        startColumn: 5
                    }
                }
            );

    assert.equal(result.ok, true);
    assert.deepEqual(
        result.value.diagram.nodes[1]
            .location,
        {
            startLine: 8,
            startColumn: 5,
            endLine: 8,
            endColumn: 12
        }
    );
    assert.deepEqual(
        result.value.diagram.nodes[2]
            .location,
        {
            startLine: 9,
            startColumn: 1,
            endLine: 9,
            endColumn: 13
        }
    );
});

test("DiagramService conserva errores del frontend", () => {
    const result =
        new DiagramService()
            .buildFromSource("si");

    assert.equal(result.ok, false);
    assert.equal(result.value, null);
    assert.ok(
        result.errors[0]
        instanceof ParserError
    );
    assert.equal(
        result.errors[0].phase,
        "parser"
    );
});

test("DiagramService normaliza fallos de generación", () => {
    const expectedError =
        DiagramGenerationError
            .unsupportedNode({
                type: "Desconocido",
                location: null
            });
    const service = new DiagramService({
        diagramVisitorFactory: () => ({
            build() {
                throw expectedError;
            }
        })
    });
    const result =
        service.buildFromSource(
            "dato = 1"
        );

    assert.equal(result.ok, false);
    assert.equal(
        result.errors[0],
        expectedError
    );
    assert.equal(
        result.errors[0].phase,
        "diagram"
    );
});

test("DiagramSourceEditService actualiza las nueve figuras desde valores AST", () => {
    const source = [
        "AUX(valor)",
        "    retornar valor",
        "PRINCIPAL()",
        "    dato = 1",
        "    leer dato",
        "    escribir dato",
        "    si dato == 1",
        "        escribir dato",
        "    mientras dato < 3",
        "        dato = dato + 1",
        "    para i = 0 hasta 2",
        "        escribir i",
        "    para j = 2 bajando 0",
        "        escribir j",
        "    AUX(dato)"
    ].join("\n");
    const cases = [
        ["return", "expression", "dato", "retornar dato"],
        ["assignment", "expression", "2", "dato = 2"],
        ["read", "variables", "dato, opcion", "leer dato, opcion"],
        ["write", "expressions", "\"valor\", dato", "escribir \"valor\", dato"],
        ["if", "condition", "dato > 0", "si dato > 0"],
        ["while", "condition", "dato < 5", "mientras dato < 5"],
        ["for-to", "finalValue", "n - 1", "para i = 0 hasta n - 1"],
        ["for-downto", "finalValue", "1", "para j = 2 bajando 1"],
        ["function-call", "arguments", "dato, 2", "AUX(dato, 2)"]
    ];
    const service =
        new DiagramSourceEditService();

    for (
        const [
            figure,
            field,
            value,
            expectedLine
        ] of cases
    ) {
        const node = editableNode(
            source,
            figure
        );
        const draft =
            updateDiagramNodeEditorDraft(
                createDiagramNodeEditorDraft(
                    node
                ),
                field,
                value
            );
        const plan = service.plan({
            sourceCode: source,
            sourceOrigin: {
                startLine: 1,
                startColumn: 1
            },
            documentVersion: 3,
            expectedDocumentVersion: 3,
            intent:
                createDiagramNodeEditIntent(
                    draft
                )
        });
        const nextSource = applyPlan(
            source,
            plan
        );

        assert.ok(
            nextSource
                .split("\n")
                .some(line =>
                    line.trim() ===
                    expectedLine
                ),
            `${figure} no produjo ${expectedLine}`
        );
        assert.equal(
            plan.expectedDocumentVersion,
            3
        );
        assert.equal(
            Object.isFrozen(plan),
            true
        );
    }
});

test("los literales lógicos conservan sintaxis CLRS al aceptar su edición", () => {
    for (const literal of ["VERDAD", "FALSO"]) {
        const source = [
            "PRINCIPAL()",
            `    bandera = ${literal}`
        ].join("\n");
        const node = editableNode(
            source,
            "assignment"
        );

        assert.equal(
            node.label,
            `bandera = ${literal}`
        );
        assert.deepEqual(
            node.identity.editor,
            {
                target: "bandera",
                expression: literal
            }
        );

        const intent = createDiagramNodeEditIntent(
            createDiagramNodeEditorDraft(node)
        );
        const plan = new DiagramSourceEditService()
            .plan({
                sourceCode: source,
                sourceOrigin: {
                    startLine: 1,
                    startColumn: 1
                },
                documentVersion: 1,
                expectedDocumentVersion: 1,
                intent
            });
        const nextSource = applyPlan(source, plan);

        assert.equal(nextSource, source);
        assert.equal(
            new DiagramService()
                .buildFromSource(nextSource).ok,
            true
        );
    }
});

test("edita un arreglo literal multilínea sin dejar líneas residuales", () => {
    const source = [
        "PRINCIPAL()",
        "    datos = [",
        "        1,",
        "        [2, 3]",
        "    ]",
        "    escribir datos"
    ].join("\n");
    const node = editableNode(
        source,
        "assignment"
    );

    assert.deepEqual(
        node.identity.editor,
        {
            target: "datos",
            expression: "[1, [2, 3]]"
        }
    );

    const draft =
        updateDiagramNodeEditorDraft(
            createDiagramNodeEditorDraft(
                node
            ),
            "expression",
            "[[\"a\"], [4, 5]]"
        );
    const plan =
        new DiagramSourceEditService()
            .plan({
                sourceCode: source,
                sourceOrigin: {
                    startLine: 1,
                    startColumn: 1
                },
                documentVersion: 1,
                expectedDocumentVersion: 1,
                intent:
                    createDiagramNodeEditIntent(
                        draft
                    )
            });
    const nextSource = applyPlan(
        source,
        plan
    );

    assert.equal(
        nextSource,
        [
            "PRINCIPAL()",
            "    datos = [[\"a\"], [4, 5]]",
            "    escribir datos"
        ].join("\n")
    );
    assert.equal(
        new DiagramService()
            .buildFromSource(nextSource).ok,
        true
    );
});

test("el servicio elimina bloques completos y conserva sentencias hermanas", () => {
    const source = [
        "PRINCIPAL()",
        "    dato = 1",
        "    si dato == 1",
        "        escribir 1",
        "    sino si dato == 2",
        "        escribir 2",
        "    sino",
        "        escribir 3",
        "    escribir 4"
    ].join("\n");
    const service =
        new DiagramSourceEditService();
    const ifNodes = editableNodes(
        source,
        "if"
    );
    const elseIfPlan = service.plan({
        sourceCode: source,
        sourceOrigin: {
            startLine: 1,
            startColumn: 1
        },
        documentVersion: 5,
        expectedDocumentVersion: 5,
        intent:
            createDiagramNodeDeleteIntent(
                ifNodes[1]
            )
    });
    assert.equal(
        createDiagramNodeDeleteIntent(
            ifNodes[1]
        ).confirmation.impact,
        "branch"
    );
    const withoutElseIf = applyPlan(
        source,
        elseIfPlan
    );

    assert.doesNotMatch(
        withoutElseIf,
        /sino si/u
    );
    assert.match(
        withoutElseIf,
        /sino\n\s+escribir 3/u
    );

    const primaryPlan = service.plan({
        sourceCode: source,
        sourceOrigin: {
            startLine: 1,
            startColumn: 1
        },
        documentVersion: 5,
        expectedDocumentVersion: 5,
        intent:
            createDiagramNodeDeleteIntent(
                ifNodes[0]
            )
    });
    assert.equal(
        createDiagramNodeDeleteIntent(
            ifNodes[0]
        ).confirmation.impact,
        "control-block"
    );
    const withoutIf = applyPlan(
        source,
        primaryPlan
    );

    assert.equal(
        withoutIf,
        [
            "PRINCIPAL()",
            "    dato = 1",
            "    escribir 4"
        ].join("\n")
    );
});

test("elimina sino al retirar la última sentencia de la rama No", () => {
    const source = [
        "PRINCIPAL()",
        "    si dato == 1",
        "        escribir \"sí\"",
        "    sino",
        "        escribir \"no\"",
        "    escribir \"fin\""
    ].join("\n");
    const elseNode = editableNodes(
        source,
        "write"
    ).find(node =>
        node.identity?.branch === "else"
    );

    assert.ok(elseNode);
    assert.equal(
        elseNode.identity.blockStatementCount,
        1
    );

    const intent =
        createDiagramNodeDeleteIntent(
            elseNode
        );
    assert.equal(
        intent.confirmation.impact,
        "branch"
    );

    const plan = new DiagramSourceEditService()
        .plan({
            sourceCode: source,
            sourceOrigin: {
                startLine: 1,
                startColumn: 1
            },
            documentVersion: 8,
            expectedDocumentVersion: 8,
            intent
        });
    const nextSource = applyPlan(source, plan);

    assert.equal(
        nextSource,
        [
            "PRINCIPAL()",
            "    si dato == 1",
            "        escribir \"sí\"",
            "    escribir \"fin\""
        ].join("\n")
    );
    assert.doesNotMatch(nextSource, /\bsino\b/u);
});

test("conserva sino mientras la rama No tenga otra sentencia", () => {
    const source = [
        "PRINCIPAL()",
        "    si dato == 1",
        "        escribir \"sí\"",
        "    sino",
        "        escribir \"primera\"",
        "        escribir \"segunda\"",
        "    escribir \"fin\""
    ].join("\n");
    const elseNodes = editableNodes(
        source,
        "write"
    ).filter(node =>
        node.identity?.branch === "else"
    );

    assert.equal(elseNodes.length, 2);
    assert.equal(
        elseNodes[0].identity
            .blockStatementCount,
        2
    );

    const intent =
        createDiagramNodeDeleteIntent(
            elseNodes[0]
        );
    assert.equal(
        intent.confirmation.impact,
        "statement"
    );

    const plan = new DiagramSourceEditService()
        .plan({
            sourceCode: source,
            sourceOrigin: {
                startLine: 1,
                startColumn: 1
            },
            documentVersion: 9,
            expectedDocumentVersion: 9,
            intent
        });
    const nextSource = applyPlan(source, plan);

    assert.match(
        nextSource,
        /sino\n\s+escribir "segunda"/u
    );
    assert.doesNotMatch(
        nextSource,
        /escribir "primera"/u
    );
});

test("el servicio rechaza versiones obsoletas, inyección multilínea y resultados inválidos", () => {
    const source = [
        "PRINCIPAL()",
        "    dato = 1"
    ].join("\n");
    const node = editableNode(
        source,
        "assignment"
    );
    const draft =
        createDiagramNodeEditorDraft(node);
    const service =
        new DiagramSourceEditService();

    assert.throws(
        () => service.plan({
            sourceCode: source,
            sourceOrigin: {
                startLine: 1,
                startColumn: 1
            },
            documentVersion: 8,
            expectedDocumentVersion: 7,
            intent:
                createDiagramNodeEditIntent(
                    draft
                )
        }),
        error =>
            error.code ===
                "CLRS_DIAGRAM_EDIT_STALE_DOCUMENT"
    );

    const injected = {
        ...createDiagramNodeEditIntent(
            draft
        ),
        values: {
            ...draft.values,
            expression:
                "1\nescribir \"inyectado\""
        }
    };

    assert.throws(
        () => service.plan({
            sourceCode: source,
            sourceOrigin: {
                startLine: 1,
                startColumn: 1
            },
            documentVersion: 8,
            expectedDocumentVersion: 8,
            intent: injected
        }),
        error =>
            error.code ===
                "CLRS_DIAGRAM_EDIT_INVALID_VALUE"
    );

    assert.throws(
        () => service.plan({
            sourceCode: source,
            sourceOrigin: {
                startLine: 1,
                startColumn: 1
            },
            documentVersion: 8,
            expectedDocumentVersion: 8,
            intent:
                createDiagramNodeDeleteIntent(
                    node
                )
        }),
        error =>
            error.code ===
                "CLRS_DIAGRAM_EDIT_EMPTY_BLOCK"
    );
});

test("la eliminación segura retira ciclos completos y valida la confirmación", () => {
    const source = [
        "PRINCIPAL()",
        "    dato = 0",
        "    mientras dato < 2",
        "        dato = dato + 1",
        "    para i = 0 hasta 2",
        "        escribir i",
        "    escribir dato"
    ].join("\n");
    const service =
        new DiagramSourceEditService();

    for (const figure of ["while", "for-to"]) {
        const node = editableNode(
            source,
            figure
        );
        const intent =
            createDiagramNodeDeleteIntent(
                node
            );
        const plan = service.plan({
            sourceCode: source,
            sourceOrigin: {
                startLine: 1,
                startColumn: 1
            },
            documentVersion: 9,
            expectedDocumentVersion: 9,
            intent
        });
        const nextSource = applyPlan(
            source,
            plan
        );

        assert.doesNotMatch(
            nextSource,
            figure === "while"
                ? /mientras/u
                : /para i/u
        );
        assert.match(
            nextSource,
            /    escribir dato$/u
        );

        assert.throws(
            () => service.plan({
                sourceCode: source,
                sourceOrigin: {
                    startLine: 1,
                    startColumn: 1
                },
                documentVersion: 9,
                expectedDocumentVersion: 9,
                intent: {
                    ...intent,
                    confirmation: {
                        acknowledged: true,
                        impact: "statement"
                    }
                }
            }),
            error =>
                error.code ===
                    "CLRS_DIAGRAM_EDIT_INVALID_INTENT"
        );
    }

    const nestedSource = [
        "PRINCIPAL()",
        "    si dato == 1",
        "        escribir dato",
        "    escribir 2"
    ].join("\n");
    const nestedWrite = editableNodes(
        nestedSource,
        "write"
    ).find(node =>
        node.identity?.containerId?.endsWith(
            "/then"
        )
    );

    assert.ok(nestedWrite);
    assert.throws(
        () => service.plan({
            sourceCode: nestedSource,
            sourceOrigin: {
                startLine: 1,
                startColumn: 1
            },
            documentVersion: 10,
            expectedDocumentVersion: 10,
            intent:
                createDiagramNodeDeleteIntent(
                    nestedWrite
                )
        }),
        error =>
            error.code ===
                "CLRS_DIAGRAM_EDIT_EMPTY_BLOCK"
    );
});

test("elimina un retorno explícito, muestra Fin y permite materializar otro retorno", () => {
    const source = [
        "CALCULAR(valor)",
        "    resultado = valor",
        "    retornar resultado"
    ].join("\n");
    const service =
        new DiagramSourceEditService();
    const explicitReturn = editableNode(
        source,
        "return"
    );
    const emptyReturnDraft =
        updateDiagramNodeEditorDraft(
            createDiagramNodeEditorDraft(
                explicitReturn
            ),
            "expression",
            ""
        );

    assert.equal(
        explicitReturn.identity.deletable,
        false
    );
    assert.throws(
        () => createDiagramNodeDeleteIntent(
            explicitReturn
        ),
        /cannot be deleted/u
    );
    const removeReturnIntent =
        createDiagramNodeEditIntent(
            emptyReturnDraft
        );
    assert.equal(
        removeReturnIntent.operation,
        "delete-node"
    );
    const deletePlan = service.plan({
        sourceCode: source,
        sourceOrigin: {
            startLine: 1,
            startColumn: 1
        },
        documentVersion: 11,
        expectedDocumentVersion: 11,
        intent: removeReturnIntent
    });
    const withoutReturn = applyPlan(
        source,
        deletePlan
    );
    const implicitReturn = editableNode(
        withoutReturn,
        "return"
    );

    assert.equal(
        withoutReturn,
        [
            "CALCULAR(valor)",
            "    resultado = valor",
            ""
        ].join("\n")
    );
    assert.equal(implicitReturn.label, "Fin");
    assert.equal(implicitReturn.synthetic, true);
    assert.equal(
        implicitReturn.identity.deletable,
        false
    );
    assert.equal(
        implicitReturn.identity.materialization
            ?.kind,
        "implicit-return"
    );

    const draft = updateDiagramNodeEditorDraft(
        createDiagramNodeEditorDraft(
            implicitReturn
        ),
        "expression",
        "resultado"
    );
    const materializeIntent =
        createDiagramNodeEditIntent(draft);
    const insertPlan = service.plan({
        sourceCode: withoutReturn,
        sourceOrigin: {
            startLine: 1,
            startColumn: 1
        },
        documentVersion: 12,
        expectedDocumentVersion: 12,
        intent: materializeIntent
    });
    const restored = applyPlan(
        withoutReturn,
        insertPlan
    );

    assert.equal(
        materializeIntent.operation,
        "insert-node"
    );
    assert.equal(
        restored,
        source + "\n"
    );
    assert.equal(
        new DiagramService()
            .buildFromSource(restored).ok,
        true
    );
});

test("sólo la terminal final de una función queda protegida contra eliminación", () => {
    const source = [
        "CALCULAR(valor)",
        "    retornar valor",
        "    escribir valor",
        "    retornar 0"
    ].join("\n");
    const returns = editableNodes(
        source,
        "return"
    );

    assert.equal(returns.length, 2);
    assert.equal(
        returns[0].identity.deletable,
        true
    );
    assert.equal(
        returns[1].identity.deletable,
        false
    );

    const plan = new DiagramSourceEditService()
        .plan({
            sourceCode: source,
            sourceOrigin: {
                startLine: 1,
                startColumn: 1
            },
            documentVersion: 12,
            expectedDocumentVersion: 12,
            intent:
                createDiagramNodeDeleteIntent(
                    returns[0]
                )
        });
    const nextSource = applyPlan(source, plan);

    assert.doesNotMatch(
        nextSource,
        /retornar valor/u
    );
    assert.match(nextSource, /retornar 0/u);
    assert.equal(
        new DiagramService()
            .buildFromSource(nextSource).ok,
        true
    );
});

test("un retorno único se reduce a un Fin editable sin deshacer la función", () => {
    const source = [
        "IDENTIDAD(valor)",
        "    retornar valor"
    ].join("\n");
    const service =
        new DiagramSourceEditService();
    const explicitReturn = editableNode(
        source,
        "return"
    );
    const emptyReturnDraft =
        updateDiagramNodeEditorDraft(
            createDiagramNodeEditorDraft(
                explicitReturn
            ),
            "expression",
            ""
        );

    assert.equal(
        explicitReturn.identity.deletable,
        false
    );
    const deletePlan = service.plan({
        sourceCode: source,
        sourceOrigin: {
            startLine: 1,
            startColumn: 1
        },
        documentVersion: 13,
        expectedDocumentVersion: 13,
        intent: createDiagramNodeEditIntent(
            emptyReturnDraft
        )
    });
    const withoutValue = applyPlan(
        source,
        deletePlan
    );
    const finish = editableNode(
        withoutValue,
        "return"
    );

    assert.equal(
        withoutValue,
        [
            "IDENTIDAD(valor)",
            "    // Subproceso sin instrucciones"
        ].join("\n")
    );
    assert.equal(finish.label, "Fin");
    assert.equal(finish.synthetic, true);
    assert.equal(finish.identity.editable, true);
    assert.equal(finish.identity.deletable, false);
    assert.throws(
        () => createDiagramNodeDeleteIntent(
            finish
        ),
        /cannot be deleted/u
    );

    const restoreDraft =
        updateDiagramNodeEditorDraft(
            createDiagramNodeEditorDraft(
                finish
            ),
            "expression",
            "valor"
        );
    const restoreIntent =
        createDiagramNodeEditIntent(
            restoreDraft
        );
    const restorePlan = service.plan({
        sourceCode: withoutValue,
        sourceOrigin: {
            startLine: 1,
            startColumn: 1
        },
        documentVersion: 14,
        expectedDocumentVersion: 14,
        intent: restoreIntent
    });

    assert.equal(
        restoreIntent.operation,
        "insert-node"
    );
    assert.equal(
        applyPlan(withoutValue, restorePlan),
        source
    );
});

test("el editor estructural ofrece figuras y valores iniciales según el ámbito", () => {
    const source = [
        "PRINCIPAL()",
        "    dato = 1",
        "    escribir dato"
    ].join("\n");
    const edge = editableEdge(
        source,
        insertion =>
            insertion.containerId ===
                "function_PRINCIPAL/body" &&
            insertion.index === 1
    );
    const initial =
        createDiagramInsertionDraft(edge);
    const changed =
        selectDiagramInsertionFigure(
            initial,
            "for-downto"
        );
    const updated =
        updateDiagramInsertionDraft(
            changed,
            "finalValue",
            "1"
        );

    assert.equal(
        initial.figure,
        "assignment"
    );
    assert.deepEqual(
        getDiagramInsertionPlacement(edge),
        {
            branch: "body",
            branchLabel: "Secuencia del bloque",
            position: "between",
            positionLabel:
                "Entre las instrucciones",
            relation: "sequence",
            relationLabel:
                "Flujo secuencial",
            index: 1
        }
    );
    assert.deepEqual(
        initial.placement,
        getDiagramInsertionPlacement(edge)
    );
    assert.deepEqual(
        initial.values,
        {
            target: "resultado",
            expression: "valor"
        }
    );
    assert.equal(
        getDiagramInsertionFigures(edge)
            .at(-1).figure,
        "return"
    );
    assert.equal(
        updated.values.finalValue,
        "1"
    );
    assert.equal(
        createDiagramInsertionIntent(
            updated
        ).operation,
        "insert-node"
    );

    const topLevelEdge = editableEdge(
        "dato = 1\nescribir dato",
        insertion => insertion.index === 1
    );

    assert.equal(
        getDiagramInsertionFigures(
            topLevelEdge
        ).some(item =>
            item.figure === "return"
        ),
        false
    );
});

test("DiagramSourceEditService inserta las nueve figuras en una conexión segura", () => {
    const source = [
        "AUX(valor)",
        "    retornar valor",
        "PRINCIPAL()",
        "    dato = 1",
        "    escribir dato"
    ].join("\n");
    const edge = editableEdge(
        source,
        insertion =>
            insertion.containerId ===
                "function_PRINCIPAL/body" &&
            insertion.index === 1
    );
    const service =
        new DiagramSourceEditService();
    const cases = [
        ["return", "retornar resultado"],
        ["assignment", "resultado = valor"],
        ["read", "leer dato"],
        ["write", "escribir resultado"],
        [
            "if",
            "si valor == esperado\n        escribir resultado"
        ],
        [
            "while",
            "mientras indice < limite\n        escribir resultado"
        ],
        [
            "for-to",
            "para i = 0 hasta n - 1\n        escribir i"
        ],
        [
            "for-downto",
            "para i = fin bajando inicio\n        escribir i"
        ],
        ["function-call", "PROCESAR(dato)"]
    ];

    for (const [figure, expected] of cases) {
        const draft =
            selectDiagramInsertionFigure(
                createDiagramInsertionDraft(
                    edge
                ),
                figure
            );
        const plan = service.plan({
            sourceCode: source,
            sourceOrigin: {
                startLine: 1,
                startColumn: 1
            },
            documentVersion: 12,
            expectedDocumentVersion: 12,
            intent:
                createDiagramInsertionIntent(
                    draft
                )
        });
        const nextSource = applyPlan(
            source,
            plan
        );

        assert.match(
            nextSource,
            new RegExp(
                expected.replace(
                    /[.*+?^${}()|[\]\\]/gu,
                    "\\$&"
                ),
                "u"
            ),
            `${figure} no fue insertada`
        );
        assert.equal(
            plan.edits[0].expectedText,
            ""
        );
    }
});

test("la inserción estructural respeta ramas y rechaza destinos manipulados", () => {
    const source = [
        "PRINCIPAL()",
        "    si dato == 1",
        "        escribir dato",
        "    escribir 2"
    ].join("\n");
    const edge = editableEdge(
        source,
        insertion =>
            insertion.branch === "then" &&
            insertion.index === 1
    );
    const draft =
        selectDiagramInsertionFigure(
            createDiagramInsertionDraft(edge),
            "assignment"
        );
    const intent =
        createDiagramInsertionIntent(draft);
    const service =
        new DiagramSourceEditService();
    const plan = service.plan({
        sourceCode: source,
        sourceOrigin: {
            startLine: 1,
            startColumn: 1
        },
        documentVersion: 2,
        expectedDocumentVersion: 2,
        intent
    });

    assert.match(
        applyPlan(source, plan),
        /        escribir dato\n        resultado = valor\n    escribir 2/u
    );

    assert.throws(
        () => service.plan({
            sourceCode: source,
            sourceOrigin: {
                startLine: 1,
                startColumn: 1
            },
            documentVersion: 2,
            expectedDocumentVersion: 2,
            intent: {
                ...intent,
                insertion: {
                    ...intent.insertion,
                    index: 99
                }
            }
        }),
        error =>
            error.code ===
                "CLRS_DIAGRAM_EDIT_INSERTION_NOT_FOUND"
    );

    assert.throws(
        () => service.plan({
            sourceCode: source,
            sourceOrigin: {
                startLine: 3,
                startColumn: 5
            },
            documentVersion: 2,
            expectedDocumentVersion: 2,
            intent
        }),
        error =>
            error.code ===
                "CLRS_DIAGRAM_EDIT_UNSAFE_SCOPE"
    );
});

test("la inserción desde flechas conserva límites de sino y ciclos anidados", () => {
    const source = [
        "PRINCIPAL()",
        "    si dato == 1",
        "        escribir \"sí\"",
        "    sino",
        "        escribir \"no\"",
        "    mientras dato < 3",
        "        dato = dato + 1",
        "    escribir dato"
    ].join("\n");
    const service =
        new DiagramSourceEditService();
    const elseEdge = editableEdge(
        source,
        insertion =>
            insertion.branch === "else" &&
            insertion.position === "end"
    );
    const elsePlan = service.plan({
        sourceCode: source,
        sourceOrigin: {
            startLine: 1,
            startColumn: 1
        },
        documentVersion: 13,
        expectedDocumentVersion: 13,
        intent: createDiagramInsertionIntent(
            selectDiagramInsertionFigure(
                createDiagramInsertionDraft(
                    elseEdge
                ),
                "assignment"
            )
        )
    });
    const withElseInsertion = applyPlan(
        source,
        elsePlan
    );

    assert.match(
        withElseInsertion,
        /    sino\n        escribir "no"\n        resultado = valor\n    mientras/u
    );

    const loopEdge = editableEdge(
        source,
        insertion =>
            insertion.containerId.endsWith(
                "/body:while"
            ) &&
            insertion.position === "start"
    );
    const loopPlan = service.plan({
        sourceCode: source,
        sourceOrigin: {
            startLine: 1,
            startColumn: 1
        },
        documentVersion: 14,
        expectedDocumentVersion: 14,
        intent: createDiagramInsertionIntent(
            selectDiagramInsertionFigure(
                createDiagramInsertionDraft(
                    loopEdge
                ),
                "write"
            )
        )
    });

    assert.match(
        applyPlan(source, loopPlan),
        /    mientras dato < 3\n        escribir resultado\n        dato = dato \+ 1/u
    );
    assert.equal(
        getDiagramInsertionPlacement(elseEdge)
            .branchLabel,
        "Rama No"
    );
});

test("la flecha No sin rama crea sino e inserta la figura seleccionada", () => {
    const source = [
        "PRINCIPAL()",
        "    si dato == 1",
        "        escribir \"sí\"",
        "    escribir \"fin\""
    ].join("\n");
    const edge = editableEdge(
        source,
        insertion =>
            insertion.branch === "else" &&
            insertion.index === 0 &&
            insertion.position === "end"
    );
    const draft =
        selectDiagramInsertionFigure(
            createDiagramInsertionDraft(edge),
            "write"
        );
    const service =
        new DiagramSourceEditService();
    const plan = service.plan({
        sourceCode: source,
        sourceOrigin: {
            startLine: 1,
            startColumn: 1
        },
        documentVersion: 15,
        expectedDocumentVersion: 15,
        intent: createDiagramInsertionIntent(
            draft
        )
    });
    const nextSource = applyPlan(
        source,
        plan
    );

    assert.match(
        nextSource,
        /        escribir "sí"\n    sino\n        escribir resultado\n    escribir "fin"/u
    );
});

test("la inserción global conserva el orden alrededor de la llamada PRINCIPAL sintética", () => {
    const source = [
        "AUX(valor)",
        "    retornar valor",
        "PRINCIPAL()",
        "    escribir \"inicio\""
    ].join("\n");
    const edge = editableEdge(
        source,
        insertion =>
            insertion.containerId ===
                "top_level/body" &&
            insertion.position === "end"
    );
    const draft =
        selectDiagramInsertionFigure(
            createDiagramInsertionDraft(edge),
            "write"
        );
    const plan = new DiagramSourceEditService()
        .plan({
            sourceCode: source,
            sourceOrigin: {
                startLine: 1,
                startColumn: 1
            },
            documentVersion: 6,
            expectedDocumentVersion: 6,
            intent:
                createDiagramInsertionIntent(
                    draft
                )
        });
    const nextSource = applyPlan(
        source,
        plan
    );

    assert.match(
        nextSource,
        /    escribir "inicio"\nescribir resultado$/u
    );
    assert.equal(
        new DiagramService()
            .buildFromSource(nextSource).ok,
        true
    );
});

test("la inserción global admite llamadas a funciones declaradas", () => {
    const source = [
        "AUX(valor)",
        "    retornar valor",
        "PRINCIPAL()",
        "    escribir \"inicio\""
    ].join("\n");
    const service =
        new DiagramSourceEditService();

    for (const position of ["start", "end"]) {
        const edge = editableEdge(
            source,
            insertion =>
                insertion.containerId ===
                    "top_level/body" &&
                insertion.position === position
        );
        let draft =
            selectDiagramInsertionFigure(
                createDiagramInsertionDraft(
                    edge
                ),
                "function-call"
            );

        draft = updateDiagramInsertionDraft(
            draft,
            "identifier",
            "AUX"
        );
        draft = updateDiagramInsertionDraft(
            draft,
            "arguments",
            "1"
        );

        const plan = service.plan({
            sourceCode: source,
            sourceOrigin: {
                startLine: 1,
                startColumn: 1
            },
            documentVersion: 7,
            expectedDocumentVersion: 7,
            intent:
                createDiagramInsertionIntent(
                    draft
                )
        });
        const nextSource = applyPlan(
            source,
            plan
        );

        assert.equal(
            nextSource
                .split("\n")
                .filter(line =>
                    line === "AUX(1)"
                ).length,
            1,
            position
        );
        assert.equal(
            new DiagramService()
                .buildFromSource(nextSource).ok,
            true,
            position
        );
    }
});

test("la inserción global vacía admite un subproceso antes de las funciones", () => {
    const source = [
        "function(args)",
        "    var = 0",
        "    tarifa = 0.0",
        "",
        "    prueba(10)",
        "    leer var",
        "    tarifa = 2.0  // tarifa por hora",
        "",
        "    costo = var * tarifa",
        "",
        "",
        "prueba(hola)",
        "    retornar 0"
    ].join("\n");
    const edge = editableEdge(
        source,
        insertion =>
            insertion.containerId ===
                "top_level/body" &&
            insertion.index === 0 &&
            insertion.position === "end"
    );
    let draft = selectDiagramInsertionFigure(
        createDiagramInsertionDraft(edge),
        "function-call"
    );

    draft = updateDiagramInsertionDraft(
        draft,
        "identifier",
        "prueba"
    );
    draft = updateDiagramInsertionDraft(
        draft,
        "arguments",
        "10"
    );

    const plan = new DiagramSourceEditService()
        .plan({
            sourceCode: source,
            sourceOrigin: {
                startLine: 1,
                startColumn: 1
            },
            documentVersion: 8,
            expectedDocumentVersion: 8,
            intent:
                createDiagramInsertionIntent(
                    draft
                )
        });
    const nextSource = applyPlan(
        source,
        plan
    );

    assert.match(
        nextSource,
        /^prueba\(10\)\n\nfunction\(args\)/u
    );
    assert.equal(
        new DiagramService()
            .buildFromSource(nextSource).ok,
        true
    );
});

test("el terminal de inicio enlaza un editor seguro con la declaración", () => {
    const source = [
        "PRINCIPAL(valor)",
        "    retornar valor"
    ].join("\n");
    const node = editableNode(
        source,
        "function-declaration"
    );
    const draft = createDiagramNodeEditorDraft(
        node
    );
    const updated = updateDiagramNodeEditorDraft(
        draft,
        "parameters",
        "dato"
    );
    const plan = new DiagramSourceEditService()
        .plan({
            sourceCode: source,
            sourceOrigin: {
                startLine: 1,
                startColumn: 1
            },
            documentVersion: 9,
            expectedDocumentVersion: 9,
            intent:
                createDiagramNodeEditIntent(
                    updated
                )
        });
    const nextSource = applyPlan(
        source,
        plan
    );

    assert.equal(
        node.identity.deletable,
        true
    );
    assert.equal(
        draft.title,
        "Subproceso · función"
    );
    assert.match(
        nextSource,
        /^PRINCIPAL\(dato\)/u
    );
    assert.equal(
        new DiagramService()
            .buildFromSource(nextSource).ok,
        true
    );
});

test("la llamada PRINCIPAL derivada abre una consulta de subproceso de solo lectura", () => {
    const source = [
        "PRINCIPAL(valor)",
        "    retornar valor"
    ].join("\n");
    const node = editableNodes(
        source,
        "function-call"
    ).find(candidate =>
        candidate.synthetic === true
    );

    assert.ok(node);
    assert.equal(node.identity.deletable, false);
    assert.equal(node.identity.readOnly, true);
    const draft = createDiagramNodeEditorDraft(
        node
    );
    assert.equal(
        draft.title,
        "Subproceso · llamada"
    );
    assert.deepEqual(draft.values, {
        identifier: "PRINCIPAL",
        arguments: "valor"
    });
    assert.equal(draft.readOnly, true);

    assert.throws(
        () => updateDiagramNodeEditorDraft(
            draft,
            "arguments",
            "dato"
        ),
        /Read-only diagram nodes/u
    );

    assert.throws(
        () => createDiagramNodeEditIntent(
            draft
        ),
        /cannot produce edit intents/u
    );

    const forgedIntent =
        createDiagramNodeEditIntent({
            ...draft,
            readOnly: false,
            values: {
                ...draft.values,
                arguments: "dato"
            }
        });

    assert.throws(
        () => new DiagramSourceEditService()
            .plan({
            sourceCode: source,
            sourceOrigin: {
                startLine: 1,
                startColumn: 1
            },
            documentVersion: 10,
            expectedDocumentVersion: 10,
            intent: forgedIntent
            }),
        error =>
            error.code ===
                "CLRS_DIAGRAM_EDIT_READ_ONLY"
    );
});

test("edita identificador y parámetros desde el inicio de una función", () => {
    const source = [
        "SUMA(a, b)",
        "    retornar a + b",
        "PRINCIPAL()",
        "    escribir SUMA(1, 2)"
    ].join("\n");
    const node = editableNodes(
        source,
        "function-declaration"
    ).find(candidate =>
        candidate.identity?.id ===
            "node:function_SUMA/declaration"
    );

    assert.ok(node);
    let draft = createDiagramNodeEditorDraft(
        node
    );
    assert.deepEqual(draft.values, {
        identifier: "SUMA",
        parameters: "a, b"
    });

    draft = updateDiagramNodeEditorDraft(
        draft,
        "identifier",
        "COMBINAR"
    );
    draft = updateDiagramNodeEditorDraft(
        draft,
        "parameters",
        "izquierda, derecha"
    );

    const plan = new DiagramSourceEditService()
        .plan({
            sourceCode: source,
            sourceOrigin: {
                startLine: 1,
                startColumn: 1
            },
            documentVersion: 10,
            expectedDocumentVersion: 10,
            intent:
                createDiagramNodeEditIntent(
                    draft
                )
        });
    const nextSource = applyPlan(source, plan);

    assert.match(
        nextSource,
        /^COMBINAR\(izquierda, derecha\)/u
    );
    assert.match(
        nextSource,
        /    retornar a \+ b/u
    );
});

test("elimina una función completa desde su terminal de inicio", () => {
    const source = [
        "AUXILIAR(valor)",
        "    si valor > 0",
        "        escribir valor",
        "    sino",
        "        escribir 0",
        "    retornar valor",
        "",
        "PRINCIPAL()",
        "    escribir \"inicio\""
    ].join("\n");
    const node = editableNodes(
        source,
        "function-declaration"
    ).find(candidate =>
        candidate.identity?.id ===
            "node:function_AUXILIAR/declaration"
    );

    assert.ok(node);
    const intent =
        createDiagramNodeDeleteIntent(node);
    assert.equal(
        intent.confirmation.impact,
        "function"
    );

    const plan = new DiagramSourceEditService()
        .plan({
            sourceCode: source,
            sourceOrigin: {
                startLine: 1,
                startColumn: 1
            },
            documentVersion: 11,
            expectedDocumentVersion: 11,
            intent
        });
    const nextSource = applyPlan(source, plan);

    assert.equal(
        nextSource,
        [
            "PRINCIPAL()",
            "    escribir \"inicio\""
        ].join("\n")
    );
    assert.doesNotMatch(
        nextSource,
        /AUXILIAR|retornar valor/u
    );
});

test("eliminar PRINCIPAL retira también su llamada sintética global", () => {
    const source = [
        "AUXILIAR(valor)",
        "    retornar valor",
        "",
        "PRINCIPAL()",
        "    escribir AUXILIAR(1)"
    ].join("\n");
    const node = editableNodes(
        source,
        "function-declaration"
    ).find(candidate =>
        candidate.identity?.id ===
            "node:function_PRINCIPAL/declaration"
    );

    assert.ok(node);
    const plan = new DiagramSourceEditService()
        .plan({
            sourceCode: source,
            sourceOrigin: {
                startLine: 1,
                startColumn: 1
            },
            documentVersion: 12,
            expectedDocumentVersion: 12,
            intent:
                createDiagramNodeDeleteIntent(
                    node
                )
        });
    const nextSource = applyPlan(source, plan);
    const nextDiagram = new DiagramService()
        .buildFromSource(nextSource);

    assert.equal(
        nextSource.trimEnd(),
        [
            "AUXILIAR(valor)",
            "    retornar valor"
        ].join("\n")
    );
    assert.equal(nextDiagram.ok, true);
    assert.equal(
        getDiagramEntities(
            nextDiagram.value.diagram
        ).some(entity =>
            /PRINCIPAL/u.test(
                entity.label ?? ""
            )
        ),
        false
    );
});

test("el editor de funciones genera una intención estructural para la firma", () => {
    const draft =
        createDiagramFunctionDraft();
    const renamed =
        updateDiagramFunctionDraft(
            draft,
            "identifier",
            "CALCULAR"
        );

    assert.deepEqual(
        draft.values,
        {
            identifier: "FUNCION",
            parameters: "parametro"
        }
    );
    assert.deepEqual(
        createDiagramFunctionIntent(
            renamed
        ),
        {
            schemaVersion: 1,
            operation: "create-function",
            identityId:
                "document:functions",
            figure:
                "function-declaration",
            values: {
                identifier: "CALCULAR",
                parameters: "parametro"
            }
        }
    );
});

test("DiagramSourceEditService crea una función con retorno válido antes de PRINCIPAL", () => {
    const source = [
        "AUX(valor)",
        "    retornar valor",
        "PRINCIPAL()",
        "    escribir \"inicio\""
    ].join("\n");
    let draft =
        createDiagramFunctionDraft();

    draft = updateDiagramFunctionDraft(
        draft,
        "identifier",
        "CALCULAR"
    );
    draft = updateDiagramFunctionDraft(
        draft,
        "parameters",
        "dato, limite"
    );

    const plan = new DiagramSourceEditService()
        .plan({
            sourceCode: source,
            sourceOrigin: {
                startLine: 1,
                startColumn: 1
            },
            wholeDocument: true,
            documentVersion: 15,
            expectedDocumentVersion: 15,
            intent:
                createDiagramFunctionIntent(
                    draft
                )
        });
    const nextSource = applyPlan(
        source,
        plan
    );

    assert.equal(
        plan.operation,
        "create-function"
    );
    assert.match(
        nextSource,
        /AUX\(valor\)[\s\S]*CALCULAR\(dato, limite\)\n    retornar 0\n\nPRINCIPAL\(\)/u
    );
    assert.equal(
        new DiagramService()
            .buildFromSource(nextSource).ok,
        true
    );
});

test("la creación de funciones rechaza duplicados y diagramas parciales", () => {
    const source = [
        "PRINCIPAL()",
        "    escribir 1"
    ].join("\n");
    let duplicateDraft =
        createDiagramFunctionDraft();

    duplicateDraft =
        updateDiagramFunctionDraft(
            duplicateDraft,
            "identifier",
            "PRINCIPAL"
        );
    const duplicateIntent =
        createDiagramFunctionIntent(
            duplicateDraft
        );
    const service =
        new DiagramSourceEditService();

    assert.throws(
        () => service.plan({
            sourceCode: source,
            sourceOrigin: {
                startLine: 1,
                startColumn: 1
            },
            wholeDocument: true,
            documentVersion: 16,
            expectedDocumentVersion: 16,
            intent: duplicateIntent
        }),
        error =>
            error.code ===
                "CLRS_DIAGRAM_EDIT_DUPLICATE_FUNCTION"
    );

    assert.throws(
        () => service.plan({
            sourceCode: source,
            sourceOrigin: {
                startLine: 4,
                startColumn: 1
            },
            wholeDocument: false,
            documentVersion: 16,
            expectedDocumentVersion: 16,
            intent:
                createDiagramFunctionIntent(
                    createDiagramFunctionDraft()
                )
        }),
        error =>
            error.code ===
                "CLRS_DIAGRAM_EDIT_FUNCTION_SCOPE"
    );
});

test("la creación de una función sin parámetros produce un retorno válido", () => {
    const draft = updateDiagramFunctionDraft(
        createDiagramFunctionDraft(),
        "parameters",
        ""
    );
    const plan = new DiagramSourceEditService()
        .plan({
            sourceCode: "",
            sourceOrigin: {
                startLine: 1,
                startColumn: 1
            },
            wholeDocument: true,
            documentVersion: 1,
            expectedDocumentVersion: 1,
            intent:
                createDiagramFunctionIntent(
                    draft
                )
        });

    assert.equal(
        applyPlan("", plan),
        "FUNCION()\n    retornar 0\n"
    );
});

test("DiagramModelStore conserva el último modelo válido", () => {
    const store =
        createWebviewApplication().store;
    const statuses = [];
    const unsubscribe = store.subscribe(
        state => {
            statuses.push(state.status);
        }
    );

    const ready =
        store.setSource("dato = 1");
    const validModel = ready.model;
    const failed =
        store.setSource("si");

    unsubscribe();

    assert.equal(
        ready.status,
        DiagramModelStatus.READY
    );
    assert.equal(
        failed.status,
        DiagramModelStatus.ERROR
    );
    assert.equal(
        failed.model,
        validModel
    );
    assert.equal(
        failed.errors[0].phase,
        "parser"
    );
    assert.deepEqual(
        statuses,
        [
            "loading",
            "ready",
            "loading",
            "error"
        ]
    );
});

test("DiagramModelStore vuelve al estado inicial con fuente vacía", () => {
    const store =
        createWebviewApplication().store;

    store.setSource("dato = 1");
    const state = store.setSource("");

    assert.equal(
        state.status,
        DiagramModelStatus.IDLE
    );
    assert.equal(state.ast, null);
    assert.deepEqual(
        state.model,
        createDefaultDiagram()
    );
});

test("WebviewBridge recibe fuente, exporta SVG y limpia listeners", async () => {
    const eventTarget =
        new FakeEventTarget();
    const messages = [];
    const sources = [];
    const sourceVersions = [];
    const wholeDocumentFlags = [];
    const semanticDiagnostics = [];
    const selections = [];
    const executionMessages = [];
    const coverageMessages = [];
    const editResults = [];
    let acquireCount = 0;
    const bridge = new WebviewBridge({
        eventTarget,
        acquireVsCodeApi() {
            acquireCount += 1;

            return {
                postMessage(message) {
                    messages.push(message);
                }
            };
        },
        exportSvg: async () =>
            "<svg></svg>",
        logger: silentLogger()
    });
    const disconnect = bridge.connect({
        onSource(
            source,
            sourceOrigin,
            documentVersion,
            wholeDocument,
            diagnostics
        ) {
            sources.push(source);
            sourceVersions.push(
                documentVersion
            );
            wholeDocumentFlags.push(
                wholeDocument
            );
            semanticDiagnostics.push(
                diagnostics
            );
        },
        onSelection(location) {
            selections.push(location);
        },
        onExecutionTrace(message) {
            executionMessages.push(message);
        },
        onTestCoverage(message) {
            coverageMessages.push(message);
        },
        onDiagramEditResult(message) {
            editResults.push(message);
        }
    });

    eventTarget.dispatch({
        data: {
            type: "source",
            source: "dato = 1",
            sourceOrigin: {
                startLine: 4,
                startColumn: 5
            },
            documentVersion: 11,
            wholeDocument: true,
            semanticDiagnostics: [{
                code: "CLRS_SEMANTIC_TEST",
                message: "Identificador no definido.",
                phase: "semantic",
                severity: "error",
                location: {
                    startLine: 4,
                    startColumn: 5
                }
            }],
            selection: {
                startLine: 4,
                startColumn: 5
            }
        }
    });
    eventTarget.dispatch({
        data: {
            type: "test-coverage",
            coverage: {
                revision: 1,
                points: []
            }
        }
    });
    eventTarget.dispatch({
        data: {
            type: "selection",
            location: {
                startLine: 5,
                startColumn: 9
            }
        }
    });
    eventTarget.dispatch({
        data: {
            type: "diagram-edit-result",
            requestId: "diagram-edit-1",
            ok: true
        }
    });
    eventTarget.dispatch({
        data: {
            type: "execution-event",
            event: {
                type: "steps",
                traceId: "execution-1",
                steps: []
            }
        }
    });
    await bridge.handleMessage({
        data: {
            type: "export-svg"
        }
    });
    bridge.navigateToLocation(
        {
            startLine: 4,
            startColumn: 5
        },
        "N2"
    );
    const editRequestId =
        bridge.requestDiagramEdit(
            {
                schemaVersion: 1,
                operation: "update-node"
            },
            11
        );
    const saveRequested =
        bridge.requestDocumentSave();
    const executionRequested =
        bridge.requestCodeExecution();
    const stopRequested =
        bridge.requestCodeStop();
    disconnect();
    eventTarget.dispatch({
        data: {
            type: "source",
            source: "dato = 2"
        }
    });

    bridge.connect();
    bridge.disconnect();

    assert.deepEqual(
        sources,
        ["dato = 1"]
    );
    assert.deepEqual(
        sourceVersions,
        [11]
    );
    assert.deepEqual(
        wholeDocumentFlags,
        [true]
    );
    assert.equal(
        semanticDiagnostics[0][0].code,
        "CLRS_SEMANTIC_TEST"
    );
    assert.deepEqual(
        selections,
        [
            {
                startLine: 4,
                startColumn: 5
            },
            {
                startLine: 5,
                startColumn: 9
            }
        ]
    );
    assert.deepEqual(
        executionMessages,
        [{
            type: "execution-event",
            event: {
                type: "steps",
                traceId: "execution-1",
                steps: []
            }
        }]
    );
    assert.deepEqual(
        coverageMessages,
        [{
            type: "test-coverage",
            coverage: {
                revision: 1,
                points: []
            }
        }]
    );
    assert.deepEqual(
        editResults,
        [{
            type: "diagram-edit-result",
            requestId: "diagram-edit-1",
            ok: true
        }]
    );
    assert.equal(
        editRequestId,
        "diagram-edit-1"
    );
    assert.equal(saveRequested, true);
    assert.equal(executionRequested, true);
    assert.equal(stopRequested, true);
    assert.deepEqual(
        messages,
        [
            {
                type: "webview-ready"
            },
            {
                type: "svg",
                svg:
                    "<svg></svg>"
            },
            {
                type: "navigate",
                location: {
                    startLine: 4,
                    startColumn: 5
                },
                nodeId: "N2"
            },
            {
                type: "diagram-edit",
                requestId:
                    "diagram-edit-1",
                expectedDocumentVersion: 11,
                intent: {
                    schemaVersion: 1,
                    operation: "update-node"
                }
            },
            {
                type: "save-document"
            },
            {
                type: "execute-document"
            },
            {
                type: "stop-document"
            },
            {
                type: "webview-ready"
            }
        ]
    );
    assert.equal(acquireCount, 1);
    assert.equal(
        eventTarget.listenerCount,
        0
    );
});

test("WebviewBridge funciona fuera de VS Code", async () => {
    const eventTarget =
        new FakeEventTarget();
    const warnings = [];
    let receivedSource = null;
    const bridge = new WebviewBridge({
        eventTarget,
        acquireVsCodeApi: null,
        logger: {
            warn(message) {
                warnings.push(message);
            },
            error() {}
        }
    });

    bridge.connect({
        onSource(source) {
            receivedSource = source;
        }
    });
    eventTarget.dispatch({
        data: {
            type: "source",
            source: "dato = 1"
        }
    });
    const exportResult =
        await bridge.handleMessage({
            data: {
                type: "export-svg"
            }
        });

    bridge.disconnect();

    assert.equal(
        receivedSource,
        "dato = 1"
    );
    assert.equal(
        exportResult.handled,
        false
    );
    assert.equal(
        bridge.navigateToLocation({
            startLine: 1,
            startColumn: 1
        }),
        false
    );
    assert.equal(
        bridge.requestDiagramEdit({}, 1),
        null
    );
    assert.equal(
        bridge.requestDocumentSave(),
        false
    );
    assert.equal(
        bridge.requestCodeExecution(),
        false
    );
    assert.deepEqual(
        warnings,
        ["Running outside VS Code."]
    );
});

class FakeEventTarget {

    constructor() {
        this.listeners = new Set();
    }

    get listenerCount() {
        return this.listeners.size;
    }

    addEventListener(type, listener) {
        if (type === "message") {
            this.listeners.add(listener);
        }
    }

    removeEventListener(type, listener) {
        if (type === "message") {
            this.listeners.delete(listener);
        }
    }

    dispatch(event) {
        for (const listener of this.listeners) {
            listener(event);
        }
    }
}

function silentLogger() {
    return {
        warn() {},
        error() {}
    };
}

function editableNode(source, figure) {
    return editableNodes(source, figure)[0];
}

function editableNodes(source, figure) {
    const result = new DiagramService()
        .buildFromSource(source);

    assert.equal(result.ok, true);

    return getDiagramEntities(
        result.value.diagram
    ).filter(entity =>
        entity.identity?.entityType ===
            "node" &&
        entity.identity?.figure === figure
    );
}

function editableEdge(source, predicate) {
    const result = new DiagramService()
        .buildFromSource(source);

    assert.equal(result.ok, true);

    const edge = getDiagramEntities(
        result.value.diagram
    ).find(entity =>
        entity.identity?.entityType ===
            "edge" &&
        entity.identity.editable === true &&
        predicate(entity.identity.insertion)
    );

    assert.ok(edge);

    return edge;
}

function applyPlan(source, plan) {
    return [...plan.edits]
        .sort(
            (left, right) =>
                right.startOffset -
                left.startOffset
        )
        .reduce(
            (current, edit) =>
                current.slice(
                    0,
                    edit.startOffset
                ) +
                edit.newText +
                current.slice(
                    edit.endOffset
                ),
            source
        );
}
