import {
    findWordAtPosition
} from "../intelligence/TolerantSourceAnalyzer.js";
import {
    CLRSCorrectionSafety,
    CLRSCorrectionStrategy,
    resolveCLRSCorrectionDefinitions
} from "./CLRSCorrectionCatalog.js";

/**
 * Convierte diagnósticos ambiguos en orientación determinista. Sus planes no
 * contienen ediciones: explican las decisiones que el usuario debe tomar.
 */
export class CLRSCorrectionExplanationPlanner {

    planExplanatoryCorrections(
        request = {}
    ) {
        const sourceCode =
            requireSourceCode(
                request.sourceCode
            );
        const diagnostics =
            normalizeDiagnostics(request);
        const plans = [];

        for (const diagnostic of diagnostics) {
            const evidence = collectEvidence({
                sourceCode,
                diagnostic,
                supplied:
                    request.evidence
            });
            const definitions =
                resolveCLRSCorrectionDefinitions(
                    diagnostic,
                    evidence
                ).filter(
                    definition =>
                        definition.safety !==
                            CLRSCorrectionSafety
                                .SAFE
                );

            for (const definition of definitions) {
                plans.push(
                    createExplanationPlan({
                        definition,
                        diagnostic,
                        evidence
                    })
                );
            }
        }

        return Object.freeze(
            deduplicatePlans(plans)
        );
    }
}

function collectEvidence({
    sourceCode,
    diagnostic,
    supplied
}) {
    const declared = {
        ...recordOrEmpty(
            diagnostic.data
        ),
        ...recordOrEmpty(
            diagnostic.evidence
        ),
        ...recordOrEmpty(supplied)
    };
    const inferred =
        inferUndefinedIdentifierEvidence(
            sourceCode,
            diagnostic
        );

    return Object.freeze({
        ...declared,
        ...inferred
    });
}

function inferUndefinedIdentifierEvidence(
    sourceCode,
    diagnostic
) {
    if (
        diagnosticCodeValue(
            diagnostic.code
        ) !==
            "CLRS_UNDEFINED_IDENTIFIER"
    ) {
        return {};
    }

    const position = {
        line:
            diagnostic.location
                ?.startLine,
        column:
            diagnostic.location
                ?.startColumn
    };
    const word = findWordAtPosition(
        sourceCode,
        position
    );

    if (word == null) {
        return {};
    }

    return {
        identifier: word.value,
        referenceKind:
            nextSignificantCharacter(
                sourceCode,
                word.location
            ) === "("
                ? "function-call"
                : "variable-read"
    };
}

function createExplanationPlan({
    definition,
    diagnostic,
    evidence
}) {
    const content = explanationContent(
        definition.strategy,
        evidence
    );
    const location = freezeLocation(
        diagnostic.location
    );

    return Object.freeze({
        id:
            `explain:${definition.id}:` +
            `${location?.startLine ?? 0}:` +
            `${location?.startColumn ?? 0}`,
        correctionId: definition.id,
        title: content.actionTitle,
        preferred: false,
        safety:
            CLRSCorrectionSafety
                .EXPLANATION_ONLY,
        diagnosticCode:
            diagnosticCodeValue(
                diagnostic.code
            ),
        diagnosticLocation: location,
        edits: EMPTY_EDITS,
        explanation:
            Object.freeze({
                title: content.title,
                summary: content.summary,
                guidance:
                    Object.freeze(
                        content.guidance
                    ),
                technicalDetail:
                    `Estrategia: ${definition.strategy}. ` +
                    `Diagnóstico: ${diagnosticCodeValue(diagnostic.code)}.`
            })
    });
}

