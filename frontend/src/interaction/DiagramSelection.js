/**
 * Operaciones neutrales para relacionar coordenadas CLRS con nodos del
 * diagrama. Las ubicaciones son 1-based, como las del AST.
 */
export function getDiagramNodes(diagram) {
    return [
        ...(diagram?.nodes ?? []),
        ...(diagram?.subgraphs ?? [])
            .flatMap(subgraph =>
                subgraph.nodes ?? []
            )
    ];
}

export function findDiagramNodeAtLocation(
    diagram,
    location
) {
    const position =
        normalizePosition(location);

    if (position == null) {
        return null;
    }

    const candidates =
        getDiagramNodes(diagram)
            .filter(node =>
                node.location?.startLine != null &&
                lineContains(
                    node.location,
                    position.line
                )
            )
            .map(node => ({
                node,
                exact:
                    containsPosition(
                        node.location,
                        position
                    ),
                lineSpan:
                    node.location.endLine -
                    node.location.startLine,
                columnDistance:
                    getColumnDistance(
                        node.location,
                        position
                    ),
                synthetic:
                    node.synthetic === true
            }));

    candidates.sort(compareCandidates);

    return candidates[0]?.node ?? null;
}

export function shiftSourceLocation(
    location,
    sourceOrigin
) {
    if (location?.startLine == null) {
        return null;
    }

    const originLine =
        positiveInteger(
            sourceOrigin?.startLine
        ) ?? 1;
    const originColumn =
        positiveInteger(
            sourceOrigin?.startColumn
        ) ?? 1;

    return {
        startLine:
            location.startLine +
            originLine - 1,
        startColumn:
            shiftColumn(
                location.startLine,
                location.startColumn,
                originColumn
            ),
        endLine:
            (location.endLine ??
                location.startLine) +
            originLine - 1,
        endColumn:
            shiftColumn(
                location.endLine ??
                    location.startLine,
                location.endColumn ??
                    location.startColumn,
                originColumn
            )
    };
}

export function localizeSourceLocation(
    location,
    sourceOrigin
) {
    if (location?.startLine == null) {
        return null;
    }

    const originLine =
        positiveInteger(
            sourceOrigin?.startLine
        ) ?? 1;
    const originColumn =
        positiveInteger(
            sourceOrigin?.startColumn
        ) ?? 1;
    const startLine =
        location.startLine - originLine + 1;
    const endLine =
        (location.endLine ??
            location.startLine) -
        originLine + 1;
    const startColumn = localizeColumn(
        location.startLine,
        location.startColumn,
        originLine,
        originColumn
    );
    const endColumn = localizeColumn(
        location.endLine ??
            location.startLine,
        location.endColumn ??
            location.startColumn,
        originLine,
        originColumn
    );

    if (
        startLine < 1 ||
        endLine < startLine ||
        startColumn < 1 ||
        endColumn < 1
    ) {
        return null;
    }

    return {
        startLine,
        startColumn,
        endLine,
        endColumn
    };
}

function normalizePosition(location) {
    const line =
        positiveInteger(
            location?.startLine ??
            location?.line
        );
    const column =
        positiveInteger(
            location?.startColumn ??
            location?.column
        ) ?? 1;

    return line == null
        ? null
        : { line, column };
}

function lineContains(location, line) {
    return (
        location.startLine <= line &&
        (location.endLine ??
            location.startLine) >= line
    );
}

function containsPosition(
    location,
    position
) {
    if (!lineContains(location, position.line)) {
        return false;
    }

    if (
        position.line ===
            location.startLine &&
        position.column <
            (location.startColumn ?? 1)
    ) {
        return false;
    }

    const endLine =
        location.endLine ??
        location.startLine;

    return !(
        position.line === endLine &&
        position.column >
            (location.endColumn ??
                Number.MAX_SAFE_INTEGER)
    );
}

function getColumnDistance(
    location,
    position
) {
    if (
        position.line !==
        location.startLine
    ) {
        return 0;
    }

    return Math.abs(
        position.column -
        (location.startColumn ?? 1)
    );
}

function compareCandidates(left, right) {
    return (
        left.lineSpan - right.lineSpan ||
        Number(right.exact) -
            Number(left.exact) ||
        Number(left.synthetic) -
            Number(right.synthetic) ||
        left.columnDistance -
            right.columnDistance ||
        getLocationWidth(left.node.location) -
            getLocationWidth(
                right.node.location
            )
    );
}

function getLocationWidth(location) {
    if (
        location.startLine !==
        (location.endLine ??
            location.startLine)
    ) {
        return Number.MAX_SAFE_INTEGER;
    }

    return Math.max(
        0,
        (location.endColumn ??
            location.startColumn) -
        (location.startColumn ?? 1)
    );
}

function shiftColumn(
    localLine,
    localColumn,
    originColumn
) {
    const column =
        positiveInteger(localColumn) ?? 1;

    return localLine === 1
        ? column + originColumn - 1
        : column;
}

function localizeColumn(
    absoluteLine,
    absoluteColumn,
    originLine,
    originColumn
) {
    const column =
        positiveInteger(absoluteColumn) ?? 1;

    return absoluteLine === originLine
        ? column - originColumn + 1
        : column;
}

function positiveInteger(value) {
    return Number.isInteger(value) && value > 0
        ? value
        : null;
}
