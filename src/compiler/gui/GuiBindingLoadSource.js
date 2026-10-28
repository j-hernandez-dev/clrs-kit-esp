import { getGuiEnvironmentSource } from "../../standard-library/gui/runtime/GuiEnvironmentProbe.js";
import { GUI_ERROR_MESSAGES } from "../../standard-library/gui/GuiErrors.js";

const START_MARKER = "/* CLRS_GUI_BINDING_LOAD:v1:start */";
const END_MARKER = "/* CLRS_GUI_BINDING_LOAD:v1:end */";
const PACKAGED_LOADER_PROPERTY = "__CLRS_PACKAGED_NODE_GTK_LOADER__";
const BINDING_DECLARATION = "let $clrs$gui$binding;";
const MODULE_IMPORTS_START_MARKER = "/* CLRS_GUI_MODULE_IMPORTS:v1:start */";
const MODULE_IMPORTS_END_MARKER = "/* CLRS_GUI_MODULE_IMPORTS:v1:end */";

/** Protocolo interno estable entre el generador normal y el preparador packable. */
export const GUI_BINDING_LOAD_PROTOCOL = Object.freeze({
    version: 1,
    startMarker: START_MARKER,
    endMarker: END_MARKER,
    packagedLoaderProperty: PACKAGED_LOADER_PROPERTY,
    bindingDeclaration: BINDING_DECLARATION,
    moduleImportsStartMarker: MODULE_IMPORTS_START_MARKER,
    moduleImportsEndMarker: MODULE_IMPORTS_END_MARKER
});

/** Genera la única región autorizada para resolver y cargar node-gtk con Node normal. */
export function createGuiBindingLoadSource({ moduleSpecifier, capabilities }) {
    if (typeof moduleSpecifier !== "string" || moduleSpecifier.length === 0 || !Array.isArray(capabilities)) {
        throw new TypeError("La carga GUI requiere un módulo y capacidades estructuradas.");
    }
    return `${getGuiEnvironmentSource()}
let $clrs$gui$url;
${BINDING_DECLARATION}
${START_MARKER}
try { $clrs$gui$url = import.meta.resolve(${JSON.stringify(moduleSpecifier)}); }
catch (cause) {
    const error = new Error("[CLRS_GUI_DEP_RESOLUTION_FAILED] " + guiEnvironmentMessage("CLRS_GUI_DEP_RESOLUTION_FAILED", ${JSON.stringify(GUI_ERROR_MESSAGES)}, process.platform));
    error.name = "CLRSUserError"; error.code = "CLRS_GUI_DEP_RESOLUTION_FAILED"; error.cause = cause; throw error;
}
await checkGuiEnvironmentIsolated($clrs$gui$url, ${JSON.stringify(capabilities)}, ${JSON.stringify(GUI_ERROR_MESSAGES)});
await configureGuiPrivateEnvironment($clrs$gui$url);
$clrs$gui$binding = await import($clrs$gui$url);
${END_MARKER}`;
}

/**
 * Deriva la variante de construcción sin modificar el source normal. La
 * variante pertenece exclusivamente al bootstrap: no conserva operaciones ESM
 * incompatibles con el contexto vm de pkg.
 */
export function createPackableGuiJavaScript(source) {
    try {
        return transformPackableGuiJavaScript(source, GUI_BINDING_LOAD_PROTOCOL);
    } catch (cause) {
        if (cause?.name === "GuiPackableSourceError" && typeof cause.reason === "string") {
            throw new GuiPackableSourceError(cause.reason, cause);
        }
        throw cause;
    }
}

export class GuiPackableSourceError extends Error {
    constructor(reason, cause) {
        const messages = {
            INVALID_SOURCE: "La fuente GUI que se preparará debe ser texto.",
            INVALID_PROTOCOL: "El protocolo de adaptación GUI no es válido.",
            ALREADY_ADAPTED: "La fuente GUI ya contiene el loader empaquetado.",
            INVALID_REGION: "La fuente GUI no contiene exactamente una región de carga compatible.",
            INVALID_BINDING: "La fuente GUI no contiene una única declaración canónica del binding.",
            INVALID_RESULT: "La adaptación GUI produjo una variante empaquetable inválida."
        };
        super(messages[reason]);
        this.name = "GuiPackableSourceError";
        this.code = `CLRS_GUI_PACKABLE_${reason}`;
        this.reason = reason;
        if (cause) { this.cause = cause; }
    }
}

