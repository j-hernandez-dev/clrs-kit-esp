import { GuiDependencyError } from "../../infrastructure/gui/GuiDependencyError.js";
import { LanguageError } from "../../errors/LanguageError.js";
import { GUI_ERROR_MESSAGES } from "../../standard-library/gui/GuiErrors.js";

/** Adaptador fino del mismo puerto GUI de compilación; no instala ni carga GTK. */
export async function prepareCLRSTestRuntime(preparation, semanticModel, signal) {
    if (!semanticModel?.gui?.usage.requiresGui) { return { runtimeContext: null, processOptions: {} }; }
    if (!preparation) { throw new GuiDependencyError("CLRS_GUI_RUNTIME_NOT_READY"); }
    const runtimeContext = await preparation.prepare({ semanticModel, signal });
    if (!runtimeContext?.gui) { throw new GuiDependencyError("CLRS_GUI_RUNTIME_NOT_READY"); }
    return { runtimeContext, processOptions: { gui: true,
        ...(runtimeContext.gui.nodeExecutable ? { nodeExecutable: runtimeContext.gui.nodeExecutable } : {}) } };
}

export function guiTestPreparationDiagnostic(error) {
    return error instanceof LanguageError && Object.hasOwn(GUI_ERROR_MESSAGES, error.code)
        ? { code: error.code, message: error.publicMessage.replace(/\s+/gu, " ").trim().slice(0, 2000) } : null;
}
