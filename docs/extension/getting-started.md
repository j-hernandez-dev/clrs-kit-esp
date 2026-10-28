# Inicio guiado y contextual

## Inicio guiado y contextual

La experiencia de incorporación utiliza superficies nativas de VS Code y no introduce un Webview adicional.

### Walkthrough

`package.json` contribuye `clrsGettingStarted` mediante `contributes.walkthroughs`. Sus seis pasos enlazan comandos existentes para crear un programa, ejecutar, abrir el diagrama, depurar, preparar una suite y entrar en BROKER.95. Cada paso declara un `completionEvent` basado en el comando correspondiente y utiliza contenido Markdown local. Las ilustraciones se resuelven desde `raw.githubusercontent.com`: los SVG de programa, terminal, prueba, depuración y diagrama, además de la portada PNG de BROKER.95, no se duplican dentro del VSIX. El recorrido no conserva estado persistente propio.

`GettingStartedCommands` registra las acciones auxiliares:

| Comando | Comportamiento |
|---|---|
| `CLRS.openWalkthrough` | Abre `j-hernandez-dev.clrs-kit-esp#clrsGettingStarted`. |
| `CLRS.createFirstProgram` | **Crear programa CLRS** crea un `TextDocument` CLRS sin guardar. |
| `CLRS.createFirstTestSuite` | **Crear suite de pruebas CLRS** crea un `TextDocument` JSON sin guardar. |
| `CLRS.createExampleProject` | **Crear proyecto CLRS de CLI** escribe `programa.clrs` y su suite mínima en una carpeta vacía seleccionada explícitamente. |
| `CLRS.createGuiProject` | **Crear proyecto CLRS de GUI** escribe `programa.clrs` con la interfaz gráfica inicial y su suite en una carpeta vacía seleccionada explícitamente. |

Las plantillas sin guardar permiten que VS Code y el usuario decidan su ubicación. Ambos proyectos exigen una carpeta vacía y nunca sobrescriben archivos: materializan únicamente `programa.clrs` y `programa.clrs-tests.json`; no generan un README local. Después ofrecen abrir el programa en la ventana vigente o el proyecto completo en otra ventana. El programa CLI y el documento creado por **Crear programa CLRS** contienen sólo `PRINCIPAL` y el saludo `¡Hola mundo!`; su suite usa un único comparador de texto `exact`. El proyecto GUI conserva el ejemplo de ventana, caja, etiqueta, botón y callback, acompañado por una suite declarativa propia.

La definición fuente vive en `extension/getting-started/CLRSExampleProject.js`. La prueba CLI se ejecuta en el repositorio mediante `CLRSTestExecutor`; la plantilla GUI se somete al analizador real y ambas suites se decodifican mediante el formato declarativo vigente.

### Inicio contextual

`CLRS.openContextualStart` consulta como máximo un programa y una suite del workspace, además del documento activo. `resolveCLRSContextualStart` clasifica cinco estados inmutables:

| Estado | Acciones principales |
|---|---|
| `empty` | Crear proyecto, crear programa o abrir el walkthrough. |
| `program-available` | Abrir el programa, preparar una suite o consultar el recorrido. |
| `program-active` | Ejecutar, diagramar, depurar, abrir/crear pruebas o entrar en BROKER.95. |
| `suite-active` | Abrir el panel Pruebas o regresar al programa disponible. |
| `tested-project` | Abrir programa, abrir Pruebas o consultar el walkthrough. |

La clasificación es neutral y se prueba sin VS Code en `test/getting.started.context.test.js`. `ContextualStartCommands` adapta el resultado a `showQuickPick`, abre únicamente el documento seleccionado o ejecuta el comando elegido. No muestra avisos de inicio automáticos, no modifica progreso, no almacena telemetría y no escribe archivos por sí mismo.

---

