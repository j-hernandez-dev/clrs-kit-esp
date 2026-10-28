import {
    BrokerGameError
} from "./BrokerGameError.js";
import {
    brokerCategoryCatalog
} from "../catalog/BrokerCategoryCatalog.js";

export function createBrokerCategoryHistory(
    source = {}
) {
    if (!isRecord(source)) {
        invalidHistory();
    }

    return Object.freeze(
        Object.fromEntries(
            Object.entries(source).map(
                ([categoryId, value]) => {
                    const entry = createEntry(
                        value
                    );

                    if (
                        entry.categoryId !==
                        categoryId
                    ) {
                        invalidHistory();
                    }

                    return [categoryId, entry];
                }
            )
        )
    );
}

export function recordBrokerCategoryGenerated(
    history,
    contract
) {
    return updateEntry(
        history,
        contract,
        entry => ({
            ...entry,
            generatedCount:
                entry.generatedCount + 1,
            lastGenerated:
                contract.createdAt ??
                contract.createdOrder
        })
    );
}

export function recordBrokerCategoryAccepted(
    history,
    contract
) {
    return updateExistingEntry(
        history,
        contract,
        entry => ({
            ...entry,
            acceptedCount:
                entry.acceptedCount + 1
        })
    );
}

export function recordBrokerCategoryOutcome(
    history,
    contract,
    completed,
    logicalOrder = null
) {
    return updateExistingEntry(
        history,
        contract,
        entry => ({
            ...entry,
            completedCount:
                entry.completedCount +
                (completed ? 1 : 0),
            failedCount:
                entry.failedCount +
                (completed ? 0 : 1),
            lastCompleted: completed
                ? contract.closedAt ??
                    logicalOrder
                : entry.lastCompleted
        })
    );
}

function updateExistingEntry(
    history,
    contract,
    update
) {
    const normalized =
        createBrokerCategoryHistory(
            history
        );

    if (!normalized[contract.categoryId]) {
        throw BrokerGameError.invalidRule(
            "BROKER95_CATEGORY_HISTORY_MISSING",
            "El historial de categorías no contiene el contrato indicado.",
            [{
                categoryId:
                    contract.categoryId
            }]
        );
    }

    return updateEntry(
        normalized,
        contract,
        update
    );
}

function updateEntry(
    history,
    contract,
    update
) {
    const normalized =
        createBrokerCategoryHistory(
            history
        );
    const current =
        normalized[contract.categoryId] ??
        createEntry({
            categoryId:
                contract.categoryId,
            familyId:
                contract.familyId
        });

    if (
        current.familyId !==
        contract.familyId
    ) {
        invalidHistory();
    }

    return createBrokerCategoryHistory({
        ...normalized,
        [contract.categoryId]: update(
            current
        )
    });
}

function createEntry(source = {}) {
    const category =
        brokerCategoryCatalog
            .requireCategory(
                source.categoryId
            );
    const generatedCount = counter(
        source.generatedCount
    );
    const acceptedCount = counter(
        source.acceptedCount
    );
    const completedCount = counter(
        source.completedCount
    );
    const failedCount = counter(
        source.failedCount
    );
    const lastGenerated = marker(
        source.lastGenerated
    );
    const lastCompleted = marker(
        source.lastCompleted
    );

    if (
        category.familyId !==
            source.familyId ||
        acceptedCount > generatedCount ||
        completedCount + failedCount >
            acceptedCount ||
        (generatedCount === 0) !==
            (lastGenerated == null) ||
        (completedCount === 0) !==
            (lastCompleted == null)
    ) {
        invalidHistory();
    }

    return Object.freeze({
        categoryId: requireText(
            source.categoryId
        ),
        familyId: requireText(
            source.familyId
        ),
        generatedCount,
        acceptedCount,
        completedCount,
        failedCount,
        lastGenerated,
        lastCompleted
    });
}

function counter(value = 0) {
    if (
        !Number.isInteger(value) ||
        value < 0
    ) {
        invalidHistory();
    }

    return value;
}

function marker(value = null) {
    if (
        value == null ||
        (
            typeof value === "string" &&
            value.trim().length > 0
        ) ||
        (
            typeof value === "number" &&
            Number.isFinite(value)
        )
    ) {
        return typeof value === "string"
            ? value.trim()
            : value;
    }

    invalidHistory();
}

function requireText(value) {
    if (
        typeof value !== "string" ||
        value.trim().length === 0
    ) {
        invalidHistory();
    }

    return value.trim();
}

function isRecord(value) {
    return value != null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        Object.getPrototypeOf(value) ===
            Object.prototype;
}

function invalidHistory() {
    throw BrokerGameError.invalidRule(
        "BROKER95_CATEGORY_HISTORY_INVALID",
        "El historial de categorías guardado no es válido.",
        []
    );
}
