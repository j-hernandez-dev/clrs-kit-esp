import path from "node:path";
import { NODE_GTK_RUNTIME_DEPENDENCY as dependency } from "../../standard-library/gui/GuiContract.js";
import { PORTABLE_PACKAGING_CONTRACT as portable, createCliBuildScripts,
    createPortableBuildScripts, createPortableNodeEngineRange } from "./PortablePackagingContract.js";

const WINDOWS_RESERVED_NAME = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/iu;
export const JAVASCRIPT_EXPORT_ROOT_DIRECTORY = "app";

/** Identidad pública única para cualquier exportación permanente de JavaScript. */
export function createJavaScriptProjectIdentity(sourcePath) {
    const base = path.basename(sourcePath, path.extname(sourcePath));
    const slug = base.normalize("NFKD").replace(/[\u0300-\u036f]/gu, "").toLowerCase()
        .replace(/[^a-z0-9_-]+/gu, "-").replace(/^[-_]+|[-_]+$/gu, "").slice(0, 120) || "clrs-exported-program";
    const name = WINDOWS_RESERVED_NAME.test(slug) ? `clrs-${slug}` : slug;
    const sourceDirectory = path.resolve(path.dirname(sourcePath));
    const exportRoot = path.join(sourceDirectory, JAVASCRIPT_EXPORT_ROOT_DIRECTORY);
    const projectDirectory = path.join(exportRoot, name);
    const entryFile = `${name}.js`;
    const packableFile = `${name}.packable.js`;
    const preparePackableFile = "prepare-packable.cjs";
    const bootstrapFile = "bootstrap.cjs";
    const runtimeMarker = `.${name}-runtime`;
    return Object.freeze({ name, programName: name, portableName: name, packageName: name,
        displayName: base, directoryName: name, entryFile, packableFile, preparePackableFile,
        bootstrapFile, runtimeMarker,
        sourceDirectory, exportRoot, projectDirectory, entryPath: path.join(projectDirectory, entryFile),
        packablePath: path.join(projectDirectory, packableFile),
        preparePackablePath: path.join(projectDirectory, preparePackableFile),
        bootstrapPath: path.join(projectDirectory, bootstrapFile) });
}

/** Nombres públicos estables, legibles y seguros en cmd.exe y shells POSIX. */
export function createJavaScriptOutputDescriptor(sourcePath) {
    const { directoryName, entryFile } = createJavaScriptProjectIdentity(sourcePath);
    return Object.freeze({ directoryName, entryFile });
}

/** Descriptor npm de la variante GUI exportada. */
export function createJavaScriptProjectDescriptor(sourcePath) {
    return createPortableJavaScriptProjectDescriptor(sourcePath);
}

/** Descriptor canónico del perfil CLI, sin nombres ni rutas de infraestructura GUI. */
export function createCliJavaScriptProjectDescriptor(sourcePath) {
    const identity = createJavaScriptProjectIdentity(sourcePath);
    const cliIdentity = Object.freeze({
        name: identity.name,
        programName: identity.programName,
        portableName: identity.portableName,
        packageName: identity.packageName,
        displayName: identity.displayName,
        directoryName: identity.directoryName,
        entryFile: identity.entryFile,
        sourceDirectory: identity.sourceDirectory,
        exportRoot: identity.exportRoot,
        projectDirectory: identity.projectDirectory,
        entryPath: identity.entryPath
    });
    return Object.freeze({ ...cliIdentity, manifest: createCliJavaScriptProjectManifest(cliIdentity) });
}

/** Manifest npm mínimo para ejecutar y empaquetar directamente un programa CLI. */
export function createCliJavaScriptProjectManifest(identity) {
    const base = createBaseManifest(identity?.name);
    return deepFreeze({
        name: base.name, version: base.version, private: base.private, type: base.type,
        bin: `./${identity.entryFile}`,
        scripts: createCliBuildScripts(identity),
        engines: base.engines,
        devDependencies: { [portable.dependency.name]: portable.dependency.version }
    });
}

export function validCliJavaScriptProjectManifest(manifest, identity) {
    try { return JSON.stringify(manifest) === JSON.stringify(createCliJavaScriptProjectManifest(identity)); }
    catch { return false; }
}

