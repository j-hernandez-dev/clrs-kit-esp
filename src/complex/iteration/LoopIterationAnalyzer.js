import {
    NodeTypes
} from "../../ast/core/NodeTypes.js";
import {
    CostExpressionKind
} from "../algebra/CostExpression.js";
import {
    CostExpressionFactory as Cost
} from "../algebra/CostExpressionFactory.js";
import {
    simplifyCostExpression
} from "../algebra/CostExpressionSimplifier.js";
import {
    areCostExpressionsEquivalent
} from "../algebra/CostExpressionCanonicalizer.js";
import {
    createIterationAnalysis,
    IterationAnalysisKind,
    IterationProgression
} from "./IterationAnalysis.js";
import {
    createIterationPathAnalysis,
    IterationPathOutcome
} from "./IterationPathAnalysis.js";
import {
    createTerminationAnalysis,
    terminatingAnalysis,
    unresolvedTermination
} from "./TerminationAnalysis.js";
import {
    createLoopTransition,
    deriveLoopInvariantAnalysis
} from "./LoopProof.js";
import {
    createLoopTrajectory
} from "./LoopTrajectory.js";
import {
    AbstractIntegrality,
    compareAbstractValues
} from "../abstract-domain/index.js";
import {
    StandardLibrarySymbolicEffect,
    getStandardLibraryDefinition
} from "../../standard-library/StandardLibraryCatalog.js";
import {
    analyzeRelationalLoop
} from "./RelationalLoopAnalysis.js";
import {
    analyzeNonlinearLoop,
    NonlinearLoopKind
} from "./NonlinearLoopAnalysis.js";

const COMPARISON_INVERSE =
    Object.freeze({
        "<": ">",
        "<=": ">=",
        ">": "<",
        ">=": "<=",
        "!=": "!="
    });
const MAX_UPDATE_PATHS = 64;
const UPDATE_EPSILON = 1e-10;

export class LoopIterationAnalyzer {

    analyzeFor(node, resolver) {
        const variable =
            identifierName(
                node.initializer?.left
            );

        if (variable == null) {
            return this.unknown(
                node,
                "CLRS_ITERATION_INITIALIZER_UNSUPPORTED",
                "No se pudo identificar la variable de control del ciclo."
            );
        }

        const bodyPaths =
            analyzeBodyPaths(
                node.body,
                resolver
            );
        if (bodyPaths.allPathsExit) {
            return this.result({
                node,
                variable,
                progression:
                    IterationProgression.UNKNOWN,
                iterations:
                    Cost.constant(1),
                exact: false,
                boundKind: "upper",
                pathAnalysis: bodyPaths,
                terminationEvidence: [
                    "Todos los caminos factibles salen de la función durante la primera iteración."
                ]
            });
        }

        const condition =
            this.normalizeCondition(
                node.condition,
                variable
            );

        if (condition == null) {
            return this.unknown(
                node,
                "CLRS_ITERATION_CONDITION_UNSUPPORTED",
                "La condición del ciclo no tiene una comparación reconocible."
            );
        }

        const incrementVariable =
            identifierName(
                node.increment?.left
            );

        if (incrementVariable !== variable) {
            return this.unknown(
                node,
                "CLRS_ITERATION_INCREMENT_MISMATCH",
                "El incremento no modifica la variable de control."
            );
        }

        const bodyWrites =
            collectWrittenNames(
                node.body
            );

        if (bodyWrites.has(variable)) {
            return this.unknown(
                node,
                "CLRS_ITERATION_CONTROL_VARIABLE_MUTATED",
                "El cuerpo modifica la variable de control del ciclo."
            );
        }

        if (
            this.boundChanges(
                condition.bound,
                bodyWrites
            )
        ) {
            return this.unknown(
                node,
                "CLRS_ITERATION_BOUND_MUTATED",
                "El límite del ciclo cambia durante la iteración."
            );
        }

        const update =
            this.parseUpdate(
                node.increment.right,
                variable,
                resolver,
                condition
            );

        const startValue =
            resolver.resolveAbstract(
                node.initializer.right
            );
        const boundValue =
            resolver.resolveAbstract(
                condition.bound
            );

        return this.analyzeProgression({
            node,
            variable,
            condition,
            update,
            start: startValue.expression,
            bound: boundValue.expression,
            startValue,
            boundValue,
            updateExact:
                !bodyPaths.hasEarlyExit,
            boundKind:
                bodyPaths.hasEarlyExit
                    ? "upper"
                    : "tight",
            pathAnalysis: bodyPaths
        });
    }

    analyzeWhile(node, resolver) {
        const conditionValue =
            evaluateBooleanCondition(
                node.condition,
                resolver
            );
        const bodyPaths =
            analyzeBodyPaths(
                node.body,
                resolver
            );
        const bodyWrites =
            collectWrittenNames(
                node.body
            );
        const conditionChanges =
            [...collectIdentifierNames(
                node.condition
            )].some(name =>
                bodyWrites.has(name)
            );

        if (conditionValue === false) {
            return this.result({
                node,
                variable: null,
                progression:
                    IterationProgression.UNKNOWN,
                iterations:
                    Cost.constant(0),
                exact: true,
                pathAnalysis: bodyPaths,
                terminationEvidence: [
                    "La condición inicial es siempre falsa."
                ]
            });
        }

        if (bodyPaths.allPathsExit) {
            return this.result({
                node,
                variable: null,
                progression:
                    IterationProgression.UNKNOWN,
                iterations:
                    Cost.constant(1),
                exact:
                    conditionValue === true,
                boundKind:
                    conditionValue === true
                        ? "tight"
                        : "upper",
                pathAnalysis: bodyPaths,
                terminationEvidence: [
                    "Todos los caminos factibles salen de la función durante la primera iteración."
                ]
            });
        }

        if (
            conditionValue === true &&
            !conditionChanges
        ) {
            const conditional =
                bodyPaths.hasEarlyExit;
            const code =
                conditional
                    ? "CLRS_ITERATION_TERMINATION_CONDITIONAL"
                    : "CLRS_ITERATION_NON_TERMINATING";
            const message =
                conditional
                    ? "La condición del ciclo es siempre verdadera y sólo algunos caminos salen de la función."
                    : "La condición del ciclo es siempre verdadera y ningún camino factible produce una salida.";

            return this.unknown(
                node,
                code,
                message,
                null,
                { pathAnalysis: bodyPaths }
            );
        }

        const relational = analyzeRelationalLoop(
            node,
            resolver
        );

        if (relational != null) {
            return this.analyzeRelationalInterval({
                node,
                relational,
                pathAnalysis: bodyPaths
            });
        }

        const nonlinear = analyzeNonlinearLoop(
            node,
            resolver
        );

        if (nonlinear != null) {
            const mutatedBound =
                [...collectIdentifierNames(
                    node.condition
                )].some(name =>
                    name !==
                        nonlinear.variable &&
                    bodyWrites.has(name)
                );

            if (mutatedBound) {
                return this.unknown(
                    node,
                    "CLRS_ITERATION_BOUND_MUTATED",
                    "El límite de la guarda no lineal cambia durante la iteración.",
                    nonlinear.variable,
                    { pathAnalysis: bodyPaths }
                );
            }

            return this.analyzeNonlinearProgression({
                node,
                nonlinear,
                pathAnalysis: bodyPaths
            });
        }

        const discovery =
            this.findWhileControl(
                node,
                resolver
            );

        if (discovery.candidate == null) {
            return this.unknown(
                node,
                discovery.code,
                discovery.message,
                null,
                {
                    pathAnalysis:
                        discovery
                            .pathAnalysis ??
                        bodyPaths
                }
            );
        }

        const {
            variable,
            condition,
            update,
            dependencies,
            movingBoundNames,
            updateExact,
            updateBoundKind,
            pathAnalysis,
            updates
        } = discovery.candidate;

        if (
            this.boundChanges(
                condition.bound,
                bodyWrites,
                variable,
                movingBoundNames
            )
        ) {
            return this.unknown(
                node,
                "CLRS_ITERATION_BOUND_MUTATED",
                "El límite del ciclo cambia durante la iteración.",
                variable,
                { pathAnalysis }
            );
        }

        if (
            this.dependenciesChange(
                dependencies,
                bodyWrites,
                variable
            )
        ) {
            return this.unknown(
                node,
                "CLRS_ITERATION_STEP_MUTATED",
                "El valor utilizado para actualizar la variable de control cambia dentro del ciclo.",
                variable,
                { pathAnalysis }
            );
        }

        const startValue =
            resolver.getAbstract(variable);
        const boundValue =
            resolver.resolveAbstract(
                condition.bound
            );

        return this.analyzeProgression({
            node,
            variable,
            condition,
            update,
            start: startValue.expression,
            bound: boundValue.expression,
            startValue,
            boundValue,
            updateExact,
            boundKind:
                updateBoundKind,
            pathAnalysis,
            updates
        });
    }

