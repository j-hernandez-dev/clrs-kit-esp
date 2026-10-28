import {
    CLRS_STANDARD_LIBRARY_NAMES
} from "../standard-library/StandardLibraryCatalog.js";
import { GUI_FUNCTION_DEFINITIONS } from "../standard-library/gui/GuiFunctionCatalog.js";

/** Reconocidos por semántica; su ejecución exige contexto/runtime GUI preparado. */
export const CLRS_GUI_STANDARD_SYMBOLS = Object.freeze(Object.keys(GUI_FUNCTION_DEFINITIONS));

/**
 * Funciones incluidas por StandartLibrary.js antes del código del usuario.
 */
export const CLRS_STANDARD_SYMBOLS =
    CLRS_STANDARD_LIBRARY_NAMES;

/**
 * Globales disponibles en el entorno JavaScript/Node.js de ejecución.
 */
export const JAVASCRIPT_GLOBAL_SYMBOLS = Object.freeze([
    "undefined",
    "NaN",
    "Infinity",
    "globalThis",
    "Object",
    "Function",
    "Boolean",
    "Symbol",
    "Error",
    "AggregateError",
    "EvalError",
    "RangeError",
    "ReferenceError",
    "SyntaxError",
    "TypeError",
    "URIError",
    "Number",
    "BigInt",
    "Math",
    "Date",
    "String",
    "RegExp",
    "Array",
    "Int8Array",
    "Uint8Array",
    "Uint8ClampedArray",
    "Int16Array",
    "Uint16Array",
    "Int32Array",
    "Uint32Array",
    "Float32Array",
    "Float64Array",
    "BigInt64Array",
    "BigUint64Array",
    "Map",
    "Set",
    "WeakMap",
    "WeakSet",
    "ArrayBuffer",
    "SharedArrayBuffer",
    "DataView",
    "Atomics",
    "JSON",
    "WeakRef",
    "FinalizationRegistry",
    "Promise",
    "Reflect",
    "Proxy",
    "Intl",
    "parseFloat",
    "parseInt",
    "isFinite",
    "isNaN",
    "decodeURI",
    "decodeURIComponent",
    "encodeURI",
    "encodeURIComponent",
    "URL",
    "URLSearchParams",
    "console",
    "setTimeout",
    "clearTimeout",
    "setInterval",
    "clearInterval",
    "queueMicrotask",
    "structuredClone",
    "process",
    "Buffer"
]);

export const DEFAULT_GLOBAL_SYMBOLS =
    Object.freeze([
        ...new Set([
            ...CLRS_STANDARD_SYMBOLS,
            ...CLRS_GUI_STANDARD_SYMBOLS,
            ...JAVASCRIPT_GLOBAL_SYMBOLS
        ])
    ]);
