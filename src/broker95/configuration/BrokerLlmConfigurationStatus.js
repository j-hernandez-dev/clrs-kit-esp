import {
    BrokerLlmAvailabilityReason,
    createBrokerLlmAvailability
} from "../llm/BrokerLlmAvailability.js";
import {
    BrokerLlmStatusReason
} from "../protocol/BrokerProtocolTypes.js";

export function createBrokerLlmConfigurationStatus(
    publicSettings
) {
    if (publicSettings.model.length === 0) {
        return publicStatus(
            createBrokerLlmAvailability(
                BrokerLlmAvailabilityReason
                    .MODEL_MISSING
            )
        );
    }

    const credentialConfigured =
        publicSettings.credential == null
            ? publicSettings.hasApiKey
            : (
                !publicSettings
                    .credential.required ||
                publicSettings
                    .credential.configured
            );

    if (!credentialConfigured) {
        return publicStatus(
            createBrokerLlmAvailability(
                BrokerLlmAvailabilityReason
                    .API_KEY_MISSING
            )
        );
    }

    return publicStatus(
        createBrokerLlmAvailability(
            BrokerLlmStatusReason.READY
        )
    );
}

function publicStatus(availability) {
    return Object.freeze({
        status: availability.status,
        reason: availability.reason,
        message: availability.message
    });
}
