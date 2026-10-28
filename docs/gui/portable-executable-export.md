# Exportación a ejecutable portable — arquitectura y cierre técnico

## 1. Estado y alcance

Este documento nació como resultado del **Bloque 1: Auditoría y contrato
arquitectónico** para la evolución de **Generar código JavaScript**. Las
secciones 11–20 registran la implementación completa: identidad y raíz `app`,
adaptación packable, helpers, manifest, lock, transacción, corpus, instalación,
build nativo y cierre documental. La ejecución temporal y el runtime privado de
CLRS permanecen fuera de este recorrido.

La especificación de implementación proporcionada para esta evolución es la
autoridad normativa. El informe técnico del experimento con `node-gtk` y
`@yao-pkg/pkg` es evidencia contextual: explica por qué funcionó la solución de
referencia, pero no sustituye los contratos del repositorio ni autoriza copiar
nombres, rutas o supuestos propios de aquel proyecto.

La prioridad de fuentes para las siguientes etapas es:

1. especificación de exportación a ejecutable portable;
2. implementación y pruebas actuales de CLRS Kit Español;
3. contratos normativos de la biblioteca GUI;
4. informe técnico de la experimentación;
5. artefactos de referencia verificables, cuando estén disponibles.

En la auditoría sólo estuvieron disponibles la especificación y el informe. No
se recibieron como artefactos inspeccionables el `prepare-packable.cjs`, el
`bootstrap.cjs`, el JavaScript normal, su variante `*.packable.js` ni el
`package-lock.json` del experimento. El `package.json` suelto localizado en la
carpeta de descargas pertenece a una versión anterior de la extensión y no se
considera referencia del proyecto portable. Por ello, cualquier detalle que no
esté en los dos documentos disponibles deberá validarse experimentalmente y no
se dará por supuesto.

## 2. Recorridos actuales

### 2.1. Ejecución temporal administrada

```text
Ejecutar / depurar / probar
        ↓
CompilationService.runSource
        ↓
parseSource + SemanticAnalyzer
        ↓
GuiRuntimePreparation, sólo si el modelo semántico requiere GUI
        ↓
CompilationArtifact temporal
        ↓
FileSystemEmitter
        ↓
NodeProgramRunner con el Node y runtime privados validados
        ↓
limpieza del artefacto temporal
```

Propiedades observadas:

- el nombre temporal conserva `ProgramKey`;
- un temporal GUI usa extensión `.mjs`;
- la preparación privada sólo ocurre al ejecutar y nunca al exportar;
- la URL resuelta de `node-gtk` y el ejecutable de Node pertenecen al contexto
  temporal;
- el runner elimina el archivo temporal al finalizar o cancelar.

Este recorrido queda fuera del alcance funcional del empaquetado.

### 2.2. Exportación permanente auditada antes del Bloque 2

```text
Generar código JavaScript
        ↓
GenerateJavaScriptUseCase
        ↓  { temporary: false, exportProject: true }
CompilationService.compileSource / compileAST
        ↓
SemanticAnalyzer
        ↓
semanticModel.gui.usage.requiresGui
        ├── false → CompilationArtifact → FileSystemEmitter
        │           → dist/<programa>/<programa>.js
        └── true  → runtime público "node-gtk"
                    → JavaScriptProjectExporter
                    → staging + lock npm + validación + publicación atómica
                    → dist/<programa>/
                       ├── <programa>.js
                       ├── package.json
                       └── package-lock.json
```

La detección GUI actual ya es estructurada: se deriva del modelo semántico y no
de búsquedas de texto. El artefacto conserva además `requiredCapabilities`, que
incluye `gui` cuando corresponde.

En la línea base del Bloque 1, la raíz `dist` estaba representada en dos lugares
con responsabilidades distintas:

- `CompilationArtifact` calcula el destino de la exportación no GUI;
- `JavaScriptProjectExporter` vuelve a calcular la raíz y administra el destino
  transaccional de la exportación GUI.

El Bloque 2 eliminó esa duplicación mediante una identidad canónica compartida y
migró ambos recorridos a `app/`.

## 3. Mapa de responsabilidades existente

| Responsabilidad | Autoridad actual | Observación para la evolución |
|---|---|---|
| Entrada del comando | `src/application/useCases/GenerateJavaScriptUseCase.js` | Ya distingue exportación permanente mediante opciones; no debe conocer `pkg`. |
| Decisión GUI/no GUI | `src/compiler/services/CompilationService.js` | Debe conservar `semanticModel.gui.usage.requiresGui` como autoridad. |
| Identidad pública normalizada | `src/compiler/export/JavaScriptProjectDescriptor.js` | `createJavaScriptProjectIdentity` resuelve nombre, raíz `app`, directorio, entrada y ruta final para ambos recorridos. |
| Ruta no GUI | `src/compiler/CompilationArtifact.js` | Consume la identidad canónica sólo con `exportProject`; temporales y modo legado permanecen separados. |
| Ensamblado GUI | `src/compiler/gui/GuiJavaScriptAssembly.js` | Contiene el único bloque de resolución, probe, configuración y carga de `node-gtk`. |
| Runtime GUI canónico | `src/standard-library/gui/runtime/GuiRuntimeSource.js` | Es compartido entre ejecución y exportación; no debe bifurcarse por distribución. |
| Versiones GUI | `src/standard-library/gui/GuiContract.js` | `NODE_GTK_RUNTIME_DEPENDENCY` fija `node-gtk@4.1.1`, Node 22/24/26 y GTK 4.10. |
| Manifest y validación de lock | `src/compiler/export/JavaScriptProjectDescriptor.js` | Debe ampliarse con la autoridad de `@yao-pkg/pkg`, scripts, `bin` y assets. |
| Lockfile | `src/compiler/export/NpmPackageLockAdapter.js` | Ya escribe sólo metadatos con `npm install --package-lock-only --ignore-scripts`; no instala ni ejecuta addons. |
| Transacción GUI | `src/compiler/export/JavaScriptProjectExporter.js` | Ya ofrece staging, exclusión, validación, respaldo y publicación atómica; debe conservarse. |
| Escritura no GUI | `src/compiler/adapters/FileSystemEmitter.js` | Debe seguir produciendo sólo un archivo y no adoptar infraestructura npm. |

