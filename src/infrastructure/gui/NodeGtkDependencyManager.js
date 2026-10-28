import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NODE_GTK_RUNTIME_DEPENDENCY as dependency } from "../../standard-library/gui/GuiContract.js";
import { GuiDependencyError, checkGuiCancellation } from "./GuiDependencyError.js";
import { GuiProcessAdapter } from "./GuiProcessAdapter.js";
import { NodeRuntimeInspector } from "./NodeRuntimeInspector.js";
import { PrivateRuntimeLayout } from "./PrivateRuntimeLayout.js";
import { acquirePrivateRuntimeLock } from "./PrivateRuntimeLock.js";
import { NodeGtkResolver } from "./NodeGtkResolver.js";
import { NodeGtkProbe } from "./NodeGtkProbe.js";
import { NpmProcessAdapter } from "./NpmProcessAdapter.js";

export const PRIVATE_GUI_MANIFEST = Object.freeze({ name: "clrs-private-gui-runtime", private: true,
    version: "1.0.0", type: "module", dependencies: Object.freeze({ "node-gtk": dependency.version }) });
const flights = new Map();
const nativeSystemFailures = new Set(["CLRS_GUI_DEP_GTK_NOT_FOUND", "CLRS_GUI_DEP_GTK_TOO_OLD", "CLRS_GUI_DEP_GTK_RESOURCES_UNAVAILABLE"]);

export function validPrivateGuiLock(lock) {
    return [2, 3].includes(lock?.lockfileVersion) && lock.packages?.[""]?.dependencies?.["node-gtk"] === dependency.version &&
        lock.packages?.["node_modules/node-gtk"]?.version === dependency.version &&
        typeof lock.packages["node_modules/node-gtk"].integrity === "string";
}

export class NodeGtkDependencyManager {
    constructor(options) {
        this.layout = options.layout ?? new PrivateRuntimeLayout(options.extensionRoot);
        const processes = options.processAdapter ?? new GuiProcessAdapter();
        this.inspector = options.inspector ?? new NodeRuntimeInspector(processes, options.nodeCommand);
        this.resolver = options.resolver ?? new NodeGtkResolver(processes);
        this.probe = options.probe ?? new NodeGtkProbe(processes);
        this.npm = options.npm ?? new NpmProcessAdapter(processes);
        this.acquireLock = options.acquireLock ?? acquirePrivateRuntimeLock;
        this.lockOptions = options.lockOptions ?? {};
        this.onState = options.onState ?? (() => {});
        this.state = "UNKNOWN";
    }

    transition(state) { this.state = state; this.onState(state); }

    ensure({ signal } = {}) {
        checkGuiCancellation(signal);
        const key = path.resolve(this.layout.extensionRoot) + "\0" + (this.inspector.command ?? "node");
        let flight = flights.get(key);
        if (!flight) {
            flight = { controller: new AbortController(), clients: new Set() };
            flights.set(key, flight);
            flight.promise = Promise.resolve().then(() => this.ensureOnce(flight.controller.signal));
            const forget = () => { if (flights.get(key) === flight) { flights.delete(key); } };
            flight.promise.then(forget, forget);
        }
        return new Promise((resolve, reject) => {
            const client = {};
            flight.clients.add(client);
            const cleanup = () => { flight.clients.delete(client); signal?.removeEventListener("abort", abort); };
            const abort = () => {
                cleanup();
                if (flight.clients.size === 0) {
                    // El último espera la terminación de npm y la limpieza antes de recibir cancelación.
                    flight.controller.abort();
                } else { reject(new GuiDependencyError("CLRS_GUI_DEP_CANCELLED")); }
            };
            signal?.addEventListener("abort", abort, { once: true });
            flight.promise.then(value => {
                cleanup();
                if (signal?.aborted) { reject(new GuiDependencyError("CLRS_GUI_DEP_CANCELLED")); }
                else { this.state = "READY"; resolve(value); }
            }, error => { cleanup(); reject(signal?.aborted ? new GuiDependencyError("CLRS_GUI_DEP_CANCELLED") : error); });
            if (signal?.aborted) { abort(); }
        });
    }

