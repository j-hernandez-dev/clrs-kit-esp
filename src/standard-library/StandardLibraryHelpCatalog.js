import {
    CLRS_STANDARD_LIBRARY_NAMES,
    getStandardLibraryDefinition
} from "./StandardLibraryCatalog.js";
import { GUI_EDITOR_HELP } from "./gui/GuiEditorCatalog.js";

const RAW_HELP = Object.freeze({
    LEER_ARCHIVO: help(
        ["ruta"],
        "Lee el contenido de un archivo."
    ),
    EXISTE_ARCHIVO: help(
        ["ruta"],
        "Determina si un archivo existe."
    ),
    PESO_ARCHIVO: help(
        ["ruta"],
        "Obtiene el tamaño de un archivo en bytes."
    ),
    CREAR_ARCHIVO: help(
        ["ruta"],
        "Crea un archivo vacío."
    ),
    ESCRIBIR_ARCHIVO: help(
        ["ruta", "contenido"],
        "Agrega contenido al final de un archivo."
    ),
    ELIMINAR_ARCHIVO: help(
        ["ruta"],
        "Elimina un archivo."
    ),
    ABS: help(
        ["numero"],
        "Obtiene el valor absoluto de un número."
    ),
    MIN: help(
        ["a", "b"],
        "Obtiene el menor de dos números."
    ),
    MAX: help(
        ["a", "b"],
        "Obtiene el mayor de dos números."
    ),
    REDONDEA: help(
        ["numero"],
        "Redondea un número al entero más cercano."
    ),
    PISO: help(
        ["numero"],
        "Obtiene el entero inferior de un número."
    ),
    RAIZ: help(
        ["numero"],
        "Calcula la raíz cuadrada de un número."
    ),
    RAIZCUB: help(
        ["numero"],
        "Calcula la raíz cúbica de un número."
    ),
    EXP: help(
        ["numero"],
        "Calcula el número de Euler elevado al valor indicado."
    ),
    LOGN: help(
        ["numero"],
        "Calcula el logaritmo natural."
    ),
    LOG10: help(
        ["numero"],
        "Calcula el logaritmo en base 10."
    ),
    LOG2: help(
        ["numero"],
        "Calcula el logaritmo en base 2."
    ),
    SEN: help(
        ["radianes"],
        "Calcula el seno de un ángulo en radianes."
    ),
    COS: help(
        ["radianes"],
        "Calcula el coseno de un ángulo en radianes."
    ),
    TAN: help(
        ["radianes"],
        "Calcula la tangente de un ángulo en radianes."
    ),
    ARC: help(
        ["numero"],
        "Calcula el arcoseno."
    ),
    ARCOCOS: help(
        ["numero"],
        "Calcula el arcocoseno."
    ),
    RAD: help(
        ["grados"],
        "Convierte grados a radianes."
    ),
    GRAD: help(
        ["radianes"],
        "Convierte radianes a grados."
    ),
    PI: help(
        [],
        "Obtiene el valor de π."
    ),
    E: help(
        [],
        "Obtiene el número de Euler."
    ),
    ALEAT: help(
        ["minimo", "maximo"],
        "Genera un número aleatorio entre dos límites."
    ),
    PROM: help(
        ["arreglo"],
        "Calcula el promedio de un arreglo de números."
    ),
    SUM: help(
        ["arreglo"],
        "Calcula la suma de un arreglo de números."
    ),
    MED: help(
        ["arreglo"],
        "Calcula la mediana de un arreglo de números."
    ),
    VAR: help(
        ["arreglo"],
        "Calcula la varianza de un arreglo de números."
    ),
    LONG: help(
        ["estructura"],
        "Obtiene la longitud de una cadena o un arreglo."
    ),
    CAR_EN: help(
        ["cadena", "posicion"],
        "Obtiene el carácter ubicado en una posición."
    ),
    SUBCAD: help(
        ["cadena", "inicio", "fin"],
        "Obtiene una subcadena dentro de un rango."
    ),
    MAYUS: help(
        ["cadena"],
        "Convierte una cadena a mayúsculas."
    ),
    MINUS: help(
        ["cadena"],
        "Convierte una cadena a minúsculas."
    ),
    RECORTA: help(
        ["cadena"],
        "Elimina los espacios al inicio y al final."
    ),
    REEMP: help(
        ["cadena", "viejo", "nuevo"],
        "Reemplaza todas las apariciones de un texto."
    ),
    DIV: help(
        ["cadena", "separador"],
        "Divide una cadena utilizando un separador."
    ),
    ES_CAD_NUM: help(
        ["cadena"],
        "Determina si una cadena representa un número."
    ),
    ES_VAC: help(
        ["cadena"],
        "Determina si una cadena está vacía."
    ),
    EMP_CON: help(
        ["cadena", "texto"],
        "Determina si una cadena comienza con otro texto."
    ),
    TERM_CON: help(
        ["cadena", "texto"],
        "Determina si una cadena termina con otro texto."
    ),
    AGREGA: help(
        ["arreglo", "valor"],
        "Agrega un elemento al final de un arreglo."
    ),
    ELIM: help(
        ["arreglo", "indice"],
        "Elimina el elemento ubicado en un índice."
    ),
    INSER: help(
        ["arreglo", "indice", "valor"],
        "Inserta un elemento en un índice determinado."
    ),
    INDICE: help(
        ["arreglo", "valor"],
        "Obtiene el índice de un elemento en un arreglo."
    ),
    CONT: help(
        ["arreglo", "valor"],
        "Determina si un arreglo contiene un elemento."
    ),
    ORDENA: help(
        ["arreglo"],
        "Ordena un arreglo de forma ascendente."
    ),
    INVER: help(
        ["arreglo"],
        "Invierte el orden de los elementos de un arreglo."
    ),
    COPIA: help(
        ["arreglo"],
        "Crea una copia independiente de un arreglo."
    ),
    UNE: help(
        ["arreglo", "separador"],
        "Une los elementos de un arreglo mediante un separador."
    ),
    ES_NUM: help(
        ["valor"],
        "Determina si un valor es de tipo número."
    ),
    ES_CAD: help(
        ["valor"],
        "Determina si un valor es de tipo cadena."
    ),
    ES_LOG: help(
        ["valor"],
        "Determina si un valor es de tipo lógico."
    ),
    A_NUM: help(
        ["valor"],
        "Convierte un valor a número."
    ),
    A_CAD: help(
        ["valor"],
        "Convierte un valor a cadena."
    ),
    A_LOG: help(
        ["valor"],
        "Convierte un valor a lógico."
    ),
    LANZAR_ERROR: help(
        ["mensaje"],
        "Interrumpe el programa con un error definido por el usuario."
    )
});