    findWhileControl(node, resolver) {
        const conditionVariables =
            collectIdentifierNames(
                node.condition
            );
        const relative =
            this.analyzeRelativeControl(
                node,
                resolver
            );

        if (relative != null) {
            return updateDiscovery(
                relative
            );
        }

        const analyzed = [];
        let failure = null;

        for (const variable of conditionVariables) {
            const condition =
                this.normalizeCondition(
                    node.condition,
                    variable
                );

            if (condition == null) {
                continue;
            }

            const result =
                this.analyzeControlUpdates(
                    node.body,
                    [variable],
                    resolver,
                    condition,
                    node.condition
                );

            if (!result.ok) {
                failure ??= result;
                continue;
            }

            if (result.exitsOnly) {
                continue;
            }

            let collapsed =
                collapseUpdateAlternatives(
                    result.transforms.map(
                        transform =>
                            transform[variable]
                    ),
                    condition.operator
                );

            if (!collapsed.ok) {
                collapsed =
                    collapsePiecewiseEquality({
                        pathTransitions:
                            result.pathTransitions,
                        variable,
                        condition,
                        resolver
                    }) ?? collapsed;
            }

            if (!collapsed.ok) {
                failure ??= {
                    ...collapsed,
                    pathAnalysis:
                        result.pathAnalysis
                };
                continue;
            }

            analyzed.push({
                variable,
                condition,
                update:
                    collapsed.update,
                dependencies:
                    result.dependencies,
                movingBoundNames:
                    new Set(),
                updateExact:
                    collapsed.exact,
                updateBoundKind:
                    collapsed.boundKind,
                pathAnalysis:
                    result.pathAnalysis,
                updates:
                    collapsed.updates
            });
        }

        const matching =
            analyzed.filter(candidate =>
                progressionMatches(
                    candidate.condition
                        .operator,
                    candidate.update
                )
            );

        if (analyzed.length === 1) {
            return updateDiscovery(
                analyzed[0]
            );
        }

        if (matching.length === 1) {
            return updateDiscovery(
                matching[0]
            );
        }

        return updateDiscovery(
            null,
            failure?.code ??
                "CLRS_ITERATION_UPDATE_NOT_FOUND",
            failure?.message ??
                "No se encontró una actualización garantizada para la variable de control.",
            failure?.pathAnalysis ?? null
        );
    }

    analyzeRelativeControl(
        node,
        resolver
    ) {
        const expression =
            unwrapGroup(
                node.condition
            );

        if (
            expression?.type !==
                NodeTypes.BINARY_EXPRESSION ||
            !Object.hasOwn(
                COMPARISON_INVERSE,
                expression.operator
            )
        ) {
            return null;
        }

        const left =
            identifierName(
                unwrapGroup(
                    expression.left
                )
            );
        const right =
            identifierName(
                unwrapGroup(
                    expression.right
                )
            );

        if (
            left == null ||
            right == null ||
            left === right
        ) {
            return null;
        }

        const condition = {
            operator:
                expression.operator,
            bound: expression.right
        };
        const result =
            this.analyzeControlUpdates(
                node.body,
                [left, right],
                resolver,
                condition,
                node.condition
            );

        if (!result.ok) {
            return null;
        }

        if (result.exitsOnly) {
            return null;
        }

        const alternatives = [];

        for (const transform of result.transforms) {
            const leftUpdate =
                transform[left];
            const rightUpdate =
                transform[right];

            if (
                !isPureAdditive(
                    leftUpdate
                ) ||
                !isPureAdditive(
                    rightUpdate
                )
            ) {
                return null;
            }

            alternatives.push({
                scale: 1,
                offset:
                    leftUpdate.offset -
                    rightUpdate.offset,
                rounded:
                    leftUpdate.rounded ||
                    rightUpdate.rounded,
                absolute:
                    leftUpdate.absolute ||
                    rightUpdate.absolute
            });
        }

        const collapsed =
            collapseUpdateAlternatives(
                alternatives,
                expression.operator
            );

        if (!collapsed.ok) {
            return null;
        }

        return {
            variable: left,
            condition,
            update:
                collapsed.update,
            dependencies:
                result.dependencies,
            movingBoundNames:
                new Set([right]),
            updateExact:
                collapsed.exact,
            updateBoundKind:
                collapsed.boundKind,
            pathAnalysis:
                result.pathAnalysis,
            updates:
                collapsed.updates.map(
                    update => ({
                        ...update,
                        variables:
                            Object.freeze([
                                left,
                                right
                            ])
                    })
                )
        };
    }

    analyzeControlUpdates(
        body,
        variables,
        resolver,
        condition,
        loopCondition = null
    ) {
        const initialResolver =
            resolver.clone();
        const initialOrigins =
            new Map();

        for (const variable of variables) {
            initialResolver.define(
                variable,
                Cost.symbol(variable),
                {
                    dependencies:
                        [variable],
                    source:
                        "loop-control"
                }
            );
            initialOrigins.set(
                variable,
                new Set([variable])
            );
        }

        const initialGuards = [];

        if (loopCondition != null) {
            const guard = createPathGuard(
                loopCondition,
                true,
                initialResolver
            );

            if (guard != null) {
                initialGuards.push(guard);
            }

            initialResolver.assume(
                loopCondition,
                true
            );
        }

        const execution =
            executeSymbolicPaths(
                body?.statements ?? [],
                [{
                    resolver:
                        initialResolver,
                    origins:
                        initialOrigins,
                    updated: new Set(),
                    locations: [],
                    guards: initialGuards,
                    outcome:
                        IterationPathOutcome
                            .CONTINUE,
                    feasible: true,
                    valid: true
                }],
                new Set(variables)
            );

        let pathAnalysis =
            pathAnalysisFromExecution(
                execution
            );

        if (execution.overflow) {
            return updateFailure(
                "CLRS_ITERATION_UPDATE_PATH_LIMIT",
                "La cantidad de caminos de actualización supera el límite de análisis seguro.",
                { pathAnalysis }
            );
        }

        const paths =
            execution.paths.filter(
                path =>
                    path.valid &&
                    path.feasible !== false &&
                    path.outcome ===
                        IterationPathOutcome
                            .CONTINUE
            );

        if (paths.length === 0) {
            return {
                ok: true,
                exitsOnly: true,
                transforms: [],
                dependencies:
                    new Set(),
                pathAnalysis
            };
        }

        if (
            paths.some(path =>
                !variables.some(variable =>
                    path.updated.has(
                        variable
                    )
                )
            )
        ) {
            return updateFailure(
                "CLRS_ITERATION_UPDATE_PATH_INCOMPLETE",
                "Existe al menos un camino del ciclo que no actualiza sus variables de control.",
                { pathAnalysis }
            );
        }

        const transforms = [];
        const dependencies = new Set();

        for (const path of paths) {
            const transform = {};

            for (const variable of variables) {
                const affine =
                    affineUpdateFromExpression(
                        path.resolver.get(
                            variable
                        ),
                        variables
                    );

                if (affine == null) {
                    return updateFailure(
                        "CLRS_ITERATION_UPDATE_NOT_FOUND",
                        "No se pudo obtener un efecto simbólico constante para las actualizaciones del ciclo.",
                        { pathAnalysis }
                    );
                }

                transform[variable] =
                    affineForVariable(
                        affine,
                        variable,
                        variables
                    );

                if (
                    transform[variable] ==
                    null
                ) {
                    return updateFailure(
                        "CLRS_ITERATION_UPDATE_UNSUPPORTED",
                        "Una actualización mezcla varias variables de control de forma no resoluble.",
                        { pathAnalysis }
                    );
                }

                for (
                    const dependency
                    of path.origins.get(
                        variable
                    ) ?? []
                ) {
                    if (
                        !variables.includes(
                            dependency
                        )
                    ) {
                        dependencies.add(
                            dependency
                        );
                    }
                }
            }

            transforms.push(transform);
            path.transitions = variables.map(
                variable => ({
                    variable,
                    ...describeAffineUpdate(
                        transform[variable]
                    )
                })
            );
        }

        if (
            transforms.some(transform =>
                Object.values(transform)
                    .some(update =>
                        update.absolute &&
                        !absoluteUpdateIsSafe(
                            classifyAffineUpdate(
                                update
                            ),
                            condition,
                            resolver
                        )
                    )
            )
        ) {
            return updateFailure(
                "CLRS_ITERATION_UPDATE_UNSUPPORTED",
                "No se pudo demostrar que el valor absoluto conserva la dirección de la actualización.",
                { pathAnalysis }
            );
        }

        pathAnalysis =
            pathAnalysisFromExecution(
                execution
            );

        return {
            ok: true,
            transforms,
            dependencies,
            pathAnalysis,
            pathTransitions:
                paths.map((path, index) => ({
                    path,
                    transform:
                        transforms[index]
                }))
        };
    }