No se colocarán `spawn npm`, plantillas CJS ni reglas de distribución en el AST,
visitantes o runtime GUI público.

## 4. Bloque canónico de carga de `node-gtk`

El bloque relevante está en `assembleGuiJavaScript`, dentro de
`src/compiler/gui/GuiJavaScriptAssembly.js`. Actualmente realiza, en este orden:

```text
getGuiEnvironmentSource()
        ↓
import.meta.resolve("node-gtk")
        ↓
checkGuiEnvironmentIsolated(...)
        ↓
configureGuiPrivateEnvironment(...)
        ↓
await import(url)
        ↓
creación de la sesión GUI con el factory canónico
```

La incompatibilidad documentada con `pkg` se concentra en los primeros cinco
pasos:

- `import.meta.resolve` opera contra un snapshot y puede no resolver el paquete;
- el probe aislado usa `process.execPath`, que dentro del ejecutable es la
  aplicación empaquetada y no un Node genérico;
- el addon y el runtime GTK necesitan rutas físicas del sistema operativo.

El resto de `GuiJavaScriptAssembly` y `GuiRuntimeSource` contiene semántica de
CLRS, trazas, callbacks, depuración, ciclo de vida y API GUI. No debe duplicarse
ni reemplazarse para resolver una diferencia de carga nativa.

## 5. Decisión de costura para la variante empaquetable

Se adopta una **región de carga explícita, versionada y generada por una única
fábrica**, en lugar de buscar offsets o fragmentos accidentales del JavaScript.

El Bloque 3 materializa este diseño en el generador y en un transformador puro:

1. extraer la construcción del bloque de carga de binding a una autoridad del
   compilador GUI;
2. emitir en el JavaScript normal una región delimitada por sentinelas estables,
   sin incluir `__CLRS_PACKAGED_NODE_GTK_LOADER__`;
3. incorporar el mismo protocolo y núcleo en la fábrica de
   `prepare-packable.cjs` sin mantener otra transformación;
4. exigir exactamente una región completa al preparar;
5. sustituir esa región en la copia `*.packable.js` por el uso obligatorio de
   `globalThis.__CLRS_PACKAGED_NODE_GTK_LOADER__`;
6. delimitar también el encabezado ESM generado y convertir únicamente sus
   imports canónicos a `require` en la variante de build;
7. rechazar la variante si se intenta ejecutar sin el loader del bootstrap;
8. comprobar que no queden dos declaraciones del binding ni más de una marca de
   loader empaquetado;
9. escribir el resultado de manera determinista desde el `.js` normal en cada
   ejecución, sin transformaciones acumulativas.

Los sentinelas serán parte de un protocolo interno versionado entre el generador
y el preparador, no una heurística basada en el formato incidental. El cuerpo
normal y la transformación derivada deberán proceder de la misma autoridad para
que un cambio futuro del loader no deje al helper buscando texto obsoleto.

Se descarta generar permanentemente la rama empaquetada en el JavaScript normal:
el contrato exige que el marcador global exista sólo en `*.packable.js`. También
se descarta producir `*.packable.js` durante la exportación: ese archivo pertenece
al build posterior y no al estado inicial de `app/<programa>/`.

## 6. Contratos formales

### 6.1. Frontera temporal

- **PORT-TEMP-01** — ejecutar, depurar, probar, trazar y DAP no escriben bajo
  `app/` ni invocan preparación para `pkg`.
- **PORT-TEMP-02** — la preparación privada de `node-gtk`, el Node seleccionado,
  sus locks, caché y reparación permanecen sin cambios.
- **PORT-TEMP-03** — los nombres temporales, la extensión `.mjs` GUI y la limpieza
  por el runner permanecen sin cambios.
- **PORT-TEMP-04** — ninguna ruta privada de ejecución se copia al proyecto
  exportado.

### 6.2. Decisión semántica

- **PORT-SEM-01** — GUI se decide exclusivamente a partir de
  `semanticModel.gui.usage.requiresGui` y la capacidad estructurada `gui`.
- **PORT-SEM-02** — no se buscan nombres de funciones GUI en texto CLRS ni en el
  JavaScript generado.
- **PORT-SEM-03** — el compilador produce el artefacto; la infraestructura de
  exportación compone el proyecto distribuible.

### 6.3. Proyecto fuente exportado

- **PORT-APP-01** — toda exportación permanente del comando usa
  `app/<nombre-normalizado>/`.
- **PORT-APP-02** — una exportación no GUI contiene únicamente
  `<programa>.js`; no adquiere npm, GTK ni helpers.
- **PORT-APP-03** — una exportación GUI contiene inicialmente exactamente el JS
  normal, `prepare-packable.cjs`, `bootstrap.cjs`, `package.json` y
  `package-lock.json`.
