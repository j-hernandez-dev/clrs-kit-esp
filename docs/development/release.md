# Build, VSIX y publicación

La entrega 2.0.4 conserva `VERDAD` y `FALSO` como literales canónicos en las
etiquetas y formularios del diagramador. La representación visual y el valor
editable proceden de la misma proyección del AST, por lo que aceptar una figura
sin cambios vuelve a producir código CLRS válido. El artefacto de la entrega es
`dist/clrs-kit-esp-2.0.4.vsix`.

### Literales lógicos canónicos 2.0.4 — 2026-09-17

`DiagramExpressionVisitor` ya no traduce los booleanos a palabras meramente
descriptivas. Asignaciones, decisiones, ciclos, retornos, arreglos y argumentos
usan `VERDAD` o `FALSO` tanto en Mermaid/SVG como en `identity.editor`. La
regresión cubre la renderización, la reproducción normalizada y el recorrido
completo de abrir y aceptar el editor sin modificar el literal.

La entrega 2.0.3 incorpora un perfil de exportación CLI compilable sin alterar
el contrato GUI portable. Los programas de consola se publican como proyectos
npm de tres archivos y construyen directamente desde su JavaScript; los
programas GUI conservan sus cinco archivos, preparación packable, bootstrap y
runtime `node-gtk` especializado.

### Cierre de exportación CLI 2.0.3 — 2026-09-16

**Generar código JavaScript** clasifica el perfil exclusivamente desde
`semanticModel.gui.usage.requiresGui`. CLI publica `<programa>.js`,
`package.json` y `package-lock.json` mediante la misma transacción atómica que
GUI, pero no incorpora infraestructura gráfica. El manifest usa
`@yao-pkg/pkg@^6.22.0` como herramienta de desarrollo y los scripts host generan
`dist/<programa>.exe` en Windows o `dist/<programa>` en Linux/macOS.

El cierre incluye validación estricta del lock npm v3, corpus determinista,
presentación diferenciada en el canal `Salida`, documentación operativa y
ensayos opt-in de instalación y build. La evidencia nativa conservada certifica
Windows x64 con Node 24.16.0; las matrices Linux y macOS continúan declaradas
sin presentarse como evidencia ejecutada. El artefacto de la entrega es
`dist/clrs-kit-esp-2.0.3.vsix`.

La entrega 2.0.2 conserva el contrato determinista de recorrido visual
2.0.0 y unifica las exportaciones JavaScript permanentes en
`app/<nombre-del-programa>/`, con nombres públicos sin la clave interna.
Los proyectos GUI publican cinco archivos fuente; sólo un build posterior crea
su `dist/<nombre-del-programa>/` interno.
También traslada la instalación opcional de instrucciones de Copilot CLI al
grupo separado de **Inicio**. Conserva el
contexto canónico de CLRS para Copilot Chat, el instalador opcional de
instrucciones, la presentación de terminal y el
[corpus GUI](../gui/acceptance.md).
La documentación técnica de `docs/`,
las evidencias de `test/` y el runtime privado de `.runtime/` quedan fuera
del VSIX. Se publican los snippets GUI; node-gtk continúa aprovisionándose
bajo demanda y no se empaqueta como dependencia de la extensión.

### Cierre portable 2.0.2 — 2026-09-15

La exportación GUI publica un proyecto fuente transaccional de cinco archivos
bajo `app/<programa>/`. `npm start` conserva el entry ESM normal; los scripts
host `build:win` y `build:unix` generan la variante packable y construyen el
ejecutable bajo el `dist/<programa>/` interno sin modificar el JavaScript
fuente. El bootstrap materializa y reutiliza un runtime GTK físico validado
junto al ejecutable.

El cierre incluye el corpus determinista, los ensayos opt-in de instalación y
build nativo, documentación operativa y arquitectura actualizadas. La evidencia
real disponible corresponde a Windows x64 con Node 24; Linux y macOS conservan
su matriz manual pendiente de evidencia equivalente. El artefacto de la entrega
es `dist/clrs-kit-esp-2.0.2.vsix`.

### Registro histórico del cierre de exportación 2.0.1 — 2026-09-15

**Generar código JavaScript** deriva una sola identidad pública normalizada del
nombre del documento. Tanto consola como GUI se publican en
`dist/<proyecto>/<proyecto>.js`; la salida de consola no adquiere manifiesto ni
dependencias y la GUI conserva `package.json`, `package-lock.json`, el pin de
`node-gtk@4.1.1` y su autorización exacta. Los artefactos temporales de ejecución
mantienen su nombre interno único y su limpieza previa.

El comando **Instalar soporte para Copilot CLI** permanece en la paleta y pasa
del menú **Crear** al menú **Inicio**, después de un separador nativo. El
artefacto de esa entrega fue `dist/clrs-kit-esp-2.0.1.vsix`. El contrato
vigente posterior se documenta en
[Exportación JavaScript y proyecto GUI portable](../gui/javascript-export.md).