function explanationContent(
    strategy,
    evidence
) {
    switch (strategy) {
        case CLRSCorrectionStrategy
            .INITIALIZE_VARIABLE:
            return initializeVariable(
                evidence
            );
        case CLRSCorrectionStrategy
            .CREATE_FUNCTION:
            return createFunction(evidence);
        case CLRSCorrectionStrategy
            .ADD_MISSING_ARGUMENTS:
            return addMissingArguments(
                evidence
            );
        case CLRSCorrectionStrategy
            .REMOVE_EXTRA_ARGUMENTS:
            return removeExtraArguments(
                evidence
            );
        case CLRSCorrectionStrategy
            .DELETE_UNREACHABLE_BRANCH:
            return deleteUnreachableBranch();
        case CLRSCorrectionStrategy
            .CHANGE_LOOP_BOUND:
            return changeLoopBound(evidence);
        case CLRSCorrectionStrategy
            .CAPTURE_FUNCTION_RESULT:
            return captureFunctionResult(
                evidence
            );
        default:
            return genericExplanation();
    }
}

function initializeVariable(evidence) {
    const identifier = displayIdentifier(
        evidence.identifier,
        "la variable"
    );

    return {
        actionTitle:
            `Explicar cómo inicializar ${identifier}`,
        title:
            `${identifier} se utiliza antes de tener un valor`,
        summary:
            "CLRS no puede elegir un valor inicial sin conocer el propósito de la variable.",
        guidance: [
            `Comprueba primero si ${identifier} está escrito correctamente.`,
            `Si es una variable nueva, asígnale un valor antes de esta lectura.`,
            "Elige un valor inicial compatible con el problema; no siempre debe ser cero."
        ]
    };
}

function createFunction(evidence) {
    const identifier = displayIdentifier(
        evidence.identifier,
        "la función"
    );

    return {
        actionTitle:
            `Explicar cómo crear ${identifier}`,
        title:
            `No existe una declaración para ${identifier}`,
        summary:
            "La llamada aporta un nombre y argumentos, pero no determina por sí sola los parámetros ni el valor de retorno correctos.",
        guidance: [
            `Comprueba si el nombre ${identifier} contiene un error de escritura.`,
            "Si la función es nueva, declara un parámetro por cada dato que necesite recibir.",
            "Decide si debe retornar un resultado y utiliza la llamada de acuerdo con esa decisión."
        ]
    };
}

function addMissingArguments(evidence) {
    const counts = arityDescription(evidence);

    return {
        actionTitle:
            "Explicar los argumentos faltantes",
        title:
            "La llamada proporciona menos argumentos de los declarados",
        summary:
            `${counts} CLRS no puede inventar los valores que faltan.`,
        guidance: [
            "Consulta la firma de la función y el propósito de cada parámetro.",
            "Agrega los valores en el mismo orden en que se declararon los parámetros.",
            "Si un parámetro ya no es necesario, revisa la declaración y todas sus llamadas."
        ]
    };
}

function removeExtraArguments(evidence) {
    const counts = arityDescription(evidence);

    return {
        actionTitle:
            "Explicar el exceso de argumentos",
        title:
            "La llamada proporciona más argumentos de los declarados",
        summary:
            `${counts} Eliminar un argumento automáticamente podría descartar un dato importante.`,
        guidance: [
            "Compara la llamada con la firma de la función.",
            "Retira únicamente los argumentos que no correspondan a ningún parámetro.",
            "Si la función necesita esos datos, actualiza su firma y revisa todas las llamadas."
        ]
    };
}

function deleteUnreachableBranch() {
    return {
        actionTitle:
            "Explicar la rama inaccesible",
        title:
            "Esta rama no puede ejecutarse con la condición actual",
        summary:
            "Eliminar código es una decisión irreversible y podría ocultar una condición escrita incorrectamente.",
        guidance: [
            "Comprueba primero que la condición expresa el caso deseado.",
            "Revisa si una rama anterior ya cubre todos los valores posibles.",
            "Elimina la rama solamente si realmente dejó de formar parte del problema."
        ]
    };
}

