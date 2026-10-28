import {
    BrokerGameError
} from "../core/BrokerGameError.js";

export const BrokerLearningContentBlockKind =
    Object.freeze({
        PARAGRAPH: "paragraph",
        LIST: "list",
        CALLOUT: "callout"
    });

export const BrokerLearningExampleLanguage =
    Object.freeze({
        CLRS: "clrs",
        TEXT: "text"
    });

export const BROKER_LEARNING_CONTENT_LIMITS =
    Object.freeze({
        blockCount: 96,
        blockTextCharacters: 8_000,
        listItemCount: 32,
        listItemCharacters: 1_000,
        exampleCount: 16,
        exampleContentCharacters: 16_384,
        exampleExplanationCharacters: 2_000,
        formulaCount: 12,
        formulaCharacters: 2_000,
        titleCharacters: 240
    });

const CONTENT_KINDS = Object.freeze(
    Object.values(
        BrokerLearningContentBlockKind
    )
);
const EXAMPLE_LANGUAGES = Object.freeze(
    Object.values(
        BrokerLearningExampleLanguage
    )
);

export function createBrokerLearningContentBlock(
    source = {}
) {
    const input = requireRecord(
        source,
        "BROKER95_LEARNING_CONTENT_BLOCK_INVALID"
    );
    const kind = requireEnum(
        input.kind,
        CONTENT_KINDS,
        "BROKER95_LEARNING_CONTENT_KIND_INVALID"
    );

    switch (kind) {
        case BrokerLearningContentBlockKind
            .PARAGRAPH:
            requireExactFields(
                input,
                ["kind", "text"],
                "BROKER95_LEARNING_CONTENT_FIELDS_INVALID"
            );

            return Object.freeze({
                kind,
                text: requireMultilineText(
                    input.text,
                    BROKER_LEARNING_CONTENT_LIMITS
                        .blockTextCharacters,
                    "BROKER95_LEARNING_CONTENT_TEXT_INVALID"
                )
            });

        case BrokerLearningContentBlockKind.LIST:
            requireExactFields(
                input,
                ["kind", "items"],
                "BROKER95_LEARNING_CONTENT_FIELDS_INVALID"
            );

            return Object.freeze({
                kind,
                items: createUniqueTextList(
                    input.items,
                    {
                        minimum: 1,
                        maximum:
                            BROKER_LEARNING_CONTENT_LIMITS
                                .listItemCount,
                        maximumCharacters:
                            BROKER_LEARNING_CONTENT_LIMITS
                                .listItemCharacters,
                        code:
                            "BROKER95_LEARNING_CONTENT_ITEMS_INVALID"
                    }
                )
            });

        case BrokerLearningContentBlockKind.CALLOUT:
            requireExactFields(
                input,
                ["kind", "text", "title"],
                "BROKER95_LEARNING_CONTENT_FIELDS_INVALID",
                ["kind", "text"]
            );

            return Object.freeze({
                kind,
                title: input.title == null
                    ? null
                    : requireInlineText(
                        input.title,
                        BROKER_LEARNING_CONTENT_LIMITS
                            .titleCharacters,
                        "BROKER95_LEARNING_CONTENT_TITLE_INVALID"
                    ),
                text: requireMultilineText(
                    input.text,
                    BROKER_LEARNING_CONTENT_LIMITS
                        .blockTextCharacters,
                    "BROKER95_LEARNING_CONTENT_TEXT_INVALID"
                )
            });

        default:
            return unreachableContentKind();
    }
}

export function createBrokerLearningContentBlocks(
    source,
    options = {}
) {
    const minimum = options.minimum ?? 1;
    const maximum = options.maximum ??
        BROKER_LEARNING_CONTENT_LIMITS
            .blockCount;

    if (
        !Array.isArray(source) ||
        !Number.isInteger(minimum) ||
        minimum < 0 ||
        !Number.isInteger(maximum) ||
        maximum < minimum ||
        source.length < minimum ||
        source.length > maximum
    ) {
        invalid(
            "BROKER95_LEARNING_CONTENT_BLOCKS_INVALID"
        );
    }

    return Object.freeze(
        source.map(
            createBrokerLearningContentBlock
        )
    );
}