### Registro del cierre técnico portable previo a 2.0.2

El comando exporta fuente a `app/<programa>/`. En GUI, `npm ci` instala el
binding autorizado y la herramienta local; `npm start` conserva el entry ESM
normal. `npm run build:win` o `npm run build:unix` generan una variante
packable derivada y construyen `dist/<programa>/<programa>[.exe]` sólo para el
host. Este trabajo se incorporó posteriormente a la entrega 2.0.2.

Los smoke tests nativos de instalación y build son opt-in y no forman parte de
`release:check`. Su ejecución debe reportar plataforma, arquitectura, ABI,
versiones reales y dependencias externas; una matriz declarada sin ejecución no
es evidencia de compatibilidad.

### Build publicable

```powershell
npm run build
```

esbuild reconstruye los dos bundles de `extension-dist/` y Vite actualiza `frontend/dist/`. Los nombres de chunks del frontend tienen hash, por lo que es normal que cambien al reconstruir.

### Ver contenido publicable

```powershell
npm run package:list
```

La frontera está definida en `.vscodeignore`. Se excluyen pruebas, workflows, fuentes JavaScript de `src/` y `extension/`, fuentes del frontend, scripts, dependencias de desarrollo, lockfiles, fixtures CLRS y artefactos VSIX previos. Se incluyen los dos bundles de `extension-dist/`, el build dividido de `frontend/dist/` y los recursos declarativos necesarios de `extension/`.

### Validación de release

```powershell
npm run release:check
```

Este comando delega en `npm run test:corpus`; no existe una ruta de release más corta que omita una de las áreas del cierre.

### Generar el VSIX

```powershell
npm run package:vsix
```

El script ejecuta su prehook `prepackage:vsix`, por lo que la validación de release ocurre antes de empaquetar. El archivo resultante es:

```text
dist/clrs-kit-esp-<version>.vsix
```

`scripts/package-vsix.mjs` invoca la copia local de `vsce` y evita depender de una instalación global.

### Checklist de versión

1. Actualizar `version` en `package.json` y lockfiles correspondientes.
2. Documentar cambios técnicos en `CHANGELOG.md` y en el documento responsable dentro de `docs/` cuando aplique.
3. No modificar `README.md` salvo decisión explícita de su mantenedor.
4. Ejecutar `npm run release:check`.
5. Ejecutar `npm run package:list` y revisar la frontera publicada.
6. Ejecutar `npm run package:vsix`.
7. Instalar el VSIX en un perfil limpio y hacer una prueba manual breve.

La subida al Marketplace es una acción posterior del mantenedor; generar el
VSIX no publica remotamente. Las evidencias distinguen la matriz CI declarada
de las plataformas que efectivamente se probaron.

### Cierre de recorrido visual 2.0.0 — 2026-09-15

`DiagramExecutionProjection` conserva intacta la traza del runtime y deriva
de ella la secuencia visual normalizada que gobierna contador, navegación,
reproducción, nodo activo, figuras visitadas y conexiones recorridas. La
secuencia incorpora exclusivamente figuras estructurales que ya pertenecen al
modelo: `Inicio` global, entrada de función, controles repetidos de ciclo y
terminales `Fin` realmente alcanzadas. `Retornar` permanece como terminal
explícito y excluye un `Fin` adicional.

Cada invocación se identifica por contexto y frame. Al salir natural o
explícitamente de una función, la reproducción continúa en el sucesor del
llamador sin volver a presentar la llamada ni el encabezado de la función. El
modelo conserva las relaciones `sequence`, `branch`, `loop-entry` y
`loop-back`; sólo las conexiones de la ruta tomada se incorporan al paso de
destino, y los saltos entre ámbitos no inventan flechas Mermaid.

El corpus versionado A–Q valida el orden exacto de figuras y conexiones para
flujo lineal, decisiones, `mientras`, ambas variantes de `para`, retornos,
llamadas anidadas o repetidas, recursión y final global. El artefacto de esta
entrega es `dist/clrs-kit-esp-2.0.0.vsix`.

El enfoque del nodo activo actualiza primero las dimensiones internas de
`svg-pan-zoom`. Por ello, redimensionar el panel o moverlo entre grupos de VS
Code no obliga a ejecutar **Ajustar el flujo visible** antes de centrar.

### Cierre Copilot 1.9.7 — 2026-09-14

La especificación canónica se publica como
`copilot/clrs.instructions.md`; el manifiesto la registra para
`editorLangId == clrs-es` y la frontera del VSIX la conserva. El comando
`CLRS.installCopilotCliSupport` copia exactamente ese archivo, cuyo frontmatter
limita el alcance a `**/*.clrs`, a `COPILOT_HOME/instructions/` o al directorio
personal `.copilot/instructions/` con confirmación nativa antes de escribir.
No instala ni ejecuta Copilot CLI.

