# Exportación CLI compilable — auditoría y contrato arquitectónico

Este documento fijó el Bloque 1 de la exportación CLI compilable prevista para
CLRS Kit Español 2.0.3 y registra la implementación incremental posterior. La
auditoría conserva el recorrido previo como evidencia; el Bloque 2 incorporó
la clasificación y frontera explícitas, el Bloque 3 fijó la identidad y el
manifest CLI canónicos y el Bloque 4 publica ya el proyecto mínimo mediante una
transacción compartida con el perfil GUI. El Bloque 5 cierra el contrato del
lock npm v3 y valida el snapshot CLI completo antes de hacerlo visible. El
Bloque 6 diferencia los mensajes del canal `Salida` según el perfil exportado.
El Bloque 7 añade un corpus determinista que prueba la frontera entre CLI, GUI
y ejecución temporal sin red ni builds nativos. El Bloque 8 incorpora el
ensayo opt-in de instalación real y ejecución normal del proyecto trasladado.
El Bloque 9 añade el build host y el smoke test del binario CLI aislado.
El Bloque 10 alinea la documentación técnica y la guía de usuario con los dos
perfiles implementados, sus requisitos y sus salidas reales.

La especificación ejecutable asociada es
[`test/fixtures/cli-export-architecture.v1.json`](../../test/fixtures/cli-export-architecture.v1.json).

## Estado actual auditado

La acción visible comienza en `CodeCommandController.generateJavaScript`, toma
el texto y la ruta del documento activo y delega en
`GenerateJavaScriptUseCase`. El caso de uso llama a `CompilationService` con:

```text
temporary: false
exportProject: true
```

`CompilationService` analiza primero el programa. La autoridad que determina
si existe GUI es `semanticModel.gui.usage.requiresGui`. Esa propiedad proviene
de símbolos resueltos contra el catálogo estándar; `GuiUsageDetector` recorre
el AST y no inspecciona texto fuente ni JavaScript generado.

El recorrido auditado antes del Bloque 2 se dividía después de generar el
artefacto:

```text
Generar código JavaScript
        ↓
GenerateJavaScriptUseCase
        ↓
CompilationService.compileSource / compileAST
        ↓
SemanticAnalyzer
        ↓
semanticModel.gui.usage.requiresGui
        ├── true  → JavaScriptProjectExporter
        │           → proyecto GUI de cinco archivos
        └── false → FileSystemEmitter
                    → un único <programa>.js bajo app/<programa>/
```

La identidad y la raíz `app/` ya eran comunes, pero la publicación
transaccional sólo se utilizaba para GUI. La brecha estaba en la orquestación,
no en el lexer, parser, AST, semántica ni transpilador.

### Mapa de autoridades actuales

| Responsabilidad | Autoridad real |
|---|---|
| Acción de VS Code | `extension/controllers/CodeCommandController.js` |
| Solicitud permanente | `src/application/usecases/GenerateJavaScriptUseCase.js` |
| Análisis y bifurcación vigente | `src/compiler/services/CompilationService.js` |
| Identidad, raíz `app/` y destinos | `src/compiler/CompilationArtifact.js` y `src/compiler/export/JavaScriptProjectDescriptor.js` |
| Exportador CLI | `src/compiler/export/CliJavaScriptProjectExporter.js` |
| Exportador GUI | `src/compiler/export/JavaScriptProjectExporter.js` |
| Transacción compartida | `src/compiler/export/JavaScriptProjectTransaction.js` |
| Identidad, manifests y validación CLI/GUI | `src/compiler/export/JavaScriptProjectDescriptor.js` |
| Contrato compartido de Node y `pkg` | `src/compiler/export/PortablePackagingContract.js` |
| Generación de lock mediante npm | `src/compiler/export/NpmPackageLockAdapter.js` |
| Corpus CLI versionado | `test/fixtures/cli/export-corpus.v1.json` |
| Instalación y ejecución CLI nativas | `scripts/cli/validate-export.mjs` |
| Build y smoke test CLI del host | `scripts/cli/validate-portable-build.mjs` |
| Ejecución temporal | `src/compiler/adapters/NodeProgramRunner.js` |
| Presentación por perfil en `Salida` | `extension/presentation/JavaScriptProjectOutput.js` |
| Adaptador del canal `Salida` | `extension/adapters/VSCodeCodeHost.js` |
| Guía operativa CLI/GUI | `docs/gui/javascript-export.md` |
| Resumen para usuarios | `README.md`, sección **Ejecución y exportación** |

