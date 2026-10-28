export const StandardLibraryCost =
    Object.freeze({
        CONSTANT: "constant",
        LINEAR_N: "linear-n",
        LINEAR_M: "linear-m",
        LINEAR_K: "linear-k",
        N_LOG_N: "n-log-n",
        TWO_N: "two-n"
    });

export const StandardLibraryReturnType =
    Object.freeze({
        UNKNOWN: "unknown",
        VOID: "void",
        NEVER: "never",
        NUMBER: "number",
        STRING: "string",
        BOOLEAN: "boolean",
        ARRAY: "array"
    });

export const StandardLibrarySymbolicEffect =
    Object.freeze({
        OPAQUE: "opaque",
        CONSTANT: "constant",
        ROUNDING: "rounding",
        ABSOLUTE: "absolute",
        SIZE: "size",
        LOGARITHMIC: "logarithmic",
        ROOT: "root",
        EXPONENTIAL: "exponential",
        LINEAR: "linear",
        BOUNDED: "bounded",
        EXTREMUM: "extremum"
    });

const {
    CONSTANT,
    LINEAR_N,
    LINEAR_M,
    LINEAR_K,
    N_LOG_N,
    TWO_N
} = StandardLibraryCost;
const {
    UNKNOWN,
    VOID,
    NEVER,
    NUMBER,
    STRING,
    BOOLEAN,
    ARRAY
} = StandardLibraryReturnType;
const Effect =
    StandardLibrarySymbolicEffect;

