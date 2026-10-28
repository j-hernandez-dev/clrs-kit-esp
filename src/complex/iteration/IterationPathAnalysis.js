export const IterationPathOutcome =
    Object.freeze({
        CONTINUE: "continue",
        RETURN: "return",
        UNKNOWN: "unknown"
    });

export function createIterationPathAnalysis({
    paths = [],
    overflow = false
} = {}) {
    const normalized =
        paths.map((path, index) =>
            Object.freeze({
                id: path.id ?? index,
                outcome:
                    path.outcome ??
                    IterationPathOutcome
                        .CONTINUE,
                feasible:
                    path.feasible !== false,
                updatedNames:
                    Object.freeze([
                        ...(path.updatedNames ?? [])
                    ]),
                guards:
                    Object.freeze(
                        (path.guards ?? [])
                            .map(freezeGuard)
                    ),
                transitions:
                    Object.freeze(
                        (path.transitions ?? [])
                            .map(transition =>
                                Object.freeze({
                                    ...transition
                                })
                            )
                    ),
                locations:
                    Object.freeze(
                        (path.locations ?? [])
                            .map(location =>
                                Object.freeze({
                                    ...location
                                })
                            )
                    ),
                exitLocation:
                    path.exitLocation == null
                        ? null
                        : Object.freeze({
                            ...path.exitLocation
                        })
            })
        );
    const feasible =
        normalized.filter(path =>
            path.feasible
        );
    const continuing =
        feasible.filter(path =>
            path.outcome ===
                IterationPathOutcome
                    .CONTINUE
        );
    const exiting =
        feasible.filter(path =>
            path.outcome ===
                IterationPathOutcome
                    .RETURN
        );

    return Object.freeze({
        kind: "iteration-path-analysis",
        paths: Object.freeze(normalized),
        totalPaths: feasible.length,
        continuingPaths:
            continuing.length,
        exitPaths: exiting.length,
        unknownPaths:
            feasible.length -
            continuing.length -
            exiting.length,
        allPathsExit:
            feasible.length > 0 &&
            exiting.length ===
                feasible.length,
        hasEarlyExit:
            exiting.length > 0,
        overflow
    });
}

function freezeGuard(guard) {
    return Object.freeze({
        operator: guard.operator ?? null,
        left: guard.left ?? null,
        right: guard.right ?? null,
        truth: guard.truth !== false,
        location: guard.location == null
            ? null
            : Object.freeze({
                ...guard.location
            })
    });
}