- **PORT-APP-04** — la exportación inicial no contiene `node_modules/`,
  `*.packable.js`, `bin/` ni `dist/`.
- **PORT-APP-05** — `dist/` queda reservado al resultado de un build solicitado
  dentro del proyecto exportado.
- **PORT-APP-06** — todos los nombres se derivan de
  `createJavaScriptOutputDescriptor`; no existen nombres de proyectos de ejemplo
  hardcodeados.

### 6.4. JavaScript normal y variante derivada

- **PORT-JS-01** — `<programa>.js` continúa ejecutándose con Node y `npm start`.
- **PORT-JS-02** — el build nunca modifica `<programa>.js`.
- **PORT-JS-03** — el JS normal no contiene
  `__CLRS_PACKAGED_NODE_GTK_LOADER__`.
- **PORT-JS-04** — `<programa>.packable.js` se regenera desde la fuente normal y
  contiene una única adaptación de loader.
- **PORT-JS-05** — la variante packable exige el loader del bootstrap y nunca
  ejecuta resolución, probe o import ESM contra el snapshot de `pkg`.
- **PORT-JS-06** — cambios en la infraestructura de carga no duplican el runtime
  GUI canónico ni alteran su semántica pública.

### 6.5. Manifest y lockfile

- **PORT-NPM-01** — `node-gtk` permanece fijado exactamente a `4.1.1` y
  `allowScripts` autoriza sólo `node-gtk@4.1.1`.
- **PORT-NPM-02** — la dependencia de build `@yao-pkg/pkg` tiene una versión
  centralizada y se declara como dependencia de desarrollo.
- **PORT-NPM-03** — `npm start` ejecuta el JavaScript normal, nunca el bootstrap
  ni la variante packable.
- **PORT-NPM-04** — `bin` apunta a `./bootstrap.cjs` y los scripts de build
  preparan la variante antes de invocar `pkg --targets host`.
- **PORT-NPM-05** — `pkg.assets` incluye el binding nativo requerido por
  `node-gtk` y la variante packable generada durante el build.
- **PORT-NPM-06** — se escribe el manifest completo antes de generar el lock.
- **PORT-NPM-07** — el lock se genera mediante npm con
  `--package-lock-only --ignore-scripts`; no se construye a mano y la exportación
  no instala `node_modules`.
- **PORT-NPM-08** — la validación del lock cubre las dependencias de ejecución y
  desarrollo declaradas por el manifest.

### 6.6. Bootstrap y distribución nativa

- **PORT-BOOT-01** — el bootstrap deriva identidad, archivos y mensajes del
  descriptor del proyecto.
- **PORT-BOOT-02** — el runtime físico se prepara junto al ejecutable, con rutas
  normalizadas y confinadas al directorio administrado.
- **PORT-BOOT-03** — la redirección de `process.dlopen` se limita al addon
  `node_gtk.node` esperado; no se instala un interceptor nativo general.
- **PORT-BOOT-04** — el loader global se registra antes de iniciar la variante
  packable y no se usa en `npm start`.
- **PORT-BOOT-05** — plataforma, arquitectura, ABI y recursos nativos se validan
  antes de iniciar la aplicación.
- **PORT-BOOT-06** — el runtime válido se puede reutilizar; un runtime incompleto
  no se acepta silenciosamente.
- **PORT-BOOT-07** — no se ejecutan gestores de paquetes del sistema operativo.

### 6.7. Plataforma y publicación

- **PORT-PLAT-01** — `npm ci` y `pkg --targets host` operan para la plataforma
  host; no se promete cross-compilation de dependencias nativas.
- **PORT-PLAT-02** — Windows se trata como referencia funcional comprobable; la
  cobertura Linux/macOS debe declarar con precisión sus dependencias GTK reales.
- **PORT-TXN-01** — la publicación GUI conserva staging, exclusión mutua,
  validación completa, respaldo de la versión anterior y rename atómico.
- **PORT-TXN-02** — cualquier fallo anterior a la publicación deja intacta una
  exportación válida previa y elimina el staging nuevo.

## 7. Arquitectura materializada

Las responsabilidades quedaron separadas de esta forma:

```text
CompilationArtifact
        ↓
descriptor de proyecto canónico
        ├── nombre y rutas app/dist
        ├── archivos normal y packable
        ├── manifest npm
        └── identidad de bootstrap
        ↓
JavaScriptProjectExporter
        ├── fábrica de prepare-packable.cjs
        ├── fábrica de bootstrap.cjs
        ├── generador de package-lock
        ├── validador de proyecto
        └── publicación transaccional
```

Autoridades centralizadas:

- `NODE_GTK_RUNTIME_DEPENDENCY`, ya existente;
- descriptor de `@yao-pkg/pkg` y su versión;
- protocolo/versionado de la región de carga GUI;
- patrones de assets y archivos de salida;
- matriz de plataforma soportada para los scripts de build.

El helper y el bootstrap serán resultados de fábricas parametrizadas, no copias
manuales mantenidas por nombre de programa.

## 8. Riesgos y controles obligatorios

