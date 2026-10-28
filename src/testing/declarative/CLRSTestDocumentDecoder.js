import path from "node:path";

import {
    CLRS_TEST_LIMITS,
    createCLRSTestSuite
} from "../domain/index.js";
import {
    CLRSTestDocumentError
} from "./CLRSTestDocumentError.js";

export const CLRS_TEST_DOCUMENT_VERSION = 1;
export const CLRS_TEST_DOCUMENT_SUFFIX =
    ".clrs-tests.json";

export const CLRS_TEST_DOCUMENT_LIMITS =
    Object.freeze({
        maximumDocumentCharacters: 8_388_608,
        maximumLinesPerField: 65_536,
        maximumLineCharacters: 65_536
    });

const ROOT_KEYS = Object.freeze([
    "$schema",
    "version",
    "id",
    "name",
    "program",
    "cases"
]);
const REQUIRED_ROOT_KEYS = Object.freeze([
    "version",
    "id",
    "name",
    "program",
    "cases"
]);
const CASE_KEYS = Object.freeze([
    "id",
    "name",
    "input",
    "expectedOutput",
    "comparison",
    "timeoutMs"
]);
const REQUIRED_CASE_KEYS = Object.freeze([
    "id",
    "name",
    "input",
    "expectedOutput"
]);

/**
 * Traduce el formato JSON público a los valores inmutables del dominio.
 * No lee archivos ni depende de VS Code.
 */
export class CLRSTestDocumentDecoder {

    constructor(options = {}) {
        this.path = options.path ?? path;
    }

    parse(sourceText, definitionPath) {
        requireSourceText(
            sourceText,
            definitionPath
        );

        let source;

        try {
            source = JSON.parse(
                removeByteOrderMark(sourceText)
            );
        } catch (error) {
            throw CLRSTestDocumentError
                .invalidJson(
                    definitionPath,
                    error
                );
        }

        return this.decode(
            source,
            definitionPath
        );
    }

    decode(source, definitionPath) {
        const documentPath = requireDefinitionPath(
            definitionPath,
            this.path
        );
        const input = requireRecord(
            source,
            documentPath,
            "$"
        );

        requireExactFields(
            input,
            ROOT_KEYS,
            REQUIRED_ROOT_KEYS,
            documentPath,
            "$"
        );
        requireCurrentVersion(
            input.version,
            documentPath
        );

        if (
            Object.hasOwn(input, "$schema") &&
            (
                typeof input.$schema !== "string" ||
                input.$schema.trim().length === 0
            )
        ) {
            invalid(
                "CLRS_TEST_DOCUMENT_SCHEMA_INVALID",
                documentPath,
                "$schema"
            );
        }

        if (
            !Array.isArray(input.cases) ||
            input.cases.length >
                CLRS_TEST_LIMITS
                    .maximumCasesPerSuite
        ) {
            invalid(
                "CLRS_TEST_DOCUMENT_CASES_INVALID",
                documentPath,
                "cases"
            );
        }

        const programPath = resolveProgramPath(
            input.program,
            documentPath,
            this.path
        );
        const cases = input.cases.map(
            (testCase, index) =>
                decodeCase(
                    testCase,
                    documentPath,
                    index
                )
        );

        return createCLRSTestSuite({
            id: input.id,
            name: input.name,
            programPath,
            definitionPath: documentPath,
            cases
        });
    }
}

export const clrsTestDocumentDecoder =
    Object.freeze(
        new CLRSTestDocumentDecoder()
    );

export function parseCLRSTestDocument(
    sourceText,
    definitionPath,
    options = {}
) {
    return new CLRSTestDocumentDecoder(options)
        .parse(sourceText, definitionPath);
}

export function decodeCLRSTestDocument(
    source,
    definitionPath,
    options = {}
) {
    return new CLRSTestDocumentDecoder(options)
        .decode(source, definitionPath);
}

function decodeCase(source, documentPath, index) {
    const field = `cases[${index}]`;
    const input = requireRecord(
        source,
        documentPath,
        field
    );

    requireExactFields(
        input,
        CASE_KEYS,
        REQUIRED_CASE_KEYS,
        documentPath,
        field
    );

    return {
        id: input.id,
        name: input.name,
        input: {
            stdin: decodeLines(
                input.input,
                documentPath,
                `${field}.input`,
                CLRS_TEST_LIMITS
                    .maximumInputCharacters
            )
        },
        expectation: {
            stdout: decodeLines(
                input.expectedOutput,
                documentPath,
                `${field}.expectedOutput`,
                CLRS_TEST_LIMITS
                    .maximumExpectedCharacters
            ),
            ...(Object.hasOwn(input, "comparison")
                ? { comparison: input.comparison }
                : {})
        },
        ...(Object.hasOwn(input, "timeoutMs")
            ? { timeoutMs: input.timeoutMs }
            : {})
    };
}