export const CLRS_STANDARD_LIBRARY =
    Object.freeze({
        // Files
        LEER_ARCHIVO:
            definition(
                LINEAR_N,
                STRING
            ),
        EXISTE_ARCHIVO:
            definition(
                CONSTANT,
                BOOLEAN
            ),
        PESO_ARCHIVO:
            definition(
                CONSTANT,
                NUMBER
            ),
        CREAR_ARCHIVO:
            definition(
                CONSTANT,
                VOID
            ),
        ESCRIBIR_ARCHIVO:
            definition(
                LINEAR_M,
                VOID
            ),
        ELIMINAR_ARCHIVO:
            definition(
                CONSTANT,
                VOID
            ),

        // Mathematics
        ABS:
            definition(
                CONSTANT,
                NUMBER,
                symbolic(
                    Effect.ABSOLUTE
                )
            ),
        MIN:
            definition(
                CONSTANT,
                NUMBER,
                symbolic(
                    Effect.EXTREMUM,
                    {
                        operation: "minimum"
                    }
                )
            ),
        MAX:
            definition(
                CONSTANT,
                NUMBER,
                symbolic(
                    Effect.EXTREMUM,
                    {
                        operation: "maximum"
                    }
                )
            ),
        REDONDEA:
            definition(
                CONSTANT,
                NUMBER,
                symbolic(
                    Effect.ROUNDING
                )
            ),
        PISO:
            definition(
                CONSTANT,
                NUMBER,
                symbolic(
                    Effect.ROUNDING,
                    {
                        direction: "floor"
                    }
                )
            ),
        RAIZ:
            definition(
                CONSTANT,
                NUMBER,
                symbolic(
                    Effect.ROOT,
                    {
                        exponent: 1 / 2
                    }
                )
            ),
        RAIZCUB:
            definition(
                CONSTANT,
                NUMBER,
                symbolic(
                    Effect.ROOT,
                    {
                        exponent: 1 / 3
                    }
                )
            ),
        EXP:
            definition(
                CONSTANT,
                NUMBER,
                symbolic(
                    Effect.EXPONENTIAL,
                    {
                        base: Math.E
                    }
                )
            ),
        LOGN:
            definition(
                CONSTANT,
                NUMBER,
                symbolic(
                    Effect.LOGARITHMIC
                )
            ),
        LOG10:
            definition(
                CONSTANT,
                NUMBER,
                symbolic(
                    Effect.LOGARITHMIC,
                    {
                        base: 10
                    }
                )
            ),
        LOG2:
            definition(
                CONSTANT,
                NUMBER,
                symbolic(
                    Effect.LOGARITHMIC,
                    {
                        base: 2
                    }
                )
            ),
        SEN:
            definition(
                CONSTANT,
                NUMBER,
                symbolic(
                    Effect.BOUNDED
                )
            ),
        COS:
            definition(
                CONSTANT,
                NUMBER,
                symbolic(
                    Effect.BOUNDED
                )
            ),
        TAN:
            definition(
                CONSTANT,
                NUMBER
            ),
        ARC:
            definition(
                CONSTANT,
                NUMBER,
                symbolic(
                    Effect.BOUNDED
                )
            ),
        ARCOCOS:
            definition(
                CONSTANT,
                NUMBER,
                symbolic(
                    Effect.BOUNDED
                )
            ),
        RAD:
            definition(
                CONSTANT,
                NUMBER,
                symbolic(
                    Effect.LINEAR
                )
            ),
        GRAD:
            definition(
                CONSTANT,
                NUMBER,
                symbolic(
                    Effect.LINEAR
                )
            ),
        PI:
            definition(
                CONSTANT,
                NUMBER,
                symbolic(
                    Effect.CONSTANT
                )
            ),
        E:
            definition(
                CONSTANT,
                NUMBER,
                symbolic(
                    Effect.CONSTANT
                )
            ),
        ALEAT:
            definition(
                CONSTANT,
                NUMBER
            ),
        PROM:
            definition(
                LINEAR_N,
                NUMBER
            ),
        SUM:
            definition(
                LINEAR_N,
                NUMBER
            ),
        MED:
            definition(
                N_LOG_N,
                NUMBER
            ),
        VAR:
            definition(
                TWO_N,
                NUMBER
            ),

        // Strings and structural measures
        LONG:
            definition(
                CONSTANT,
                NUMBER,
                symbolic(
                    Effect.SIZE
                )
            ),
        CAR_EN:
            definition(
                CONSTANT,
                STRING
            ),
        SUBCAD:
            definition(
                LINEAR_K,
                STRING
            ),
        MAYUS:
            definition(
                LINEAR_N,
                STRING
            ),
        MINUS:
            definition(
                LINEAR_N,
                STRING
            ),
        RECORTA:
            definition(
                LINEAR_N,
                STRING
            ),
        REEMP:
            definition(
                LINEAR_N,
                STRING
            ),
        DIV:
            definition(
                LINEAR_N,
                ARRAY
            ),
        ES_CAD_NUM:
            definition(
                LINEAR_N,
                BOOLEAN
            ),
        ES_VAC:
            definition(
                CONSTANT,
                BOOLEAN
            ),
        EMP_CON:
            definition(
                LINEAR_M,
                BOOLEAN
            ),
        TERM_CON:
            definition(
                LINEAR_M,
                BOOLEAN
            ),

        // Arrays
        AGREGA:
            definition(
                CONSTANT,
                ARRAY
            ),
        ELIM:
            definition(
                LINEAR_N,
                ARRAY
            ),
        INSER:
            definition(
                LINEAR_N,
                ARRAY
            ),
        INDICE:
            definition(
                LINEAR_N,
                NUMBER
            ),
        CONT:
            definition(
                LINEAR_N,
                BOOLEAN
            ),
        ORDENA:
            definition(
                N_LOG_N,
                ARRAY
            ),
        INVER:
            definition(
                LINEAR_N,
                ARRAY
            ),
        COPIA:
            definition(
                LINEAR_N,
                ARRAY
            ),
        UNE:
            definition(
                LINEAR_N,
                STRING
            ),

        // Types
        ES_NUM:
            definition(
                CONSTANT,
                BOOLEAN
            ),
        ES_CAD:
            definition(
                CONSTANT,
                BOOLEAN
            ),
        ES_LOG:
            definition(
                CONSTANT,
                BOOLEAN
            ),
        A_NUM:
            definition(
                CONSTANT,
                NUMBER
            ),
        A_CAD:
            definition(
                CONSTANT,
                STRING
            ),
        A_LOG:
            definition(
                CONSTANT,
                BOOLEAN
            ),

        // Errors
        LANZAR_ERROR:
            definition(
                CONSTANT,
                NEVER
            )
    });

export const CLRS_STANDARD_LIBRARY_NAMES =
    Object.freeze(
        Object.keys(
            CLRS_STANDARD_LIBRARY
        )
    );

export function getStandardLibraryDefinition(
    name
) {
    return (
        CLRS_STANDARD_LIBRARY[name] ??
        null
    );
}

function definition(
    cost,
    returnType = UNKNOWN,
    symbolicEffect =
        symbolic(Effect.OPAQUE)
) {
    return Object.freeze({
        cost,
        returnType,
        symbolicEffect
    });
}

function symbolic(
    kind,
    options = {}
) {
    return Object.freeze({
        kind,
        argument: 0,
        ...options
    });
}
