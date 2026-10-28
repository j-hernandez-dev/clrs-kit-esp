/** Canonical, serializable policy. CLRS administers private npm packages only;
 * it NEVER installs native OS packages (GTK, media backends, plugins or codecs).
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
    if (code === "CLRS_GUI_RUNTIME_NOT_READY") {
        message += " No se pudo inicializar la sesión gráfica. Comprueba que exista una sesión de escritorio disponible para este proceso.";
    }
    if (code === "CLRS_GUI_MEDIA_BACKEND_UNAVAILABLE") {
        message += " VIDEO requiere soporte multimedia adicional. Según la plataforma y el backend, pueden ser necesarios GStreamer y sus complementos.";
    }
    if (["CLRS_GUI_MEDIA_BACKEND_UNAVAILABLE", "CLRS_GUI_MEDIA_LOAD_FAILED"].includes(code)) {
        if (platform === "win32") {
            message += "\n\nSi necesitas instalar el soporte GStreamer en Windows, elige GStreamer Runtime para MSVC de 64 bits (x86_64), opción Only runtime. Para ejecutar programas CLRS no necesitas Development/SDK, Debug symbols ni Debugger.";
            message += "\n\nSi GStreamer ya está instalado, comprueba que su carpeta bin esté disponible en PATH para este proceso antes de reinstalarlo. Cierra completamente VS Code y vuelve a abrirlo después de instalarlo o modificar PATH; fuera de VS Code, vuelve a abrir la terminal o aplicación desde la que ejecutas el programa.";
            message += "\n\nEl Runtime y sus complementos deben ser compatibles con el backend multimedia de GTK cargado. Tener GStreamer instalado no garantiza esa compatibilidad. Este diagnóstico no demuestra que GStreamer esté ausente ni que PATH sea la causa.";
        } else {
            message += platform === "linux"
                ? "\n\nComprueba el runtime multimedia de GTK y, cuando corresponda, GStreamer y sus complementos mediante las herramientas de tu distribución Linux."
                : "\n\nComprueba el runtime multimedia de GTK y, cuando corresponda, GStreamer y sus complementos apropiados para tu sistema.";
        }
        message += " CLRS no instala automáticamente GTK, GStreamer ni paquetes nativos del sistema.";
    }
    return `${message}\n\nSistema detectado: ${system}.`;
}

/** Classify only structured public error domains; never guess from codec filenames/messages. */
export function classifyGuiMediaError(error, Gio, GLib, backendVerified = false) {
    const matches = (domain, code) => {
        if (domain == null || code == null) { return false; }
        try { return error?.matches?.(domain, code) === true || (error?.domain === domain && error?.code === code); }
        catch { return false; }
    };
    const io = Gio.ioErrorQuark?.();
    if (["NOT_FOUND", "PERMISSION_DENIED", "IS_DIRECTORY", "NOT_DIRECTORY"].some(name => matches(io, Gio.IOErrorEnum?.[name]))) {
        return "CLRS_GUI_MEDIA_RESOURCE_UNAVAILABLE";
    }
    if (backendVerified && matches(io, Gio.IOErrorEnum?.NOT_SUPPORTED)) { return "CLRS_GUI_MEDIA_FORMAT_UNSUPPORTED"; }
    // GstStreamError is a public domain. No Gst import (or installation) is required to read it.
    const gst = GLib?.quarkTryString?.("gst-stream-error-quark");
    if (gst && [5, 6, 7, 11].some(code => matches(gst, code))) { return "CLRS_GUI_MEDIA_FORMAT_UNSUPPORTED"; }
    return "CLRS_GUI_MEDIA_LOAD_FAILED";
}

