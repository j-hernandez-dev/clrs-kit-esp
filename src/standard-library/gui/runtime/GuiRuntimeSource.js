import { GUI_DOMAINS, getGuiOwnEntry } from "../GuiContract.js";
import { GUI_COMPONENTS, getGuiComponentDefinition } from "../GuiComponentCatalog.js";
import { GUI_FUNCTION_DEFINITIONS } from "../GuiFunctionCatalog.js";
import { GUI_ERROR_MESSAGES, GuiContractError } from "../GuiErrors.js";
import { getGuiRuntimeValidationSource } from "../GuiContractValidation.js";
import { createGuiBaseRuntime } from "./GuiBaseRuntime.js";
import { createGuiControlsAdapter } from "./GuiControlsAdapter.js";
import { createGuiModelsAdapter } from "./GuiModelsAdapter.js";
import { createGuiEventsAdapter } from "./GuiEventsAdapter.js";
import { createGuiDialogsAdapter } from "./GuiDialogsAdapter.js";
import { createGuiEventLoop } from "./GuiEventLoop.js";

/** Una sola implementación, autocontenida tanto en JS temporal como exportado. */
export function getGuiRuntimeFactorySource() {
    // El modelo de costo pertenece al análisis/editor, no al programa generado.
    const runtimeDefinitions = Object.fromEntries(Object.entries(GUI_FUNCTION_DEFINITIONS).map(([name, definition]) => [
        name, Object.fromEntries(Object.entries(definition).filter(([key]) => key !== "cost" && key !== "costStatus"))
    ]));
    return `async function(binding, options) {
        const GUI_DOMAINS = ${JSON.stringify(GUI_DOMAINS)};
        const GUI_COMPONENTS = ${JSON.stringify(GUI_COMPONENTS)};
        const GUI_FUNCTION_DEFINITIONS = ${JSON.stringify(runtimeDefinitions)};
        const GUI_ERROR_MESSAGES = ${JSON.stringify(GUI_ERROR_MESSAGES)};
        ${getGuiOwnEntry.toString()}
        ${getGuiComponentDefinition.toString()}
        const GuiContractError = (${GuiContractError.toString()});
        ${getGuiRuntimeValidationSource()}
        try {
            return await (${createGuiBaseRuntime.toString()})(binding, options, {
                GUI_COMPONENTS, GuiContractError, assertGuiArgumentDomains, assertGuiNewIdentifier,
                requireGuiProperty, assertGuiPropertyDomain, requireGuiEvent, requireGuiAction, isGuiValueInDomain,
                createControls: (${createGuiControlsAdapter.toString()}),
                createModels: (${createGuiModelsAdapter.toString()}),
                createEvents: (${createGuiEventsAdapter.toString()}),
                createDialogs: (${createGuiDialogsAdapter.toString()}),
                createEventLoop: (${createGuiEventLoop.toString()})
            });
        } catch (cause) {
            const error = cause instanceof GuiContractError ? cause : new GuiContractError("CLRS_GUI_NATIVE_OPERATION_FAILED");
            error.name = "CLRSUserError";
            throw error;
        }
    }`;
}