/** Descriptor de la publicación GUI portable completa. */
export function createPortableJavaScriptProjectDescriptor(sourcePath) {
    const identity = createJavaScriptProjectIdentity(sourcePath);
    return Object.freeze({ ...identity, manifest: createPortableJavaScriptProjectManifest(identity) });
}

export function createPortableJavaScriptProjectManifest(identity) {
    const base = createBaseManifest(identity?.name);
    return deepFreeze({
        name: base.name, version: base.version, private: base.private, type: base.type,
        bin: `./${identity.bootstrapFile}`,
        scripts: createPortableBuildScripts(identity),
        engines: base.engines,
        dependencies: base.dependencies,
        allowScripts: base.allowScripts,
        devDependencies: { [portable.dependency.name]: portable.dependency.version },
        pkg: { assets: [...portable.assets, identity.packableFile] }
    });
}

export function validPortableJavaScriptProjectManifest(manifest, identity) {
    try { return JSON.stringify(manifest) === JSON.stringify(createPortableJavaScriptProjectManifest(identity)); }
    catch { return false; }
}

function createBaseManifest(name) {
    return deepFreeze({
        name, version: "1.0.0", private: true, type: "module",
        engines: { node: createPortableNodeEngineRange() },
        dependencies: { [dependency.name]: dependency.version },
        allowScripts: { [`${dependency.name}@${dependency.version}`]: true }
    });
}

export function validJavaScriptProjectLock(lock, manifest) {
    const root = lock?.packages?.[""], gtk = lock?.packages?.[`node_modules/${dependency.name}`];
    const buildDependency = manifest?.devDependencies?.[portable.dependency.name];
    const pkg = lock?.packages?.[`node_modules/${portable.dependency.name}`];
    if (!validLockEnvelope(lock, manifest)) { return false; }
    return JSON.stringify(root.dependencies) === JSON.stringify(manifest.dependencies)
        && JSON.stringify(root.devDependencies ?? {}) === JSON.stringify(manifest.devDependencies ?? {})
        && gtk?.version === dependency.version && validIntegrity(gtk.integrity)
        && (buildDependency === undefined || (buildDependency === portable.dependency.version
            && validVersionForRange(pkg?.version, buildDependency) && pkg.dev === true && validIntegrity(pkg.integrity)))
        && validResolvedPackages(lock.packages);
}

function validLockEnvelope(lock, manifest) {
    const root = lock?.packages?.[""];
    return lock != null && typeof lock === "object" && lock.packages != null && typeof lock.packages === "object"
        && [2, 3].includes(lock.lockfileVersion) && lock.name === manifest?.name && lock.version === manifest?.version
        && root?.name === manifest?.name && root.version === manifest?.version;
}

function validResolvedPackages(packages) {
    return Object.entries(packages).every(([key, value]) => {
        if (key === "") { return true; }
        if (!value || typeof value !== "object" || !key.startsWith("node_modules/")
            || key.split("/").includes("..") || value.link) { return false; }
        try {
            const url = new URL(value.resolved);
            return url.protocol === "https:" && url.hostname.length > 0 && !url.username && !url.password
                && url.search.length === 0 && url.hash.length === 0 && validIntegrity(value.integrity);
        } catch { return false; }
    });
}

function validVersionForRange(version, range) {
    const parsed = /^([0-9]+)\.([0-9]+)\.([0-9]+)$/u.exec(version ?? "");
    const minimum = /^\^([0-9]+)\.([0-9]+)\.([0-9]+)$/u.exec(range ?? "");
    if (!parsed || !minimum) { return false; }
    const actual = parsed.slice(1).map(Number), floor = minimum.slice(1).map(Number);
    if (actual[0] !== floor[0]) { return false; }
    return actual[1] > floor[1] || (actual[1] === floor[1] && actual[2] >= floor[2]);
}

function deepFreeze(value) {
    if (value && typeof value === "object") {
        for (const child of Object.values(value)) { deepFreeze(child); }
        Object.freeze(value);
    }
    return value;
}

function validIntegrity(value) {
    return typeof value === "string" && /^(?:sha256|sha384|sha512)-[A-Za-z0-9+/]+={0,2}$/u.test(value);
}
