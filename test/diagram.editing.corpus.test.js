import assert from "node:assert/strict";
import {
    readFileSync
} from "node:fs";
import test from "node:test";

import {
    createDiagramFunctionDraft,
    createDiagramFunctionIntent,
    updateDiagramFunctionDraft
} from "../frontend/src/editor/DiagramFunctionEditorModel.js";
import {
    createDiagramInsertionDraft,
    createDiagramInsertionIntent,
    selectDiagramInsertionFigure
} from "../frontend/src/editor/DiagramInsertionEditorModel.js";
import {
    createDiagramNodeDeleteIntent,
    createDiagramNodeEditIntent,
    createDiagramNodeEditorDraft,
    updateDiagramNodeEditorDraft
} from "../frontend/src/editor/DiagramNodeEditorModel.js";
import {
    getDiagramEntities
} from "../frontend/src/visitor/DiagramEditableIdentity.js";
import {
    DIAGRAM_EDITABLE_FIGURES,
    DIAGRAM_NODE_EDIT_OPERATIONS,
    DIAGRAM_STRUCTURAL_FIGURES
} from "../src/diagram/editing/DiagramEditSchema.js";
import {
    DiagramSourceEditService
} from "../src/diagram/editing/DiagramSourceEditService.js";
import {
    DiagramService
} from "../frontend/src/services/DiagramService.js";

const corpus = JSON.parse(
    readFileSync(
        new URL(
            "./fixtures/diagram-editing-corpus.v1.json",
            import.meta.url
        ),
        "utf8"
    )
);