| Riesgo | Control contractual |
|---|---|
| Cambiar `dist` sólo en un recorrido | Pruebas separadas GUI/no GUI y una autoridad de raíz compartida. |
| Detectar GUI por texto | Usar modelo semántico y capacidades del artefacto. |
| Deriva entre loader y preparador | Región versionada emitida y consumida desde autoridades canónicas. |
| Modificar o acumular transformaciones en el JS normal | Leer siempre el source limpio, escribir sólo `*.packable.js` y comparar el source antes/después. |
| Duplicar runtime GUI | Adaptar únicamente la carga del binding; reutilizar factory y ensamblado existentes. |
| ABI/plataforma equivocados | Calcular y validar `process.versions.modules`, `process.platform` y `process.arch`. |
| Escape de ruta al extraer | Normalizar, resolver y exigir confinamiento bajo el runtime físico administrado. |
| Interceptar otros addons | Redirección estrecha por basename/ruta esperada de `node_gtk.node`. |
| Filtrar rutas privadas de CLRS | Validación de prefijos introducidos por la infraestructura, sin prohibir rutas escritas por el usuario. |
| Ejecutar scripts durante exportación | Conservar `--package-lock-only --ignore-scripts`. |
| Manifest y lock divergentes | Validación estructural de raíz, versiones, integridad y dependencias de desarrollo. |
| Prometer portabilidad no comprobada | Separar pruebas deterministas de smoke tests nativos y documentar plataforma/ABI. |
| Publicación parcial | Conservar staging y publicación atómica actuales. |

## 9. Línea base verificada

La auditoría se cerró el 15 de septiembre de 2026 sobre la versión `2.0.1`, sin
modificar código productivo. Se ejecutaron:

```text
npm run test:gui:export
→ 17 aprobadas, 0 fallidas

node --test test/compilation.service.test.js test/gui.dependencies.test.js
→ 41 aprobadas, 0 fallidas

node --test test/application.controllers.test.js
→ 12 aprobadas, 0 fallidas
```

Total de la línea base focalizada:

```text
70 aprobadas
0 fallidas
```

Esta línea base cubre la exportación actual, la separación entre
aprovisionamiento temporal y exportación, los contratos del servicio de
compilación y el comando. No certifica todavía un build real con
`@yao-pkg/pkg`, la extracción nativa ni un ejecutable portable.

## 10. Criterio de salida del Bloque 1

El bloque se considera completo porque:

- se localizaron los dos recorridos y sus fronteras;
- se identificó la duplicación actual de la raíz de exportación;
- se localizó el bloque canónico de carga de `node-gtk`;
- se decidió una costura estable y versionada para la variante packable;
- se formalizaron invariantes de compilación, npm, bootstrap, plataforma y
  transacción;
- se documentaron riesgos y evidencia ausente;
- se registró una línea base reproducible y verde.

La siguiente etapa puede modelar descriptores, contratos de dependencias y
fábricas puras sin alterar todavía el runtime temporal.

## 11. Implementación del Bloque 2

La raíz de proyecto fuente ya está centralizada en
`JAVASCRIPT_EXPORT_ROOT_DIRECTORY = "app"`. La función
`createJavaScriptProjectIdentity` devuelve una identidad inmutable con:

```text
name
directoryName
entryFile
sourceDirectory
exportRoot
projectDirectory
entryPath
```

`CompilationArtifact` consume esa identidad para la rama permanente no GUI y
`JavaScriptProjectExporter` consume exactamente la misma identidad para la rama
GUI. El exportador ya no reconstruye por separado la raíz ni el destino.

El resultado acumulado de este bloque es:

```text
sin GUI → app/<programa>/<programa>.js
con GUI → app/<programa>/<programa>.js + package.json + package-lock.json
```

La ampliación del proyecto GUI con helpers de construcción pertenece a bloques
posteriores. La ejecución temporal continúa usando su nombre privado y el modo
de compilación permanente que no corresponde a **Generar código JavaScript**
continúa bajo `.clrs/js` por compatibilidad.

## 12. Implementación del Bloque 3

`src/compiler/gui/GuiBindingLoadSource.js` es ahora la autoridad de la carga del
binding. Expone el protocolo inmutable `GUI_BINDING_LOAD_PROTOCOL`, cuya versión
inicial es `1`, y genera la región normal consumida por
`GuiJavaScriptAssembly`:

```text
declaración única del binding
marcador v1 de inicio
    import.meta.resolve
    diagnóstico de resolución
    probe aislado
    configuración privada
    import del binding
marcador v1 de fin
```

El JavaScript normal no menciona
`__CLRS_PACKAGED_NODE_GTK_LOADER__` y conserva exactamente el recorrido Node. La
función pura `createPackableGuiJavaScript` exige una sola región, una sola
declaración del binding y un encabezado de módulos delimitado. En la copia
derivada sustituye la carga por:

```text
si globalThis.__CLRS_PACKAGED_NODE_GTK_LOADER__ no es función
    terminar con CLRS_GUI_PACKAGED_LOADER_MISSING
obtener el binding desde el bootstrap
```

El encabezado ESM canónico del generador se convierte a declaraciones
`require` sólo en `*.packable.js`. Esto permite que el bootstrap lo evalúe en
el contexto CommonJS creado por `pkg`; `<programa>.js` conserva intactos sus
imports ESM y su recorrido Node normal.

La adaptación rechaza fuente no textual, región ausente o duplicada, declaración
duplicada, resultado inconsistente y una fuente que ya haya sido adaptada. Los
marcadores se reconocen como líneas exactas, por lo que un literal escrito por
el usuario no se interpreta como infraestructura.

`test/gui.packable.runtime.test.js` comprueba con procesos Node reales:

- ejecución intacta del JavaScript normal;
- uso del loader empaquetado sin intentar resolver `node-gtk`;
- rechazo explícito fuera del bootstrap;
- determinismo y preservación del source original;
- aislamiento frente a literales del usuario;
- rechazo de todas las formas estructurales inválidas.

