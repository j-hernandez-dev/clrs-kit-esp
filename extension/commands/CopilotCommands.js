import path from "node:path";

import {
    CopilotCliInstructionsInstaller
} from "../../src/copilot/CopilotCliInstructionsInstaller.js";
import {
    requireObject,
    requirePort
} from "../../src/application/ports/ApplicationPorts.js";

export const CLRS_INSTALL_COPILOT_CLI_COMMAND =
    "CLRS.installCopilotCliSupport";

export function registerCopilotCommands(
    options = {}
) {
    const vscode = requireObject(
        options.vscodeApi,
        "vscodeApi"
    );
    const lifecycle = requirePort(
        options.lifecycle,
        "extensionLifecycle",
        ["add"]
    );
    const installerFactory =
        options.installerFactory ??
        (() => new CopilotCliInstructionsInstaller({
            canonicalPath: path.join(
                options.extensionPath ??
                    process.cwd(),
                "copilot",
                "clrs.instructions.md"
            )
        }));
    const registration =
        vscode.commands.registerCommand(
            CLRS_INSTALL_COPILOT_CLI_COMMAND,
            () => installCopilotCliSupport({
                vscode,
                installer: installerFactory()
            })
        );

    lifecycle.add(registration);

    return Object.freeze({
        commandId:
            CLRS_INSTALL_COPILOT_CLI_COMMAND
    });
}

export async function installCopilotCliSupport({
    vscode,
    installer
}) {
    try {
        const outcome = await installer.install({
            confirm: plan => confirmInstallation(
                vscode,
                plan
            )
        });

        await presentOutcome(
            vscode,
            outcome
        );

        return outcome;
    } catch (error) {
        await vscode.window.showErrorMessage(
            "No se pudo instalar el soporte de CLRS para Copilot CLI: " +
            userMessage(error)
        );

        return Object.freeze({
            status: "error",
            error
        });
    }
}

async function confirmInstallation(
    vscode,
    plan
) {
    const isUpdate =
        plan.status === "different";
    const accept = isUpdate
        ? "Actualizar"
        : "Instalar";
    const selected =
        await vscode.window
            .showInformationMessage(
                isUpdate
                    ? "Ya existen instrucciones de CLRS para Copilot CLI con contenido diferente."
                    : "CLRS Kit Español puede instalar instrucciones personales para Copilot CLI.",
                {
                    modal: true,
                    detail:
                        "Se escribirá únicamente el archivo personal de CLRS en:\n" +
                        plan.targetPath
                },
                accept
            );

    return selected === accept;
}

async function presentOutcome(
    vscode,
    outcome
) {
    const message = {
        installed:
            "Soporte de CLRS para Copilot CLI instalado.",
        updated:
            "Soporte de CLRS para Copilot CLI actualizado.",
        current:
            "El soporte de CLRS para Copilot CLI ya está actualizado.",
        cancelled:
            "No se modificaron las instrucciones de Copilot CLI."
    }[outcome.status];

    if (message) {
        await vscode.window
            .showInformationMessage(message);
    }
}

function userMessage(error) {
    return error instanceof Error &&
        error.message.length > 0
        ? error.message
        : "falló la escritura del archivo personal.";
}
