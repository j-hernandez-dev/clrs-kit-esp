import { freezeGuiContract } from "./GuiContract.js";

/** Modelo estático del trabajo directo de la API; no es una medida de latencia GTK. */
export const GUI_COST_ASSUMPTIONS = freezeGuiContract([
    "GUI: se cuenta el trabajo directo de cada llamada con argumentos válidos; accesos al registro y operaciones GTK elementales tienen costo unitario en este modelo.",
    "GUI: volumen GUI(dato) mide caracteres y valores/celdas recorridos, incluidas dimensiones interiores; los identificadores, nombres de propiedades y eventos se consideran acotados.",
    "GUI: dato GUI(v, l) sólo anota volumen v y longitud exterior l, cuando se conoce, durante la composición algebraica; no es un número ni una función CLRS. Las medidas de entrada presuponen que otros callbacks no mutan esos datos concurrentemente.",
    "GUI: se excluyen aprovisionamiento/inicialización del entorno, dibujado/composición nativa, latencia de E/S y espera humana. Una ventana abierta no determina por sí misma la complejidad del algoritmo.",
    "GUI: CONECTAR registra, no ejecuta el callback. Cada callback se analiza por invocación; ni la cantidad de eventos ni su despacho (incluidos payloads y callbacks inmediatos) forman parte del costo directo de las llamadas GUI. El informe no acota la sesión interactiva completa."
]);

// Esta medida sólo existe en el álgebra: NO es un símbolo invocable desde CLRS.
export const GUI_VOLUME_MEASURE = "volumen GUI";
const constant = detail => ({ kind: "constant", formula: "c", detail });
const volume = (argumentsList, detail) => ({ kind: "volume", arguments: argumentsList,
    formula: "c + volumen de los argumentos indicados", detail });
const state = (formula, detail) => ({ kind: "state", formula, detail });

const ACTION_COSTS = {
    MOSTRAR: constant("Una solicitud de presentación; no incluye el renderizado nativo ni el despacho de eventos."),
    OCULTAR: constant("Una solicitud de ocultación."), ENFOCAR: constant("Una solicitud de foco."),
    CONTENER: state("c + h", "Recorre h ancestros para comprobar ciclos de contención."),
    ANEXAR: state("c + h", "Recorre h ancestros antes de anexar el hijo."),
    PREPONER: state("c + h", "Recorre h ancestros antes de anteponer el hijo."),
    COLOCAR: state("c + h", "Recorre h ancestros y valida una cantidad fija de coordenadas."),
    QUITAR: constant("Retira un hijo y actualiza el registro, sin destruir su subárbol."),
    CERRAR: state("costo de desmontar el estado alcanzado", "El cierre recorre ventanas y puede liberar subárboles, handlers y diálogos. La búsqueda y retirada de conexiones puede ser cuadrática en su cantidad; no se presume un cierre constante o lineal."),
    MAXIMIZAR: constant("Una solicitud de estado de ventana."), MINIMIZAR: constant("Una solicitud de estado de ventana."),
    PANTALLA_COMPLETA: constant("Una solicitud de estado de ventana."), RESTAURAR: constant("Una cantidad fija de solicitudes de estado de ventana."),
    PULSAR_PROGRESO: constant("Un pulso; no incluye el dibujado posterior."), INICIAR: constant("Activa el indicador."), PARAR: constant("Desactiva el indicador."),
    MARCAR_DIA: constant("Una marca en un calendario de tamaño acotado."), DESMARCAR_DIA: constant("Una marca en un calendario de tamaño acotado."),
    LIMPIAR_MARCAS: constant("El calendario tiene como máximo 31 marcas."), LIMPIAR_IMAGEN: constant("Retira la referencia a la imagen; no decodifica un recurso."),
    ANEXAR_FILA: volume([1], "Valida, copia y serializa todas las celdas de la fila; costo amortizado de anexado al modelo, sin dibujado de celdas."),
    QUITAR_FILA: state("c + filas", "La retirada depende del tamaño y actualización del modelo de filas."),
    LIMPIAR_FILAS: state("c + volumen de las filas almacenadas", "La limpieza depende del modelo almacenado, no sólo del identificador recibido."),
    MOSTRAR_ALERTA: state("c + volumen de la configuración", "Reconstruye una instantánea de la alerta sin esperar su respuesta."),
    ELEGIR_ALERTA: state("c + volumen de la configuración", "Reconstruye la alerta; la espera del usuario no es trabajo computacional."),
    ABRIR_ARCHIVO: state("c + volumen de la configuración + longitud de la ruta", "Reconstruye el selector y convierte su resultado; no lee el archivo ni cuenta la espera humana."),
    ABRIR_ARCHIVOS: state("c + volumen de la configuración + volumen de las rutas", "Recorre todos los resultados seleccionados; no lee los archivos ni cuenta la espera humana."),
    GUARDAR_ARCHIVO: state("c + volumen de la configuración + longitud de la ruta", "Selecciona una ruta; no escribe el archivo ni cuenta la espera humana."),
    ELEGIR_CARPETA: state("c + volumen de la configuración + longitud de la ruta", "Convierte una ruta seleccionada; no recorre su contenido ni cuenta la espera humana."),
    ELEGIR_CARPETAS: state("c + volumen de la configuración + volumen de las rutas", "Recorre las rutas seleccionadas, no sus contenidos ni la espera humana.")
};