## Contrato arquitectónico objetivo

Toda exportación permanente debe clasificarse explícitamente en uno de dos
perfiles a partir del modelo semántico:

```text
requiresGui === false → cli
requiresGui === true  → gui
```

No se permite clasificar buscando `VENTANA`, `BOTON`, `Gtk`, `node-gtk` ni
otras cadenas en la fuente o en el JavaScript generado. Una cadena del programa
que contenga esos textos no convierte el programa en GUI. Una llamada estándar
GUI resuelta sí lo hace, aunque esté en una función no alcanzable.

### Perfil CLI

La publicación inicial objetivo contiene exactamente:

```text
app/<programa>/
├── <programa>.js
├── package.json
└── package-lock.json
```

El mismo `<programa>.js` es la entrada de Node, `npm start` y `pkg`. No forman
parte de este perfil `node-gtk`, `bootstrap.cjs`, `prepare-packable.cjs`, una
variante `*.packable.js`, assets GTK ni rutas privadas de CLRS.

### Perfil GUI

El perfil GUI conserva sin simplificaciones su publicación inicial:

```text
app/<programa>/
├── <programa>.js
├── prepare-packable.cjs
├── bootstrap.cjs
├── package.json
└── package-lock.json
```

Su build continúa necesitando la variante packable, `node-gtk@4.1.1`, los
assets del binding y el bootstrap que materializa el runtime nativo. Nada de
esta infraestructura debe trasladarse al perfil CLI por uniformidad visual.

### Infraestructura compartida

Los dos perfiles deben reutilizar:

- identidad portable y raíz `app/`;
- staging hermano al destino;
- lock exclusivo por proyecto;
- validación de rutas y rechazo de enlaces inseguros;
- generación de `package-lock.json` mediante npm;
- cancelación y diagnósticos controlados;
- validación completa antes de publicar;
- publicación atómica, restauración y conservación del respaldo anterior.

Compartir estas capacidades no significa compartir manifest, validadores de
lock ni helpers de build. Esas decisiones pertenecen al perfil.

## Fronteras que deben permanecer intactas

El proyecto persistente sólo corresponde a **Generar código JavaScript**. No
debe utilizarse para ejecutar, depurar o probar el programa dentro de VS Code.

```text
Ejecución interna
→ temporary: true
→ nombre protegido por ProgramKey
→ runtime privado cuando corresponda
→ NodeProgramRunner
→ limpieza al finalizar
```

Los bloques siguientes no deben modificar:

- `NodeProgramRunner` ni su contrato de procesos;
- DAP y breakpoints;
- trazas y reproducción;
- cobertura;
- Testing API;
- temporales de ejecución;
- preparación privada de `node-gtk` usada por el editor.

`CompilationArtifact` ya prioriza `temporary` sobre `exportProject`, por lo que
un temporal permanece en su ruta privada incluso si una solicitud mal formada
incluyera ambas banderas. Esta precedencia queda protegida por pruebas.

## Brechas localizadas

1. Las matrices opt-in de instalación y build están declaradas para Windows,
   Linux y macOS; cada ejecución debe conservar su evidencia antes de afirmar
   compatibilidad nativa de una plataforma concreta.

## Implementación del Bloque 2

`JavaScriptExportProfile.js` define los únicos perfiles válidos, `cli` y `gui`,
y clasifica exclusivamente mediante `semanticModel.gui.usage.requiresGui`.
Una ausencia o tipo distinto de booleano se rechaza: no existe un fallback que
busque nombres dentro de la fuente.

`CompilationService` calcula el perfil sólo cuando coinciden:

```text
exportProject === true
temporary !== true
```