Este bloque todavía no escribe `*.packable.js` ni exporta
`prepare-packable.cjs`: sólo proporciona la adaptación canónica que esos
artefactos utilizarán en los bloques siguientes.

## 13. Implementación del Bloque 4

`src/compiler/export/PackablePreparationScriptBuilder.js` genera de forma
determinista un `prepare-packable.cjs` autocontenido. No copia una plantilla de
un proyecto de ejemplo: recibe la identidad canónica y embebe únicamente:

```text
<programa>.js
<programa>.packable.js
protocolo GUI v1
núcleo canónico de transformación
plataformas admitidas
```

Para evitar dos implementaciones, el Bloque 3 expone ahora
`transformPackableGuiJavaScript` como un núcleo puro y autocontenido. La fábrica
serializa esa misma función dentro del helper CJS; las llamadas internas del
compilador continúan usando `createPackableGuiJavaScript`, que conserva la clase
de error propia del repositorio.

Al ejecutarse, el helper:

1. acepta exclusivamente `win32`, `linux` o `darwin`;
2. resuelve source y destino desde su propio `__dirname`;
3. exige nombres locales y archivos regulares, sin enlaces simbólicos;
4. lee siempre `<programa>.js` como fuente limpia;
5. produce la adaptación mediante el protocolo versionado;
6. vuelve a leer el source y cancela si cambió durante la transformación;
7. sobrescribe determinísticamente `<programa>.packable.js`;
8. verifica el contenido escrito;
9. termina con código no exitoso y diagnóstico estable ante cualquier fallo.

La identidad canónica incorpora `packableFile`, `packablePath`,
`preparePackableFile` y `preparePackablePath`; el nombre packable debe derivarse
exactamente del entry normal.

`test/prepare.packable.generator.test.js` valida sintaxis CJS, nombres dinámicos,
ausencia de hardcodes, plataformas, ejecución desde otro directorio, source
intacto, regeneración idempotente, rechazo de fuentes inválidas y ausencia de
`dist/` o archivos parciales.

Desde el Bloque 7, el archivo producido por esta fábrica forma parte del staging
portable y se publica únicamente después de validar la unidad completa.

## 14. Implementación del Bloque 5

`src/compiler/export/BootstrapScriptBuilder.js` genera un `bootstrap.cjs`
autocontenido y parametrizado por la identidad canónica. El descriptor embebido
contiene exclusivamente el identificador portable, el archivo packable, el
marcador de runtime y la versión canónica de `node-gtk`; no incorpora rutas del
workspace ni nombres de proyectos de referencia.

El bootstrap generado:

1. valida `process.platform`, `process.arch` y el ABI de módulos de Node;
2. deriva `node-v<ABI>-<plataforma>-<arquitectura>`;
3. localiza `node-gtk/package.json` y exige la versión canónica `4.1.1`;
4. valida el addon y `girepository-1.0` dentro del asset empaquetado;
5. copia el árbol sin seguir enlaces simbólicos a
   `<directorio-ejecutable>/bin/<binding>` mediante un staging local;
6. reutiliza el runtime sólo si coinciden el marcador dinámico, el addon, los
   typelibs y la identidad completa del binding;
7. elimina entradas del snapshot de las variables de entorno y configura las
   rutas físicas disponibles para GTK, typelibs, datos, schemas y GdkPixbuf;
8. intercepta `process.dlopen` únicamente cuando se solicita
   `node_gtk.node` desde el snapshot de `pkg`;
9. registra `globalThis.__CLRS_PACKAGED_NODE_GTK_LOADER__`, conserva el
   `require("node-gtk")` literal y reutiliza el binding cargado;
10. comprueba que existe `<programa>.packable.js`, lo lee desde el snapshot y
    lo ejecuta mediante una función asíncrona a la que entrega el `require` del
    bootstrap.

La identidad canónica incorpora ahora `programName`, `portableName`,
`packageName`, `displayName`, `bootstrapFile`, `bootstrapPath` y
`runtimeMarker`. El marcador tiene la forma `.<programa>-runtime` y su contenido
incluye proyecto, dependencia, versión y binding, por lo que su mera existencia
no basta para aceptar un runtime incompleto.

`test/bootstrap.generator.test.js` ejecuta el CJS producido contra un paquete
`node-gtk` doble en directorios temporales. Comprueba nombres dinámicos, sintaxis,
extracción, reparación y reutilización, confinamiento, limpieza de variables,
redirección exclusiva del addon, caché del loader y que éste exista antes de
evaluar la variante packable. La evaluación no usa `import()` desde el CJS de
`pkg`, porque ese contexto `vm` no proporciona un callback de import dinámico.

La prueba es estructural y no certifica todavía un ejecutable creado por
`@yao-pkg/pkg` ni una carga GTK nativa. Windows sigue siendo la plataforma de
referencia del experimento. En Linux y macOS, un paquete que no incluya el addon
y los typelibs autocontenidos se rechaza expresamente; CLRS no ejecuta gestores
de paquetes del sistema para completarlo.

Desde el Bloque 7, `bootstrap.cjs` se escribe y valida dentro del mismo staging
que el JavaScript normal, el preparador, el manifest y el lockfile.

## 15. Implementación del Bloque 6

`src/compiler/export/PortablePackagingContract.js` es la autoridad única del
empaquetado portable. Fija:

```text
@yao-pkg/pkg = ^6.22.0
targets = host
plataformas = win32, linux, darwin
salida = dist/<programa>/<programa>[.exe]
assets = node_modules/node-gtk/lib/binding/**/* + <programa>.packable.js
```