function variableDomain(domain) {
    if (domain.oneOf) { return domain.oneOf.some(variableDomain); }
    if (domain.tuple) { return domain.tuple.some(variableDomain); }
    return domain.type === "array" || (domain.type === "string" && !domain.enum && domain.role !== "component-id");
}

export function guiFunctionCost(name, definition) {
    if (definition.kind === "factory") {
        if (definition.componentType === "Image") {
            return freezeGuiContract({ kind: "external", formula: "c + carga y decodificación de la imagen",
                detail: "La longitud de la ruta no mide los bytes ni los píxeles decodificados; no se conoce ese costo desde el AST." });
        }
        const indices = definition.parameters.flatMap((parameter, index) => index > 0 && variableDomain(parameter.domain) ? [index] : []);
        return freezeGuiContract(indices.length ? volume(indices, "Valida y transfiere el contenido inicial; las colecciones se recorren y copian.")
            : constant("Crea un componente con una cantidad acotada de campos."));
    }
    if (name === "ESTABLECER" || name === "OBTENER") {
        return freezeGuiContract({ kind: "property", formula: "según propiedad y estado del componente",
            detail: "Las propiedades escalares no equivalen a las de texto, selección, datos o filtros. Una propiedad dinámica no recibe costo constante por defecto." });
    }
    if (name === "CONECTAR") { return freezeGuiContract({ kind: "event", formula: "c + instantánea inicial del evento, si corresponde",
        detail: "Registra señales/controladores; los eventos de cambio pueden copiar y serializar el estado inicial para evitar duplicados. No suma el cuerpo del callback." }); }
    if (name === "ESTABLECER_TEMA") { return freezeGuiContract(volume([0], "Valida y transfiere el nombre del tema; no incluye recálculo de estilos ni repintado GTK.")); }
    if (name === "OBTENER_TEMA") { return freezeGuiContract(state("c + longitud del nombre del tema", "Devuelve un nombre de tema de longitud dependiente del estado de GTK.")); }
    if (definition.kind === "theme") { return freezeGuiContract(constant("Consulta o solicita un modo de tema de dominio acotado; no incluye recálculo de estilos ni repintado GTK.")); }
    if (!Object.hasOwn(ACTION_COSTS, name)) { throw new Error(`Falta el contrato de costo GUI de ${name}.`); }
    return freezeGuiContract(ACTION_COSTS[name]);
}

export function guiEventConnectionCost(event) {
    if (event == null || ["cambio", "seleccion_cambiada"].includes(event)) {
        return state("c + volumen de la instantánea inicial", "La conexión puede leer, copiar y serializar texto o selección almacenados para evitar eventos duplicados; el callback no se ejecuta al registrarlo.");
    }
    return constant("Registra un número acotado de señales/controladores y, cuando corresponde, una instantánea escalar o de fecha fija; no suma el cuerpo del callback.");
}

/** El tipo efectivo se resuelve desde el catálogo, no por el prefijo de un ID. */
export function guiPropertyCost(componentType, property, descriptor, write) {
    if (["AlertDialog", "FileDialog"].includes(componentType) && write) {
        return state("c + volumen de la configuración", "El setter reconstruye toda la instantánea del diálogo, incluidos botones o filtros anteriores.");
    }
    if (["datos", "columnas", "opciones", "seleccion", "modo_seleccion", "grupo", "valor"].includes(property)) {
        // selección/valor escalares sí son acotados fuera de listas/tablas.
        if ((property === "modo_seleccion" && !write)
            || (property === "seleccion" && componentType === "DropDown")
            || (property === "valor" && !["DropDown", "ColumnView", "ListBox"].includes(componentType))) {
            return constant("Consulta o modifica un escalar.");
        }
        if (property === "grupo") { return state("c + tamaño de los grupos afectados", "La consulta o reasignación puede recorrer los miembros ya registrados del grupo."); }
        if (property === "columnas" && write) {
            return state("validación de filas y reconstrucción de columnas/conexiones", "Valida las filas existentes, desmonta columnas anteriores y reconstruye sus factories y conexiones; el costo no depende sólo de los nuevos títulos.");
        }
        if (!write && ["datos", "columnas", "opciones", "valor"].includes(property)) {
            return state("c + volumen del valor almacenado", "Recorre, valida o copia los datos devueltos desde el modelo de GTK.");
        }
        return state(property === "seleccion" ? "c + filas + seleccionados log(seleccionados)" : "c + volumen del modelo anterior y del nuevo",
            "El costo depende del modelo, el modo de selección o el grupo ya almacenado; puede recorrer, validar, copiar u ordenar valores.");
    }
    if (componentType === "Image" && ["archivo", "icono"].includes(property) && write) {
        return { kind: "external", formula: "c + carga del recurso", detail: "La ruta o nombre no determina el costo de cargar la imagen." };
    }
    if (variableDomain(descriptor.domain)) {
        return write ? volume([2], "Valida y transfiere el texto o colección recibidos.")
            : state("c + volumen del valor almacenado", "La lectura copia o valida un valor cuyo tamaño depende del estado del componente.");
    }
    return constant("Consulta o modifica una propiedad de tamaño acotado.");
}
