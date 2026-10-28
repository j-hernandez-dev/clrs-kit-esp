import {
    createHash
} from "node:crypto";

import {
    BrokerGameError
} from "../core/BrokerGameError.js";
import {
    cloneBrokerLLMJson,
    isBrokerLLMPlainRecord
} from "../llm/BrokerLLMProtocol.js";

export const BROKER_SUBMISSION_RESPONSE_MAX_ATTEMPTS = 2;

export function createBrokerSubmissionRepair({
    validationError,
    previousResponse
}) {
    if (!(validationError instanceof BrokerGameError)) {
        throw validationError;
    }

    return Object.freeze({
        attempt:
            BROKER_SUBMISSION_RESPONSE_MAX_ATTEMPTS,
        validationCode: validationError.code,
        previousResponse:
            boundedPreviousResponse(
                previousResponse
            )
    });
}

export function normalizeBrokerSubmissionRepair(value) {
    if (
        !isBrokerLLMPlainRecord(value) ||
        Object.keys(value).some(key => ![
            "attempt",
            "validationCode",
            "previousResponse"
        ].includes(key)) ||
        value.attempt !==
            BROKER_SUBMISSION_RESPONSE_MAX_ATTEMPTS ||
        typeof value.validationCode !== "string" ||
        !/^BROKER95_[A-Z0-9_]{1,120}$/u
            .test(value.validationCode) ||
        (
            value.previousResponse != null &&
            !isBrokerLLMPlainRecord(
                value.previousResponse
            )
        )
    ) {
        throw BrokerGameError.invalidRule(
            "BROKER95_SUBMISSION_REPAIR_INVALID",
            "No fue posible preparar la corrección de la respuesta de CIPHER.",
            []
        );
    }

    return Object.freeze({
        attempt: value.attempt,
        validationCode: value.validationCode,
        previousResponse:
            value.previousResponse == null
                ? null
                : cloneBrokerLLMJson(
                    value.previousResponse,
                    "repair.previousResponse"
                )
    });
}

export function createBrokerSubmissionRepairRequestId(
    requestId,
    operation
) {
    const suffix = `:${operation}:repair`;

    if (requestId.length + suffix.length <= 128) {
        return `${requestId}${suffix}`;
    }

    return `${operation}:repair:${createHash("sha256")
        .update(requestId, "utf8")
        .digest("hex")}`;
}

function boundedPreviousResponse(value) {
    if (!isBrokerLLMPlainRecord(value)) {
        return null;
    }

    try {
        if (JSON.stringify(value).length > 65_536) {
            return null;
        }

        return cloneBrokerLLMJson(
            value,
            "repair.previousResponse"
        );
    } catch {
        return null;
    }
}
