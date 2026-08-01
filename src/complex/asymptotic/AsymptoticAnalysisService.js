import {
    CostExpressionKind,
    costExpressionKey
} from "../algebra/CostExpression.js";
import {
    createAsymptoticAnalysis
} from "./AsymptoticAnalysis.js";
import {
    AsymptoticAnalysisModel
} from "./AsymptoticAnalysisModel.js";
import {
    AsymptoticClassifier
} from "./AsymptoticClassifier.js";
import {
    AsymptoticSizeNormalizer
} from "./AsymptoticSizeNormalizer.js";
import {
    createUnknownOrder,
    variableOrder
} from "./AsymptoticOrder.js";
import {
    affineMatchesMeasure
} from "../recurrence/AffineExpression.js";
import {
    RecurrenceAnalysisModel
} from "../recurrence/RecurrenceAnalysisModel.js";
import {
    RecurrenceSolver
} from "../recurrence/RecurrenceSolver.js";

export class AsymptoticAnalysisService {

    constructor(options = {}) {
        this.classifier =
            options.classifier ??
            new AsymptoticClassifier();
        this.recurrenceSolver =
            options.recurrenceSolver ??
            new RecurrenceSolver();
    }

    analyze(report) {
        const roots =
            report?.statementsCost;

        if (!Array.isArray(roots)) {
            throw new TypeError(
                "Asymptotic analysis requires a cost report."
            );
        }

        const recurrenceInput =
            report.recurrenceInputAnalysis ??
            null;
        const functions =
            this.collectFunctions(
                roots,
                recurrenceInput
            );
        const globalBounds =
            this.collectSymbolBounds(
                roots.filter(root =>
                    root.type !==
                    "FunctionDeclaration"
                )
            );
        const globalSizeNormalizer =
            createSizeNormalizer(
                roots.filter(root =>
                    root.type !==
                    "FunctionDeclaration"
                )
            );
        const functionStates =
            new Map();
        const functionOrders =
            new Map();
        const recurrenceRecords = [];
        const resolveFunction =
            name =>
                this.resolveFunction({
                    name,
                    functions,
                    functionStates,
                    functionOrders,
                    recurrenceRecords,
                    resolveFunction
                });
        const records = [];

        for (const root of roots) {
            const functionName =
                functionNameFromNode(root);
            const bounds =
                functionName == null
                    ? globalBounds
                    : functions.get(
                        functionName
                    )?.bounds ??
                    new Map();
            const context =
                this.createContext(
                    bounds,
                    resolveFunction,
                    functionName == null
                        ? null
                        : functions.get(
                            functionName
                        )
                            ?.recurrenceDefinition
                            ?.measure ??
                        null,
                    functionName == null
                        ? globalSizeNormalizer
                        : functions.get(
                            functionName
                        )?.sizeNormalizer ??
                        null
                );

            this.analyzeNodeTree(
                root,
                context,
                records,
                functionName == null
                    ? null
                    : resolveFunction(
                        functionName
                    )
            );
        }

        const model =
            new AsymptoticAnalysisModel(
                records
            );

        attachAnalysisModel(
            report,
            model
        );
        attachRecurrenceModel(
            report,
            new RecurrenceAnalysisModel(
                recurrenceRecords
            )
        );

        return model;
    }

    collectFunctions(
        roots,
        recurrenceInput
    ) {
        const functions =
            new Map();

        for (const root of roots) {
            const name =
                functionNameFromNode(root);

            if (name == null) {
                continue;
            }

            functions.set(
                name,
                {
                    node: root,
                    bounds:
                        this.collectSymbolBounds([
                            root
                        ]),
                    recurrenceDefinition:
                        recurrenceInput
                            ?.getFunction(
                                name
                            ) ??
                        null,
                    sizeNormalizer: null
                }
            );
        }

        for (const definition of functions.values()) {
            definition.sizeNormalizer =
                createSizeNormalizer(
                    [definition.node],
                    definition
                        .recurrenceDefinition
                        ?.parameters ??
                    []
                );
        }

        return functions;
    }

    resolveFunction({
        name,
        functions,
        functionStates,
        functionOrders,
        recurrenceRecords,
        resolveFunction
    }) {
        if (
            functionOrders.has(name)
        ) {
            return functionOrders.get(name);
        }

        if (
            functionStates.get(name) ===
            "visiting"
        ) {
            return createUnknownOrder(
                "CLRS_ASYMPTOTIC_RECURRENCE_UNRESOLVED",
                `La función de costo ${name} contiene una recurrencia pendiente de resolver.`
            );
        }

        const definition =
            functions.get(name);

        if (definition == null) {
            return createUnknownOrder(
                "CLRS_ASYMPTOTIC_CALL_UNRESOLVED",
                `No se encontró una definición para la función de costo ${name}.`
            );
        }

        functionStates.set(
            name,
            "visiting"
        );

        const context =
            this.createContext(
                definition.bounds,
                resolveFunction,
                definition
                    .recurrenceDefinition
                    ?.measure ??
                null,
                definition.sizeNormalizer
            );
        const recurrence =
            this.recurrenceSolver.solve(
                definition.node
                    .costExpression,
                {
                    functionName: name,
                    classify:
                        expression =>
                            this.classifier
                                .classify(
                                    expression,
                                    context
                                ),
                    measure:
                        definition
                            .recurrenceDefinition
                            ?.measure ??
                        null,
                    location:
                        definition.node
                            .location
                }
            );
        const order =
            recurrence.applicable
                ? recurrence.order
                : this.classifier.classify(
                    definition.node
                        .simplifiedCostExpression,
                    context
                );

        if (recurrence.applicable) {
            attachRecurrenceAnalysis(
                definition.node,
                recurrence.analysis
            );
            recurrenceRecords.push({
                node:
                    definition.node,
                name,
                analysis:
                    recurrence.analysis
            });
        }

        functionStates.set(
            name,
            "resolved"
        );
        functionOrders.set(
            name,
            order
        );

        return order;
    }

