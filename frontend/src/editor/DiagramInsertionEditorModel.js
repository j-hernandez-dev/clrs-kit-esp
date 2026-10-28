import {
    DIAGRAM_EDITABLE_FIGURES,
    DIAGRAM_ENTITY_TYPES,
    getDiagramIdentity
} from "../visitor/DiagramEditableIdentity.js";
import {
    DIAGRAM_NODE_EDIT_OPERATIONS
} from "../../../src/diagram/editing/DiagramEditSchema.js";
import {
    getDiagramNodeFigureDefinition
} from "./DiagramNodeEditorModel.js";

export const DIAGRAM_INSERTION_FIGURES =
    deepFreeze([
        choice(
            DIAGRAM_EDITABLE_FIGURES.ASSIGNMENT,
            "Proceso",
            "Asignación",
            "▭"
        ),
        choice(
            DIAGRAM_EDITABLE_FIGURES.READ,
            "Entrada",
            "Leer datos",
            "▱"
        ),
        choice(
            DIAGRAM_EDITABLE_FIGURES.WRITE,
            "Salida",
            "Escribir datos",
            "▱"
        ),
        choice(
            DIAGRAM_EDITABLE_FIGURES.IF,
            "Decisión",
            "Condición si",
            "◇"
        ),
        choice(
            DIAGRAM_EDITABLE_FIGURES.WHILE,
            "Bucle",
            "Mientras",
            "↻"
        ),
        choice(
            DIAGRAM_EDITABLE_FIGURES.FOR_TO,
            "Preparación",
            "Para ascendente",
            "⇡"
        ),
        choice(
            DIAGRAM_EDITABLE_FIGURES.FOR_DOWNTO,
            "Preparación",
            "Para descendente",
            "⇣"
        ),
        choice(
            DIAGRAM_EDITABLE_FIGURES.FUNCTION_CALL,
            "Subproceso",
            "Llamada",
            "▣"
        ),
        choice(
            DIAGRAM_EDITABLE_FIGURES.RETURN,
            "Terminal",
            "Retorno",
            "◉"
        )
    ]);

export function getDiagramInsertionFigures(
    edge
) {
    const identity = requireEditableEdge(edge);
    const insideFunction = String(
        identity.insertion?.scopeId ?? ""
    ).startsWith("function_");

    return Object.freeze(
        DIAGRAM_INSERTION_FIGURES.filter(
            item =>
                insideFunction ||
                item.figure !==
                    DIAGRAM_EDITABLE_FIGURES.RETURN
        )
    );
}

export function createDiagramInsertionDraft(
    edge,
    figure = DIAGRAM_EDITABLE_FIGURES
        .ASSIGNMENT
) {
    const identity = requireEditableEdge(edge);
    const choices =
        getDiagramInsertionFigures(edge);
    const selected = choices.find(
        item => item.figure === figure
    ) ?? choices[0];
    const definition =
        getDiagramNodeFigureDefinition(
            selected.figure
        );

    return deepFreeze({
        schemaVersion: 1,
        identityId: identity.id,
        edgeId: identity.modelId,
        relation: identity.relation,
        insertion: identity.insertion,
        placement:
            createDiagramInsertionPlacement(
                identity
            ),
        choices,
        figure: selected.figure,
        title: definition.title,
        fields: definition.fields,
        values: createDefaultValues(
            definition
        )
    });
}

export function getDiagramInsertionPlacement(
    edge
) {
    return createDiagramInsertionPlacement(
        requireEditableEdge(edge)
    );
}

export function selectDiagramInsertionFigure(
    draft,
    figure
) {
    if (
        !draft?.choices?.some(
            item => item.figure === figure
        )
    ) {
        throw new Error(
            `Unsupported insertion figure: ${figure}`
        );
    }

    const definition =
        getDiagramNodeFigureDefinition(figure);

    return deepFreeze({
        ...draft,
        figure,
        title: definition.title,
        fields: definition.fields,
        values: createDefaultValues(
            definition
        )
    });
}