El valor se incorpora como `CompilationArtifact.exportProfile`. Los artefactos
temporales no pueden declarar ese campo, incluso si un consumidor entrega por
error `exportProject: true`; siguen utilizando el emisor y runner privados.

Toda exportación permanente se delega ahora al puerto `projectExporter`.
`JavaScriptProjectExportRouter` conserva implementaciones separadas:

```text
exportProfile: cli
→ FileSystemEmitter temporalmente
→ un único JavaScript, hasta implementar el manifest CLI

exportProfile: gui
→ JavaScriptProjectExporter
→ transacción GUI de cinco archivos
```

El router rechaza un perfil desconocido, un temporal, un GUI sin capacidad
`gui` y un CLI contaminado con capacidad o rutas privadas GUI. El exportador
GUI también exige ahora explícitamente `exportProfile: gui`.

Las pruebas demuestran que una cadena como `"VENTANA BOTON node-gtk Gtk"`
continúa en el perfil CLI, mientras las llamadas estándar resueltas `VENTANA`
y `MOSTRAR` producen el perfil GUI. También prueban que ambos perfiles cruzan
el mismo puerto y que ejecutar temporalmente no lo hace.

## Implementación del Bloque 3

`createCliJavaScriptProjectDescriptor` proyecta la identidad generada por
`createJavaScriptProjectIdentity` y expone únicamente nombres y rutas que
existen en un proyecto CLI. La normalización sigue resolviendo espacios,
mayúsculas, acentos, guiones, caracteres no válidos para npm, nombres
reservados de Windows y nombres sin caracteres latinos utilizables.

`createCliJavaScriptProjectManifest` es una fábrica pura y congelada. Para
`Punto Venta.clrs` produce exactamente:

```json
{
  "name": "punto-venta",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "bin": "./punto-venta.js",
  "scripts": {
    "start": "node ./punto-venta.js",
    "build:win": "pkg . --targets host --output ./dist/punto-venta.exe",
    "build:unix": "pkg . --targets host --output ./dist/punto-venta"
  },
  "engines": {
    "node": ">=22 <23 || >=24 <25 || >=26 <27"
  },
  "devDependencies": {
    "@yao-pkg/pkg": "^6.22.0"
  }
}
```

`PortablePackagingContract.js` es la autoridad única para la versión y el CLI
de `@yao-pkg/pkg`, el target `host`, la carpeta `dist` y los majors compatibles
de Node. Los scripts CLI usan directamente el JavaScript fuente y, a diferencia
de los GUI, no anteponen `prepare-packable.cjs` ni anidan la salida del build.

El manifest omite por construcción `dependencies`, `allowScripts` y `pkg`.
También omite `node-gtk`, assets del binding, `bootstrap.cjs` y cualquier
archivo `*.packable.js`. `validCliJavaScriptProjectManifest` reconstruye el
valor canónico y exige igualdad completa, de modo que rechaza tanto cambios en
campos esperados como propiedades residuales añadidas.

Este bloque es deliberadamente puro: todavía no escribe `package.json`, no
invoca npm, no genera `package-lock.json` y no modifica el delegado CLI del
router. Esas operaciones se incorporarán dentro de la publicación
transaccional del siguiente bloque. El manifest GUI conserva íntegros sus
helpers, dependencias y assets especializados.

## Implementación del Bloque 4

`JavaScriptProjectExportRouter` delega ahora `exportProfile: cli` en
`CliJavaScriptProjectExporter`. Esta rama escribe dentro de staging únicamente:

```text
<programa>.js
package.json
package-lock.json
```

El JavaScript y el manifest canónico se escriben antes de invocar
`NpmPackageLockAdapter`. npm sólo resuelve el lock con `--package-lock-only` e
`--ignore-scripts`; no se crea `node_modules`, `dist` ni infraestructura GUI.
Antes de publicar se comprueba la lista exacta de archivos, su tipo, el contenido
original del JavaScript, el manifest reconstruido y la correspondencia básica
del lock CLI con `@yao-pkg/pkg`.

La mecánica que antes estaba embebida en el exportador GUI se extrajo a
`JavaScriptProjectTransaction`. Los dos perfiles reutilizan ahora, sin compartir
sus manifests ni validadores:

- comprobación de rutas administradas y rechazo de enlaces simbólicos;
- cerrojo exclusivo por identidad de proyecto;
- staging hermano bajo `app/`;
- cancelación antes y después de operaciones externas;
- validación completa antes del primer cambio visible;
- sustitución mediante `rename`;
- restauración del destino si falla la publicación;
- conservación de la exportación anterior en un respaldo identificable;
- limpieza del staging y liberación del cerrojo en todos los resultados.

Así, un fallo de npm, un lock inválido o una cancelación conserva byte a byte la
publicación anterior y no deja proyectos parciales. Una reexportación correcta
publica la nueva unidad completa y mantiene los archivos o modificaciones del
usuario en la copia de respaldo. El perfil GUI continúa publicando sus cinco
archivos y conserva su comportamiento anterior sobre la misma transacción.

Los diagnósticos de lock dejaron de mencionar exclusivamente GUI, ya que ahora
son compartidos por ambos perfiles. La ejecución temporal sigue utilizando
`FileSystemEmitter` y `NodeProgramRunner`; no atraviesa el router ni crea
`app/`, manifests o locks.

## Implementación del Bloque 5

`CliJavaScriptProjectValidator.js` concentra la validación específica del
perfil CLI. El lock aceptado debe ser un `package-lock.json` v3 producido por
npm, declarar `requires: true` y coincidir con `name`, `version`, `bin`,
`engines` y `devDependencies` del manifest canónico. No se acepta el mapa
histórico superior `dependencies` ni una dependencia de ejecución en la raíz.

Cada paquete resuelto debe cumplir simultáneamente:

- clave normalizada dentro de `node_modules/`, sin escapes ni enlaces;
- versión semántica concreta;
- origen HTTPS sin usuario, contraseña, consulta ni fragmento;
- integridad SRI `sha256`, `sha384` o `sha512` con la longitud criptográfica
  correspondiente;
- marca `dev: true`, porque `@yao-pkg/pkg` sólo es una herramienta de build;
- mapas de dependencias con nombres npm seguros.

La validación recorre desde `@yao-pkg/pkg` sus dependencias, dependencias
opcionales presentes y pares resueltos aplicando la resolución jerárquica de
`node_modules`. Se rechaza cualquier dependencia obligatoria ausente y también
cualquier paquete huérfano que no sea alcanzable desde la raíz. La inspección
prohíbe además `node-gtk`, `bootstrap.cjs`, `prepare-packable.cjs`, variantes
`*.packable.js` y assets GTK en cualquier nivel del lock.

`validCliJavaScriptProjectSnapshot` liga la validación del lock al JavaScript
generado y al texto exacto del manifest canónico. El exportador lo ejecuta
dentro del staging; cualquier diferencia produce `LOCK_INVALID` antes de
renombrar el destino.

`NpmPackageLockAdapter` expone una receta inmutable y común para resolver sólo
metadatos:

```text
npm install
--package-lock-only
--ignore-scripts
--include=dev
--install-strategy=hoisted
--global=false
--workspaces=false
```

La invocación conserva además `--no-audit`, `--no-fund` y el prefijo explícito
del staging. La lista exacta de tres archivos de la transacción impide publicar
si npm u otro adaptador deja `node_modules`, `dist` o cualquier residuo extra.
El lock no se construye ni se reescribe manualmente: npm sigue siendo su
autoridad, y la validación sólo decide si puede publicarse.

El ensayo opt-in `npm run test:cli:lock:native` ejecuta esta misma receta contra
el registro real dentro de un temporal. Comprueba el lock v3 completo y que npm
no haya creado `node_modules`; no forma parte de la suite determinista que debe
funcionar sin red.

## Implementación del Bloque 6

`JavaScriptProjectOutput.js` es ahora la autoridad pura de la presentación de
una exportación. Recibe la ruta generada y el resultado estructurado del
exportador, conserva el bloque común de rutas y comandos y selecciona el cierre
mediante `project.exportProfile`. `VSCodeCodeHost` se limita a escribir esas
líneas en el canal nativo `Salida`; no contiene reglas del perfil ni introduce
una Webview.

