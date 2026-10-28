import {
    BrokerGameError
} from "../core/BrokerGameError.js";
import {
    getBrokerRiskRule
} from "../core/BrokerRiskRules.js";
import {
    BROKER_CONTRACT_REQUIREMENT_LIMITS,
    requiresAnonymousClient
} from "./BrokerContractGenerationRequest.js";
import {
    createBrokerRequirementIds
} from "../core/BrokerTestCase.js";
import {
    brokerTestCaseValidator
} from "./BrokerTestCaseValidator.js";

const REQUIRED_FIELDS = Object.freeze([
    "title",
    "description",
    "requirements",
    "testCases"
]);
const OPTIONAL_NAMED_FIELDS = Object.freeze([
    "client"
]);

export const BROKER_CONTRACT_CONTENT_LIMITS =
    Object.freeze({
        title: 160,
        client: 160,
        description: 6_000,
        requirement: 600
    });

/**
 * Acepta exclusivamente contenido narrativo. Cualquier campo de identidad,
 * categoría, riesgo, pesos, paga, estado o evaluación propuesto por el LLM
 * se rechaza antes de tocar la partida.
 */
export class BrokerContractValidator {

    validate(proposal, options = {}) {
        const risk = options.risk;

        getBrokerRiskRule(risk);

        const source = requireRecord(
            proposal,
            "BROKER95_CONTRACT_DRAFT_INVALID"
        );
        const anonymous = requiresAnonymousClient(risk);
        const allowed = anonymous
            ? REQUIRED_FIELDS
            : [...REQUIRED_FIELDS,
                ...OPTIONAL_NAMED_FIELDS];

        requireExactFields(
            source,
            allowed,
            anonymous
                ? REQUIRED_FIELDS
                : [...REQUIRED_FIELDS,
                    "client"]
        );

        const requirements = normalizeRequirements(
            source.requirements
        );
        const requirementIds = createBrokerRequirementIds(
            requirements
        );

        return Object.freeze({
            title: normalizeText(
                source.title,
                "BROKER95_CONTRACT_DRAFT_TITLE_INVALID",
                BROKER_CONTRACT_CONTENT_LIMITS.title,
                false
            ),
            description: normalizeText(
                source.description,
                "BROKER95_CONTRACT_DRAFT_DESCRIPTION_INVALID",
                BROKER_CONTRACT_CONTENT_LIMITS
                    .description,
                true
            ),
            requirements,
            requirementIds,
            testCases: brokerTestCaseValidator.validate(
                source.testCases,
                {
                    requirements,
                    requirementIds
                }
            ),
            client: anonymous
                ? "Anónimo"
                : normalizeText(
                    source.client,
                    "BROKER95_CONTRACT_DRAFT_CLIENT_INVALID",
                    BROKER_CONTRACT_CONTENT_LIMITS.client,
                    false
                )
        });
    }
}

export const brokerContractValidator =
    Object.freeze(new BrokerContractValidator());

export function validateBrokerContractDraft(
    proposal,
    options
) {
    return brokerContractValidator.validate(
        proposal,
        options
    );
}

function normalizeRequirements(value) {
    if (
        !Array.isArray(value) ||
        value.length <
            BROKER_CONTRACT_REQUIREMENT_LIMITS
                .minimum ||
        value.length >
            BROKER_CONTRACT_REQUIREMENT_LIMITS
                .maximum
    ) {
        invalid(
            "BROKER95_CONTRACT_DRAFT_REQUIREMENTS_INVALID"
        );
    }

    const requirements = value.map(item =>
        normalizeText(
            item,
            "BROKER95_CONTRACT_DRAFT_REQUIREMENTS_INVALID",
            BROKER_CONTRACT_CONTENT_LIMITS
                .requirement,
            false
        )
    );
    const unique = new Set(
        requirements.map(item =>
            item.normalize("NFKC")
                .toLocaleLowerCase("es-MX")
        )
    );

    if (unique.size !== requirements.length) {
        invalid(
            "BROKER95_CONTRACT_DRAFT_REQUIREMENTS_DUPLICATED"
        );
    }

    return Object.freeze(requirements);
}

function normalizeText(value, code, maximum, multiline) {
    if (
        typeof value !== "string" ||
        value.length === 0 ||
        value.length > maximum ||
        value.includes("\u0000") ||
        containsUnsafeControl(value, multiline)
    ) {
        invalid(code);
    }

    const normalized = multiline
        ? value.replace(/\r\n?/gu, "\n")
            .split("\n")
            .map(line => line.trim())
            .join("\n")
            .trim()
        : value.replace(/\s+/gu, " ").trim();

    if (normalized.length === 0) {
        invalid(code);
    }

    return normalized;
}

function containsUnsafeControl(value, multiline) {
    return [...value].some(character => {
        const code = character.codePointAt(0);

        return code < 32 &&
            character !== "\t" &&
            (
                !multiline ||
                (
                    character !== "\n" &&
                    character !== "\r"
                )
            );
    });
}

function requireExactFields(source, allowed, required) {
    const keys = Object.keys(source);

    if (
        keys.some(key => !allowed.includes(key)) ||
        required.some(key => !Object.hasOwn(source, key))
    ) {
        invalid("BROKER95_CONTRACT_DRAFT_FIELDS_INVALID");
    }
}

function requireRecord(value, code) {
    if (
        value == null ||
        typeof value !== "object" ||
        Array.isArray(value) ||
        (
            Object.getPrototypeOf(value) !==
                Object.prototype &&
            Object.getPrototypeOf(value) !== null
        )
    ) {
        invalid(code);
    }

    return value;
}

function invalid(code) {
    throw BrokerGameError.invalidRule(
        code,
        "CIPHER devolvió un borrador de contrato no válido.",
        []
    );
}
