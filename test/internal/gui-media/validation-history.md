# Evidencia histórica — no representa el contrato público actual

# GUI — Contrato y validación de los bloques 1–6

La matriz `contract-traceability.v1.json` vincula los cuatro documentos normativos
entregados el 9 de septiembre de 2026 con los contratos y las pruebas de este
bloques. Conserva sus hashes para identificar la revisión utilizada; las pruebas
no dependen de que exista la carpeta Downloads del autor.

## Autoridad compartida

`src/standard-library/StandardLibraryContracts.js` compone el catálogo estándar
existente con los descriptores GUI. No copia las definiciones convencionales ni
crea otro runtime. `getStandardLibraryContract(nombre)` y la ayuda de contrato
permiten consultar las 64 funciones GUI: 25 factories, 32 acciones, tres funciones
generales y cuatro funciones de tema.

La proyección **ejecutable** `CLRS_STANDARD_LIBRARY` conserva sus nombres actuales.
Las entradas GUI llevan `availability: "semantic-and-codegen"`: la semántica ya
resuelve sus símbolos y la generación reconoce su capacidad, pero todavía no
existe el runtime completo de producción. Sin contexto GUI preparado se informa
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
desplazamiento del video y contención se declaran como restricciones y se deberán
validar contra estado real en el runtime (bloques 5–7).

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
`Gio.Cancellable`, cancelado después de iniciarla. Los bloques de runtime deberán
conservar esta integración y volver a comprobarla en las plataformas pendientes.
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
puertos de ensayo mínimos: **no son la implementación pública de las 64 funciones**.
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
Esto no significa que las 64 funciones estén ya operativas.

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

## Bloque 6 — Controles, modelos y multimedia

La misma factory productiva incorpora `GuiControlsAdapter`, `GuiModelsAdapter`
y `GuiMediaAdapter`. Se serializan desde sus implementaciones originales; no
importan GTK en el Extension Host y no duplican el catálogo ni el pipeline.
Se añaden las 18 factories no dialogales restantes: etiquetas, entradas normales
y de contraseña, área de texto, cuatro tipos de botón, entrada numérica,
deslizador, progreso, carga, desplegable, calendario, imagen, video, lista visual
y vista de columnas. VIDEO depende además del backend multimedia instalado.

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

### Video y límite nativo descubierto

`GuiMediaAdapter` proyecta Gtk.Video y su MediaStream privado. Las rutas son
archivos locales mediante Gio.File; no se descargan recursos ni códecs. Las
preferencias de volumen/silencio se conservan antes de preparar el reproductor
y se aplican cuando el backend está listo. Cambiar archivo pausa el anterior,
retira sus conexiones y conserva preferencias. Tiempos públicos en segundos;
microsegundos int64/BigInt sólo en la frontera nativa. PARAR pausa y vuelve a
cero; rechaza flujos no desplazables que ya avanzaron sin aparentar un reinicio.
Los errores de carga no incluyen rutas ni datos privados.

El probe canónico inicializa GTK con `Gtk.initCheck()` antes de crear MediaFile:
sin esa inicialización el ensayo emitía una advertencia engañosa sobre el punto
de extensión `gtk-media-file`. El probe no presenta ventanas; una sesión gráfica
no disponible produce `CLRS_GUI_RUNTIME_NOT_READY`. Sólo se ejecuta la parte
multimedia para la capacidad semántica `gui.video`, nunca por buscar texto.

El ensayo de Windows con node-gtk 4.1.1 y GTK 4.22.4 reconoce ahora
`GtkGstMediaFileBuiltin`. Con el entorno heredado no encuentra los elementos
`playbin3`/`playbin` y devuelve `CLRS_GUI_MEDIA_BACKEND_UNAVAILABLE`. Al facilitar
al proceso aislado el PATH y los plugins de GStreamer Runtime MSVC 1.28.6,
aparecen errores nativos GLib/GstPadTemplate y el probe termina anormalmente;
el padre lo convierte en `CLRS_GUI_MEDIA_LOAD_FAILED`, sin atribuir una causa
no demostrada al usuario. GTK importa DLL con prefijo `lib`, mientras que esos
plugins importan DLL sin ese prefijo: la evidencia apunta a incompatibilidad
entre distribuciones nativas, no a que falte Development/SDK. La reproducción
real sigue sin estar validada; instalar GStreamer no certifica compatibilidad.

La inspección opcional de elementos GStreamer sólo se realiza si GTK selecciona
ese backend y hay introspección disponible. La comprobación principal prepara
una muestra con Gtk.MediaFile en un hijo aislado; el padre retira el temporal
incluso si el hijo falla. No se modifica GTK_MEDIA, no se sustituye GTK por otro
visor y no se instalan paquetes nativos. Los demás controles no requieren
soporte multimedia. La creación fallida de VIDEO limpia conexiones, referencias
y recursos sin registrar el ID; las pruebas verifican que se pueda reutilizar.

### Orientación multimedia y diagnóstico compartido

