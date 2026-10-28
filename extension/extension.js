import * as vscode from "vscode";
import {
    performance
} from "node:perf_hooks";

import {
    createExtensionApplication
} from "./composition/createExtensionApplication.js";

let activeApplication = null;

/**
 * @param {vscode.ExtensionContext} context
 */
export function activate(context) {
    const startedAt = performance.now();

    activeApplication =
        createExtensionApplication({
            vscodeApi: vscode,
            context
        });

    const durationMs =
        performance.now() - startedAt;

    activeApplication.performance.record(
        "extension.activation",
        durationMs
    );

    console.log(
        `CLRS Kit activated successfully (${durationMs.toFixed(1)} ms)`
    );

    return activeApplication;
}

export function deactivate() {
    activeApplication?.dispose();
    activeApplication = null;
}
