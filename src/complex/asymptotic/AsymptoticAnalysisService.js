import {
    CostExpressionKind
} from "../algebra/CostExpression.js";
import {
    CostExpressionFactory as Cost
} from "../algebra/CostExpressionFactory.js";
import {
    canonicalCostExpressionKey
} from "../algebra/CostExpressionCanonicalizer.js";
import {
    substituteCostExpression
} from "../algebra/CostExpressionSubstitution.js";
import {
    createAsymptoticAnalysis
} from "./AsymptoticAnalysis.js";
import {
    analyzeAsymptoticConditions
} from "./AsymptoticCondition.js";
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
    formatOrder,
    variableOrder
} from "./AsymptoticOrder.js";
import {
    asymptoticOrderVariables,
    composeAsymptoticOrder
} from "./AsymptoticOrderComposer.js";
import {
    affineMatchesMeasure
} from "../recurrence/AffineExpression.js";
import {
    createRecurrenceAnalysis,
    RecurrenceAnalysisStatus
} from "../recurrence/RecurrenceAnalysis.js";
import {
    RecurrenceAnalysisModel
} from "../recurrence/RecurrenceAnalysisModel.js";
import {
    RecurrenceSolver
} from "../recurrence/RecurrenceSolver.js";
import {
    analyzeRecurrenceScenarios,
    RecurrenceBestStrategy
} from "../recurrence/RecurrenceScenarioAnalysis.js";
import {
    getMutualRecurrenceMeasure,
    MutualRecurrenceSolver
} from "../recurrence/MutualRecurrenceSolver.js";
import {
    createScenarioAsymptoticAnalysis,
    ScenarioAsymptoticAnalysisModel
} from "../scenario/index.js";
import {
    createFunctionCostSummary,
    FunctionCostScenario,
    FunctionCostSummaryModel,
    instantiateFunctionCostSummary
} from "../function-summary/index.js";
import {
    FunctionCallGraph,
    FunctionCallGraphModel
} from "../call-graph/index.js";
import {
    InterproceduralProvenanceBuilder,
    InterproceduralResolutionKind
} from "../provenance/index.js";

export class AsymptoticAnalysisService {

