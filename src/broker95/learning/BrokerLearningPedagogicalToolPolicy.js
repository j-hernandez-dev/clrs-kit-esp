import {
    BrokerGameError
} from "../core/BrokerGameError.js";
import {
    findBrokerLearningToolReferences
} from "./BrokerLearningToolRecommendation.js";

const OPTIONAL_TOOL_LANGUAGE = Object.freeze([
    /\bpuedes\b/iu,
    /\bpodr[ií]as?\b/iu,
    /\bopcional(?:mente)?\b/iu,
    /\bsi (?:te|lo) ayuda\b/iu,
    /\bte (?:puede|podría) (?:ayudar|servir)\b/iu,
    /\bconsidera(?:r)?\b/iu,
    /\bte sugiero\b/iu
]);

const REQUIRED_TOOL_LANGUAGE = Object.freeze([
    /\bdebes\b/iu,
    /\btienes que\b/iu,
    /\bes (?:necesario|obligatorio)\b/iu,
    /\bpara (?:aprobar|superar|obtener la puntuaci[oó]n)\b/iu,
    /\bse (?:evaluar[aá]|calificar[aá]|penalizar[aá])\b/iu
]);

export function assertBrokerLearningOptionalToolRecommendations(
    surfaces,
    pedagogicalContext,
    options = {}
) {
    const allowedTools = new Set(
        pedagogicalContext.optionalTools.map(
            tool => tool.id
        )
    );

    for (const surface of surfaces) {
        const referencedTools =
            findBrokerLearningToolReferences(
                surface.text
            );

        if (referencedTools.length === 0) {
            continue;
        }

        const forbidden = referencedTools.filter(
            toolId => !allowedTools.has(toolId)
        );

        if (forbidden.length > 0) {
            invalid(
                options.notRecommendedCode ??
                    "BROKER95_LEARNING_TOOL_NOT_RECOMMENDED",
                options.publicMessage,
                [{
                    field: surface.field,
                    toolIds: forbidden
                }]
            );
        }

        if (
            REQUIRED_TOOL_LANGUAGE.some(pattern =>
                pattern.test(surface.text)
            ) ||
            !OPTIONAL_TOOL_LANGUAGE.some(pattern =>
                pattern.test(surface.text)
            )
        ) {
            invalid(
                options.notOptionalCode ??
                    "BROKER95_LEARNING_TOOL_NOT_OPTIONAL",
                options.publicMessage,
                [{
                    field: surface.field,
                    toolIds: referencedTools
                }]
            );
        }
    }
}

export function assertBrokerLearningToolsAbsent(
    surfaces,
    options = {}
) {
    for (const surface of surfaces) {
        const referencedTools =
            findBrokerLearningToolReferences(
                surface.text
            );

        if (referencedTools.length > 0) {
            invalid(
                options.code ??
                    "BROKER95_LEARNING_TOOL_EVALUATION_FORBIDDEN",
                options.publicMessage,
                [{
                    field: surface.field,
                    toolIds: referencedTools
                }]
            );
        }
    }
}

function invalid(code, publicMessage, details) {
    throw BrokerGameError.invalidRule(
        code,
        publicMessage ??
            "CIPHER devolvió contenido pedagógico que no pudo validarse.",
        details
    );
}
