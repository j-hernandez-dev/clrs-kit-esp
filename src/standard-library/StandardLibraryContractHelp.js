import { CLRS_STANDARD_LIBRARY_HELP } from "./StandardLibraryHelpCatalog.js";
import { GUI_FUNCTION_DEFINITIONS } from "./gui/GuiFunctionCatalog.js";
import { getGuiOwnEntry, freezeGuiContract } from "./gui/GuiContract.js";

/** Firmas y ayuda preparadas para los consumidores del contrato, no para completados activos aún. */
export const CLRS_STANDARD_LIBRARY_CONTRACT_HELP = freezeGuiContract({
    ...CLRS_STANDARD_LIBRARY_HELP,
    ...Object.fromEntries(Object.entries(GUI_FUNCTION_DEFINITIONS).map(([name, definition]) => [name, {
        name, signature: definition.signature,
        parameters: definition.parameters.map(parameter => parameter.name),
        parameterDetails: definition.parameters,
        documentation: definition.documentation,
        returnType: definition.returnType,
        returns: definition.returns,
        cost: definition.cost,
        capability: definition.capability,
        availability: definition.availability
    }]))
});

export function getStandardLibraryContractHelp(name) {
    return getGuiOwnEntry(CLRS_STANDARD_LIBRARY_CONTRACT_HELP, name);
}
