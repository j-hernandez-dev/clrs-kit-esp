import {
    BrokerTestCaseKind
} from "../core/BrokerTestCase.js";
import {
    BrokerTestComparison
} from "../core/BrokerTestComparison.js";
import {
    BROKER_CONTRACT_REQUIREMENT_LIMITS
} from "./BrokerContractGenerationRequest.js";

const CLIENT_POLICIES = new Set([
    "named",
    "anonymous"
]);

/**
 * Esquema compartido por el prompt y la salida estructurada del proveedor.
 * El validador de dominio continúa siendo la autoridad final.
 */
export function createBrokerContractDraftJsonSchema(
    clientPolicy
) {
    requireClientPolicy(clientPolicy);

    const properties = {
        title: textSchema(),
        description: textSchema(),
        requirements: {
            type: "array",
            items: textSchema()
        },
        testCases: {
            type: "array",
            items: testCaseSchema()
        }
    };
    const required = [
        "title",
        "description",
        "requirements",
        "testCases"
    ];

    if (clientPolicy === "named") {
        properties.client = textSchema();
        required.push("client");
    }

    return deepFreeze({
        type: "object",
        properties,
        required,
        additionalProperties: false
    });
}

export function createBrokerContractDraftExample(
    clientPolicy
) {
    requireClientPolicy(clientPolicy);

    return deepFreeze({
        title: "Consolidación de registros",
        description:
            "Procesa la entrada solicitada y muestra el resultado esperado.",
        requirements: [
            "Leer los datos de entrada.",
            "Mostrar el resultado solicitado."
        ],
        testCases: [{
            id: "TC-1",
            kind: "normal",
            requirementIds: [
                "REQ-1",
                "REQ-2"
            ],
            explanation:
                "Comprueba que dos valores normales se leen y se procesan correctamente.",
            stdin: "2\n3\n",
            expected: "5\n",
            comparison: "exact",
            timeoutMs: 1_000
        }],
        ...(clientPolicy === "named"
            ? { client: "Laboratorio Aurora" }
            : {})
    });
}

function testCaseSchema() {
    return {
        type: "object",
        properties: {
            id: {
                type: "string"
            },
            kind: {
                type: "string",
                enum: Object.values(
                    BrokerTestCaseKind
                )
            },
            requirementIds: {
                type: "array",
                items: {
                    type: "string",
                    enum: Array.from(
                        {
                            length:
                                BROKER_CONTRACT_REQUIREMENT_LIMITS
                                    .maximum
                        },
                        (_item, index) =>
                            `REQ-${index + 1}`
                    )
                }
            },
            explanation: textSchema(),
            stdin: dataTextSchema(),
            expected: dataTextSchema(),
            comparison: {
                type: "string",
                enum: Object.values(
                    BrokerTestComparison
                )
            },
            timeoutMs: {
                type: "integer"
            }
        },
        required: [
            "id",
            "kind",
            "requirementIds",
            "explanation",
            "stdin",
            "expected",
            "comparison",
            "timeoutMs"
        ],
        additionalProperties: false
    };
}

function textSchema() {
    return {
        type: "string"
    };
}

function dataTextSchema() {
    return {
        type: "string"
    };
}

function requireClientPolicy(value) {
    if (!CLIENT_POLICIES.has(value)) {
        throw new TypeError(
            "Invalid BROKER.95 contract client policy."
        );
    }
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