const SOURCE = [
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

test("el corpus de edición visual es versionado, completo y trazable", () => {
    assert.equal(corpus.schemaVersion, 1);
    assert.equal(
        corpus.suite,
        "CLRS flowchart visual editing regression corpus"
    );
    assert.deepEqual(corpus.syntax, {
        assignment: "=",
        equality: "=="
    });
    assert.deepEqual(
        corpus.editableFigures,
        Object.values(
            DIAGRAM_EDITABLE_FIGURES
        )
    );
    assert.deepEqual(
        corpus.operations,
        Object.values(
            DIAGRAM_NODE_EDIT_OPERATIONS
        )
    );

    const identifiers = corpus.cases
        .map(item => item.id);
    const coveredAreas = new Set(
        corpus.cases.map(item => item.area)
    );

    assert.equal(
        new Set(identifiers).size,
        identifiers.length,
        "El corpus no admite identificadores duplicados."
    );
    assert.deepEqual(
        [...coveredAreas].sort(),
        [...corpus.requiredAreas].sort()
    );
    assert.equal(corpus.cases.length >= 20, true);

    const packageJson = JSON.parse(
        readFileSync(
            new URL("../package.json", import.meta.url),
            "utf8"
        )
    );
    const unitScript =
        packageJson.scripts["test:unit"];

    assert.equal(
        unitScript.includes(
            "test/diagram.editing.corpus.test.js"
        ),
        true,
        "El corpus debe formar parte de la suite unitaria de release."
    );

    for (const item of corpus.cases) {
        assert.equal(
            corpus.requiredAreas.includes(
                item.area
            ),
            true,
            item.id
        );
        assert.equal(
            typeof item.requirement === "string" &&
                item.requirement.length > 30,
            true,
            item.id
        );
        assert.equal(
            Array.isArray(item.evidence) &&
                item.evidence.length > 0,
            true,
            item.id
        );

        for (const evidence of item.evidence) {
            const source = readFileSync(
                new URL(
                    `../${evidence.file}`,
                    import.meta.url
                ),
                "utf8"
            );

            assert.equal(
                source.includes(
                    evidence.testNeedle
                ),
                true,
                `${item.id}:${evidence.testNeedle}`
            );
            assert.equal(
                unitScript.includes(
                    evidence.file
                        .split("/")
                        .at(-1)
                ),
                true,
                `${item.id}:${evidence.file}`
            );
        }
    }
});

test("el corpus cubre las nueve figuras y sus identidades seguras", () => {
    const diagram = buildDiagram(SOURCE);
    const entities = getDiagramEntities(
        diagram
    );
    const editableNodes = entities.filter(
        entity =>
            entity.identity?.entityType ===
                "node" &&
            entity.identity.editable === true
    );
    const editableEdges = entities.filter(
        entity =>
            entity.identity?.entityType ===
                "edge" &&
            entity.identity.editable === true
    );
    const figures = new Set(
        editableNodes.map(
            entity => entity.identity.figure
        )
    );
    const ordinaryFigures = new Set(
        [...figures].filter(
            figure => figure !==
                DIAGRAM_STRUCTURAL_FIGURES
                    .FUNCTION_DECLARATION
        )
    );
    const identityIds = entities
        .map(entity => entity.identity?.id)
        .filter(Boolean);

    assert.deepEqual(
        [...ordinaryFigures].sort(),
        [...corpus.editableFigures].sort()
    );
    assert.equal(
        figures.has(
            DIAGRAM_STRUCTURAL_FIGURES
                .FUNCTION_DECLARATION
        ),
        true
    );
    assert.equal(editableEdges.length > 0, true);
    assert.equal(
        new Set(identityIds).size,
        identityIds.length
    );

    for (const entity of [
        ...editableNodes,
        ...editableEdges
    ]) {
        assert.equal(
            Object.isFrozen(entity.identity),
            true
        );
        assert.equal(
            Object.prototype.propertyIsEnumerable
                .call(entity, "identity"),
            false
        );
    }
});

test("recorre actualización, inserción, eliminación y creación de función", () => {
    const service =
        new DiagramSourceEditService();
    let source = SOURCE;
    let version = 1;

    const assignment = findNode(
        source,
        "assignment",
        node =>
            node.identity.editor.target ===
            "dato"
    );
    const assignmentDraft =
        updateDiagramNodeEditorDraft(
            createDiagramNodeEditorDraft(
                assignment
            ),
            "expression",
            "2"
        );

    source = applyPlan(
        source,
        service.plan({
            sourceCode: source,
            sourceOrigin: origin(),
            wholeDocument: true,
            documentVersion: version,
            expectedDocumentVersion: version,
            intent:
                createDiagramNodeEditIntent(
                    assignmentDraft
                )
        })
    );
    version += 1;

    const insertionEdge = findEdge(
        source,
        insertion =>
            insertion.containerId ===
                "function_PRINCIPAL/body" &&
            insertion.index === 1
    );
    const insertionDraft =
        selectDiagramInsertionFigure(
            createDiagramInsertionDraft(
                insertionEdge
            ),
            "write"
        );

    source = applyPlan(
        source,
        service.plan({
            sourceCode: source,
            sourceOrigin: origin(),
            wholeDocument: true,
            documentVersion: version,
            expectedDocumentVersion: version,
            intent:
                createDiagramInsertionIntent(
                    insertionDraft
                )
        })
    );
    version += 1;

    const whileNode = findNode(
        source,
        "while"
    );
    source = applyPlan(
        source,
        service.plan({
            sourceCode: source,
            sourceOrigin: origin(),
            wholeDocument: true,
            documentVersion: version,
            expectedDocumentVersion: version,
            intent:
                createDiagramNodeDeleteIntent(
                    whileNode
                )
        })
    );
    version += 1;

    let functionDraft =
        createDiagramFunctionDraft();
    functionDraft =
        updateDiagramFunctionDraft(
            functionDraft,
            "identifier",
            "DOBLE"
        );
    functionDraft =
        updateDiagramFunctionDraft(
            functionDraft,
            "parameters",
            "valor"
        );
    source = applyPlan(
        source,
        service.plan({
            sourceCode: source,
            sourceOrigin: origin(),
            wholeDocument: true,
            documentVersion: version,
            expectedDocumentVersion: version,
            intent:
                createDiagramFunctionIntent(
                    functionDraft
                )
        })
    );

    assert.match(source, /    dato = 2/u);
    assert.match(
        source,
        /    dato = 2\n    escribir resultado\n    leer dato/u
    );
    assert.doesNotMatch(source, /mientras/u);
    assert.match(
        source,
        /DOBLE\(valor\)\n    retornar 0\n\nPRINCIPAL\(\)/u
    );
    assert.equal(
        new DiagramService()
            .buildFromSource(source).ok,
        true
    );
});

test("el corpus enumera los cortafuegos de edición estructurada", () => {
    assert.deepEqual(
        corpus.safetyCodes,
        [
            "CLRS_DIAGRAM_EDIT_STALE_DOCUMENT",
            "CLRS_DIAGRAM_EDIT_INSERTION_NOT_FOUND",
            "CLRS_DIAGRAM_EDIT_UNSAFE_SCOPE",
            "CLRS_DIAGRAM_EDIT_FUNCTION_SCOPE",
            "CLRS_DIAGRAM_EDIT_DUPLICATE_FUNCTION",
            "CLRS_DIAGRAM_EDIT_EMPTY_BLOCK",
            "CLRS_DIAGRAM_EDIT_READ_ONLY",
            "CLRS_DIAGRAM_EDIT_INVALID_VALUE",
            "CLRS_DIAGRAM_EDIT_INVALID_RESULT"
        ]
    );

    const assignment = findNode(
        SOURCE,
        "assignment"
    );
    const service =
        new DiagramSourceEditService();

    assert.throws(
        () => service.plan({
            sourceCode: SOURCE,
            sourceOrigin: origin(),
            wholeDocument: true,
            documentVersion: 2,
            expectedDocumentVersion: 1,
            intent:
                createDiagramNodeEditIntent(
                    createDiagramNodeEditorDraft(
                        assignment
                    )
                )
        }),
        error =>
            corpus.safetyCodes.includes(
                error.code
            ) &&
            error.code ===
                "CLRS_DIAGRAM_EDIT_STALE_DOCUMENT"
    );
});

function buildDiagram(source) {
    const result = new DiagramService()
        .buildFromSource(source);

    assert.equal(result.ok, true);

    return result.value.diagram;
}

function findNode(
    source,
    figure,
    predicate = () => true
) {
    const node = getDiagramEntities(
        buildDiagram(source)
    ).find(entity =>
        entity.identity?.entityType ===
            "node" &&
        entity.identity.figure === figure &&
        predicate(entity)
    );

    assert.ok(node, `No se encontró ${figure}.`);

    return node;
}

function findEdge(source, predicate) {
    const edge = getDiagramEntities(
        buildDiagram(source)
    ).find(entity =>
        entity.identity?.entityType ===
            "edge" &&
        entity.identity.editable === true &&
        predicate(entity.identity.insertion)
    );

    assert.ok(edge, "No se encontró la conexión editable.");

    return edge;
}

function origin() {
    return {
        startLine: 1,
        startColumn: 1
    };
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