`createPortableJavaScriptProjectDescriptor` construye un manifest nuevo sin
alterar todavía el descriptor consumido por el exportador activo. El manifest
portable contiene:

- `bin: "./bootstrap.cjs"`;
- `npm start` sobre el JavaScript normal;
- `build:win` y `build:unix`, ambos con `prepare-packable.cjs` antes de
  `pkg . --targets host`;
- `node-gtk` fijado a `4.1.1` y sólo su autorización exacta en `allowScripts`;
- `@yao-pkg/pkg` como dependencia de desarrollo;
- el asset completo del binding nativo y la variante packable que se genera
  inmediatamente antes de invocar `pkg`.

Los comandos se interpolan exclusivamente con `portableName`, que ya pasó por
la normalización de identidad. No se incorporó un alias `build`: los dos scripts
expresan de manera inequívoca la extensión de salida, pero ambos construyen sólo
para la plataforma host. No existe promesa de cross-compilation nativa.

`validPortableJavaScriptProjectManifest` compara el manifest completo contra el
contrato canónico. `validJavaScriptProjectLock` acepta tanto el manifest actual
como el portable; cuando existen dependencias de desarrollo exige que la raíz
del lock coincida exactamente, que `@yao-pkg/pkg` resuelva una versión compatible
6.x desde HTTPS, con integridad y marcada como `dev`, y continúa comprobando
`node-gtk@4.1.1` y todo el grafo de paquetes.

`NpmPackageLockAdapter` conserva:

```text
npm install --package-lock-only --ignore-scripts
```

y añade `--include=dev`. Así, variables de entorno como `NODE_ENV=production`
no pueden omitir la herramienta de build del lock. La operación sigue sin crear
`node_modules`, no ejecuta el install nativo de `node-gtk`, no construye el
packable y no invoca `pkg`.

Pruebas:

- `test/portable.manifest.lock.test.js` cubre nombres difíciles, manifest
  exacto, mutaciones rechazadas, rangos resueltos, URLs/integridad, flags npm y
  ausencia de instalación;
- `scripts/gui/validate-portable-lock.mjs` genera con npm real un lock en un
  directorio temporal, lo valida y elimina todo al terminar.

La comprobación real del bloque se ejecutó en Windows con Node 24.16.0 y npm
12.0.2. Confirmó `node-gtk@4.1.1`, `@yao-pkg/pkg@6.22.0`, lockfile v3, ausencia de
`node_modules`, scripts nativos y artefactos de build. No ejecutó `npm ci`, no
creó un ejecutable y no validó GTK; esas comprobaciones corresponden a la
integración y aceptación nativa posteriores.

El Bloque 7 convirtió este descriptor en el manifest utilizado por el exportador
GUI y publica simultáneamente los helpers a los que apunta.

## 16. Implementación del Bloque 7

`JavaScriptProjectExporter` consume ahora el descriptor portable y genera en el
staging, antes de invocar npm:

```text
<programa>.js
prepare-packable.cjs
bootstrap.cjs
package.json
```

Npm recibe por tanto el manifest definitivo, resuelve `package-lock.json` con
las dependencias de runtime y desarrollo, y no instala módulos ni ejecuta
scripts. Antes de publicar se exige que el staging contenga exactamente:

```text
<programa>.js
prepare-packable.cjs
bootstrap.cjs
package.json
package-lock.json
```

La validación vuelve a leer los cinco archivos y comprueba:

- igualdad exacta del JavaScript con el artefacto de compilación;
- igualdad exacta de ambos helpers con sus fábricas canónicas;
- manifest completo contra la identidad portable;
- lockfile contra dependencias normales y de desarrollo;
- archivos regulares, sin elementos adicionales.

En consecuencia, la exportación inicial no contiene todavía
`<programa>.packable.js`, `node_modules/`, `dist/` ni `bin/`. El primero lo crea
`prepare-packable.cjs`, los módulos aparecen sólo con `npm ci`, y los dos últimos
pertenecen respectivamente al build y a la primera ejecución del binario.

La transacción existente se conserva sin atajos:

1. se validan las rutas administradas y se adquiere el lock por proyecto;
2. se construye la unidad completa en un staging hermano;
3. cualquier fallo de fábrica, escritura, npm o validación elimina el staging;
4. una exportación previa no se mueve hasta que la nueva está validada;
5. la publicación usa rename y, si falla, restaura el respaldo anterior;
6. los cambios del usuario en la copia anterior permanecen en el backup.

Las fábricas de ambos helpers son dependencias inyectables del exportador. Las
pruebas fuerzan un fallo de bootstrap y demuestran que no queda publicación
parcial, staging ni lock, y que el proyecto anterior continúa intacto.

Los programas sin GUI no atraviesan `JavaScriptProjectExporter`: conservan un
único archivo `app/<programa>/<programa>.js`, sin npm, helpers, `node-gtk` ni
`@yao-pkg/pkg`.

## 17. Implementación del Bloque 8

`test/fixtures/gui/portable-export-corpus.v1.json` fija el corpus determinista
de la exportación portable. La versión 1 declara siete fronteras obligatorias:
identidad, consola, transacción GUI, arranque normal, preparación packable,
atomicidad ante fallos y separación de los ensayos nativos. Sus fuentes CLRS se
mantienen como fixtures independientes para que el corpus recorra el frontend,
la semántica, el generador y la escritura real de artefactos.

`test/portable.export.corpus.test.js` comprueba sin red ni GTK nativo:

- normalización de espacios, mayúsculas, acentos, nombres reservados,
  caracteres no admitidos y nombres sin caracteres ASCII utilizables;
