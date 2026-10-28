import {
    getUnknownComplexityDefinition
} from "./UnknownComplexityCatalog.js";

export function createUnknownComplexityReason({
    code,
    message,
    location = null,
    nodeType = null,
    scenario = "both",
    causes = []
}) {
    const definition =
        getUnknownComplexityDefinition(
            code
        );

    return Object.freeze({
        code,
        category:
            definition?.category ??
            "unclassified",
        phase:
            definition?.phase ??
            "unknown",
        message:
            String(
                message ??
                "No se pudo determinar la complejidad."
            ),
        location:
            location == null
                ? null
                : Object.freeze({
                    ...location
                }),
        nodeType,
        scenario,
        causes:
            Object.freeze([
                ...new Set(causes)
            ]),
        recoverability:
            definition?.recoverability ??
            "inspect-analysis"
    });
}
