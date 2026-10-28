import {
    BrokerGameError
} from "./BrokerGameError.js";
import {
    requireBrokerMoney
} from "./BrokerPaymentRules.js";
import {
    BROKER_RISKS,
    getBrokerRiskRule
} from "./BrokerRiskRules.js";

export function createBrokerStatistics(
    source = {}
) {
    const completed = counter(
        source.completed
    );
    const failed = counter(
        source.failed
    );
    const totalEarned =
        requireBrokerMoney(
            source.totalEarned ?? 0
        );
    const byRisk = Object.freeze(
        Object.fromEntries(
            BROKER_RISKS.map(risk => [
                risk,
                outcomeBucket(
                    source.byRisk?.[risk]
                )
            ])
        )
    );

    if (
        completed !== sumOutcomes(
            byRisk,
            "completed"
        ) ||
        failed !== sumOutcomes(
            byRisk,
            "failed"
        )
    ) {
        invalidStatistics();
    }

    return Object.freeze({
        completed,
        failed,
        totalEarned,
        byRisk,
        familyCompleted:
            freezeCounters(
                source.familyCompleted
            )
    });
}

export function recordBrokerOutcome(
    statistics,
    {
        contract,
        completed,
        payout
    }
) {
    const current =
        createBrokerStatistics(
            statistics
        );

    getBrokerRiskRule(contract.risk);
    requireBrokerMoney(payout);

    const byRisk = Object.fromEntries(
        Object.entries(
            current.byRisk
        ).map(([risk, bucket]) => [
            risk,
            risk === contract.risk
                ? Object.freeze({
                    completed:
                        bucket.completed +
                        (completed ? 1 : 0),
                    failed:
                        bucket.failed +
                        (completed ? 0 : 1)
                })
                : bucket
        ])
    );
    const familyCompleted = {
        ...current.familyCompleted
    };

    if (completed) {
        familyCompleted[contract.familyId] =
            (familyCompleted[
                contract.familyId
            ] ?? 0) + 1;
    }

    return createBrokerStatistics({
        completed:
            current.completed +
            (completed ? 1 : 0),
        failed:
            current.failed +
            (completed ? 0 : 1),
        totalEarned:
            current.totalEarned + payout,
        byRisk,
        familyCompleted
    });
}

function outcomeBucket(source = {}) {
    return Object.freeze({
        completed: counter(
            source.completed
        ),
        failed: counter(
            source.failed
        )
    });
}

function freezeCounters(source = {}) {
    if (
        source == null ||
        typeof source !== "object" ||
        Array.isArray(source)
    ) {
        throw BrokerGameError.invalidRule(
            "BROKER95_STATISTICS_INVALID",
            "Las estadísticas guardadas no son válidas.",
            []
        );
    }

    return Object.freeze(
        Object.fromEntries(
            Object.entries(source).map(
                ([key, value]) => [
                    requireCounterKey(key),
                    counter(value)
                ]
            )
        )
    );
}

function sumOutcomes(byRisk, field) {
    return Object.values(byRisk).reduce(
        (sum, bucket) =>
            sum + bucket[field],
        0
    );
}

function requireCounterKey(value) {
    if (value.trim().length === 0) {
        invalidStatistics();
    }

    return value;
}

function counter(value = 0) {
    if (
        !Number.isInteger(value) ||
        value < 0
    ) {
        invalidStatistics([{ value }]);
    }

    return value;
}

function invalidStatistics(diagnostics = []) {
    throw BrokerGameError.invalidRule(
        "BROKER95_STATISTICS_INVALID",
        "Las estadísticas guardadas no son válidas.",
        diagnostics
    );
}
