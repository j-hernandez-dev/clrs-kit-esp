import {
    BrokerCategoryCatalog,
    brokerCategoryCatalog
} from "./BrokerCategoryCatalog.js";
import {
    createBrokerCategoryHistory
} from "../core/BrokerCategoryHistory.js";
import {
    BrokerGameError
} from "../core/BrokerGameError.js";
import {
    BrokerCategoryAudience
} from "./BrokerCategoryAudience.js";

export const DEFAULT_RECENT_CATEGORY_WINDOW = 5;

export class BrokerCategorySelector {

    constructor({
        catalog = brokerCategoryCatalog,
        random = Math.random,
        recentWindow =
            DEFAULT_RECENT_CATEGORY_WINDOW
    } = {}) {
        if (
            !(catalog instanceof
                BrokerCategoryCatalog) ||
            typeof random !== "function" ||
            !Number.isInteger(recentWindow) ||
            recentWindow < 0
        ) {
            invalidSelection(
                "BROKER95_CATEGORY_SELECTOR_INVALID",
                "El selector de categorías no está configurado correctamente."
            );
        }

        this.catalog = catalog;
        this.random = random;
        this.recentWindow = recentWindow;

        Object.freeze(this);
    }

    getCandidates({
        risk,
        history = {},
        excludeCategoryIds = []
    }) {
        const normalizedHistory =
            createBrokerCategoryHistory(
                history
            );
        const excluded = normalizeExclusions(
            this.catalog,
            excludeCategoryIds
        );
        const compatible =
            this.catalog.listCategories({
                baseRisk: risk,
                audience:
                    BrokerCategoryAudience.CLIENT
            }).filter(category =>
                !excluded.has(
                    category.categoryId
                )
            );

        if (compatible.length === 0) {
            invalidSelection(
                "BROKER95_CATEGORY_CANDIDATES_EMPTY",
                "No hay categorías compatibles disponibles para este riesgo."
            );
        }

        const recentRanks = buildRecentRanks(
            normalizedHistory,
            this.recentWindow
        );
        const familyExposure =
            buildFamilyExposure(
                this.catalog,
                normalizedHistory
            );

        return Object.freeze(
            compatible.map(category =>
                createCandidate({
                    category,
                    history:
                        normalizedHistory[
                            category.categoryId
                        ],
                    recentRank:
                        recentRanks.get(
                            category.categoryId
                        ),
                    recentWindow:
                        this.recentWindow,
                    familyExposure:
                        familyExposure[
                            category.familyId
                        ]
                })
            )
        );
    }

    select(options = {}) {
        const candidates =
            this.getCandidates(options);
        const randomValue = this.random();

        if (
            typeof randomValue !== "number" ||
            !Number.isFinite(randomValue) ||
            randomValue < 0 ||
            randomValue >= 1
        ) {
            invalidSelection(
                "BROKER95_CATEGORY_RANDOM_INVALID",
                "No fue posible realizar una selección aleatoria válida."
            );
        }

        const totalWeight = candidates.reduce(
            (sum, candidate) =>
                sum + candidate.weight,
            0
        );
        const draw = randomValue * totalWeight;
        let cumulative = 0;
        let selected = candidates.at(-1);

        for (const candidate of candidates) {
            cumulative += candidate.weight;

            if (draw < cumulative) {
                selected = candidate;
                break;
            }
        }

        return Object.freeze({
            risk: options.risk,
            category: selected.category,
            candidateCount:
                candidates.length,
            selectedWeight:
                selected.weight,
            totalWeight,
            randomValue,
            candidates
        });
    }
}

export function selectBrokerCategory(
    options
) {
    const selector =
        new BrokerCategorySelector({
            catalog: options?.catalog,
            random: options?.random,
            recentWindow:
                options?.recentWindow
        });

    return selector.select({
        risk: options?.risk,
        history: options?.history,
        excludeCategoryIds:
            options?.excludeCategoryIds
    });
}

function createCandidate({
    category,
    history,
    recentRank,
    recentWindow,
    familyExposure
}) {
    const generatedCount =
        history?.generatedCount ?? 0;
    const completedCount =
        history?.completedCount ?? 0;
    const practiceFactor =
        1 /
        (1 + generatedCount + completedCount);
    const familyFactor =
        1 / (1 + familyExposure);
    const recentFactor =
        recentRank == null
            ? 1
            : (recentRank + 1) /
                (recentWindow + 1);

    return Object.freeze({
        category,
        generatedCount,
        completedCount,
        practiceFactor,
        familyFactor,
        recentFactor,
        weight:
            practiceFactor *
            familyFactor *
            recentFactor
    });
}

function buildFamilyExposure(
    catalog,
    history
) {
    return Object.freeze(
        Object.fromEntries(
            catalog.families.map(family => {
                const generated =
                    family.categories.reduce(
                        (sum, category) =>
                            sum +
                            (
                                history[
                                    category.categoryId
                                ]?.generatedCount ??
                                0
                            ),
                        0
                    );

                return [
                    family.familyId,
                    generated /
                        family.categoryCount
                ];
            })
        )
    );
}

function buildRecentRanks(
    history,
    recentWindow
) {
    if (recentWindow === 0) {
        return new Map();
    }

    const recent = Object.values(history)
        .filter(entry =>
            entry.lastGenerated != null
        )
        .sort(compareHistoryRecency)
        .slice(0, recentWindow);

    return new Map(
        recent.map((entry, index) => [
            entry.categoryId,
            index
        ])
    );
}

function compareHistoryRecency(left, right) {
    const leftMarker = comparableMarker(
        left.lastGenerated
    );
    const rightMarker = comparableMarker(
        right.lastGenerated
    );

    if (
        leftMarker.kind ===
        rightMarker.kind
    ) {
        if (leftMarker.value < rightMarker.value) {
            return 1;
        }

        if (leftMarker.value > rightMarker.value) {
            return -1;
        }
    } else {
        return rightMarker.kind -
            leftMarker.kind;
    }

    return left.categoryId < right.categoryId
        ? -1
        : 1;
}

function comparableMarker(value) {
    if (typeof value === "number") {
        return {
            kind: 2,
            value
        };
    }

    const timestamp = Date.parse(value);

    if (Number.isFinite(timestamp)) {
        return {
            kind: 2,
            value: timestamp
        };
    }

    return {
        kind: 1,
        value
    };
}

function normalizeExclusions(
    catalog,
    source
) {
    if (!Array.isArray(source)) {
        invalidSelection(
            "BROKER95_CATEGORY_EXCLUSIONS_INVALID",
            "La lista de categorías excluidas no es válida."
        );
    }

    const values = new Set();

    for (const categoryId of source) {
        catalog.requireCategory(categoryId);
        values.add(categoryId);
    }

    return values;
}

function invalidSelection(code, message) {
    throw BrokerGameError.invalidRule(
        code,
        message,
        []
    );
}