    createContext(
        bounds,
        resolveFunction,
        measure = null,
        sizeNormalizer = null
    ) {
        return {
            resolveCall:
                resolveFunction,
            resolveExpression:
                expression =>
                    affineMatchesMeasure(
                        expression,
                        measure
                    )
                        ? variableOrder("n")
                        : null,
            resolveSymbol:
                name =>
                    bounds.get(name) ??
                    null,
            resolveSize:
                expression =>
                    sizeNormalizer
                        ?.resolve(
                            expression
                        ) ??
                    null
        };
    }

    analyzeNodeTree(
        node,
        context,
        records,
        rootOrder = null
    ) {
        const existing =
            node.asymptoticAnalysis ??
            null;
        const analysis =
            existing ??
            createAsymptoticAnalysis(
                rootOrder ??
                this.classifier.classify(
                    node
                        .simplifiedCostExpression,
                    context
                ),
                node.location
            );

        attachNodeAnalysis(
            node,
            analysis
        );
        records.push({
            node,
            analysis
        });

        for (
            const instruction
            of node.instructions ?? []
        ) {
            this.analyzeNodeTree(
                instruction,
                context,
                records
            );
        }
    }

    collectSymbolBounds(roots) {
        const bounds =
            new Map();
        const conflicts =
            new Set();

        for (const root of roots) {
            visitCostNodes(
                root,
                node => {
                    const analysis =
                        node.iterationAnalysis;
                    const variable =
                        analysis?.variable;
                    const iterations =
                        analysis?.iterations;

                    if (
                        variable == null ||
                        iterations == null ||
                        containsSymbol(
                            iterations,
                            variable
                        ) ||
                        conflicts.has(variable)
                    ) {
                        return;
                    }

                    const previous =
                        bounds.get(variable);

                    if (
                        previous != null &&
                        costExpressionKey(
                            previous
                        ) !==
                        costExpressionKey(
                            iterations
                        )
                    ) {
                        bounds.delete(variable);
                        conflicts.add(variable);
                        return;
                    }

                    bounds.set(
                        variable,
                        iterations
                    );
                }
            );
        }

        return bounds;
    }
}

function createSizeNormalizer(
    roots,
    reservedNames = []
) {
    return new AsymptoticSizeNormalizer(
        roots
            .map(root =>
                root.costExpression
            )
            .filter(Boolean),
        {
            reservedNames
        }
    );
}

function functionNameFromNode(node) {
    const expression =
        node?.costExpression;

    if (
        node?.type !==
            "FunctionDeclaration" ||
        (
            expression?.kind !==
                CostExpressionKind.EQUATION &&
            expression?.kind !==
                CostExpressionKind.RECURRENCE
        ) ||
        expression.left?.kind !==
            CostExpressionKind.CALL
    ) {
        return null;
    }

    return expression.left.name;
}

function containsSymbol(
    expression,
    name
) {
    if (
        expression.kind ===
            CostExpressionKind.SYMBOL &&
        expression.name === name
    ) {
        return true;
    }

    for (
        const value
        of Object.values(expression)
    ) {
        if (
            Array.isArray(value) &&
            value.some(item =>
                item != null &&
                typeof item === "object" &&
                typeof item.kind ===
                    "string" &&
                containsSymbol(
                    item,
                    name
                )
            )
        ) {
            return true;
        }

        if (
            value != null &&
            typeof value === "object" &&
            typeof value.kind ===
                "string" &&
            containsSymbol(
                value,
                name
            )
        ) {
            return true;
        }
    }

    return false;
}

function visitCostNodes(node, visitor) {
    visitor(node);

    for (
        const instruction
        of node.instructions ?? []
    ) {
        visitCostNodes(
            instruction,
            visitor
        );
    }
}

function attachNodeAnalysis(
    node,
    analysis
) {
    if (
        Object.hasOwn(
            node,
            "asymptoticAnalysis"
        )
    ) {
        return;
    }

    Object.defineProperties(
        node,
        {
            asymptoticAnalysis: {
                value: analysis
            },
            bigO: {
                value:
                    analysis.notation
            }
        }
    );
}

function attachAnalysisModel(
    report,
    model
) {
    if (
        Object.hasOwn(
            report,
            "asymptoticAnalysis"
        )
    ) {
        return;
    }

    Object.defineProperty(
        report,
        "asymptoticAnalysis",
        {
            value: model
        }
    );
}

function attachRecurrenceAnalysis(
    node,
    analysis
) {
    if (
        Object.hasOwn(
            node,
            "recurrenceAnalysis"
        )
    ) {
        return;
    }

    Object.defineProperty(
        node,
        "recurrenceAnalysis",
        {
            value: analysis
        }
    );
}

function attachRecurrenceModel(
    report,
    model
) {
    if (
        Object.hasOwn(
            report,
            "recurrenceAnalysis"
        )
    ) {
        return;
    }

    Object.defineProperty(
        report,
        "recurrenceAnalysis",
        {
            value: model
        }
    );
}