export const CLRS_STANDARD_LIBRARY_HELP =
    Object.freeze(
        { ...Object.fromEntries(
            CLRS_STANDARD_LIBRARY_NAMES
                .map(name => {
                    const raw =
                        RAW_HELP[name];

                    if (raw == null) {
                        throw new Error(
                            "Missing language help for standard function " +
                            name
                        );
                    }

                    const definition =
                        getStandardLibraryDefinition(
                            name
                        );

                    return [
                        name,
                        Object.freeze({
                            name,
                            signature:
                                formatSignature(
                                    name,
                                    raw.parameters
                                ),
                            parameters:
                                raw.parameters,
                            documentation:
                                raw.documentation,
                            returnType:
                                definition
                                    .returnType,
                            cost:
                                definition.cost
                        })
                    ];
                })
        ), ...GUI_EDITOR_HELP }
    );

export function getStandardLibraryHelp(
    name
) {
    return (
        CLRS_STANDARD_LIBRARY_HELP[
            name
        ] ??
        null
    );
}

function help(
    parameters,
    documentation
) {
    return Object.freeze({
        parameters:
            Object.freeze([
                ...parameters
            ]),
        documentation
    });
}

function formatSignature(
    name,
    parameters
) {
    return (
        name +
        "(" +
        parameters.join(", ") +
        ")"
    );
}
