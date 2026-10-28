import {
    BrokerReviewFindingSeverity,
    BrokerSubmissionReadiness
} from "./BrokerSubmissionReview.js";

/**
 * Esquemas compartidos por el prompt y Structured Outputs. El Host conserva
 * la validación de dominio final y no confía en el proveedor.
 */
export function createBrokerSubmissionReviewJsonSchema(
    responseShape
) {
    const criteria = requireStringArray(
        responseShape?.findings?.criteria,
        "review criteria"
    );

    return deepFreeze({
        type: "object",
        properties: {
            summary: textSchema(),
            readiness: {
                type: "string",
                enum: Object.values(
                    BrokerSubmissionReadiness
                )
            },
            findings: {
                type: "array",
                items: findingSchema(criteria)
            },
            nextSteps: {
                type: "array",
                items: textSchema()
            }
        },
        required: [
            "summary",
            "readiness",
            "findings",
            "nextSteps"
        ],
        additionalProperties: false
    });
}

export function createBrokerSubmissionEvaluationJsonSchema(
    responseShape
) {
    const criteria = requireStringArray(
        responseShape?.criteria?.requiredIds,
        "evaluation criteria"
    );

    return deepFreeze({
        type: "object",
        properties: {
            summary: textSchema(),
            criteria: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        criterion: enumSchema(criteria),
                        score: { type: "integer" },
                        evidence: {
                            type: "array",
                            items: textSchema()
                        },
                        rationale: textSchema()
                    },
                    required: [
                        "criterion",
                        "score",
                        "evidence",
                        "rationale"
                    ],
                    additionalProperties: false
                }
            },
            findings: {
                type: "array",
                items: findingSchema(criteria)
            }
        },
        required: [
            "summary",
            "criteria",
            "findings"
        ],
        additionalProperties: false
    });
}

export function createBrokerSubmissionReviewExample(
    responseShape
) {
    const [criterion] = requireStringArray(
        responseShape?.findings?.criteria,
        "review criteria"
    );

    return deepFreeze({
        summary:
            "La solución cumple parcialmente el contrato y requiere un ajuste localizado.",
        readiness: "needs-changes",
        findings: [{
            severity: "important",
            criterion,
            location: "PRINCIPAL",
            problem:
                "Un caso determinista no produce la salida esperada.",
            evidence:
                "La evidencia de pruebas reporta al menos un caso fallido.",
            recommendation:
                "Revisa la condición relacionada con ese caso y vuelve a ejecutar la revisión."
        }],
        nextSteps: [
            "Corregir el hallazgo señalado.",
            "Volver a ejecutar ai -review."
        ]
    });
}

export function createBrokerSubmissionEvaluationExample(
    responseShape
) {
    const criteria = requireStringArray(
        responseShape?.criteria?.requiredIds,
        "evaluation criteria"
    );

    return deepFreeze({
        summary:
            "La entrega fue evaluada con la evidencia determinista disponible.",
        criteria: criteria.map(criterion => ({
            criterion,
            score: 80,
            evidence: [
                "La evidencia determinista respalda esta puntuación."
            ],
            rationale:
                "La puntuación parte de las anclas del Host y considera únicamente el criterio indicado."
        })),
        findings: []
    });
}

function findingSchema(criteria) {
    return {
        type: "object",
        properties: {
            severity: {
                type: "string",
                enum: Object.values(
                    BrokerReviewFindingSeverity
                )
            },
            criterion: enumSchema(criteria),
            location: {
                anyOf: [
                    textSchema(),
                    { type: "null" }
                ]
            },
            problem: textSchema(),
            evidence: textSchema(),
            recommendation: textSchema()
        },
        required: [
            "severity",
            "criterion",
            "location",
            "problem",
            "evidence",
            "recommendation"
        ],
        additionalProperties: false
    };
}

function enumSchema(values) {
    return {
        type: "string",
        enum: [...values]
    };
}

function textSchema() {
    return { type: "string" };
}

function requireStringArray(value, name) {
    if (
        !Array.isArray(value) ||
        value.length === 0 ||
        value.some(item =>
            typeof item !== "string" ||
            item.length === 0
        )
    ) {
        throw new TypeError(
            `Invalid BROKER.95 ${name}.`
        );
    }

    return value;
}

function deepFreeze(value) {
    if (
        value != null &&
        typeof value === "object" &&
        !Object.isFrozen(value)
    ) {
        Object.freeze(value);

        for (const child of Object.values(value)) {
            deepFreeze(child);
        }
    }

    return value;
}
