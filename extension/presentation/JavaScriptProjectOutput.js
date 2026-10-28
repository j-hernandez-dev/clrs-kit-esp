import { JavaScriptExportProfiles } from "../../src/compiler/export/JavaScriptExportProfile.js";

const profileEnding = Object.freeze({
    [JavaScriptExportProfiles.CLI]: Object.freeze([
        "Requiere Node compatible para preparar, ejecutar desde código fuente y construir el proyecto.",
        "Los recursos externos no se incluyen automáticamente en el ejecutable."
    ]),
    [JavaScriptExportProfiles.GUI]: Object.freeze([
        "Requiere Node compatible y GTK 4.10 o superior según tu sistema.",
        "Los recursos externos no se copian automáticamente."
    ])
});

const safeFallbackEnding = Object.freeze([
    "Requiere Node compatible para preparar, ejecutar y construir el proyecto.",
    "Los recursos externos no se incluyen automáticamente."
]);

/** Líneas del canal Salida para archivos históricos y proyectos CLI/GUI. */
export function createJavaScriptProjectOutputLines(outputPath, project) {
    const lines = [`El código se generó en: ${outputPath}`];
    if (project?.kind !== "node-project") { return Object.freeze(lines); }

    lines.push(
        `Proyecto JavaScript: ${project.projectDirectory}`,
        "",
        "Para preparar el proyecto:",
        "  npm ci",
        "",
        "Para ejecutarlo:",
        "  npm start",
        "",
        "Para generar un ejecutable distribuible:",
        "  Windows:      npm run build:win",
        "  Linux/macOS:  npm run build:unix",
        "",
        ...(profileEnding[project.exportProfile] ?? safeFallbackEnding)
    );
    if (project.backupPath) {
        lines.push("", `La exportación anterior se conservó en: ${project.backupPath}`);
    }
    return Object.freeze(lines);
}
