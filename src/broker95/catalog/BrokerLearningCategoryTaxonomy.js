import {
    BrokerGameError
} from "../core/BrokerGameError.js";
import {
    BrokerCategoryAudience
} from "./BrokerCategoryAudience.js";
import {
    brokerCategoryCatalog
} from "./BrokerCategoryCatalog.js";

export const BROKER_LEARNING_CATEGORY_IDS =
    Object.freeze([
        "FND-OPERAT",
        "FND-IO",
        "FND-DATA",
        "FND-TEXT",
        "FND-CONTROL",
        "FND-FUNC",
        "FND-COLLECTION",
        "FND-ALG",
        "FND-ALG-ANALY",
        "FND-ALG-RECUR",
        "FND-ALG-DESIGN",
        "NUM-ALG-VERIF"
    ]);

export function listBrokerLearningCategories(
    categoryCatalog = brokerCategoryCatalog
) {
    requireCategoryCatalog(categoryCatalog);

    return Object.freeze(
        BROKER_LEARNING_CATEGORY_IDS.map(
            categoryId =>
                requireBrokerLearningCategory(
                    categoryId,
                    categoryCatalog
                )
        )
    );
}

export function requireBrokerLearningCategory(
    categoryId,
    categoryCatalog = brokerCategoryCatalog
) {
    requireCategoryCatalog(categoryCatalog);

    let category;

    try {
        category = categoryCatalog
            .requireCategory(categoryId);
    } catch (error) {
        throw BrokerGameError.invalidRule(
            "BROKER95_LEARNING_CATEGORY_INVALID",
            "La categoría curricular de BROKER.95 no es válida.",
            [{
                categoryId,
                causeCode: error?.code ?? null
            }]
        );
    }

    if (
        category.familyId !== "FND" ||
        !BROKER_LEARNING_CATEGORY_IDS.includes(
            category.categoryId
        ) ||
        !category.audiences.includes(
            BrokerCategoryAudience.LEARNING
        )
    ) {
        throw BrokerGameError.invalidRule(
            "BROKER95_LEARNING_CATEGORY_INVALID",
            "La categoría indicada no pertenece a la taxonomía de aprendizaje.",
            [{ categoryId }]
        );
    }

    return category;
}

function requireCategoryCatalog(categoryCatalog) {
    if (
        categoryCatalog == null ||
        typeof categoryCatalog
            .requireCategory !== "function"
    ) {
        throw new TypeError(
            "Invalid BROKER.95 learning category catalog."
        );
    }
}
