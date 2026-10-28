import { open, readFile, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { GuiDependencyError, checkGuiCancellation } from "./GuiDependencyError.js";

function alive(pid) {
    try { process.kill(pid, 0); return true; }
    catch (error) { return error.code !== "ESRCH"; }
}

/** Adquisición exclusiva entre procesos; un PID vivo jamás caduca por tiempo. */
export async function acquirePrivateRuntimeLock(layout, { signal, timeoutMs = 120_000,
    staleMs = 30_000, pollMs = 100, isAlive = alive } = {}) {
    const started = Date.now();
    const owner = JSON.stringify({ pid: process.pid, startedAt: Date.now(), token: randomUUID() });
    const reapPath = layout.lock + ".reaping";
    while (true) {
        checkGuiCancellation(signal);
        await layout.assertSafe(layout.lock);
        await layout.assertSafe(reapPath);
        let handle;
        try {
            // El cerrojo de recuperación impide publicar un propietario mientras se retira el anterior.
            let reaping = false;
            try { await readFile(reapPath); reaping = true; } catch (error) { if (error.code !== "ENOENT") { throw error; } }
            if (reaping) { throw Object.assign(new Error("Recuperación en curso."), { code: "EEXIST" }); }
            handle = await open(layout.lock, "wx");
            await handle.writeFile(owner); await handle.close(); handle = null;
            try {
                await readFile(reapPath);
                await unlink(layout.lock);
            } catch (error) {
                if (error.code !== "ENOENT") { throw error; }
                return async () => {
                    if (await readFile(layout.lock, "utf8").catch(() => null) === owner) { await unlink(layout.lock); }
                };
            }
        } catch (error) {
            if (handle) { await handle.close(); await unlink(layout.lock).catch(() => {}); }
            if (error.code !== "EEXIST") { throw error; }
            let reaper;
            try {
                reaper = await open(reapPath, "wx");
                await reaper.writeFile(owner);
                const text = await readFile(layout.lock, "utf8");
                const previous = JSON.parse(text);
                if (Number.isInteger(previous?.pid) && previous.pid > 0 &&
                    Number.isFinite(previous.startedAt) && Date.now() - previous.startedAt > staleMs && !isAlive(previous.pid)) {
                    await unlink(layout.lock);
                }
            } catch (error) {
                if (!["EEXIST", "ENOENT"].includes(error.code) && !(error instanceof SyntaxError)) { throw error; }
            } finally {
                if (reaper) { await reaper.close(); await unlink(reapPath); }
            }
        }
        if (Date.now() - started >= timeoutMs) { throw new GuiDependencyError("CLRS_GUI_DEP_LOCK_TIMEOUT"); }
        try { await delay(pollMs, undefined, { signal }); }
        catch { checkGuiCancellation(signal); }
    }
}
