import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
    CLRS_TEST_DOCUMENT_SUFFIX,
    CLRS_TEST_DOCUMENT_VERSION,
    CLRS_TEST_LIMITS,
    CLRSTestComparison,
    CLRSTestDocumentError,
    CLRSTestDomainError,
    CLRSTestSuite,
    decodeCLRSTestDocument,
    parseCLRSTestDocument
} from "../src/testing/index.js";

const DEFINITION_PATH = path.resolve(
    "fixtures",
    "tests",
    `suma${CLRS_TEST_DOCUMENT_SUFFIX}`
);

test("decodifica el formato declarativo hacia el dominio CLRS", () => {
    const suite = parseCLRSTestDocument(
        `\uFEFF${JSON.stringify({
            $schema:
                "./clrs-tests.schema.json",
            version: CLRS_TEST_DOCUMENT_VERSION,
            id: "suite:suma",
            name: "Pruebas de suma",
            program: "../programs/suma.clrs",
            cases: [
                {
                    id: "case:positivos",
                    name: "Suma dos positivos",
                    input: ["5", "8"],
                    expectedOutput: ["13"],
                    comparison: "number"
                },
                {
                    id: "case:sin-salida",
                    name: "No produce salida",
                    input: [],
                    expectedOutput: [],
                    timeoutMs: 250
                }
            ]
        })}`,
        DEFINITION_PATH
    );

    assert.ok(suite instanceof CLRSTestSuite);
    assert.equal(
        suite.programPath,
        path.resolve(
            path.dirname(DEFINITION_PATH),
            "../programs/suma.clrs"
        )
    );
    assert.equal(
        suite.definitionPath,
        path.normalize(DEFINITION_PATH)
    );
    assert.equal(
        suite.cases[0].input.stdin,
        "5\n8\n"
    );
    assert.equal(
        suite.cases[0].expectation.stdout,
        "13\n"
    );
    assert.equal(
        suite.cases[0].expectation.comparison,
        CLRSTestComparison.NUMBER
    );
    assert.equal(
        suite.cases[0].timeoutMs,
        CLRS_TEST_LIMITS.defaultTimeoutMs
    );
    assert.equal(suite.cases[1].input.stdin, "");
    assert.equal(
        suite.cases[1].expectation.stdout,
        ""
    );
    assert.equal(suite.cases[1].timeoutMs, 250);
    assert.equal(Object.isFrozen(suite), true);
});

test("cada elemento declarativo representa exactamente una línea", () => {
    const suite = decodeCLRSTestDocument(
        documentSource({
            cases: [{
                id: "case:lineas",
                name: "Conserva espacios y líneas vacías",
                input: ["  5  ", ""],
                expectedOutput: ["  5  ", ""]
            }]
        }),
        DEFINITION_PATH
    );

    assert.equal(
        suite.cases[0].input.stdin,
        "  5  \n\n"
    );
    assert.equal(
        suite.cases[0].expectation.stdout,
        "  5  \n\n"
    );
});

test("rechaza JSON inválido y versiones desconocidas", () => {
    assertDocumentError(
        () => parseCLRSTestDocument(
            "{",
            DEFINITION_PATH
        ),
        "CLRS_TEST_DOCUMENT_JSON_INVALID"
    );
    assertDocumentError(
        () => decodeCLRSTestDocument(
            documentSource({ version: 2 }),
            DEFINITION_PATH
        ),
        "CLRS_TEST_DOCUMENT_VERSION_UNSUPPORTED",
        "version"
    );
    assertDocumentError(
        () => decodeCLRSTestDocument(
            documentSource({ version: 0 }),
            DEFINITION_PATH
        ),
        "CLRS_TEST_DOCUMENT_VERSION_INVALID",
        "version"
    );
});

test("exige campos exactos en la raíz y en cada caso", () => {
    assertDocumentError(
        () => decodeCLRSTestDocument(
            {
                ...documentSource(),
                executableCode: "process.exit()"
            },
            DEFINITION_PATH
        ),
        "CLRS_TEST_DOCUMENT_FIELDS_INVALID",
        "$"
    );
    assertDocumentError(
        () => decodeCLRSTestDocument(
            documentSource({
                cases: [{
                    ...caseSource(),
                    executableCode: "process.exit()"
                }]
            }),
            DEFINITION_PATH
        ),
        "CLRS_TEST_DOCUMENT_FIELDS_INVALID",
        "cases[0]"
    );
    const missingOutput = caseSource();

    delete missingOutput.expectedOutput;

    assertDocumentError(
        () => decodeCLRSTestDocument(
            documentSource({
                cases: [missingOutput]
            }),
            DEFINITION_PATH
        ),
        "CLRS_TEST_DOCUMENT_FIELDS_INVALID",
        "cases[0]"
    );
});

