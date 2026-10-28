import { LanguageError } from "../../errors/LanguageError.js";
import { GUI_ERROR_MESSAGES } from "../../standard-library/gui/GuiErrors.js";
import { guiEnvironmentMessage } from "../../standard-library/gui/runtime/GuiEnvironmentProbe.js";

export class GuiDependencyError extends LanguageError {
    constructor(code, cause, platform = process.platform) {
        super(guiEnvironmentMessage(code, GUI_ERROR_MESSAGES, platform), "GuiDependencyError", null, {
            phase: "runtime-dependency", code, cause
        });
    }
}

export function checkGuiCancellation(signal) {
    if (signal?.aborted) { throw new GuiDependencyError("CLRS_GUI_DEP_CANCELLED"); }
}
