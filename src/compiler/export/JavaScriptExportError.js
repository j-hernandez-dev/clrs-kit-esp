import { LanguageError } from "../../errors/LanguageError.js";

const messages = {
    INVALID_TARGET: "El destino del proyecto JavaScript no es válido o contiene enlaces no seguros.",
    WRITE_FAILED: "No fue posible escribir el proyecto JavaScript temporal.",
    NPM_NOT_FOUND: "No se encontró Node.js/npm. Instálalos o revisa su disponibilidad para generar el proyecto JavaScript.",
    LOCK_FAILED: "No fue posible resolver las dependencias del proyecto JavaScript. Comprueba la conexión y la configuración de npm para generar package-lock.json.",
    LOCK_INVALID: "El package-lock.json generado no coincide con el contrato del proyecto JavaScript.",
    PUBLISH_FAILED: "No fue posible publicar el proyecto JavaScript. La exportación anterior se conserva en el destino o en su copia de respaldo.",
    CANCELLED: "La exportación JavaScript fue cancelada. No se publicó un proyecto parcial.",
    INVALID_PROFILE: "No fue posible determinar un perfil válido para la exportación JavaScript.",
    PRIVATE_PATH_LEAK: "La exportación contiene una dependencia de la instalación privada de CLRS y no puede publicarse."
};
export class JavaScriptExportError extends LanguageError {
    constructor(reason, cause) {
        super(messages[reason], "JavaScriptExportError", null, {
            phase: "io", code: `CLRS_JS_EXPORT_${reason}`, cause
        });
    }
}
export function checkExportCancellation(signal) {
    if (signal?.aborted) { throw new JavaScriptExportError("CANCELLED"); }
}
