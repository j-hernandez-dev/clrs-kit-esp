import {
    createUniformScenarioCost,
    isScenarioCost
} from "./ScenarioCost.js";

export function attachScenarioCost(
    target,
    scenarioCost,
    fallbackExpression
) {
    const value =
        isScenarioCost(scenarioCost)
            ? scenarioCost
            : createUniformScenarioCost(
                fallbackExpression
            );

    Object.defineProperty(
        target,
        "scenarioCost",
        { value }
    );

    return target;
}
