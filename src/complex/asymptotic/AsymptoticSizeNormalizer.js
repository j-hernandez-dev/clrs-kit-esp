import {
    CostExpressionKind,
    costExpressionKey
} from "../algebra/CostExpression.js";
import {
    variableOrder
} from "./AsymptoticOrder.js";
import {
    StandardLibrarySymbolicEffect,
    getStandardLibraryDefinition
} from "../../standard-library/StandardLibraryCatalog.js";

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

        const measures =
            collectSizeMeasures(
                expressions
            );

        measures.forEach(
            (measure, index) => {
                this.aliasByExpression.set(
                    costExpressionKey(
                        measure
                    ),
                    this.nextAlias(index)
                );
            }
        );
    }

    resolve(expression) {
        if (
            expression?.kind !==
                CostExpressionKind.CALL ||
            !isSizeCall(expression.name)
        ) {
            return null;
        }

        const alias =
            this.aliasByExpression.get(
                costExpressionKey(
                    expression
                )
            );

        return alias == null
            ? null
            : variableOrder(alias);
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
                    isSizeCall(
                        candidate.name
                    )
                ) {
                    measures.set(
                        costExpressionKey(
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