- frontera no GUI: un único `app/<programa>/<programa>.js`, sin manifest,
  lock, helpers ni dependencias portables, y temporales todavía privados;
- frontera GUI: exactamente los cinco archivos iniciales y ausencia de
  `node_modules/`, `<programa>.packable.js`, `dist/` y `bin/`;
- manifest, autorización exacta, dependencia de build, asset, target host y
  lock determinista de runtime/desarrollo;
- sintaxis Node válida para entry, preparador y bootstrap;
- dos o más identidades exportadas sin nombres hardcodeados ni contaminación
  cruzada en scripts, manifest o helpers;
- `npm start` ligado exclusivamente al JavaScript normal, cuya ejecución con
  un doble acotado de `node-gtk` no crea packable, `dist/` ni `bin/`;
- ejecución doble de `prepare-packable.cjs` con resultado idéntico, loader
  empaquetado presente y entry normal byte a byte intacto;
- conservación de la publicación previa y limpieza de staging/lock ante fallo
  de cada fábrica, generación o validación del lock y cancelación.

El comando `npm run test:gui:portable-corpus` ejecuta únicamente este corpus. El
archivo también integra una categoría propia en
`test/fixtures/integral-corpus.v1.json` y se ejecuta desde
`test:corpus:integrity`, por lo que forma parte de `release:check`.

Esta suite no simula que certifica capacidades nativas. `npm ci` con el script
de instalación real, la construcción `pkg` en host, el arranque GTK del
ejecutable, la extracción inicial del runtime y su reutilización permanecen
identificados como smoke tests separados. Así, el cierre determinista sigue
siendo reproducible y sin red, y los resultados nativos se reportan sólo en la
plataforma donde realmente se ejecuten.

## 18. Implementación del Bloque 9

`scripts/gui/validate-export.mjs` es el ensayo opt-in de instalación y ejecución
normal. Crea una exportación GUI real, la traslada a otro directorio temporal,
elimina su origen y utiliza el mismo descubrimiento de npm que el exportador.
El flujo validado es:

```text
exportar los cinco archivos
        ↓
npm ci
        ↓
comprobar node-gtk y @yao-pkg/pkg
        ↓
npm start
        ↓
<programa>.js
```

Antes de instalar exige el manifest portable exacto: `node-gtk@4.1.1`,
`allowScripts` limitado a `node-gtk@4.1.1`, `@yao-pkg/pkg@^6.22.0` y `start`
apuntando directamente al entry normal. Después de `npm ci` comprueba:

- que la salida de npm no clasifique el install de `node-gtk@4.1.1` como
  bloqueado por falta de autorización;
- que el lockfile permanezca byte a byte intacto;
- que los manifests instalados resuelvan `node-gtk@4.1.1` y una versión 6.x de
  `@yao-pkg/pkg`;
- que exista como archivo regular
  `lib/binding/node-v<ABI>-<plataforma>-<arquitectura>/node_gtk.node`;
- que el entry real del CLI `pkg` exista y responda con la misma versión que su
  manifest;
- que `node-gtk` pueda importarse y cargar Gtk 4 en un proceso Node aislado.

`npm start` se ejecuta posteriormente y debe conservar la salida semántica del
programa. El ensayo verifica además que no mencione ni ejecute el preparador o
el bootstrap, que los cinco archivos publicados y el lock sigan intactos y que
no aparezcan `<programa>.packable.js`, `dist/` ni `bin/`. La ejecución directa
del entry desde otro `cwd` y la equivalencia con el binding administrado por
CLRS continúan formando parte del control.

El comando explícito es:

```powershell
npm run test:gui:portable-install:native
```

`test:gui:export:native` se conserva como nombre compatible y apunta al mismo
script; no existe una segunda implementación.

La ejecución registrada el 15 de septiembre de 2026 pasó en Windows x64 con
Node 24.16.0, ABI 137, el npm 11.13.0 localizado por el adaptador productivo,
`node-gtk@4.1.1`, `@yao-pkg/pkg@6.22.0` y GTK 4.22.4. La evidencia está en
`test/fixtures/gui/export.win32-x64.node24.json`. Esta prueba sí valida
instalación y ejecución normal; no construye todavía con `pkg`, no ejecuta un
binario portable y no valida la extracción o reutilización de `bin/`.

## 19. Implementación del Bloque 10

`scripts/gui/validate-portable-build.mjs` es el smoke test opt-in para la
plataforma host. Recorre el exportador productivo con un nombre que requiere
normalización, instala con npm y ejecuta `build:win` o `build:unix` según
`process.platform`. No construye targets remotos ni promete cross-compilation.

El primer ensayo real descubrió que `pkg` ejecuta `bootstrap.cjs` dentro de un
contexto `vm` sin callback para `import()`. El ejecutable se construía, pero
fallaba antes de iniciar la variante ESM. La corrección mantiene separadas las
dos superficies:

- `<programa>.js` continúa siendo ESM y no cambia;
- el protocolo GUI v1 delimita también sus imports generados;
- `prepare-packable.cjs` convierte esos imports canónicos a `require`, elimina
  de la variante la resolución ESM de `node-gtk` y exige el loader global;
- `pkg.assets` incluye el binding y `<programa>.packable.js`;
- el bootstrap lee la variante desde el snapshot y la ejecuta mediante
  `AsyncFunction("require", source)`, usando su propio `require` CommonJS.

El smoke test exige:

