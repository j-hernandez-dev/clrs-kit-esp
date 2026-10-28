/**
 * Emite puntos de seguimiento que enlazan la ejecución de JavaScript con
 * ubicaciones 1-based del código CLRS. No conserva estado de ejecución: solo
 * genera llamadas al pequeño tracker incluido en el runtime.
 */
export class RuntimeLocationInstrumentation {

    constructor(options = {}) {
        const programKey =
            options.programKey ??
            globalThis.ProgramKey;

        this.markerName =
            options.markerName ??
            `setRuntimeLocation_${programKey}`;
    }

    /**
     * Genera una instrucción independiente antes de ejecutar un statement.
     */
    mark(location, options = {}) {
        const call = this.call(
            location,
            options
        );

        return call === ""
            ? ""
            : call + ";\n";
    }

    /**
     * Actualiza la ubicación cada vez que una expresión vuelve a evaluarse.
     * Es especialmente útil en condiciones e incrementos de ciclos.
     */
    wrap(expression, location) {
        const call = this.call(location);

        return call === ""
            ? expression
            : `(${call}, ${expression})`;
    }

    call(location, options = {}) {
        const normalized =
            normalizeLocation(location);

        if (normalized == null) {
            return "";
        }

        return (
            `${this.markerName}(` +
            `${normalized.startLine}, ` +
            `${normalized.startColumn}, ` +
            `${normalized.endLine}, ` +
            `${normalized.endColumn}` +
            (
                options.debug === false
                    ? ", false"
                    : ""
            ) +
            ")"
        );
    }
}

function normalizeLocation(location) {
    const startLine =
        positiveInteger(location?.startLine);

    if (startLine == null) {
        return null;
    }

    const startColumn =
        positiveInteger(
            location?.startColumn
        ) ?? 1;
    const endLine =
        positiveInteger(location?.endLine) ??
        startLine;
    const endColumn =
        positiveInteger(
            location?.endColumn
        ) ?? startColumn;

    return {
        startLine,
        startColumn,
        endLine:
            Math.max(startLine, endLine),
        endColumn:
            endLine < startLine
                ? startColumn
                : endColumn
    };
}

function positiveInteger(value) {
    return Number.isInteger(value) && value > 0
        ? value
        : null;
}
