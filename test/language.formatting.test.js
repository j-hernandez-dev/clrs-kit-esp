import test from "node:test";
import assert from "node:assert/strict";

import {
    parseSource
} from "../src/language/LanguageFrontend.js";
import {
    CLRSFormatter
} from "../src/language/formatting/CLRSFormatter.js";
import {
    CLRSDocumentFormattingProvider
} from "../extension/providers/FormattingProvider.js";

test("normaliza sangría y espacios sin alterar cadenas o comentarios", () => {
    const source = [
        "// Programa de prueba",
        "PRINCIPAL( a,b[] )",
        "  x=1+ -2 // conserva el comentario",
        "  si x==1",
        "      escribir \"http://ejemplo\",x",
        "  sino si x>=2",
        "      // rama alternativa",
        "      leer a,b",
        "  sino",
        "      retornar -x",
        ""
    ].join("\n");
    const ast = parseSource(source).ast;
    const formatted =
        new CLRSFormatter().format(
            source,
            {
                ast,
                tabSize: 4,
                insertSpaces: true
            }
        );

    assert.equal(
        formatted,
        [
            "// Programa de prueba",
            "PRINCIPAL(a, b[])",
            "    x = 1 + -2  // conserva el comentario",
            "    si x == 1",
            "        escribir \"http://ejemplo\", x",
            "    sino si x >= 2",
            "        // rama alternativa",
            "        leer a, b",
            "    sino",
            "        retornar -x",
            ""
        ].join("\n")
    );
});

test("respeta tabulaciones, CRLF y resulta idempotente", () => {
    const source = [
        "SUMA(a,b)",
        "  mientras a<b",
        "      a=a+1",
        "  retornar a",
        ""
    ].join("\r\n");
    const formatter = new CLRSFormatter();
    const first = formatter.format(source, {
        ast: parseSource(source).ast,
        tabSize: 8,
        insertSpaces: false
    });
    const second = formatter.format(first, {
        ast: parseSource(first).ast,
        tabSize: 8,
        insertSpaces: false
    });

    assert.equal(
        first,
        [
            "SUMA(a, b)",
            "\tmientras a < b",
            "\t\ta = a + 1",
            "\tretornar a",
            ""
        ].join("\r\n")
    );
    assert.equal(second, first);
});

test("distingue continuaciones agrupadas de bloques estructurales", () => {
    const source = [
        "SUMA(a,b)",
        "  retornar a+b",
        "PRINCIPAL()",
        "  resultado=SUMA(",
        "  1,",
        "  2",
        "  )"
    ].join("\n");
    const formatted =
        new CLRSFormatter().format(
            source,
            {
                ast: parseSource(source).ast,
                tabSize: 4,
                insertSpaces: true
            }
        );

    assert.equal(
        formatted,
        [
            "SUMA(a, b)",
            "    retornar a + b",
            "PRINCIPAL()",
            "    resultado = SUMA(",
            "        1,",
            "        2",
            "    )"
        ].join("\n")
    );
});

test("formatea arreglos literales compactos y multidimensionales", () => {
    const source = [
        "PRINCIPAL()",
        "  compacto=[1,[\"a\",VERDAD],SUMA(1,2)]",
        "  matriz=[",
        "  1,",
        "  [",
        "  2,",
        "  3",
        "  ],",
        "  []",
        "  ]"
    ].join("\n");
    const formatter = new CLRSFormatter();
    const first = formatter.format(source, {
        ast: parseSource(source).ast,
        tabSize: 4,
        insertSpaces: true
    });
    const second = formatter.format(first, {
        ast: parseSource(first).ast,
        tabSize: 4,
        insertSpaces: true
    });

    assert.equal(
        first,
        [
            "PRINCIPAL()",
            "    compacto = [1, [\"a\", VERDAD], SUMA(1, 2)]",
            "    matriz = [",
            "        1,",
            "        [",
            "            2,",
            "            3",
            "        ],",
            "        []",
            "    ]"
        ].join("\n")
    );
    assert.equal(second, first);
});

test("el proveedor produce una sola edición completa y evita fuentes inválidas", () => {
    const source =
        "PRINCIPAL()\n  x=1\n";
    const document = createDocument(source);
    const provider =
        new CLRSDocumentFormattingProvider({
            vscodeApi: createVSCodeApi(),
            documentAnalysisService: {
                analyzeDocument() {
                    return {
                        ast:
                            parseSource(source)
                                .ast
                    };
                }
            },
            formatter:
                new CLRSFormatter(),
            languageId: "clrs-es",
            developerLogger: {
                error() {}
            }
        });
    const edits =
        provider
            .provideDocumentFormattingEdits(
                document,
                {
                    tabSize: 4,
                    insertSpaces: true
                }
            );

    assert.equal(edits.length, 1);
    assert.equal(
        edits[0].newText,
        "PRINCIPAL()\n    x = 1\n"
    );
    assert.equal(edits[0].range.end.offset, source.length);

    provider.documentAnalysisService = {
        analyzeDocument() {
            return { ast: null };
        }
    };

    assert.deepEqual(
        provider
            .provideDocumentFormattingEdits(
                document,
                {
                    tabSize: 4,
                    insertSpaces: true
                }
            ),
        []
    );
});

function createDocument(source) {
    return {
        languageId: "clrs-es",
        uri: {
            toString() {
                return "file:///formato.clrs";
            }
        },
        version: 1,
        getText() {
            return source;
        },
        positionAt(offset) {
            return { offset };
        }
    };
}

function createVSCodeApi() {
    return {
        Range: class Range {
            constructor(start, end) {
                this.start = start;
                this.end = end;
            }
        },
        TextEdit: {
            replace(range, newText) {
                return {
                    range,
                    newText
                };
            }
        }
    };
}