function decodeLines(
    source,
    documentPath,
    field,
    maximumCharacters
) {
    if (
        !Array.isArray(source) ||
        source.length >
            CLRS_TEST_DOCUMENT_LIMITS
                .maximumLinesPerField
    ) {
        invalid(
            "CLRS_TEST_DOCUMENT_LINES_INVALID",
            documentPath,
            field
        );
    }

    for (
        let index = 0;
        index < source.length;
        index += 1
    ) {
        const line = source[index];

        if (
            typeof line !== "string" ||
            line.length >
                CLRS_TEST_DOCUMENT_LIMITS
                    .maximumLineCharacters ||
            /[\r\n\u0000]/u.test(line) ||
            containsUnsafeControl(line)
        ) {
            invalid(
                "CLRS_TEST_DOCUMENT_LINE_INVALID",
                documentPath,
                `${field}[${index}]`
            );
        }
    }

    const text = source.length === 0
        ? ""
        : `${source.join("\n")}\n`;

    if (text.length > maximumCharacters) {
        invalid(
            "CLRS_TEST_DOCUMENT_LINES_TOO_LARGE",
            documentPath,
            field
        );
    }

    return text;
}

function resolveProgramPath(
    value,
    documentPath,
    pathService
) {
    if (
        typeof value !== "string" ||
        value.trim().length === 0 ||
        value.length >
            CLRS_TEST_LIMITS.maximumPathCharacters ||
        value.includes("\u0000") ||
        isAbsoluteOnAnyPlatform(
            value,
            pathService
        ) ||
        pathService.extname(value)
            .toLocaleLowerCase("en-US") !== ".clrs"
    ) {
        invalid(
            "CLRS_TEST_DOCUMENT_PROGRAM_INVALID",
            documentPath,
            "program"
        );
    }

    return pathService.resolve(
        pathService.dirname(documentPath),
        value
    );
}

function requireDefinitionPath(value, pathService) {
    if (
        typeof value !== "string" ||
        value.trim().length === 0 ||
        value.length >
            CLRS_TEST_LIMITS.maximumPathCharacters ||
        value.includes("\u0000") ||
        !pathService.isAbsolute(value) ||
        !value.toLocaleLowerCase("en-US")
            .endsWith(CLRS_TEST_DOCUMENT_SUFFIX)
    ) {
        invalid(
            "CLRS_TEST_DOCUMENT_PATH_INVALID",
            typeof value === "string"
                ? value
                : null,
            "definitionPath"
        );
    }

    return pathService.normalize(value);
}

function requireSourceText(value, documentPath) {
    if (
        typeof value !== "string" ||
        value.length >
            CLRS_TEST_DOCUMENT_LIMITS
                .maximumDocumentCharacters
    ) {
        invalid(
            "CLRS_TEST_DOCUMENT_SOURCE_INVALID",
            documentPath,
            "$"
        );
    }
}

function requireCurrentVersion(value, documentPath) {
    if (
        Number.isSafeInteger(value) &&
        value > CLRS_TEST_DOCUMENT_VERSION
    ) {
        throw CLRSTestDocumentError
            .unsupportedVersion(
                documentPath,
                value
            );
    }

    if (value !== CLRS_TEST_DOCUMENT_VERSION) {
        invalid(
            "CLRS_TEST_DOCUMENT_VERSION_INVALID",
            documentPath,
            "version"
        );
    }
}

function requireRecord(value, documentPath, field) {
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
        invalid(
            "CLRS_TEST_DOCUMENT_RECORD_INVALID",
            documentPath,
            field
        );
    }

    return value;
}

function requireExactFields(
    value,
    allowed,
    required,
    documentPath,
    field
) {
    const keys = Object.keys(value);

    if (
        keys.some(key => !allowed.includes(key)) ||
        required.some(
            key => !Object.hasOwn(value, key)
        )
    ) {
        invalid(
            "CLRS_TEST_DOCUMENT_FIELDS_INVALID",
            documentPath,
            field
        );
    }
}

function isAbsoluteOnAnyPlatform(value, pathService) {
    return pathService.isAbsolute(value) ||
        /^[A-Za-z]:[\\/]/u.test(value) ||
        /^[/\\]{2}/u.test(value) ||
        value.startsWith("/");
}

function containsUnsafeControl(value) {
    return [...value].some(character => {
        const code = character.codePointAt(0);

        return code < 32 && character !== "\t";
    });
}

function removeByteOrderMark(value) {
    return value.codePointAt(0) === 0xFEFF
        ? value.slice(1)
        : value;
}

function invalid(code, documentPath, field) {
    throw CLRSTestDocumentError.invalid(
        code,
        documentPath,
        field
    );
}
