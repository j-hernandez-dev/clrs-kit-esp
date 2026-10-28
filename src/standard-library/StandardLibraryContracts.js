import { CLRS_STANDARD_LIBRARY } from "./StandardLibraryCatalog.js";
import { GUI_FUNCTION_DEFINITIONS } from "./gui/GuiFunctionCatalog.js";
import { getGuiOwnEntry } from "./gui/GuiContract.js";

/**
 * Catálogo completo de contratos estándar. La proyección ejecutable histórica
 * continúa en CLRS_STANDARD_LIBRARY hasta integrar el runtime GUI completo.
 * No usar esta lista como prueba de que una función ya se puede ejecutar.
 */
export const CLRS_STANDARD_LIBRARY_CONTRACTS = Object.freeze({
    ...CLRS_STANDARD_LIBRARY,
    ...GUI_FUNCTION_DEFINITIONS
});

export const CLRS_STANDARD_LIBRARY_CONTRACT_NAMES = Object.freeze(
    Object.keys(CLRS_STANDARD_LIBRARY_CONTRACTS)
);

export function getStandardLibraryContract(name) {
    return getGuiOwnEntry(CLRS_STANDARD_LIBRARY_CONTRACTS, name);
}

export function getStandardLibraryCapability(name) {
    return getStandardLibraryContract(name)?.capability ?? null;
}
