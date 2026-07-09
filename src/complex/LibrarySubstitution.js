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
        ABS: "c",
        MIN: "c",
        MAX: "c",
        REDONDEA: "c",
        PISO: "c",
        RAIZ: "c",
        RAIZCUB: "c",
        EXP: "c",
        LOGN: "c",
        LOG10: "c",
        LOG2: "c",
        SEN: "c",
        COS: "c",
        TAN: "c",
        ARC: "c",
        ARCOCOS: "c",
        RAD: "c",
        GRAD: "c",
        PI: "c",
        E: "c",
        ALEAT: "c",
        PROM: "n",
        SUM: "n",
        MED: "(n log n)",
        VAR: "(2n)",

        // STRINGS
        LONG: "c",
        CAR_EN: "c",
        SUBCAD: "k",
        MAYUS: "n",
        MINUS: "n",
        RECORTA: "n",
        REEMP: "n",
        DIV: "n",
        ES_CAD_NUM: "n",
        ES_VAC: "c",
        EMP_CON: "m",
        TERM_CON: "m",

        // ARRAY
        AGREGA: "c",
        ELIM: "n",
        INSER: "n",
        INDICE: "n",
        CONT: "n",
        ORDENA: "(n log n)",
        INVER: "n",
        COPIA: "n",
        UNE: "n",

        // TYPES
        ES_NUM: "c",
        ES_CAD: "c",
        ES_LOG: "c",
        A_NUM: "c",
        A_CAD: "c",
        A_LOG: "c",

        // ERROR
        LANZAR_ERROR: "c",
    };

    return costs[name] ?? null;
}