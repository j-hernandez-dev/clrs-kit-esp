export const JavaScriptExportProfiles = Object.freeze({
    CLI: "cli",
    GUI: "gui"
});

const validProfiles = new Set(Object.values(JavaScriptExportProfiles));

/**
 * Clasifica una exportación permanente exclusivamente desde el modelo
 * semántico. Nunca inspecciona texto fuente ni JavaScript generado.
 */
export function classifyJavaScriptExportProfile(semanticModel) {
    const requiresGui = semanticModel?.gui?.usage?.requiresGui;
    if (typeof requiresGui !== "boolean") {
        throw new TypeError("El modelo semántico no declara si el programa requiere GUI.");
    }
    return requiresGui ? JavaScriptExportProfiles.GUI : JavaScriptExportProfiles.CLI;
}

export function requireJavaScriptExportProfile(profile) {
    if (!validProfiles.has(profile)) {
        throw new TypeError("El perfil de exportación JavaScript no es válido.");
    }
    return profile;
}
