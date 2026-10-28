export const dependencies =
`
// @ts-nocheck
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { readFile, stat, writeFile, appendFile, unlink } from 'fs/promises';
import { appendFileSync, readFileSync } from 'node:fs';

`

export const endProgram =
`
finishRuntimeTrace_${globalThis.ProgramKey}("correct");
process.exit(0);
} catch (error) {
finishRuntimeTrace_${globalThis.ProgramKey}(error?.clrsInputCancelled === true ? "cancelled" : "error");
printError_${globalThis.ProgramKey}(error);
process.exit(70);
}

function printError_${globalThis.ProgramKey}(error) {
    if (error?.clrsInputCancelled === true) {
        console.error("■ Ejecución cancelada durante la entrada.");
        return;
    }
    const message = runtimeErrorMessage_${globalThis.ProgramKey}(error);
    const location = error?.location ?? runtimeLocation_${globalThis.ProgramKey};
    const locationMessage = runtimeLocationMessage_${globalThis.ProgramKey}(location);

    console.error(
        \`✕ Error de ejecución\\n\\n\` +
        \`  \${message}\` +
        locationMessage
    );

    if (process.env.CLRS_DEBUG === "1") {
        const developerLocation = developerRuntimeLocation_${globalThis.ProgramKey}(location);

        console.error(
            \`\\n\\n[developer][runtime]\\n\` +
            developerLocation +
            // @ts-ignore
            \`\${error?.stack ?? String(error)}\`
        );
    }
}

function runtimeErrorMessage_${globalThis.ProgramKey}(error) {
    switch (error?.code) {
        case "ENOENT":
            return "El archivo solicitado no existe.";
        case "EACCES":
        case "EPERM":
            return "No hay permisos suficientes para completar la operación.";
    }

    switch (error?.name) {
        case "CLRSUserError":
            return String(error.message);
        case "TypeError":
            return "El programa intentó realizar una operación con un valor incompatible.";
        case "ReferenceError":
            return "El programa intentó utilizar un identificador que no está disponible.";
        case "RangeError":
            return "El programa utilizó un valor fuera del rango permitido.";
        case "SyntaxError":
            return "El programa contiene una operación que no pudo interpretarse.";
        case "URIError":
            return "El programa utilizó una dirección con formato inválido.";
        default:
            return "El programa terminó inesperadamente.";
    }
}

function runtimeLocationMessage_${globalThis.ProgramKey}(location) {
    if (location?.startLine == null) {
        return "";
    }

    const column = location.startColumn == null
        ? ""
        : \`, columna \${location.startColumn}\`;

    return \`\\n  Línea \${location.startLine}\${column}\`;
}

function developerRuntimeLocation_${globalThis.ProgramKey}(location) {
    if (location?.startLine == null) {
        return "";
    }

    const column = location.startColumn == null
        ? ""
        : \`, column \${location.startColumn}\`;

    return \`CLRS location: line \${location.startLine}\${column}\\n\`;
}
`

