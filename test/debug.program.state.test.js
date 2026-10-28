import test from "node:test";
import assert from "node:assert/strict";

import {
    parseSource
} from "../src/language/LanguageFrontend.js";
import {
    collectBindings,
    RuntimeStateInstrumentation
} from "../src/compiler/runtime/RuntimeStateInstrumentation.js";
import {
    CLRSDebugStateStore
} from "../extension/debug/CLRSDebugStateStore.js";

test("la instrumentación separa bindings globales, parámetros y locales", () => {
    const { ast } = parseSource([
        "base = 10",
        "A[0] = 5",
        "CALCULA(x)",
        "    local = x + base",
        "    retornar local",
        "PRINCIPAL()",
        "    resultado = CALCULA(A[0])"
    ].join("\n"));
    const instrumentation =
        new RuntimeStateInstrumentation({
            registerGlobalsName:
                "registerGlobals",
            enterFrameName: "enterFrame",
            leaveFrameName: "leaveFrame"
        });
    const calcula = ast.statements[2];

    assert.deepEqual(
        collectBindings(ast.statements),
        ["base", "A"]
    );
    assert.match(
        instrumentation
            .registerGlobals(
                ast.statements
            ),
        /"base".*"A"/
    );
    assert.match(
        instrumentation.enterFrame(calcula),
        /enterFrame\("CALCULA".*\["x"\], \["local"\]/
    );
    assert.equal(
        instrumentation.leaveFrame(),
        "leaveFrame();\n"
    );
});

test("el store DAP publica pila, ámbitos y valores expandibles", () => {
    const store = new CLRSDebugStateStore();
    const line = value => ({
        startLine: value,
        startColumn: 1,
        endLine: value,
        endColumn: 10
    });

    store.update(
        {
            globalLocation: line(7),
            globals: [{
                name: "A",
                type: "arreglo",
                value: "Arreglo(1)",
                indexed: true,
                children: [{
                    name: "0",
                    type: "número",
                    value: "5",
                    children: []
                }]
            }],
            frames: [{
                id: 1,
                name: "PRINCIPAL",
                location: line(7),
                parameters: [],
                locals: [{
                    name: "resultado",
                    type: "indefinido",
                    value: "indefinido",
                    children: []
                }]
            }, {
                id: 2,
                name: "CALCULA",
                location: line(5),
                parameters: [{
                    name: "x",
                    type: "número",
                    value: "5",
                    children: []
                }],
                locals: [{
                    name: "local",
                    type: "número",
                    value: "15",
                    children: []
                }]
            }]
        },
        "/workspace/programa.clrs",
        line(5)
    );

    const frames = store.getStackFrames();

    assert.deepEqual(
        frames.map(frame => frame.name),
        [
            "CALCULA",
            "PRINCIPAL",
            "Programa CLRS"
        ]
    );
    assert.deepEqual(
        frames.map(frame => frame.line),
        [5, 7, 7]
    );

    const scopes =
        store.getScopes(frames[0].id);
    const parameters =
        store.getVariables(
            scopes[0].variablesReference
        );
    const locals =
        store.getVariables(
            scopes[1].variablesReference
        );
    const globals =
        store.getVariables(
            scopes[2].variablesReference
        );
    const arrayItems =
        store.getVariables(
            globals[0].variablesReference
        );

    assert.deepEqual(
        scopes.map(scope => scope.name),
        [
            "Parámetros",
            "Variables locales",
            "Variables globales"
        ]
    );
    assert.deepEqual(
        parameters.map(item =>
            [item.name, item.value]
        ),
        [["x", "5"]]
    );
    assert.deepEqual(
        locals.map(item =>
            [item.name, item.value]
        ),
        [["local", "15"]]
    );
    assert.equal(globals[0].name, "A");
    assert.equal(globals[0].indexedVariables, 1);
    assert.deepEqual(
        arrayItems.map(item =>
            [item.name, item.value]
        ),
        [["0", "5"]]
    );
});

test("el store DAP permite expandir arreglos literales anidados", () => {
    const store = new CLRSDebugStateStore();
    const location = {
        startLine: 3,
        startColumn: 5,
        endLine: 3,
        endColumn: 35
    };
    const nestedArray = {
        name: "matriz",
        type: "arreglo",
        value: "Arreglo(1)",
        indexed: true,
        children: [{
            name: "0",
            type: "arreglo",
            value: "Arreglo(2)",
            indexed: true,
            children: [{
                name: "0",
                type: "número",
                value: "1",
                children: []
            }, {
                name: "1",
                type: "número",
                value: "2",
                children: []
            }]
        }]
    };

    store.update(
        {
            globalLocation: location,
            globals: [nestedArray],
            frames: [{
                id: 1,
                name: "PRINCIPAL",
                location,
                parameters: [],
                locals: [{
                    ...nestedArray,
                    name: "local"
                }]
            }]
        },
        "/workspace/literales.clrs",
        location
    );

    const frame =
        store.getStackFrames()[0];
    const scopes =
        store.getScopes(frame.id);
    const local = store.getVariables(
        scopes[0].variablesReference
    )[0];
    const firstDimension =
        store.getVariables(
            local.variablesReference
        )[0];
    const values = store.getVariables(
        firstDimension.variablesReference
    );

    assert.equal(local.indexedVariables, 1);
    assert.equal(
        firstDimension.indexedVariables,
        2
    );
    assert.deepEqual(
        values.map(value => [
            value.name,
            value.value
        ]),
        [
            ["0", "1"],
            ["1", "2"]
        ]
    );
});
