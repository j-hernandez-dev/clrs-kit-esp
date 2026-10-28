import {
    DIAGRAM_EDITABLE_FIGURES,
    DIAGRAM_ENTITY_TYPES,
    DIAGRAM_STRUCTURAL_FIGURES,
    getDiagramIdentity
} from "../visitor/DiagramEditableIdentity.js";
import {
    DIAGRAM_DELETE_IMPACTS,
    DIAGRAM_NODE_EDIT_OPERATIONS
} from "../../../src/diagram/editing/DiagramEditSchema.js";

export {
    DIAGRAM_NODE_EDIT_OPERATIONS
};

const FIGURE_DEFINITIONS = deepFreeze({
    [DIAGRAM_EDITABLE_FIGURES.RETURN]: {
        title: "Terminal · retorno",
        fields: [{
            name: "expression",
            label: "Expresión",
            multiline: true,
            required: false,
            placeholder: "resultado"
        }],
        defaults: {
            expression: "resultado"
        }
    },
    [DIAGRAM_EDITABLE_FIGURES.ASSIGNMENT]: {
        title: "Proceso · asignación",
        fields: [
            {
                name: "target",
                label: "Variable",
                required: true,
                placeholder: "resultado"
            },
            {
                name: "expression",
                label: "Expresión",
                multiline: true,
                required: true,
                placeholder: "valor"
            }
        ],
        defaults: {
            target: "resultado",
            expression: "valor"
        }
    },
    [DIAGRAM_EDITABLE_FIGURES.READ]: {
        title: "Entrada · leer",
        fields: [{
            name: "variables",
            label: "Variables",
            required: true,
            placeholder: "dato, opcion"
        }],
        defaults: {
            variables: "dato"
        }
    },
    [DIAGRAM_EDITABLE_FIGURES.WRITE]: {
        title: "Salida · escribir",
        fields: [{
            name: "expressions",
            label: "Expresión",
            multiline: true,
            required: true,
            placeholder: "resultado"
        }],
        defaults: {
            expressions: "resultado"
        }
    },
    [DIAGRAM_EDITABLE_FIGURES.IF]: {
        title: "Decisión · si",
        fields: [{
            name: "condition",
            label: "Condición",
            multiline: true,
            required: true,
            placeholder: "valor == esperado"
        }],
        defaults: {
            condition: "valor == esperado"
        }
    },
    [DIAGRAM_EDITABLE_FIGURES.WHILE]: {
        title: "Decisión en bucle · mientras",
        fields: [{
            name: "condition",
            label: "Condición",
            multiline: true,
            required: true,
            placeholder: "indice < limite"
        }],
        defaults: {
            condition: "indice < limite"
        }
    },
    [DIAGRAM_EDITABLE_FIGURES.FOR_TO]: {
        title: "Preparación ascendente · para",
        fields: forFields(),
        defaults: forDefaults()
    },
    [DIAGRAM_EDITABLE_FIGURES.FOR_DOWNTO]: {
        title: "Preparación descendente · para",
        fields: forFields(),
        defaults: {
            variable: "i",
            initialValue: "fin",
            finalValue: "inicio"
        }
    },
    [DIAGRAM_EDITABLE_FIGURES.FUNCTION_CALL]: {
        title: "Subproceso · llamada",
        fields: [
            {
                name: "identifier",
                label: "Identificador",
                required: true,
                placeholder: "PROCESAR"
            },
            {
                name: "arguments",
                label: "Argumentos",
                multiline: true,
                required: false,
                placeholder: "dato, limite"
            }
        ],
        defaults: {
            identifier: "PROCESAR",
            arguments: "dato"
        }
    },
    [DIAGRAM_STRUCTURAL_FIGURES.FUNCTION_DECLARATION]: {
        title: "Subproceso · función",
        fields: [
            {
                name: "identifier",
                label: "Identificador",
                required: true,
                placeholder: "PRINCIPAL"
            },
            {
                name: "parameters",
                label: "Parámetros",
                required: false,
                placeholder: "dato, limite"
            }
        ],
        defaults: {
            identifier: "PRINCIPAL",
            parameters: ""
        }
    }
});