    normalizeCondition(
        condition,
        variable
    ) {
        const expression =
            unwrapGroup(condition);

        if (
            expression?.type !==
                NodeTypes.BINARY_EXPRESSION ||
            !Object.hasOwn(
                COMPARISON_INVERSE,
                expression.operator
            )
        ) {
            return null;
        }

        const leftIsControl =
            identifierName(
                unwrapGroup(
                    expression.left
                )
            ) === variable;
        const rightIsControl =
            identifierName(
                unwrapGroup(
                    expression.right
                )
            ) === variable;

        if (
            leftIsControl ===
            rightIsControl
        ) {
            return null;
        }

        const bound =
            leftIsControl
                ? expression.right
                : expression.left;

        if (
            collectIdentifierNames(
                bound
            ).has(variable)
        ) {
            return null;
        }

        return {
            operator:
                leftIsControl
                    ? expression.operator
                    : COMPARISON_INVERSE[
                        expression.operator
                    ],
            bound
        };
    }

    parseUpdate(
        expression,
        variable,
        resolver,
        condition = null
    ) {
        const normalized =
            unwrapStandardUpdate(
                expression
            );
        const update =
            normalized.expression;

        if (
            update?.type !==
            NodeTypes.BINARY_EXPRESSION
        ) {
            return null;
        }

        const leftIsControl =
            identifierName(
                unwrapGroup(
                    update.left
                )
            ) === variable;
        const rightIsControl =
            identifierName(
                unwrapGroup(
                    update.right
                )
            ) === variable;

        if (
            leftIsControl ===
            rightIsControl
        ) {
            return null;
        }

        const operandNode =
            leftIsControl
                ? update.right
                : update.left;
        const operand =
            numericValue(
                resolver.resolve(
                    operandNode
                )
            );

        if (
            operand == null ||
            !Number.isFinite(operand)
        ) {
            return null;
        }

        let parsed = null;

        if (update.operator === "+") {
            parsed = additiveUpdate(
                operand
            );
        }

        if (
            parsed == null &&
            update.operator === "-" &&
            leftIsControl
        ) {
            parsed = additiveUpdate(
                -operand
            );
        }

        if (update.operator === "*") {
            parsed = multiplicativeUpdate(
                operand
            );
        }

        if (
            parsed == null &&
            update.operator === "/" &&
            leftIsControl &&
            operand !== 0
        ) {
            parsed = multiplicativeUpdate(
                1 / operand
            );
        }

        if (
            parsed == null ||
            (
                normalized.absolute &&
                !absoluteUpdateIsSafe(
                    parsed,
                    condition,
                    resolver
                )
            )
        ) {
            return null;
        }

        return parsed;
    }

    analyzeProgression({
        node,
        variable,
        condition,
        update,
        start,
        bound,
        startValue = null,
        boundValue = null,
        updateExact = true,
        boundKind = "tight",
        pathAnalysis = null,
        updates = []
    }) {
        if (update == null) {
            return this.unknown(
                node,
                "CLRS_ITERATION_UPDATE_UNSUPPORTED",
                "La actualización del ciclo no es una progresión constante reconocible.",
                variable
            );
        }

        if (
            containsUnknown(start) ||
            containsUnknown(bound)
        ) {
            return this.unknown(
                node,
                "CLRS_ITERATION_VALUE_UNRESOLVED",
                "No se pudieron resolver los valores inicial y límite del ciclo.",
                variable
            );
        }

        if (
            update.progression ===
            IterationProgression.ADDITIVE
        ) {
            return this.enrichProgressionAnalysis(
                this.analyzeAdditive({
                node,
                variable,
                condition,
                update,
                start,
                bound,
                startValue,
                boundValue,
                updateExact,
                boundKind,
                pathAnalysis,
                updates
                }),
                this.createTransition({
                    node,
                    variable,
                    condition,
                    update,
                    start,
                    bound,
                    boundKind,
                    pathAnalysis
                })
            );
        }

        if (
            update.progression ===
            IterationProgression.AFFINE
        ) {
            return this.enrichProgressionAnalysis(
                this.analyzeAffine({
                node,
                variable,
                condition,
                update,
                start,
                bound,
                updateExact,
                boundKind,
                pathAnalysis,
                updates
                }),
                this.createTransition({
                    node,
                    variable,
                    condition,
                    update,
                    start,
                    bound,
                    boundKind,
                    pathAnalysis
                })
            );
        }

        return this.enrichProgressionAnalysis(
            this.analyzeMultiplicative({
            node,
            variable,
            condition,
            update,
            start,
            bound,
            updateExact,
            boundKind,
            pathAnalysis,
            updates
            }),
            this.createTransition({
                node,
                variable,
                condition,
                update,
                start,
                bound,
                boundKind,
                pathAnalysis
            })
        );
    }

    analyzeRelationalInterval({
        node,
        relational,
        pathAnalysis
    }) {
        const condition = {
            operator: relational.operator,
            bound: Cost.symbol(relational.right)
        };
        const update = {
            progression:
                IterationProgression
                    .MULTIPLICATIVE,
            factor: relational.factor,
            relational: true
        };
        const analysis = this.result({
            node,
            variable: relational.left,
            progression:
                IterationProgression
                    .MULTIPLICATIVE,
            iterations: relational.iterations,
            exact: false,
            assumptions: relational.assumptions,
            updates: relational.updates,
            pathAnalysis,
            terminationEvidence:
                relational.evidence,
            relational
        });

        return this.enrichProgressionAnalysis(
            analysis,
            this.createTransition({
                node,
                variable: relational.left,
                condition,
                update,
                start: Cost.symbol(relational.left),
                bound: Cost.symbol(relational.right),
                boundKind: "tight",
                pathAnalysis,
                relational
            })
        );
    }

    analyzeNonlinearProgression({
        node,
        nonlinear,
        pathAnalysis
    }) {
        const isPowerUpdate =
            nonlinear.kind ===
            NonlinearLoopKind.POWER_UPDATE;
        const progression = isPowerUpdate
            ? IterationProgression.EXPONENTIAL
            : IterationProgression.ADDITIVE;
        const update = isPowerUpdate
            ? {
                progression,
                degree: nonlinear.degree,
                nonlinear: true
            }
            : {
                progression,
                amount: nonlinear.update.amount,
                nonlinear: true
            };
        const bound = nonlinear.kind ===
            NonlinearLoopKind.POLYNOMIAL_GUARD
            ? Cost.power(
                nonlinear.bound,
                Cost.constant(
                    1 / nonlinear.degree
                )
            )
            : nonlinear.bound;
        const condition = {
            operator: nonlinear.operator,
            bound
        };
        const analysis = this.result({
            node,
            variable: nonlinear.variable,
            progression,
            iterations: nonlinear.iterations,
            exact: false,
            assumptions: nonlinear.assumptions,
            updates: [update],
            pathAnalysis,
            terminationEvidence: nonlinear.evidence,
            nonlinear
        });

        return this.enrichProgressionAnalysis(
            analysis,
            this.createTransition({
                node,
                variable: nonlinear.variable,
                condition,
                update,
                start: nonlinear.start,
                bound,
                boundKind: "tight",
                pathAnalysis,
                nonlinear
            })
        );
    }

    analyzeAdditive({
        node,
        variable,
        condition,
        update,
        start,
        bound,
        startValue = null,
        boundValue = null,
        updateExact = true,
        boundKind = "tight",
        pathAnalysis = null,
        updates = []
    }) {
        if (update.piecewise === true) {
            return this.analyzePiecewiseAdditive({
                node,
                variable,
                condition,
                update,
                start,
                bound,
                startValue,
                boundValue,
                updateExact,
                boundKind,
                pathAnalysis,
                updates
            });
        }

        const ascending =
            update.amount > 0;
        if (condition.operator === "!=") {
            return this.analyzeEqualityAdditive({
                node,
                variable,
                update,
                start,
                bound,
                startValue,
                boundValue,
                updateExact,
                boundKind,
                pathAnalysis,
                updates
            });
        }
        const validOperator =
            ascending
                ? (
                    condition.operator ===
                        "<" ||
                    condition.operator ===
                        "<="
                )
                : (
                    condition.operator ===
                        ">" ||
                    condition.operator ===
                        ">="
                );

        if (!validOperator) {
            return this.unknown(
                node,
                "CLRS_ITERATION_DIRECTION_MISMATCH",
                "La actualización se aleja del límite y no garantiza la terminación.",
                variable
            );
        }

        const numericStart =
            numericValue(start);
        const numericBound =
            numericValue(bound);

        if (
            numericStart != null &&
            numericBound != null
        ) {
            return this.result({
                node,
                variable,
                progression:
                    IterationProgression.ADDITIVE,
                iterations:
                    Cost.constant(
                        additiveIterationCount(
                            numericStart,
                            numericBound,
                            condition.operator,
                            update.amount
                        )
                    ),
                exact: updateExact,
                boundKind,
                pathAnalysis,
                updates
            });
        }

        const distance =
            simplifyCostExpression(
                ascending
                    ? Cost.difference(
                        bound,
                        start
                    )
                    : Cost.difference(
                        start,
                        bound
                    )
            );
        const step =
            Math.abs(
                update.amount
            );
        const inclusive =
            condition.operator === "<=" ||
            condition.operator === ">=";
        let iterations;

        if (step === 1) {
            iterations =
                inclusive
                    ? shiftExpression(
                        distance,
                        1
                    )
                    : distance;
        } else {
            const quotient =
                Cost.quotient(
                    distance,
                    Cost.constant(step)
                );

            iterations =
                inclusive
                    ? shiftExpression(
                        Cost.call(
                            "floor",
                            [quotient]
                        ),
                        1
                    )
                    : Cost.call(
                        "ceil",
                        [quotient]
                    );
        }

        return this.result({
            node,
            variable,
            progression:
                IterationProgression.ADDITIVE,
            iterations:
                Cost.maximum([
                    Cost.constant(0),
                    simplifyCostExpression(
                        iterations
                    )
                ]),
            exact: false,
            boundKind,
            pathAnalysis,
            updates,
            assumptions: [
                "La variable de control y el límite toman valores enteros."
            ]
        });
    }