function changeLoopBound(evidence) {
    const direction =
        typeof evidence.direction ===
            "string"
            ? ` La dirección detectada es ${evidence.direction}.`
            : "";

    return {
        actionTitle:
            "Explicar el límite del ciclo",
        title:
            "La condición y la dirección del ciclo no son compatibles",
        summary:
            "El análisis no puede decidir si debe cambiar el límite, el operador o el avance." +
            direction,
        guidance: [
            "Identifica el primer y el último valor que debe visitar el ciclo.",
            "Comprueba que el avance acerque la variable de control al límite.",
            "Revisa si el límite debe incluirse o excluirse antes de cambiar el operador."
        ]
    };
}

function captureFunctionResult(evidence) {
    const identifier = displayIdentifier(
        evidence.identifier,
        "la función"
    );

    return {
        actionTitle:
            "Explicar cómo conservar el resultado",
        title:
            `El resultado de ${identifier} no se utiliza`,
        summary:
            "CLRS no puede nombrar una variable automáticamente sin conocer qué representa el resultado.",
        guidance: [
            "Confirma que necesitas conservar el valor retornado.",
            "Elige un nombre de variable que describa el significado del resultado.",
            "Asigna la llamada a esa variable y úsala donde corresponda."
        ]
    };
}

function genericExplanation() {
    return {
        actionTitle:
            "Explicar la corrección disponible",
        title:
            "Esta corrección requiere una decisión",
        summary:
            "El análisis detectó el problema, pero no puede determinar automáticamente la intención del programa.",
        guidance: [
            "Revisa el diagnóstico y el requisito que intenta expresar el código."
        ]
    };
}

function arityDescription(evidence) {
    const expected = evidence.expectedArity;
    const actual = evidence.actualArity;

    if (
        Number.isInteger(expected) &&
        Number.isInteger(actual)
    ) {
        return (
            `La firma declara ${expected} ` +
            `${expected === 1 ? "parámetro" : "parámetros"} ` +
            `y la llamada contiene ${actual} ` +
            `${actual === 1 ? "argumento" : "argumentos"}.`
        );
    }

    return "La cantidad de argumentos no coincide con la firma."
}

function displayIdentifier(value, fallback) {
    return typeof value === "string" &&
        value.length > 0
        ? `«${value}»`
        : fallback;
}

function nextSignificantCharacter(
    sourceCode,
    location
) {
    const line = String(sourceCode)
        .split(/\r?\n/u)[
            location.endLine - 1
        ] ?? "";
    let index = location.endColumn;

    while (
        index < line.length &&
        /\s/u.test(line[index])
    ) {
        index += 1;
    }

    return line[index] ?? null;
}

function normalizeDiagnostics(request) {
    const source = Array.isArray(
        request.diagnostics
    )
        ? request.diagnostics
        : request.diagnostic == null
            ? []
            : [request.diagnostic];

    return source.filter(
        diagnostic =>
            diagnostic != null
    );
}

function deduplicatePlans(plans) {
    return [
        ...new Map(
            plans.map(plan => [
                plan.id,
                plan
            ])
        ).values()
    ];
}

function freezeLocation(location) {
    if (location == null) {
        return null;
    }

    return Object.freeze({
        startLine:
            location.startLine ?? null,
        startColumn:
            location.startColumn ?? null,
        endLine:
            location.endLine ?? null,
        endColumn:
            location.endColumn ?? null
    });
}

function diagnosticCodeValue(code) {
    if (
        code != null &&
        typeof code === "object"
    ) {
        return String(code.value ?? "");
    }

    return typeof code === "string"
        ? code
        : "";
}

function recordOrEmpty(value) {
    return value != null &&
        typeof value === "object" &&
        !Array.isArray(value)
        ? value
        : {};
}

function requireSourceCode(value) {
    if (typeof value !== "string") {
        throw new TypeError(
            "La planificación explicativa requiere código fuente."
        );
    }

    return value;
}

const EMPTY_EDITS = Object.freeze([]);