/** Núcleo autocontenido: se serializa sin dependencias dentro de prepare-packable.cjs. */
export function transformPackableGuiJavaScript(source, protocol) {
    const messages = {
        INVALID_SOURCE: "La fuente GUI que se preparará debe ser texto.",
        INVALID_PROTOCOL: "El protocolo de adaptación GUI no es válido.",
        ALREADY_ADAPTED: "La fuente GUI ya contiene el loader empaquetado.",
        INVALID_REGION: "La fuente GUI no contiene exactamente una región de carga compatible.",
        INVALID_BINDING: "La fuente GUI no contiene una única declaración canónica del binding.",
        INVALID_RESULT: "La adaptación GUI produjo una variante empaquetable inválida."
    };
    const fail = reason => {
        const error = new Error(messages[reason]);
        error.name = "GuiPackableSourceError";
        error.code = `CLRS_GUI_PACKABLE_${reason}`;
        error.reason = reason;
        throw error;
    };
    if (typeof source !== "string") { fail("INVALID_SOURCE"); }
    if (!protocol || typeof protocol !== "object" || !Number.isInteger(protocol.version)
        || typeof protocol.startMarker !== "string" || typeof protocol.endMarker !== "string"
        || typeof protocol.packagedLoaderProperty !== "string" || typeof protocol.bindingDeclaration !== "string"
        || typeof protocol.moduleImportsStartMarker !== "string"
        || typeof protocol.moduleImportsEndMarker !== "string") {
        fail("INVALID_PROTOCOL");
    }
    const packagedLoaderDeclaration = `const $clrs$gui$packagedLoader = globalThis.${protocol.packagedLoaderProperty};`;
    const markerLines = (lines, marker) => lines.flatMap((line, index) =>
        line.replace(/\r$/u, "") === marker ? [index] : []);
    const countExactLines = (lines, expected) => markerLines(lines, expected).length;
    const lineEnding = source.includes("\r\n") ? "\r\n" : "\n";
    const lines = source.split(/\r?\n/u);
    if (countExactLines(lines, packagedLoaderDeclaration) !== 0) { fail("ALREADY_ADAPTED"); }
    const starts = markerLines(lines, protocol.startMarker);
    const ends = markerLines(lines, protocol.endMarker);
    const moduleStarts = markerLines(lines, protocol.moduleImportsStartMarker);
    const moduleEnds = markerLines(lines, protocol.moduleImportsEndMarker);
    if (starts.length !== 1 || ends.length !== 1 || starts[0] >= ends[0]
        || moduleStarts.length !== 1 || moduleEnds.length !== 1 || moduleStarts[0] >= moduleEnds[0]
        || moduleEnds[0] >= starts[0]) { fail("INVALID_REGION"); }
    if (countExactLines(lines, protocol.bindingDeclaration) !== 1) { fail("INVALID_BINDING"); }
    const moduleStart = moduleStarts[0], moduleEnd = moduleEnds[0];
    const commonJsImports = [
        protocol.moduleImportsStartMarker,
        "const { createInterface } = require(\"node:readline/promises\");",
        "const { stdin: input, stdout: output } = require(\"node:process\");",
        "const { readFile, stat, writeFile, appendFile, unlink } = require(\"node:fs/promises\");",
        "const { appendFileSync, readFileSync } = require(\"node:fs\");",
        "const { randomUUID: $clrs$gui$executionKey } = require(\"node:crypto\");",
        "const { AsyncLocalStorage: $clrs$gui$AsyncLocalStorage } = require(\"node:async_hooks\");",
        protocol.moduleImportsEndMarker
    ];
    const withCommonJs = [...lines.slice(0, moduleStart), ...commonJsImports, ...lines.slice(moduleEnd + 1)];
    const removedModuleLines = moduleEnd - moduleStart + 1;
    const start = starts[0] - removedModuleLines + commonJsImports.length;
    const end = ends[0] - removedModuleLines + commonJsImports.length;
    const replacement = [
        protocol.startMarker,
        packagedLoaderDeclaration,
        "if (typeof $clrs$gui$packagedLoader !== \"function\") {",
        "    const error = new Error(\"[CLRS_GUI_PACKAGED_LOADER_MISSING] El bootstrap portable no registró el loader de node-gtk.\");",
        "    error.name = \"CLRSUserError\"; error.code = \"CLRS_GUI_PACKAGED_LOADER_MISSING\"; throw error;",
        "}",
        "$clrs$gui$binding = await $clrs$gui$packagedLoader();",
        protocol.endMarker
    ];
    const result = [...withCommonJs.slice(0, start), ...replacement, ...withCommonJs.slice(end + 1)].join(lineEnding);
    const resultLines = result.split(/\r?\n/u);
    if (markerLines(resultLines, protocol.startMarker).length !== 1
        || markerLines(resultLines, protocol.endMarker).length !== 1
        || markerLines(resultLines, protocol.moduleImportsStartMarker).length !== 1
        || markerLines(resultLines, protocol.moduleImportsEndMarker).length !== 1
        || countExactLines(resultLines, protocol.bindingDeclaration) !== 1
        || countExactLines(resultLines, packagedLoaderDeclaration) !== 1) { fail("INVALID_RESULT"); }
    return result;
}