export async function probeGuiEnvironment(entryUrl, capabilities = ["gui"], load = url => import(url), progress = () => {}, samplePath) {
    if (!capabilities.includes("gui") && !capabilities.includes("gui.video")) { return { ok: true, capabilities: [] }; }
    let phase = "binding", media;
    const result = (code, cause) => ({ ok: false, code, phase, detail: String(cause?.message ?? cause ?? "") });
    try {
        progress(phase);
        const binding = await load(entryUrl);
        const gi = binding.default ?? binding;
        phase = "gtk"; progress(phase);
        const Gtk = gi.require("Gtk", "4.0");
        const gtkVersion = [Gtk.getMajorVersion(), Gtk.getMinorVersion(), Gtk.getMicroVersion()];
        if (gtkVersion[0] !== 4 || gtkVersion[1] < 10) { return result("CLRS_GUI_DEP_GTK_TOO_OLD"); }
        if (!capabilities.includes("gui.video")) { return { ok: true, gtkVersion, capabilities: ["gui"] }; }
        // Media backends must be registered by GTK before creating MediaFile.
        // initCheck is public since GTK 4.0 and opens no application window.
        if (!Gtk.initCheck()) { return result("CLRS_GUI_RUNTIME_NOT_READY"); }
        phase = "media"; progress(phase);
        if (!Gtk.Video || !Gtk.MediaFile?.new) { return result("CLRS_GUI_MEDIA_BACKEND_UNAVAILABLE"); }
        const Gio = gi.require("Gio", "2.0"), GLib = gi.require("GLib", "2.0");
        media = Gtk.MediaFile.new();
        // Supplemental recognition of GTK's known fallback. Unknown implementations
        // are tested through MediaFile itself, never rejected by their type name.
        if (/NoMediaFile/.test(media.constructor?.name ?? "")) { return result("CLRS_GUI_MEDIA_BACKEND_UNAVAILABLE"); }
        if (/GstMediaFile/.test(media.constructor?.name ?? "")) {
            // Optional safeguard for GTK/Gst builds that abort instead of returning GError.
            // Missing Gst introspection alone is NOT evidence of a missing backend.
            let Gst;
            try { Gst = gi.require("Gst", "1.0"); } catch { /* test GTK directly below */ }
            if (Gst) {
                const initialized = Gst.initCheck([]);
                if (!(Array.isArray(initialized) ? initialized[0] : initialized)
                    || (!Gst.ElementFactory.find("playbin") && !Gst.ElementFactory.find("playbin3"))) {
                    return result("CLRS_GUI_MEDIA_BACKEND_UNAVAILABLE");
                }
            }
        }
        // GTK 4.10's Gst backend accepts a local GFile without presenting a widget.
        // No video widget/surface is presented; GTK initialization still needs a usable display.
        media.setFile(Gio.File.newForPath(samplePath));
        const deadline = Date.now() + 3000;
        const context = GLib.MainContext.default();
        while (!media.isPrepared() && !media.getError() && Date.now() < deadline) {
            for (let i = 0; i < 64 && context.pending(); i++) { context.iteration(false); }
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        const error = media.getError();
        if (error) { return result(classifyGuiMediaError(error, Gio, GLib), error); }
        // A failed reference sample does not prove that GStreamer is missing.
        if (!media.isPrepared()) { return result("CLRS_GUI_MEDIA_LOAD_FAILED", "Media preparation timed out"); }
        return { ok: true, gtkVersion, capabilities: ["gui", "gui.video"] };
    } catch (error) {
        const code = phase === "binding"
            ? (error.code === "ERR_MODULE_NOT_FOUND" && String(error.message).includes(entryUrl)
                ? "CLRS_GUI_DEP_RESOLUTION_FAILED" : "CLRS_GUI_DEP_NATIVE_LOAD_FAILED")
            : phase === "gtk" ? "CLRS_GUI_DEP_GTK_NOT_FOUND" : "CLRS_GUI_MEDIA_LOAD_FAILED";
        return result(code, error);
    } finally {
        try { media?.pause(); } catch { /* best effort after a native failure */ }
        try { media?.clear(); } catch { /* best effort */ }
        media = null;
    }
}

export function guiProbeSource(entryUrl, capabilities, samplePath) {
    return `${classifyGuiMediaError.toString()}\nawait (${probeGuiEnvironment.toString()})(${JSON.stringify(entryUrl)}, ${JSON.stringify(capabilities)}, undefined,
        phase => console.log(JSON.stringify({phase})), ${JSON.stringify(samplePath)}).then(result => {
            console.log(JSON.stringify(result)); process.exit(result.ok ? 0 : 1);
        });`;
}

/** The parent owns the sample and removes it even if a native probe aborts. */
export async function createGuiProbeRequest(entryUrl, capabilities) {
    if (!capabilities.includes("gui.video")) { return { source: guiProbeSource(entryUrl, capabilities), cleanup: async () => {} }; }
    const fs = await import("node:fs/promises"), os = await import("node:os"), path = await import("node:path");
    const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "clrs-media-probe-"));
    const cleanup = () => fs.rm(temporary, { recursive: true, force: true });
    try {
        const bytes = Buffer.alloc(1644);
        bytes.write("RIFF"); bytes.writeUInt32LE(1636, 4); bytes.write("WAVEfmt ", 8);
        bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
        bytes.writeUInt32LE(8000, 24); bytes.writeUInt32LE(16000, 28); bytes.writeUInt16LE(2, 32);
        bytes.writeUInt16LE(16, 34); bytes.write("data", 36); bytes.writeUInt32LE(1600, 40);
        const filename = path.join(temporary, "probe.wav"); await fs.writeFile(filename, bytes);
        return { source: guiProbeSource(entryUrl, capabilities, filename), cleanup };
    } catch (error) { await cleanup(); throw error; }
}

export function decodeGuiProbeResult(result) {
    const values = String(result.stdout ?? "").trim().split(/\r?\n/).flatMap(line => {
        try { return [JSON.parse(line)]; } catch { return []; }
    });
    const last = values.at(-1);
    if (last?.ok === false) { return last; }
    if ((result.code ?? result.status) === 0 && last?.ok === true) { return last; }
    const phase = last?.phase;
    return { ok: false, code: phase === "media" ? "CLRS_GUI_MEDIA_LOAD_FAILED"
        : phase === "gtk" ? "CLRS_GUI_DEP_GTK_NOT_FOUND" : "CLRS_GUI_DEP_NATIVE_LOAD_FAILED",
    phase, detail: String(result.stderr ?? result.error?.message ?? "Native probe terminated") };
}

/** Used by standalone/generated programs. The native check still runs in a child. */
export async function checkGuiEnvironmentIsolated(entryUrl, capabilities, messages) {
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
    return [guiEnvironmentMessage, classifyGuiMediaError, probeGuiEnvironment, guiProbeSource,
        createGuiProbeRequest, decodeGuiProbeResult, checkGuiEnvironmentIsolated].map(fn => fn.toString()).join("\n");
}
