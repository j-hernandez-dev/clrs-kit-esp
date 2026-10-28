export const CLRSCorrectionSafety =
    Object.freeze({
        SAFE: "safe",
        REQUIRES_REVIEW:
            "requires-review",
        EXPLANATION_ONLY:
            "explanation-only"
    });

export const CLRSCorrectionEditKind =
    Object.freeze({
        REPLACE_TOKEN: "replace-token",
        INSERT_STATEMENT:
            "insert-statement",
        INSERT_DECLARATION:
            "insert-declaration",
        UPDATE_ARGUMENTS:
            "update-arguments",
        DELETE_BRANCH: "delete-branch",
        UPDATE_EXPRESSION:
            "update-expression",
        WRAP_ASSIGNMENT:
            "wrap-assignment"
    });

export const CLRSCorrectionStrategy =
    Object.freeze({
        REPLACE_ASSIGNMENT_WITH_EQUALITY:
            "replace-assignment-with-equality",
        INITIALIZE_VARIABLE:
            "initialize-variable",
        CREATE_FUNCTION:
            "create-function",
        ADD_MISSING_ARGUMENTS:
            "add-missing-arguments",
        REMOVE_EXTRA_ARGUMENTS:
            "remove-extra-arguments",
        DELETE_UNREACHABLE_BRANCH:
            "delete-unreachable-branch",
        CHANGE_LOOP_BOUND:
            "change-loop-bound",
        CAPTURE_FUNCTION_RESULT:
            "capture-function-result"
    });

/**
 * Códigos reservados para diagnósticos estructurales que se incorporarán
 * progresivamente. Centralizarlos evita que los proveedores futuros inventen
 * cadenas incompatibles para una misma situación.
 */
export const CLRSCorrectionDiagnosticCode =
    Object.freeze({
        PARSER_ERROR:
            "CLRS_PARSER_ERROR",
        UNDEFINED_IDENTIFIER:
            "CLRS_UNDEFINED_IDENTIFIER",
        FUNCTION_ARITY_MISMATCH:
            "CLRS_FUNCTION_ARITY_MISMATCH",
        UNREACHABLE_BRANCH:
            "CLRS_UNREACHABLE_BRANCH",
        LOOP_DIRECTION_MISMATCH:
            "CLRS_ITERATION_DIRECTION_MISMATCH",
        IGNORED_RETURN_VALUE:
            "CLRS_IGNORED_RETURN_VALUE"
    });

const D = CLRSCorrectionDiagnosticCode;
const E = CLRSCorrectionEditKind;
const S = CLRSCorrectionSafety;
const T = CLRSCorrectionStrategy;

const DEFINITIONS = deepFreeze([
    correction({
        id:
            "replace-assignment-with-equality",
        title:
            "Cambiar «=» por «==» en esta condición",
        description:
            "Reemplaza únicamente el operador de asignación comprobado dentro de una condición.",
        diagnosticCodes: [D.PARSER_ERROR],
        phases: ["parser"],
        strategy:
            T.REPLACE_ASSIGNMENT_WITH_EQUALITY,
        editKind: E.REPLACE_TOKEN,
        safety: S.SAFE,
        preferred: true,
        requirements: {
            syntaxKind:
                ["assignment-in-condition"]
        }
    }),
    correction({
        id:
            "initialize-undefined-variable",
        title:
            "Inicializar la variable no definida",
        description:
            "Prepara una asignación inicial antes de la primera lectura de la variable.",
        diagnosticCodes:
            [D.UNDEFINED_IDENTIFIER],
        phases: ["semantic"],
        strategy: T.INITIALIZE_VARIABLE,
        editKind: E.INSERT_STATEMENT,
        safety: S.REQUIRES_REVIEW,
        requirements: {
            referenceKind: ["variable-read"]
        }
    }),
    correction({
        id: "create-undefined-function",
        title:
            "Crear la función no definida",
        description:
            "Prepara una declaración a partir del identificador y de los argumentos de la llamada.",
        diagnosticCodes:
            [D.UNDEFINED_IDENTIFIER],
        phases: ["semantic"],
        strategy: T.CREATE_FUNCTION,
        editKind: E.INSERT_DECLARATION,
        safety: S.REQUIRES_REVIEW,
        requirements: {
            referenceKind: ["function-call"]
        }
    }),
    correction({
        id: "add-missing-arguments",
        title:
            "Agregar los argumentos faltantes",
        description:
            "Completa una llamada sin inventar valores definitivos; el usuario debe revisar los marcadores insertados.",
        diagnosticCodes:
            [D.FUNCTION_ARITY_MISMATCH],
        phases: ["semantic"],
        strategy: T.ADD_MISSING_ARGUMENTS,
        editKind: E.UPDATE_ARGUMENTS,
        safety: S.REQUIRES_REVIEW,
        requirements: {
            arityRelation: ["missing"]
        }
    }),
    correction({
        id: "remove-extra-arguments",
        title:
            "Corregir el número de argumentos",
        description:
            "Retira de la llamada los argumentos que exceden la firma declarada.",
        diagnosticCodes:
            [D.FUNCTION_ARITY_MISMATCH],
        phases: ["semantic"],
        strategy: T.REMOVE_EXTRA_ARGUMENTS,
        editKind: E.UPDATE_ARGUMENTS,
        safety: S.REQUIRES_REVIEW,
        requirements: {
            arityRelation: ["extra"]
        }
    }),
    correction({
        id: "delete-unreachable-branch",
        title:
            "Eliminar la rama inaccesible",
        description:
            "Elimina una rama que el análisis ha demostrado que nunca puede ejecutarse.",
        diagnosticCodes:
            [D.UNREACHABLE_BRANCH],
        phases: ["semantic"],
        strategy:
            T.DELETE_UNREACHABLE_BRANCH,
        editKind: E.DELETE_BRANCH,
        safety: S.REQUIRES_REVIEW,
        requirements: {
            reachability:
                ["proven-unreachable"]
        }
    }),
    correction({
        id: "change-loop-bound",
        title:
            "Corregir el límite del ciclo",
        description:
            "Ajusta el límite solamente cuando la dirección de avance contradice de forma demostrable la condición.",
        diagnosticCodes:
            [D.LOOP_DIRECTION_MISMATCH],
        phases: ["iteration"],
        strategy: T.CHANGE_LOOP_BOUND,
        editKind: E.UPDATE_EXPRESSION,
        safety: S.REQUIRES_REVIEW,
        requirements: {
            loopMismatch:
                ["direction-versus-bound"]
        }
    }),
    correction({
        id: "capture-function-result",
        title:
            "Convertir la llamada en una asignación",
        description:
            "Conserva el resultado de una función mediante una variable que el usuario puede nombrar y revisar.",
        diagnosticCodes:
            [D.IGNORED_RETURN_VALUE],
        phases: ["semantic"],
        strategy: T.CAPTURE_FUNCTION_RESULT,
        editKind: E.WRAP_ASSIGNMENT,
        safety: S.REQUIRES_REVIEW,
        requirements: {
            callUsage:
                ["discarded-result"]
        }
    })
]);