    analyzePiecewiseAdditive({
        node,
        variable,
        condition,
        start,
        bound,
        startValue,
        boundValue,
        updateExact,
        boundKind,
        pathAnalysis,
        updates
    }) {
        const integral =
            startValue?.integral !==
                AbstractIntegrality.NO &&
            boundValue?.integral !==
                AbstractIntegrality.NO;

        if (
            condition.operator !== "!=" ||
            !integral
        ) {
            return this.unknown(
                node,
                "CLRS_ITERATION_DIRECTION_MISMATCH",
                "Las actualizaciones por trayectoria requieren una distancia entera y una guarda de desigualdad.",
                variable,
                { pathAnalysis }
            );
        }

        const distance =
            simplifyCostExpression(
                Cost.call("ABS", [
                    Cost.difference(
                        start,
                        bound
                    )
                ])
            );

        return this.result({
            node,
            variable,
            progression:
                IterationProgression.ADDITIVE,
            iterations: distance,
            exact: updateExact,
            boundKind,
            pathAnalysis,
            updates,
            assumptions: [
                "Cada trayectoria de la guarda avanza una unidad hacia el mismo objetivo entero.",
                ...(
                    startValue?.integral ===
                        AbstractIntegrality.YES &&
                    boundValue?.integral ===
                        AbstractIntegrality.YES
                        ? []
                        : [
                            "El valor inicial y el objetivo pertenecen al dominio entero."
                        ]
                )
            ],
            terminationEvidence: [
                "Las guardas de camino seleccionan el signo del paso que reduce |control - límite|."
            ]
        });
    }

    analyzeEqualityAdditive({
        node,
        variable,
        update,
        start,
        bound,
        startValue,
        boundValue,
        updateExact,
        boundKind,
        pathAnalysis,
        updates
    }) {
        const ascending = update.amount > 0;
        const orientation = ascending
            ? "<="
            : ">=";
        const reachesTarget =
            Math.abs(update.amount) === 1 &&
            startValue?.integral ===
                AbstractIntegrality.YES &&
            boundValue?.integral ===
                AbstractIntegrality.YES &&
            compareAbstractValues(
                startValue,
                boundValue,
                orientation
            ) === true;

        if (!reachesTarget) {
            return this.unknown(
                node,
                "CLRS_ITERATION_DIRECTION_MISMATCH",
                "La igualdad del ciclo sólo es terminante si un paso unitario entero avanza hacia el objetivo sin sobrepasarlo.",
                variable
            );
        }

        const distance = simplifyCostExpression(
            ascending
                ? Cost.difference(bound, start)
                : Cost.difference(start, bound)
        );

        return this.result({
            node,
            variable,
            progression:
                IterationProgression.ADDITIVE,
            iterations: Cost.maximum([
                Cost.constant(0),
                distance
            ]),
            exact: updateExact,
            boundKind,
            pathAnalysis,
            updates,
            assumptions: [
                "La igualdad se alcanza con un paso unitario sobre valores enteros y en la dirección del objetivo."
            ],
            terminationEvidence: [
                "La transición preserva la integridad y reduce exactamente una unidad de distancia al objetivo."
            ]
        });
    }

    createTransition({
        node,
        variable,
        condition,
        update,
        start,
        bound,
        boundKind,
        pathAnalysis,
        relational = null,
        nonlinear = null
    }) {
        return createLoopTransition({
            variable,
            condition,
            update,
            start,
            bound,
            boundKind,
            pathAnalysis,
            relational,
            nonlinear,
            location: node.location
        });
    }

    enrichProgressionAnalysis(
        analysis,
        transition
    ) {
        const trajectory =
            createLoopTrajectory({
                transition,
                iterations:
                    analysis.iterations
            });
        const invariants =
            deriveLoopInvariantAnalysis(
                transition
            );
        const termination = analysis.termination == null
            ? null
            : createTerminationAnalysis({
                ...analysis.termination,
                transition,
                invariants,
                evidence: [
                    ...analysis.termination.evidence,
                    ...invariants.evidence
                ]
            });

        return createIterationAnalysis({
            ...analysis,
            transition,
            trajectory,
            invariants,
            termination
        });
    }

    analyzeMultiplicative({
        node,
        variable,
        condition,
        update,
        start,
        bound,
        updateExact = true,
        boundKind = "tight",
        pathAnalysis = null,
        updates = []
    }) {
        const ascending =
            update.factor > 1;
        const descending =
            update.factor > 0 &&
            update.factor < 1;
        const validOperator =
            (
                ascending &&
                (
                    condition.operator === "<" ||
                    condition.operator === "<="
                )
            ) ||
            (
                descending &&
                (
                    condition.operator === ">" ||
                    condition.operator === ">="
                )
            );

        if (!validOperator) {
            return this.unknown(
                node,
                "CLRS_ITERATION_DIRECTION_MISMATCH",
                "La progresión multiplicativa no garantiza alcanzar el límite.",
                variable
            );
        }

        const numericStart =
            numericValue(start);
        const numericBound =
            numericValue(bound);

        if (
            (
                numericStart != null &&
                numericStart <= 0
            ) ||
            (
                numericBound != null &&
                numericBound <= 0
            )
        ) {
            return this.unknown(
                node,
                "CLRS_ITERATION_NON_TERMINATING",
                "Una progresión multiplicativa requiere valores inicial y límite positivos.",
                variable
            );
        }

        if (
            numericStart != null &&
            numericBound != null
        ) {
            const iterations =
                multiplicativeIterationCount(
                    numericStart,
                    numericBound,
                    condition.operator,
                    update.factor
                );

            if (iterations == null) {
                return this.unknown(
                    node,
                    "CLRS_ITERATION_NON_TERMINATING",
                    "Los valores del ciclo no garantizan una progresión multiplicativa finita.",
                    variable
                );
            }

            return this.result({
                node,
                variable,
                progression:
                    IterationProgression.MULTIPLICATIVE,
                iterations:
                    Cost.constant(
                        iterations
                    ),
                exact: updateExact,
                boundKind,
                pathAnalysis,
                updates
            });
        }

        const base =
            ascending
                ? update.factor
                : 1 / update.factor;
        const ratio =
            simplifyCostExpression(
                Cost.quotient(
                    ascending
                        ? bound
                        : start,
                    ascending
                        ? start
                        : bound
                )
            );
        const logarithm =
            Cost.logarithm(
                ratio,
                Cost.constant(base)
            );
        const inclusive =
            condition.operator === "<=" ||
            condition.operator === ">=";
        const iterations =
            inclusive
                ? shiftExpression(
                    Cost.call(
                        "floor",
                        [logarithm]
                    ),
                    1
                )
                : Cost.call(
                    "ceil",
                    [logarithm]
                );

        return this.result({
            node,
            variable,
            progression:
                IterationProgression.MULTIPLICATIVE,
            iterations:
                Cost.maximum([
                    Cost.constant(0),
                    iterations
                ]),
            exact: false,
            boundKind,
            pathAnalysis,
            updates,
            assumptions: [
                "Los valores inicial y límite son positivos."
            ]
        });
    }

