const NAVIGATION_ACTIONS = new Set([
    "first",
    "previous",
    "next",
    "latest",
    "replay"
]);

/** Estado puro de contador y límites para una secuencia visual. */
export function getDiagramPlaybackNavigation(
    stepCount,
    requestedIndex
) {
    const count = Number.isSafeInteger(stepCount) &&
        stepCount > 0
        ? stepCount
        : 0;
    const index = count === 0
        ? -1
        : Math.min(
            Math.max(
                Number.isSafeInteger(requestedIndex)
                    ? requestedIndex
                    : -1,
                -1
            ),
            count - 1
        );

    return Object.freeze({
        stepCount: count,
        stepIndex: index,
        displayedStep:
            index < 0 ? 0 : index + 1,
        hasSteps: count > 0,
        canGoBackward: index > 0,
        canGoForward:
            count > 0 && index < count - 1
    });
}

/** Aplica |←, ←, →, →| o el reinicio de reproducción sin salir de rango. */
export function moveDiagramPlaybackIndex(
    stepCount,
    currentIndex,
    action
) {
    if (!NAVIGATION_ACTIONS.has(action)) {
        throw new TypeError(
            `Acción de reproducción desconocida: ${action}`
        );
    }

    const state = getDiagramPlaybackNavigation(
        stepCount,
        currentIndex
    );

    if (!state.hasSteps) {
        return -1;
    }

    switch (action) {
        case "first":
            return 0;
        case "previous":
            return Math.max(0, state.stepIndex - 1);
        case "next":
            return Math.min(
                state.stepCount - 1,
                Math.max(0, state.stepIndex + 1)
            );
        case "latest":
            return state.stepCount - 1;
        case "replay":
            return state.stepIndex < 0 ||
                state.stepIndex >= state.stepCount - 1
                ? 0
                : state.stepIndex;
        default:
            return state.stepIndex;
    }
}
