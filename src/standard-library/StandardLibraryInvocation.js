import { CLRS_STANDARD_LIBRARY_NAMES } from "./StandardLibraryCatalog.js";

// El runtime histórico usa async también en operaciones que no suspenden.
// PROM/VAR conservan por ahora sus implementaciones asíncronas existentes.
const ASYNC_IMPLEMENTATIONS = new Set([
    "LEER_ARCHIVO", "EXISTE_ARCHIVO", "PESO_ARCHIVO", "CREAR_ARCHIVO",
    "ESCRIBIR_ARCHIVO", "ELIMINAR_ARCHIVO", "PROM", "VAR"
]);
export const SYNCHRONOUS_STANDARD_FUNCTIONS = Object.freeze(
    CLRS_STANDARD_LIBRARY_NAMES.filter(name => !ASYNC_IMPLEMENTATIONS.has(name))
);

export function canInvokeStandardSynchronously(name) {
    return SYNCHRONOUS_STANDARD_FUNCTIONS.includes(name);
}