`GuiEnvironmentProbe.guiEnvironmentMessage` centraliza la recomendación para
ejecución temporal y JavaScript autónomo. En Windows recomienda **GStreamer
Runtime MSVC de 64 bits (x86_64)**, opción **Only runtime**; no Development/SDK,
Debug symbols ni Debugger. Development/SDK se destina a desarrollar o compilar
contra GStreamer, no a ejecutar VIDEO. Si ya está instalado, se aconseja revisar
`bin` en PATH antes de reinstalar y cerrar completamente/reabrir VS Code o la
terminal después de cambiar el entorno. Es una recomendación condicional, no
una detección independiente de «no instalado» frente a «no localizable».

Linux/macOS reciben orientación propia, nunca instrucciones MSVC x86_64.
Los errores de archivo ausente y formato no compatible conservan sus códigos
específicos cuando GTK aporta información suficiente, sin recomendar instalar
paquetes como solución genérica. CLRS administra únicamente npm privado;
no ejecuta gestores nativos ni modifica variables globales.

Esta política está documentada también en `docs/gui/architecture.md` §20,
`docs/gui/runtime-pipeline.md` §16.4, `docs/gui/javascript-export.md` §25 y `docs/gui/api-catalog.md`
en el apartado VIDEO y la tabla de errores. La aclaración Runtime/Development
se añadió en esta revisión; la recomendación anterior era genérica.

Referencias: [backends de GTK](https://docs.gtk.org/gtk4/running.html),
[consulta de elementos GStreamer](https://gstreamer.freedesktop.org/documentation/gstreamer/gstelementfactory.html)
y [contrato de MediaStream](https://docs.gtk.org/gtk4/class.MediaStream.html).

### Pruebas y límites del bloque 6

`test/gui.controls.test.js` cubre adaptadores con dobles: copias/selección,
factories de celdas, grupos, rangos, buffer, backend ausente, preferencias,
reproducción/pausa/desplazamiento/reinicio y limpieza. El ensayo de bundling
ejecuta también un desplegable con la factory serializada. Un fallo al inicializar
los adaptadores libera la aplicación y su loop.

`npm run test:gui:controls -- <directorio-aislado-con-node-gtk-4.1.1>` no instala
paquetes. Prueba los controles nativos, sus propiedades, los textos realmente
renderizados de las celdas y un programa CLRS generado. Si hay soporte multimedia,
genera un AVI silencioso temporal y exige preparación/reproducción/pausa/seek/stop;
si falta el backend, comprueba el diagnóstico y registra la limitación explícita,
sin contar esa reproducción como aprobada. Los temporales se retiran al terminar.

Evidencia: `controls-validation.win32-x64.node24.json`: 17 controles nativos
aprobados en Windows x64, Node 24.16.0, GTK 4.22.4. **Reproducción nativa de VIDEO
pendiente en un entorno multimedia completo**; sus pruebas con dobles no la
sustituyen. Continúan pendientes Linux/macOS, Node 22/26 y GTK exactamente 4.10.
La regresión nativa del bloque 5 también vuelve a pasar. No se implementan aquí
los eventos públicos ni diálogos del bloque 7; no hay nuevo webview, cambios de
versión, documentación pública, inicio guiado ni VSIX.

La revisión de diagnósticos vuelve a aprobar los 17 controles tanto con el entorno
heredado como con PATH/plugins MSVC suministrados sólo al proceso de prueba.
`videoPlayback: "not-validated"` evita confundir el diagnóstico controlado con
reproducción aprobada. La evidencia de ambos entornos está en
`media-diagnostics-validation.win32-x64.node24.json`. `test/gui.environment.test.js`
cubre inicialización de GTK, mensajes separados por plataforma, PATH condicional,
ausencia de requisitos Development/SDK y el mismo mensaje desde JS exportado.
La compilación y las 1016 pruebas del corpus unitario pasaron. No se certifican
reproducción nativa, Linux/macOS, otros Node ni GTK exactamente 4.10 con estos
resultados; los dobles automatizados no sustituyen esas validaciones.

## Fronteras para los siguientes bloques

- Los tres eventos con retorno semántico inmediato (`cerrar`, `activar_enlace`,
  `tecla_presionada`) no pueden despachar una Promise como respuesta a GTK. El
  puente compartido conserva esa semántica; `cerrar` ya está conectado, los otros
  dos corresponden al runtime completo.
- Diálogos: se declara espera asincrónica y cancelación normal; seleccionar un
  archivo no lo lee ni escribe. No heredan propiedades/eventos/acciones Widget.
- Tema: alcance de sesión, sin imponer configuración inicial, sin CSS público y
  con restauración de la preferencia inicial para `sistema`, conservando el nombre
  de tema explícito. Un fallback GTK no demuestra por sí solo que el tema exista.
- `NODE_GTK_RUNTIME_DEPENDENCY` fija la dependencia y los mínimos. Importar el
  catálogo no instala paquetes, no carga el binding y no inicia aplicaciones.
- `cost: null` y `costStatus: "pending-complexity-block"` evitan prometer O(1) para
  funciones cuyo modelo de costo debe implementarse en el bloque 10. Los efectos
  simbólicos permanecen opacos.

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