    constructor(options = {}) {
        this.classifier =
            options.classifier ??
            new AsymptoticClassifier();
        this.recurrenceSolver =
            options.recurrenceSolver ??
            new RecurrenceSolver();
        this.mutualRecurrenceSolver =
            options.mutualRecurrenceSolver ??
            new MutualRecurrenceSolver({
                recurrenceSolver:
                    this.recurrenceSolver
            });
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
                recurrenceInput,
                report.controlFlowAnalysis ??
                    null
            );
        const callGraph =
            new FunctionCallGraph(
                functions,
                recurrenceInput
            );
        const componentSystems =
            this.prepareCallGraph(
                callGraph,
                functions
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
        const recurrenceRecords = [];
        const scenarioRecords = [];
        const resolutionState = {
            cache: new Map(),
            resolutionByCacheKey:
                new Map(),
            active: {
                best: new Set(),
                worst: new Set()
            },
            recurrenceCache:
                new Map(),
            summaryCache:
                new Map(),
            summaryResolutionByKey:
                new Map(),
            componentCache:
                new Map(),
            componentSystems,
            componentRecords: [],
            recurrenceRecords,
            provenance:
                new InterproceduralProvenanceBuilder(),
            nextContextId: 0
        };
        const resolveFunction =
            (
                name,
                args = [],
                callerContext = null,
                scenario =
                    FunctionCostScenario.WORST,
                callExpression = null,
                options = {}
            ) =>
                this.resolveFunction({
                    name,
                    args,
                    callerContext,
                    scenario,
                    callExpression,
                    root:
                        options.root === true,
                    functions,
                    state:
                        resolutionState,
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
            const definition =
                functionName == null
                    ? null
                    : functions.get(
                        functionName
                    ) ?? null;
            const contexts = {
                worst:
                    this.createContext({
                        bounds,
                        resolveFunction,
                        functionName: null,
                        functionLocation:
                            definition?.node.location ??
                            null,
                        measure:
                            definitionMeasure(
                                definition
                            ),
                        sizeNormalizer:
                            definition
                                ?.sizeNormalizer ??
                            globalSizeNormalizer,
                        allowedSymbols:
                            definition == null
                                ? null
                                : allowedFunctionSymbols(
                                    definition
                                ),
                        relationalContext:
                            definition
                                ?.relationalContext ??
                            null,
                        scenario:
                            FunctionCostScenario
                                .WORST,
                        state:
                            resolutionState
                    }),
                best:
                    this.createContext({
                        bounds,
                        resolveFunction,
                        functionName: null,
                        functionLocation:
                            definition?.node.location ??
                            null,
                        measure:
                            definitionMeasure(
                                definition
                            ),
                        sizeNormalizer:
                            definition
                                ?.sizeNormalizer ??
                            globalSizeNormalizer,
                        allowedSymbols:
                            definition == null
                                ? null
                                : allowedFunctionSymbols(
                                    definition
                                ),
                        relationalContext:
                            definition
                                ?.relationalContext ??
                            null,
                        scenario:
                            FunctionCostScenario
                                .BEST,
                        state:
                            resolutionState
                    })
            };
            const formalArguments =
                definition == null
                    ? []
                    : definition.summary
                        .parameters
                        .map(parameter =>
                            Cost.symbol(
                                parameter
                            )
                        );
            const rootOrder =
                definition == null
                    ? null
                    : resolveFunction(
                        functionName,
                        formalArguments,
                        contexts.worst,
                        FunctionCostScenario
                            .WORST,
                        null,
                        { root: true }
                    );

            const bestRootOrder =
                definition == null
                    ? null
                    : resolveFunction(
                    functionName,
                    formalArguments,
                    contexts.best,
                    FunctionCostScenario
                        .BEST,
                    null,
                    { root: true }
                    );

            this.analyzeNodeTree(
                root,
                contexts,
                records,
                rootOrder,
                scenarioRecords,
                bestRootOrder
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
        attachScenarioAnalysisModel(
            report,
            new ScenarioAsymptoticAnalysisModel(
                scenarioRecords
            )
        );
        attachRecurrenceModel(
            report,
            new RecurrenceAnalysisModel(
                recurrenceRecords
            )
        );
        attachFunctionSummaryModel(
            report,
            new FunctionCostSummaryModel(
                [...functions.values()]
                    .map(definition => ({
                        node:
                            definition.node,
                        summary:
                            definition.summary
                    }))
            )
        );
        attachFunctionCallGraphModel(
            report,
            new FunctionCallGraphModel(
                callGraph,
                resolutionState
                    .componentRecords
            )
        );
        attachInterproceduralProvenanceModel(
            report,
            resolutionState.provenance
                .build()
        );

        return model;
    }

    collectFunctions(
        roots,
        recurrenceInput,
        controlFlowAnalysis = null
    ) {
        const functions =
            new Map();

        for (const root of roots) {
            const name =
                functionNameFromNode(root);

            if (name == null) {
                continue;
            }

            const recurrenceDefinition =
                recurrenceInput
                    ?.getFunction(name) ??
                null;
            const parameters =
                recurrenceDefinition
                    ?.parameters ??
                functionParametersFromNode(
                    root
                );
            const summary =
                createFunctionCostSummary({
                    name,
                    parameters,
                    best:
                        recurrenceDefinition
                            ?.soundness
                            ?.best?.strategy ===
                        RecurrenceBestStrategy
                            .SAME_RECURRENCE
                            ? root.scenarioCost
                                .worst
                            : root.scenarioCost
                                .best,
                    worst:
                        root.scenarioCost.worst,
                    measure:
                        recurrenceDefinition
                            ?.measure ??
                        null,
                    location:
                        root.location
                });

            attachFunctionSummary(
                root,
                summary
            );
            functions.set(
                name,
                {
                    node: root,
                    summary,
                    bounds:
                        this.collectSymbolBounds([
                            root
                        ]),
                    recurrenceDefinition,
                    recurrenceScenario:
                        recurrenceDefinition
                            ?.soundness ??
                        null,
                    relationalContext:
                        controlFlowAnalysis
                            ?.getContextBefore(
                                recurrenceDefinition
                                    ?.flow?.node
                            ) ?? null,
                    sizeNormalizer: null
                }
            );
        }

        for (const definition of functions.values()) {
            const reservedNames = [
                ...definition.summary
                    .parameters,
                ...(
                    definition
                        .recurrenceDefinition
                        ?.measure == null
                        ? []
                        : ["n"]
                )
            ];

            definition.sizeNormalizer =
                createSizeNormalizer(
                    [definition.node],
                    reservedNames
                );
        }

        return functions;
    }

    prepareCallGraph(
        callGraph,
        functions
    ) {
        const systems = new Map();

        for (
            const component
            of callGraph.components
        ) {
            for (const name of component.names) {
                const definition =
                    functions.get(name);

                definition.callGraphComponent =
                    component;
                attachFunctionCallComponent(
                    definition.node,
                    component
                );

                if (!component.mutual) {
                    attachRecurrenceScenarioProfile(
                        definition.node,
                        definition
                            .recurrenceScenario
                    );

                    if (
                        canResolveRecursiveBest(
                            definition
                        )
                    ) {
                        attachBestScenarioCost(
                            definition.node
                        );
                    }
                }
            }

            if (!component.mutual) {
                continue;
            }

            const system =
                this.mutualRecurrenceSolver
                    .prepare(
                        component,
                        functions
                    );

            systems.set(
                component.id,
                system
            );

            for (const name of component.names) {
                const definition =
                    functions.get(name);
                const measure =
                    getMutualRecurrenceMeasure(
                        system,
                        name
                    );

                definition.mutualMeasure =
                    measure;

                definition.recurrenceScenario =
                    analyzeRecurrenceScenarios({
                        name:
                            definition
                                .recurrenceDefinition
                                ?.name ??
                            sourceFunctionName(name),
                        recursiveNames:
                            new Set(
                                component.names.map(
                                    sourceFunctionName
                                )
                            ),
                        measure,
                        flow:
                            definition
                                .recurrenceDefinition
                                ?.flow ??
                            null,
                        transitions:
                            system.relations
                                ?.filter(record =>
                                    record.edge
                                        .caller ===
                                    name
                                ).map(record =>
                                    record.relation
                                ) ?? []
                    });

                if (measure != null) {
                    definition.sizeNormalizer =
                        createSizeNormalizer(
                            [definition.node],
                            [
                                ...definition.summary
                                    .parameters,
                                "n"
                            ]
                        );
                }
            }

            const componentTerminationProven =
                system.sizeChange?.proven === true &&
                system.sizeChange
                    .guardCyclesProven === true &&
                component.names.some(name =>
                    functions.get(name)
                        ?.recurrenceScenario
                        ?.terminationProven === true
                );
            const recursiveBestResolvable =
                componentTerminationProven &&
                component.names.every(name =>
                    isForcedMutualRecurrence(
                        functions.get(name)
                            ?.recurrenceScenario
                    )
                );

            for (const name of component.names) {
                const definition =
                    functions.get(name);

                if (componentTerminationProven) {
                    definition.recurrenceScenario =
                        completeMutualRecurrenceScenario(
                            definition
                                .recurrenceScenario,
                            system,
                            recursiveBestResolvable
                        );
                }

                attachRecurrenceScenarioProfile(
                    definition.node,
                    definition.recurrenceScenario
                );

                definition
                    .recursiveBestResolvable =
                    recursiveBestResolvable;

                if (recursiveBestResolvable) {
                    attachBestScenarioCost(
                        definition.node
                    );
                }
            }
        }

        return systems;
    }

    resolveFunction({
        name,
        args,
        callerContext,
        scenario,
        callExpression,
        root,
        functions,
        state,
        resolveFunction
    }) {
        const definition =
            functions.get(name);
        const provenance =
            state.provenance.begin({
                callee: name,
                caller:
                    callerContext?.functionName ??
                    null,
                parentId:
                    callerContext?.provenanceId ??
                    null,
                scenario,
                arguments: args,
                call: callExpression,
                root,
                location:
                    definition?.node.location ??
                    callerContext?.functionLocation ??
                    null
            });

        if (definition == null) {
            const order = createUnknownOrder(
                "CLRS_ASYMPTOTIC_CALL_UNRESOLVED",
                `No se encontró una definición para la función de costo ${name}.`
            );

            state.provenance.complete(
                provenance,
                {
                    kind:
                        InterproceduralResolutionKind
                            .MISSING_FUNCTION,
                    order
                }
            );

            return order;
        }

        const instantiation =
            instantiateFunctionCostSummary(
                definition.summary,
                args,
                scenario,
                {
                    allowMissing: true
                }
            );

        state.provenance.instantiate(
            provenance,
            {
                parameters:
                    definition.summary.parameters,
                bindings:
                    instantiation.bindings,
                extraArguments:
                    instantiation.extraArguments,
                missing:
                    instantiation.missing,
                expression:
                    instantiation.expression,
                location:
                    definition.node.location
            }
        );

        if (!instantiation.complete) {
            const order = createUnknownOrder(
                instantiation.code,
                `${name}: ${instantiation.message}`
            );

            state.provenance.complete(
                provenance,
                {
                    kind:
                        InterproceduralResolutionKind
                            .INVALID_ARGUMENTS,
                    order
                }
            );

            return order;
        }

        const cacheKey =
            functionResolutionKey(
                name,
                args,
                scenario,
                callerContext?.semanticKey ??
                    "root"
            );

        if (state.cache.has(cacheKey)) {
            const order = state.cache.get(
                cacheKey
            );

            state.provenance.complete(
                provenance,
                {
                    kind:
                        InterproceduralResolutionKind
                            .CACHE,
                    order,
                    reusedFrom:
                        state.resolutionByCacheKey
                            .get(cacheKey) ??
                        null
                }
            );

            return order;
        }

        if (
            scenario ===
                FunctionCostScenario.BEST &&
            isRecursiveDefinition(definition) &&
            !canResolveRecursiveBest(
                definition
            )
        ) {
            const order = recursiveBestUnknown(
                name
            );

            state.cache.set(cacheKey, order);
            state.resolutionByCacheKey.set(
                cacheKey,
                provenance.id
            );
            state.provenance.complete(
                provenance,
                {
                    kind:
                        InterproceduralResolutionKind
                            .SUMMARY,
                    method:
                        "best-scenario-soundness-firewall",
                    order
                }
            );

            return order;
        }

        if (
            definition.callGraphComponent
                ?.mutual
        ) {
            const mutualOrder =
                this.resolveMutualScenario({
                    definition,
                    instantiation,
                    callerContext,
                    functions,
                    state,
                    resolveFunction,
                    provenanceId:
                        provenance.id,
                    provenanceRecord:
                        provenance,
                    scenario
                });

            state.cache.set(
                cacheKey,
                mutualOrder
            );
            state.resolutionByCacheKey.set(
                cacheKey,
                provenance.id
            );
            state.provenance.complete(
                provenance,
                {
                    kind:
                        resolutionKindForOrder(
                            mutualOrder,
                            InterproceduralResolutionKind
                                .MUTUAL_RECURSION
                        ),
                    order: mutualOrder,
                    method:
                        definition.node
                            .recurrenceAnalysis
                            ?.method ??
                        null
                }
            );

            return mutualOrder;
        }

        const active =
            state.active[scenario];

        if (active.has(name)) {
            const order = createUnknownOrder(
                "CLRS_ASYMPTOTIC_RECURRENCE_UNRESOLVED",
                `La función de costo ${name} participa en una recurrencia o ciclo de llamadas que todavía no puede resolverse.`
            );

            state.provenance.complete(
                provenance,
                {
                    kind:
                        InterproceduralResolutionKind
                            .ACTIVE_CYCLE,
                    order
                }
            );

            return order;
        }

        if (
            definition.summary
                .directRecursion.worst
        ) {
            const recursiveOrder =
                this.resolveRecursiveScenario({
                    name,
                    definition,
                    instantiation,
                    callerContext,
                    state,
                    resolveFunction,
                    provenanceId:
                        provenance.id,
                    provenanceRecord:
                        provenance,
                    scenario
                });

            state.cache.set(
                cacheKey,
                recursiveOrder
            );
            state.resolutionByCacheKey.set(
                cacheKey,
                provenance.id
            );
            state.provenance.complete(
                provenance,
                {
                    kind:
                        resolutionKindForOrder(
                            recursiveOrder,
                            InterproceduralResolutionKind
                                .DIRECT_RECURSION
                        ),
                    order: recursiveOrder,
                    method:
                        definition.node
                            .recurrenceAnalysis
                            ?.method ??
                        null
                }
            );

            return recursiveOrder;
        }

        active.add(name);

        let order;
        let summaryResolution = null;

        try {
            summaryResolution =
                this.resolveParametricSummary({
                    name,
                    definition,
                    scenario,
                    state,
                    resolveFunction,
                    provenanceId:
                        provenance.id
                });
            const abstractOrder =
                summaryResolution.order;
            const replacements =
                this.buildOrderReplacements(
                    definition,
                    instantiation,
                    callerContext,
                    null,
                    abstractOrder,
                    state.provenance,
                    provenance
                );
            const invalid =
                firstUnknownReplacement(
                    replacements
                );

            order = !abstractOrder.known
                ? abstractOrder
                : invalid ??
                    composeAsymptoticOrder(
                        abstractOrder,
                        replacements
                    );
        } finally {
            active.delete(name);
        }

        state.cache.set(
            cacheKey,
            order
        );
        state.resolutionByCacheKey.set(
            cacheKey,
            provenance.id
        );
        state.provenance.complete(
            provenance,
            {
                kind:
                    resolutionKindForOrder(
                        order,
                        InterproceduralResolutionKind
                            .SUMMARY
                    ),
                order,
                method:
                    summaryResolution
                        ?.cacheHit
                        ? "parametric-summary-cache"
                        : "parametric-summary",
                reusedFrom:
                    summaryResolution
                        ?.reusedFrom ?? null
            }
        );

        return order;
    }

    resolveMutualScenario({
        definition,
        instantiation,
        callerContext,
        functions,
        state,
        resolveFunction,
        provenanceId,
        provenanceRecord,
        scenario
    }) {
        const component =
            definition
                .callGraphComponent;
        let result =
            state.componentCache
                .get(
                    `${scenario}:${component.id}`
                ) ??
            null;

        if (result == null) {
            const system =
                state.componentSystems
                    .get(component.id);
            const active =
                state.active[scenario];

            component.names.forEach(name =>
                active.add(name)
            );

            try {
                result =
                    system.ready
                        ? this.mutualRecurrenceSolver
                            .solve(
                                system,
                                functions,
                                (
                                    name,
                                    expression,
                                    measure
                                ) => {
                                    const member =
                                        functions.get(
                                            name
                                        );
                                    const context =
                                        this.createContext({
                                            bounds:
                                                member.bounds,
                                            resolveFunction,
                                            functionName: name,
                                            functionLocation:
                                                member.node
                                                    .location,
                                            provenanceId,
                                            measure,
                                            sizeNormalizer:
                                                member
                                                    .sizeNormalizer,
                                            scenario,
                                            state
                                        });

                                    return this.classifier
                                        .classify(
                                            expression,
                                            context
                                        );
                                }
                            )
                        : Object.freeze({
                            ...system,
                            solved: false
                        });
            } finally {
                component.names.forEach(name =>
                    active.delete(name)
                );
            }

            state.componentCache.set(
                `${scenario}:${component.id}`,
                result
            );
            if (
                scenario ===
                FunctionCostScenario.WORST
            ) {
                state.componentRecords.push(
                    componentResolutionRecord(
                        result
                    )
                );
            }
            this.attachMutualRecurrenceResults(
                result,
                functions,
                state.recurrenceRecords,
                scenario
            );
        }

        if (!result.order?.known) {
            return createUnknownOrder(
                "CLRS_ASYMPTOTIC_RECURRENCE_UNRESOLVED",
                `El componente recursivo ${component.names.join(", ")} fue reconocido, pero todavía no puede reducirse a un orden asintótico demostrable.`
            );
        }

        const measure =
            getMutualRecurrenceMeasure(
                result,
                definition.summary.name
            );
        const replacements =
            this.buildOrderReplacements(
                definition,
                instantiation,
                callerContext,
                measure,
                result.order,
                state.provenance,
                provenanceRecord
            );

        for (const order of replacements.values()) {
            if (!order.known) {
                return order;
            }
        }

        return composeAsymptoticOrder(
            result.order,
            replacements
        );
    }

    attachMutualRecurrenceResults(
        result,
        functions,
        recurrenceRecords,
        scenario =
            FunctionCostScenario.WORST
    ) {
        for (const name of result.names) {
            const definition =
                functions.get(name);
            const measure =
                getMutualRecurrenceMeasure(
                    result,
                    name
                );
            const analysis =
                createRecurrenceAnalysis({
                    status:
                        result.order?.known
                            ? RecurrenceAnalysisStatus
                                .SOLVED
                            : RecurrenceAnalysisStatus
                                .UNSUPPORTED,
                    order:
                        result.order ??
                        createUnknownOrder(
                            result.code,
                            result.message
                        ),
                    scenario,
                    method:
                        result.method ??
                        null,
                    code:
                        result.order?.known
                            ? null
                            : result.code,
                    message:
                        result.order?.known
                            ? null
                            : result.message,
                    measure,
                    branches:
                        result.component
                            .internalEdges
                            .filter(edge =>
                                edge.caller ===
                                name
                            ).length,
                    boundKind:
                        result.boundKind ??
                        "tight",
                    characteristic:
                        result.characteristic ??
                        null,
                    system:
                        result.recurrenceSystem ??
                        null,
                    evidence: [
                        ...(result.evidence ?? []),
                        ...(definition
                            .recurrenceScenario
                            ?.evidence ?? [])
                    ],
                    soundness:
                        definition
                            .recurrenceScenario ??
                        null,
                    location:
                        definition.node
                            .location
                });

            if (
                scenario ===
                FunctionCostScenario.BEST
            ) {
                attachBestRecurrenceAnalysis(
                    definition.node,
                    analysis
                );
            } else {
                attachRecurrenceAnalysis(
                    definition.node,
                    analysis
                );
            }

            if (
                scenario ===
                    FunctionCostScenario.WORST &&
                !recurrenceRecords.some(
                    record =>
                        record.node ===
                        definition.node
                )
            ) {
                recurrenceRecords.push({
                    node:
                        definition.node,
                    name,
                    analysis
                });
            }
        }
    }

    resolveRecursiveScenario({
        name,
        definition,
        instantiation,
        callerContext,
        state,
        resolveFunction,
        provenanceId,
        provenanceRecord,
        scenario
    }) {
        const recurrenceKey =
            `${scenario}:${name}`;
        let abstractOrder =
            state.recurrenceCache
                .get(recurrenceKey) ??
            null;

        if (abstractOrder == null) {
            const active =
                state.active[scenario];

            active.add(name);

            try {
                const context =
                    this.createContext({
                        bounds:
                            definition.bounds,
                        resolveFunction,
                        functionName: name,
                        functionLocation:
                            definition.node.location,
                        provenanceId,
                        measure:
                            definition
                                .recurrenceDefinition
                                ?.measure ??
                            null,
                        sizeNormalizer:
                            definition
                                .sizeNormalizer,
                        scenario,
                        state
                    });
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
                            soundness:
                                definition
                                    .recurrenceScenario ??
                                definition
                                    .recurrenceDefinition
                                    ?.soundness ??
                                null,
                            scenario,
                            location:
                                definition.node
                                    .location
                        }
                    );

                abstractOrder =
                    recurrence.applicable
                        ? recurrence.order
                            .known
                            ? recurrence.order
                            : createUnknownOrder(
                                "CLRS_ASYMPTOTIC_RECURRENCE_UNRESOLVED",
                                `La recurrencia de ${name} fue reconocida, pero todavía no puede reducirse a un orden asintótico demostrable.`
                            )
                        : this.classifier
                            .classify(
                                definition.node
                                    .simplifiedCostExpression,
                                context
                            );

                if (recurrence.applicable) {
                    if (
                        scenario ===
                        FunctionCostScenario.BEST
                    ) {
                        attachBestRecurrenceAnalysis(
                            definition.node,
                            recurrence.analysis
                        );
                    } else {
                        attachRecurrenceAnalysis(
                            definition.node,
                            recurrence.analysis
                        );
                    }

                    if (
                        scenario ===
                            FunctionCostScenario.WORST &&
                        !state.recurrenceRecords
                            .some(record =>
                                record.node ===
                                definition.node
                            )
                    ) {
                        state.recurrenceRecords
                            .push({
                                node:
                                    definition.node,
                                name,
                                analysis:
                                    recurrence.analysis
                            });
                    }
                }
            } finally {
                active.delete(name);
            }

            state.recurrenceCache.set(
                recurrenceKey,
                abstractOrder
            );
        }

        if (!abstractOrder.known) {
            return abstractOrder;
        }

        const replacements =
            this.buildOrderReplacements(
                definition,
                instantiation,
                callerContext,
                null,
                abstractOrder,
                state.provenance,
                provenanceRecord
            );

        for (const order of replacements.values()) {
            if (!order.known) {
                return order;
            }
        }

        return composeAsymptoticOrder(
            abstractOrder,
            replacements
        );
    }

    buildOrderReplacements(
        definition,
        instantiation,
        callerContext,
        measureOverride = null,
        abstractOrder = null,
        provenanceBuilder = null,
        provenanceRecord = null
    ) {
        const replacements =
            new Map();
        const bindings =
            instantiation.bindings;
        const bindingByName = new Map(
            bindings.map(binding => [
                binding.name,
                binding.expression
            ])
        );
        const missing = new Set(
            instantiation.missing
        );
        const required = new Set(
            asymptoticOrderVariables(
                abstractOrder
            )
        );
        const requiredParameters =
            new Set();
        const measure =
            measureOverride ??
            definition
                .recurrenceDefinition
                ?.measure ??
            null;

        if (
            measure != null &&
            required.has("n")
        ) {
            const abstractMeasure =
                measureCostExpression(
                    measure
                );

            for (
                const parameter
                of costExpressionSymbols(
                    abstractMeasure
                )
            ) {
                if (
                    definition.summary
                        .parameters.includes(
                            parameter
                        )
                ) {
                    requiredParameters.add(
                        parameter
                    );
                }
            }

            replacements.set(
                "n",
                expressionUsesAnySymbol(
                    abstractMeasure,
                    missing
                )
                    ? missingArgumentOrder(
                        definition,
                        missing
                    )
                    : this.classifier.classify(
                        substituteCostExpression(
                            abstractMeasure,
                            bindings
                        ),
                        callerContext
                    )
            );
        }

        for (const name of required) {
            if (
                replacements.has(name) ||
                !definition.summary
                    .parameters.includes(name)
            ) {
                continue;
            }

            const expression =
                bindingByName.get(name);

            requiredParameters.add(name);

            replacements.set(
                name,
                expression == null
                    ? missingArgumentOrder(
                        definition,
                        new Set([name])
                    )
                    : this.classifier.classify(
                        expression,
                        callerContext
                    )
            );
        }

        for (
            const entry
            of definition.sizeNormalizer
                .entries()
        ) {
            if (
                !required.has(
                    entry.alias
                ) ||
                replacements.has(
                    entry.alias
                )
            ) {
                continue;
            }

            for (
                const parameter
                of costExpressionSymbols(
                    entry.expression
                )
            ) {
                if (
                    definition.summary
                        .parameters.includes(
                            parameter
                        )
                ) {
                    requiredParameters.add(
                        parameter
                    );
                }
            }

            replacements.set(
                entry.alias,
                expressionUsesAnySymbol(
                    entry.expression,
                    missing
                )
                    ? missingArgumentOrder(
                        definition,
                        missing
                    )
                    : this.classifier.classify(
                        substituteCostExpression(
                            entry.expression,
                            bindings
                        ),
                        callerContext
                    )
            );
        }

        provenanceBuilder?.transfer(
            provenanceRecord,
            {
                orderVariables:
                    [...required].sort(),
                requiredParameters:
                    [...requiredParameters]
                        .sort(),
                ignoredParameters:
                    definition.summary
                        .parameters.filter(
                            parameter =>
                                !requiredParameters
                                    .has(parameter)
                        ),
                ignoredMissing:
                    instantiation.missing
                        .filter(parameter =>
                            !requiredParameters
                                .has(parameter)
                        ),
                replacements
            }
        );

        return replacements;
    }

    resolveParametricSummary({
        name,
        definition,
        scenario,
        state,
        resolveFunction,
        provenanceId
    }) {
        const key = `${scenario}:${name}`;
        const cached = state.summaryCache.get(key);

        if (cached != null) {
            return Object.freeze({
                order: cached,
                cacheHit: true,
                reusedFrom:
                    state.summaryResolutionByKey
                        .get(key) ?? null
            });
        }

        const context = this.createContext({
            bounds: definition.bounds,
            resolveFunction,
            functionName: name,
            functionLocation:
                definition.node.location,
            provenanceId,
            measure:
                definitionMeasure(definition),
            sizeNormalizer:
                definition.sizeNormalizer,
            allowedSymbols:
                allowedFunctionSymbols(
                    definition
                ),
            relationalContext:
                definition.relationalContext,
            scenario,
            state
        });
        const order = this.classifier.classify(
            definition.summary[scenario],
            context
        );

        state.summaryCache.set(key, order);
        state.summaryResolutionByKey.set(
            key,
            provenanceId
        );

        return Object.freeze({
            order,
            cacheHit: false,
            reusedFrom: null
        });
    }

    createContext({
        bounds,
        resolveFunction,
        functionName = null,
        functionLocation = null,
        provenanceId = null,
        measure = null,
        sizeNormalizer = null,
        allowedSymbols = null,
        relationalContext = null,
        scenario,
        state
    }) {
        const context = {
            id: ++state.nextContextId,
            semanticKey:
                contextSemanticKey({
                    scenario,
                    functionName,
                    bounds,
                    measure
                }),
            scenario,
            functionName,
            functionLocation,
            provenanceId,
            allowedSymbols,
            relationalContext,
            resolveAbstract:
                expression =>
                    relationalContext
                        ?.resolveAbstract(
                            expression
                        ) ?? null,
            resolveExpression:
                expression =>
                    measure != null &&
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
                        ?.resolveOrRegister(
                            expression
                        ) ??
                    null
        };

        context.resolveCall =
            (name, args = [], expression = null) =>
                resolveFunction(
                    name,
                    args,
                    context,
                    scenario,
                    expression
                );

        return context;
    }

    createInstantiationContext({
        definition,
        instantiation,
        callerContext,
        scenario,
        state,
        resolveFunction,
        provenanceId
    }) {
        const localBounds =
            new Map();

        for (
            const [name, expression]
            of definition.bounds
        ) {
            localBounds.set(
                name,
                substituteCostExpression(
                    expression,
                    instantiation.bindings
                )
            );
        }

        const context = {
            id: ++state.nextContextId,
            semanticKey:
                instantiationContextKey({
                    scenario,
                    definition,
                    instantiation,
                    callerContext
                }),
            scenario,
            functionName:
                definition.summary.name,
            functionLocation:
                definition.node.location,
            provenanceId,
            relationalContext:
                definition
                    .relationalContext ??
                null,
            resolveAbstract:
                expression =>
                    definition
                        .relationalContext
                        ?.resolveAbstract(
                            expression
                        ) ??
                    callerContext
                        ?.resolveAbstract?.(
                            expression
                        ) ??
                    null,
            resolveExpression:
                expression =>
                    callerContext
                        ?.resolveExpression?.(
                            expression
                        ) ??
                    null,
            resolveSymbol:
                name =>
                    localBounds.get(name) ??
                    callerContext
                        ?.resolveSymbol?.(
                            name
                        ) ??
                    null,
            resolveSize:
                expression =>
                    callerContext
                        ?.resolveSize?.(
                            expression
                        ) ??
                    null
        };

        context.resolveCall =
            (name, args = [], expression = null) =>
                resolveFunction(
                    name,
                    args,
                    context,
                    scenario,
                    expression
                );

        return context;
    }

    analyzeNodeTree(
        node,
        contexts,
        records,
        rootOrder = null,
        scenarioRecords = [],
        rootBestOrder = null
    ) {
        const existing =
            node.asymptoticAnalysis ??
            null;
        const analysis =
            existing ??
            this.createAnalysis(
                node
                    .simplifiedCostExpression,
                contexts.worst,
                node.location,
                rootOrder
            );

        attachNodeAnalysis(
            node,
            analysis
        );
        const scenarioAnalysis =
            this.analyzeNodeScenarios(
                node,
                contexts.best,
                analysis,
                rootBestOrder
            );

        attachNodeScenarioAnalysis(
            node,
            scenarioAnalysis
        );
        records.push({
            node,
            analysis
        });
        scenarioRecords.push({
            node,
            analysis:
                scenarioAnalysis
        });

        for (
            const instruction
            of node.instructions ?? []
        ) {
            this.analyzeNodeTree(
                instruction,
                contexts,
                records,
                null,
                scenarioRecords,
                null
            );
        }
    }

    analyzeNodeScenarios(
        node,
        bestContext,
        worstAnalysis,
        rootBestOrder = null
    ) {
        const cost =
            node.scenarioCost;
        const bestExpression =
            node.bestScenarioCost
                ?.simplified ??
            node.functionCostSummary
                ?.best ??
            cost.simplifiedBest;
        const bestAnalysis = this.createAnalysis(
            bestExpression,
            bestContext,
            node.location,
            rootBestOrder ??
                (isRecursiveNode(node)
                    ? recursiveBestUnknown(
                        node.functionCostSummary
                            ?.name ??
                        "la función"
                    )
                    : null)
        );
        const bestRecurrence =
            node.bestRecurrenceAnalysis ??
            null;
        const confidence = {
            ...cost.confidence,
            best:
                bestRecurrence?.tight === true &&
                node.recurrenceScenarioProfile
                    ?.best?.forcedAtScale === true
                    ? "exact"
                    : cost.confidence.best
        };

        return createScenarioAsymptoticAnalysis({
            best: bestAnalysis,
            worst: worstAnalysis,
            confidence,
            assumptions:
                cost.assumptions,
            evidence: [
                ...cost.evidence,
                ...(node
                    .recurrenceScenarioProfile
                    ?.evidence ?? [])
            ],
            location:
                node.location
        });
    }

    createAnalysis(
        expression,
        context,
        location,
        order = null
    ) {
        const resolvedOrder =
            order ??
            this.classifier.classify(
                expression,
                context
            );
        const safeOrder =
            unresolvedOrderSymbols(
                resolvedOrder,
                context?.allowedSymbols
            );
        const conditions =
            analyzeAsymptoticConditions(
                expression,
                context
            );

        return createAsymptoticAnalysis(
            safeOrder,
            location,
            {
                conditions:
                    conditions.conditions
            }
        );
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
                    const valueBound =
                        analysis?.trajectory
                            ?.magnitudeBound ??
                        null;

                    if (
                        variable == null ||
                        valueBound == null ||
                        containsSymbol(
                            valueBound,
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
                        canonicalCostExpressionKey(
                            previous
                        ) !==
                            canonicalCostExpressionKey(
                            valueBound
                        )
                    ) {
                        bounds.delete(variable);
                        conflicts.add(variable);
                        return;
                    }

                    bounds.set(
                        variable,
                        valueBound
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

function isRecursiveDefinition(definition) {
    return Boolean(
        definition?.summary
            ?.directRecursion?.worst ||
        definition?.callGraphComponent
            ?.mutual
    );
}

function isRecursiveNode(node) {
    return Boolean(
        node?.functionCostSummary
            ?.directRecursion?.worst ||
        node?.functionCallComponent
            ?.mutual
    );
}

function canResolveRecursiveBest(definition) {
    if (
        definition?.callGraphComponent
            ?.mutual
    ) {
        return definition
            .recursiveBestResolvable === true;
    }

    return (
        definition?.recurrenceScenario
            ?.best?.strategy ===
        RecurrenceBestStrategy
            .SAME_RECURRENCE
    );
}

function isForcedMutualRecurrence(profile) {
    return (
        profile?.applicable === true &&
        profile.best
            ?.unboundedRecursivePaths === 1 &&
        profile.best
            ?.unboundedBasePaths === 0 &&
        profile.best
            ?.unknownPaths === 0
    );
}

function completeMutualRecurrenceScenario(
    profile,
    system,
    bestForced
) {
    const strategy = bestForced
        ? RecurrenceBestStrategy
            .SAME_RECURRENCE
        : RecurrenceBestStrategy.UNKNOWN;
    const evidence = [
        ...(profile?.evidence ?? []),
        ...(system.sizeChange
            ?.evidence ?? []),
        "El caso base alcanzable y el descenso se demostraron sobre el componente recursivo completo."
    ];

    return Object.freeze({
        ...profile,
        terminationProven: true,
        componentTerminationProven: true,
        hasReachableBaseCase: true,
        measureWellFounded: true,
        boundaryCompatible: true,
        guardSeparatesBase:
            bestForced,
        code: null,
        message: null,
        best:
            Object.freeze({
                ...(profile?.best ?? {}),
                strategy,
                forcedAtScale:
                    bestForced
            }),
        evidence:
            Object.freeze([
                ...new Set(evidence)
            ])
    });
}

function recursiveBestUnknown(name) {
    return createUnknownOrder(
        "CLRS_SCENARIO_RECURSIVE_BEST_UNPROVEN",
        `El mejor caso asintótico de ${name} debe demostrarse para entradas del mismo tamaño; un caso base pequeño no constituye por sí solo el mejor caso.`
    );
}

function sourceFunctionName(costName) {
    return String(costName).startsWith("T")
        ? String(costName).slice(1)
        : String(costName);
}

function allowedFunctionSymbols(definition) {
    return new Set([
        ...(
            definition?.summary
                ?.parameters ?? []
        ),
        "n",
        "m",
        "k",
        "l",
        "s",
        "t",
        ...(
            definition?.sizeNormalizer
                ?.entries()
                .map(entry =>
                    entry.alias
                ) ?? []
        )
    ]);
}

function unresolvedOrderSymbols(
    order,
    allowedSymbols
) {
    if (
        !order?.known ||
        !(allowedSymbols instanceof Set)
    ) {
        return order;
    }

    const symbols = new Set();

    for (const term of order.terms ?? []) {
        Object.keys(term.polynomial ?? {})
            .forEach(name =>
                symbols.add(name)
            );
        Object.keys(term.logarithmic ?? {})
            .forEach(name =>
                symbols.add(name)
            );

        for (const factor of term.specialFactors ?? []) {
            if (factor.variable != null) {
                symbols.add(factor.variable);
            }

            const exponentSymbol =
                symbolFromExpressionKey(
                    factor.exponentKey
                );

            if (exponentSymbol != null) {
                symbols.add(exponentSymbol);
            }
        }
    }

    const unresolved = [...symbols]
        .filter(name =>
            !allowedSymbols.has(name)
        )
        .sort();

    return unresolved.length === 0
        ? order
        : createUnknownOrder(
            "CLRS_ASYMPTOTIC_INTERNAL_SYMBOL_UNRESOLVED",
            `El orden conserva símbolos locales sin una relación demostrada con las entradas: ${unresolved.join(", ")}.`
        );
}

function symbolFromExpressionKey(key) {
    if (typeof key !== "string") {
        return null;
    }

    try {
        const expression = JSON.parse(key);

        return expression?.kind === "symbol"
            ? expression.name ?? null
            : null;
    } catch {
        return null;
    }
}

function functionParametersFromNode(node) {
    const expression =
        node?.costExpression;

    if (
        expression?.left?.kind !==
        CostExpressionKind.CALL
    ) {
        return [];
    }

    return expression.left.args
        .filter(argument =>
            argument.kind ===
            CostExpressionKind.SYMBOL
        )
        .map(argument =>
            argument.name
        );
}

function functionResolutionKey(
    name,
    args,
    scenario,
    semanticContextKey
) {
    return [
        semanticContextKey,
        scenario,
        name,
        ...args.map(
            canonicalCostExpressionKey
        )
    ].join("|");
}

function contextSemanticKey({
    scenario,
    functionName,
    bounds,
    measure
}) {
    const normalizedBounds = [
        ...(bounds?.entries?.() ?? [])
    ]
        .map(([name, expression]) => [
            name,
            canonicalCostExpressionKey(
                expression
            )
        ])
        .sort(([left], [right]) =>
            left.localeCompare(right)
        );

    return canonicalCostExpressionKey(
        Cost.call(
            `CONTEXT:${scenario}:${functionName ?? "GLOBAL"}`,
            normalizedBounds.map(
                ([name, key]) =>
                    Cost.call(name, [
                        Cost.symbol(key)
                    ])
            )
        )
    ) + `|measure:${JSON.stringify(
        measure?.affine ?? null
    )}`;
}

function instantiationContextKey({
    scenario,
    definition,
    instantiation,
    callerContext
}) {
    return [
        callerContext?.semanticKey ?? "root",
        scenario,
        definition.summary.name,
        ...instantiation.bindings.map(binding =>
            `${binding.name}=${canonicalCostExpressionKey(
                binding.expression
            )}`
        )
    ].join("|");
}

function firstUnknownReplacement(replacements) {
    for (const replacement of replacements.values()) {
        if (!replacement.known) {
            return replacement;
        }
    }

    return null;
}

function resolutionKindForOrder(
    order,
    fallback
) {
    return order?.code ===
        "CLRS_ASYMPTOTIC_CALL_ARGUMENT_MISSING"
        ? InterproceduralResolutionKind
            .INVALID_ARGUMENTS
        : fallback;
}

function missingArgumentOrder(
    definition,
    names
) {
    const missing = [...names]
        .filter(name =>
            definition.summary
                .parameters.includes(name)
        )
        .sort();

    return createUnknownOrder(
        "CLRS_ASYMPTOTIC_CALL_ARGUMENT_MISSING",
        `Faltan argumentos relevantes para ${definition.summary.name}: ${missing.join(", ")}.`
    );
}

function expressionUsesAnySymbol(
    expression,
    names,
    bound = new Set()
) {
    if (
        expression == null ||
        names.size === 0
    ) {
        return false;
    }

    if (Array.isArray(expression)) {
        return expression.some(item =>
            expressionUsesAnySymbol(
                item,
                names,
                bound
            )
        );
    }

    if (typeof expression !== "object") {
        return false;
    }

    if (expression.kind === CostExpressionKind.SYMBOL) {
        return (
            !bound.has(expression.name) &&
            names.has(expression.name)
        );
    }

    if (
        expression.kind ===
        CostExpressionKind.SUMMATION
    ) {
        const termBound = new Set(bound);
        termBound.add(expression.index);

        return (
            expressionUsesAnySymbol(
                expression.lower,
                names,
                bound
            ) ||
            expressionUsesAnySymbol(
                expression.upper,
                names,
                bound
            ) ||
            expressionUsesAnySymbol(
                expression.term,
                names,
                termBound
            )
        );
    }

    return Object.values(expression).some(value =>
        expressionUsesAnySymbol(
            value,
            names,
            bound
        )
    );
}

function costExpressionSymbols(
    expression,
    result = new Set(),
    bound = new Set()
) {
    if (expression == null) {
        return result;
    }

    if (Array.isArray(expression)) {
        expression.forEach(item =>
            costExpressionSymbols(
                item,
                result,
                bound
            )
        );
        return result;
    }

    if (typeof expression !== "object") {
        return result;
    }

    if (expression.kind === CostExpressionKind.SYMBOL) {
        if (!bound.has(expression.name)) {
            result.add(expression.name);
        }

        return result;
    }

    if (
        expression.kind ===
        CostExpressionKind.SUMMATION
    ) {
        costExpressionSymbols(
            expression.lower,
            result,
            bound
        );
        costExpressionSymbols(
            expression.upper,
            result,
            bound
        );
        const termBound = new Set(bound);
        termBound.add(expression.index);
        costExpressionSymbols(
            expression.term,
            result,
            termBound
        );
        return result;
    }

    Object.values(expression).forEach(value =>
        costExpressionSymbols(
            value,
            result,
            bound
        )
    );

    return result;
}

function definitionMeasure(definition) {
    return (
        definition
            ?.recurrenceDefinition
            ?.measure ??
        definition?.mutualMeasure ??
        null
    );
}

function componentResolutionRecord(
    result
) {
    return Object.freeze({
        componentId:
            result.component.id,
        names:
            result.names,
        status:
            result.order?.known
                ? "solved"
                : "unsupported",
        notation:
            result.order == null
                ? "O(?)"
                : formatOrder(
                    result.order
                ),
        order:
            result.order,
        method:
            result.method ?? null,
        reductionKind:
            result.reductionKind ??
            null,
        measures:
            result.measures,
        boundKind:
            result.boundKind ?? null,
        tight:
            result.tight ?? false,
        characteristic:
            result.characteristic ??
            null,
        system:
            result.recurrenceSystem ??
            null,
        code:
            result.order?.known
                ? null
                : result.code,
        message:
            result.order?.known
                ? null
                : result.message
    });
}

function measureCostExpression(measure) {
    const affine =
        measure?.affine;

    if (affine == null) {
        return Cost.unknown(
            "recurrence measure unavailable"
        );
    }

    const terms = [];

    if (affine.constant !== 0) {
        terms.push(
            Cost.constant(
                affine.constant
            )
        );
    }

    for (
        const [name, coefficient]
        of Object.entries(
            affine.coefficients
        )
    ) {
        const symbol =
            Cost.symbol(name);

        terms.push(
            coefficient === 1
                ? symbol
                : Cost.product([
                    Cost.constant(
                        coefficient
                    ),
                    symbol
                ])
        );
    }

    if (terms.length === 0) {
        return Cost.constant(0);
    }

    return terms.length === 1
        ? terms[0]
        : Cost.sum(terms);
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

function attachNodeScenarioAnalysis(
    node,
    analysis
) {
    if (
        Object.hasOwn(
            node,
            "scenarioAsymptoticAnalysis"
        )
    ) {
        return;
    }

    Object.defineProperties(
        node,
        {
            scenarioAsymptoticAnalysis: {
                value: analysis
            },
            bestBigO: {
                value:
                    analysis.best.notation
            },
            worstBigO: {
                value:
                    analysis.worst.notation
            }
        }
    );
}

function attachScenarioAnalysisModel(
    report,
    model
) {
    if (
        Object.hasOwn(
            report,
            "scenarioAsymptoticAnalysis"
        )
    ) {
        return;
    }

    Object.defineProperty(
        report,
        "scenarioAsymptoticAnalysis",
        { value: model }
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

function attachBestRecurrenceAnalysis(
    node,
    analysis
) {
    if (
        Object.hasOwn(
            node,
            "bestRecurrenceAnalysis"
        )
    ) {
        return;
    }

    Object.defineProperty(
        node,
        "bestRecurrenceAnalysis",
        { value: analysis }
    );
}

function attachRecurrenceScenarioProfile(
    node,
    profile
) {
    if (
        profile == null ||
        Object.hasOwn(
            node,
            "recurrenceScenarioProfile"
        )
    ) {
        return;
    }

    Object.defineProperty(
        node,
        "recurrenceScenarioProfile",
        { value: profile }
    );
}

function attachBestScenarioCost(node) {
    if (
        Object.hasOwn(
            node,
            "bestScenarioCost"
        )
    ) {
        return;
    }

    Object.defineProperty(
        node,
        "bestScenarioCost",
        {
            value: Object.freeze({
                expression:
                    node.scenarioCost.worst,
                simplified:
                    node.scenarioCost
                        .simplifiedWorst
            })
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

function attachFunctionSummary(
    node,
    summary
) {
    if (
        Object.hasOwn(
            node,
            "functionCostSummary"
        )
    ) {
        return;
    }

    Object.defineProperty(
        node,
        "functionCostSummary",
        { value: summary }
    );
}

function attachFunctionSummaryModel(
    report,
    model
) {
    if (
        Object.hasOwn(
            report,
            "functionCostSummaries"
        )
    ) {
        return;
    }

    Object.defineProperty(
        report,
        "functionCostSummaries",
        { value: model }
    );
}

function attachFunctionCallComponent(
    node,
    component
) {
    if (
        Object.hasOwn(
            node,
            "functionCallComponent"
        )
    ) {
        return;
    }

    Object.defineProperty(
        node,
        "functionCallComponent",
        { value: component }
    );
}

function attachFunctionCallGraphModel(
    report,
    model
) {
    if (
        Object.hasOwn(
            report,
            "functionCallGraph"
        )
    ) {
        return;
    }

    Object.defineProperty(
        report,
        "functionCallGraph",
        { value: model }
    );
}

function attachInterproceduralProvenanceModel(
    report,
    model
) {
    if (
        Object.hasOwn(
            report,
            "interproceduralProvenance"
        )
    ) {
        return;
    }

    Object.defineProperty(
        report,
        "interproceduralProvenance",
        { value: model }
    );
}
