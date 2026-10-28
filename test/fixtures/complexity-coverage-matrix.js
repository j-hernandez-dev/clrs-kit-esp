import {
    ComplexityCoverageOutcome
} from "../../src/complex/coverage/index.js";
import {
    unknownComplexityCorpus
} from "./unknown-complexity-corpus.js";

const Outcome = ComplexityCoverageOutcome;

const determinedCases = [
    coverageCase({
        id: "constant-cost",
        name: "costo constante",
        source: [
            "CONSTANTE()",
            "    escribir 1"
        ],
        expectedCurrentOutcome:
            Outcome.EXACT,
        expectedNotation: "O(1)",
        targetBlock: "baseline"
    }),
    coverageCase({
        id: "linear-loop",
        name: "ciclo lineal",
        source: [
            "LINEAL(n)",
            "    para i = 0 hasta n - 1",
            "        escribir i"
        ],
        expectedCurrentOutcome:
            Outcome.EXACT,
        expectedNotation: "O(n)",
        targetBlock: "baseline"
    }),
    coverageCase({
        id: "nested-logarithmic-loop",
        name: "ciclo anidado n log n",
        source: [
            "N_LOG_N(A)",
            "    n = LONG(A)",
            "    para i = 0 hasta n - 1",
            "        j = n",
            "        mientras j > 1",
            "            escribir A[i]",
            "            j = PISO(j / 2)"
        ],
        expectedCurrentOutcome:
            Outcome.CONDITIONAL,
        expectedNotation: "O(n log n)",
        targetBlock: "baseline"
    }),
    coverageCase({
        id: "user-function-symbolic-update",
        name:
            "actualización mediante función de usuario",
        source: [
            "MITAD(x)",
            "    retornar PISO(x / 2)",
            "REDUCE(n)",
            "    i = n",
            "    mientras i > 1",
            "        i = MITAD(i)"
        ],
        expectedCurrentOutcome:
            Outcome.CONDITIONAL,
        expectedNotation: "O(log n)",
        resolvedCodes: [
            "CLRS_ITERATION_UPDATE_NOT_FOUND"
        ],
        targetBlock:
            "user-function-semantic-summaries"
    }),
    coverageCase({
        id: "master-recurrence",
        name: "recurrencia divide y vencerás",
        source: [
            "DIVIDE(n)",
            "    si n > 1",
            "        retornar DIVIDE(PISO(n / 2)) + DIVIDE(PISO(n / 2))",
            "    retornar 0"
        ],
        expectedCurrentOutcome:
            Outcome.UPPER_BOUND,
        expectedNotation: "O(n)",
        targetBlock: "baseline"
    }),
    coverageCase({
        id: "mixed-scc-upper-bound",
        name: "sistema recursivo con cota superior",
        source: [
            "PRIMERA(n)",
            "    si n > 1",
            "        retornar SEGUNDA(n - 1) + SEGUNDA(PISO(n / 2))",
            "    retornar 0",
            "SEGUNDA(q)",
            "    si q > 1",
            "        retornar PRIMERA(q - 1)",
            "    retornar 0"
        ],
        expectedCurrentOutcome:
            Outcome.UPPER_BOUND,
        expectedNotation: "O(1.414214^n)",
        targetBlock: "recurrence-systems"
    }),
    coverageCase({
        id: "proven-non-termination",
        name: "ciclo infinito demostrado",
        source: [
            "INFINITO()",
            "    mientras VERDAD",
            "        escribir 1"
        ],
        expectedCurrentOutcome:
            Outcome.NON_TERMINATING,
        expectedCurrentCodes: [
            "CLRS_ASYMPTOTIC_UNKNOWN_COST",
            "CLRS_ITERATION_NON_TERMINATING"
        ],
        targetBlock: "termination-analysis"
    }),
    coverageCase({
        id: "recurrence-without-base",
        name:
            "recurrencia sin caso base alcanzable",
        source: [
            "SIN_BASE(n)",
            "    retornar SIN_BASE(n - 1)"
        ],
        expectedCurrentOutcome:
            Outcome.UNKNOWN,
        expectedCurrentCodes: [
            "CLRS_ASYMPTOTIC_RECURRENCE_UNRESOLVED",
            "CLRS_RECURRENCE_BASE_CASE_UNPROVEN"
        ],
        targetBlock:
            "soundness-firewall"
    }),
    coverageCase({
        id: "recurrence-unrelated-guard",
        name:
            "guarda recursiva ajena a la medida",
        source: [
            "GUARDA_AJENA(n, activo)",
            "    si activo > 0",
            "        retornar GUARDA_AJENA(n - 1, activo)",
            "    retornar 0"
        ],
        expectedCurrentOutcome:
            Outcome.UNKNOWN,
        expectedCurrentCodes: [
            "CLRS_ASYMPTOTIC_RECURRENCE_UNRESOLVED",
            "CLRS_RECURRENCE_GUARD_UNRELATED"
        ],
        targetBlock:
            "soundness-firewall"
    }),
    coverageCase({
        id: "recurrence-without-measure",
        name:
            "recurrencia sin medida bien fundada",
        source: [
            "SIN_MEDIDA(n, m)",
            "    si n > 1",
            "        retornar SIN_MEDIDA(m, n)",
            "    retornar 0"
        ],
        expectedCurrentOutcome:
            Outcome.UNKNOWN,
        expectedCurrentCodes: [
            "CLRS_ASYMPTOTIC_RECURRENCE_UNRESOLVED",
            "CLRS_RECURRENCE_MEASURE_UNPROVEN"
        ],
        targetBlock:
            "soundness-firewall"
    }),
    coverageCase({
        id: "local-symbol-without-postcondition",
        name:
            "símbolo local sin postcondición demostrada",
        source: [
            "DOS_FASES(n)",
            "    i = 1",
            "    mientras i < n",
            "        i = i * 2",
            "    mientras i > 1",
            "        i = i - 1"
        ],
        expectedCurrentOutcome:
            Outcome.CONDITIONAL,
        expectedNotation: "O(n)",
        resolvedCodes: [
            "CLRS_ASYMPTOTIC_INTERNAL_SYMBOL_UNRESOLVED"
        ],
        targetBlock:
            "loop-trajectories"
    })
];

export const complexityCoverageMatrix =
    Object.freeze([
        ...determinedCases,
        ...unknownComplexityCorpus
    ]);

function coverageCase({
    source,
    functionName = null,
    targetOutcome = null,
    expectedCurrentCodes = [],
    resolvedCodes = [],
    ...metadata
}) {
    return Object.freeze({
        ...metadata,
        source: Object.freeze([...source]),
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
        targetOutcome:
            targetOutcome ??
            metadata.expectedCurrentOutcome
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
