import { NODE_GTK_RUNTIME_DEPENDENCY } from "../../standard-library/gui/GuiContract.js";
import { GUI_BINDING_LOAD_PROTOCOL } from "../gui/GuiBindingLoadSource.js";
import { PACKABLE_SUPPORTED_PLATFORMS } from "./PackablePreparationScriptBuilder.js";

/** Genera el entrypoint CJS que materializa GTK antes de iniciar la variante packable. */
export function createBootstrapScript(identity) {
    const descriptor = validateIdentity(identity);
    return `"use strict";
const fs = require("node:fs");
const path = require("node:path");
const descriptor = Object.freeze(${JSON.stringify(descriptor)});
const supportedPlatforms = new Set(${JSON.stringify(PACKABLE_SUPPORTED_PLATFORMS)});
const loaderProperty = ${JSON.stringify(GUI_BINDING_LOAD_PROTOCOL.packagedLoaderProperty)};
const markerSchemaVersion = 1;

function failure(code, message, cause) {
    const error = new Error("[" + code + "] [" + descriptor.projectId + "] " + message);
    error.name = "CLRSPortableBootstrapError";
    error.code = code;
    if (cause) { error.cause = cause; }
    return error;
}

function isInside(root, candidate) {
    const relative = path.relative(root, candidate);
    return relative === "" || (!relative.startsWith(".." + path.sep) && relative !== ".." && !path.isAbsolute(relative));
}

function checkedChild(root, ...segments) {
    const candidate = path.resolve(root, ...segments);
    if (!isInside(path.resolve(root), candidate)) {
        throw failure("CLRS_GUI_BOOTSTRAP_INVALID_PATH", "Una ruta del runtime escaparía de su directorio administrado.");
    }
    return candidate;
}

function safeStat(target) {
    try { return fs.lstatSync(target); }
    catch (cause) {
        if (cause?.code === "ENOENT") { return null; }
        throw cause;
    }
}

function requirePlainDirectory(target, label) {
    const stat = safeStat(target);
    if (!stat || !stat.isDirectory() || stat.isSymbolicLink()) {
        throw failure("CLRS_GUI_BOOTSTRAP_RUNTIME_SOURCE_INVALID", label + " debe ser un directorio físico regular.");
    }
}

function requirePlainFile(target, label) {
    const stat = safeStat(target);
    if (!stat || !stat.isFile() || stat.isSymbolicLink()) {
        throw failure("CLRS_GUI_BOOTSTRAP_RUNTIME_SOURCE_INVALID", label + " debe ser un archivo físico regular.");
    }
}

function bindingIdentity(processObject) {
    const platform = processObject.platform;
    const arch = processObject.arch;
    const modules = processObject.versions?.modules;
    if (!supportedPlatforms.has(platform)) {
        throw failure("CLRS_GUI_BOOTSTRAP_UNSUPPORTED_PLATFORM", "La plataforma " + platform + " no está contemplada para este ejecutable.");
    }
    if (typeof arch !== "string" || !/^[a-z0-9_-]+$/iu.test(arch)
        || typeof modules !== "string" || !/^[0-9]+$/u.test(modules)) {
        throw failure("CLRS_GUI_BOOTSTRAP_INVALID_ABI", "No fue posible determinar ABI y arquitectura de Node.js.");
    }
    return Object.freeze({ platform, arch, modules, bindingName: "node-v" + modules + "-" + platform + "-" + arch });
}

function dependencyRoot(options) {
    let packageJsonPath;
    try { packageJsonPath = options.packageJsonPath ?? require.resolve("node-gtk/package.json"); }
    catch (cause) {
        throw failure("CLRS_GUI_BOOTSTRAP_DEPENDENCY_NOT_FOUND", "No se encontró node-gtk dentro del ejecutable.", cause);
    }
    requirePlainFile(packageJsonPath, "node-gtk/package.json");
    let manifest;
    try { manifest = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")); }
    catch (cause) {
        throw failure("CLRS_GUI_BOOTSTRAP_DEPENDENCY_INVALID", "El manifiesto empaquetado de node-gtk no es válido.", cause);
    }
    if (manifest.name !== descriptor.dependencyName || manifest.version !== descriptor.dependencyVersion) {
        throw failure("CLRS_GUI_BOOTSTRAP_DEPENDENCY_INVALID",
            "Se esperaba " + descriptor.dependencyName + "@" + descriptor.dependencyVersion + ".");
    }
    return path.dirname(path.resolve(packageJsonPath));
}

function markerContent(bindingName) {
    return JSON.stringify({ schemaVersion: markerSchemaVersion, projectId: descriptor.projectId,
        dependency: descriptor.dependencyName, version: descriptor.dependencyVersion, bindingName });
}

function runtimeIsReusable(runtimeDirectory, bindingName) {
    const runtimeStat = safeStat(runtimeDirectory);
    if (!runtimeStat) { return false; }
    if (!runtimeStat.isDirectory() || runtimeStat.isSymbolicLink()) {
        throw failure("CLRS_GUI_BOOTSTRAP_RUNTIME_TARGET_INVALID", "El destino del runtime no es un directorio administrable.");
    }
    const addon = checkedChild(runtimeDirectory, "node_gtk.node");
    const typelibs = checkedChild(runtimeDirectory, "girepository-1.0");
    const marker = checkedChild(runtimeDirectory, descriptor.runtimeMarker);
    const addonStat = safeStat(addon), typelibsStat = safeStat(typelibs), markerStat = safeStat(marker);
    if (!addonStat?.isFile() || addonStat.isSymbolicLink()
        || !typelibsStat?.isDirectory() || typelibsStat.isSymbolicLink()
        || !markerStat?.isFile() || markerStat.isSymbolicLink()) { return false; }
    try { return fs.readFileSync(marker, "utf8") === markerContent(bindingName); }
    catch { return false; }
}

function copyRuntimeTree(sourceRoot, targetRoot) {
    requirePlainDirectory(sourceRoot, "El runtime GTK empaquetado");
    fs.mkdirSync(targetRoot, { recursive: false });
    for (const entry of fs.readdirSync(sourceRoot, { withFileTypes: true })) {
        if (entry.name === "." || entry.name === ".." || entry.name.includes("\0")) {
            throw failure("CLRS_GUI_BOOTSTRAP_RUNTIME_SOURCE_INVALID", "El runtime contiene una entrada no segura.");
        }
        const source = checkedChild(sourceRoot, entry.name);
        const target = checkedChild(targetRoot, entry.name);
        const stat = fs.lstatSync(source);
        if (stat.isSymbolicLink()) {
            throw failure("CLRS_GUI_BOOTSTRAP_RUNTIME_SOURCE_INVALID", "El runtime contiene un enlace simbólico no portable.");
        }
        if (stat.isDirectory()) { copyRuntimeTree(source, target); }
        else if (stat.isFile()) { fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL); }
        else { throw failure("CLRS_GUI_BOOTSTRAP_RUNTIME_SOURCE_INVALID", "El runtime contiene un tipo de archivo no portable."); }
    }
}

function preparePortableRuntime(options = {}) {
    const processObject = options.processObject ?? process;
    const binding = bindingIdentity(processObject);
    const packageRoot = dependencyRoot(options);
    const sourceRuntime = checkedChild(packageRoot, "lib", "binding", binding.bindingName);
    requirePlainDirectory(sourceRuntime, "El binding " + binding.bindingName);
    requirePlainFile(checkedChild(sourceRuntime, "node_gtk.node"), "node_gtk.node");
    requirePlainDirectory(checkedChild(sourceRuntime, "girepository-1.0"), "girepository-1.0");

    const defaultAppDirectory = processObject.pkg ? path.dirname(processObject.execPath) : __dirname;
    const appDirectory = path.resolve(options.appDirectory ?? defaultAppDirectory);
    requirePlainDirectory(appDirectory, "El directorio físico de la aplicación");
    const binDirectory = checkedChild(appDirectory, "bin");
    const binStat = safeStat(binDirectory);
    if (binStat && (!binStat.isDirectory() || binStat.isSymbolicLink())) {
        throw failure("CLRS_GUI_BOOTSTRAP_RUNTIME_TARGET_INVALID", "bin no es un directorio físico administrable.");
    }
    if (!binStat) { fs.mkdirSync(binDirectory); }
    const runtimeDirectory = checkedChild(binDirectory, binding.bindingName);
    let reused = runtimeIsReusable(runtimeDirectory, binding.bindingName);
    if (!reused) {
        const stage = checkedChild(binDirectory, "." + binding.bindingName + ".stage-" + processObject.pid + "-" + Date.now());
        try {
            if (safeStat(stage)) { fs.rmSync(stage, { recursive: true, force: true }); }
            copyRuntimeTree(sourceRuntime, stage);
            fs.writeFileSync(checkedChild(stage, descriptor.runtimeMarker), markerContent(binding.bindingName), { encoding: "utf8", flag: "wx" });
            if (!runtimeIsReusable(stage, binding.bindingName)) {
                throw failure("CLRS_GUI_BOOTSTRAP_EXTRACTION_FAILED", "El runtime extraído no superó la validación.");
            }
            if (safeStat(runtimeDirectory)) { fs.rmSync(runtimeDirectory, { recursive: true, force: true }); }
            fs.renameSync(stage, runtimeDirectory);
        } catch (cause) {
            try { if (safeStat(stage)) { fs.rmSync(stage, { recursive: true, force: true }); } } catch { /* conserva el error original */ }
            if (cause?.name === "CLRSPortableBootstrapError") { throw cause; }
            throw failure("CLRS_GUI_BOOTSTRAP_EXTRACTION_FAILED", "No fue posible materializar el runtime GTK junto al ejecutable.", cause);
        }
    }
    const addonPath = checkedChild(runtimeDirectory, "node_gtk.node");
    const result = Object.freeze({ ...binding, packageRoot, sourceRuntime, appDirectory,
        runtimeDirectory, addonPath, markerPath: checkedChild(runtimeDirectory, descriptor.runtimeMarker), reused });
    configureGtkEnvironment(result, processObject.env ?? {});
    installNativeRedirect(result, processObject);
    return result;
}

function isSnapshotPath(value) {
    if (typeof value !== "string") { return false; }
    const normalized = value.replace(/\\\\/gu, "/").toLowerCase();
    return normalized === "/snapshot" || normalized.startsWith("/snapshot/") || normalized.includes(":/snapshot/");
}

function existingDirectories(paths) {
    return paths.filter(candidate => {
        const stat = safeStat(candidate);
        return stat?.isDirectory() && !stat.isSymbolicLink() && !isSnapshotPath(candidate);
    });
}

function prependEnvironment(env, key, values, delimiter) {
    const current = String(env[key] ?? "").split(delimiter).filter(value => value && !isSnapshotPath(value));
    const combined = [...values, ...current];
    const seen = new Set();
    env[key] = combined.filter(value => {
        const canonical = delimiter === ";" ? value.toLowerCase() : value;
        if (seen.has(canonical)) { return false; }
        seen.add(canonical); return true;
    }).join(delimiter);
}

function configureGtkEnvironment(runtime, env) {
    const delimiter = runtime.platform === "win32" ? ";" : ":";
    const root = runtime.runtimeDirectory;
    const bin = checkedChild(root, "bin"), lib = checkedChild(root, "lib");
    prependEnvironment(env, "PATH", [root, ...existingDirectories([bin, lib])], delimiter);
    const typelibs = checkedChild(root, "girepository-1.0");
    prependEnvironment(env, "GI_TYPELIB_PATH", existingDirectories([typelibs]), delimiter);
    const share = checkedChild(root, "share");
    prependEnvironment(env, "XDG_DATA_DIRS", existingDirectories([share]), delimiter);
    const schemas = checkedChild(share, "glib-2.0", "schemas");
    if (existingDirectories([schemas]).length === 1) { env.GSETTINGS_SCHEMA_DIR = schemas; }
    else if (isSnapshotPath(env.GSETTINGS_SCHEMA_DIR)) { delete env.GSETTINGS_SCHEMA_DIR; }
    const loaders = checkedChild(lib, "gdk-pixbuf-2.0", "2.10.0", "loaders.cache");
    const loadersStat = safeStat(loaders);
    if (loadersStat?.isFile() && !loadersStat.isSymbolicLink()) { env.GDK_PIXBUF_MODULE_FILE = loaders; }
    else if (isSnapshotPath(env.GDK_PIXBUF_MODULE_FILE)) { delete env.GDK_PIXBUF_MODULE_FILE; }
    return env;
}

function installNativeRedirect(runtime, processObject = process) {
    if (typeof processObject.dlopen !== "function") {
        throw failure("CLRS_GUI_BOOTSTRAP_NATIVE_REDIRECT_FAILED", "El runtime de Node.js no expone process.dlopen.");
    }
    if (processObject.__clrsNodeGtkRedirect === runtime.addonPath) { return; }
    const original = processObject.dlopen;
    processObject.dlopen = function(module, fileName) {
        const requested = typeof fileName === "string" ? fileName : "";
        const expectedName = runtime.platform === "win32"
            ? path.basename(requested).toLowerCase() === "node_gtk.node"
            : path.basename(requested) === "node_gtk.node";
        if (expectedName && isSnapshotPath(requested)) {
            const args = Array.from(arguments);
            args[1] = runtime.addonPath;
            return Reflect.apply(original, this, args);
        }
        return Reflect.apply(original, this, arguments);
    };
    Object.defineProperty(processObject, "__clrsNodeGtkRedirect", {
        value: runtime.addonPath, configurable: true, writable: false, enumerable: false
    });
}

function registerPackagedLoader(runtime, options = {}) {
    const processObject = options.processObject ?? process;
    const target = options.globalObject ?? globalThis;
    let loaded = false, binding;
    target[loaderProperty] = async function() {
        configureGtkEnvironment(runtime, processObject.env ?? {});
        if (!loaded) {
            const loadBinding = options.loadBinding ?? (() => require("node-gtk"));
            binding = loadBinding();
            if (binding && typeof binding.then === "function") { binding = await binding; }
            loaded = true;
        }
        configureGtkEnvironment(runtime, processObject.env ?? {});
        return binding;
    };
    return target[loaderProperty];
}

function announce(processObject, message, quiet) {
    if (!quiet && typeof processObject.stdout?.write === "function") {
        processObject.stdout.write("[" + descriptor.projectId + "] " + message + "\\n");
    }
}

async function start(options = {}) {
    const processObject = options.processObject ?? process;
    const runtime = preparePortableRuntime(options);
    registerPackagedLoader(runtime, options);
    announce(processObject, runtime.reused ? "Runtime GTK portable reutilizado." : "Runtime GTK portable preparado.", options.quiet);
    announce(processObject, "Iniciando aplicación empaquetada.", options.quiet);
    const packablePath = checkedChild(__dirname, descriptor.packableFile);
    const packableStat = safeStat(packablePath);
    if (!packableStat?.isFile() || packableStat.isSymbolicLink()) {
        throw failure("CLRS_GUI_BOOTSTRAP_PACKABLE_NOT_FOUND", "No se encontró la variante packable del programa.");
    }
    let source, execute;
    try {
        source = fs.readFileSync(packablePath, "utf8");
        const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
        execute = new AsyncFunction("require", source);
    } catch (cause) {
        throw failure("CLRS_GUI_BOOTSTRAP_PACKABLE_INVALID", "La variante packable no contiene JavaScript ejecutable.", cause);
    }
    return execute(require);
}

module.exports = Object.freeze({ descriptor, preparePortableRuntime, configureGtkEnvironment,
    installNativeRedirect, registerPackagedLoader, start });
if (require.main === module) {
    start().catch(error => {
        process.stderr.write(String(error?.message ?? error) + "\\n");
        process.exitCode = 1;
    });
}
`;
}

function validateIdentity(identity) {
    const values = {
        projectId: identity?.portableName,
        packableFile: identity?.packableFile,
        bootstrapFile: identity?.bootstrapFile,
        runtimeMarker: identity?.runtimeMarker
    };
    for (const [field, value] of Object.entries(values)) {
        if (typeof value !== "string" || value.length === 0 || value === "." || value === ".."
            || /[\\/\0]/u.test(value)) {
            throw new TypeError(`La identidad portable contiene un ${field} no seguro.`);
        }
    }
    if (!/^[a-z0-9][a-z0-9_-]*$/u.test(values.projectId)
        || values.packableFile !== `${values.projectId}.packable.js`
        || values.bootstrapFile !== "bootstrap.cjs"
        || values.runtimeMarker !== `.${values.projectId}-runtime`) {
        throw new TypeError("La identidad portable no mantiene nombres canónicos compatibles.");
    }
    return Object.freeze({ ...values, dependencyName: NODE_GTK_RUNTIME_DEPENDENCY.name,
        dependencyVersion: NODE_GTK_RUNTIME_DEPENDENCY.version });
}
