# GUI — Evidencias de la integración

El cierre vigente de los bloques 13–14 para la versión 1.9.0 se documenta en
[aceptación GUI](../../../docs/gui/acceptance.md).
`acceptance-corpus.v1.json` es la matriz transversal, y
`acceptance.win32-x64.node24.json` contiene el ensayo nativo de cierre.
Los contratos normativos están en [docs/gui](../../../docs/gui/README.md).
Los hashes de trazabilidad se calculan sobre UTF-8 con saltos LF, también
cuando Git materializa archivos CRLF en Windows.

Los apartados siguientes conservan el historial de cada bloque. Sus notas
de versión, limitaciones y tareas futuras describen el momento del ensayo;
el estado actual se consulta en el documento de aceptación enlazado.

La matriz `contract-traceability.v1.json` vincula los cuatro documentos normativos
entregados el 9 de septiembre de 2026 y revisados el 10 de septiembre con los
contratos y las pruebas de estos bloques. Conserva los hashes de la revisión vigente; las pruebas
no dependen de que exista la carpeta Downloads del autor.

## Autoridad compartida

`src/standard-library/StandardLibraryContracts.js` compone el catálogo estándar
existente con los descriptores GUI. No copia las definiciones convencionales ni
crea otro runtime. `getStandardLibraryContract(nombre)` y la ayuda de contrato
permiten consultar las 61 funciones GUI: 24 factories, 30 acciones, tres funciones
generales y cuatro funciones de tema.

La proyección **ejecutable** `CLRS_STANDARD_LIBRARY` conserva sus nombres actuales.
Las entradas GUI llevan `availability: "semantic-and-codegen"`: la semántica ya
resuelve sus símbolos y la generación reconoce su capacidad. Los bloques 5–7
implementan el runtime de componentes, eventos y diálogos. Sin contexto GUI preparado se informa
`CLRS_GUI_RUNTIME_NOT_READY` antes de escribir el archivo generado. No se añaden
en este bloque snippets, gramática ni ayuda contextual especializada del editor.

`GUI_COMPONENTS` contiene las capacidades públicas resueltas, incluidos los
miembros comunes únicamente para widgets. Las descripciones GTK son mapeos
canónicos, no nombres JavaScript garantizados del binding ni instrucciones para
reflexión. Los adaptadores deberán demostrar esos mapeos sobre GTK mínimo.

## Dominios y validación

Los dominios refinan valores existentes: entero sigue siendo número; ID sigue
siendo cadena. `CONECTAR` declara una posición especial para un símbolo de función
resuelto. `isFunctionReference` es un puerto interno de validación que suministrará
la semántica; no concede funciones de primera clase a CLRS.

`assertGuiArgumentDomains` valida aridad, dominios conocidos y rango de las
factories numéricas. `assertGuiPropertyDomain` valida acceso y dominio local.
**Ninguna de estas dos operaciones certifica el estado de un registro GTK.**
Existencia, pertenencia a sesión, tipo de referencias, índices dentro del modelo,
filas rectangulares con el ancho de columnas, selección según modo, capacidad de
contención se declaran como restricciones y se validan contra estado real en el
runtime (bloques 5–7).

`assertGuiNewIdentifier` comprueba duplicados contra el conjunto de IDs de la
sesión suministrada, sin registrar ni crear componentes. No hay estado global.
Se rechazan huecos de arreglos, valores no finitos, objetos nativos y coerciones.
Las fechas verifican día/mes y años bisiestos; la compatibilidad efectiva de fechas
con GDateTime corresponde también al adaptador nativo.

Selección de ListBox/ColumnView: el dominio de lectura incluye NULO para modo
`ninguno`; la escritura se declara sólo para `unica`, `explorar` y `multiple`, tal
como enumera el catálogo normativo. `tecla` permite NULO cuando el keyval no tiene
nombre resoluble; esta normalización explícita se verificará con el binding.

## Validación técnica nativa — Bloque 2

`scripts/gui/validate-native.mjs` recibe una instalación **aislada** de node-gtk
4.1.1. Resuelve su entrada ESM pública mediante `import.meta.resolve` desde ese
directorio y ejecuta las pruebas GTK en procesos hijos con tiempo límite. No
instala paquetes automáticamente ni importa el addon en el Extension Host.

Se verificaron Windows x64, Node 24.16.0 (ABI 137) y GTK 4.22.4 mediante el addon
precompilado oficial. La evidencia está en `native-validation.win32-x64.node24.json`.
Esto **no certifica todavía** Linux, macOS, Node 22/26 ni GTK exactamente 4.10.

El ensayo cubre ESM, Application/Window/ApplicationWindow, temporizadores de Node,
callbacks informativos asíncronos, retornos booleanos reales de cierre/enlace/tecla,
cancelación de AlertDialog/FileDialog y lectura de la configuración inicial del
tema. La prueba adicional genera un programa CLRS y lo ejecuta con GTK real:
su callback de cierre combina `LONG(id)` y `OBTENER(id, "visible")` sin entregar
una Promise a la señal nativa.

La configuración comprobada usa un `GLib.MainLoop` explícito, como el ejemplo
ESM oficial. El primer ensayo sin ese ciclo no completó la cancelación de diálogos.
El ensayo final inicia cada operación desde una macrotarea y utiliza su propio
`Gio.Cancellable`, cancelado después de iniciarla. La integración productiva fue
revisada en el bloque 7 para conservar también E/S de Node. Este ensayo se
conserva como evidencia histórica, no como implementación productiva vigente.
El aviso de D-Bus de Windows observado no impidió completar ninguna prueba.

Referencias primarias consultadas:

