import {
    BrokerGameError
} from "./BrokerGameError.js";
import {
    requireBrokerScore
} from "./BrokerPaymentRules.js";
import {
    BROKER_CRITERIA
} from "./BrokerRiskRules.js";

export function createBrokerTechnicalProfile(
    source = {}
) {
    return Object.freeze(
        Object.fromEntries(
            BROKER_CRITERIA.map(
                criterion => [
                    criterion,
                    createBucket(
                        source[criterion]
                    )
                ]
            )
        )
    );
}

export function recordBrokerTechnicalScores(
    profile,
    scores
) {
    const providedScores = scores ?? {};
    const current =
        createBrokerTechnicalProfile(
            profile
        );
    const entries = Object.entries(
        providedScores
    );

    for (const [criterion] of entries) {
        if (!BROKER_CRITERIA.includes(criterion)) {
            throw BrokerGameError.invalidRule(
                "BROKER95_TECHNICAL_CRITERION_INVALID",
                "La evaluación contiene una dimensión no reconocida.",
                [{ criterion }]
            );
        }
    }

    const updates = Object.fromEntries(
        BROKER_CRITERIA.map(criterion => {
            const bucket = current[criterion];

            if (
                !Object.hasOwn(
                    providedScores,
                    criterion
                )
            ) {
                return [criterion, bucket];
            }

            const score = requireBrokerScore(
                providedScores[criterion]
            );
            const sum = bucket.sum + score;
            const sampleCount =
                bucket.sampleCount + 1;

            return [criterion, Object.freeze({
                sum,
                sampleCount,
                score: Math.round(
                    sum / sampleCount
                )
            })];
        })
    );

    return Object.freeze(updates);
}

function createBucket(source = {}) {
    const sum = source.sum ?? 0;
    const sampleCount =
        source.sampleCount ?? 0;

    if (
        !Number.isInteger(sum) ||
        sum < 0 ||
        !Number.isInteger(sampleCount) ||
        sampleCount < 0 ||
        (sampleCount === 0 && sum !== 0) ||
        sum > sampleCount * 100
    ) {
        throw BrokerGameError.invalidRule(
            "BROKER95_TECHNICAL_PROFILE_INVALID",
            "El perfil técnico guardado no es válido.",
            [{ sum, sampleCount }]
        );
    }

    return Object.freeze({
        sum,
        sampleCount,
        score:
            sampleCount === 0
                ? 0
                : Math.round(
                    sum / sampleCount
                )
    });
}
