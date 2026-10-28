import {
    CLRS_TEST_COMPARISON_LABELS
} from "./CLRSTestComparisonSupport.js";
import {
    CLRSTestComparison,
    CLRSTestDivergenceKind,
    CLRSTestDivergenceReason
} from "./CLRSTestTypes.js";
import {
    createCLRSTestDivergence
} from "./CLRSTestDivergence.js";
import {
    requireEnum,
    requireInlineText,
    requireRecord
} from "./CLRSTestValidation.js";

export const CLRS_TEST_EXPLANATION_LIMITS =
    Object.freeze({
        maximumFieldCharacters: 4_000,
        maximumDisplayedValueCharacters: 512
    });

export class CLRSTestPedagogicalExplanation {

    constructor(source = {}) {
        const input = requireRecord(
            source,
            "CLRS_TEST_EXPLANATION_INVALID",
            "pedagogicalExplanation"
        );

        this.title = explanationText(
            input.title,
            "pedagogicalExplanation.title"
        );
        this.summary = explanationText(
            input.summary,
            "pedagogicalExplanation.summary"
        );
        this.technicalDetail = explanationText(
            input.technicalDetail,
            "pedagogicalExplanation.technicalDetail"
        );
        this.guidance = explanationText(
            input.guidance,
            "pedagogicalExplanation.guidance"
        );

        Object.freeze(this);
    }
}

export function createCLRSTestPedagogicalExplanation(
    source
) {
    return source instanceof
        CLRSTestPedagogicalExplanation
        ? source
        : new CLRSTestPedagogicalExplanation(source);
}

/**
 * Traduce evidencia determinista a lenguaje pedagógico. No intenta inferir la
 * causa en el código: explica únicamente aquello demostrado por la salida.
 */
export function explainCLRSTestDivergence({
    comparison,
    divergence
}) {
    const comparisonValue = requireEnum(
        comparison,
        CLRSTestComparison,
        "CLRS_TEST_EXPLANATION_COMPARISON_INVALID",
        "comparison"
    );
    const divergenceValue =
        createCLRSTestDivergence(divergence);
    const content = explanationContent(
        comparisonValue,
        divergenceValue
    );

    return createCLRSTestPedagogicalExplanation({
        ...content,
        technicalDetail: technicalDetail(
            comparisonValue,
            divergenceValue
        )
    });
}

function explanationContent(comparison, divergence) {
    switch (divergence.kind) {
        case CLRSTestDivergenceKind.TEXT:
            return textExplanation(
                comparison,
                divergence
            );
        case CLRSTestDivergenceKind.LINES:
            return linesExplanation(
                comparison,
                divergence
            );
        case CLRSTestDivergenceKind.NUMBER:
            return numberExplanation(divergence);
        case CLRSTestDivergenceKind.JSON:
        case CLRSTestDivergenceKind.ARRAY:
            return structureExplanation(
                comparison,
                divergence
            );
        case CLRSTestDivergenceKind.BOOLEAN:
            return booleanExplanation(divergence);
        case CLRSTestDivergenceKind.CONTAINS:
            return containsExplanation(divergence);
        case CLRSTestDivergenceKind.REGEX:
            return regexExplanation(divergence);
        default:
            return genericExplanation(divergence);
    }
}

function textExplanation(comparison, divergence) {
    const position = positionLabel(divergence);
    const prefix = comparison ===
        CLRSTestComparison.NORMALIZED_WHITESPACE
        ? "Después de normalizar los espacios, la salida"
        : comparison === CLRSTestComparison.TRIMMED
            ? "Después de ignorar los espacios exteriores, la salida"
            : "La salida";

    if (
        divergence.reason ===
            CLRSTestDivergenceReason.MISSING_VALUE
    ) {
        return {
            title: "La salida terminó antes de tiempo",
            summary:
                `${prefix} termina en ${position}. ` +
                `Todavía se esperaba ${displayExpected(divergence)}.`,
            guidance:
                "Revisa la instrucción escribir que debe producir la parte final de la salida."
        };
    }

    if (
        divergence.reason ===
            CLRSTestDivergenceReason.UNEXPECTED_VALUE
    ) {
        return {
            title: "La salida contiene texto adicional",
            summary:
                `${prefix} debía terminar en ${position}, ` +
                `pero continuó con ${displayActual(divergence)}.`,
            guidance:
                "Comprueba si alguna instrucción escribir se ejecuta de más o incluye texto adicional."
        };
    }

    return {
        title: "La salida cambia en su primer carácter diferente",
        summary:
            `${prefix} coincide hasta ${position}. ` +
            `Allí se esperaba ${displayExpected(divergence)} ` +
            `y se obtuvo ${displayActual(divergence)}.`,
        guidance:
            "Revisa la expresión que produce esa parte de la salida y los valores que recibe."
    };
}