Las regresiones validan la sintaxis de los ejemplos canónicos, el manifiesto,
la inclusión efectiva en el paquete, las rutas Windows/POSIX y los estados de
instalación, actualización, conservación, cancelación y fallo de escritura.
La disponibilidad de un binario Copilot CLI o de respuestas de un modelo no es
requisito del cierre automático.

El cierre generó `dist/clrs-kit-esp-1.9.7.vsix`. La inspección del paquete
confirma la versión 1.9.7 y la inclusión de
`copilot/clrs.instructions.md`; las pruebas de Extension Host finalizaron con
25 casos aprobados.

### Cierre de presentación 1.9.8 — 2026-09-14

La acción de Copilot CLI se presenta como **Instalar soporte para Copilot CLI**
en la paleta y en Crear. El cuadro nativo de confirmación sólo declara la
acción afirmativa; VS Code aporta su botón Cancelar único, que conserva el
archivo existente. En Ejecutar, `CLRS.generateCode` pasa al grupo visual
`generation`, creando el separador nativo después de Depurar sin alterar ningún
comando, handler ni orden funcional.

El artefacto de esta entrega es `dist/clrs-kit-esp-1.9.8.vsix`.

### Cierre de diagramador 1.9.9 — 2026-09-14

La generación del grafo distingue ahora un bloque vacío —que continúa de
forma implícita— de un bloque no vacío sin salida porque todas sus rutas
terminan en `retornar`. Esto elimina fusiones desconectadas en cadenas
`sino si` con condicionales anidados y evita conexiones nulas equivalentes en
ciclos o cierres de función.

La traza de ejecución por terminal emite las mismas transiciones estructurales
de entrada y salida de función que ya estaban disponibles en GUI, respetando
el límite global de pasos. Así, al terminar implícitamente `PRINCIPAL` después
de la salida de un ciclo, el diagramador recorre la flecha existente hacia
`Fin` y marca su borde como ejecutado sin añadir una sentencia CLRS ficticia.

El artefacto de esta entrega es `dist/clrs-kit-esp-1.9.9.vsix`.

### Cierre de terminal 1.9.6 — 2026-09-14

`npm run package:vsix` ejecuta el corpus y la compilación completa. En Windows
x64 / Node 24.16.0: 35 pruebas del grupo terminal, 1119 de la suite principal
y 25 de Extension Host aprobadas, además de los corpus y suites auxiliares.
ESLint conserva seis advertencias previas sin errores; Vite avisa de chunks
grandes. La salida completa de la entrega se conserva localmente en
`dist/release-1.9.6.log`.

La prueba interactiva con `test/fixtures/terminal-interactive.clrs` aceptó
texto y número mediante dos llamadas a `LEER`; otra ejecución se detuvo con
Ctrl+C y mostró `Cancelado` y tiempo. Se utilizó el pseudoconsolador Windows
del entorno de pruebas y el CLI real; no constituye una inspección visual de
todas las terminales VS Code ni validación nativa nueva de GTK en Linux/macOS.
Los ensayos GUI de esta entrega usan el administrador real con instalador y
binding de prueba en copias temporales. La barra de bytes se valida con datos
controlados, no mediante una descarga npm real.

Archivos del cierre (bloques 6–7):

- Presentación y runtime: `src/application/presenters/TerminalUI.js`,
  `TerminalSpinner.js`, `GuiRuntimeProgressPresenter.js`,
  `src/application/composition/createCliApplication.js`,
  `src/compiler/adapters/NodeProgramRunner.js`, `src/compiler/StandartLibrary.js`
  y `src/infrastructure/gui/NodeGtkDependencyManager.js`.
- Pruebas: `test/terminal.cli.integration.test.js`, `terminal.animation.test.js`,
  `terminal.presentation.test.js`, `gui.dependencies.test.js`,
  `gui.runtime.presentation.test.js`, `test/fixtures/terminal-interactive.clrs`,
  `test/fixtures/integral-corpus.v1.json` y
  `test/fixtures/gui/contract-traceability.v1.json`.
- Versión/documentación: `package.json`, `package-lock.json`, `README.md`,
  `CHANGELOG.md`, `docs/README.md`, `docs/language/compilation.md`,
  `docs/language/diagnostics.md`, `docs/gui/runtime-pipeline.md`,
  `docs/gui/acceptance.md`, `docs/development/testing.md` y este documento.
- Artefactos reconstruidos: `extension-dist/`, `frontend/dist/` y
  `dist/clrs-kit-esp-1.9.6.vsix`.

En `README.md` sólo se sustituyó el número de versión `1.9.5` por `1.9.6`.

---