    analyzeAffine({
        node,
        variable,
        condition,
        update,
        start,
        bound,
        updateExact = true,
        boundKind = "tight",
        pathAnalysis = null,
        updates = []
    }) {
        const ascending =
            update.scale > 1 &&
            update.offset >= 0;
        const descending =
            update.scale > 0 &&
            update.scale < 1;
        const validOperator =
            (
                ascending &&
                (
                    condition.operator === "<" ||
                    condition.operator === "<="
                )
            ) ||
            (
                descending &&
                (
                    condition.operator === ">" ||
                    condition.operator === ">="
                )
            );

        if (!validOperator) {
            return this.unknown(
                node,
                "CLRS_ITERATION_DIRECTION_MISMATCH",
                "La transformación afín no garantiza avanzar hacia el límite.",
                variable
            );
        }

        const numericStart =
            numericValue(start);
        const numericBound =
            numericValue(bound);

        if (
            numericStart != null &&
            numericBound != null
        ) {
            const iterations =
                affineIterationCount(
                    numericStart,
                    numericBound,
                    condition.operator,
                    update.scale,
                    update.offset
                );

            if (iterations == null) {
                return this.unknown(
                    node,
                    "CLRS_ITERATION_NON_TERMINATING",
                    "Los valores del ciclo no garantizan una transformación afín finita.",
                    variable
                );
            }

            return this.result({
                node,
                variable,
                progression:
                    IterationProgression.AFFINE,
                iterations:
                    Cost.constant(
                        iterations
                    ),
                exact: updateExact,
                boundKind,
                pathAnalysis,
                updates
            });
        }

        const fixedPoint =
            update.offset /
            (1 - update.scale);
        const shiftedStart =
            shiftExpression(
                start,
                -fixedPoint
            );
        const shiftedBound =
            shiftExpression(
                bound,
                -fixedPoint
            );
        const base =
            ascending
                ? update.scale
                : 1 / update.scale;
        const ratio =
            simplifyCostExpression(
                Cost.quotient(
                    ascending
                        ? shiftedBound
                        : shiftedStart,
                    ascending
                        ? shiftedStart
                        : shiftedBound
                )
            );
        const logarithm =
            Cost.logarithm(
                ratio,
                Cost.constant(base)
            );
        const inclusive =
            condition.operator === "<=" ||
            condition.operator === ">=";
        const iterations =
            inclusive
                ? shiftExpression(
                    Cost.call(
                        "floor",
                        [logarithm]
                    ),
                    1
                )
                : Cost.call(
                    "ceil",
                    [logarithm]
                );

        return this.result({
            node,
            variable,
            progression:
                IterationProgression.AFFINE,
            iterations:
                Cost.maximum([
                    Cost.constant(0),
                    iterations
                ]),
            exact: false,
            boundKind,
            pathAnalysis,
            updates,
            assumptions: [
                "La distancia al punto fijo de la transformación afín permanece positiva."
            ]
        });
    }

    boundChanges(
        bound,
        writtenNames,
        ignoredName = null,
        ignoredNames = new Set()
    ) {
        for (
            const name
            of collectIdentifierNames(bound)
        ) {
            if (
                name !== ignoredName &&
                !ignoredNames.has(name) &&
                writtenNames.has(name)
            ) {
                return true;
            }
        }

        return false;
    }

    dependenciesChange(
        dependencies,
        writtenNames,
        variable
    ) {
        for (const name of dependencies) {
            if (
                name !== variable &&
                writtenNames.has(name)
            ) {
                return true;
            }
        }

        return false;
    }

    result({
        node,
        variable,
        progression,
        iterations,
        exact,
        assumptions = [],
        updates = [],
        boundKind = "tight",
        pathAnalysis = null,
        terminationEvidence = [],
        relational = null,
        nonlinear = null
    }) {
        const simplified =
            simplifyCostExpression(
                iterations
            );

        return createIterationAnalysis({
            kind:
                numericValue(simplified) == null
                    ? (
                        [
                            IterationProgression
                                .MULTIPLICATIVE,
                            IterationProgression.AFFINE,
                            IterationProgression
                                .EXPONENTIAL
                        ].includes(progression)
                            ? IterationAnalysisKind
                                .LOGARITHMIC
                            : IterationAnalysisKind
                                .SYMBOLIC
                    )
                    : IterationAnalysisKind
                        .CONSTANT,
            progression,
            iterations: simplified,
            variable,
            exact,
            assumptions,
            updates,
            boundKind,
            pathAnalysis,
            termination:
                terminatingAnalysis({
                    rankingFunction:
                        simplified,
                    rankingKind:
                        rankingKindFor(
                            progression
                        ),
                    pathAnalysis,
                    evidence:
                        terminationEvidenceFor(
                            progression,
                            pathAnalysis,
                            terminationEvidence
                        ),
                    location:
                        node.location
                }),
            relational,
            nonlinear,
            location: node.location
        });
    }

    unknown(
        node,
        code,
        message,
        variable = null,
        options = {}
    ) {
        return createIterationAnalysis({
            kind:
                IterationAnalysisKind.UNKNOWN,
            progression:
                IterationProgression.UNKNOWN,
            iterations:
                Cost.unknown(),
            variable,
            exact: false,
            code,
            message,
            pathAnalysis:
                options.pathAnalysis ??
                null,
            termination:
                unresolvedTermination({
                    code,
                    message,
                    pathAnalysis:
                        options
                            .pathAnalysis ??
                        null,
                    location:
                        node.location
                }),
            location: node.location
        });
    }
}

function analyzeBodyPaths(body, resolver) {
    const execution =
        executeSymbolicPaths(
            body?.statements ?? [],
            [{
                resolver:
                    resolver.clone(),
                origins: new Map(),
                updated: new Set(),
                locations: [],
                guards: [],
                outcome:
                    IterationPathOutcome
                        .CONTINUE,
                feasible: true,
                valid: true
            }],
            new Set()
        );

    return pathAnalysisFromExecution(
        execution
    );
}

function rankingKindFor(progression) {
    switch (progression) {
        case IterationProgression.ADDITIVE:
            return "linear-distance";
        case IterationProgression
            .MULTIPLICATIVE:
            return "logarithmic-ratio";
        case IterationProgression.AFFINE:
            return "affine-fixed-point";
        case IterationProgression.EXPONENTIAL:
            return "iterated-logarithmic";
        default:
            return "constant-bound";
    }
}

function terminationEvidenceFor(
    progression,
    pathAnalysis,
    evidence
) {
    const result = [...evidence];
    const progressionEvidence =
        {
            [IterationProgression.ADDITIVE]:
                "Cada camino que continúa reduce una distancia lineal hacia el límite.",
            [IterationProgression.MULTIPLICATIVE]:
                "Cada camino que continúa reduce una razón geométrica hacia el límite.",
            [IterationProgression.AFFINE]:
                "Cada camino que continúa reduce la distancia transformada respecto del punto fijo.",
            [IterationProgression.EXPONENTIAL]:
                "Cada camino que continúa acelera el crecimiento de la variable de control mediante una potencia."
        }[progression];

    if (progressionEvidence != null) {
        result.push(progressionEvidence);
    }

    if (pathAnalysis?.hasEarlyExit) {
        result.push(
            "Los caminos restantes salen de la función mediante retornar."
        );
    }

    return [...new Set(result)];
}

function executeSymbolicPaths(
    statements,
    initialPaths,
    controlNames
) {
    let paths = initialPaths;

    for (const statement of statements) {
        const next = [];

        for (const path of paths) {
            next.push(
                ...executeSymbolicStatement(
                    statement,
                    path,
                    controlNames
                )
            );
        }

        if (
            next.length > MAX_UPDATE_PATHS ||
            next.some(path =>
                path.overflow
            )
        ) {
            return {
                paths: [],
                overflow: true
            };
        }

        paths = next;
    }

    return {
        paths,
        overflow: false
    };
}

function executeSymbolicStatement(
    statement,
    path,
    controlNames
) {
    if (
        !path.valid ||
        path.outcome !==
            IterationPathOutcome
                .CONTINUE
    ) {
        return [path];
    }

    if (
        statement.type ===
            NodeTypes.RETURN_STATEMENT
    ) {
        path.outcome =
            IterationPathOutcome.RETURN;
        path.exitLocation =
            statement.location ?? null;

        return [path];
    }

    if (
        statement.type ===
            NodeTypes.ASSIGNMENT
    ) {
        const name =
            identifierName(
                statement.left
            );

        if (name == null) {
            return [path];
        }

        path.origins.set(
            name,
            resolvePathOrigins(
                statement.right,
                path.origins
            )
        );
        path.resolver.assign(
            name,
            statement.right
        );

        if (controlNames.has(name)) {
            path.updated.add(name);
            path.locations.push(
                statement.location
            );
        }

        return [path];
    }

    if (
        statement.type ===
            NodeTypes.READ_STATEMENT
    ) {
        for (
            const target
            of statement.identifiers ?? []
        ) {
            const name =
                identifierName(target);

            if (name == null) {
                continue;
            }

            path.resolver.define(
                name,
                Cost.symbol(name),
                {
                    dependencies: [name],
                    source: "input"
                }
            );
            path.origins.set(
                name,
                new Set([name])
            );

            if (controlNames.has(name)) {
                path.valid = false;
            }
        }

        return [path];
    }

    if (
        statement.type ===
            NodeTypes.IF_STATEMENT
    ) {
        const branches =
            feasibleIfBlocks(
                statement,
                path.resolver
            );

        return branches.flatMap(branch => {
            const branchPath =
                cloneSymbolicPath(path);

            for (const assumption of branch.assumptions) {
                const guard = createPathGuard(
                    assumption.condition,
                    assumption.truth,
                    branchPath.resolver
                );

                if (guard != null) {
                    branchPath.guards.push(
                        guard
                    );
                }

                branchPath.resolver.assume(
                    assumption.condition,
                    assumption.truth
                );
            }

            if (
                !branchPath.resolver
                    .isReachable()
            ) {
                branchPath.valid = false;
                branchPath.feasible = false;
                return [branchPath];
            }

            if (branch.block == null) {
                return [branchPath];
            }

            const execution =
                executeSymbolicPaths(
                branch.block.statements,
                [branchPath],
                controlNames
                );

            return execution.overflow
                ? [{
                    ...branchPath,
                    valid: false,
                    overflow: true
                }]
                : execution.paths;
        });
    }

    if (
        statement.type ===
            NodeTypes.WHILE_STATEMENT ||
        statement.type ===
            NodeTypes.FOR_STATEMENT
    ) {
        const writes =
            collectWrittenNames(
                statement
            );

        for (const name of writes) {
            path.resolver.forget(name);
            path.origins.delete(name);

            if (controlNames.has(name)) {
                path.valid = false;
            }
        }
    }

    return [path];
}

