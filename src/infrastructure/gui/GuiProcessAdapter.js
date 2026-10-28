import { spawn } from "node:child_process";
import path from "node:path";
import { GuiDependencyError, checkGuiCancellation } from "./GuiDependencyError.js";

export function guiProcessEnvironment(environment = process.env) {
    return Object.fromEntries(Object.entries(environment).filter(([key]) =>
        !["NODE_PATH", "NODE_OPTIONS", "ELECTRON_RUN_AS_NODE"].includes(key.toUpperCase())));
}

/** Procesos acotados; no ejecuta comandos construidos para un shell. */
export class GuiProcessAdapter {
    constructor(options = {}) {
        this.spawn = options.spawn ?? spawn;
        this.environment = guiProcessEnvironment(options.environment);
        this.platform = options.platform ?? process.platform;
    }

    run(command, args, { cwd, signal, timeoutMs = 30_000 } = {}) {
        checkGuiCancellation(signal);
        return new Promise((resolve, reject) => {
            let child, timer, forced, terminationError;
            let stdout = "", stderr = "", settled = false;
            const finish = (error, code) => {
                if (settled) { return; }
                settled = true;
                clearTimeout(timer); clearTimeout(forced);
                signal?.removeEventListener("abort", abort);
                if (error || terminationError) { reject(terminationError ?? error); }
                else { resolve({ code, stdout, stderr }); }
            };
            const stop = error => {
                if (settled || terminationError) { return; }
                terminationError = error;
                if (this.platform === "win32" && child.pid) {
                    const killer = this.spawn(path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "taskkill.exe"),
                        ["/PID", String(child.pid), "/T", "/F"], { shell: false, windowsHide: true, stdio: "ignore" });
                    killer.on("error", () => child.kill("SIGKILL"));
                    killer.on("close", code => { if (code !== 0) { child.kill("SIGKILL"); } });
                } else {
                    try { process.kill(-child.pid, "SIGTERM"); } catch { child.kill("SIGTERM"); }
                    forced = setTimeout(() => {
                        try { process.kill(-child.pid, "SIGKILL"); } catch { child.kill("SIGKILL"); }
                    }, 500);
                }
            };
            const abort = () => stop(new GuiDependencyError("CLRS_GUI_DEP_CANCELLED"));
            try {
                child = this.spawn(command, args, { cwd, env: this.environment, shell: false,
                    windowsHide: true, detached: this.platform !== "win32", stdio: ["ignore", "pipe", "pipe"] });
            } catch (error) { finish(error); return; }
            child.stdout.on("data", chunk => { stdout = (stdout + chunk).slice(-65_536); });
            child.stderr.on("data", chunk => { stderr = (stderr + chunk).slice(-65_536); });
            child.once("error", error => finish(error));
            child.once("close", code => finish(null, code));
            signal?.addEventListener("abort", abort, { once: true });
            timer = setTimeout(() => stop(Object.assign(new Error("Tiempo de proceso agotado."), { code: "ETIMEDOUT" })), timeoutMs);
            if (signal?.aborted) { abort(); }
        });
    }
}

export function requireProcessSuccess(result, code) {
    if (result.code !== 0) {
        // El texto de npm puede contener URL/credenciales; no se adjunta a mensajes públicos.
        const offline = /ENOTFOUND|EAI_AGAIN|ENETUNREACH|ECONNREFUSED|ETIMEDOUT/iu.test(result.stderr);
        throw new GuiDependencyError(offline ? "CLRS_GUI_DEP_REGISTRY_UNAVAILABLE" : code,
            new Error(`El proceso terminó con código ${result.code}.`));
    }
    return result;
}
