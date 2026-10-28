import { GUI_BINDING_LOAD_PROTOCOL, transformPackableGuiJavaScript } from "../gui/GuiBindingLoadSource.js";
import { PORTABLE_PACKAGING_CONTRACT } from "./PortablePackagingContract.js";

export const PACKABLE_SUPPORTED_PLATFORMS = PORTABLE_PACKAGING_CONTRACT.supportedPlatforms;

/** Genera el helper CJS autocontenido que deriva <programa>.packable.js. */
export function createPackablePreparationScript(identity) {
    const descriptor = validateIdentity(identity);
    const protocol = Object.freeze({ ...GUI_BINDING_LOAD_PROTOCOL });
    return `"use strict";
const fs = require("node:fs");
const path = require("node:path");
const descriptor = Object.freeze(${JSON.stringify(descriptor)});
const protocol = Object.freeze(${JSON.stringify(protocol)});
const supportedPlatforms = new Set(${JSON.stringify(PACKABLE_SUPPORTED_PLATFORMS)});
const transformPackableGuiJavaScript = (${transformPackableGuiJavaScript.toString()});

function failure(code, message, cause) {
    const error = new Error("[" + code + "] " + message);
    error.name = "CLRSPackablePreparationError";
    error.code = code;
    if (cause) { error.cause = cause; }
    return error;
}

function localFile(base, fileName) {
    const candidate = path.resolve(base, fileName);
    if (path.dirname(candidate) !== base || path.basename(candidate) !== fileName) {
        throw failure("CLRS_GUI_PACKABLE_INVALID_PATH", "La ruta de construcción no pertenece al proyecto exportado.");
    }
    return candidate;
}

function requireRegularFile(filePath, label) {
    let stat;
    try { stat = fs.lstatSync(filePath); }
    catch (cause) { throw failure("CLRS_GUI_PACKABLE_SOURCE_NOT_FOUND", "No se encontró " + label + ".", cause); }
    if (!stat.isFile() || stat.isSymbolicLink()) {
        throw failure("CLRS_GUI_PACKABLE_INVALID_PATH", label + " debe ser un archivo regular dentro del proyecto.");
    }
}

function preparePackable(options = {}) {
    const platform = options.platform ?? process.platform;
    if (!supportedPlatforms.has(platform)) {
        throw failure("CLRS_GUI_PACKABLE_UNSUPPORTED_PLATFORM", "La plataforma " + platform + " no está contemplada para este build.");
    }
    const base = path.resolve(__dirname);
    const sourcePath = localFile(base, descriptor.sourceFile);
    const packablePath = localFile(base, descriptor.packableFile);
    requireRegularFile(sourcePath, descriptor.sourceFile);
    try {
        const current = fs.lstatSync(packablePath);
        if (!current.isFile() || current.isSymbolicLink()) {
            throw failure("CLRS_GUI_PACKABLE_INVALID_PATH", descriptor.packableFile + " debe ser un archivo regular dentro del proyecto.");
        }
    } catch (cause) {
        if (cause?.code !== "ENOENT") { throw cause; }
    }
    const sourceBefore = fs.readFileSync(sourcePath, "utf8");
    let packable;
    try { packable = transformPackableGuiJavaScript(sourceBefore, protocol); }
    catch (cause) {
        if (cause?.name === "GuiPackableSourceError") {
            throw failure(cause.code, cause.message, cause);
        }
        throw failure("CLRS_GUI_PACKABLE_TRANSFORM_FAILED", "No fue posible adaptar el JavaScript GUI.", cause);
    }
    const sourceAfter = fs.readFileSync(sourcePath, "utf8");
    if (sourceAfter !== sourceBefore) {
        throw failure("CLRS_GUI_PACKABLE_SOURCE_CHANGED", "El JavaScript fuente cambió durante la preparación; no se escribió la variante.");
    }
    try {
        fs.writeFileSync(packablePath, packable, { encoding: "utf8" });
        if (fs.readFileSync(packablePath, "utf8") !== packable) {
            throw new Error("La verificación de escritura no coincide.");
        }
    } catch (cause) {
        throw failure("CLRS_GUI_PACKABLE_WRITE_FAILED", "No fue posible escribir " + descriptor.packableFile + ".", cause);
    }
    return packablePath;
}

module.exports = Object.freeze({ preparePackable });
if (require.main === module) {
    try {
        const output = preparePackable();
        process.stdout.write("Variante empaquetable generada: " + output + "\\n");
    } catch (error) {
        process.stderr.write(String(error?.message ?? error) + "\\n");
        process.exitCode = 1;
    }
}
`;
}

export function assertPackablePlatform(platform) {
    if (!PACKABLE_SUPPORTED_PLATFORMS.includes(platform)) {
        const error = new Error(`La plataforma ${platform} no está contemplada para este build.`);
        error.code = "CLRS_GUI_PACKABLE_UNSUPPORTED_PLATFORM";
        throw error;
    }
    return platform;
}

function validateIdentity(identity) {
    const values = { sourceFile: identity?.entryFile, packableFile: identity?.packableFile };
    for (const [field, value] of Object.entries(values)) {
        if (typeof value !== "string" || value.length === 0 || value === "." || value === ".."
            || /[\\/\0]/u.test(value)) {
            throw new TypeError(`La identidad del proyecto contiene un ${field} no seguro.`);
        }
    }
    if (!values.sourceFile.endsWith(".js") || values.packableFile !== values.sourceFile.replace(/\.js$/u, ".packable.js")) {
        throw new TypeError("La identidad del proyecto no define archivos JavaScript compatibles.");
    }
    return Object.freeze(values);
}
