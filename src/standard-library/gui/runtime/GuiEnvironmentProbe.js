/** Canonical, serializable policy. CLRS administers private npm packages only;
 * it NEVER installs native OS packages.
 * Executed in a separate Node process, never in the Extension Host.
 */
export function guiEnvironmentMessage(code, messages, platform) {
    const system = { win32: "Windows", linux: "Linux", darwin: "macOS" }[platform] ?? platform;
    let message = messages[code] ?? messages.CLRS_GUI_NATIVE_OPERATION_FAILED;
    if (code === "CLRS_GUI_DEP_GTK_NOT_FOUND") {
        message += platform === "win32"
            ? " Comprueba la compatibilidad de Node.js y las bibliotecas GTK empaquetadas con node-gtk; no se presupone que falte una instalación global de GTK."
            : platform === "linux"
                ? " Instala GTK 4.10 o superior mediante el gestor de paquetes de tu distribución y vuelve a ejecutar el programa."
                : " Instala GTK 4.10 o superior mediante un método apropiado para tu sistema y vuelve a ejecutar el programa.";
    }
    if (code === "CLRS_GUI_DEP_NATIVE_LOAD_FAILED") {
        message += " La instalación de node-gtk puede estar incompleta, contener un binario incompatible o no poder cargar sus bibliotecas nativas. Comprueba también la versión de Node.js.";
    }
    if (code === "CLRS_GUI_DEP_GTK_RESOURCES_UNAVAILABLE") {
        message += platform === "win32"
            ? " La distribución privada de GTK está incompleta o sus recursos no pueden leerse. No necesitas instalar GTK adicional ni herramientas de desarrollo."
            : " Comprueba que la instalación de GTK de tu entorno esté completa y que sus recursos sean localizables. CLRS no modifica los paquetes del sistema.";
    }
    return `${message}\n\nSistema detectado: ${system}.`;
}

/** El proyecto exportado falla antes de intentar cargar un ABI no compatible. */
export function checkGuiRuntimeCompatibility(runtime = process) {
    const major = Number.parseInt(runtime.versions?.node ?? "", 10);
    const supported = [22, 24, 26];
    if (!supported.includes(major) || !["win32", "linux", "darwin"].includes(runtime.platform)
        || !["x64", "arm64"].includes(runtime.arch)) {
        return { ok: false, code: "CLRS_GUI_DEP_NODE_UNSUPPORTED", phase: "node",
            detail: `Node ${runtime.versions?.node ?? "desconocido"} / ${runtime.platform ?? "desconocido"} / ${runtime.arch ?? "desconocida"}` };
    }
    return { ok: true };
}

/** Sólo el hijo GUI/probe llama a esta función. No modifica el entorno del Host.
 * En Windows el bundle oficial es autocontenido: no aceptar schemas de otra
 * instalación que oculten un bundle privado dañado. Linux/macOS conservan su entorno.
 */
export async function configureGuiPrivateEnvironment(entryUrl) {
    if (process.platform !== "win32" || !entryUrl.startsWith("file:")) { return; }
    const { fileURLToPath } = await import("node:url");
    const path = await import("node:path");
    const { stat } = await import("node:fs/promises");
    const bundle = path.join(path.dirname(fileURLToPath(entryUrl)), "binding",
        `node-v${process.versions.modules}-${process.platform}-${process.arch}`);
    // El marcador distingue el precompilado oficial de builds contra GTK externo.
    try { if (!(await stat(path.join(bundle, "girepository-1.0"))).isDirectory()) { return; } }
    catch (error) { if (error.code === "ENOENT") { return; } throw error; }
    process.env.GSETTINGS_SCHEMA_DIR = path.join(bundle, "share", "glib-2.0", "schemas");
    process.env.XDG_DATA_DIRS = path.join(bundle, "share");
}

