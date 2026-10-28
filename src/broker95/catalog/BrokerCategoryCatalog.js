import {
    BROKER_CATEGORY_SOURCE
} from "./BrokerCategoryData.js";
import {
    BrokerGameError
} from "../core/BrokerGameError.js";
import {
    BROKER_RISKS,
    getBrokerRiskRule
} from "../core/BrokerRiskRules.js";
import {
    BROKER_CATEGORY_AUDIENCES,
    BrokerCategoryAudience,
    requireBrokerCategoryAudience
} from "./BrokerCategoryAudience.js";

export const BROKER_CATEGORY_COUNT = 151;
export const BROKER_CLIENT_CATEGORY_COUNT = 139;
export const BROKER_LEARNING_CATEGORY_COUNT = 12;
export const BROKER_FAMILY_COUNT = 39;

export class BrokerCategoryCatalog {

    constructor(source = BROKER_CATEGORY_SOURCE) {
        const normalized = normalizeCatalog(
            source
        );

        this.families = normalized.families;
        this.categories =
            normalized.categories;
        this.familyById =
            normalized.familyById;
        this.categoryById =
            normalized.categoryById;

        Object.freeze(this);
    }

    get size() {
        return this.categories.length;
    }

    getFamily(familyId) {
        return this.familyById[familyId] ??
            null;
    }

    requireFamily(familyId) {
        const family = this.getFamily(
            familyId
        );

        if (!family) {
            invalidCatalogReference(
                "BROKER95_CATEGORY_FAMILY_NOT_FOUND",
                "No se encontró la familia de categorías indicada.",
                { familyId }
            );
        }

        return family;
    }

    getCategory(categoryId) {
        return this.categoryById[
            categoryId
        ] ?? null;
    }

    requireCategory(categoryId) {
        const category = this.getCategory(
            categoryId
        );

        if (!category) {
            invalidCatalogReference(
                "BROKER95_CATEGORY_NOT_FOUND",
                "No se encontró la categoría indicada.",
                { categoryId }
            );
        }

        return category;
    }

    listCategories(options = {}) {
        const familyId =
            options.familyId ?? null;
        const risk = options.risk ?? null;
        const baseRisk =
            options.baseRisk ?? null;
        const audience =
            options.audience ?? null;

        if (familyId != null) {
            this.requireFamily(familyId);
        }

        if (risk != null) {
            getBrokerRiskRule(risk);
        }

        if (baseRisk != null) {
            getBrokerRiskRule(baseRisk);
        }

        if (audience != null) {
            requireBrokerCategoryAudience(audience);
        }

        return Object.freeze(
            this.categories.filter(
                category =>
                    (
                        familyId == null ||
                        category.familyId ===
                            familyId
                    ) &&
                    (
                        risk == null ||
                        category.compatibleRisks
                            .includes(risk)
                    ) &&
                    (
                        baseRisk == null ||
                        category.baseRisk ===
                            baseRisk
                    ) &&
                    (
                        audience == null ||
                        category.audiences
                            .includes(audience)
                    )
            )
        );
    }

    supportsRisk(categoryId, risk) {
        getBrokerRiskRule(risk);

        return this.requireCategory(
            categoryId
        ).compatibleRisks.includes(risk);
    }

    supportsAudience(categoryId, audience) {
        requireBrokerCategoryAudience(audience);

        return this.requireCategory(
            categoryId
        ).audiences.includes(audience);
    }
}

export const brokerCategoryCatalog =
    new BrokerCategoryCatalog();

if (
    brokerCategoryCatalog.size !==
        BROKER_CATEGORY_COUNT ||
    brokerCategoryCatalog.families.length !==
        BROKER_FAMILY_COUNT ||
    brokerCategoryCatalog.listCategories({
        audience: BrokerCategoryAudience.CLIENT
    }).length !== BROKER_CLIENT_CATEGORY_COUNT ||
    brokerCategoryCatalog.listCategories({
        audience: BrokerCategoryAudience.LEARNING
    }).length !== BROKER_LEARNING_CATEGORY_COUNT
) {
    throw BrokerGameError.invalidRule(
        "BROKER95_CATEGORY_CATALOG_SIZE_INVALID",
        "El catálogo de categorías de BROKER.95 está incompleto.",
        [{
            categories:
                brokerCategoryCatalog.size,
            families:
                brokerCategoryCatalog
                    .families.length,
            clientCategories:
                brokerCategoryCatalog
                    .listCategories({
                        audience:
                            BrokerCategoryAudience
                                .CLIENT
                    }).length,
            learningCategories:
                brokerCategoryCatalog
                    .listCategories({
                        audience:
                            BrokerCategoryAudience
                                .LEARNING
                    }).length
        }]
    );
}

