import { GUI_VOLUME_MEASURE } from "../../standard-library/gui/GuiCostCatalog.js";
import { getStandardLibraryDefinition, StandardLibrarySymbolicEffect } from "../../standard-library/StandardLibraryCatalog.js";
import { CostExpressionFactory as Cost } from "../algebra/CostExpressionFactory.js";

// Marca exclusivamente algebraica. No convierte un arreglo en un número CLRS.
export const GUI_DATA_VALUE = "dato GUI";
export function isGuiVolume(expression) {
    return expression?.kind === "call" && expression.name === GUI_VOLUME_MEASURE && expression.args.length === 1;
}
export function isGuiSymbolicVolume(expression) {
    return isGuiVolume(expression) && expression.args[0].kind === "symbol";
}
export function guiDataMeasureReplacement(expression) {
    if (expression.kind !== "call" || expression.args.length !== 1) { return null; }
    const value = expression.args[0];
    if (value.kind !== "call" || value.name !== GUI_DATA_VALUE || ![1, 2].includes(value.args.length)) { return null; }
    if (isGuiVolume(expression)) { return value.args[0]; }
    if (getStandardLibraryDefinition(expression.name)?.symbolicEffect.kind === StandardLibrarySymbolicEffect.SIZE) {
        // El volumen profundo NO es la longitud exterior. Sólo se sustituye la
        // longitud cuando se conservó explícitamente al construir el literal.
        return value.args[1] ?? Cost.unknown("GUI: no se demuestra la longitud exterior del dato reenviado.");
    }
    return null;
}
