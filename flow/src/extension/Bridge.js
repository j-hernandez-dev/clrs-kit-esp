import { exportPng } from "../renderer/MermaidRenderer.js";

export function initializeBridge() {

    const vscode =
        typeof acquireVsCodeApi === "function"

            ? acquireVsCodeApi()

            : null;

    if (!vscode) {

        console.warn(
            "Running outside VS Code."
        );

        return;

    }

    window.addEventListener("message", async event => {

        switch (event.data.type) {

            case "export-png":

                const png = await exportPng();

                vscode.postMessage({

                    type: "png",

                    png

                });

                break;

        }

    });

}