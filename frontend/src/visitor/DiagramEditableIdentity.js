export {
    DIAGRAM_EDITABLE_FIGURES,
    DIAGRAM_ENTITY_TYPES,
    DIAGRAM_STRUCTURAL_FIGURES
} from "../../../src/diagram/editing/DiagramEditSchema.js";

export const DIAGRAM_EDGE_RELATIONS =
    Object.freeze({
        FLOW: "flow",
        SEQUENCE: "sequence",
        ENTRY: "entry",
        EXIT: "exit",
        BRANCH: "branch",
        BRANCH_CHAIN: "branch-chain",
        MERGE: "merge",
        LOOP_ENTRY: "loop-entry",
        LOOP_BACK: "loop-back",
        LOOP_EXIT: "loop-exit"
    });

/**
 * Roles semánticos que no dependen de la etiqueta visible ni de la forma
 * Mermaid. Viven dentro de la identidad no enumerable del nodo para que el
 * modelo de control pueda distinguir terminales y controles sintéticos sin
 * alterar su serialización histórica.
 */
export const DIAGRAM_NODE_ROLES =
    Object.freeze({
        GLOBAL_START: "global-start",
        GLOBAL_END: "global-end",
        FUNCTION_START: "function-start",
        FUNCTION_END: "function-end",
        EXPLICIT_RETURN: "explicit-return",
        FOR_PREPARATION: "for-preparation",
        LOOP_DECISION: "loop-decision"
    });

/**
 * Agrega una identidad inmutable sin alterar la forma serializable histórica
 * del modelo Mermaid. La identidad vive en memoria y constituye el contrato
 * para las interacciones de edición posteriores.
 */
export function attachDiagramIdentity(
    entity,
    identity
) {
    Object.defineProperty(
        entity,
        "identity",
        {
            value: deepFreeze(identity),
            enumerable: false
        }
    );

    return entity;
}

export function getDiagramIdentity(entity) {
    return entity?.identity ?? null;
}

export function isEditableDiagramEntity(
    entity
) {
    return entity?.identity?.editable === true;
}

export function getDiagramEdges(diagram) {
    return [
        ...(diagram?.edges ?? []),
        ...(diagram?.subgraphs ?? [])
            .flatMap(subgraph =>
                subgraph.edges ?? []
            )
    ];
}

export function getDiagramEntities(diagram) {
    return [
        ...(diagram?.nodes ?? []),
        ...getDiagramEdges(diagram),
        ...(diagram?.subgraphs ?? [])
            .flatMap(subgraph =>
                subgraph.nodes ?? []
            )
    ];
}

export function findDiagramEntityByIdentity(
    diagram,
    identityId
) {
    return getDiagramEntities(diagram)
        .find(entity =>
            entity.identity?.id === identityId
        ) ?? null;
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