test("admite comparadores declarativos y valida su oráculo", () => {
    const suite = decodeCLRSTestDocument(
        documentSource({
            cases: [{
                ...caseSource(),
                expectedOutput: [
                    '{"b":2,"a":[1,2]}'
                ],
                comparison: "json"
            }]
        }),
        DEFINITION_PATH
    );

    assert.equal(
        suite.cases[0].expectation.comparison,
        CLRSTestComparison.JSON
    );

    assertDomainError(
        () => decodeCLRSTestDocument(
            documentSource({
                cases: [{
                    ...caseSource(),
                    comparison: "javascript"
                }]
            }),
            DEFINITION_PATH
        ),
        "CLRS_TEST_COMPARISON_INVALID"
    );
    assertDomainError(
        () => decodeCLRSTestDocument(
            documentSource({
                cases: [{
                    ...caseSource(),
                    expectedOutput: ["no es JSON"],
                    comparison: "json"
                }]
            }),
            DEFINITION_PATH
        ),
        "CLRS_TEST_EXPECTED_JSON_INVALID"
    );
});

test("restringe rutas y líneas a datos declarativos portables", () => {
    const cases = [
        {
            source: documentSource({
                program: "C:\\proyecto\\suma.clrs"
            }),
            code:
                "CLRS_TEST_DOCUMENT_PROGRAM_INVALID",
            field: "program"
        },
        {
            source: documentSource({
                program: "/proyecto/suma.clrs"
            }),
            code:
                "CLRS_TEST_DOCUMENT_PROGRAM_INVALID",
            field: "program"
        },
        {
            source: documentSource({
                program: "suma.js"
            }),
            code:
                "CLRS_TEST_DOCUMENT_PROGRAM_INVALID",
            field: "program"
        },
        {
            source: documentSource({
                cases: [{
                    ...caseSource(),
                    input: ["dos\nlíneas"]
                }]
            }),
            code:
                "CLRS_TEST_DOCUMENT_LINE_INVALID",
            field: "cases[0].input[0]"
        },
        {
            source: documentSource({
                cases: [{
                    ...caseSource(),
                    expectedOutput: [4]
                }]
            }),
            code:
                "CLRS_TEST_DOCUMENT_LINE_INVALID",
            field:
                "cases[0].expectedOutput[0]"
        }
    ];

    for (const item of cases) {
        assertDocumentError(
            () => decodeCLRSTestDocument(
                item.source,
                DEFINITION_PATH
            ),
            item.code,
            item.field
        );
    }

    assertDocumentError(
        () => decodeCLRSTestDocument(
            documentSource(),
            "suma.clrs-tests.json"
        ),
        "CLRS_TEST_DOCUMENT_PATH_INVALID",
        "definitionPath"
    );
});

test("delega al dominio IDs, nombres y tiempos", () => {
    assert.throws(
        () => decodeCLRSTestDocument(
            documentSource({
                cases: [
                    caseSource({ id: "duplicado" }),
                    caseSource({ id: "duplicado" })
                ]
            }),
            DEFINITION_PATH
        ),
        error =>
            error instanceof CLRSTestDomainError &&
            error.code ===
                "CLRS_TEST_CASE_IDS_DUPLICATED"
    );
    assert.throws(
        () => decodeCLRSTestDocument(
            documentSource({
                cases: [caseSource({
                    timeoutMs: 0
                })]
            }),
            DEFINITION_PATH
        ),
        error =>
            error instanceof CLRSTestDomainError &&
            error.code ===
                "CLRS_TEST_CASE_TIMEOUT_INVALID"
    );
});

test("registra un JSON Schema coherente con el decodificador", async () => {
    const schemaPath = path.resolve(
        "extension",
        "schemas",
        "clrs-tests.schema.json"
    );
    const schema = JSON.parse(
        await readFile(schemaPath, "utf8")
    );
    const manifest = JSON.parse(
        await readFile(
            path.resolve("package.json"),
            "utf8"
        )
    );
    const contribution =
        manifest.contributes.jsonValidation
            .find(item =>
                item.fileMatch ===
                    "*.clrs-tests.json"
            );

    assert.equal(
        schema.properties.version.const,
        CLRS_TEST_DOCUMENT_VERSION
    );
    assert.deepEqual(
        schema.required,
        ["version", "id", "name", "program", "cases"]
    );
    assert.equal(
        schema.properties.cases.maxItems,
        CLRS_TEST_LIMITS.maximumCasesPerSuite
    );
    assert.equal(
        schema.$defs.testCase.properties
            .timeoutMs.default,
        CLRS_TEST_LIMITS.defaultTimeoutMs
    );
    assert.deepEqual(
        schema.$defs.testCase.properties
            .comparison.enum.sort(),
        Object.values(CLRSTestComparison).sort()
    );
    assert.deepEqual(contribution, {
        fileMatch: "*.clrs-tests.json",
        url:
            "./extension/schemas/clrs-tests.schema.json"
    });
});

function documentSource(overrides = {}) {
    return {
        version: CLRS_TEST_DOCUMENT_VERSION,
        id: "suite:suma",
        name: "Pruebas de suma",
        program: "suma.clrs",
        cases: [caseSource()],
        ...overrides
    };
}

function caseSource(overrides = {}) {
    return {
        id: "case:base",
        name: "Caso base",
        input: [],
        expectedOutput: [],
        ...overrides
    };
}

function assertDocumentError(
    operation,
    code,
    field = null
) {
    assert.throws(
        operation,
        error =>
            error instanceof CLRSTestDocumentError &&
            error.code === code &&
            (field == null || error.field === field)
    );
}

function assertDomainError(operation, code) {
    assert.throws(
        operation,
        error =>
            error instanceof CLRSTestDomainError &&
            error.code === code
    );
}