export async function probeGuiEnvironment(entryUrl, capabilities = ["gui"], load = url => import(url), progress = () => {}) {
    if (!capabilities.includes("gui")) { return { ok: true, capabilities: [] }; }
    let phase = "binding";
    const result = (code, cause) => ({ ok: false, code, phase, detail: String(cause?.message ?? cause ?? "") });
    try {
        progress(phase);
        const binding = await load(entryUrl);
        const gi = binding.default ?? binding;
        phase = "gtk"; progress(phase);
        const Gtk = gi.require("Gtk", "4.0");
        const gtkVersion = [Gtk.getMajorVersion(), Gtk.getMinorVersion(), Gtk.getMicroVersion()];
        if (gtkVersion[0] !== 4 || gtkVersion[1] < 10) { return result("CLRS_GUI_DEP_GTK_TOO_OLD"); }
        phase = "schemas"; progress(phase);
        const Gio = gi.require("Gio", "2.0");
        const schemaId = "org.gtk.gtk4.Settings.FileChooser";
        const source = Gio.SettingsSchemaSource.getDefault();
        if (!source?.lookup(schemaId, true)) {
            return result("CLRS_GUI_DEP_GTK_RESOURCES_UNAVAILABLE", `GSettings schema no resoluble: ${schemaId}`);
        }
        return { ok: true, gtkVersion, capabilities: ["gui"] };
    } catch (error) {
        const code = phase === "binding"
            ? (error.code === "ERR_MODULE_NOT_FOUND" && String(error.message).includes(entryUrl)
                ? "CLRS_GUI_DEP_RESOLUTION_FAILED" : "CLRS_GUI_DEP_NATIVE_LOAD_FAILED")
            : phase === "schemas" ? "CLRS_GUI_DEP_GTK_RESOURCES_UNAVAILABLE" : "CLRS_GUI_DEP_GTK_NOT_FOUND";
        return result(code, error);
    }
}

export function guiProbeSource(entryUrl, capabilities) {
    return `if (${JSON.stringify(capabilities)}.includes("gui")) await (${configureGuiPrivateEnvironment.toString()})(${JSON.stringify(entryUrl)});
        await (${probeGuiEnvironment.toString()})(${JSON.stringify(entryUrl)}, ${JSON.stringify(capabilities)}, undefined,
        phase => console.log(JSON.stringify({phase}))).then(result => {
            console.log(JSON.stringify(result)); process.exit(result.ok ? 0 : 1);
        });`;
}

export async function createGuiProbeRequest(entryUrl, capabilities) {
    return { source: guiProbeSource(entryUrl, capabilities), cleanup: async () => {} };
}

export function decodeGuiProbeResult(result) {
    const values = String(result.stdout ?? "").trim().split(/\r?\n/).flatMap(line => {
        try { return [JSON.parse(line)]; } catch { return []; }
    });
    const last = values.at(-1);
    if (last?.ok === false) { return last; }
    if ((result.code ?? result.status) === 0 && last?.ok === true) { return last; }
    const phase = last?.phase;
    return { ok: false, code: phase === "schemas" ? "CLRS_GUI_DEP_GTK_RESOURCES_UNAVAILABLE"
        : phase === "gtk" ? "CLRS_GUI_DEP_GTK_NOT_FOUND" : "CLRS_GUI_DEP_NATIVE_LOAD_FAILED",
    phase, detail: String(result.stderr ?? result.error?.message ?? "Native probe terminated") };
}

/** Used by standalone/generated programs. The native check still runs in a child. */
export async function checkGuiEnvironmentIsolated(entryUrl, capabilities, messages, runtime = process) {
    if (!capabilities.includes("gui")) { return { ok: true, capabilities: [] }; }
    const compatibility = checkGuiRuntimeCompatibility(runtime);
    if (!compatibility.ok) {
        const error = new Error(`[${compatibility.code}] ${guiEnvironmentMessage(compatibility.code, messages, runtime.platform)}`);
        error.name = "CLRSUserError"; error.code = compatibility.code;
        error.cause = new Error(compatibility.detail); throw error;
    }
    const { spawnSync } = await import("node:child_process");
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
        !["NODE_PATH", "NODE_OPTIONS", "ELECTRON_RUN_AS_NODE"].includes(key.toUpperCase())));
    const request = await createGuiProbeRequest(entryUrl, capabilities);
    let result;
    try {
        result = spawnSync(process.execPath, ["--input-type=module", "-e", request.source],
            { env, encoding: "utf8", timeout: 10000, killSignal: "SIGKILL", windowsHide: true, maxBuffer: 65536 });
    } finally { await request.cleanup(); }
    const report = decodeGuiProbeResult(result);
    if (!report.ok) {
        const error = new Error(`[${report.code}] ${guiEnvironmentMessage(report.code, messages, process.platform)}`);
        error.name = "CLRSUserError"; error.code = report.code;
        error.cause = new Error(report.detail); throw error;
    }
    return report;
}

export function getGuiEnvironmentSource() {
    return [guiEnvironmentMessage, checkGuiRuntimeCompatibility, configureGuiPrivateEnvironment, probeGuiEnvironment, guiProbeSource,
        createGuiProbeRequest, decodeGuiProbeResult, checkGuiEnvironmentIsolated].map(fn => fn.toString()).join("\n");
}