export function createBrokerLearningExample(
    source = {}
) {
    const input = requireRecord(
        source,
        "BROKER95_LEARNING_EXAMPLE_INVALID"
    );

    requireExactFields(
        input,
        [
            "id",
            "title",
            "language",
            "content",
            "explanation"
        ],
        "BROKER95_LEARNING_EXAMPLE_FIELDS_INVALID",
        ["id", "language", "content"]
    );

    const language = requireEnum(
        input.language,
        EXAMPLE_LANGUAGES,
        "BROKER95_LEARNING_EXAMPLE_LANGUAGE_INVALID"
    );
    const content = requireMultilineText(
        input.content,
        BROKER_LEARNING_CONTENT_LIMITS
            .exampleContentCharacters,
        "BROKER95_LEARNING_EXAMPLE_CONTENT_INVALID",
        { preserveIndentation: true }
    );

    if (
        language ===
            BrokerLearningExampleLanguage.CLRS
    ) {
        requireCurrentClrsSyntax(content);
    }

    return Object.freeze({
        id: requireIdentifier(
            input.id,
            "BROKER95_LEARNING_EXAMPLE_ID_INVALID"
        ),
        title: input.title == null
            ? null
            : requireInlineText(
                input.title,
                BROKER_LEARNING_CONTENT_LIMITS
                    .titleCharacters,
                "BROKER95_LEARNING_EXAMPLE_TITLE_INVALID"
            ),
        language,
        content,
        explanation:
            input.explanation == null
                ? null
                : requireMultilineText(
                    input.explanation,
                    BROKER_LEARNING_CONTENT_LIMITS
                        .exampleExplanationCharacters,
                    "BROKER95_LEARNING_EXAMPLE_EXPLANATION_INVALID"
                )
    });
}

export function createBrokerLearningExamples(
    source,
    options = {}
) {
    const minimum = options.minimum ?? 1;

    if (
        !Array.isArray(source) ||
        !Number.isInteger(minimum) ||
        minimum < 0 ||
        source.length < minimum ||
        source.length >
            BROKER_LEARNING_CONTENT_LIMITS
                .exampleCount
    ) {
        invalid(
            "BROKER95_LEARNING_EXAMPLES_INVALID"
        );
    }

    const examples = source.map(
        createBrokerLearningExample
    );

    if (
        new Set(
            examples.map(example => example.id)
        ).size !== examples.length
    ) {
        invalid(
            "BROKER95_LEARNING_EXAMPLE_IDS_DUPLICATED"
        );
    }

    return Object.freeze(examples);
}

export function createBrokerLearningTextList(
    source,
    options = {}
) {
    return createUniqueTextList(source, {
        minimum: options.minimum ?? 0,
        maximum: options.maximum ?? 64,
        maximumCharacters:
            options.maximumCharacters ?? 1_000,
        code:
            options.code ??
            "BROKER95_LEARNING_TEXT_LIST_INVALID"
    });
}

export function createBrokerLearningFormula(
    source = {}
) {
    const input = requireRecord(
        source,
        "BROKER95_LEARNING_FORMULA_INVALID"
    );

    requireExactFields(
        input,
        [
            "id",
            "title",
            "latex",
            "description"
        ],
        "BROKER95_LEARNING_FORMULA_FIELDS_INVALID",
        ["id", "title", "latex"]
    );

    return Object.freeze({
        id: requireIdentifier(
            input.id,
            "BROKER95_LEARNING_FORMULA_ID_INVALID"
        ),
        title: requireInlineText(
            input.title,
            BROKER_LEARNING_CONTENT_LIMITS
                .titleCharacters,
            "BROKER95_LEARNING_FORMULA_TITLE_INVALID"
        ),
        latex: requireMultilineText(
            input.latex,
            BROKER_LEARNING_CONTENT_LIMITS
                .formulaCharacters,
            "BROKER95_LEARNING_FORMULA_LATEX_INVALID",
            { preserveIndentation: true }
        ),
        description:
            input.description == null
                ? null
                : requireMultilineText(
                    input.description,
                    BROKER_LEARNING_CONTENT_LIMITS
                        .exampleExplanationCharacters,
                    "BROKER95_LEARNING_FORMULA_DESCRIPTION_INVALID"
                )
    });
}

