export const ExecutionCoverageKind =
    Object.freeze({
        STATEMENT: "statement",
        BRANCH: "branch",
        LOOP: "loop",
        FUNCTION: "function"
    });

const COVERAGE_KINDS = new Set(
    Object.values(ExecutionCoverageKind)
);
const CONDITION_KINDS = new Set([
    ExecutionCoverageKind.BRANCH,
    ExecutionCoverageKind.LOOP
]);

/**
 * Construye la identidad estable de un punto instrumentado. La ruta del
 * documento pertenece a la traza, por lo que la identidad sólo necesita la
 * clase, la ubicación CLRS y, para funciones, su nombre público.
 */
export function createExecutionCoveragePoint(
    kind,
    location,
    options = {}
) {
    if (!COVERAGE_KINDS.has(kind)) {
        return null;
    }

    const normalizedLocation =
        normalizeCoverageLocation(location);

    if (normalizedLocation == null) {
        return null;
    }

    const name = normalizeName(options.name);
    const suffix = name == null
        ? ""
        : `:${encodeURIComponent(name)}`;

    return Object.freeze({
        pointId:
            `${kind}:` +
            `${normalizedLocation.startLine}:` +
            `${normalizedLocation.startColumn}:` +
            `${normalizedLocation.endLine}:` +
            `${normalizedLocation.endColumn}` +
            suffix,
        kind,
        location: normalizedLocation,
        ...(name == null ? {} : { name })
    });
}

/**
 * Valida un evento procedente del proceso ejecutado antes de incorporarlo al
 * estado del host. Las condiciones siempre deben declarar el resultado que
 * observaron; instrucciones y funciones no admiten ese campo.
 */
export function normalizeExecutionCoverageEvent(
    source
) {
    if (
        source == null ||
        typeof source !== "object" ||
        Array.isArray(source)
    ) {
        return null;
    }

    const point = createExecutionCoveragePoint(
        source.kind,
        source.location,
        { name: source.name }
    );

    if (point == null) {
        return null;
    }

    const pointId = normalizePointId(
        source.pointId
    );

    if (pointId == null) {
        return null;
    }

    if (pointId !== point.pointId) {
        return null;
    }

    if (
        CONDITION_KINDS.has(point.kind) &&
        typeof source.outcome !== "boolean"
    ) {
        return null;
    }

    if (
        !CONDITION_KINDS.has(point.kind) &&
        source.outcome != null
    ) {
        return null;
    }

    return Object.freeze({
        ...point,
        pointId,
        ...(CONDITION_KINDS.has(point.kind)
            ? { outcome: source.outcome }
            : {})
    });
}

export function cloneExecutionCoverageEvent(event) {
    return {
        ...event,
        location: {
            ...event.location
        }
    };
}

export function normalizeCoverageLocation(location) {
    const startLine = positiveInteger(
        location?.startLine
    );

    if (startLine == null) {
        return null;
    }

    const startColumn = positiveInteger(
        location?.startColumn
    ) ?? 1;
    const endLine = positiveInteger(
        location?.endLine
    ) ?? startLine;
    const endColumn = positiveInteger(
        location?.endColumn
    ) ?? startColumn;

    return Object.freeze({
        startLine,
        startColumn,
        endLine: Math.max(startLine, endLine),
        endColumn:
            endLine < startLine
                ? startColumn
                : endColumn
    });
}

function normalizePointId(value) {
    if (typeof value !== "string") {
        return null;
    }

    const normalized = value.trim();

    return normalized.length > 0 &&
        normalized.length <= 512
        ? normalized
        : null;
}

function normalizeName(value) {
    if (value == null) {
        return null;
    }

    if (typeof value !== "string") {
        return null;
    }

    const normalized = value.trim();

    return normalized.length > 0 &&
        normalized.length <= 256
        ? normalized
        : null;
}

function positiveInteger(value) {
    return Number.isInteger(value) && value > 0
        ? value
        : null;
}