function cloneSymbolicPath(path) {
    return {
        resolver: path.resolver.clone(),
        origins:
            new Map(
                [...path.origins.entries()]
                    .map(([name, origins]) => [
                        name,
                        new Set(origins)
                    ])
            ),
        updated:
            new Set(path.updated),
        locations:
            [...path.locations],
        guards:
            [...(path.guards ?? [])],
        transitions:
            [...(path.transitions ?? [])],
        outcome: path.outcome,
        feasible:
            path.feasible !== false,
        exitLocation:
            path.exitLocation ?? null,
        valid: path.valid
    };
}

function feasibleIfBlocks(
    statement,
    resolver
) {
    const branches = [
        {
            condition:
                statement.condition,
            block:
                statement.thenBlock
        },
        ...(statement.elseIfBranches ?? [])
            .map(branch => ({
                condition:
                    branch.condition,
                block: branch.block
            }))
    ];
    const feasible = [];
    const previous = [];
    let fallthrough = true;

    for (const branch of branches) {
        if (!fallthrough) {
            break;
        }

        const branchResolver =
            resolver.clone();

        for (const condition of previous) {
            branchResolver.assume(
                condition,
                false
            );
        }

        const value =
            evaluateBooleanCondition(
                branch.condition,
                branchResolver
            );

        if (value !== false) {
            feasible.push({
                block: branch.block,
                assumptions: [
                    ...previous.map(
                        condition => ({
                            condition,
                            truth: false
                        })
                    ),
                    {
                        condition:
                            branch.condition,
                        truth: true
                    }
                ]
            });
        }

        if (value === true) {
            fallthrough = false;
        }


        previous.push(
            branch.condition
        );
    }

    if (fallthrough) {
        feasible.push({
            block:
                statement.elseBlock ??
                null,
            assumptions:
                previous.map(condition => ({
                    condition,
                    truth: false
                }))
        });
    }

    return feasible;
}

function createPathGuard(
    node,
    truth,
    resolver
) {
    const expression = unwrapGroup(node);

    if (
        expression?.type !==
            NodeTypes.BINARY_EXPRESSION ||
        ![
            "<",
            "<=",
            ">",
            ">=",
            "==",
            "!="
        ].includes(expression.operator)
    ) {
        return null;
    }

    return {
        operator: expression.operator,
        left: resolver.resolve(
            expression.left
        ),
        right: resolver.resolve(
            expression.right
        ),
        truth,
        location:
            expression.location ??
            node.location ?? null
    };
}

function evaluateBooleanCondition(
    node,
    resolver
) {
    const expression = unwrapGroup(node);
    const abstract =
        resolver.evaluateCondition?.(
            expression
        );

    if (abstract != null) {
        return abstract;
    }

    if (
        expression?.type ===
            NodeTypes.BOOLEAN_LITERAL
    ) {
        return expression.value ===
            "TRUE";
    }

    if (
        expression?.type ===
            NodeTypes.LOGICAL_NOT
    ) {
        const value =
            evaluateBooleanCondition(
                expression.operand,
                resolver
            );

        return value == null
            ? null
            : !value;
    }

    if (
        expression?.type ===
            NodeTypes.LOGICAL_EXPRESSION
    ) {
        const left =
            evaluateBooleanCondition(
                expression.left,
                resolver
            );
        const right =
            evaluateBooleanCondition(
                expression.right,
                resolver
            );

        if (expression.operator === "&&") {
            return left === false ||
                right === false
                ? false
                : left === true &&
                    right === true
                    ? true
                    : null;
        }

        if (expression.operator === "||") {
            return left === true ||
                right === true
                ? true
                : left === false &&
                    right === false
                    ? false
                    : null;
        }

        return null;
    }

    if (
        expression?.type ===
            NodeTypes.BINARY_EXPRESSION &&
        [
            "<",
            "<=",
            ">",
            ">=",
            "==",
            "!="
        ].includes(expression.operator)
    ) {
        const left =
            resolver.resolve(
                expression.left
            );
        const right =
            resolver.resolve(
                expression.right
            );
        const numericLeft =
            numericValue(left);
        const numericRight =
            numericValue(right);

        if (
            numericLeft != null &&
            numericRight != null
        ) {
            return evaluateNumericComparison(
                numericLeft,
                numericRight,
                expression.operator
            );
        }

        if (
            expression.operator === "==" ||
            expression.operator === "!="
        ) {
            const equivalent =
                areCostExpressionsEquivalent(
                    left,
                    right
                );

            return expression.operator === "=="
                ? equivalent || null
                : equivalent
                    ? false
                    : null;
        }

        return null;
    }

    const numeric =
        numericValue(
            resolver.resolve(
                expression
            )
        );

    return numeric == null
        ? null
        : Boolean(numeric);
}

function evaluateNumericComparison(
    left,
    right,
    operator
) {
    switch (operator) {
        case "<":
            return left < right;
        case "<=":
            return left <= right;
        case ">":
            return left > right;
        case ">=":
            return left >= right;
        case "==":
            return left === right;
        case "!=":
            return left !== right;
        default:
            return null;
    }
}

function pathAnalysisFromExecution(
    execution
) {
    return createIterationPathAnalysis({
        overflow: execution.overflow,
        paths:
            execution.paths.map(
                (path, id) => ({
                    id,
                    outcome:
                        path.valid
                            ? path.outcome
                            : IterationPathOutcome
                                .UNKNOWN,
                    feasible:
                        path.feasible !== false,
                    updatedNames:
                        [...path.updated],
                    guards:
                        path.guards ?? [],
                    transitions:
                        path.transitions ?? [],
                    locations:
                        path.locations,
                    exitLocation:
                        path.exitLocation ??
                        null
                })
            )
    });
}

function resolvePathOrigins(
    expression,
    origins
) {
    const resolved = new Set();

    for (
        const name
        of collectIdentifierNames(
            expression
        )
    ) {
        if (origins.has(name)) {
            for (
                const origin
                of origins.get(name)
            ) {
                resolved.add(origin);
            }
        } else {
            resolved.add(name);
        }
    }

    return resolved;
}

function affineUpdateFromExpression(
    expression,
    variables
) {
    switch (expression.kind) {
        case CostExpressionKind.CONSTANT:
            return affineValue(
                variables,
                expression.value
            );
        case CostExpressionKind.SYMBOL:
            return variables.includes(
                expression.name
            )
                ? affineValue(
                    variables,
                    0,
                    expression.name,
                    1
                )
                : null;
        case CostExpressionKind.GROUP:
            return affineUpdateFromExpression(
                expression.expression,
                variables
            );
        case CostExpressionKind.SUM:
            return combineAffineMany(
                expression.terms,
                variables,
                1
            );
        case CostExpressionKind.DIFFERENCE:
            return combineAffinePair(
                affineUpdateFromExpression(
                    expression.left,
                    variables
                ),
                affineUpdateFromExpression(
                    expression.right,
                    variables
                ),
                -1
            );
        case CostExpressionKind.PRODUCT:
            return multiplyAffineMany(
                expression.factors,
                variables
            );
        case CostExpressionKind.QUOTIENT: {
            const denominator =
                numericValue(
                    expression.denominator
                );

            return denominator == null ||
                denominator === 0
                ? null
                : scaleAffine(
                    affineUpdateFromExpression(
                        expression.numerator,
                        variables
                    ),
                    1 / denominator
                );
        }
        case CostExpressionKind.CALL:
            return unwrapAffineCall(
                expression,
                variables
            );
        default:
            return null;
    }
}

function combineAffineMany(
    expressions,
    variables,
    sign
) {
    let result =
        affineValue(
            variables,
            0
        );

    for (const expression of expressions) {
        result = combineAffinePair(
            result,
            affineUpdateFromExpression(
                expression,
                variables
            ),
            sign
        );

        if (result == null) {
            return null;
        }
    }

    return result;
}

function combineAffinePair(
    left,
    right,
    rightSign
) {
    if (left == null || right == null) {
        return null;
    }

    const coefficients = {};

    for (
        const name
        of Object.keys(
            left.coefficients
        )
    ) {
        coefficients[name] =
            left.coefficients[name] +
            rightSign *
                right.coefficients[name];
    }

    return {
        coefficients,
        constant:
            left.constant +
            rightSign * right.constant,
        rounded:
            left.rounded || right.rounded,
        absolute:
            left.absolute || right.absolute
    };
}

function multiplyAffineMany(
    expressions,
    variables
) {
    let scalar = 1;
    let affine = null;

    for (const expression of expressions) {
        const current =
            affineUpdateFromExpression(
                expression,
                variables
            );

        if (current == null) {
            return null;
        }

        if (isAffineConstant(current)) {
            scalar *= current.constant;
        } else if (affine == null) {
            affine = current;
        } else {
            return null;
        }
    }

    return affine == null
        ? affineValue(
            variables,
            scalar
        )
        : scaleAffine(
            affine,
            scalar
        );
}

