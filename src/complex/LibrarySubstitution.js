export function substitution(name) {
    const costs = {
        // FILES
        LEER_ARCHIVO: "n",
        EXISTE_ARCHIVO: "c",
        PESO_ARCHIVO: "c",
        CREAR_ARCHIVO: "c",
        ESCRIBIR_ARCHIVO: "m",
        ELIMINAR_ARCHIVO: "c",

        // MATH
        ABSOLUTO: "c",
        MINIMO: "c",
        MAXIMO: "c",
        REDONDEO: "c",
        PISO: "c",
        RAIZ2: "c",
        RAIZ3: "c",
        EXPONENCIAL: "c",
        LOG: "c",
        LOG10: "c",
        LOG2: "c",
        SENO: "c",
        COSENO: "c",
        TANGENTE: "c",
        ARCOSENO: "c",
        ARCOCOSENO: "c",
        A_RADIANES: "c",
        A_GRADOS: "c",
        PI: "c",
        EULER: "c",
        ALEATORIO: "c",
        PROMEDIO: "n",
        SUMATORIA: "n",
        MEDIANA: "(n log n)",
        VARIANZA: "(2n)",

        // STRINGS
        LONGITUD: "c",
        CARACTER_EN: "c",
        SUB_CADENA: "k",
        BUSCAR: "n",
        CONTIENE: "n",
        MAYUSCULAS: "n",
        MINUSCULAS: "n",
        RECORTAR: "n",
        REEMPLAZAR: "n",
        DIVIDIR: "n",
        ES_NUMERO: "n",
        ES_VACIA: "c",
        EMPIEZA_CON: "m",
        TERMINA_CON: "m",

        // ARRAY
        AGREGAR: "c",
        ELIMINAR: "n",
        INSERTAR: "n",
        BUSCAR_INDICE: "n",
        CONTIENE_VALOR: "n",
        ORDENAR: "(n log n)",
        INVERTIR: "n",
        COPIAR: "n",
        UNIR: "n",

        // TYPES
        TIPO_NUM: "c",
        TIPO_CAD: "c",
        TIPO_LOG: "c",
        A_NUMERO: "c",
        A_CADENA: "c",
        A_LOGICO: "c",

        // ERROR
        LANZAR_ERROR: "c",
    };

    return costs[name] ?? null;
}