function linesExplanation(comparison, divergence) {
    const unordered = comparison ===
        CLRSTestComparison.UNORDERED_LINES;

    if (
        divergence.reason ===
            CLRSTestDivergenceReason.MISSING_VALUE
    ) {
        return {
            title: "Falta una línea esperada",
            summary: unordered
                ? `Falta una aparición de la línea ${displayExpected(divergence)}. El orden no importa, pero sí la cantidad de apariciones.`
                : `La salida terminó antes de producir la línea ${divergence.line}: ${displayExpected(divergence)}.`,
            guidance:
                "Comprueba las rutas que ejecutan escribir y si alguna condición evita producir esa línea."
        };
    }

    if (
        divergence.reason ===
            CLRSTestDivergenceReason.UNEXPECTED_VALUE
    ) {
        return {
            title: "Hay una línea adicional",
            summary: unordered
                ? `La línea ${displayActual(divergence)} aparece más veces de las esperadas.`
                : `La línea ${divergence.line} no debía aparecer: ${displayActual(divergence)}.`,
            guidance:
                "Revisa si una instrucción escribir se ejecuta una vez de más."
        };
    }

    return {
        title: "La primera línea diferente no coincide",
        summary:
            `En la línea ${divergence.line}, columna ${divergence.column}, ` +
            `se esperaba ${displayExpected(divergence)} ` +
            `y se obtuvo ${displayActual(divergence)}.`,
        guidance:
            "Compara la instrucción que genera esa línea con el formato y el valor solicitados."
    };
}

function numberExplanation(divergence) {
    if (
        divergence.reason ===
            CLRSTestDivergenceReason.INVALID_ACTUAL
    ) {
        return {
            title: "La salida no es un número válido",
            summary:
                `La prueba esperaba un número finito, pero obtuvo ${displayActual(divergence)}.`,
            guidance:
                "Asegúrate de escribir solamente el valor numérico, sin etiquetas ni texto adicional."
        };
    }

    if (
        divergence.reason ===
            CLRSTestDivergenceReason.OUTSIDE_TOLERANCE
    ) {
        return {
            title: "El resultado supera la tolerancia permitida",
            summary:
                `Se esperaba ${displayExpected(divergence)} con una tolerancia de ${formatNumber(divergence.tolerance)}, ` +
                `pero se obtuvo ${displayActual(divergence)}. ` +
                toleranceDifference(divergence),
            guidance:
                "Revisa el cálculo, las conversiones numéricas y el momento en que redondeas el resultado."
        };
    }

    const direction = numericDirection(divergence);

    return {
        title: "El resultado numérico es diferente",
        summary:
            `Se esperaba ${displayExpected(divergence)} y se obtuvo ${displayActual(divergence)}. ` +
            numericDifference(divergence, direction),
        guidance:
            "Revisa las operaciones y los valores utilizados para calcular el resultado."
    };
}

