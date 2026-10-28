export const DIAGRAM_ENTITY_TYPES =
    Object.freeze({
        NODE: "node",
        EDGE: "edge"
    });

export const DIAGRAM_EDITABLE_FIGURES =
    Object.freeze({
        RETURN: "return",
        ASSIGNMENT: "assignment",
        READ: "read",
        WRITE: "write",
        IF: "if",
        WHILE: "while",
        FOR_TO: "for-to",
        FOR_DOWNTO: "for-downto",
        FUNCTION_CALL: "function-call"
    });

export const DIAGRAM_STRUCTURAL_FIGURES =
    Object.freeze({
        FUNCTION_DECLARATION:
            "function-declaration"
    });

export const DIAGRAM_NODE_EDIT_OPERATIONS =
    Object.freeze({
        UPDATE: "update-node",
        DELETE: "delete-node",
        INSERT: "insert-node",
        CREATE_FUNCTION: "create-function"
    });

export const DIAGRAM_DELETE_IMPACTS =
    Object.freeze({
        STATEMENT: "statement",
        BRANCH: "branch",
        CONTROL_BLOCK: "control-block",
        FUNCTION: "function"
    });

export const DIAGRAM_EDIT_FIELD_SCHEMA =
    deepFreeze({
        [DIAGRAM_EDITABLE_FIGURES.RETURN]: [
            field("expression")
        ],
        [DIAGRAM_EDITABLE_FIGURES.ASSIGNMENT]: [
            field("target"),
            field("expression")
        ],
        [DIAGRAM_EDITABLE_FIGURES.READ]: [
            field("variables")
        ],
        [DIAGRAM_EDITABLE_FIGURES.WRITE]: [
            field("expressions")
        ],
        [DIAGRAM_EDITABLE_FIGURES.IF]: [
            field("condition")
        ],
        [DIAGRAM_EDITABLE_FIGURES.WHILE]: [
            field("condition")
        ],
        [DIAGRAM_EDITABLE_FIGURES.FOR_TO]: [
            field("variable"),
            field("initialValue"),
            field("finalValue")
        ],
        [DIAGRAM_EDITABLE_FIGURES.FOR_DOWNTO]: [
            field("variable"),
            field("initialValue"),
            field("finalValue")
        ],
        [DIAGRAM_EDITABLE_FIGURES.FUNCTION_CALL]: [
            field("identifier"),
            field("arguments", false)
        ],
        [DIAGRAM_STRUCTURAL_FIGURES.FUNCTION_DECLARATION]: [
            field("identifier"),
            field("parameters", false)
        ]
    });

export function getDiagramEditFields(figure) {
    const fields =
        DIAGRAM_EDIT_FIELD_SCHEMA[figure];

    if (!fields) {
        throw new Error(
            `Unsupported diagram figure: ${figure}`
        );
    }

    return fields;
}

function field(name, required = true) {
    return { name, required };
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
