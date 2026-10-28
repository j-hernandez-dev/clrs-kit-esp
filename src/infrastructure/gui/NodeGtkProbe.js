import { GuiDependencyError, checkGuiCancellation } from "./GuiDependencyError.js";
import { createGuiProbeRequest, decodeGuiProbeResult } from "../../standard-library/gui/runtime/GuiEnvironmentProbe.js";

export class NodeGtkProbe {
    constructor(processAdapter) { this.process = processAdapter; }

    async check(resolved, runtime, { signal, capabilities = ["gui"] } = {}) {
        let request;
        try {
            request = await createGuiProbeRequest(resolved.entryUrl, capabilities);
            const result = await this.process.run(runtime.executable, ["--input-type=module", "-e",
                request.source], { signal, timeoutMs: 10_000 });
            const value = decodeGuiProbeResult(result);
            if (!value.ok) { throw new GuiDependencyError(value.code, new Error(value.detail), runtime.platform); }
            if (!Array.isArray(value.gtkVersion) || value.gtkVersion[0] !== 4 || value.gtkVersion[1] < 10) {
                throw new GuiDependencyError("CLRS_GUI_DEP_GTK_TOO_OLD", undefined, runtime.platform);
            }
            return Object.freeze(value.gtkVersion);
        } catch (error) {
            checkGuiCancellation(signal);
            if (error instanceof GuiDependencyError) { throw error; }
            throw new GuiDependencyError("CLRS_GUI_DEP_NATIVE_LOAD_FAILED", error, runtime.platform);
        } finally { await request?.cleanup(); }
    }
}
