export const CLRS_CLI_PROGRAM_SOURCE = [
    "PRINCIPAL()",
    "    escribir \"¡Hola mundo!\"",
    ""
].join("\n");

export const CLRS_CLI_TEST_SUITE_SOURCE =
    `${JSON.stringify(
        {
            version: 1,
            id: "suite:programa-cli",
            name: "Pruebas del programa CLI",
            program: "programa.clrs",
            cases: [{
                id: "case:hola-mundo",
                name: "Escribe el saludo inicial",
                input: [],
                expectedOutput: [
                    "¡Hola mundo!"
                ],
                comparison: "exact"
            }]
        },
        null,
        2
    )}\n`;

export const CLRS_GUI_PROGRAM_SOURCE = [
    "principalVentana = \"principalVentana\"",
    "saludoCaja = \"saludoCaja\"",
    "saludoEtiqueta = \"saludoEtiqueta\"",
    "saludarBoton = \"saludarBoton\"",
    "sistemaTema = \"sistema\"",
    "",
    "SALUDAR()",
    "    ESTABLECER(saludoEtiqueta, \"texto\", \"¡Hola mundo desde GUI!\")",
    "    escribir \"¡Hola mundo desde CLI!\"",
    "",
    "PRINCIPAL()",
    "    ESTABLECER_TEMA(sistemaTema)",
    "",
    "    VENTANA(principalVentana, \"Mi primera interfaz\")",
    "    CAJA(saludoCaja, \"vertical\", 8)",
    "    ETIQUETA(saludoEtiqueta, \"Pulsa el botón\")",
    "    BOTON(saludarBoton, \"Saludar\")",
    "",
    "    CONTENER(principalVentana, saludoCaja)",
    "    ANEXAR(saludoCaja, saludoEtiqueta)",
    "    ANEXAR(saludoCaja, saludarBoton)",
    "    CONECTAR(saludarBoton, \"clic\", SALUDAR)",
    "",
    "    MOSTRAR(principalVentana)",
    ""
].join("\n");

export const CLRS_GUI_TEST_SUITE_SOURCE =
    `${JSON.stringify(
        {
            version: 1,
            id: "suite:programa-gui",
            name: "Pruebas del programa GUI",
            program: "programa.clrs",
            cases: [{
                id: "case:inicio-gui",
                name: "Inicia sin salida de consola",
                input: [],
                expectedOutput: [],
                comparison: "exact",
                timeoutMs: 30000
            }]
        },
        null,
        2
    )}\n`;

export const CLRS_CLI_PROJECT = project(
    "Proyecto CLRS de CLI",
    CLRS_CLI_PROGRAM_SOURCE,
    CLRS_CLI_TEST_SUITE_SOURCE
);

export const CLRS_GUI_PROJECT = project(
    "Proyecto CLRS de GUI",
    CLRS_GUI_PROGRAM_SOURCE,
    CLRS_GUI_TEST_SUITE_SOURCE
);

function project(name, programSource, testSuiteSource) {
    return Object.freeze({
        name,
        files: Object.freeze([
            file("programa.clrs", programSource),
            file(
                "programa.clrs-tests.json",
                testSuiteSource
            )
        ])
    });
}

function file(relativePath, content) {
    return Object.freeze({
        relativePath,
        content
    });
}
