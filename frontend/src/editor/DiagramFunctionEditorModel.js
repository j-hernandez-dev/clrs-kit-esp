import {
    DIAGRAM_NODE_EDIT_OPERATIONS,
    DIAGRAM_STRUCTURAL_FIGURES
} from "../../../src/diagram/editing/DiagramEditSchema.js";

export const DIAGRAM_FUNCTION_IDENTITY =
    "document:functions";

const FUNCTION_FIELDS = deepFreeze([
    {
        name: "identifier",
        label: "Identificador",
        required: true,
        placeholder: "FUNCION"
    },
    {
        name: "parameters",
        label: "Parámetros",
        required: false,
        placeholder: "parametro, limite"
    }
]);

export function createDiagramFunctionDraft() {
    return deepFreeze({
        schemaVersion: 1,
        identityId:
            DIAGRAM_FUNCTION_IDENTITY,
        figure:
            DIAGRAM_STRUCTURAL_FIGURES
                .FUNCTION_DECLARATION,
        title: "Nueva función",
        fields: FUNCTION_FIELDS,
        values: {
            identifier: "FUNCION",
            parameters: "parametro"
        }
    });
}

export function updateDiagramFunctionDraft(
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
            `Unknown function field: ${fieldName}`
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

export function validateDiagramFunctionDraft(
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
        missingFields:
            Object.freeze(missingFields)
    });
}

export function createDiagramFunctionIntent(
    draft
) {
    if (
        !validateDiagramFunctionDraft(draft)
            .valid
    ) {
        throw new Error(
            "The function draft is incomplete."
        );
    }

    return deepFreeze({
        schemaVersion: 1,
        operation:
            DIAGRAM_NODE_EDIT_OPERATIONS
                .CREATE_FUNCTION,
        identityId:
            DIAGRAM_FUNCTION_IDENTITY,
        figure:
            DIAGRAM_STRUCTURAL_FIGURES
                .FUNCTION_DECLARATION,
        values: {
            ...draft.values
        }
    });
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