function scaleAffine(affine, scalar) {
    if (affine == null) {
        return null;
    }

    return {
        coefficients:
            Object.fromEntries(
                Object.entries(
                    affine.coefficients
                ).map(([name, value]) => [
                    name,
                    value * scalar
                ])
            ),
        constant:
            affine.constant * scalar,
        rounded: affine.rounded,
        absolute: affine.absolute
    };
}

function unwrapAffineCall(
    expression,
    variables
) {
    if (expression.args?.length !== 1) {
        return null;
    }

    const definition =
        getStandardLibraryDefinition(
            expression.name
        );
    const effect =
        definition?.symbolicEffect
            .kind;

    if (
        effect !==
            StandardLibrarySymbolicEffect
                .ROUNDING &&
        effect !==
            StandardLibrarySymbolicEffect
                .ABSOLUTE
    ) {
        return null;
    }

    const affine =
        affineUpdateFromExpression(
            expression.args[0],
            variables
        );

    return affine == null
        ? null
        : {
            ...affine,
            rounded:
                affine.rounded ||
                effect ===
                    StandardLibrarySymbolicEffect
                        .ROUNDING,
            absolute:
                affine.absolute ||
                effect ===
                    StandardLibrarySymbolicEffect
                        .ABSOLUTE
        };
}

function affineValue(
    variables,
    constant,
    variable = null,
    coefficient = 0
) {
    return {
        coefficients:
            Object.fromEntries(
                variables.map(name => [
                    name,
                    name === variable
                        ? coefficient
                        : 0
                ])
            ),
        constant,
        rounded: false,
        absolute: false
    };
}

function isAffineConstant(affine) {
    return Object.values(
        affine.coefficients
    ).every(value =>
        approximatelyUpdateEqual(
            value,
            0
        )
    );
}

function affineForVariable(
    affine,
    variable,
    variables
) {
    if (
        variables.some(name =>
            name !== variable &&
            !approximatelyUpdateEqual(
                affine.coefficients[name],
                0
            )
        )
    ) {
        return null;
    }

    return {
        scale:
            normalizedUpdateNumber(
                affine.coefficients[
                    variable
                ]
            ),
        offset:
            normalizedUpdateNumber(
                affine.constant
            ),
        rounded: affine.rounded,
        absolute: affine.absolute
    };
}

function collapseUpdateAlternatives(
    transforms,
    operator
) {
    const classified =
        transforms.map(
            classifyAffineUpdate
        );

    if (classified.some(update =>
        update == null
    )) {
        return updateFailure(
            "CLRS_ITERATION_UPDATE_PATH_INCOMPLETE",
            "Existe un camino que no produce avance en la variable de control."
        );
    }

    const updates =
        transforms.map(
            describeAffineUpdate
        );
    const first = transforms[0];
    const equivalent =
        transforms.every(transform =>
            equivalentAffineUpdate(
                transform,
                first
            )
        );

    if (equivalent) {
        return {
            ok: true,
            update: classified[0],
            exact:
                transforms.every(
                    transform =>
                        !transform.rounded
                ),
            boundKind: "tight",
            updates
        };
    }

    if (
        classified.every(update =>
            update.progression ===
                IterationProgression.ADDITIVE
        ) &&
        classified.every(update =>
            progressionMatches(
                operator,
                update
            )
        )
    ) {
        const ascending =
            classified[0].amount > 0;
        const amount =
            ascending
                ? Math.min(
                    ...classified.map(
                        update =>
                            update.amount
                    )
                )
                : Math.max(
                    ...classified.map(
                        update =>
                            update.amount
                    )
                );

        return {
            ok: true,
            update:
                additiveUpdate(amount),
            exact: false,
            boundKind: "upper",
            updates
        };
    }

    if (
        classified.every(update =>
            update.progression ===
                IterationProgression
                    .MULTIPLICATIVE
        ) &&
        classified.every(update =>
            progressionMatches(
                operator,
                update
            )
        )
    ) {
        const ascending =
            classified[0].factor > 1;
        const factor =
            ascending
                ? Math.min(
                    ...classified.map(
                        update =>
                            update.factor
                    )
                )
                : Math.max(
                    ...classified.map(
                        update =>
                            update.factor
                    )
                );

        return {
            ok: true,
            update:
                multiplicativeUpdate(
                    factor
                ),
            exact: false,
            boundKind: "upper",
            updates
        };
    }

    return updateFailure(
        "CLRS_ITERATION_UPDATE_CONFLICT",
        "Los caminos del ciclo aplican actualizaciones con progresiones incompatibles."
    );
}

function collapsePiecewiseEquality({
    pathTransitions,
    variable,
    condition,
    resolver
}) {
    if (
        condition.operator !== "!=" ||
        !Array.isArray(pathTransitions) ||
        pathTransitions.length === 0
    ) {
        return null;
    }

    const bound = resolver.resolve(
        condition.bound
    );
    const variableExpression =
        Cost.symbol(variable);
    const classified = [];

    for (const item of pathTransitions) {
        const affine =
            item.transform?.[variable];
        const update =
            classifyAffineUpdate(affine);

        if (
            update?.progression !==
                IterationProgression.ADDITIVE ||
            Math.abs(update.amount) !== 1
        ) {
            return null;
        }

        const direction = update.amount > 0
            ? "below"
            : "above";

        if (
            !pathProvesRelativeDirection(
                item.path,
                variableExpression,
                bound,
                direction
            )
        ) {
            return null;
        }

        classified.push(update);
    }

    return {
        ok: true,
        update: {
            progression:
                IterationProgression.ADDITIVE,
            amount: 1,
            piecewise: true,
            directions: Object.freeze([
                ...new Set(
                    classified.map(update =>
                        update.amount
                    )
                )
            ])
        },
        exact: true,
        boundKind: "tight",
        updates:
            pathTransitions.flatMap(item =>
                item.path.transitions ?? []
            )
    };
}

function pathProvesRelativeDirection(
    path,
    variable,
    bound,
    direction
) {
    const relations = (path.guards ?? [])
        .map(guard =>
            normalizedGuardRelation(
                guard,
                variable,
                bound
            )
        )
        .filter(Boolean);
    const excludesEquality =
        relations.includes("!=");

    if (direction === "below") {
        return relations.includes("<") ||
            (
                relations.includes("<=") &&
                excludesEquality
            );
    }

    return relations.includes(">") ||
        (
            relations.includes(">=") &&
            excludesEquality
        );
}

function normalizedGuardRelation(
    guard,
    variable,
    bound
) {
    const leftControl =
        areCostExpressionsEquivalent(
            guard.left,
            variable
        );
    const rightControl =
        areCostExpressionsEquivalent(
            guard.right,
            variable
        );
    const leftBound =
        areCostExpressionsEquivalent(
            guard.left,
            bound
        );
    const rightBound =
        areCostExpressionsEquivalent(
            guard.right,
            bound
        );

    if (
        leftControl &&
        rightBound
    ) {
        return guard.truth
            ? guard.operator
            : negateComparison(
                guard.operator
            );
    }

    if (
        rightControl &&
        leftBound
    ) {
        const inverted =
            COMPARISON_INVERSE[
                guard.operator
            ];

        return guard.truth
            ? inverted
            : negateComparison(inverted);
    }

    return null;
}

function negateComparison(operator) {
    return {
        "<": ">=",
        "<=": ">",
        ">": "<=",
        ">=": "<",
        "=": "!=",
        "!=": "="
    }[operator] ?? null;
}

function classifyAffineUpdate(update) {
    if (
        approximatelyUpdateEqual(
            update.scale,
            1
        )
    ) {
        return additiveUpdate(
            update.offset
        );
    }

    if (
        approximatelyUpdateEqual(
            update.offset,
            0
        )
    ) {
        return multiplicativeUpdate(
            update.scale
        );
    }

    if (
        update.scale > 0 &&
        Number.isFinite(update.scale) &&
        Number.isFinite(update.offset)
    ) {
        return {
            progression:
                IterationProgression.AFFINE,
            scale: update.scale,
            offset: update.offset
        };
    }

    return null;
}

function describeAffineUpdate(update) {
    const classified =
        classifyAffineUpdate(update);

    return {
        progression:
            classified?.progression ??
            IterationProgression.UNKNOWN,
        amount:
            classified?.amount ?? null,
        factor:
            classified?.factor ?? null,
        scale: update.scale,
        offset: update.offset,
        rounded: update.rounded,
        absolute: update.absolute
    };
}

function equivalentAffineUpdate(
    left,
    right
) {
    return (
        approximatelyUpdateEqual(
            left.scale,
            right.scale
        ) &&
        approximatelyUpdateEqual(
            left.offset,
            right.offset
        ) &&
        left.absolute === right.absolute
    );
}

function isPureAdditive(update) {
    return approximatelyUpdateEqual(
        update.scale,
        1
    );
}

