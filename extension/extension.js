import * as vscode from "vscode";

import {
    createExtensionApplication
} from "./composition/createExtensionApplication.js";

let activeApplication = null;

/**
 * @param {vscode.ExtensionContext} context
 */
export function activate(context) {
    activeApplication =
        createExtensionApplication({
            vscodeApi: vscode,
            context
        });

    console.log(
        "CLRS Kit activated successfully"
    );

    return activeApplication;
}

export function deactivate() {
    activeApplication?.dispose();
    activeApplication = null;
}