Ambos proyectos muestran los mismos comandos operativos:

```text
npm ci
npm start
npm run build:win
npm run build:unix
```

El perfil CLI termina exclusivamente con requisitos de Node y advierte que los
recursos externos no se incluyen automáticamente en el ejecutable. No menciona
GTK, `node-gtk`, runtime gráfico, `bootstrap.cjs` ni variantes packable. El
perfil GUI conserva su aviso de Node y GTK 4.10 o superior, así como la
advertencia histórica sobre recursos externos.

La ruta del JavaScript, la carpeta del proyecto y el respaldo de una exportación
anterior se presentan igual para ambos perfiles. Un resultado histórico que no
sea proyecto mantiene la única línea con la ruta generada. Si un consumidor
antiguo entrega un `node-project` sin perfil reconocido, el fallback es seguro:
explica sólo el requisito genérico de Node y nunca supone que existe GUI.

Las pruebas comparan las líneas exactas de CLI y GUI, comprueban que la salida
CLI no contenga términos gráficos y ejercitan la escritura del adaptador real
del canal. Esta evidencia forma parte del corpus de publicación y del comando
`npm run test:cli:export-architecture`.

## Implementación del Bloque 7

`test/fixtures/cli/export-corpus.v1.json` define un corpus CLI versionado con
cuatro clases de fuente reales:

- programa mínimo;
- entrada y salida estándar;
- funciones, condicionales y ciclo;
- palabras propias de GUI utilizadas exclusivamente como datos de una cadena.

Cada caso atraviesa lexer, parser, análisis semántico, transpilador, router,
exportador CLI y publicación transaccional. La prueba lo exporta en dos raíces
temporales independientes y exige que los tres archivos resultantes sean
idénticos byte a byte:

```text
<programa>.js
package.json
package-lock.json
```

También comprueba sintaxis JavaScript mediante `node --check`, manifest y lock
con los validadores de producción, nombres dinámicos, scripts directos desde el
único JavaScript fuente y ausencia de `node_modules`, `dist`, helpers packable,
bootstrap, dependencias GTK y campos de manifest exclusivos de GUI. La fuente
que menciona `VENTANA`, `node-gtk` y `bootstrap.cjs` dentro de una cadena prueba
que el aislamiento se decide semánticamente: esas palabras permanecen como
datos del usuario y no contaminan la estructura publicada.

La no regresión contrapone en una misma ejecución ambos perfiles a través de
`JavaScriptProjectExportRouter`:

```text
CLI → tres archivos, bin directo al JavaScript, sin preparación gráfica
GUI → cinco archivos, bootstrap, prepare-packable, node-gtk y assets pkg
```

El corpus protege además la frontera de `runSource`: ejecutar temporalmente un
CLI o una GUI no llama al router de exportación, no declara `exportProfile` y
no crea `app/`, `package.json`, lock, `node_modules` ni `dist`. La GUI temporal
conserva por separado su preparación privada y su comando Node especializado.

`npm run test:cli:export-corpus` es deliberadamente determinista. Utiliza un
adaptador de lock controlado, directorios temporales y dobles de ejecución; no
accede a la red, no ejecuta `npm ci` y no construye binarios con `pkg`. Las
pruebas de instalación y build reales permanecen separadas para los bloques
siguientes.

## Implementación del Bloque 8

`scripts/cli/validate-export.mjs` constituye el ensayo nativo opt-in de
instalación y ejecución normal. Genera un programa CLI mediante el frontend y
el exportador reales, con un lock producido por npm, y comprueba primero la
unidad publicada de tres archivos. Después copia el proyecto completo a otro
directorio temporal y elimina el origen para impedir que la prueba funcione por
una ruta privada o accidental del workspace.

Sobre el proyecto trasladado ejecuta el recorrido público documentado:

```text
npm ci
↓
npm start
↓
node <programa>.js desde un cwd ajeno
```