export function createDiagramNodeEditorDraft(
    node
) {
    const identity = requireEditableNode(node);
    const definition = getFigureDefinition(
        identity.figure
    );
    const fields = definition.fields;
    const values = {};

    for (const field of fields) {
        values[field.name] = String(
            identity.editor?.[field.name] ??
            definition.defaults[field.name] ??
            ""
        );
    }

    return deepFreeze({
        schemaVersion: 1,
        identityId: identity.id,
        nodeId: identity.modelId,
        figure: identity.figure,
        title: definition.title,
        readOnly:
            identity.readOnly === true,
        fields,
        values,
        source: identity.source,
        materialization:
            identity.materialization ?? null,
        deletionImpact:
            deletionImpact(identity),
        context: {
            scopeId: identity.scopeId ?? null,
            containerId:
                identity.containerId ?? null,
            branch: identity.branch ?? null,
            statementIndex:
                identity.statementIndex ?? null
        }
    });
}

export function updateDiagramNodeEditorDraft(
    draft,
    fieldName,
    value
) {
    if (draft?.readOnly === true) {
        throw new Error(
            "Read-only diagram nodes cannot be edited."
        );
    }

    if (
        !draft?.fields?.some(field =>
            field.name === fieldName
        )
    ) {
        throw new Error(
            `Unknown diagram editor field: ${fieldName}`
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

export function validateDiagramNodeEditorDraft(
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
        valid: missingFields.length === 0,
        missingFields: Object.freeze(
            missingFields
        )
    });
}

export function createDiagramNodeEditIntent(
    draft
) {
    if (draft?.readOnly === true) {
        throw new Error(
            "Read-only diagram nodes cannot produce edit intents."
        );
    }

    const validation =
        validateDiagramNodeEditorDraft(draft);

    if (!validation.valid) {
        throw new Error(
            "The diagram node editor draft is incomplete."
        );
    }

    if (
        draft.materialization?.kind ===
            "implicit-return"
    ) {
        if (
            String(
                draft.values?.expression ?? ""
            ).trim() === ""
        ) {
            return null;
        }

        return createImplicitReturnIntent(
            draft
        );
    }

    if (
        draft.figure ===
            DIAGRAM_EDITABLE_FIGURES.RETURN &&
        String(
            draft.values?.expression ?? ""
        ).trim() === ""
    ) {
        return createDeleteIntentFromDraft(
            draft
        );
    }

    return createIntent(
        draft,
        DIAGRAM_NODE_EDIT_OPERATIONS.UPDATE,
        draft.values
    );
}

function createDeleteIntentFromDraft(draft) {
    return deepFreeze({
        ...createIntent(
            draft,
            DIAGRAM_NODE_EDIT_OPERATIONS.DELETE,
            null
        ),
        confirmation: {
            acknowledged: true,
            impact: draft.deletionImpact
        }
    });
}

function createImplicitReturnIntent(draft) {
    return deepFreeze({
        schemaVersion: 1,
        operation:
            DIAGRAM_NODE_EDIT_OPERATIONS.INSERT,
        identityId: draft.identityId,
        nodeId: draft.nodeId,
        relation:
            draft.materialization.relation,
        insertion:
            draft.materialization.insertion,
        materialization: "implicit-return",
        figure:
            DIAGRAM_EDITABLE_FIGURES.RETURN,
        values: { ...draft.values }
    });
}

export function createDiagramNodeDeleteIntent(
    node
) {
    if (
        getDiagramIdentity(node)
            ?.deletable !== true
    ) {
        throw new Error(
            "The diagram node cannot be deleted."
        );
    }

    const draft =
        createDiagramNodeEditorDraft(node);
    const deletion =
        createDiagramNodeDeletionPreview(
            node
        );

    return deepFreeze({
        ...createIntent(
            draft,
            DIAGRAM_NODE_EDIT_OPERATIONS.DELETE,
            null
        ),
        confirmation: {
            acknowledged: true,
            impact: deletion.impact
        }
    });
}

export function createDiagramNodeDeletionPreview(
    node
) {
    const identity = requireEditableNode(node);
    const impact = deletionImpact(identity);
    const line =
        identity.source?.location
            ?.startLine ?? null;
    const descriptions = {
        [DIAGRAM_DELETE_IMPACTS.STATEMENT]: {
            title: "Eliminar instrucción",
            message:
                "Se eliminará únicamente esta instrucción del código fuente."
        },
        [DIAGRAM_DELETE_IMPACTS.BRANCH]: {
            title: "Eliminar rama alternativa",
            message:
                "Se eliminará la rama alternativa completa. Las demás ramas permanecerán intactas."
        },
        [DIAGRAM_DELETE_IMPACTS.CONTROL_BLOCK]: {
            title: "Eliminar bloque completo",
            message:
                "Se eliminarán la figura de control, todo su cuerpo y sus ramas asociadas."
        },
        [DIAGRAM_DELETE_IMPACTS.FUNCTION]: {
            title: "Eliminar subproceso / función",
            message:
                "Se eliminarán la declaración y todas las instrucciones que contiene."
        }
    };

    return deepFreeze({
        impact,
        ...descriptions[impact],
        line,
        figure: identity.figure
    });
}

export function getDiagramNodeFigureDefinition(
    figure
) {
    return getFigureDefinition(figure);
}

function createIntent(
    draft,
    operation,
    values
) {
    return deepFreeze({
        schemaVersion: 1,
        operation,
        identityId: draft.identityId,
        nodeId: draft.nodeId,
        figure: draft.figure,
        source: draft.source,
        context: draft.context,
        values:
            values == null
                ? null
                : { ...values }
    });
}

function requireEditableNode(node) {
    const identity = getDiagramIdentity(node);

    if (
        identity?.entityType !==
            DIAGRAM_ENTITY_TYPES.NODE ||
        identity.editable !== true ||
        !identity.figure
    ) {
        throw new Error(
            "An editable diagram node is required."
        );
    }

    return identity;
}

function deletionImpact(identity) {
    if (
        identity.figure ===
            DIAGRAM_STRUCTURAL_FIGURES
                .FUNCTION_DECLARATION
    ) {
        return DIAGRAM_DELETE_IMPACTS.FUNCTION;
    }

    if (
        identity.branch === "else" &&
        identity.blockStatementCount === 1
    ) {
        return DIAGRAM_DELETE_IMPACTS.BRANCH;
    }

    if (
        identity.figure ===
            DIAGRAM_EDITABLE_FIGURES.IF &&
        /\/part:\d+$/u.test(identity.id)
    ) {
        return DIAGRAM_DELETE_IMPACTS.BRANCH;
    }

    if (
        [
            DIAGRAM_EDITABLE_FIGURES.IF,
            DIAGRAM_EDITABLE_FIGURES.WHILE,
            DIAGRAM_EDITABLE_FIGURES.FOR_TO,
            DIAGRAM_EDITABLE_FIGURES.FOR_DOWNTO
        ].includes(identity.figure)
    ) {
        return DIAGRAM_DELETE_IMPACTS
            .CONTROL_BLOCK;
    }

    return DIAGRAM_DELETE_IMPACTS.STATEMENT;
}

function getFigureDefinition(figure) {
    const definition =
        FIGURE_DEFINITIONS[figure];

    if (!definition) {
        throw new Error(
            `Unsupported diagram figure: ${figure}`
        );
    }

    return definition;
}

function forFields() {
    return [
        {
            name: "variable",
            label: "Variable",
            required: true,
            placeholder: "i"
        },
        {
            name: "initialValue",
            label: "Inicialización",
            required: true,
            placeholder: "0"
        },
        {
            name: "finalValue",
            label: "Hasta",
            required: true,
            placeholder: "n - 1"
        }
    ];
}

function forDefaults() {
    return {
        variable: "i",
        initialValue: "0",
        finalValue: "n - 1"
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
