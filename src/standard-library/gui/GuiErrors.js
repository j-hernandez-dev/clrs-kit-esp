import { freezeGuiContract, getGuiOwnEntry } from "./GuiContract.js";

/** Mensajes sin valores recibidos: nunca interpolar contraseñas u objetos nativos. */
export const GUI_ERROR_MESSAGES = freezeGuiContract({
    CLRS_GUI_INVALID_ID: "El identificador del componente debe ser una cadena no vacía.",
    CLRS_GUI_DUPLICATE_ID: "Ya existe un componente con ese identificador en esta ejecución.",
    CLRS_GUI_COMPONENT_NOT_FOUND: "No existe ese componente en esta ejecución.",
    CLRS_GUI_WRONG_COMPONENT_TYPE: "El componente no es del tipo requerido para esta operación.",
    CLRS_GUI_PROPERTY_NOT_FOUND: "La propiedad no está disponible para este componente.",
    CLRS_GUI_PROPERTY_READ_ONLY: "La propiedad es de sólo lectura y no puede modificarse.",
    CLRS_GUI_PROPERTY_WRITE_ONLY: "La propiedad es de sólo escritura y no puede consultarse.",
    CLRS_GUI_INVALID_PROPERTY_VALUE: "El valor no es compatible con la propiedad.",
    CLRS_GUI_EVENT_NOT_FOUND: "El evento no está disponible para este componente.",
    CLRS_GUI_ACTION_NOT_SUPPORTED: "El componente no admite esta acción.",
    CLRS_GUI_PARENT_CONFLICT: "La relación de contención no es válida; retira explícitamente el hijo antes de cambiarla.",
    CLRS_GUI_CHILD_NOT_FOUND: "El componente no pertenece a este contenedor.",
    CLRS_GUI_INVALID_CALLBACK: "CONECTAR requiere un identificador de función CLRS válido, no una cadena.",
    CLRS_GUI_FILE_NOT_LOCAL: "El recurso seleccionado no puede representarse como una ruta local.",
    CLRS_GUI_DIALOG_RESOURCES_UNAVAILABLE: "GTK no dispone de los recursos de configuración necesarios para abrir el selector de archivos. Comprueba que la instalación de GTK incluya sus esquemas de configuración (GSettings); una instalación nativa incompleta puede carecer de ellos.",
    CLRS_GUI_INVALID_THEME_NAME: "El nombre del tema debe ser una cadena no vacía.",
    CLRS_GUI_THEME_UNAVAILABLE: "GTK no puede cargar el tema solicitado en este entorno.",
    CLRS_GUI_INVALID_THEME_MODE: "El modo de tema debe ser sistema, claro u oscuro.",
    CLRS_GUI_INVALID_ARGUMENT: "La cantidad o el valor de los argumentos no es válido para esta función GUI.",
    CLRS_GUI_CALLBACK_REQUIRES_SYNC: "El evento requiere un callback con respuesta inmediata y sin operaciones asíncronas.",
    CLRS_GUI_FUNCTION_REFERENCE_NOT_ALLOWED: "Las funciones GUI deben invocarse directamente, no utilizarse como valores.",
    CLRS_GUI_RUNTIME_NOT_READY: "El runtime gráfico todavía no está preparado para ejecutar este programa.",
    CLRS_GUI_RUNTIME_UNSUPPORTED: "Esta capacidad gráfica todavía no está implementada en el runtime disponible.",
    CLRS_GUI_RUNTIME_CLOSED: "La sesión gráfica ya ha terminado.",
    CLRS_GUI_NATIVE_OPERATION_FAILED: "GTK no pudo completar la operación gráfica solicitada.",
    CLRS_GUI_DEP_NODE_UNSUPPORTED: "CLRS GUI requiere Node.js 22, 24 o 26 en una plataforma compatible. Se recomienda Node.js 22 LTS.",
    CLRS_GUI_DEP_NPM_NOT_FOUND: "No se encontró npm para preparar la biblioteca gráfica.",
    CLRS_GUI_DEP_RUNTIME_NOT_WRITABLE: "No se puede escribir en el directorio privado de la biblioteca gráfica.",
    CLRS_GUI_DEP_INSTALL_FAILED: "No se pudo instalar la dependencia de la biblioteca gráfica.",
    CLRS_GUI_DEP_REGISTRY_UNAVAILABLE: "No fue posible descargar la dependencia gráfica. Comprueba la conexión y la configuración de npm.",
    CLRS_GUI_DEP_RESOLUTION_FAILED: "No se pudo resolver la dependencia de la biblioteca gráfica.",
    CLRS_GUI_DEP_NATIVE_LOAD_FAILED: "No se pudo cargar el enlace nativo de la biblioteca gráfica.",
    CLRS_GUI_DEP_GTK_NOT_FOUND: "GTK 4 no está disponible o no pudo cargarse. La interfaz gráfica de CLRS requiere GTK 4.10 o superior.",
    CLRS_GUI_DEP_GTK_TOO_OLD: "La biblioteca gráfica requiere GTK 4.10 o posterior. Actualiza GTK en tu entorno.",
    CLRS_GUI_DEP_GTK_RESOURCES_UNAVAILABLE: "No fue posible localizar los recursos de configuración requeridos por GTK.",
    CLRS_GUI_DEP_LOCK_TIMEOUT: "Se agotó la espera para preparar la biblioteca gráfica.",
    CLRS_GUI_DEP_CANCELLED: "La preparación de la biblioteca gráfica fue cancelada.",
    CLRS_JS_EXPORT_INVALID_TARGET: "El destino de exportación no es válido.",
    CLRS_JS_EXPORT_WRITE_FAILED: "No se pudieron preparar los archivos de exportación.",
    CLRS_JS_EXPORT_NPM_NOT_FOUND: "No se encontró npm para generar el archivo de dependencias.",
    CLRS_JS_EXPORT_LOCK_FAILED: "No se pudo generar el archivo de dependencias de la exportación.",
    CLRS_JS_EXPORT_LOCK_INVALID: "El archivo de dependencias generado no cumple el contrato de exportación.",
    CLRS_JS_EXPORT_PUBLISH_FAILED: "No se pudo completar la escritura del proyecto exportado.",
    CLRS_JS_EXPORT_CANCELLED: "La exportación fue cancelada.",
    CLRS_JS_EXPORT_PRIVATE_PATH_LEAK: "La exportación contiene una ruta privada de CLRS y no puede publicarse."
});

export class GuiContractError extends Error {
    constructor(code) {
        const message = getGuiOwnEntry(GUI_ERROR_MESSAGES, code);
        if (message === null) {
            throw new TypeError("Código de error GUI no catalogado.");
        }
        super(message);
        this.name = "GuiContractError";
        this.code = code;
    }
}