function structureExplanation(comparison, divergence) {
    const subject = divergence.kind ===
        CLRSTestDivergenceKind.ARRAY
        ? "arreglo"
        : "JSON";

    if (
        divergence.reason ===
            CLRSTestDivergenceReason.INVALID_ACTUAL
    ) {
        return {
            title: `La salida no es ${subject} válido`,
            summary:
                `La prueba no pudo interpretar ${displayActual(divergence)} como ${subject} estructurado.`,
            guidance:
                `Comprueba delimitadores, comillas y separadores antes de escribir el ${subject}.`
        };
    }

    if (
        comparison ===
            CLRSTestComparison.ARRAY_UNORDERED &&
        divergence.reason ===
            CLRSTestDivergenceReason.VALUE_MISMATCH
    ) {
        return {
            title: "El arreglo contiene elementos diferentes",
            summary:
                `Después de emparejar los elementos iguales, falta ${displayExpected(divergence)} ` +
                `y sobra ${displayActual(divergence)}.`,
            guidance:
                "Revisa cómo agregas, eliminas o transformas los elementos del arreglo."
        };
    }

    const path = pedagogicalPath(divergence.path);

    if (
        divergence.reason ===
            CLRSTestDivergenceReason.TYPE_MISMATCH
    ) {
        return {
            title: "El tipo de un valor estructurado es diferente",
            summary:
                `En ${path} se esperaba ${valueType(divergence.expected)}, ` +
                `pero se obtuvo ${valueType(divergence.actual)}.`,
            guidance:
                "Revisa cómo construyes ese valor y si debe ser escalar, arreglo u objeto."
        };
    }

    if (
        divergence.reason ===
            CLRSTestDivergenceReason.MISSING_VALUE
    ) {
        return {
            title: "Falta un valor en la estructura",
            summary:
                `En ${path} se esperaba ${displayExpected(divergence)}, pero esa posición o propiedad no existe.`,
            guidance:
                "Comprueba los límites del arreglo y las propiedades que agregas al resultado."
        };
    }

    if (
        divergence.reason ===
            CLRSTestDivergenceReason.UNEXPECTED_VALUE
    ) {
        return {
            title: "Hay un valor adicional en la estructura",
            summary:
                `En ${path} aparece ${displayActual(divergence)}, pero esa posición o propiedad no se esperaba.`,
            guidance:
                "Revisa si agregas un elemento o una propiedad de más al resultado."
        };
    }

    return {
        title: "Un valor de la estructura es diferente",
        summary:
            `En ${path} se esperaba ${displayExpected(divergence)} ` +
            `y se obtuvo ${displayActual(divergence)}.`,
        guidance:
            "Sigue la construcción de esa posición o propiedad hasta encontrar dónde cambia su valor."
    };
}

function booleanExplanation(divergence) {
    if (
        divergence.reason ===
            CLRSTestDivergenceReason.INVALID_ACTUAL
    ) {
        return {
            title: "La salida no es un booleano válido",
            summary:
                `Se esperaba VERDAD o FALSO, pero se obtuvo ${displayActual(divergence)}.`,
            guidance:
                "Escribe directamente el resultado de la condición o un valor booleano."
        };
    }

    return {
        title: "El resultado booleano está invertido",
        summary:
            `Se esperaba ${displayExpected(divergence)} y se obtuvo ${displayActual(divergence)}.`,
        guidance:
            "Revisa los operadores de comparación, no, y, o, y las ramas que producen el resultado."
    };
}

function containsExplanation(divergence) {
    return {
        title: "Falta el fragmento requerido",
        summary:
            `La salida debía contener ${displayExpected(divergence)}, pero el fragmento no aparece.`,
        guidance:
            "Comprueba que la salida incluya el texto solicitado con la misma escritura."
    };
}

function regexExplanation(divergence) {
    return {
        title: "La salida no cumple el patrón esperado",
        summary:
            `La salida ${displayActual(divergence)} no coincide con el patrón ${displayExpected(divergence)}.`,
        guidance:
            "Revisa el orden, los separadores y las partes variables del formato de salida."
    };
}

function genericExplanation(divergence) {
    return {
        title: "La salida contiene una diferencia",
        summary:
            `Se esperaba ${displayExpected(divergence)} y se obtuvo ${displayActual(divergence)}.`,
        guidance:
            "Revisa la parte del programa que produce este resultado."
    };
}