export function createBrokerLearningFormulas(
    source = []
) {
    if (
        !Array.isArray(source) ||
        source.length >
            BROKER_LEARNING_CONTENT_LIMITS
                .formulaCount
    ) {
        invalid(
            "BROKER95_LEARNING_FORMULAS_INVALID"
        );
    }

    const formulas = source.map(
        createBrokerLearningFormula
    );

    if (
        new Set(
            formulas.map(formula => formula.id)
        ).size !== formulas.length
    ) {
        invalid(
            "BROKER95_LEARNING_FORMULA_IDS_DUPLICATED"
        );
    }

    return Object.freeze(formulas);
}

function createUniqueTextList(
    source,
    {
        minimum,
        maximum,
        maximumCharacters,
        code
    }
) {
    if (
        !Array.isArray(source) ||
        source.length < minimum ||
        source.length > maximum
    ) {
        invalid(code);
    }

    const values = source.map(value =>
        requireInlineText(
            value,
            maximumCharacters,
            code
        )
    );
    const normalized = values.map(value =>
        value.normalize("NFKC")
            .toLocaleLowerCase("es-MX")
    );

    if (
        new Set(normalized).size !==
            normalized.length
    ) {
        invalid(code);
    }

    return Object.freeze(values);
}

function requireCurrentClrsSyntax(content) {
    if (
        content.includes("<-") ||
        content.includes("```")
    ) {
        invalid(
            "BROKER95_LEARNING_EXAMPLE_CLRS_SYNTAX_INVALID"
        );
    }
}

function requireInlineText(
    value,
    maximum,
    code
) {
    if (
        typeof value !== "string" ||
        value.length === 0 ||
        value.length > maximum ||
        containsUnsafeControl(value, false)
    ) {
        invalid(code);
    }

    const normalized = value
        .replace(/\s+/gu, " ")
        .trim();

    if (normalized.length === 0) {
        invalid(code);
    }

    return normalized;
}

function requireMultilineText(
    value,
    maximum,
    code,
    options = {}
) {
    if (
        typeof value !== "string" ||
        value.length === 0 ||
        value.length > maximum ||
        containsUnsafeControl(value, true)
    ) {
        invalid(code);
    }

    const normalized = value
        .replace(/\r\n?/gu, "\n");
    const selected = options.preserveIndentation === true
        ? normalized.trim()
        : normalized
            .split("\n")
            .map(line => line.trim())
            .join("\n")
            .trim();

    if (selected.length === 0) {
        invalid(code);
    }

    return selected;
}

function requireIdentifier(value, code) {
    if (
        typeof value !== "string" ||
        !/^[a-z][a-z0-9-]{0,95}$/u
            .test(value)
    ) {
        invalid(code);
    }

    return value;
}

function requireEnum(value, allowed, code) {
    if (!allowed.includes(value)) {
        invalid(code);
    }

    return value;
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

function requireExactFields(
    source,
    allowed,
    code,
    required = allowed
) {
    const keys = Object.keys(source);

    if (
        keys.some(key => !allowed.includes(key)) ||
        required.some(
            key => !Object.hasOwn(source, key)
        )
    ) {
        invalid(code);
    }
}

function containsUnsafeControl(
    value,
    multiline
) {
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

function unreachableContentKind() {
    throw new Error(
        "Unsupported BROKER.95 learning content kind."
    );
}

function invalid(code) {
    throw BrokerGameError.invalidRule(
        code,
        "El contenido curricular de BROKER.95 no es válido.",
        []
    );
}
