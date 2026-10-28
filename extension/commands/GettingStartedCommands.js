import {
    requireObject,
    requirePort
} from "../../src/application/ports/ApplicationPorts.js";
import {
    CLRS_CLI_PROGRAM_SOURCE,
    CLRS_CLI_PROJECT,
    CLRS_CLI_TEST_SUITE_SOURCE,
    CLRS_GUI_PROJECT
} from "../getting-started/CLRSExampleProject.js";

export const CLRS_WALKTHROUGH_ID =
    "clrsGettingStarted";
export const CLRS_EXTENSION_ID =
    "j-hernandez-dev.clrs-kit-esp";

export const CLRS_GETTING_STARTED_COMMANDS =
    Object.freeze({
        OPEN_WALKTHROUGH:
            "CLRS.openWalkthrough",
        CREATE_PROGRAM:
            "CLRS.createFirstProgram",
        CREATE_TEST_SUITE:
            "CLRS.createFirstTestSuite",
        CREATE_CLI_PROJECT:
            "CLRS.createExampleProject",
        CREATE_GUI_PROJECT:
            "CLRS.createGuiProject"
    });

export const CLRS_FIRST_PROGRAM_SOURCE =
    CLRS_CLI_PROGRAM_SOURCE;

export const CLRS_FIRST_TEST_SUITE_SOURCE =
    CLRS_CLI_TEST_SUITE_SOURCE;

/**
 * Registra las acciones utilizadas por el Walkthrough nativo. Los documentos
 * permanecen sin guardar para que el usuario elija su ubicación.
 */
export function registerGettingStartedCommands(
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
    const extensionId =
        options.extensionId ??
        CLRS_EXTENSION_ID;
    const languageId =
        options.languageId ??
        "clrs-es";
    const registrations = [
        vscode.commands.registerCommand(
            CLRS_GETTING_STARTED_COMMANDS
                .OPEN_WALKTHROUGH,
            () =>
                vscode.commands
                    .executeCommand(
                        "workbench.action.openWalkthrough",
                        `${extensionId}#${CLRS_WALKTHROUGH_ID}`,
                        false
                    )
        ),
        vscode.commands.registerCommand(
            CLRS_GETTING_STARTED_COMMANDS
                .CREATE_PROGRAM,
            () => openStarterDocument({
                vscode,
                language: languageId,
                content:
                    CLRS_FIRST_PROGRAM_SOURCE
            })
        ),
        vscode.commands.registerCommand(
            CLRS_GETTING_STARTED_COMMANDS
                .CREATE_TEST_SUITE,
            () => openStarterDocument({
                vscode,
                language: "json",
                content:
                    CLRS_FIRST_TEST_SUITE_SOURCE
            })
        ),
        vscode.commands.registerCommand(
            CLRS_GETTING_STARTED_COMMANDS
                .CREATE_CLI_PROJECT,
            () => createProject({
                vscode,
                project:
                    CLRS_CLI_PROJECT
            })
        ),
        vscode.commands.registerCommand(
            CLRS_GETTING_STARTED_COMMANDS
                .CREATE_GUI_PROJECT,
            () => createProject({
                vscode,
                project:
                    CLRS_GUI_PROJECT
            })
        )
    ];

    lifecycle.add(...registrations);

    return Object.freeze({
        walkthroughId:
            CLRS_WALKTHROUGH_ID,
        commandIds: Object.freeze(
            Object.values(
                CLRS_GETTING_STARTED_COMMANDS
            )
        )
    });
}

async function createProject({
    vscode,
    project
}) {
    const selection =
        await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: "Usar esta carpeta",
            title:
                `Selecciona una carpeta vacía para ${project.name.toLowerCase()}`
        });

    if (!Array.isArray(selection) ||
        selection.length === 0) {
        return Object.freeze({
            status: "cancelled"
        });
    }

    const projectUri = selection[0];
    const entries =
        await vscode.workspace.fs
            .readDirectory(projectUri);

    if (entries.length > 0) {
        await vscode.window
            .showWarningMessage(
                "La carpeta seleccionada debe estar vacía para crear el proyecto CLRS."
            );

        return Object.freeze({
            status: "not-empty",
            projectUri
        });
    }

    const encoder = new TextEncoder();
    const createdFiles = [];

    for (const file of project.files) {
        const fileUri = vscode.Uri.joinPath(
            projectUri,
            file.relativePath
        );

        await vscode.workspace.fs.writeFile(
            fileUri,
            encoder.encode(file.content)
        );
        createdFiles.push(fileUri);
    }

    const openProjectLabel =
        "Abrir en otra ventana";
    const openProgramLabel = "Abrir programa";
    const action = await vscode.window
        .showInformationMessage(
            `${project.name} creado con su programa y suite de pruebas.`,
            openProgramLabel,
            openProjectLabel
        );
    const programUri = createdFiles.find(
        uri => uri.path.endsWith(
            "/programa.clrs"
        )
    );

    if (action === openProgramLabel) {
        const document =
            await vscode.workspace
                .openTextDocument(programUri);

        await vscode.window.showTextDocument(
            document,
            {
                preview: false,
                preserveFocus: false
            }
        );
    } else if (action === openProjectLabel) {
        await vscode.commands.executeCommand(
            "vscode.openFolder",
            projectUri,
            true
        );
    }

    return Object.freeze({
        status: "created",
        projectUri,
        files: Object.freeze(createdFiles)
    });
}

async function openStarterDocument({
    vscode,
    language,
    content
}) {
    const document =
        await vscode.workspace
            .openTextDocument({
                language,
                content
            });

    await vscode.window.showTextDocument(
        document,
        {
            preview: false,
            preserveFocus: false
        }
    );

    return document;
}
