export function createViewState(
    showCost = true
) {
    return {
        showCost
    };
}

export const ViewState =
    createViewState();
