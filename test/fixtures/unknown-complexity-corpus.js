import {
    ComplexityCoverageOutcome
} from "../../src/complex/coverage/index.js";

const Outcome = ComplexityCoverageOutcome;

export const unknownComplexityCorpus =
    Object.freeze([
        corpusCase({
            id: "array-element-initializer",
            name:
                "valor inicial no representable",
            source: [
                "RECORRE(n, A)",
                "    para i = A[0] hasta n",
                "        escribir i"
            ],
            expectedCurrentCodes: [
                "CLRS_ITERATION_VALUE_UNRESOLVED",
                "CLRS_ASYMPTOTIC_UNKNOWN_COST"
            ],
            targetBlock:
                "symbolic-domains",
            expectedCurrentOutcome:
                Outcome.UNKNOWN,
            targetOutcome:
                Outcome.CONDITIONAL,
            expectedFuture: "conditional"
        }),
        corpusCase({
            id: "mutable-loop-bound",
            name: "límite mutable",
            source: [
                "LIMITE_MUTABLE(n)",
                "    i = 0",
                "    mientras i < n",
                "        i = i + 1",
                "        n = n + 1"
            ],
            expectedCurrentCodes: [
                "CLRS_ITERATION_BOUND_MUTATED",
                "CLRS_ASYMPTOTIC_UNKNOWN_COST"
            ],
            targetBlock:
                "path-and-termination-analysis",
            expectedCurrentOutcome:
                Outcome.CONDITIONAL,
            targetOutcome:
                Outcome.UNKNOWN,
            expectedFuture: "O(?)"
        }),
        corpusCase({
            id: "divergent-loop-direction",
            name: "dirección no terminante",
            source: [
                "DIRECCION(n)",
                "    i = 0",
                "    mientras i < n",
                "        i = i - 1"
            ],
            expectedCurrentCodes: [
                "CLRS_ITERATION_DIRECTION_MISMATCH",
                "CLRS_ASYMPTOTIC_UNKNOWN_COST"
            ],
            targetBlock:
                "path-and-termination-analysis",
            expectedCurrentOutcome:
                Outcome.CONDITIONAL,
            targetOutcome:
                Outcome.CONDITIONAL,
            expectedFuture: "non-terminating"
        }),
        corpusCase({
            id: "recursive-call-without-reduction",
            name: "recurrencia sin reducción",
            source: [
                "SIN_REDUCCION(n)",
                "    retornar SIN_REDUCCION(n)"
            ],
            expectedCurrentCodes: [
                "CLRS_RECURRENCE_BASE_CASE_UNPROVEN",
                "CLRS_ASYMPTOTIC_RECURRENCE_UNRESOLVED"
            ],
            targetBlock:
                "recurrence-systems",
            expectedCurrentOutcome:
                Outcome.UNKNOWN,
            targetOutcome:
                Outcome.UNKNOWN,
            expectedFuture: "O(?)"
        }),
        corpusCase({
            id: "mixed-recursive-reduction",
            name: "reducción recursiva mixta",
            source: [
                "MIXTA(n)",
                "    si n > 1",
                "        MIXTA(n - 1)",
                "        MIXTA(n / 2)"
            ],
            expectedCurrentCodes: [],
            resolvedCodes: [
                "CLRS_RECURRENCE_MIXED_REDUCTION"
            ],
            targetBlock:
                "advanced-recurrences",
            expectedCurrentOutcome:
                Outcome.UPPER_BOUND,
            expectedNotation:
                "O(2^n)",
            targetOutcome:
                Outcome.UPPER_BOUND,
            expectedFuture: "upper-bound"
        }),
        corpusCase({
            id: "mutual-recursion-without-base-case",
            name: "recursión mutua",
            source: [
                "A(n)",
                "    retornar B(n - 1)",
                "B(n)",
                "    retornar A(n - 1)"
            ],
            expectedCurrentCodes: [
                "CLRS_CALL_GRAPH_BASE_CASE_UNPROVEN",
                "CLRS_ASYMPTOTIC_RECURRENCE_UNRESOLVED"
            ],
            targetBlock:
                "base-case-proof",
            expectedCurrentOutcome:
                Outcome.UNKNOWN,
            targetOutcome:
                Outcome.UNKNOWN,
            expectedFuture: "O(?)"
        }),
        corpusCase({
            id: "unresolved-call-is-semantic-error",
            name: "función de costo ausente",
            source: [
                "USA(n)",
                "    NO_EXISTE(n)"
            ],
            expectedCurrentCodes: [
                "CLRS_ASYMPTOTIC_CALL_UNRESOLVED"
            ],
            targetBlock:
                "parameterized-function-costs",
            expectedCurrentOutcome:
                Outcome.SEMANTIC_ERROR,
            targetOutcome:
                Outcome.SEMANTIC_ERROR,
            expectedFuture: "semantic-error"
        }),
        corpusCase({
            id: "missing-function-argument",
            name:
                "argumento requerido ausente",
            source: [
                "RECORRE(n)",
                "    para i = 0 hasta n - 1",
                "        escribir i",
                "USA()",
                "    RECORRE()"
            ],
            expectedCurrentCodes: [
                "CLRS_ASYMPTOTIC_CALL_ARGUMENT_MISSING"
            ],
            targetBlock:
                "argument-domain-analysis",
            expectedCurrentOutcome:
                Outcome.UNKNOWN,
            targetOutcome:
                Outcome.CONDITIONAL,
            expectedFuture: "conditional"
        }),
        corpusCase({
            id: "harmonic-bound-index",
            name:
                "sumatoria armónica con índice ligado",
            source: [
                "ARMONICA(n)",
                "    para i = 1 hasta n",
                "        para j = 1 hasta n / i",
                "            escribir j"
            ],
            expectedCurrentCodes: [],
            resolvedCodes: [
                "CLRS_ASYMPTOTIC_EXPRESSION_UNSUPPORTED"
            ],
            targetBlock:
                "asymptotic-summations",
            expectedCurrentOutcome:
                Outcome.EXACT,
            targetOutcome:
                Outcome.EXACT,
            expectedNotation: "O(n log n)",
            expectedFuture: "Θ(n log n)"
        }),
        corpusCase({
            id: "quadratic-guard-linear-update",
            name:
                "guardia cuadrática con actualización lineal",
            source: [
                "RAIZ_LINEAL(n)",
                "    i = 0",
                "    mientras i * i < n",
                "        i = i + 1"
            ],
            expectedCurrentCodes: [],
            resolvedCodes: [
                "CLRS_ITERATION_UPDATE_PATH_INCOMPLETE"
            ],
            targetBlock:
                "nonlinear-loop-guards",
            expectedCurrentOutcome:
                Outcome.CONDITIONAL,
            targetOutcome:
                Outcome.EXACT,
            expectedFuture: "Θ(√n)"
        }),
        corpusCase({
            id: "binary-search-interval",
            name:
                "búsqueda binaria por intervalo",
            source: [
                "BUSCA(A, x)",
                "    p = 0",
                "    r = LONG(A) - 1",
                "    mientras p <= r",
                "        q = PISO((p + r) / 2)",
                "        si A[q] < x",
                "            p = q + 1",
                "        sino",
                "            r = q - 1"
            ],
            expectedCurrentCodes: [],
            resolvedCodes: [
                "CLRS_ITERATION_UPDATE_PATH_INCOMPLETE"
            ],
            targetBlock:
                "relational-loop-analysis",
            expectedCurrentOutcome:
                Outcome.CONDITIONAL,
            targetOutcome:
                Outcome.EXACT,
            expectedFuture: "Θ(log n)"
        }),
        corpusCase({
            id: "nonlinear-self-update",
            name:
                "actualización no lineal i = i²",
            source: [
                "POTENCIAS(n)",
                "    i = 2",
                "    mientras i < n",
                "        i = i ^ 2"
            ],
            expectedCurrentCodes: [],
            resolvedCodes: [
                "CLRS_ITERATION_UPDATE_NOT_FOUND"
            ],
            targetBlock:
                "nonlinear-loop-updates",
            expectedCurrentOutcome:
                Outcome.CONDITIONAL,
            targetOutcome:
                Outcome.EXACT,
            expectedFuture: "Θ(log log n)"
        }),
        corpusCase({
            id: "euclidean-remainder-loop",
            name:
                "ciclo euclidiano mediante residuo",
            source: [
                "MCD(a, b)",
                "    mientras b != 0",
                "        r = a % b",
                "        a = b",
                "        b = r"
            ],
            expectedCurrentCodes: [
                "CLRS_ASYMPTOTIC_UNKNOWN_COST",
                "CLRS_ITERATION_UPDATE_NOT_FOUND"
            ],
            targetBlock:
                "euclidean-reductions",
            expectedCurrentOutcome:
                Outcome.UNKNOWN,
            targetOutcome:
                Outcome.UPPER_BOUND,
            expectedFuture: "O(log min(a, b))"
        }),
        corpusCase({
            id: "square-root-recurrence",
            name:
                "recurrencia con raíz cuadrada",
            source: [
                "RAIZ_RECURSIVA(n)",
                "    si n > 1",
                "        retornar RAIZ_RECURSIVA(RAIZ(n))",
                "    retornar 0"
            ],
            expectedCurrentCodes: [],
            resolvedCodes: [
                "CLRS_RECURRENCE_ARGUMENT_UNSUPPORTED"
            ],
            targetBlock:
                "generalized-power-recurrences",
            expectedCurrentOutcome:
                Outcome.CONDITIONAL,
            targetOutcome:
                Outcome.EXACT,
            expectedNotation: "O(log log n)",
            expectedFuture: "Θ(log log n)"
        }),
        corpusCase({
            id: "variable-mixed-recurrence",
            name:
                "recurrencia mixta con ramificación variable",
            source: [
                "VARIABLE_MIXTA(n)",
                "    si n > 1",
                "        para i = 1 hasta n",
                "            VARIABLE_MIXTA(n - 1)",
                "        VARIABLE_MIXTA(PISO(n / 2))",
                "    retornar 0"
            ],
            expectedCurrentCodes: [
                "CLRS_ASYMPTOTIC_RECURRENCE_UNRESOLVED",
                "CLRS_RECURRENCE_MIXED_REDUCTION"
            ],
            targetBlock:
                "variable-branching-recurrences",
            expectedCurrentOutcome:
                Outcome.UNKNOWN,
            targetOutcome:
                Outcome.UPPER_BOUND,
            expectedFuture: "upper-bound"
        })
    ]);

function corpusCase({
    source,
    functionName = null,
    expectedCurrentCodes = [],
    resolvedCodes = [],
    expectedCurrentOutcome,
    targetOutcome,
    ...metadata
}) {
    return Object.freeze({
        ...metadata,
        source:
            Object.freeze([...source]),
        functionName:
            functionName ??
            lastDeclaredFunction(source),
        expectedCurrentCodes:
            Object.freeze([
                ...expectedCurrentCodes
            ]),
        resolvedCodes:
            Object.freeze([
                ...resolvedCodes
            ]),
        expectedCurrentOutcome,
        targetOutcome
    });
}

function lastDeclaredFunction(source) {
    return [...source]
        .reverse()
        .map(line =>
            String(line).match(
                /^([A-Za-z_][A-Za-z0-9_]*)\s*\(/
            )
        )
        .find(Boolean)?.[1] ?? null;
}
