/** Funciones autocontenidas para incluir la misma implementación en JS temporal/exportado. */
export function createGuiCallbackReference(callback, synchronous, location) {
    return Object.freeze({ callback, synchronous, location });
}

export function invokeGuiCallback(reference, id, args, immediate = false) {
    const fail = message => {
        const error = new Error(message);
        error.name = "CLRSUserError";
        error.code = "CLRS_GUI_CALLBACK_REQUIRES_SYNC";
        error.location = reference.location;
        throw error;
    };
    if (immediate && !reference.synchronous) {
        return fail("Este evento requiere un callback con respuesta inmediata, sin operaciones asíncronas.");
    }
    if (!immediate) {
        // La promesa resultante pertenece al runtime: debe rastrearla y localizar su rechazo.
        return Promise.resolve().then(() => reference.callback(id, ...args)).catch(error => {
            if (error instanceof Error && !error.location) { error.location = reference.location; }
            throw error;
        });
    }
    let value;
    try { value = reference.callback(id, ...args); }
    catch (error) {
        if (error instanceof Error && !error.location) { error.location = reference.location; }
        throw error;
    }
    if (value != null && typeof value.then === "function") {
        Promise.resolve(value).catch(() => {});
        return fail("El callback intentó devolver una promesa a un evento síncrono de GTK.");
    }
    if (value != null && typeof value !== "boolean") {
        return fail("El callback de este evento debe devolver un valor lógico o NULO.");
    }
    return value === true;
}