Tras `npm ci` se exige que el JavaScript, `package.json` y
`package-lock.json` permanezcan idénticos. La instalación debe resolver la CLI
local de `@yao-pkg/pkg`, pero no puede incorporar `node-gtk`. El script valida
el binario JavaScript real de `pkg` y su versión sin iniciar todavía un build.

`npm start` debe ejecutar directamente el entry normal y producir el mismo
resultado que invocarlo con Node desde otro directorio de trabajo. Ninguno de
los dos recorridos puede crear `dist`, `bin`, `bootstrap.cjs`,
`prepare-packable.cjs` ni una variante `*.packable.js`; tampoco puede modificar
fuente, manifest o lock.

El comando es:

```text
npm run test:cli:install:native
```

No forma parte de `release:check`, porque necesita el registro npm. Una prueba
determinista inspecciona su contrato dentro del corpus ordinario. El workflow
`cli-install-native`, habilitado sólo mediante la entrada manual `cli_native`,
declara ejecuciones separadas con Node 24 en Windows, Linux y macOS y conserva
un reporte JSON por host. Declarar esa matriz no sustituye su ejecución real.

La ejecución local conservada en
`test/fixtures/cli/install.win32-x64.node24.json` aprobó el recorrido en
Windows x64 con Node 24.16.0, npm 11.13.0, lock v3 y `@yao-pkg/pkg` 6.22.0.
Terminó con limpieza completa de sus temporales. Esta evidencia no certifica
Linux, macOS ni otras versiones de Node.

Este bloque no construye el ejecutable: el reporte identifica expresamente
como pendientes el build host, el binario portable y las pruebas de stdin,
stderr, argumentos y códigos de salida.

## Implementación del Bloque 9

`scripts/cli/validate-portable-build.mjs` es el smoke test nativo opt-in del
ejecutable CLI. Exporta un proyecto con nombre dinámico, genera el lock con npm,
ejecuta `npm ci` y selecciona exclusivamente el script del host:

```text
Windows       → npm run build:win  → dist/<programa>.exe
Linux/macOS   → npm run build:unix → dist/<programa>
```

No realiza cross-compilation. El manifest conserva `--targets host` y el build
usa directamente `<programa>.js`: no genera ni consume bootstrap, preparador,
variante packable, runtime GTK o carpeta `bin`.

Para comprobar las propiedades normales de un proceso CLI que CLRS todavía no
expone como funciones públicas —argumentos, stderr y código de salida— el smoke
test añade una sonda únicamente al JavaScript exportado dentro del temporal de
prueba. No cambia el transpilador, el runtime de CLRS ni el proyecto que recibe
el usuario. La lectura mediante `leer` y la escritura mediante `escribir`
permanecen código CLRS real; la sonda observa `process.argv`, escribe una marca
en stderr y fija `process.exitCode`.

Después del build se exige que `dist/` contenga un solo ejecutable con el nombre
normalizado. El binario se copia fuera del proyecto y se ejecuta desde un cwd
ajeno, con `PATH` vacío para evitar que resuelva un comando Node externo. La
prueba canaliza stdin y compara exactamente:

```text
stdin      → entrada smoke
stdout     → stdout: entrada smoke
stderr     → argumentos recibidos por el ejecutable
exit code  → 23
```

La carpeta aislada debe conservar únicamente el binario después del arranque;
así se rechaza también la aparición tardía de bootstrap, packable, GTK o assets
extraídos. Se registra nombre, tamaño y SHA-256 del ejecutable antes de limpiar
todos los temporales.

El comando es:

```text
npm run test:cli:build:native
```

La suite determinista `cli.export.build.test.js` comprueba la estructura del
smoke test y su integración sin ejecutar npm ni `pkg`. El workflow manual
`cli-build-native`, activado mediante `cli_build_native`, declara Node 24 en
Windows, Linux y macOS y conserva una evidencia JSON independiente por host.
El build nativo no forma parte de `release:check` y una matriz declarada no se
presenta como una plataforma certificada hasta que se ejecute.