1. los cinco archivos iniciales y una identidad dinámica normalizada;
2. `npm ci` real antes del build;
3. `<programa>.packable.js` generado sin modificar el entry normal;
4. `dist/<programa>/<programa>[.exe]` como archivo regular;
5. ejecución de una copia aislada después de eliminar el proyecto, fuentes y
   `node_modules` originales;
6. primer arranque con creación de `bin/node-v<ABI>-<host>-<arch>`, addon,
   typelibs y marcador completo;
7. GTK y el programa CLRS iniciados desde el ejecutable;
8. segundo arranque con mensaje de reutilización, sin staging residual y con
   el mismo SHA-256 del árbol físico del runtime.

El comando es:

```powershell
npm run test:gui:portable-build:native
```

La evidencia local
`test/fixtures/gui/portable-build.win32-x64.node24.json` registra un build
correcto el 15 de septiembre de 2026 en Windows x64, Node 24.16.0, ABI 137 y
npm 11.13.0. Produjo `punto-venta-agil.exe` de 183,765,541 bytes, materializó
`node-v137-win32-x64`, abrió y cerró GTK correctamente y reutilizó en el segundo
arranque un runtime con digest
`f161b802127f050385d971c41cac83bb272a615dad426c0c9a8d6019a3dc688c`.

La automatización incorpora además el input manual `portable_build_native` y
una matriz opt-in independiente para Windows, Ubuntu y macOS con Node 24. Linux
usa `xvfb-run`; cada host publica su propia evidencia aunque falle. La matriz no
forma parte de `release:check`, porque red, base de `pkg`, addon y entorno
gráfico nativo no son deterministas ni universales. En esta implementación sólo
Windows x64 quedó comprobado localmente; Linux y macOS permanecen pendientes de
una ejecución real del workflow.

## 20. Bloque 11 — documentación y cierre técnico

El contrato operativo se consolidó en
[`javascript-export.md`](javascript-export.md). Ese documento es la referencia
para el usuario y mantiene separados los cuatro estados del proyecto:

```text
exportación inicial
→ cinco archivos fuente, sin node_modules, packable, bin ni dist

npm ci
→ dependencias reproducidas desde el lock y binding nativo autorizado

npm start
→ entry ESM normal, sin efectos de build

build:win / build:unix
→ packable derivado + dist/<programa>/<programa>[.exe]

primera ejecución del portable
→ runtime físico validado bajo bin/
```

La documentación de compilación, aceptación, pruebas y release enlaza este
contrato y usa `app` exclusivamente para la fuente exportada. `dist` queda
reservado al resultado del build dentro del proyecto. La documentación
arquitectónica ya no presenta el proyecto GUI como una unidad de tres archivos.

### Matriz de soporte declarada

| Host del build | Script | Salida | Estado de evidencia |
|---|---|---|---|
| Windows | `npm run build:win` | `dist/<programa>/<programa>.exe` | Windows x64 / Node 24 validado localmente. |
| Linux | `npm run build:unix` | `dist/<programa>/<programa>` | Workflow manual declarado; ejecución nativa pendiente. |
| macOS | `npm run build:unix` | `dist/<programa>/<programa>` | Workflow manual declarado; ejecución nativa pendiente. |

Todos los scripts usan `--targets host`. Las bibliotecas GTK/GLib externas que
el sistema requiera no se empaquetan ni se instalan mediante gestores del
sistema. Por tanto, la matriz declara rutas de validación, no equivalencia
binaria ni cross-compilation.

### Evidencias del cierre

- el corpus determinista prueba identidad, límites GUI/no GUI, cinco archivos,
  preservación del source, transacción y fallos sin red;
- el ensayo de instalación prueba `npm ci`, binding, CLI local de `pkg` y
  `npm start` normal;
- el smoke test de build prueba ejecutable aislado, extracción inicial y
  reutilización exacta en Windows x64;
- Linux y macOS sólo se considerarán validados cuando existan artefactos de una
  ejecución real en esos hosts.

### Verificación local del cierre — 2026-09-15

```text
suite focalizada portable y contrato GUI → 83/83
integridad de corpus                     → 27/27
pre-suite unitaria                       → 97/97
suite unitaria principal                 → 1190/1192 en aislamiento
repetición de los dos archivos afectados → 25/25 con acceso aprobado
ESLint --quiet                           → 0 errores
bundle Extension Host                    → 4.00 MB, 544 módulos
bundle CLI                               → 1.22 MB, 308 módulos
build webview                            → correcto, 2399 módulos
```

Las dos únicas pruebas no aprobadas en la invocación principal y la primera
compilación aislada fallaron porque esbuild no pudo atravesar los permisos de
lectura del entorno. Los archivos afectados se repitieron fuera de ese límite
y aprobaron sus 25 casos; la compilación completa con acceso aprobado también
finalizó correctamente. Por tanto, no quedó una regresión funcional. Vite
conserva su aviso informativo por chunks mayores de 500 kB. No se repitieron los
ensayos nativos de red/GTK durante este bloque: se reutilizan las evidencias
reales, separadas y fechadas de los bloques 9 y 10.

Este cierre no cambia la versión de la extensión, no crea un VSIX y no modifica
el flujo temporal de ejecutar, depurar o probar CLRS.

## 21. Publicación 2.0.2

Tras la solicitud explícita de publicación posterior al Bloque 11, el contrato
portable se incorporó a la versión `2.0.2`. Se sincronizaron manifest, lockfile,
README, índice técnico, changelog y documentación de release; el gate publicable
se ejecuta antes de generar `dist/clrs-kit-esp-2.0.2.vsix`.