const BY_ID = new Map(
    DEFINITIONS.map(
        definition => [
            definition.id,
            definition
        ]
    )
);

const BY_DIAGNOSTIC_CODE = indexByDiagnosticCode(
    DEFINITIONS
);

validateCatalog(DEFINITIONS);

export function getCLRSCorrectionDefinition(id) {
    return BY_ID.get(id) ?? null;
}

export function listCLRSCorrectionDefinitions() {
    return DEFINITIONS;
}

/**
 * Devuelve todas las recetas potencialmente asociadas al código. Esta función
 * no afirma que sean aplicables: permite inspeccionar el catálogo sin fingir
 * que ya existe la evidencia estructural necesaria.
 */
export function listCLRSCorrectionsForDiagnosticCode(
    code
) {
    return (
        BY_DIAGNOSTIC_CODE.get(
            diagnosticCodeValue(code)
        ) ??
        EMPTY_DEFINITIONS
    );
}

/**
 * Resuelve solamente correcciones respaldadas por el diagnóstico y por todos
 * los hechos estructurales declarados en `evidence`.
 */
export function resolveCLRSCorrectionDefinitions(
    diagnostic,
    evidence = {}
) {
    const code = diagnosticCodeValue(
        diagnostic?.code
    );
    const phase = diagnostic?.phase ?? null;
    const candidates =
        BY_DIAGNOSTIC_CODE.get(code) ??
        EMPTY_DEFINITIONS;

    return Object.freeze(
        candidates.filter(definition =>
            phaseMatches(definition, phase) &&
            requirementsMatch(
                definition.requirements,
                evidence
            )
        )
    );
}

export function isCLRSCorrectionSafe(
    definitionOrId
) {
    const definition =
        typeof definitionOrId === "string"
            ? getCLRSCorrectionDefinition(
                definitionOrId
            )
            : definitionOrId;

    return definition?.safety === S.SAFE;
}

const EMPTY_DEFINITIONS = Object.freeze([]);

function correction(source) {
    return {
        ...source,
        preferred:
            source.preferred === true,
        requirements:
            source.requirements ?? {}
    };
}

function indexByDiagnosticCode(definitions) {
    const mutable = new Map();

    for (const definition of definitions) {
        for (
            const code
            of definition.diagnosticCodes
        ) {
            const definitionsForCode =
                mutable.get(code) ?? [];

            definitionsForCode.push(
                definition
            );
            mutable.set(
                code,
                definitionsForCode
            );
        }
    }

    return new Map(
        [...mutable.entries()].map(
            ([code, entries]) => [
                code,
                Object.freeze(entries)
            ]
        )
    );
}

function phaseMatches(definition, phase) {
    return (
        definition.phases.length === 0 ||
        definition.phases.includes(phase)
    );
}

function requirementsMatch(
    requirements,
    evidence
) {
    if (
        evidence == null ||
        typeof evidence !== "object"
    ) {
        return false;
    }

    return Object.entries(requirements)
        .every(([field, accepted]) =>
            accepted.includes(
                evidence[field]
            )
        );
}

function diagnosticCodeValue(code) {
    if (
        typeof code === "object" &&
        code != null
    ) {
        return String(code.value ?? "");
    }

    return typeof code === "string"
        ? code
        : "";
}

function validateCatalog(definitions) {
    const ids = new Set();

    for (const definition of definitions) {
        if (
            typeof definition.id !== "string" ||
            definition.id.length === 0 ||
            ids.has(definition.id)
        ) {
            throw new TypeError(
                "El catálogo de correcciones contiene un identificador inválido o repetido."
            );
        }

        ids.add(definition.id);

        if (
            !Object.values(S).includes(
                definition.safety
            ) ||
            !Object.values(E).includes(
                definition.editKind
            ) ||
            !Object.values(T).includes(
                definition.strategy
            ) ||
            definition.diagnosticCodes.length === 0
        ) {
            throw new TypeError(
                `La corrección «${definition.id}» no cumple el contrato del catálogo.`
            );
        }
    }
}

function deepFreeze(value) {
    if (
        value == null ||
        typeof value !== "object" ||
        Object.isFrozen(value)
    ) {
        return value;
    }

    for (const child of Object.values(value)) {
        deepFreeze(child);
    }

    return Object.freeze(value);
}