function normalizeCatalog(source) {
    if (!Array.isArray(source)) {
        invalidCatalog();
    }

    const families = [];
    const categories = [];
    const familyById = {};
    const categoryById = {};

    for (const rawFamily of source) {
        const familyId = requireText(
            rawFamily?.familyId
        );
        const familyName = requireText(
            rawFamily?.familyName
        );

        if (
            familyById[familyId] ||
            !Array.isArray(
                rawFamily?.categories
            ) ||
            rawFamily.categories.length === 0
        ) {
            invalidCatalog();
        }

        const familyCategories = [];

        for (const rawCategory of
            rawFamily.categories) {
            const category = createCategory({
                ...rawCategory,
                ordinal: categories.length + 1,
                familyId,
                familyName
            });

            if (
                categoryById[
                    category.categoryId
                ]
            ) {
                invalidCatalog();
            }

            categoryById[
                category.categoryId
            ] = category;
            categories.push(category);
            familyCategories.push(category);
        }

        const family = Object.freeze({
            familyId,
            familyName,
            categoryCount:
                familyCategories.length,
            categories: Object.freeze(
                familyCategories
            )
        });

        familyById[familyId] = family;
        families.push(family);
    }

    return Object.freeze({
        families: Object.freeze(families),
        categories: Object.freeze(
            categories
        ),
        familyById: Object.freeze(
            familyById
        ),
        categoryById: Object.freeze(
            categoryById
        )
    });
}

function createCategory(source) {
    const categoryId = requireText(
        source.categoryId
    );
    const familyId = requireText(
        source.familyId
    );
    const minimumRisk = source.minimumRisk;
    const minimumRiskIndex =
        BROKER_RISKS.indexOf(
            minimumRisk
        );
    const audiences = normalizeAudiences(
        source.audiences
    );

    if (
        !/^[A-Z0-9]+(?:-[A-Z0-9]+)+$/u
            .test(categoryId) ||
        minimumRiskIndex < 0
    ) {
        invalidCatalog();
    }

    return Object.freeze({
        ordinal: source.ordinal,
        familyId,
        familyName: requireText(
            source.familyName
        ),
        categoryId,
        categoryName: requireText(
            source.categoryName
        ),
        scope: requireText(
            source.scope
        ),
        representativeExamples:
            requireText(
                source.representativeExamples
            ),
        minimumRisk,
        baseRisk: minimumRisk,
        compatibleRisks: Object.freeze(
            BROKER_RISKS.slice(
                minimumRiskIndex
            )
        ),
        audiences
    });
}

function normalizeAudiences(source) {
    if (
        !Array.isArray(source) ||
        source.length === 0 ||
        source.length >
            BROKER_CATEGORY_AUDIENCES.length
    ) {
        invalidCatalog();
    }

    const audiences = source.map(
        audience => {
            try {
                return requireBrokerCategoryAudience(
                    audience
                );
            } catch {
                invalidCatalog();
            }

            return null;
        }
    );

    if (
        new Set(audiences).size !==
            audiences.length
    ) {
        invalidCatalog();
    }

    return Object.freeze(audiences);
}

function requireText(value) {
    if (
        typeof value !== "string" ||
        value.trim().length === 0
    ) {
        invalidCatalog();
    }

    return value.trim();
}

function invalidCatalog() {
    throw BrokerGameError.invalidRule(
        "BROKER95_CATEGORY_CATALOG_INVALID",
        "El catálogo de categorías de BROKER.95 no es válido.",
        []
    );
}

function invalidCatalogReference(
    code,
    publicMessage,
    diagnostic
) {
    throw BrokerGameError.invalidRule(
        code,
        publicMessage,
        [diagnostic]
    );
}
