import { PORTABLE_PACKAGING_CONTRACT as portable } from "./PortablePackagingContract.js";
import { validCliJavaScriptProjectManifest } from "./JavaScriptProjectDescriptor.js";

const PACKAGE_NAME = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u;
const PACKAGE_KEY = /^node_modules\/(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*(?:\/node_modules\/(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*)*$/u;
const VERSION = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;
const FORBIDDEN_GUI_TEXT = /node-gtk|bootstrap\.cjs|prepare-packable\.cjs|\.packable\.js|gtk-binding/iu;
const INTEGRITY_LENGTH = Object.freeze({ sha256: 32, sha384: 48, sha512: 64 });

/** Valida el snapshot CLI completo sin depender del sistema de archivos. */
export function validCliJavaScriptProjectSnapshot({ descriptor, generatedCode,
    entryText, manifestText, lockText } = {}) {
    if (!descriptor || typeof generatedCode !== "string" || entryText !== generatedCode
        || typeof manifestText !== "string" || typeof lockText !== "string") { return false; }
    const canonicalManifest = JSON.stringify(descriptor.manifest, null, 2) + "\n";
    if (manifestText !== canonicalManifest) { return false; }
    try {
        const manifest = JSON.parse(manifestText);
        const lock = JSON.parse(lockText);
        return validCliJavaScriptProjectManifest(manifest, descriptor)
            && validCliJavaScriptProjectLock(lock, manifest);
    } catch { return false; }
}

/** Lock npm v3 reproducible del perfil CLI, cerrado sobre el grafo de pkg. */
export function validCliJavaScriptProjectLock(lock, manifest) {
    if (!plainObject(lock) || !plainObject(manifest) || lock.lockfileVersion !== 3 || lock.requires !== true
        || lock.name !== manifest.name || lock.version !== manifest.version || lock.dependencies !== undefined
        || !plainObject(lock.packages)) { return false; }
    const root = lock.packages[""];
    if (!validRoot(root, manifest)) { return false; }
    const buildDependency = manifest.devDependencies?.[portable.dependency.name];
    const pkgKey = `node_modules/${portable.dependency.name}`;
    const pkg = lock.packages[pkgKey];
    if (buildDependency !== portable.dependency.version || !validVersionForRange(pkg?.version, buildDependency)
        || pkg?.dev !== true) { return false; }

    for (const [key, value] of Object.entries(lock.packages)) {
        if (key === "") { continue; }
        if (!validPackageEntry(key, value)) { return false; }
    }
    if (FORBIDDEN_GUI_TEXT.test(JSON.stringify(lock))) { return false; }
    return validReachableGraph(lock.packages, root.devDependencies);
}

function validRoot(root, manifest) {
    return plainObject(root) && root.name === manifest.name && root.version === manifest.version
        && emptyMap(root.dependencies) && emptyMap(root.optionalDependencies) && emptyMap(root.peerDependencies)
        && equalJson(root.devDependencies, manifest.devDependencies)
        && equalJson(root.engines, manifest.engines)
        && validLockBin(root.bin, manifest.name, manifest.bin);
}

function validPackageEntry(key, value) {
    if (!PACKAGE_KEY.test(key) || key.includes("..") || key.includes("\\") || !plainObject(value)
        || value.link === true || value.dev !== true || !VERSION.test(value.version ?? "")
        || !validResolvedUrl(value.resolved) || !validStrongIntegrity(value.integrity)) { return false; }
    return ["dependencies", "optionalDependencies", "peerDependencies"].every(field =>
        value[field] === undefined || validDependencyMap(value[field]));
}

function validReachableGraph(packages, rootDependencies) {
    const reachable = new Set(), queue = [];
    for (const name of Object.keys(rootDependencies)) {
        const key = resolveDependency("", name, packages);
        if (!key) { return false; }
        reachable.add(key);
        queue.push(key);
    }
    while (queue.length > 0) {
        const key = queue.shift();
        const entry = packages[key];
        for (const field of ["dependencies", "optionalDependencies", "peerDependencies"]) {
            for (const name of Object.keys(entry[field] ?? {})) {
                const dependency = resolveDependency(key, name, packages);
                if (!dependency) {
                    if (field === "dependencies") { return false; }
                    continue;
                }
                if (!reachable.has(dependency)) {
                    reachable.add(dependency);
                    queue.push(dependency);
                }
            }
        }
    }
    return Object.keys(packages).every(key => key === "" || reachable.has(key));
}

function resolveDependency(requester, name, packages) {
    if (!PACKAGE_NAME.test(name)) { return null; }
    let current = requester;
    while (current) {
        const candidate = `${current}/node_modules/${name}`;
        if (Object.hasOwn(packages, candidate)) { return candidate; }
        const parentIndex = current.lastIndexOf("/node_modules/");
        current = parentIndex < 0 ? "" : current.slice(0, parentIndex);
    }
    const rootCandidate = `node_modules/${name}`;
    return Object.hasOwn(packages, rootCandidate) ? rootCandidate : null;
}

function validDependencyMap(value) {
    return plainObject(value) && Object.entries(value).every(([name, range]) =>
        PACKAGE_NAME.test(name) && typeof range === "string" && range.length > 0 && !FORBIDDEN_GUI_TEXT.test(name));
}

function validLockBin(bin, name, entry) {
    if (!plainObject(bin) || Object.keys(bin).length !== 1) { return false; }
    const normalized = String(entry).replace(/^\.\//u, "");
    return bin[name] === entry || bin[name] === normalized;
}

function validResolvedUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === "https:" && url.hostname.length > 0 && !url.username && !url.password
            && url.search.length === 0 && url.hash.length === 0;
    } catch { return false; }
}

function validStrongIntegrity(value) {
    const match = /^(sha256|sha384|sha512)-([A-Za-z0-9+/]+={0,2})$/u.exec(value ?? "");
    if (!match) { return false; }
    const bytes = Buffer.from(match[2], "base64");
    return bytes.length === INTEGRITY_LENGTH[match[1]]
        && bytes.toString("base64").replace(/=+$/u, "") === match[2].replace(/=+$/u, "");
}

function validVersionForRange(version, range) {
    const parsed = /^([0-9]+)\.([0-9]+)\.([0-9]+)$/u.exec(version ?? "");
    const minimum = /^\^([0-9]+)\.([0-9]+)\.([0-9]+)$/u.exec(range ?? "");
    if (!parsed || !minimum) { return false; }
    const actual = parsed.slice(1).map(Number), floor = minimum.slice(1).map(Number);
    if (actual[0] !== floor[0]) { return false; }
    return actual[1] > floor[1] || (actual[1] === floor[1] && actual[2] >= floor[2]);
}

function emptyMap(value) {
    return value === undefined || (plainObject(value) && Object.keys(value).length === 0);
}

function equalJson(left, right) {
    return plainObject(left) && plainObject(right) && JSON.stringify(left) === JSON.stringify(right);
}

function plainObject(value) {
    return value != null && typeof value === "object" && !Array.isArray(value)
        && Object.getPrototypeOf(value) === Object.prototype;
}
