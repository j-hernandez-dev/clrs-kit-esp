export const CLRS_CONTEXTUAL_START_STATE =
    Object.freeze({
        EMPTY: "empty",
        PROGRAM_AVAILABLE:
            "program-available",
        PROGRAM_ACTIVE: "program-active",
        SUITE_ACTIVE: "suite-active",
        TESTED_PROJECT: "tested-project"
    });

const COMMANDS = Object.freeze({
    CREATE_PROJECT:
        "CLRS.createExampleProject",
    CREATE_PROGRAM:
        "CLRS.createFirstProgram",
    CREATE_SUITE:
        "CLRS.createFirstTestSuite",
    OPEN_WALKTHROUGH:
        "CLRS.openWalkthrough",
    RUN: "CLRS.runCode",
    DIAGRAM: "CLRS.toggleDiagram",
    DEBUG: "CLRS.debugCode",
    BROKER: "CLRS.playBroker95",
    TESTING: "workbench.view.testing.focus"
});

export function resolveCLRSContextualStart(
    options = {}
) {
    const activeDocument =
        options.activeDocument ?? null;
    const programUris = normalizeUris(
        options.programUris
    );
    const testSuiteUris = normalizeUris(
        options.testSuiteUris
    );
    const languageId =
        options.languageId ?? "clrs-es";
    const activeProgram =
        activeDocument?.languageId ===
            languageId;
    const activeSuite = isTestSuite(
        activeDocument?.uri
    );
    const programUri = activeProgram
        ? activeDocument.uri
        : programUris[0] ?? null;
    const hasTests = testSuiteUris.length > 0 ||
        activeSuite;

    if (activeProgram) {
        return context(
            CLRS_CONTEXTUAL_START_STATE
                .PROGRAM_ACTIVE,
            "Continúa con el programa activo",
            "Elige la herramienta CLRS que quieres utilizar ahora.",
            [
                command(
                    "$(play) Ejecutar código",
                    "Muestra la salida en la terminal integrada.",
                    COMMANDS.RUN
                ),
                command(
                    "$(type-hierarchy-sub) Abrir diagrama de flujo",
                    "Observa y edita la estructura del programa.",
                    COMMANDS.DIAGRAM
                ),
                command(
                    "$(debug-alt) Depurar paso a paso",
                    "Inicia el depurador CLRS sobre este archivo.",
                    COMMANDS.DEBUG
                ),
                hasTests
                    ? command(
                        "$(beaker) Abrir pruebas",
                        "Ejecuta o depura los casos descubiertos.",
                        COMMANDS.TESTING
                    )
                    : command(
                        "$(new-file) Crear suite de pruebas CLRS",
                        "Prepara un caso declarativo para el programa.",
                        COMMANDS.CREATE_SUITE
                    ),
                command(
                    "$(game) Abrir BROKER.95",
                    "Practica con contratos o continúa en Aprendizaje.",
                    COMMANDS.BROKER
                )
            ]
        );
    }

    if (activeSuite) {
        return context(
            CLRS_CONTEXTUAL_START_STATE
                .SUITE_ACTIVE,
            "Continúa con la suite de pruebas",
            "Abre el panel de Pruebas o regresa al programa relacionado.",
            compact([
                command(
                    "$(beaker) Abrir pruebas",
                    "Ejecuta o depura la suite desde VS Code.",
                    COMMANDS.TESTING
                ),
                programUri == null
                    ? null
                    : openDocument(
                        "$(file-code) Abrir programa CLRS",
                        "Regresa al programa disponible en el proyecto.",
                        programUri
                    ),
                command(
                    "$(rocket) Abrir inicio guiado",
                    "Consulta el recorrido completo de CLRS Kit.",
                    COMMANDS.OPEN_WALKTHROUGH
                )
            ])
        );
    }

    if (programUri != null && hasTests) {
        return context(
            CLRS_CONTEXTUAL_START_STATE
                .TESTED_PROJECT,
            "Continúa con el proyecto CLRS",
            "El proyecto ya contiene un programa y pruebas declarativas.",
            [
                openDocument(
                    "$(file-code) Abrir programa CLRS",
                    "Abre el primer programa encontrado.",
                    programUri
                ),
                command(
                    "$(beaker) Abrir pruebas",
                    "Ejecuta o depura los casos descubiertos.",
                    COMMANDS.TESTING
                ),
                command(
                    "$(rocket) Abrir inicio guiado",
                    "Consulta el recorrido completo de CLRS Kit.",
                    COMMANDS.OPEN_WALKTHROUGH
                )
            ]
        );
    }

    if (programUri != null) {
        return context(
            CLRS_CONTEXTUAL_START_STATE
                .PROGRAM_AVAILABLE,
            "Continúa con el proyecto CLRS",
            "Abre el programa existente o prepara sus primeras pruebas.",
            [
                openDocument(
                    "$(file-code) Abrir programa CLRS",
                    "Abre el primer programa encontrado.",
                    programUri
                ),
                command(
                    "$(new-file) Crear suite de pruebas CLRS",
                    "Prepara un caso declarativo para el programa.",
                    COMMANDS.CREATE_SUITE
                ),
                command(
                    "$(rocket) Abrir inicio guiado",
                    "Consulta el recorrido completo de CLRS Kit.",
                    COMMANDS.OPEN_WALKTHROUGH
                )
            ]
        );
    }

    return context(
        CLRS_CONTEXTUAL_START_STATE.EMPTY,
        "Comienza con CLRS Kit Español",
        "Crea un proyecto completo o abre un documento CLRS.",
        [
            command(
                "$(folder-library) Crear proyecto CLRS de CLI",
                "Incluye un programa de consola y su suite de pruebas.",
                COMMANDS.CREATE_PROJECT
            ),
            command(
                "$(new-file) Crear programa CLRS",
                "Abre un documento CLRS inicial sin guardarlo.",
                COMMANDS.CREATE_PROGRAM
            ),
            command(
                "$(rocket) Abrir inicio guiado",
                "Recorre las herramientas principales paso a paso.",
                COMMANDS.OPEN_WALKTHROUGH
            )
        ]
    );
}

function context(
    state,
    title,
    placeHolder,
    actions
) {
    return Object.freeze({
        state,
        title,
        placeHolder,
        actions: Object.freeze(actions)
    });
}

function command(label, description, commandId) {
    return Object.freeze({
        kind: "command",
        label,
        description,
        commandId
    });
}

function openDocument(
    label,
    description,
    documentUri
) {
    return Object.freeze({
        kind: "document",
        label,
        description,
        documentUri
    });
}

function normalizeUris(value) {
    return Array.isArray(value)
        ? value.filter(Boolean)
        : [];
}

function isTestSuite(uri) {
    const path = uri?.path ?? "";

    return path.toLocaleLowerCase()
        .endsWith(".clrs-tests.json");
}

function compact(values) {
    return values.filter(Boolean);
}