function updateDiscovery(
    candidate,
    code = null,
    message = null,
    pathAnalysis = null
) {
    return {
        candidate,
        code,
        message,
        pathAnalysis:
            candidate?.pathAnalysis ??
            pathAnalysis
    };
}

function updateFailure(
    code,
    message,
    details = {}
) {
    return {
        ok: false,
        code,
        message,
        ...details
    };
}

function approximatelyUpdateEqual(
    left,
    right
) {
    return Math.abs(left - right) <
        UPDATE_EPSILON;
}

function normalizedUpdateNumber(value) {
    return approximatelyUpdateEqual(
        value,
        0
    )
        ? 0
        : approximatelyUpdateEqual(
            value,
            1
        )
            ? 1
            : value;
}

function additiveUpdate(amount) {
    if (
        amount === 0 ||
        !Number.isFinite(amount)
    ) {
        return null;
    }

    return {
        progression:
            IterationProgression.ADDITIVE,
        amount
    };
}

function multiplicativeUpdate(factor) {
    if (
        factor <= 0 ||
        factor === 1 ||
        !Number.isFinite(factor)
    ) {
        return null;
    }

    return {
        progression:
            IterationProgression
                .MULTIPLICATIVE,
        factor
    };
}

function progressionMatches(
    operator,
    update
) {
    if (
        update.progression ===
        IterationProgression.ADDITIVE
    ) {
        return (
            (
                update.amount > 0 &&
                (
                    operator === "<" ||
                    operator === "<="
                )
            ) ||
            (
                update.amount < 0 &&
                (
                    operator === ">" ||
                    operator === ">="
                )
            )
        );
    }

    if (
        update.progression ===
        IterationProgression.AFFINE
    ) {
        return (
            (
                update.scale > 1 &&
                update.offset >= 0 &&
                (
                    operator === "<" ||
                    operator === "<="
                )
            ) ||
            (
                update.scale > 0 &&
                update.scale < 1 &&
                (
                    operator === ">" ||
                    operator === ">="
                )
            )
        );
    }

    return (
        (
            update.factor > 1 &&
            (
                operator === "<" ||
                operator === "<="
            )
        ) ||
        (
            update.factor > 0 &&
            update.factor < 1 &&
            (
                operator === ">" ||
                operator === ">="
            )
        )
    );
}

function additiveIterationCount(
    start,
    bound,
    operator,
    amount
) {
    const distance =
        amount > 0
            ? bound - start
            : start - bound;
    const step =
        Math.abs(amount);
    const inclusive =
        operator === "<=" ||
        operator === ">=";

    return Math.max(
        0,
        inclusive
            ? Math.floor(
                distance / step
            ) + 1
            : Math.ceil(
                distance / step
            )
    );
}

function multiplicativeIterationCount(
    start,
    bound,
    operator,
    factor
) {
    if (
        start <= 0 ||
        bound <= 0
    ) {
        return null;
    }

    const condition = value => {
        switch (operator) {
            case "<":
                return value < bound;
            case "<=":
                return value <= bound;
            case ">":
                return value > bound;
            case ">=":
                return value >= bound;
            default:
                return false;
        }
    };
    let value = start;
    let iterations = 0;

    while (condition(value)) {
        value *= factor;
        iterations++;

        if (
            iterations > 100000 ||
            value === start ||
            !Number.isFinite(value)
        ) {
            return null;
        }
    }

    return iterations;
}

function affineIterationCount(
    start,
    bound,
    operator,
    scale,
    offset
) {
    const condition = value => {
        switch (operator) {
            case "<":
                return value < bound;
            case "<=":
                return value <= bound;
            case ">":
                return value > bound;
            case ">=":
                return value >= bound;
            default:
                return false;
        }
    };
    let value = start;
    let iterations = 0;

    while (condition(value)) {
        const next =
            scale * value +
            offset;

        if (
            !Number.isFinite(next) ||
            approximatelyUpdateEqual(
                next,
                value
            ) ||
            iterations > 100000
        ) {
            return null;
        }

        value = next;
        iterations++;
    }

    return iterations;
}

function shiftExpression(
    expression,
    amount
) {
    const simplified =
        simplifyCostExpression(
            expression
        );

    if (
        simplified.kind ===
        CostExpressionKind.CONSTANT
    ) {
        return Cost.constant(
            simplified.value +
            amount
        );
    }

    if (
        simplified.kind ===
            CostExpressionKind.DIFFERENCE &&
        simplified.right.kind ===
            CostExpressionKind.CONSTANT
    ) {
        const remainder =
            simplified.right.value -
            amount;

        if (remainder === 0) {
            return simplified.left;
        }

        if (remainder > 0) {
            return Cost.difference(
                simplified.left,
                Cost.constant(
                    remainder
                )
            );
        }

        return Cost.sum([
            simplified.left,
            Cost.constant(
                -remainder
            )
        ]);
    }

    return simplifyCostExpression(
        Cost.sum([
            simplified,
            Cost.constant(amount)
        ])
    );
}

function numericValue(expression) {
    const simplified =
        simplifyCostExpression(
            expression
        );

    return (
        simplified.kind ===
            CostExpressionKind.CONSTANT
            ? simplified.value
            : null
    );
}

function containsUnknown(expression) {
    if (
        expression.kind ===
        CostExpressionKind.UNKNOWN
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
                containsUnknown(item)
            )
        ) {
            return true;
        }

        if (
            value != null &&
            typeof value === "object" &&
            typeof value.kind === "string" &&
            containsUnknown(value)
        ) {
            return true;
        }
    }

    return false;
}

function identifierName(node) {
    return (
        node?.type ===
            NodeTypes.IDENTIFIER
            ? node.name
            : null
    );
}

function unwrapStandardUpdate(node) {
    let expression =
        unwrapGroup(node);
    let absolute = false;

    while (
        expression?.type ===
            NodeTypes.FUNCTION_CALL &&
        expression.arguments?.length === 1
    ) {
        const definition =
            getStandardLibraryDefinition(
                expression.identifier
                    ?.name
            );
        const effect =
            definition
                ?.symbolicEffect.kind;

        if (
            effect !==
                StandardLibrarySymbolicEffect
                    .ROUNDING &&
            effect !==
                StandardLibrarySymbolicEffect
                    .ABSOLUTE
        ) {
            break;
        }

        absolute =
            absolute ||
            effect ===
                StandardLibrarySymbolicEffect
                    .ABSOLUTE;
        expression =
            unwrapGroup(
                expression.arguments[0]
            );
    }

    return {
        expression,
        absolute
    };
}

function absoluteUpdateIsSafe(
    update,
    condition,
    resolver
) {
    if (
        condition == null ||
        (
            condition.operator !== ">" &&
            condition.operator !== ">="
        )
    ) {
        return false;
    }

    const bound =
        numericValue(
            resolver.resolve(
                condition.bound
            )
        );

    if (
        bound == null ||
        bound < 0
    ) {
        return false;
    }

    if (
        update.progression ===
        IterationProgression
            .MULTIPLICATIVE
    ) {
        return (
            update.factor > 0 &&
            update.factor < 1
        );
    }

    return (
        update.progression ===
            IterationProgression
                .ADDITIVE &&
        update.amount < 0 &&
        bound >=
            Math.abs(
                update.amount
            )
    );
}

function unwrapGroup(node) {
    let current = node;

    while (
        current?.type ===
        NodeTypes.GROUP_EXPRESSION
    ) {
        current =
            current.expression;
    }

    return current;
}

export function collectIdentifierNames(
    node,
    names = new Set()
) {
    if (
        node == null ||
        typeof node !== "object"
    ) {
        return names;
    }

    if (
        node.type ===
        NodeTypes.IDENTIFIER
    ) {
        names.add(node.name);
        return names;
    }

    for (
        const [key, value]
        of Object.entries(node)
    ) {
        if (
            key === "location" ||
            key === "type"
        ) {
            continue;
        }

        if (Array.isArray(value)) {
            for (const item of value) {
                collectIdentifierNames(
                    item,
                    names
                );
            }
        } else {
            collectIdentifierNames(
                value,
                names
            );
        }
    }

    return names;
}

export function collectWrittenNames(
    node,
    names = new Set()
) {
    if (
        node == null ||
        typeof node !== "object"
    ) {
        return names;
    }

    if (
        node.type ===
        NodeTypes.FUNCTION_DECLARATION
    ) {
        return names;
    }

    if (
        node.type ===
        NodeTypes.ASSIGNMENT
    ) {
        const name =
            identifierName(node.left);

        if (name != null) {
            names.add(name);
        }
    }

    if (
        node.type ===
        NodeTypes.READ_STATEMENT
    ) {
        for (
            const target
            of node.identifiers ?? []
        ) {
            const name =
                identifierName(target);

            if (name != null) {
                names.add(name);
            }
        }
    }

    for (
        const [key, value]
        of Object.entries(node)
    ) {
        if (
            key === "location" ||
            key === "type"
        ) {
            continue;
        }

        if (Array.isArray(value)) {
            for (const item of value) {
                collectWrittenNames(
                    item,
                    names
                );
            }
        } else {
            collectWrittenNames(
                value,
                names
            );
        }
    }

    return names;
}