export function updateDiagramInsertionDraft(
    draft,
    fieldName,
    value
) {
    if (
        !draft?.fields?.some(
            field => field.name === fieldName
        )
    ) {
        throw new Error(
            `Unknown diagram insertion field: ${fieldName}`
        );
    }

    return deepFreeze({
        ...draft,
        values: {
            ...draft.values,
            [fieldName]: String(value ?? "")
        }
    });
}

export function validateDiagramInsertionDraft(
    draft
) {
    const missingFields = (draft?.fields ?? [])
        .filter(field =>
            field.required === true &&
            String(
                draft.values?.[field.name] ?? ""
            ).trim() === ""
        )
        .map(field => field.name);

    return Object.freeze({
        valid:
            Boolean(draft?.figure) &&
            missingFields.length === 0,
        missingFields:
            Object.freeze(missingFields)
    });
}

export function createDiagramInsertionIntent(
    draft
) {
    const validation =
        validateDiagramInsertionDraft(draft);

    if (!validation.valid) {
        throw new Error(
            "The diagram insertion draft is incomplete."
        );
    }

    return deepFreeze({
        schemaVersion: 1,
        operation:
            DIAGRAM_NODE_EDIT_OPERATIONS.INSERT,
        identityId: draft.identityId,
        edgeId: draft.edgeId,
        relation: draft.relation,
        insertion: draft.insertion,
        figure: draft.figure,
        values: { ...draft.values }
    });
}

function requireEditableEdge(edge) {
    const identity = getDiagramIdentity(edge);

    if (
        identity?.entityType !==
            DIAGRAM_ENTITY_TYPES.EDGE ||
        identity.editable !== true ||
        !identity.insertion
    ) {
        throw new Error(
            "An editable diagram edge is required."
        );
    }

    return identity;
}

function createDefaultValues(definition) {
    return Object.fromEntries(
        definition.fields.map(field => [
            field.name,
            String(
                definition.defaults[
                    field.name
                ] ?? ""
            )
        ])
    );
}

function createDiagramInsertionPlacement(
    identity
) {
    const insertion = identity.insertion;
    const branchLabel =
        insertion.branch === "body" &&
        /\/body:(?:while|for)$/u.test(
            insertion.containerId
        )
            ? "Cuerpo del ciclo"
            : ({
        body: "Secuencia del bloque",
        then: "Rama Sí",
        else: "Rama No"
    })[insertion.branch] ??
        `Rama ${insertion.branch}`;
    const positionLabel = ({
        start: "Antes de la primera instrucción",
        end: "Después de la última instrucción",
        between: "Entre las instrucciones"
    })[insertion.position] ??
        "Punto estructural validado";
    const relationLabel = ({
        sequence: "Flujo secuencial",
        entry: "Entrada al bloque",
        exit: "Salida del bloque",
        branch: "Flujo condicional",
        "branch-chain": "Alternativa condicional",
        merge: "Unión de ramas",
        "loop-entry": "Entrada al ciclo",
        "loop-back": "Retorno del ciclo",
        "loop-exit": "Salida del ciclo",
        flow: "Flujo del programa"
    })[identity.relation] ??
        "Flujo del programa";

    return deepFreeze({
        branch: insertion.branch,
        branchLabel,
        position: insertion.position,
        positionLabel,
        relation: identity.relation,
        relationLabel,
        index: insertion.index
    });
}

function choice(
    figure,
    category,
    label,
    symbol
) {
    return {
        figure,
        category,
        label,
        symbol
    };
}

function deepFreeze(value) {
    if (
        value == null ||
        typeof value !== "object" ||
        Object.isFrozen(value)
    ) {
        return value;
    }

    for (const item of Object.values(value)) {
        deepFreeze(item);
    }

    return Object.freeze(value);
}
