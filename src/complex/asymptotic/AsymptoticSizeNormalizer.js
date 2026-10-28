import {
    CostExpressionKind
} from "../algebra/CostExpression.js";
import {
    canonicalCostExpressionKey
} from "../algebra/CostExpressionCanonicalizer.js";
import {
    variableOrder
} from "./AsymptoticOrder.js";
import {
    StandardLibrarySymbolicEffect,
    getStandardLibraryDefinition
} from "../../standard-library/StandardLibraryCatalog.js";
import { GUI_VOLUME_MEASURE } from "../../standard-library/gui/GuiCostCatalog.js";
import { isGuiSymbolicVolume } from "../gui/GuiCostMeasures.js";

const SIZE_NAMES = Object.freeze([
    "n",
    "m",
    "k",
    "l",
    "s",
    "t"
]);

/**
 * Asigna nombres asintóticos breves a medidas estructurales como LONG(A).
 * La expresión de costo conserva el argumento real; sólo la notación Big O
 * utiliza estos alias.
 */
export class AsymptoticSizeNormalizer {

    constructor(
        expressions = [],
        options = {}
    ) {
        this.reservedNames =
            new Set(
                options.reservedNames ??
                []
            );
        this.aliasByExpression =
            new Map();
        this.expressionByKey =
            new Map();

        const measures =
            collectSizeMeasures(
                expressions
            );

        measures.forEach(
            measure =>
                this.register(measure)
        );
    }

    resolve(expression) {
        if (
            expression?.kind !==
                CostExpressionKind.CALL ||
            !isSizeCall(expression.name) ||
            (expression.name === GUI_VOLUME_MEASURE && !isGuiSymbolicVolume(expression))
        ) {
            return null;
        }

        const alias =
            this.aliasByExpression.get(
                canonicalCostExpressionKey(
                    expression
                )
            );

        return alias == null
            ? null
            : variableOrder(alias);
    }

    resolveOrRegister(expression) {
        if (
            expression?.kind !==
                CostExpressionKind.CALL ||
            !isSizeCall(expression.name) ||
            (expression.name === GUI_VOLUME_MEASURE && !isGuiSymbolicVolume(expression))
        ) {
            return null;
        }

        const alias =
            this.register(expression);

        return variableOrder(alias);
    }

    register(expression) {
        const key =
            canonicalCostExpressionKey(
                expression
            );
        const existing =
            this.aliasByExpression.get(key);

        if (existing != null) {
            return existing;
        }

        const alias =
            this.nextAlias(
                this.aliasByExpression
                    .size
            );

        this.aliasByExpression.set(
            key,
            alias
        );
        this.expressionByKey.set(
            key,
            expression
        );

        return alias;
    }

    entries() {
        return [
            ...this.aliasByExpression
                .entries()
        ].map(([key, alias]) =>
            Object.freeze({
                alias,
                expression:
                    this.expressionByKey
                        .get(key)
            })
        );
    }

    nextAlias(index) {
        let candidateIndex = index;

        while (true) {
            const candidate =
                canonicalSizeName(
                    candidateIndex
                );

            if (
                !this.reservedNames.has(
                    candidate
                )
            ) {
                this.reservedNames.add(
                    candidate
                );

                return candidate;
            }

            candidateIndex++;
        }
    }
}

function collectSizeMeasures(
    expressions
) {
    const measures =
        new Map();

    for (const expression of expressions) {
        visitExpression(
            expression,
            candidate => {
                if (
                    candidate.kind ===
                        CostExpressionKind.CALL &&
                    isSizeCall(candidate.name) &&
                    (candidate.name !== GUI_VOLUME_MEASURE || isGuiSymbolicVolume(candidate))
                ) {
                    measures.set(
                        canonicalCostExpressionKey(
                            candidate
                        ),
                        candidate
                    );
                }
            }
        );
    }

    return [
        ...measures.values()
    ];
}

function isSizeCall(name) {
    if (name === GUI_VOLUME_MEASURE) { return true; }
    return (
        getStandardLibraryDefinition(
            name
        )?.symbolicEffect.kind ===
        StandardLibrarySymbolicEffect
            .SIZE
    );
}

function visitExpression(
    expression,
    visitor
) {
    if (
        expression == null ||
        typeof expression !== "object" ||
        typeof expression.kind !==
            "string"
    ) {
        return;
    }

    visitor(expression);

    for (
        const value
        of Object.values(expression)
    ) {
        if (Array.isArray(value)) {
            for (const item of value) {
                visitExpression(
                    item,
                    visitor
                );
            }

            continue;
        }

        visitExpression(
            value,
            visitor
        );
    }
}

function canonicalSizeName(index) {
    return (
        SIZE_NAMES[index] ??
        `n${index + 1}`
    );
}
