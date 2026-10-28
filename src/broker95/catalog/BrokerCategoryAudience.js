import {
    BrokerGameError
} from "../core/BrokerGameError.js";

export const BrokerCategoryAudience =
    Object.freeze({
        CLIENT: "client",
        LEARNING: "learning"
    });

export const BROKER_CATEGORY_AUDIENCES =
    Object.freeze(
        Object.values(BrokerCategoryAudience)
    );

export function requireBrokerCategoryAudience(
    audience
) {
    if (
        !BROKER_CATEGORY_AUDIENCES.includes(
            audience
        )
    ) {
        throw BrokerGameError.invalidRule(
            "BROKER95_CATEGORY_AUDIENCE_INVALID",
            "La audiencia de categorías indicada no es válida.",
            [{ audience }]
        );
    }

    return audience;
}
