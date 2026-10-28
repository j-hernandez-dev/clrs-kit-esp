export function createViewState(
    showCost = false
) {
    return {
        showCost
    };
}

export const ViewState =
    createViewState();