La evidencia local
`test/fixtures/cli/build.win32-x64.node24.json` registra un build aprobado en
Windows x64 con Node 24.16.0 y npm 11.13.0. Produjo
`prueba-cli-portatil.exe` mediante `build:win`, ejecutó la copia aislada con
stdin/stdout/stderr, argumentos y exit code correctos y limpió los temporales.
El tamaño y SHA-256 registrados identifican ese artefacto efímero; el ejecutable
no se conserva en el repositorio. Esta ejecución no certifica Linux, macOS,
cross-compilation, firma ni apariencia interactiva de la terminal.

## Implementación del Bloque 10

`docs/gui/javascript-export.md` es la guía operativa común de **Generar código
JavaScript**. Documenta el recorrido completo desde `app/<programa>/`, distingue
los tres archivos iniciales del perfil CLI de los cinco del perfil GUI y explica
qué manifest, lock y entrada de `pkg` corresponde a cada uno:

```text
CLI: JavaScript + manifest + lock → pkg directo
GUI: JavaScript + manifest + lock → prepare-packable → packable → bootstrap → pkg
```

El recorrido de usuario queda fijado sin exponer detalles innecesarios en el
canal `Salida`:

```text
Generar código JavaScript
→ abrir app/<programa>/
→ npm ci
→ npm start
→ npm run build:win | npm run build:unix
```

La guía indica las salidas `dist/<programa>.exe` y `dist/<programa>` del CLI,
el layout portable especializado del GUI, el uso exclusivo de `--targets host`
y que el binario CLI ya construido incorpora Node. También separa los requisitos:
CLI no usa GTK; GUI mantiene `node-gtk@4.1.1` y puede necesitar bibliotecas GTK
del sistema. Los recursos externos no se consideran embebidos automáticamente.

`README.md` resume ese flujo en la superficie destinada a usuarios, mientras
`docs/language/compilation.md` describe la bifurcación técnica y
`docs/development/environment.md` registra las dependencias de cada perfil. El
índice técnico enlaza la guía única en lugar de duplicarla.

`test/cli.export.documentation.test.js` protege la terminología, las estructuras,
los comandos, las salidas y los requisitos documentados. También rechaza las
afirmaciones históricas de que un programa sin GUI sólo produce un archivo y
comprueba que este bloque no anticipe el cambio de versión ni un VSIX.

## Implementación del Bloque 11

El cierre sincroniza `package.json`, `package-lock.json`, el número visible del
`README.md` y el índice técnico en la versión `2.0.3`. `CHANGELOG.md` registra
el perfil CLI compilable, la separación intacta del perfil GUI, el corpus, los
ensayos nativos y la documentación final.

El flujo de publicación ejecuta el corpus integral y las suites generales,
reconstruye los bundles del Extension Host, CLI y frontend, inspecciona la
frontera definida por `.vscodeignore` y genera:

```text
dist/clrs-kit-esp-2.0.3.vsix
```

El VSIX es un artefacto local publicable; no se sube automáticamente al
Marketplace. La evidencia nativa sigue limitada a las plataformas realmente
ejecutadas y no se amplía por el solo hecho de empaquetar la extensión.

## Secuencia acordada para los bloques siguientes

No quedan bloques de implementación pendientes para este contrato. Una futura
publicación en Marketplace continúa siendo una acción explícita del mantenedor.

No se incorporarán llamadas a npm, escritura de proyectos ni configuración de
`pkg` dentro de visitantes del AST.

## Criterio histórico de cierre del Bloque 1

El bloque se considera cerrado cuando:

- el recorrido actual está trazado hasta archivos concretos;
- la autoridad semántica de clasificación está fijada;
- CLI y GUI tienen responsabilidades exclusivas explícitas;
- staging, lock y publicación están identificados como infraestructura común;
- las superficies temporales quedan fuera del cambio;
- las brechas actuales están enumeradas sin ocultarlas mediante una
  implementación parcial;
- el contrato JSON y sus pruebas forman parte del corpus de publicación.

En ese primer bloque no se cambió la versión, no se generó un VSIX ni se afirmó
que el proyecto CLI de tres archivos ya estuviera implementado. Los bloques
posteriores registran por separado cuándo se incorporó cada capacidad.
