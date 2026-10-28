/**
 * Apariencias de conexión disponibles en el visor.
 *
 * Los valores son semánticos para que la interfaz no dependa de los nombres
 * internos utilizados por d3-shape dentro de Mermaid.
 */
export const CONNECTION_STYLES =
    Object.freeze({
        CURVED: "curved",
        STRAIGHT: "straight",
        ORTHOGONAL: "orthogonal"
    });

export const DEFAULT_CONNECTION_STYLE =
    CONNECTION_STYLES.CURVED;

const MERMAID_CURVES = Object.freeze({
    [CONNECTION_STYLES.CURVED]: "basis",
    [CONNECTION_STYLES.STRAIGHT]: "linear"
});

export function getMermaidCurve(
    connectionStyle =
        DEFAULT_CONNECTION_STYLE,
    direction = "TB"
) {
    if (
        connectionStyle ===
        CONNECTION_STYLES.ORTHOGONAL
    ) {
        // d3-shape orienta el marcador según el último tramo. En un flujo
        // vertical stepAfter garantiza una llegada vertical; en uno
        // horizontal stepBefore garantiza una llegada horizontal.
        return direction === "LR"
            ? "stepBefore"
            : "stepAfter";
    }

    const curve =
        MERMAID_CURVES[connectionStyle];

    if (!curve) {
        throw new RangeError(
            `Unknown diagram connection style: ${connectionStyle}`
        );
    }

    return curve;
}
