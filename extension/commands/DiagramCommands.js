import * as vscode from 'vscode';
import path from 'path';

export function registerDiagramCommands(context) {
    // EJECUTAR DIAGRAMA
    const runDiagram = vscode.commands.registerCommand('CLRS.runDiagram', async () => {
        vscode.window.showErrorMessage(
            "Módulo en desarrollo (próximamente).",
            3000
        );
    });

    context.subscriptions.push(runDiagram);

    // ABRIR EDITOR
    const openDiagramEditor = vscode.commands.registerCommand('CLRS.openDiagramEditor', async () => {
        vscode.window.showErrorMessage(
            "Módulo en desarrollo (próximamente).",
            3000
        );
    });

    context.subscriptions.push(openDiagramEditor);

    // GENERAR CÓDIGO DESDE DIAGRAMA
    const generateDiagramCode = vscode.commands.registerCommand('CLRS.generateDiagramCode', async () => {
        vscode.window.showErrorMessage(
            "Módulo en desarrollo (próximamente).",
            3000
        );
    });

    context.subscriptions.push(generateDiagramCode);

    // GENERAR ARCHIVO SVG
    const exportDiagramSVG = vscode.commands.registerCommand('CLRS.exportDiagramSVG', async () => {
        vscode.window.showErrorMessage(
            "Módulo en desarrollo (próximamente).",
            3000
        );
    });

    context.subscriptions.push(exportDiagramSVG);
}