- [Binding node-gtk y entrada ESM](https://github.com/romgrk/node-gtk).
- [Ejemplo ESM con GLib.MainLoop](https://github.com/romgrk/node-gtk/blob/master/examples/hello-world.mjs).
- [Retorno de close-request](https://docs.gtk.org/gtk4/signal.Window.close-request.html).
- [Retorno de activate-link](https://docs.gtk.org/gtk4/signal.LinkButton.activate-link.html).
- [Retorno de key-pressed](https://docs.gtk.org/gtk4/signal.EventControllerKey.key-pressed.html).

## Semántica y generación — Bloque 3

`GuiUsageDetector` recorre el AST existente y consulta símbolos resueltos. Incluye
llamadas en cuerpos no ejecutados, expresiones y arreglos; no busca texto ni
interpreta prefijos de IDs. Comentarios, cadenas y funciones/variables homónimas
del usuario no activan GUI. Las funciones GUI no pueden almacenarse como valores
ni introducir alias de funciones de primera clase.

`GuiSemanticAnalysis` comprueba aridad y dominios demostrables a partir de
literales; los valores dinámicos y las relaciones entre componentes quedan a cargo
del runtime. `CONECTAR` sólo admite un identificador resuelto de función CLRS en
su tercer argumento, sin invocarlo, reconstruirlo por nombre ni perder su closure.

Los callbacks sin suspensión y sus llamadas transitivas se emiten como funciones
síncronas. La recursión se analiza mediante un punto fijo. `leer`, operaciones
asíncronas de archivos/diálogos y llamadas indirectas impiden esa clasificación.
Por conservación de sus implementaciones actuales, `PROM` y `VAR` también se
consideran asíncronas; las demás funciones estándar declaradas seguras se emiten
sin su envoltura `async` sólo cuando las necesita un callback síncrono GUI. Una
prueba verifica que esos cuerpos de la biblioteca no contengan `await`.

Para `cerrar`, `activar_enlace` y `tecla_presionada`, un callback con suspensión
produce `CLRS_GUI_CALLBACK_REQUIRES_SYNC`. Si el nombre del evento es dinámico,
el puente conserva la clasificación y el runtime debe rechazarlo **antes de
invocarlo** cuando la señal concreta exige retorno inmediato. Una Promise nunca
se convierte en `true`. Los eventos informativos admiten espera y el runtime debe
registrar la Promise devuelta por el puente, observar su rechazo y propagar el
error con ubicación CLRS; no debe lanzar tareas sin seguimiento.

### Puerto interno del ensamblado

`CompilationService` acepta `runtimeContext.gui` preparado por infraestructura:

- `moduleUrl`: URL `file:` de la entrada pública ESM ya resuelta del binding.
- `factorySource`: expresión JavaScript autocontenida de la factory del runtime
  compartido. Es código interno confiable, no una opción de código del usuario.

La factory recibe el namespace del binding y `{ programKey, dependency,
invokeCallback }`. Debe completar la preparación antes de resolver y devolver
una sesión con `invoke(nombre, argumentos)`, `waitForIdle()` y `dispose()`.
`invoke` conserva el carácter síncrono/asíncrono del catálogo. `waitForIdle`
contempla ventanas, diálogos y callbacks pendientes; `dispose` cancela operaciones,
desconecta señales y libera estado. Si falla la propia inicialización, la factory
es responsable de liberar lo que alcanzó a crear.

Se reutiliza la clave de compilación como prefijo y se añade un UUID privado en
cada ejecución del JavaScript, para no compartir registros al reutilizar un
archivo generado. La importación GUI y las funciones de enlace sólo se incluyen
cuando el modelo semántico requiere GUI. La salida sin GUI conserva exactamente
el ensamblado anterior. La sesión se libera mediante `finally` y se conserva el
canal existente de errores, ubicación, cobertura y estado de ejecución.

Las factories de `gui.pipeline.test.js` y `native-generated-validation.mjs` son
puertos de ensayo mínimos: **no son la implementación pública de las 61 funciones**.
El provisionador del bloque 4 ya suministra la dependencia resuelta y el Node
validado. Los bloques 5–7 aportarán la factory de producción a ese contexto.
El exportador posterior deberá obtenerlo de la misma autoridad,
sin copiar rutas privadas en los archivos distribuidos.

## Dependencias privadas y pipeline — Bloque 4

`src/infrastructure/gui/` contiene el layout, la inspección de Node, el adaptador
npm, el resolver público ESM, el probe no visual y el administrador transaccional.
No depende de VS Code ni importa el addon nativo en el proceso coordinador.

La composición del CLI obtiene la raíz desde **su propio archivo instalado**
(fuente o bundle), nunca desde el directorio del programa del alumno. Sólo
`CompilationService.runSource` solicita preparación de capacidades después de
frontend y semántica. El análisis al editar, la generación/exportación y la
activación no provisionan dependencias. Un programa sin GUI no crea `.runtime`.

La distribución administrada es:

```text
<extensionRoot>/.runtime/
    packages/       manifest privado, lock real y node_modules
    npm-cache/      caché de esta instalación
    staging/        instalaciones/reemplazos aún no publicados
    locks/         exclusión entre procesos
```

`.runtime` queda excluido de Git y del VSIX. El manifest principal y sus
dependencias no incorporan node-gtk. No se usan dependencias del workspace,
instalaciones globales, `NODE_PATH`, gestores de paquetes del sistema ni fallback
a otro directorio si la instalación de la extensión no permite escritura.

### npm y compatibilidad

El inspector consulta el **Node que ejecutará el programa**, comprueba major
22/24/26, ABI y plataforma, y descarta Electron y arquitecturas fuera de x64/arm64.
Que un major/arquitectura sea admitido no certifica que exista un precompilado
para toda combinación: su ausencia se diagnostica sin compilar desde fuentes.

Para Windows se localiza el CLI JavaScript de npm y se ejecuta con ese Node,
sin invocar `npm.cmd` mediante un shell. Se conservan registry, proxy y certificados
del entorno/npm; se retiran `NODE_PATH`, `NODE_OPTIONS` y `ELECTRON_RUN_AS_NODE`
de los procesos de preparación. Node documenta las restricciones de los archivos
[`.cmd` y `.bat`](https://nodejs.org/api/child_process.html#spawning-bat-and-cmd-files-on-windows).

La primera instalación usa `npm install`; una reparación con lock válido usa
[`npm ci`](https://docs.npmjs.com/cli/commands/npm-ci/). Ambas desactivan scripts,
auditoría y mensajes de financiación. Esto es necesario porque el install de
node-gtk 4.1.1 habilita `--fallback-to-build`. Tras la descarga npm, se resuelve
el bin público de su instalador oficial y se solicita únicamente el precompilado
con `--fallback-to-build=false --build-from-source=false`, Node/ABI seleccionado.
No se descarga manualmente un tarball ni se mantienen rutas internas del binding.

La resolución usa `import.meta.resolve` y la exportación pública `package.json`
en un proceso hijo anclado al proyecto privado. También verifica versión y
pertenencia física al directorio privado para rechazar la resolución accidental
desde un paquete padre. El probe importa el binding en otro proceso, carga GTK
4.0 y comprueba 4.10 o posterior **sin abrir ventanas ni cambiar temas**.

### Publicación, reparación y cancelación

Las solicitudes concurrentes comparten una operación en memoria. Un bloqueo
exclusivo de filesystem protege diferentes CLI/Extension Hosts. Sus metadatos
incluyen PID, fecha y token; un PID vivo nunca se declara obsoleto sólo por edad.
Los locks de propietarios muertos se recuperan tras el umbral previsto. Un lock
incompleto o una recuperación interrumpida que no pueda certificarse finaliza
con timeout, sin borrar a ciegas el bloqueo.

Staging se valida antes de sustituir `packages`; se conserva la instalación
anterior hasta probar la nueva. La URL se vuelve a resolver y el probe se repite
en la ubicación final. Si falla, se restaura la anterior. Los enlaces simbólicos
en rutas administradas se rechazan antes de escribir/mover/eliminar. Si Windows
impide retirar un respaldo por DLLs abiertas, se conserva ese respaldo privado.

Cada ensure vuelve a verificar la instalación; no se utiliza una caché READY que
pueda ocultar cambios de Node, ABI, manifest, lock o archivos. Sólo se intenta una
reparación por solicitud. La falta de GTK nativo o una versión antigua no dispara
reinstalaciones npm de una dependencia ya presente.

`AbortSignal`, Ctrl+C y la señal enviada por el comando de detención cancelan la
preparación. Se termina el árbol del instalador, se espera su cierre y se retiran
staging/bloqueo. Cancelar un cliente no cancela a otros que comparten el trabajo;
cancelar al último sí detiene la instalación. La terminación forzada externa
del sistema puede dejar staging/locks reconstruibles: nunca los convierte en READY.

Los errores conservan códigos `CLRS_GUI_DEP_*` y mensajes públicos en español;
no se imprime stderr de npm, que podría incluir datos de autenticación.

### Integración y límite de este bloque

Después de preparar GUI se conserva el mismo `JavaScriptGenerator`, artefacto,
emisor y `NodeProgramRunner`. El runner utiliza el ejecutable validado y limpia
el temporal también al detenerse o fallar. El temporal GUI usa extensión `.mjs`
para que siga siendo ESM en workspaces que declaren `type: commonjs`. Los programas
sin GUI mantienen su formato y recorrido anteriores.

`GuiRuntimePreparation` enlaza los metadatos de infraestructura con la fuente
canónica del runtime. Al cerrar el bloque 4 no había factory productiva; el
bloque 5 aporta el subconjunto base descrito abajo. Una fuente explícitamente
ausente sigue provocando `CLRS_GUI_RUNTIME_NOT_READY` antes de emitir JavaScript.
Esto no significa que las 61 funciones estén ya operativas.

Las pruebas cubren instalación/reutilización, reparación única, rollback,
ausencia de GTK, offline, cancelación parcial/total, concurrencia, locks, symlinks,
ESM y rutas con espacios/no ASCII. El ensayo optativo `test:gui:private` descarga
la dependencia real en una carpeta temporal aislada, valida publicación y
reutilización y la elimina al finalizar. Requiere acceso a npm y a los binarios
oficiales, pero no abre ventanas.

El ensayo real del 10 de septiembre de 2026 pasó en Windows x64 con Node 24.16.0
y GTK 4.22.4. La evidencia está en `private-runtime-validation.win32-x64.node24.json`.
Se verificaron descarga privada, binario precompilado, resolución pública, probe,
publicación transaccional, reutilización y limpieza en una ruta con acentos,
espacios y `#`. Linux, macOS, otros majors y el corpus de widgets siguen pendientes.

## Bloque 5 — Runtime base, ventanas, contención y temas

`GuiRuntimeSource` incorpora una única implementación autocontenida de
`GuiBaseRuntime` en el JavaScript generado. Reutiliza los dominios, firmas,
capacidades y validadores del catálogo; no carga `node-gtk` en el Host ni añade
otro pipeline. Su serialización se comprueba también después del bundling ESM.

El subconjunto ejecutable de este bloque incluye:

- `VENTANA` y `VENTANA_APLICACION`, ambas asociadas a una única `Gtk.Application`
  iniciada antes de añadir ventanas; aplicación `NON_UNIQUE`, sin datos del
  usuario en su identificador. Registro privado independiente por ejecución.
- `CAJA`, `CUADRICULA` y `CONTENEDOR_DESPLAZABLE`, sus propiedades y las propiedades
  comunes de Widget, con accesos curados y sin exponer GObject.
- `MOSTRAR`, `OCULTAR`, `ENFOCAR` (retorno lógico), `CONTENER`, `ANEXAR`,
  `PREPONER`, `COLOCAR`, `QUITAR` y las acciones de ventana. `ancho`/`alto`
  conservan el tamaño solicitado, no la asignación de píxeles del gestor de ventanas.
- Evento `cerrar` con callback CLRS inmediato: `Verdadero` veta el cierre;
  `Falso`/`NULO` lo permiten. Se rechazan callbacks asincrónicos antes de conectarlos.
- Las cuatro funciones de tema mediante `Gtk.Settings`, sin CSS, sin paleta de
  VS Code y sin cambiar la configuración inicial si el programa no lo pide.

Cada ID queda reservado durante su ejecución. No se permite reparentado implícito,
reemplazar un hijo único, crear ciclos, contener ventanas de nivel superior ni
retirar hijos ajenos. El `GtkViewport` que GTK introduce en un contenedor
desplazable es privado: la relación y `QUITAR` utilizan el hijo lógico CLRS.
Las operaciones inválidas no actualizan el registro. Se verifican además los
límites de enteros nativos, el extremo de las posiciones de Grid y los tamaños
mínimo/máximo de ScrolledWindow antes de llamar a GTK.

La aplicación conserva un hold durante el programa y espera sus ventanas al
terminar `PRINCIPAL`. Cerrar una ventana no termina otra. Ocultar una ventana,
incluido `ocultar_al_cerrar`, **no la destruye ni elimina su pertenencia a GTK**:
el proceso puede seguir abierto; se puede volver a mostrar o detener mediante
el comando existente. `dispose` desconecta señales, destruye las ventanas sin
veto de callbacks, limpia registros, restaura preferencias modificadas y libera
hold/loop. Los errores conservan mensajes en español por el canal de ejecución
existente; un fallo nativo no reinstala dependencias.

El estado base del tema se captura antes de su primera modificación. `sistema`
restaura la preferencia oscura inicial sin deshacer el nombre elegido. Cambiar
el tema no recrea widgets. GTK puede usar fallback si no encuentra un tema;
el runtime no afirma detectar su disponibilidad a partir de ese fallback.

Referencias GTK comprobadas: [pertenencia de ventanas a la aplicación](https://docs.gtk.org/gtk4/method.Application.add_window.html),
[solicitud de cierre](https://docs.gtk.org/gtk4/method.Window.close.html),
[restricción de tamaños desplazables](https://docs.gtk.org/gtk4/method.ScrolledWindow.set_min_content_width.html)
y [posiciones y extensiones de Grid](https://docs.gtk.org/gtk4/method.Grid.attach.html).

### Verificación y límites del bloque 5

`test/gui.runtime.test.js` verifica contrato ejecutable, aislamiento de IDs,
propiedades, relaciones, errores, cierre, temas, limpieza y fuente posterior al
bundling, sin instalar ni cargar GTK. Forma parte de `test:unit`.

`npm run test:gui:base -- <directorio-aislado-con-node-gtk-4.1.1>` ejecuta en un
proceso separado la factory productiva y programas CLRS generados. No descarga
paquetes; abre ventanas brevemente y las cierra automáticamente, con timeout.
Evidencia: `base-runtime-validation.win32-x64.node24.json`, Windows x64,
Node 24.16.0 y GTK 4.22.4. Se verificaron todas las propiedades base, el retiro
del hijo desplazable, cambios de tema con widgets existentes, varias ventanas,
veto de cierre, ocultación, programa sólo de tema, callbacks generados y errores
localizados. El ensayo produjo un aviso no fatal de GIO sobre D-Bus de Windows;
no impidió el cierre ni alteró los códigos de salida. La conexión de activación
se realiza después del handler predeterminado para permitir limpiar la sesión
desde el loop sin provocar una advertencia de activación al salir.

Al cerrar el bloque 5 quedaban pendientes los controles del bloque 6 descritos
abajo. Los demás eventos, controladores y diálogos/operaciones pertenecen aún
al bloque 7: se rechazan con `CLRS_GUI_RUNTIME_UNSUPPORTED`, sin simularlos. El
hold base protege la ejecución actual; el rastreo de operaciones asincrónicas
independientes de las ventanas se integrará con los diálogos del bloque 7.
Linux, macOS, Node 22/26 y GTK exactamente 4.10 siguen pendientes de ensayo nativo.

## Bloque 6 — Controles y modelos

La misma factory productiva incorpora `GuiControlsAdapter` y `GuiModelsAdapter`.
Se serializan desde sus implementaciones originales; no
importan GTK en el Extension Host y no duplican el catálogo ni el pipeline.
Se añaden las 17 factories no dialogales restantes: etiquetas, entradas normales
y de contraseña, área de texto, cuatro tipos de botón, entrada numérica,
deslizador, progreso, carga, desplegable, calendario, imagen, lista visual
y vista de columnas.

Las propiedades utilizan accesos curados y los validadores comunes. El texto
de etiquetas/celdas es literal, sin interpretar markup; TextView usa su buffer
privado. Se normalizan enums, valores nullable y fechas `[año, mes, día]` sin
exponer objetos GTK. Los grupos sólo admiten botones del mismo tipo, y se
desvinculan al cerrar sus ventanas. Cambiar un extremo de un rango comprueba
el otro antes de modificar GTK; un intervalo de un único valor es válido.
La precisión respeta los límites nativos de SpinButton/Scale. El indicador
de carga empieza detenido. Calendar utiliza la API compatible con GTK 4.10.

### Modelos y selección

`LISTA_DESPLEGABLE` utiliza Gtk.StringList. En GTK 4.22.4, el SingleSelection
privado del widget ignora INVALID con opciones no vacías. El adaptador mantiene
una opción vacía privada para representar realmente la ausencia de selección:
el popup puede mostrar esa opción de limpieza, pero `opciones` no la incluye,
los índices públicos siguen siendo base cero y `seleccion = -1` produce
`valor = NULO`. Una opción pública `""` sigue siendo una cadena seleccionada,
distinta de NULO. Reemplazar opciones conserva el índice válido, o lo limpia.
Referencia de la discrepancia: [implementación GTK 4.22.4](https://github.com/GNOME/gtk/blob/4.22.4/gtk/gtkdropdown.c).
El bloque de eventos deberá reutilizar esta normalización, no el índice nativo.

`LISTA_VISUAL` usa Gtk.ListBox y sus Gtk.ListBoxRow privados. QUITAR retira
el wrapper y libera el hijo para reutilizarlo en otro contenedor. `VISTA_COLUMNAS`
es una Gtk.ColumnView real: Gtk.StringList almacena filas escalares serializadas,
GtkSelectionModel representa la selección, Gtk.ColumnViewColumn y
Gtk.SignalListItemFactory crean/enlazan las celdas. No se simula mediante una
cuadrícula. Los datos entrantes/salientes no comparten arreglos con el programa.

Los modos ninguno/unica/explorar/multiple devuelven NULO, índice o arreglo según
su contrato; -1 también limpia el modo explorar. Índices fuera de rango y filas
con ancho incorrecto se rechazan antes de cambiar el modelo. Cambiar títulos
exige conservar el ancho de filas existentes. Anexar/retirar/limpiar filas no
recrea columnas. Cerrar sus ventanas o disponer la sesión libera modelos y
señales internas de factories. Las señales públicas de selección son bloque 7.

### Aislamiento del archivo técnico

El contrato vigente contiene 24 componentes y 61 funciones GUI. La capacidad
semántica es únicamente `gui`; la preparación y el probe sólo comprueban
node-gtk y GTK >= 4.10. `IMAGEN`, sus propiedades y `LIMPIAR_IMAGEN` mantienen
su implementación. `PARAR` se aplica exclusivamente al indicador de carga.

El trabajo previo de multimedia se conserva en `test/internal/gui-media/`,
separado del producto. Sus adaptadores/probes no se importan desde `src/`,
no se serializan en el JavaScript, no se incluyen en el bundle ni en el VSIX.
Las instantáneas de contratos y pruebas anteriores son archivos de texto; las
tres comprobaciones internas autocontenidas se ejecutan sólo de forma explícita,
fuera de la aceptación GUI. El informe anterior completo se conserva allí como
`validation-history.md`; sus resultados y recomendaciones son históricos,
no requisitos de la biblioteca actual.

### Pruebas y alcance del bloque 6

`test/gui.contract.test.js` verifica las 24 fichas, firmas, propiedades, acciones
y eventos declarados. `test/gui.controls.test.js` cubre modelos, selección,
filas, grupos, rangos, buffer y limpieza con dobles. `test/gui.environment.test.js`
verifica ausencia de símbolos multimedia, error ordinario de identificador no
definido, probe mínimo, IMAGEN, bundling y JavaScript autónomo sin dependencia
de VS Code. El contrato del exportador completo de proyecto sigue reservado
al bloque 12; no se presenta un proyecto sintético de ensayo como su implementación.

`test:gui:controls` comprueba los 17 controles nativos del bloque 6 y el código
CLRS generado; `test:gui:base` cubre las cinco factories de ventanas/contención
del bloque 5. Los dos diálogos restantes tienen contrato probado y validación
técnica de GTK del bloque 2; su integración productiva corresponde al bloque 7.
Por tanto, 24 componentes catalogados no equivale a haber implementado antes
de tiempo las funciones de ese bloque.

Linux/macOS, Node 22/26 y GTK exactamente 4.10 continúan pendientes de validación
nativa. Estas limitaciones multiplataforma no se ocultan ni se sustituyen con
pruebas de dobles. No se modifican versión, README público, inicio guiado ni VSIX.

## Fronteras para los siguientes bloques

### Cierre del bloque 6 — 10 de septiembre de 2026

La retirada pública de VIDEO queda completada: 24 componentes y 61 funciones,
sin capacidad, imports, diagnósticos ni recomendaciones multimedia en producción.
No hay API alternativa ni símbolo reservado: una llamada sin declaración recibe
`CLRS_UNDEFINED_IDENTIFIER`, como cualquier identificador inexistente.

Resultados de esta revisión:

- `npm run build`: aprobado (Host, CLI y webview).
- `npm run test:unit`: aprobado, incluidas las suites previas; 1003 pruebas
  aprobadas en la suite principal, cero fallos y cero omisiones.
- `npm run lint`: cero errores; seis advertencias previas no relacionadas.
- GTK real, Windows x64, Node 24.16.0, node-gtk 4.1.1 y GTK 4.22.4:
  17 controles e IMAGEN aprobados; regresión de ventanas/contención/temas aprobada.
  Evidencia: `controls-without-media.win32-x64.node24.json`.
- Tres comprobaciones del archivo técnico interno aprobadas por ejecución
  explícita, fuera de la suite productiva.

La fixture de imagen se escribe antes de iniciar el bucle nativo GTK. Al escribirla
asíncronamente desde la continuación de inicialización el ensayo agotaba su tiempo;
se corrigió su preparación, no el runtime. Para el bloque 7 queda expresamente
pendiente validar E/S asíncrona desde callbacks junto con eventos y diálogos.
El cierre corresponde al alcance de controles/modelos del bloque 6, no certifica
esos bloques posteriores ni las plataformas todavía no ensayadas.

Archivos de producción ajustados: `GuiComponentCatalog.js`, `GuiFunctionCatalog.js`,
`GuiErrors.js`, `GuiRuntimeSource.js`, `GuiBaseRuntime.js`, `GuiControlsAdapter.js`,
`GuiEnvironmentProbe.js`, `GuiRuntimePreparation.js`, `GuiJavaScriptAssembly.js`,
`NodeGtkProbe.js` y `NodeGtkDependencyManager.js`. `GuiMediaAdapter.js` y la fixture
multimedia se trasladaron al archivo técnico; no se destruyó su implementación.

Pruebas y herramientas ajustadas: las suites `gui.contract`, `gui.controls`,
`gui.dependencies`, `gui.environment` y `gui.runtime`; el doble `FakeModels.js`;
los ensayos `native-controls-validation.mjs` y `validate-environment.mjs`;
la matriz de trazabilidad y la evidencia nativa. Los cuatro documentos normativos
GUI se actualizaron sin presentar VIDEO como parte del contrato vigente.

Los códigos `CLRS_GUI_MEDIA_BACKEND_UNAVAILABLE`, `CLRS_GUI_MEDIA_LOAD_FAILED`,
`CLRS_GUI_MEDIA_FORMAT_UNSUPPORTED`, `CLRS_GUI_MEDIA_RESOURCE_UNAVAILABLE` y
`CLRS_GUI_MEDIA_NOT_SEEKABLE` sólo quedan en el archivo técnico histórico.

### Contratos de continuidad

- Los tres eventos con retorno semántico inmediato (`cerrar`, `activar_enlace`,
  `tecla_presionada`) no pueden despachar una Promise como respuesta a GTK. El
  puente compartido conserva esa semántica; los tres están conectados desde el
  bloque 7 y se rechazan callbacks asincrónicos antes de registrar sus señales.
- Diálogos: se declara espera asincrónica y cancelación normal; seleccionar un
  archivo no lo lee ni escribe. No heredan propiedades/eventos/acciones Widget.
- Tema: alcance de sesión, sin imponer configuración inicial, sin CSS público y
  con restauración de la preferencia inicial para `sistema`, conservando el nombre
  de tema explícito. Un fallback GTK no demuestra por sí solo que el tema exista.
- `NODE_GTK_RUNTIME_DEPENDENCY` fija la dependencia y los mínimos. Importar el
  catálogo no instala paquetes, no carga el binding y no inicia aplicaciones.
- Desde el bloque 10, `cost` contiene un descriptor canónico y `costStatus` es
  `modeled`. No se presume O(1) para estado/recurso de tamaño no demostrado.
  Los efectos simbólicos sobre el valor devuelto permanecen opacos. Detalle:
  [Modelo de costos GUI](cost-model.md).

## Verificación

```text
node --test test/gui.contract.test.js test/standard.library.catalog.test.js
node --test test/gui.pipeline.test.js
node --test test/gui.dependencies.test.js
npm run test:gui:native -- <directorio-aislado-con-node-gtk-4.1.1>
npm run test:gui:private
```

Las suites de contrato, pipeline y dependencias forman parte de `test:unit` y no requieren GTK.
La prueba nativa es optativa y separada: abre ventanas de ensayo brevemente y las
cierra al terminar. Ninguna de ellas sustituye el corpus integral de aceptación
de los componentes y plataformas de los bloques finales.

No se modifican README público, versión, inicio guiado, gramática, snippets, DAP,
diagramador, complejidad ni BROKER.95. No se genera VSIX.

## Cierre del bloque 7 — Eventos, callbacks y diálogos

Implementación compartida en `GuiEventsAdapter.js`, `GuiDialogsAdapter.js` y
`GuiEventLoop.js`, integrada en `GuiBaseRuntime.js` y serializada por
`GuiRuntimeSource.js`. No hay API nativa en el Extension Host ni un runtime
diferente para el código generado. Se mantienen 24 componentes y 61 funciones.

- Se conectan las 181 combinaciones componente/evento del catálogo: señales,
  buffers, notificaciones, selección, controladores de teclado/puntero y gestos.
- Sólo los tres eventos inmediatos devuelven booleano a GTK. Los informativos
  inician callbacks en orden de emisión, con continuaciones async independientes;
  sus retornos se ignoran y las promesas se observan sin rechazos huérfanos.
- Se copian argumentos escalares/arreglos, se normalizan índices/fechas/bordes
  y se agrupan notificaciones intermedias de una misma mutación CLRS. Al cambiar
  el modelo de selección se desconecta el anterior. No se entregan GObject.
- AlertDialog/FileDialog admiten propiedades, índices y filtros validados,
  instantánea por apertura, padres de la misma sesión, resultados CLRS y cancelación.
  Seleccionar rutas no lee, crea ni escribe archivos.
- El padre que se destruye cancela sus diálogos; la disposición drena callbacks
  nativos antes de detener el bucle, con límite de dos segundos ante un fallo de
  la infraestructura. Las alertas sin espera también se rastrean. Un callback
  fallido cancela diálogos pendientes y conserva su error y ubicación originales.
- Se usa `Gtk.Application.register` y `GLib.MainContext.iteration(false)` con
  trabajo acotado y cesión a Node. No hay bucles GTK bloqueantes anidados; el ensayo
  ahora completa `fs.readFile`, promesas y timers con la GUI activa.
- Se corrigió la asociación explícita de ApplicationWindow mediante `addWindow`:
  la forma de constructor anterior no asociaba realmente esa ventana al runtime.

### Validación y límites del entorno

La evidencia reproducible está en `events-dialogs.win32-x64.node24.json`.
`npm run test:gui:events -- <instalación-aislada>` no instala paquetes y ejecuta
el addon en un proceso hijo con tiempo límite.

GTK real: Windows x64, Node 24.16.0, node-gtk 4.1.1 y GTK 4.22.4. Se verifican las
181 conexiones, eventos normalizados, elección de un botón de alerta, cancelación
al cerrar el padre, disposición con alerta pendiente y programas CLRS generados
con callback exitoso y con error localizado. Pasan también los ensayos previos
de ventanas/temas y los 17 controles/modelos, incluida IMAGEN.

La copia usada en el ensayo original carecía de los esquemas GSettings del
selector GTK. La investigación posterior confirmó que el binario oficial sí
incluye el XML y `gschemas.compiled`: era una copia local incompleta, no una
carencia del paquete publicado. La evidencia histórica en `events-dialogs` se
conserva; el nuevo ensayo de reparación descrito abajo supera esa limitación
para apertura/cancelación. La selección positiva de una ruta real sigue pendiente.
La protección defensiva de FileDialog (`CLRS_GUI_DIALOG_RESOURCES_UNAVAILABLE`)
se mantiene sin cambios; ahora el provisioning detecta antes los recursos ausentes.

node-gtk 4.1.1 entrega ciertos GError como Error(message), sin dominio/código.
Para cancelaciones se prefieren los datos estructurados; si no existen, sólo se
admiten los dos literales exactos no traducidos de GTK: `Dismissed by user` y
`Cancelled by application`. Un error desconocido sigue siendo un fallo controlado,
nunca se convierte en cancelación por contener una palabra parecida.

### Corrección del aprovisionamiento: recursos GTK esenciales

`GuiEnvironmentProbe.js` valida mediante GIO la resolución recursiva de
`org.gtk.gtk4.Settings.FileChooser`, además del binding y GTK >= 4.10. Se ejecuta
en un hijo Node acotado. La fase `schemas` tiene el código
`CLRS_GUI_DEP_GTK_RESOURCES_UNAVAILABLE`; no basta con comprobar archivos.
El entorno privado Windows se calcula desde la entrada ESM y el ABI antes de
cargar el addon, tanto en el probe como en el programa generado. No se cambian
variables globales; Linux/macOS conservan su entorno GTK externo.

Los tests `gui.dependencies.test.js` utilizan instaladores dobles, pero resolver,
probe hijo, locks y publicación reales. Cubren eliminación de compiled, una sola
reparación, fallo persistente, rollback por revalidación final y ausencia de npm
ante recursos del GTK externo ausentes en Linux/macOS. `gui.environment.test.js`
cubre fuente nula, lookup fallido, excepción, terminación nativa, entorno privado
aislado y el recorrido sin GUI.

Ensayo nativo opt-in: `node scripts/gui/validate-schema-repair.mjs`. Crea una
instalación exclusiva bajo `.runtime/schema-validation-*`, usa el administrador
y el instalador npm de producción, elimina únicamente `gschemas.compiled` de
esa copia y verifica su reparación. No modifica la instalación del desarrollador.
Elimina al terminar su árbol de prueba y comprueba staging/locks vacíos.
Requiere red y GTK Windows del precompilado; no pertenece a la suite unitaria.

Resultado observado: Windows x64, Node 24.16.0/ABI 137, node-gtk 4.1.1, GTK 4.22.4.
La prueba antigua (carga/versión) seguía pasando sin compiled; el nuevo probe lo
rechazó. Hubo exactamente **una reparación**, con tres validaciones del manager:
fallo inicial, staging válido y ubicación final válida; después se hizo otro
probe independiente satisfactorio. No se compiló ningún schema ni se instaló
ningún paquete del SO.

`native-file-dialog-validation.mjs` verificó con GTK real las cinco aperturas y
cancelaciones mediante `Gio.Cancellable`, con carpeta inicial válida, además de
`dispose()` con una operación pendiente. El hijo terminó con código 0. Se observó
un aviso no fatal de GLib sobre el binario dbus de sesión Windows; no impidió
estas comprobaciones. **No certifica selección interactiva de una ruta ni clic
manual en Cancelar**, ni ejecución nativa en Linux/macOS. Evidencia estructurada:
`schema-repair.win32-x64.node24.json`.

Referencias de implementación:

- [Iteración no bloqueante de GLib](https://docs.gtk.org/glib/method.MainContext.iteration.html).
- [Registro de la aplicación](https://docs.gtk.org/gio/method.Application.register.html).
- [Consulta de esquemas sin abortar](https://docs.gtk.org/gio/method.SettingsSchemaSource.lookup.html).
- [Errores públicos de diálogos GTK](https://docs.gtk.org/gtk4/error.DialogError.html).

Pruebas: `gui.events.test.js`, `gui.dialogs.test.js`, ampliaciones de `gui.runtime`
y `gui.pipeline`, más los dobles de infraestructura. El corpus principal pasa
**1024/1024 pruebas**, sin fallos ni omisiones; también pasa la compilación del
Host, CLI y webview. Lint conserva seis advertencias previas,
sin errores. No se certifican Linux/macOS, Node 22/26 ni GTK exactamente 4.10.
No se avanzan los bloques posteriores de DAP/editor, complejidad ni publicación.

## Bloque 8 — Depuración y sesiones DAP

La instrumentación GUI reutiliza `CLRSDebugAdapter`, el runner CLI y las sesiones
de control/trazas por archivo existentes. No hay otro adaptador ni importación
del addon nativo en el Extension Host. El programa GUI generado mantiene pilas
de callbacks informativos mediante contextos asincrónicos; los callbacks de
retorno inmediato conservan el llamador CLRS sólo si existe en la pila activa.
Un evento externo no adopta el stack de PRINCIPAL suspendido en un diálogo.

Los pasos, breakpoints normales/condicionales, logpoints y conteos se aplican a
instrucciones CLRS. Los snapshots contienen variables y parámetros CLRS, no el
registro GUI ni objetos GTK. Step Over de un diálogo espera su resultado dentro
del contexto de origen; no se consume por otro callback. Step Out sin llamador
vuelve a la espera con la última ubicación, sin inventar una instrucción GTK.

La espera de eventos atiende pausa/terminación mediante el canal existente.
Durante un breakpoint se detienen Node y GTK: la ventana puede parecer congelada
hasta continuar, sin despachar callbacks reentrantes. Terminate/disconnect
desenrollan los finally, cancelan diálogos y disponen la sesión antes de emitir
un único final cancelado. Se conserva la terminación forzada de respaldo existente.

`npm run test:gui:debug` ejecuta diez pruebas con el adaptador DAP y procesos Node
reales, usando un binding GTK doble. Cubren entrada, variables/pila, pasos,
callbacks solapados, cierre externo, errores localizados, diálogos pendientes,
aislamiento entre sesiones, breakpoints y limpieza. El doble sólo despacha eventos
cuando lo solicita la prueba. No se requiere GTK para el corpus unitario.

`npm run test:gui:debug:native` instala node-gtk exclusivamente en su carpeta
temporal bajo `.runtime`, usando el administrador de producción; ejecuta el
JavaScript GUI en otro proceso y elimina la instalación aislada al terminar.
En Windows x64, Node 24.16.0 y GTK 4.22.4 se verificaron Step Into/Out de cierre
síncrono, terminación normal, locales del callback de cambio y Step Over/Pause/
Terminate mientras un FileDialog real estaba pendiente. El proceso terminó con
código 0 y estado cancelado, sin ejecutar la instrucción posterior al diálogo.
Staging y locks quedaron vacíos. Evidencia: `debug.win32-x64.node24.json`.

Se observó el aviso no fatal conocido de GLib sobre dbus en Windows. No se
certifican selección manual de archivos, frontend de depuración de VS Code,
Linux/macOS, otras versiones de Node/GTK ni cierre externo mediante automatización
del escritorio (este último caso sí está cubierto con el doble). No se modifica
la API pública, la versión ni se genera VSIX; editor y bloques posteriores quedan
fuera de esta entrega.

Cierre verificado del bloque 8: **1041/1041 pruebas unitarias**, sin fallos ni
omisiones; compilación del Extension Host, CLI y webview satisfactoria. Lint:
cero errores y seis advertencias previas ajenas a este bloque. El empaquetador
web conserva su aviso previo de chunks mayores de 500 kB. Las diez regresiones
DAP GUI forman parte del corpus principal; la prueba GTK real es opt-in.

## Bloque 9 — Editor, resaltado, snippets y diagramador

La proyección `GuiEditorCatalog.js` deriva de los 61 contratos GUI canónicos:
firmas, argumentos, dominios y retornos, junto con propiedades y eventos de los
24 componentes. Se integra en la ayuda existente, autocompletados, información
al pasar el puntero, ayuda de parámetros e inlays. No supone costos constantes:
el costo GUI permanece pendiente del bloque correspondiente.

`CONECTAR` ofrece funciones locales como referencias, sin insertar paréntesis ni
convertirlas en llamadas. La navegación, referencias y resaltado semántico
mantienen la identidad del símbolo y respetan funciones locales homónimas. La
gramática TextMate reconoce las funciones GUI también en expresiones anidadas.
Los 61 snippets siguen el formato de descripción existente; una prueba compara
sus firmas, tipos, nombres y placeholders con el catálogo para evitar divergencias.
No se cambia el inicio guiado, la API pública ni se agrega un visor GUI.

`GuiExecutionFlow.js` registra estados de control en el canal de trazas actual,
con y sin DAP. El contexto de cada callback conserva su espera y su retorno;
una ventana abierta sin instrucciones activas se representa con ubicación nula.
La espera de un diálogo conserva la llamada original. No se inventan figuras,
aristas ni subgrafos: el modelo sintáctico y su Mermaid permanecen idénticos.

El servicio y el frontend conservan esos estados en instantáneas, lotes y
reproducción. La barra indica espera, entrada, retorno, reanudación o pausa DAP.
La reproducción recorre historia, no ejecuta código ni abre ventanas. Si un
filtro oculta el destino de un nuevo paso, se muestra el diagrama completo.
El contorno de espera es discontinuo y sin pulso; los contornos de ejecución
superan las prioridades de estilo de Mermaid y restauran el tema al limpiar.

`npm run test:gui:editor` ejecuta once regresiones: cinco de editor y seis de
trazas/diagramador. Cubren generación real y procesos Node sin DAP, callbacks
solapados, retorno al flujo suspendido, espera/resolución, pausa DAP, límites,
aislamiento de datos, reproducción y conservación exacta del modelo. GTK es un
doble en este corpus; no exige bibliotecas nativas. Se conservan las regresiones
del depurador de consola y GUI, incluidos Step Over/Into/Out y pilas de llamadas.

El ensayo opt-in `npm run test:gui:debug:native` también verifica el metadato de
espera de un FileDialog real y su pausa DAP. Windows x64, Node 24.16.0, node-gtk
4.1.1, GTK 4.22.4; instalación aislada eliminada al terminar. Se conserva el
aviso no fatal de GLib sobre dbus. El renderer real se revisó en navegador, a
910 y 520 px, con un modelo del parser e historia sintética: espera, retorno,
reanudación, filtro de función y barra responsiva. Esa revisión visual no
sustituye los ensayos de ejecución. Evidencia y límites:
`editor-diagram.win32-x64.node24.json`.

No se certifican Linux/macOS, Node 22/26, GTK exactamente 4.10, selección manual
de archivos ni interacción manual con IntelliSense/DAP en VS Code. La versión
se conserva en 1.8.1; no se genera VSIX ni se avanza a bloques posteriores.

Cierre verificado del bloque 9: **1052/1052 pruebas del corpus principal** y
**97/97 comprobaciones previas** de `npm run test:unit`, sin fallos ni omisiones.
Compilación del Extension Host, CLI y webview satisfactoria. Lint: cero errores
y seis advertencias preexistentes; Vite conserva el aviso de chunks mayores de
500 kB. La página auxiliar del ensayo visual y su servidor local se retiraron.

## Bloque 10 — Costos y análisis de complejidad

Las 61 funciones GUI tienen un modelo directo canónico compartido con la ayuda
del editor. El visitante resuelve símbolos estándar semánticamente y compone
esos costos mediante el álgebra existente, incluidos escenarios y recurrencias.
Las medidas de volumen de texto/arreglos conservan argumentos, dimensiones
interiores y, cuando se conoce, longitud exterior durante llamadas entre funciones.
No se confunde un valor de datos con un número ni el registro con la ejecución
de un callback.

Las propiedades dependen del tipo demostrado y del estado requerido. No se
inventan cotas de filas, filtros, jerarquías, recursos externos o selecciones:
cuando no se demuestra ese tamaño aparece O(?) con explicación de la causa.
El informe explicita sus supuestos: no mide espera humana ni renderizado, no
acota el despacho de eventos y no predice la duración de una sesión interactiva.

`npm run test:gui:cost` reúne 16 pruebas enfocadas, también incluidas en el corpus
unitario normal. Cubren todos los descriptores/factories/propiedades, composición,
recurrencias, mutaciones, nombres homónimos, instantáneas de eventos y regresión
sin GUI. La generación excluye los metadatos de costos y no incorpora analizadores
al runtime exportado. No cambia la API GUI ni el aprovisionamiento.

Contrato, fórmulas y límites: [Modelo de costos GUI](cost-model.md).
Trazabilidad: GUI-24, `compiler-tested`. No se realizaron nuevos benchmarks ni
ensayos GTK nativos en este bloque; las evidencias anteriores conservan su alcance.
README público, CHANGELOG y versión permanecen sin cambios. No se genera VSIX
ni se adelanta el bloque 11.

Cierre verificado: **1068/1068 pruebas del corpus principal** (incluidas las 16
nuevas) y **97/97 comprobaciones previas**, sin fallos ni omisiones. Compilación
del Extension Host, CLI y webview satisfactoria. Lint: cero errores y las seis
advertencias preexistentes; Vite conserva su aviso de chunks mayores de 500 kB.
Los ensayos de bundling y la compilación se repitieron fuera del aislamiento de
lectura tras un primer fallo de acceso de esbuild a las rutas del proyecto.

## Bloque 11 — Pruebas funcionales y evidencias de BROKER.95

Los ejecutores de pruebas CLRS y BROKER.95 reutilizan la preparación GUI privada
antes de generar el programa y seleccionan el Node validado para cada caso.
Conservan entrada/salida, semilla, cobertura, límites y aislamiento. No hay
aprovisionamiento GTK para programas de consola. La cancelación y los límites
detienen también los probes descendientes del programa GUI.

La evidencia distingue callbacks potenciales de ejecución observada; las
funciones GUI mantienen su clasificación de biblioteca estándar. Una salida
correcta no acredita corrección visual, ni una espera agotada demuestra por sí
sola un ciclo infinito. Si falla la preparación del runtime o se cancelan las
pruebas, la evaluación se detiene antes de consultar CIPHER o liquidar el contrato.

Corpus y límites: [Pruebas y evidencias GUI](testing-evidence.md).
Trazabilidad: GUI-17, `compiler-tested`. `npm run test:gui:testing` reúne las
quince regresiones GUI y las suites de revisión/evaluación, incluidas en el
corpus principal. Node, generación y runtime son reales; GTK utiliza un doble.
No se efectuaron nuevos ensayos nativos GTK ni se certifica interacción visual.

Cierre verificado: **1085/1085 pruebas principales** y **97/97 previas**,
sin fallos ni omisiones. Compilación de Extension Host, CLI y webview correcta;
lint sin errores y con seis advertencias preexistentes. Vite conserva su aviso
de chunks mayores de 500 kB. La versión permanece en 1.8.1; README público y
CHANGELOG no cambian. No se genera VSIX ni se adelanta el bloque siguiente.

## Bloque 12 — Exportación JavaScript autónoma

El comando **Generar código JavaScript** decide desde la capacidad semántica
`gui`, no buscando texto. Un programa sin GUI conserva el archivo único
`app/<programa>/<programa>.js`; no crea proyecto npm, lockfile ni dependencia
`node-gtk`. Un programa GUI genera un directorio independiente por documento
bajo `app/` con el entry, `prepare-packable.cjs`, `bootstrap.cjs`,
`package.json` y `package-lock.json`, sin rutas a la instalación privada de
CLRS y sin aprovisionar GTK durante la exportación.

El lock se genera en staging con npm y sin scripts, se valida antes de
publicarse y la publicación es transaccional. Se rechazan enlaces, rutas
locales, credenciales y locks que no respeten la versión canónica
`node-gtk@4.1.1`. La carpeta anterior se conserva como respaldo cuando contiene
una exportación previa, de modo que un fallo no mezcla ni borra archivos.

`npm run test:gui:export` cubre ambas salidas, cancelación, concurrencia,
restauración, rutas de documentos homónimos, proyecto trasladado y diagnóstico
sin VS Code. El ensayo opt-in `npm run test:gui:portable-install:native` se
ejecutó con Windows x64, Node 24.16.0, ABI 137, npm 11.13.0, node-gtk 4.1.1,
@yao-pkg/pkg 6.22.0 y GTK 4.22.4: produjo un lock real, trasladó el proyecto,
eliminó el origen y comprobó `npm ci`, binding instalado, CLI `pkg`, `npm start`
sobre el entry normal, ejecución directa y equivalencia con el binding privado.
No construyó el ejecutable portable. La evidencia y sus límites están en
[Exportación GUI](export-evidence.md). `test:gui:export:native` permanece como
alias compatible del mismo script. `npm start` usa el entry normal; sólo
`build:win` o `build:unix` generan el packable y el `dist/` interno.

El smoke test `npm run test:gui:portable-build:native` se mantiene fuera del
corpus determinista. En Windows x64 con Node 24 produjo un ejecutable host,
eliminó el proyecto original, extrajo el runtime `node-v137-win32-x64` en el
primer arranque y comprobó su reutilización byte a byte en el segundo. El
resultado está en `portable-build.win32-x64.node24.json`; Linux y macOS sólo
quedan declarados como matriz manual opt-in hasta que exista evidencia real de
esos hosts.

Cierre verificado: **1103/1103 pruebas principales** y **97/97 previas**, sin
fallos ni omisiones. Compilación de Extension Host, CLI y webview correcta;
lint sin errores y con seis advertencias preexistentes. Vite conserva el aviso
de chunks mayores de 500 kB. La versión permanece en 1.8.1; README público y
CHANGELOG no cambian. No se genera VSIX ni se avanza al bloque siguiente.