function technicalDetail(comparison, divergence) {
    const parts = [
        `Comparador: ${CLRS_TEST_COMPARISON_LABELS[comparison]} (${comparison}).`,
        `Motivo: ${divergence.reason}.`
    ];

    if (divergence.path.length > 0) {
        parts.push(
            `Ruta: ${technicalPath(divergence.path)}.`
        );
    }

    if (
        divergence.line != null &&
        divergence.column != null
    ) {
        parts.push(
            `Posición: línea ${divergence.line}, columna ${divergence.column}.`
        );
    }

    parts.push(
        `Esperado: ${displayExpected(divergence)}.`,
        `Obtenido: ${displayActual(divergence)}.`
    );

    if (divergence.difference != null) {
        parts.push(
            `Diferencia absoluta: ${formatNumber(divergence.difference)}.`
        );
    }

    if (divergence.tolerance != null) {
        parts.push(
            `Tolerancia: ${formatNumber(divergence.tolerance)}.`
        );
    }

    return parts.join(" ");
}

function displayExpected(divergence) {
    return divergence.expectedPresent
        ? displayValue(divergence.expected)
        : "<ausente>";
}

function displayActual(divergence) {
    return divergence.actualPresent
        ? displayValue(divergence.actual)
        : "<ausente>";
}

function displayValue(value) {
    let serialized;

    if (typeof value === "string") {
        serialized = JSON.stringify(value);
    } else {
        try {
            serialized = JSON.stringify(value);
        } catch {
            serialized = String(value);
        }
    }

    if (serialized == null) {
        serialized = String(value);
    }

    const maximum = CLRS_TEST_EXPLANATION_LIMITS
        .maximumDisplayedValueCharacters;

    return serialized.length <= maximum
        ? serialized
        : `${serialized.slice(0, maximum - 1)}…`;
}

function positionLabel(divergence) {
    return divergence.line == null ||
        divergence.column == null
        ? `el índice ${divergence.index ?? 0}`
        : `la línea ${divergence.line}, columna ${divergence.column}`;
}

function pedagogicalPath(path) {
    return path.length === 0
        ? "la raíz de la salida"
        : `la ruta ${technicalPath(path)}`;
}

function technicalPath(path) {
    return path.reduce((result, segment) => {
        if (typeof segment === "number") {
            return `${result}[${segment}]`;
        }

        return /^[\p{L}_][\p{L}\p{N}_]*$/u.test(segment)
            ? `${result}.${segment}`
            : `${result}[${JSON.stringify(segment)}]`;
    }, "$");
}

function valueType(value) {
    if (value === null) {
        return "un valor nulo";
    }

    if (Array.isArray(value)) {
        return "un arreglo";
    }

    switch (typeof value) {
        case "string":
            return "una cadena";
        case "number":
            return "un número";
        case "boolean":
            return "un booleano";
        case "object":
            return "un objeto";
        default:
            return "otro tipo de valor";
    }
}

function numericDirection(divergence) {
    if (
        typeof divergence.actual !== "number" ||
        typeof divergence.expected !== "number"
    ) {
        return "distinto del valor esperado";
    }

    return divergence.actual > divergence.expected
        ? "por encima del valor esperado"
        : "por debajo del valor esperado";
}

function numericDifference(divergence, direction) {
    if (divergence.difference == null) {
        return `El valor obtenido está ${direction}.`;
    }

    const unit = divergence.difference === 1
        ? "unidad"
        : "unidades";

    return `El valor obtenido está ${formatNumber(divergence.difference)} ${unit} ${direction}.`;
}

function toleranceDifference(divergence) {
    return divergence.difference == null
        ? "La diferencia excede el rango numérico representable."
        : `La diferencia es ${formatNumber(divergence.difference)}.`;
}

function formatNumber(value) {
    return typeof value === "number" &&
        Number.isFinite(value)
        ? String(value)
        : "no disponible";
}

function explanationText(value, field) {
    return requireInlineText(
        value,
        CLRS_TEST_EXPLANATION_LIMITS
            .maximumFieldCharacters,
        "CLRS_TEST_EXPLANATION_TEXT_INVALID",
        field
    );
}