export const standartLibrary =
`
let runtimeLocation_${globalThis.ProgramKey} = null;
const runtimeTracePath_${globalThis.ProgramKey} = process.env.CLRS_TRACE_FILE ?? null;
const runtimeControlPath_${globalThis.ProgramKey} = process.env.CLRS_CONTROL_FILE ?? null;
const runtimeTraceLimit_${globalThis.ProgramKey} = 10000;
let runtimeTraceCount_${globalThis.ProgramKey} = 0;
let runtimeTraceTruncated_${globalThis.ProgramKey} = false;
const runtimeCoverageLimit_${globalThis.ProgramKey} = 10000;
let runtimeCoverageCount_${globalThis.ProgramKey} = 0;
let runtimeCoverageTruncated_${globalThis.ProgramKey} = false;
let runtimeControlSequence_${globalThis.ProgramKey} = 0;
let runtimeDebugBreakpoints_${globalThis.ProgramKey} = [];
const runtimeDebugHitCounts_${globalThis.ProgramKey} = new Map();
let runtimeDebugMode_${globalThis.ProgramKey} = "continue";
let runtimeDebugStepPlan_${globalThis.ProgramKey} = null;
let runtimeDebugEntryPending_${globalThis.ProgramKey} = false;
let runtimeDebugEntryConfigured_${globalThis.ProgramKey} = false;
const runtimeDebugWaitArray_${globalThis.ProgramKey} =
    new Int32Array(new SharedArrayBuffer(4));
let runtimeGlobalProvider_${globalThis.ProgramKey} = () => ({});
let runtimeGlobalLocation_${globalThis.ProgramKey} = null;
const runtimeFrames_${globalThis.ProgramKey} = [];
// Sólo el ensamblado GUI instala estos puertos internos; consola conserva su flujo.
let runtimeGuiContext_${globalThis.ProgramKey} = null;
let runtimeGuiFlow_${globalThis.ProgramKey} = null;
let runtimeGuiTerminate_${globalThis.ProgramKey} = null;
let runtimeGuiCancellation_${globalThis.ProgramKey} = null;
function getRuntimeFrames_${globalThis.ProgramKey}() {
    return runtimeGuiContext_${globalThis.ProgramKey}?.getStore()?.frames ?? runtimeFrames_${globalThis.ProgramKey};
}
function locateRuntimeError_${globalThis.ProgramKey}(error) {
    runtimeGuiFlow_${globalThis.ProgramKey}?.fail();
    if (error instanceof Error && !error.location) {
        error.location = runtimeGuiContext_${globalThis.ProgramKey}?.getStore()?.location ?? runtimeLocation_${globalThis.ProgramKey};
    }
    return error;
}
let runtimeFrameSequence_${globalThis.ProgramKey} = 1;
const runtimeStateDepthLimit_${globalThis.ProgramKey} = 4;
const runtimeStateChildLimit_${globalThis.ProgramKey} = 100;

function configureDeterministicRandom_${globalThis.ProgramKey}() {
    if (process.env.CLRS_TEST_MODE !== "1") {
        return;
    }

    const rawSeed = Number.parseInt(
        process.env.CLRS_TEST_SEED ?? "0",
        10
    );
    let randomState = Number.isFinite(rawSeed)
        ? rawSeed >>> 0
        : 0;

    Math.random = () => {
        randomState = (randomState + 0x6D2B79F5) >>> 0;
        let value = randomState;
        value = Math.imul(
            value ^ (value >>> 15),
            value | 1
        );
        value ^= value + Math.imul(
            value ^ (value >>> 7),
            value | 61
        );
        return (
            (value ^ (value >>> 14)) >>> 0
        ) / 4294967296;
    };
}

configureDeterministicRandom_${globalThis.ProgramKey}();

function writeRuntimeTrace_${globalThis.ProgramKey}(event) {
    if (runtimeTracePath_${globalThis.ProgramKey} == null) {
        return;
    }

    try {
        appendFileSync(
            runtimeTracePath_${globalThis.ProgramKey},
            JSON.stringify(event) + "\\n",
            "utf8"
        );
    } catch {
        // La traza es auxiliar y nunca debe modificar la ejecución del programa.
    }
}

function recordRuntimeExecutionFlow_${globalThis.ProgramKey}(
    kind,
    location,
    functionName,
    frame = null
) {
    if (
        runtimeTracePath_${globalThis.ProgramKey} == null
    ) {
        return;
    }

    if (
        runtimeTraceCount_${globalThis.ProgramKey} <
            runtimeTraceLimit_${globalThis.ProgramKey}
    ) {
        writeRuntimeTrace_${globalThis.ProgramKey}({
            type: "execution-flow",
            location,
            flow: {
                kind,
                contextId: 1,
                functionName,
                ...(frame ? {
                    frameId: frame.id,
                    ...(frame.parentFrameId ? {
                        parentFrameId: frame.parentFrameId
                    } : {})
                } : {})
            }
        });
        runtimeTraceCount_${globalThis.ProgramKey} += 1;
    } else if (!runtimeTraceTruncated_${globalThis.ProgramKey}) {
        runtimeTraceTruncated_${globalThis.ProgramKey} = true;
        writeRuntimeTrace_${globalThis.ProgramKey}({
            type: "truncated",
            limit: runtimeTraceLimit_${globalThis.ProgramKey}
        });
    }
}

function recordRuntimeCoverage_${globalThis.ProgramKey}(point) {
    if (
        runtimeTracePath_${globalThis.ProgramKey} == null ||
        point == null ||
        typeof point !== "object"
    ) {
        return;
    }

    if (
        runtimeCoverageCount_${globalThis.ProgramKey} <
            runtimeCoverageLimit_${globalThis.ProgramKey}
    ) {
        writeRuntimeTrace_${globalThis.ProgramKey}({
            type: "coverage",
            ...point
        });
        runtimeCoverageCount_${globalThis.ProgramKey} += 1;
        return;
    }

    if (!runtimeCoverageTruncated_${globalThis.ProgramKey}) {
        runtimeCoverageTruncated_${globalThis.ProgramKey} = true;
        writeRuntimeTrace_${globalThis.ProgramKey}({
            type: "coverage-truncated",
            limit: runtimeCoverageLimit_${globalThis.ProgramKey}
        });
    }
}

function recordRuntimeCoverageCondition_${globalThis.ProgramKey}(
    point,
    value
) {
    recordRuntimeCoverage_${globalThis.ProgramKey}({
        ...point,
        outcome: Boolean(value)
    });

    return value;
}

function finishRuntimeTrace_${globalThis.ProgramKey}(status) {
    writeRuntimeTrace_${globalThis.ProgramKey}({
        type: "end",
        status,
        ...(
            process.env.CLRS_TEST_DEBUG === "1"
                ? { awaitProcess: true }
                : {}
        )
    });
}

function readRuntimeControl_${globalThis.ProgramKey}() {
    if (runtimeControlPath_${globalThis.ProgramKey} == null) {
        return null;
    }

    try {
        const state = JSON.parse(
            readFileSync(
                runtimeControlPath_${globalThis.ProgramKey},
                "utf8"
            )
        );

        if (
            !Number.isInteger(state?.sequence) ||
            state.sequence <= runtimeControlSequence_${globalThis.ProgramKey}
        ) {
            return null;
        }

        runtimeControlSequence_${globalThis.ProgramKey} = state.sequence;
        const nextBreakpoints =
            normalizeRuntimeDebugBreakpoints_${globalThis.ProgramKey}(
                state.breakpoints
            );

        synchronizeRuntimeDebugHitCounts_${globalThis.ProgramKey}(
            runtimeDebugBreakpoints_${globalThis.ProgramKey},
            nextBreakpoints
        );
        runtimeDebugBreakpoints_${globalThis.ProgramKey} =
            nextBreakpoints;

        if (!runtimeDebugEntryConfigured_${globalThis.ProgramKey}) {
            runtimeDebugEntryConfigured_${globalThis.ProgramKey} = true;
            runtimeDebugEntryPending_${globalThis.ProgramKey} =
                state.stopOnEntry === true;
        }

        return state.command;
    } catch {
        // Una escritura concurrente se volverÃ¡ a leer en el siguiente punto.
        return null;
    }
}

function terminateRuntimeDebug_${globalThis.ProgramKey}() {
    if (runtimeGuiTerminate_${globalThis.ProgramKey}) {
        runtimeGuiCancellation_${globalThis.ProgramKey} ??= runtimeGuiTerminate_${globalThis.ProgramKey}();
        throw runtimeGuiCancellation_${globalThis.ProgramKey};
    }
    finishRuntimeTrace_${globalThis.ProgramKey}("cancelled");
    process.exit(0);
}

function registerRuntimeGlobals_${globalThis.ProgramKey}(provider) {
    if (runtimeControlPath_${globalThis.ProgramKey} == null) {
        return;
    }

    if (typeof provider === "function") {
        runtimeGlobalProvider_${globalThis.ProgramKey} = provider;
    }
}

function enterRuntimeFrame_${globalThis.ProgramKey}(
    name,
    location,
    parameterNames,
    localNames,
    provider
) {
    if (runtimeControlPath_${globalThis.ProgramKey} == null && runtimeTracePath_${globalThis.ProgramKey} == null) {
        return;
    }

    const frames = getRuntimeFrames_${globalThis.ProgramKey}();
    const parent = frames.at(-1);
    const frame = {
        id: runtimeFrameSequence_${globalThis.ProgramKey}++,
        parentFrameId: parent?.id ?? null,
        name: String(name),
        location,
        parameterNames: Array.isArray(parameterNames)
            ? parameterNames
            : [],
        localNames: Array.isArray(localNames)
            ? localNames
            : [],
        provider: typeof provider === "function"
            ? provider
            : () => ({})
    };
    frames.push(frame);
    if (runtimeGuiFlow_${globalThis.ProgramKey}) {
        runtimeGuiFlow_${globalThis.ProgramKey}.enter(frame);
    } else if (runtimeTracePath_${globalThis.ProgramKey}) {
        recordRuntimeExecutionFlow_${globalThis.ProgramKey}(
            "enter",
            frame.location,
            frame.name,
            frame
        );
    }
}

function leaveRuntimeFrame_${globalThis.ProgramKey}() {
    if (runtimeControlPath_${globalThis.ProgramKey} == null && runtimeTracePath_${globalThis.ProgramKey} == null) {
        return;
    }

    const frames = getRuntimeFrames_${globalThis.ProgramKey}();
    const frame = frames.pop();
    const parent = frames.at(-1);
    if (runtimeGuiFlow_${globalThis.ProgramKey}) {
        runtimeGuiFlow_${globalThis.ProgramKey}.leave(frame, parent);
    } else if (runtimeTracePath_${globalThis.ProgramKey} && frame) {
        recordRuntimeExecutionFlow_${globalThis.ProgramKey}(
            "return",
            parent?.location ?? frame.location,
            frame.name,
            frame
        );
    }
}

function updateRuntimeFrameLocation_${globalThis.ProgramKey}(location) {
    if (runtimeControlPath_${globalThis.ProgramKey} == null && !(runtimeGuiContext_${globalThis.ProgramKey} && runtimeTracePath_${globalThis.ProgramKey})) {
        return;
    }

    const frame = getRuntimeFrames_${globalThis.ProgramKey}().at(-1);

    if (frame) {
        frame.location = location;
    } else {
        runtimeGlobalLocation_${globalThis.ProgramKey} = location;
    }
}

function captureRuntimeState_${globalThis.ProgramKey}() {
    return {
        globalLocation: runtimeGlobalLocation_${globalThis.ProgramKey},
        globals: captureRuntimeBindings_${globalThis.ProgramKey}(
            runtimeGlobalProvider_${globalThis.ProgramKey}
        ),
        frames: getRuntimeFrames_${globalThis.ProgramKey}().map(frame => {
            const bindings = readRuntimeBindings_${globalThis.ProgramKey}(
                frame.provider
            );

            return {
                id: frame.id,
                name: frame.name,
                location: frame.location,
                parameters: captureRuntimeBindings_${globalThis.ProgramKey}(
                    () => bindings,
                    frame.parameterNames
                ),
                locals: captureRuntimeBindings_${globalThis.ProgramKey}(
                    () => bindings,
                    frame.localNames
                )
            };
        })
    };
}

function readRuntimeBindings_${globalThis.ProgramKey}(provider) {
    try {
        const bindings = provider();

        return bindings && typeof bindings === "object"
            ? bindings
            : {};
    } catch {
        return {};
    }
}

function captureRuntimeBindings_${globalThis.ProgramKey}(
    provider,
    selectedNames = null
) {
    const bindings = readRuntimeBindings_${globalThis.ProgramKey}(provider);
    const names = Array.isArray(selectedNames)
        ? selectedNames
        : Object.keys(bindings);

    return names.map(name => {
        let value;

        try {
            value = bindings[name];
        } catch {
            return {
                name,
                type: "error",
                value: "No disponible",
                children: []
            };
        }

        try {
            return {
                name,
                ...serializeRuntimeValue_${globalThis.ProgramKey}(
                    value,
                    0,
                    new WeakSet()
                )
            };
        } catch {
            return {
                name,
                type: "error",
                value: "No disponible",
                children: []
            };
        }
    });
}

function serializeRuntimeValue_${globalThis.ProgramKey}(
    value,
    depth,
    ancestors
) {
    if (value === undefined) {
        return {
            type: "indefinido",
            value: "indefinido",
            children: []
        };
    }

    if (value === null) {
        return {
            type: "nulo",
            value: "NULO",
            children: []
        };
    }

    switch (typeof value) {
        case "string":
            return {
                type: "cadena",
                value: JSON.stringify(value),
                children: []
            };
        case "number":
            return {
                type: "número",
                value: String(value),
                children: []
            };
        case "boolean":
            return {
                type: "booleano",
                value: value ? "VERDAD" : "FALSO",
                children: []
            };
        case "bigint":
            return {
                type: "entero grande",
                value: String(value),
                children: []
            };
        case "function":
            return {
                type: "función",
                value: "[función]",
                children: []
            };
        case "symbol":
            return {
                type: "símbolo",
                value: String(value),
                children: []
            };
    }

    const isArray = Array.isArray(value);
    const keys = Object.keys(value);
    const summary = isArray
        ? "Arreglo(" + String(value.length) + ")"
        : "Objeto";

    if (ancestors.has(value)) {
        return {
            type: isArray ? "arreglo" : "objeto",
            value: "↻ referencia circular",
            children: []
        };
    }

    if (depth >= runtimeStateDepthLimit_${globalThis.ProgramKey}) {
        return {
            type: isArray ? "arreglo" : "objeto",
            value: summary,
            children: []
        };
    }

    ancestors.add(value);
    const visibleKeys = keys.slice(
        0,
        runtimeStateChildLimit_${globalThis.ProgramKey}
    );
    const children = visibleKeys.map(key => {
        try {
            return {
                name: key,
                ...serializeRuntimeValue_${globalThis.ProgramKey}(
                    value[key],
                    depth + 1,
                    ancestors
                )
            };
        } catch {
            return {
                name: key,
                type: "error",
                value: "No disponible",
                children: []
            };
        }
    });

    ancestors.delete(value);

    if (keys.length > visibleKeys.length) {
        children.push({
            name: "…",
            type: "información",
            value:
                String(keys.length - visibleKeys.length) +
                " elementos más",
            children: []
        });
    }

    return {
        type: isArray ? "arreglo" : "objeto",
        value: summary,
        indexed: isArray,
        children
    };
}

function normalizeRuntimeDebugBreakpoints_${globalThis.ProgramKey}(value) {
    if (!Array.isArray(value)) {
        return [];
    }

    const result = [];
    const identifiers = new Set();

    for (const candidate of value) {
        const legacyLine = Number.isInteger(candidate)
            ? candidate
            : null;
        const line = legacyLine ?? candidate?.line;

        if (!Number.isInteger(line) || line <= 0) {
            continue;
        }

        const id = Number.isInteger(candidate?.id) && candidate.id > 0
            ? candidate.id
            : line;

        if (identifiers.has(id)) {
            continue;
        }

        identifiers.add(id);
        result.push({
            id,
            line,
            column: Number.isInteger(candidate?.column)
                ? candidate.column
                : null,
            condition: candidate?.condition ?? null,
            hitCondition: candidate?.hitCondition ?? null,
            logSegments: Array.isArray(candidate?.logSegments)
                ? candidate.logSegments
                : null
        });
    }

    return result;
}

function synchronizeRuntimeDebugHitCounts_${globalThis.ProgramKey}(
    previousBreakpoints,
    nextBreakpoints
) {
    const previousFingerprints = new Map(
        previousBreakpoints.map(breakpoint => [
            breakpoint.id,
            runtimeDebugBreakpointFingerprint_${globalThis.ProgramKey}(
                breakpoint
            )
        ])
    );
    const nextIdentifiers = new Set();

    for (const breakpoint of nextBreakpoints) {
        nextIdentifiers.add(breakpoint.id);
        const previousFingerprint =
            previousFingerprints.get(breakpoint.id);
        const nextFingerprint =
            runtimeDebugBreakpointFingerprint_${globalThis.ProgramKey}(
                breakpoint
            );

        if (
            previousFingerprint != null &&
            previousFingerprint !== nextFingerprint
        ) {
            runtimeDebugHitCounts_${globalThis.ProgramKey}
                .delete(breakpoint.id);
        }
    }

    for (const identifier of runtimeDebugHitCounts_${globalThis.ProgramKey}.keys()) {
        if (!nextIdentifiers.has(identifier)) {
            runtimeDebugHitCounts_${globalThis.ProgramKey}
                .delete(identifier);
        }
    }
}

function runtimeDebugBreakpointFingerprint_${globalThis.ProgramKey}(
    breakpoint
) {
    return JSON.stringify({
        line: breakpoint.line,
        column: breakpoint.column,
        condition: breakpoint.condition,
        hitCondition: breakpoint.hitCondition,
        logSegments: breakpoint.logSegments
    });
}

function currentRuntimeDebugBindings_${globalThis.ProgramKey}() {
    const bindings = {
        ...readRuntimeBindings_${globalThis.ProgramKey}(
            runtimeGlobalProvider_${globalThis.ProgramKey}
        )
    };

    const frame = getRuntimeFrames_${globalThis.ProgramKey}().at(-1);

    if (frame) {
        Object.assign(
            bindings,
            readRuntimeBindings_${globalThis.ProgramKey}(
                frame.provider
            )
        );
    }

    return bindings;
}

function evaluateRuntimeDebugExpression_${globalThis.ProgramKey}(
    expression,
    bindings
) {
    switch (expression?.type) {
        case "NumberLiteral":
        case "ScientificLiteral":
            return Number(expression.value);

        case "StringLiteral":
            return String(expression.value);

        case "ArrayExpression":
            return (expression.elements ?? [])
                .map(element =>
                    evaluateRuntimeDebugExpression_${globalThis.ProgramKey}(
                        element,
                        bindings
                    )
                );

        case "BooleanLiteral":
            return expression.value === true ||
                expression.value === "TRUE";

        case "NullLiteral":
            return null;

        case "Identifier":
            if (
                Object.prototype.hasOwnProperty.call(
                    bindings,
                    expression.name
                )
            ) {
                return bindings[expression.name];
            }

            throw new Error(
                "El identificador «" + expression.name +
                "» no está disponible en este ámbito."
            );

        case "Access": {
            let value =
                evaluateRuntimeDebugExpression_${globalThis.ProgramKey}(
                    {
                        type: "Identifier",
                        name: expression.name
                    },
                    bindings
                );

            for (const index of expression.indexes ?? []) {
                value = value[
                    evaluateRuntimeDebugExpression_${globalThis.ProgramKey}(
                        index,
                        bindings
                    )
                ];
            }

            return value;
        }

        case "GroupExpression":
            return evaluateRuntimeDebugExpression_${globalThis.ProgramKey}(
                expression.expression,
                bindings
            );

        case "LogicalNot":
        case "UnaryExpression": {
            const operand =
                evaluateRuntimeDebugExpression_${globalThis.ProgramKey}(
                    expression.operand,
                    bindings
                );

            switch (expression.operator) {
                case "!":
                case "Not":
                    return !operand;
                case "+":
                    return +operand;
                case "-":
                    return -operand;
                default:
                    throw new Error(
                        "El operador unario «" + expression.operator +
                        "» no está disponible en el depurador."
                    );
            }
        }

        case "LogicalExpression": {
            const left =
                evaluateRuntimeDebugExpression_${globalThis.ProgramKey}(
                    expression.left,
                    bindings
                );

            if (expression.operator === "&&") {
                return left &&
                    evaluateRuntimeDebugExpression_${globalThis.ProgramKey}(
                        expression.right,
                        bindings
                    );
            }

            if (expression.operator === "||") {
                return left ||
                    evaluateRuntimeDebugExpression_${globalThis.ProgramKey}(
                        expression.right,
                        bindings
                    );
            }

            throw new Error(
                "El operador lógico «" + expression.operator +
                "» no está disponible en el depurador."
            );
        }

        case "BinaryExpression": {
            const left =
                evaluateRuntimeDebugExpression_${globalThis.ProgramKey}(
                    expression.left,
                    bindings
                );
            const right =
                evaluateRuntimeDebugExpression_${globalThis.ProgramKey}(
                    expression.right,
                    bindings
                );

            switch (expression.operator) {
                case "+": return left + right;
                case "-": return left - right;
                case "*": return left * right;
                case "/": return left / right;
                case "%": return left % right;
                case "^": return left ** right;
                case "==": return left === right;
                case "!=": return left != right;
                case "<": return left < right;
                case "<=": return left <= right;
                case ">": return left > right;
                case ">=": return left >= right;
                default:
                    throw new Error(
                        "El operador «" + expression.operator +
                        "» no está disponible en el depurador."
                    );
            }
        }

        case "FunctionCall":
            return callRuntimeDebugFunction_${globalThis.ProgramKey}(
                expression.name,
                (expression.arguments ?? []).map(argument =>
                    evaluateRuntimeDebugExpression_${globalThis.ProgramKey}(
                        argument,
                        bindings
                    )
                )
            );

        default:
            throw new Error(
                "La expresión contiene una construcción no admitida."
            );
    }
}

function callRuntimeDebugFunction_${globalThis.ProgramKey}(name, args) {
    const first = args[0];
    const second = args[1];

    switch (name) {
        case "ABS": return Math.abs(first);
        case "MIN": return Math.min(first, second);
        case "MAX": return Math.max(first, second);
        case "REDONDEA": return Math.round(first);
        case "PISO": return Math.floor(first);
        case "RAIZ": return Math.sqrt(first);
        case "RAIZCUB": return Math.cbrt(first);
        case "EXP": return Math.exp(first);
        case "LOGN": return Math.log(first);
        case "LOG10": return Math.log10(first);
        case "LOG2": return Math.log2(first);
        case "SEN": return Math.sin(first);
        case "COS": return Math.cos(first);
        case "TAN": return Math.tan(first);
        case "ARC": return Math.asin(first);
        case "ARCOCOS": return Math.acos(first);
        case "RAD": return first * (Math.PI / 180);
        case "GRAD": return first * (180 / Math.PI);
        case "PI": return Math.PI;
        case "E": return Math.E;
        case "PROM": return first.reduce((sum, item) => sum + item, 0) / first.length;
        case "SUM": return first.reduce((sum, item) => sum + item, 0);
        case "MED": {
            const ordered = [...first].sort((left, right) => left - right);
            const middle = Math.floor(ordered.length / 2);

            return ordered.length % 2 === 0
                ? (ordered[middle - 1] + ordered[middle]) / 2
                : ordered[middle];
        }
        case "VAR": {
            const average = first.reduce((sum, item) => sum + item, 0) / first.length;

            return first.reduce(
                (sum, item) => sum + (item - average) ** 2,
                0
            ) / first.length;
        }
        case "LONG": return first.length;
        case "CAR_EN": return first.charAt(second);
        case "SUBCAD": return first.slice(second, args[2]);
        case "MAYUS": return first.toUpperCase();
        case "MINUS": return first.toLowerCase();
        case "RECORTA": return first.trim();
        case "REEMP": return first.replaceAll(second, args[2]);
        case "DIV": return first.split(second);
        case "ES_CAD_NUM": return !isNaN(first) && String(first).trim() !== "";
        case "ES_VAC": return first.length === 0;
        case "EMP_CON": return first.startsWith(second);
        case "TERM_CON": return first.endsWith(second);
        case "INDICE": return first.indexOf(second);
        case "CONT": return first.includes(second);
        case "COPIA": return first.slice();
        case "UNE": return first.join(second);
        case "ES_NUM": return typeof first === "number";
        case "ES_CAD": return typeof first === "string";
        case "ES_LOG": return typeof first === "boolean";
        case "A_CAD": return first.toString();
        case "A_NUM": return Number(first);
        case "A_LOG": return Boolean(first);
        default:
            throw new Error(
                "La función «" + name +
                "» no está disponible en expresiones de depuración."
            );
    }
}

function matchesRuntimeHitCondition_${globalThis.ProgramKey}(
    condition,
    count
) {
    if (condition == null) {
        return true;
    }

    switch (condition.operator) {
        case "=":
        case "==":
        case "===": return count === condition.value;
        case ">": return count > condition.value;
        case ">=": return count >= condition.value;
        case "<": return count < condition.value;
        case "<=": return count <= condition.value;
        case "%": return condition.value > 0 && count % condition.value === 0;
        default: return false;
    }
}

function formatRuntimeDebugValue_${globalThis.ProgramKey}(value) {
    if (value === undefined) {
        return "indefinido";
    }

    if (value === null) {
        return "NULO";
    }

    if (value === true) {
        return "VERDAD";
    }

    if (value === false) {
        return "FALSO";
    }

    if (typeof value === "string") {
        return value;
    }

    if (typeof value === "object") {
        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    }

    return String(value);
}

function renderRuntimeLogpoint_${globalThis.ProgramKey}(
    segments,
    bindings
) {
    return segments.map(segment => {
        if (segment?.type === "text") {
            return String(segment.value ?? "");
        }

        if (segment?.type !== "expression") {
            return "";
        }

        try {
            return formatRuntimeDebugValue_${globalThis.ProgramKey}(
                evaluateRuntimeDebugExpression_${globalThis.ProgramKey}(
                    segment.expression,
                    bindings
                )
            );
        } catch (error) {
            return "<error: " + String(error?.message ?? error) + ">";
        }
    }).join("");
}

function inspectRuntimeDebugBreakpoints_${globalThis.ProgramKey}(location) {
    const matching = runtimeDebugBreakpoints_${globalThis.ProgramKey}
        .filter(breakpoint => breakpoint.line === location.startLine);
    const result = {
        breakpointIds: [],
        text: null
    };

    if (matching.length === 0) {
        return result;
    }

    const bindings = currentRuntimeDebugBindings_${globalThis.ProgramKey}();

    for (const breakpoint of matching) {
        if (breakpoint.condition != null) {
            try {
                if (!evaluateRuntimeDebugExpression_${globalThis.ProgramKey}(
                    breakpoint.condition,
                    bindings
                )) {
                    continue;
                }
            } catch (error) {
                const message =
                    "No se pudo evaluar la condición del breakpoint " +
                    String(breakpoint.id) + ": " +
                    String(error?.message ?? error);

                writeRuntimeTrace_${globalThis.ProgramKey}({
                    type: "output",
                    category: "stderr",
                    output: message + "\\n",
                    location,
                    breakpointId: breakpoint.id
                });
                result.breakpointIds.push(breakpoint.id);
                result.text = message;
                continue;
            }
        }

        const hits =
            (runtimeDebugHitCounts_${globalThis.ProgramKey}.get(
                breakpoint.id
            ) ?? 0) + 1;

        runtimeDebugHitCounts_${globalThis.ProgramKey}.set(
            breakpoint.id,
            hits
        );

        if (!matchesRuntimeHitCondition_${globalThis.ProgramKey}(
            breakpoint.hitCondition,
            hits
        )) {
            continue;
        }

        if (Array.isArray(breakpoint.logSegments)) {
            writeRuntimeTrace_${globalThis.ProgramKey}({
                type: "output",
                category: "console",
                output:
                    renderRuntimeLogpoint_${globalThis.ProgramKey}(
                        breakpoint.logSegments,
                        bindings
                    ) + "\\n",
                location,
                breakpointId: breakpoint.id
            });
            continue;
        }

        result.breakpointIds.push(breakpoint.id);
    }

    return result;
}

function createRuntimeStepPlan_${globalThis.ProgramKey}(mode) {
    const frame = getRuntimeFrames_${globalThis.ProgramKey}().at(-1);

    return {
        mode,
        originDepth: getRuntimeFrames_${globalThis.ProgramKey}().length,
        context: runtimeGuiContext_${globalThis.ProgramKey}?.getStore() ?? null,
        originFrameId: frame?.id ?? null
    };
}

function shouldStopRuntimeStep_${globalThis.ProgramKey}() {
    const plan = runtimeDebugStepPlan_${globalThis.ProgramKey};

    if (plan == null) {
        return false;
    }

    const depth = getRuntimeFrames_${globalThis.ProgramKey}().length;
    const frame = getRuntimeFrames_${globalThis.ProgramKey}().at(-1);

    if (plan.mode === "stepIn") {
        return true;
    }

    // Desde la espera GUI, el siguiente paso sólo puede ser una instrucción de
    // un callback nuevo. No fabricar pasos sobre ticks internos de GTK.
    if (runtimeGuiContext_${globalThis.ProgramKey} && plan.originDepth === 0) { return depth > 0; }

    if (plan.context !== (runtimeGuiContext_${globalThis.ProgramKey}?.getStore() ?? null)) { return false; }

    if (plan.mode === "stepOver") {
        return depth < plan.originDepth ||
            (
                depth === plan.originDepth &&
                (frame?.id ?? null) === plan.originFrameId
            );
    }

    if (plan.mode === "stepOut") {
        return plan.originDepth > 0 &&
            depth < plan.originDepth;
    }

    return false;
}

function waitForRuntimeDebug_${globalThis.ProgramKey}(
    reason,
    location,
    details = {}
) {
    writeRuntimeTrace_${globalThis.ProgramKey}({
        type: "stopped",
        reason,
        location,
        state: captureRuntimeState_${globalThis.ProgramKey}(),
        ...(details.breakpointIds?.length > 0
            ? { breakpointIds: details.breakpointIds }
            : {}),
        ...(details.text
            ? { text: details.text }
            : {})
    });

    while (true) {
        Atomics.wait(
            runtimeDebugWaitArray_${globalThis.ProgramKey},
            0,
            0,
            25
        );

        const command =
            readRuntimeControl_${globalThis.ProgramKey}();

        if (command === "terminate") {
            terminateRuntimeDebug_${globalThis.ProgramKey}();
        }

        if (
            command === "continue" ||
            command === "next" ||
            command === "stepIn" ||
            command === "stepOver" ||
            command === "stepOut"
        ) {
            const mode = command === "next"
                ? "stepOver"
                : command;

            runtimeDebugMode_${globalThis.ProgramKey} = mode;
            runtimeDebugStepPlan_${globalThis.ProgramKey} =
                mode === "continue"
                    ? null
                    : createRuntimeStepPlan_${globalThis.ProgramKey}(mode);
            writeRuntimeTrace_${globalThis.ProgramKey}({
                type: "continued"
            });
            return;
        }
    }
}

function handleRuntimeDebug_${globalThis.ProgramKey}(location, idle = false) {
    if (runtimeGuiCancellation_${globalThis.ProgramKey}) { throw runtimeGuiCancellation_${globalThis.ProgramKey}; }
    if (runtimeControlPath_${globalThis.ProgramKey} == null) {
        return;
    }

    const command =
        readRuntimeControl_${globalThis.ProgramKey}();

    if (command === "terminate") {
        terminateRuntimeDebug_${globalThis.ProgramKey}();
    }

    if (command === "pause") {
        runtimeDebugMode_${globalThis.ProgramKey} = "pause";
    } else if (
        command === "continue" ||
        command === "next" ||
        command === "stepIn" ||
        command === "stepOver" ||
        command === "stepOut"
    ) {
        const mode = command === "next"
            ? "stepOver"
            : command;

        runtimeDebugMode_${globalThis.ProgramKey} = mode;
        runtimeDebugStepPlan_${globalThis.ProgramKey} =
            mode === "continue"
                ? null
                : createRuntimeStepPlan_${globalThis.ProgramKey}(mode);
    }

    let reason = null;
    let details = {};

    if (runtimeDebugEntryPending_${globalThis.ProgramKey} && !idle) {
        runtimeDebugEntryPending_${globalThis.ProgramKey} = false;
        reason = "entry";
    } else if (runtimeDebugMode_${globalThis.ProgramKey} === "pause") {
        reason = "pause";
    } else if (!idle) {
        const breakpointResult =
            inspectRuntimeDebugBreakpoints_${globalThis.ProgramKey}(
                location
            );

        if (breakpointResult.breakpointIds.length > 0) {
            reason = "breakpoint";
            details = breakpointResult;
        } else if (shouldStopRuntimeStep_${globalThis.ProgramKey}()) {
            reason = "step";
        }
    } else if (getRuntimeFrames_${globalThis.ProgramKey}().length === 0 &&
        runtimeDebugStepPlan_${globalThis.ProgramKey}?.originDepth > 0 && shouldStopRuntimeStep_${globalThis.ProgramKey}()) {
        reason = "step";
    }

    if (reason != null) {
        if (idle) { details.text = "Esperando eventos GUI; no hay una nueva instrucción CLRS en ejecución."; }
        runtimeDebugMode_${globalThis.ProgramKey} = "stopped";
        runtimeDebugStepPlan_${globalThis.ProgramKey} = null;
        waitForRuntimeDebug_${globalThis.ProgramKey}(
            reason,
            location,
            details
        );
    }
}

function setRuntimeLocation_${globalThis.ProgramKey}(
    startLine,
    startColumn,
    endLine,
    endColumn,
    debug = true
) {
    runtimeLocation_${globalThis.ProgramKey} = {
        startLine,
        startColumn,
        endLine,
        endColumn
    };
    const guiContext = runtimeGuiContext_${globalThis.ProgramKey}?.getStore();
    if (guiContext) { guiContext.location = runtimeLocation_${globalThis.ProgramKey}; }
    updateRuntimeFrameLocation_${globalThis.ProgramKey}(
        runtimeLocation_${globalThis.ProgramKey}
    );

    if (
        runtimeTraceCount_${globalThis.ProgramKey} <
            runtimeTraceLimit_${globalThis.ProgramKey}
    ) {
        writeRuntimeTrace_${globalThis.ProgramKey}({
            type: "location",
            location: runtimeLocation_${globalThis.ProgramKey},
            ...(runtimeGuiFlow_${globalThis.ProgramKey} ? { flow: runtimeGuiFlow_${globalThis.ProgramKey}.describe("statement") } : {})
        });
        runtimeTraceCount_${globalThis.ProgramKey} += 1;
    } else if (!runtimeTraceTruncated_${globalThis.ProgramKey}) {
        runtimeTraceTruncated_${globalThis.ProgramKey} = true;
        writeRuntimeTrace_${globalThis.ProgramKey}({
            type: "truncated",
            limit: runtimeTraceLimit_${globalThis.ProgramKey}
        });
    }

    if (debug !== false) {
        handleRuntimeDebug_${globalThis.ProgramKey}(
            runtimeLocation_${globalThis.ProgramKey}
        );
    }
}

writeRuntimeTrace_${globalThis.ProgramKey}({ type: "start" });

try {

    function cre_array_${globalThis.ProgramKey}(array, dimensions, size = 1) {
        try {
            array[0];
            if(typeof array === "string"
                || typeof array === "number" 
                || typeof array === "boolean") {throw new Error("");}
            return array;
        } catch (error) {
            if (dimensions <= 0) {
                return undefined;
            }

            const arr = new Array();

            return new Proxy(arr, {

                get(target, prop) {

                    if (isIndex_${globalThis.ProgramKey}(prop)) {

                        const index = Number(prop);

                        if (target[index] === undefined) {
                            target[index] = cre_array_${globalThis.ProgramKey}(dimensions - 1, size);
                        }

                        return target[index];
                    }

                    return target[prop];
                },

                set(target, prop, value) {

                    if (isIndex_${globalThis.ProgramKey}(prop)) {
                        const index = Number(prop);

                        if (target[index] === undefined) {
                            target[index] = cre_array_${globalThis.ProgramKey}(dimensions - 1, size);
                        }

                        target[index] = value;
                        return true;
                    }

                    target[prop] = value;
                    return true;
                }
            });
        }
    }

function isIndex_${globalThis.ProgramKey}(prop) {
    return typeof prop === "string" && /^[0-9]+$/.test(prop);
}

// INPUT

let automatedInputLines_${globalThis.ProgramKey} = null;
let automatedInputIndex_${globalThis.ProgramKey} = 0;

function readAutomatedInputLines_${globalThis.ProgramKey}() {
    if (automatedInputLines_${globalThis.ProgramKey} == null) {
        const inputFile =
            process.env.CLRS_TEST_INPUT_FILE;

        automatedInputLines_${globalThis.ProgramKey} =
            typeof inputFile === "string" &&
            inputFile.length > 0
                ? Promise.resolve(
                    readFileSync(
                        inputFile,
                        "utf8"
                    ).split(/\\r\\n|\\r|\\n/u)
                )
                : new Promise((resolve, reject) => {
                    let received = "";

                    input.setEncoding("utf8");
                    input.on("data", chunk => {
                        received += chunk;
                    });
                    input.once("end", () => {
                        resolve(
                            received.split(/\\r\\n|\\r|\\n/u)
                        );
                    });
                    input.once("error", reject);
                });
    }

    return automatedInputLines_${globalThis.ProgramKey};
}

async function inputData_${globalThis.ProgramKey}() {
    const automated = process.env.CLRS_TEST_MODE === "1";

    if (automated) {
        const lines = await readAutomatedInputLines_${globalThis.ProgramKey}();
        const answer = lines[
            automatedInputIndex_${globalThis.ProgramKey}
        ] ?? "";

        automatedInputIndex_${globalThis.ProgramKey} += 1;
        return answer;
    }

    const rl = createInterface({ input, output });
    try {
        return await rl.question("> ");
    } catch (error) {
        if (error?.name === "AbortError" && error?.message === "Aborted with Ctrl+C") {
            error.clrsInputCancelled = true;
        }
        throw error;
    } finally {
        rl.close();
    }
}


// FILES

async function LEER_ARCHIVO(ruta) {
    try {
        return await readFile(ruta, 'utf8');
    } catch (err) {
        if (err.code === 'ENOENT') {
            return "";
        }
        throw err;
    }
}

async function EXISTE_ARCHIVO(ruta) {
    try {
        return (await stat(ruta)).isFile();
    } catch {
        return false;
    }
}

async function PESO_ARCHIVO(ruta) {
    try {
        return (await stat(ruta)).size;
    } catch (err) {
        if (err.code === 'ENOENT') {
            return 0;
        }
        throw err;
    }
}

async function CREAR_ARCHIVO(ruta) {
    await writeFile(ruta, "");
}

async function ESCRIBIR_ARCHIVO(ruta, contenido) {
    await appendFile(ruta, contenido, "utf8");
}

async function ELIMINAR_ARCHIVO(ruta) {
    try {
        await unlink(ruta);
    } catch (err) {
        if (err.code !== "ENOENT") {
            throw err;
        }
    }
}

// MATH

async function ABS(x) {
    return Math.abs(x);
}

async function MIN(a, b) {
    return Math.min(a, b);
}

async function MAX(a, b) {
    return Math.max(a, b);
}

async function REDONDEA(decimal) {
    return Math.round(decimal);
}

async function PISO(decimal) {
    return Math.floor(decimal);
}

async function RAIZ(x) {
    return Math.sqrt(x);
}

async function RAIZCUB(x) {
    return Math.cbrt(x);
}

async function EXP(x) {
    return Math.exp(x);
}

async function LOGN(x) {
    return Math.log(x);
}

async function LOG10(x) {
    return Math.log10(x);
}

async function LOG2(x) {
    return Math.log2(x);
}

async function SEN(x) {
    return Math.sin(x);
}

async function COS(x) {
    return Math.cos(x);
}

async function TAN(x) {
    return Math.tan(x);
}

async function ARC(x) {
    return Math.asin(x);
}

async function ARCOCOS(x) {
    return Math.acos(x);
}

async function RAD(x) {
    return x * (Math.PI / 180);
}

async function GRAD(x) {
    return x * (180 / Math.PI);
}

async function PI() {
    return Math.PI;
}

async function E() {
    return Math.E;
}

async function ALEAT(min, max) {
    if (min === undefined || max === undefined) {
        return Math.random();
    }
    return Math.random() * (max - min) + min;
}

async function PROM(x) {
    const suma = await SUMATORIA(x);
    return suma / x.length;
}

async function SUM(x) {
    return x.reduce((acc, val) => acc + val, 0);
}

async function MED(x) {
    const sorted = [...x].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
        return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
}

async function VAR(x) {
    const prom = await PROM(x);
    return PROM(x.map(v => (v - prom) ** 2));
}

// STRINGS

async function LONG(estructura) {
    return estructura.length;
}

async function CAR_EN(cadena, posicion) {
    return cadena.charAt(posicion);
}

async function SUBCAD(cadena, inicio, fin) {
    return cadena.slice(inicio, fin);
}

async function MAYUS(cadena) {
    return cadena.toUpperCase();
}

async function MINUS(cadena) {
    return cadena.toLowerCase();
}

async function RECORTA(cadena) {
    return cadena.trim();
}

async function REEMP(cadena, viejo, nuevo) {
    return cadena.replaceAll(viejo, nuevo);
}

async function DIV(cadena, separador) {
    return cadena.split(separador);
}

async function ES_CAD_NUM(cadena) {
    return !isNaN(cadena) && String(cadena).trim() !== "";
}

async function ES_VAC(cadena) {
    return cadena.length === 0;
}

async function EMP_CON(cadena, texto) {
    return cadena.startsWith(texto);
}

async function TERM_CON(cadena, texto) {
    return cadena.endsWith(texto);
}

// ARRAY

async function AGREGA(arreglo, valor) {
    arreglo.push(valor);
    return arreglo;
}

function ELIM(arreglo, indice) {
    arreglo.splice(indice, 1);
    return arreglo;
}

function INSER(arreglo, indice, valor) {
    arreglo.splice(indice, 0, valor);
    return arreglo;
}

function INDICE(arreglo, valor) {
    return arreglo.indexOf(valor);
}

function CONT(arreglo, valor) {
    return arreglo.includes(valor);
}

function ORDENA(arreglo) {
    arreglo.sort((a, b) => {
        if (typeof a === "number" && typeof b === "number") {
            return a - b;
        }

        return String(a).localeCompare(String(b));
    });

    return arreglo;
}

async function INVER(arreglo) {
    return arreglo.reverse();
}

async function COPIA(arreglo) {
    return arreglo.slice();
}

async function UNE(arreglo, separador) {
    return arreglo.join(separador);
}

// TYPES

async function ES_NUM(valor) {
    return typeof valor === "number";
}

async function ES_CAD(valor) {
    return typeof valor === "string";
}

async function ES_LOG(valor) {
    return typeof valor === "boolean";
}

async function A_CAD(valor) {
    return valor.toString();
}

async function A_NUM(valor) {
    return Number(valor);
}

async function A_LOG(valor) {
    return Boolean(valor);
}

// ERROR

async function LANZAR_ERROR(mensaje) {
    const error = new Error(mensaje);
    error.name = "CLRSUserError";
    throw error;
}
`