    async ensureOnce(signal) {
        let release, stage;
        this.transition("CHECKING");
        try {
            const runtime = await this.inspector.inspect({ signal });
            checkGuiCancellation(signal);
            this.transition("PLATFORM_READY");
            await this.layout.prepare();
            release = await this.acquireLock(this.layout, { ...this.lockOptions, signal });
            let previousLock;
            try {
                await this.layout.assertSafe(this.layout.packages);
                const manifest = JSON.parse(await readFile(path.join(this.layout.packages, "package.json"), "utf8"));
                previousLock = JSON.parse(await readFile(path.join(this.layout.packages, "package-lock.json"), "utf8"));
                if (manifest.private !== true || manifest.type !== "module" ||
                    manifest.dependencies?.["node-gtk"] !== dependency.version || !validPrivateGuiLock(previousLock)) {
                    throw new GuiDependencyError("CLRS_GUI_DEP_RESOLUTION_FAILED");
                }
                const ready = await this.validate(this.layout.packages, runtime, signal);
                this.transition("READY");
                return ready;
            } catch (error) {
                checkGuiCancellation(signal);
                if (nativeSystemFailures.has(error.code)
                    && !(runtime.platform === "win32" && error.code !== "CLRS_GUI_DEP_GTK_TOO_OLD")) { throw error; }
                this.transition(error.code === "ENOENT" ? "MISSING" : "BROKEN");
            }
            // Una sola instalación/reparación, siempre fuera de packages hasta superar el probe.
            stage = await this.layout.createStage();
            await writeFile(path.join(stage, "package.json"), JSON.stringify(PRIVATE_GUI_MANIFEST, null, 2) + "\n", { flag: "wx" });
            const locked = validPrivateGuiLock(previousLock);
            if (locked) { await writeFile(path.join(stage, "package-lock.json"), JSON.stringify(previousLock) + "\n", { flag: "wx" }); }
            this.transition("INSTALLING");
            await this.npm.install({ packages: stage, cache: this.layout.cache, runtime, locked, signal });
            checkGuiCancellation(signal);
            const lock = JSON.parse(await readFile(path.join(stage, "package-lock.json"), "utf8"));
            if (!validPrivateGuiLock(lock)) { throw new GuiDependencyError("CLRS_GUI_DEP_INSTALL_FAILED"); }
            this.transition("DEPENDENCIES_READY");
            this.transition("CHECKING");
            await this.validate(stage, runtime, signal);
            checkGuiCancellation(signal);
            const ready = await this.layout.publish(stage, packages => this.validate(packages, runtime, signal));
            checkGuiCancellation(signal);
            this.transition("READY");
            return ready;
        } catch (error) {
            if (signal.aborted) { error = new GuiDependencyError("CLRS_GUI_DEP_CANCELLED"); }
            const states = { CLRS_GUI_DEP_NODE_UNSUPPORTED: "INCOMPATIBLE_NODE", CLRS_GUI_DEP_GTK_NOT_FOUND: "MISSING_NATIVE_GTK",
                CLRS_GUI_DEP_GTK_TOO_OLD: "INCOMPATIBLE_GTK", CLRS_GUI_DEP_CANCELLED: "CANCELLED" };
            this.transition(states[error.code] ?? "FAILED");
            if (error instanceof GuiDependencyError) { throw error; }
            throw new GuiDependencyError("CLRS_GUI_DEP_INSTALL_FAILED", error);
        } finally {
            try { if (stage) { await this.layout.removeStage(stage); } }
            finally { if (release) { await release(); } }
        }
    }

    async validate(packages, runtime, signal) {
        checkGuiCancellation(signal);
        const resolved = await this.resolver.resolve(packages, runtime, { signal });
        const gtkVersion = await this.probe.check(resolved, runtime, { signal });
        checkGuiCancellation(signal);
        this.transition("NODE_GTK_READY");
        this.transition("GTK_READY");
        return Object.freeze({ version: dependency.version, entryUrl: resolved.entryUrl, gtkVersion,
            nodeExecutable: runtime.executable, nodeVersion: runtime.version, nodeAbi: runtime.abi, platform: runtime.platform });
    }

}
