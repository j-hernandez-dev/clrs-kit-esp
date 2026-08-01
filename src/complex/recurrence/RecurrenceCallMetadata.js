import {
    CostExpressionKind
} from "../algebra/CostExpression.js";

const metadataByCall =
    new WeakMap();

export function attachRecurrenceCallMetadata(
    expression,
    metadata
) {
    if (
        expression?.kind !==
        CostExpressionKind.CALL
    ) {
        throw new TypeError(
            "Recurrence metadata can only be attached to cost calls."
        );
    }

    metadataByCall.set(
        expression,
        metadata
    );

    return expression;
}

export function getRecurrenceCallMetadata(
    expression
) {
    return (
        metadataByCall.get(
            expression
        ) ??
        null
    );
}
