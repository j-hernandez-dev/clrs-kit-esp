# Pipeline de runtime GUI

## Especificación del runtime GUI, provisionamiento de `node-gtk` y ejecución temporal de CLRS

**Estado:** especificación normativa de pipeline de ejecución  
**Fecha de referencia:** 2026-09-09  
**Documento arquitectónico superior:** `architecture.md`  
**Catálogo público relacionado:** `api-catalog.md`  
**Backend GUI:** GTK 4 mediante `node-gtk`  
**Versión fijada de `node-gtk`:** `4.1.1`  
**Versión mínima de GTK:** `4.10`  
**Referencia recomendada de Node.js en CLRS:** Node.js 22 LTS

---

## 0. Propósito

Este documento define cómo se integra la GUI al **pipeline convencional de ejecución de CLRS**.

La incorporación no crea un segundo compilador, runner o frontend. Su función es ampliar el flujo existente para que, cuando un programa utilice funciones GUI de la biblioteca estándar:

1. se detecte estructuralmente esa necesidad;
2. se compruebe la compatibilidad del entorno;
3. se asegure de forma perezosa una instalación privada de `node-gtk@4.1.1`;
4. se resuelva el paquete mediante el mecanismo de módulos de Node, sin depender de rutas internas;
5. se genere el JavaScript temporal normal de CLRS con el runtime GUI incorporado;
6. se ejecute mediante el `NodeProgramRunner` existente;
7. se inicialice, sólo cuando corresponda, la configuración global de tema mediante GTK;
8. se mantenga el proceso mientras la aplicación GTK permanezca activa;
9. se limpien los artefactos temporales y el estado GUI al finalizar.

Un programa que no utiliza GUI debe conservar el comportamiento actual y **no debe instalar, resolver ni cargar `node-gtk`**.

---

## 1. Autoridad técnica

La implementación debe contrastarse principalmente con:

- documentación técnica vigente de CLRS Kit Español;
- npm `node-gtk` 4.1.1: <https://www.npmjs.com/package/node-gtk>;
- repositorio oficial: <https://github.com/romgrk/node-gtk>;
- Node.js ESM: <https://nodejs.org/api/esm.html>;
- Node.js `module`: <https://nodejs.org/api/module.html>;
- npm install: <https://docs.npmjs.com/cli/commands/npm-install>;
- npm ci: <https://docs.npmjs.com/cli/commands/npm-ci>;
- GTK 4: <https://docs.gtk.org/gtk4/>;
- `Gtk.Settings`: <https://docs.gtk.org/gtk4/class.Settings.html>;
- `Gtk.Settings:gtk-theme-name`: <https://docs.gtk.org/gtk4/property.Settings.gtk-theme-name.html>;
- `Gtk.Application`: <https://docs.gtk.org/gtk4/class.Application.html>;
- `Gio.Application`: <https://docs.gtk.org/gio/class.Application.html>.

### 1.1 Estado vigente de `node-gtk`

A la fecha de referencia:

```text
node-gtk = 4.1.1
```

npm publica `4.1.1` como la versión con tag `latest`.

La especificación **no usa el tag dinámico `latest`**. Siempre instala:

```text
node-gtk@4.1.1
```

La documentación npm vigente declara:

```text
ESM completo
Linux
macOS
Windows

binarios precompilados:
Node.js 22
Node.js 24
Node.js 26
```

En Windows, la distribución vigente incluye GTK 4 / Adwaita para las bibliotecas precompiladas soportadas.

En Linux y macOS, el paquete npm y las bibliotecas GTK del sistema constituyen dependencias distintas.

### 1.2 Fuentes desactualizadas

El repositorio de `node-gtk` puede contener secciones históricas correspondientes a versiones anteriores, GTK 3 o mecanismos como:

```js
const gi = require("node-gtk");
gi.startLoop();
```

La implementación de CLRS no debe copiar ciegamente esos ejemplos históricos.

Para `4.1.1` debe comprobarse la superficie pública realmente instalada y su soporte ESM.

La suite de integración de CLRS debe ser la prueba definitiva de que el bootstrap utilizado por el runtime funciona con la versión fijada.

---

## 2. Pipeline vigente que debe preservarse

CLRS ya posee conceptualmente:

```text
fuente CLRS
    ↓
LanguageFrontend
    ↓
AST
    ↓
SemanticAnalyzer
    ↓
JavaScriptGenerator
    ↓
CompilationArtifact
    ↓
FileSystemEmitter
    ↓
NodeProgramRunner
```

La GUI se incorpora como una preparación condicional:

```text
fuente CLRS
    ↓
LanguageFrontend
    ↓
AST
    ↓
SemanticAnalyzer
    ↓
detectar capacidades de runtime
    ↓
┌─────────────────────────────┐
│ ¿requiere GUI?              │
│                             │
│ no                sí        │
│ │                 │         │
│ │        asegurar node-gtk  │
│ │                 │         │
└─┴─────────────────┴─────────┘
    ↓
JavaScriptGenerator
    ↓
CompilationArtifact
    ↓
FileSystemEmitter
    ↓
NodeProgramRunner
```

No debe existir:

```text
GuiCompiler
GuiTranspiler
GuiRunner
GtkParser
GtkSemanticAnalyzer
```

como pipelines alternativos.

---

## 3. Objetivos de diseño

El pipeline GUI debe optimizar simultáneamente:

```text
compatibilidad con arquitectura actual
instalación perezosa
determinismo
aislamiento
portabilidad del compilador
diagnósticos claros
recuperación de instalación
cero dependencia global
cero NODE_PATH
cero conocimiento de rutas internas de node-gtk
```

La instalación administrada es infraestructura de ejecución, no semántica del lenguaje.

---

# 4. Componentes arquitectónicos recomendados

Los nombres exactos pueden adaptarse a las convenciones existentes, pero deben existir responsabilidades equivalentes.

```text
GuiUsageDetector
      │
      ▼
GuiRuntimeRequirement
      │
      ▼
NodeGtkDependencyManager
      │
      ├── NodeRuntimeInspector
      ├── PrivateRuntimeLayout
      ├── NpmProcessAdapter
      ├── NodeGtkResolver
      └── NodeGtkProbe
      │
      ▼
GuiRuntimeGenerationContext
      │
      ▼
JavaScriptGenerator
      │
      ▼
CompilationArtifact
      │
      ▼
NodeProgramRunner
```

---

## 4.1 `GuiUsageDetector`

Responsabilidad:

```text
determinar si un programa necesita el runtime GUI nativo
```

Debe operar sobre:

```text
AST
SemanticModel
catálogo canónico de la biblioteca estándar
```

No sobre texto fuente.

---

## 4.2 `NodeGtkDependencyManager`

Responsabilidad:

```text
asegurar que la dependencia privada requerida está instalada,
es resoluble y es utilizable
```

No genera JavaScript.

No conoce widgets concretos.

No modifica el AST.

---

## 4.3 `PrivateRuntimeLayout`

Responsabilidad:

```text
proporcionar las rutas privadas administradas por CLRS
```

No ejecuta npm.

No importa `node-gtk`.

---

## 4.4 `NpmProcessAdapter`

Responsabilidad:

```text
ejecutar npm de forma controlada
capturar stdout/stderr
permitir cancelación
aplicar timeout
traducir errores técnicos
```

Esta responsabilidad pertenece a infraestructura.

---

## 4.5 `NodeGtkResolver`

Responsabilidad:

```text
resolver node-gtk mediante las reglas de Node
```

No debe codificar:

```text
node_modules/node-gtk/index.js
node_modules/node-gtk/lib/index.js
node_modules/node-gtk/dist/index.js
```

---

## 4.6 `NodeGtkProbe`

Responsabilidad:

```text
comprobar que el paquete y GTK pueden cargarse realmente
```

La existencia física del directorio no es suficiente.

---

## 4.7 `GuiRuntimeGenerationContext`

Contrato entregado al generador cuando el programa requiere GUI.

Ejemplo conceptual:

```js
{
    enabled: true,
    nodeGtkVersion: "4.1.1",
    nodeGtkEntryUrl: "file:///...",
    gtkApiVersion: "4.0",
    minimumGtkVersion: "4.10"
}
```

El generador no debe descubrir por su cuenta:

```text
extensionRoot
npm
node_modules
VS Code
```

---

# 5. Detección de uso GUI

## 5.1 Fuente de verdad

Las funciones GUI pertenecen al catálogo canónico de la biblioteca estándar.

Cada descriptor GUI debe poder declarar metadatos equivalentes a:

```js
{
    runtimeCapability: "gui",
    nativeDependency: "node-gtk"
}
```

Esto incluye tanto factories/operaciones sobre componentes como las funciones globales:

```text
ESTABLECER_TEMA
OBTENER_TEMA
ESTABLECER_MODO_TEMA
OBTENER_MODO_TEMA
```

Por tanto, un programa que únicamente consulta o configura el tema **también requiere la capacidad GUI**, aunque todavía no haya creado un widget.

El detector se apoya en la resolución semántica de llamadas.

Ejemplo:

```clrs
BOTON(
    "aceptar",
    "Aceptar"
)
```

La llamada está resuelta como símbolo estándar:

```text
BOTON
    ↓
standard-library
    ↓
runtimeCapability = gui
```

Resultado:

```text
requiresGui = true
```

---

## 5.2 No buscar nombres mediante regex

Está prohibido detectar GUI con:

```js
source.includes("BOTON(")
```

o expresiones regulares.

Esto sería incorrecto ante:

```clrs
escribir "BOTON("
```

comentarios, sombreado futuro o construcciones equivalentes.

---

## 5.3 Propagación por funciones

Si:

```clrs
CREAR_UI()
    BOTON(
        "x",
        "Aceptar"
    )

PRINCIPAL()
    CREAR_UI()
```

el programa requiere GUI porque el AST contiene una llamada resuelta a una función estándar GUI.

No es obligatorio construir análisis de alcanzabilidad para la primera versión.

La presencia semántica de una llamada GUI en el programa es suficiente para activar la capacidad.

Esto es conservador:

```text
puede instalar node-gtk para una función no ejecutada,
pero nunca omitirá una dependencia realmente presente.
```

---

## 5.4 Resultado estructurado

El análisis debe producir un resultado explícito:

```js
{
    capabilities: new Set([
        "gui"
    ])
}
```

o estructura equivalente.

No debe almacenarse como variable global mutable del compilador.

---

# 6. Ruta privada del runtime

La ubicación canónica acordada es una carpeta privada bajo la raíz de la extensión:

```text
<extensionRoot>/
└── .runtime/
    ├── npm-cache/
    ├── locks/
    └── packages/
        ├── package.json
        ├── package-lock.json
        └── node_modules/
            └── node-gtk/
```

La carpeta:

```text
.runtime/
```

no forma parte del código fuente conceptual de CLRS.

Es estado reconstruible de infraestructura.

---

## 6.1 Reglas

La ruta privada:

- no es global;
- no pertenece al workspace del usuario;
- no modifica su `package.json`;
- no utiliza `%APPDATA%\npm\node_modules` como dependencia;
- no utiliza `npm -g`;
- no utiliza `NODE_PATH`;
- puede eliminarse y reconstruirse;
- queda asociada a la instalación concreta de la extensión.

---

## 6.2 Resolución de `extensionRoot`

La capa `extension/` puede obtener la ruta real mediante el contexto de VS Code.

Conceptualmente:

```js
context.extensionPath
```

La ruta se entrega a la infraestructura de dependencias.

`src/` no importa `vscode`.

---

## 6.3 Escritura

Antes de provisionar la dependencia se debe validar que:

```text
<extensionRoot>/.runtime
```

sea escribible.

Si el host no permite escritura en la instalación de la extensión, debe producirse un diagnóstico de infraestructura claro.

No se debe continuar hasta terminar con un error opaco de npm.

Una futura política de fallback a almacenamiento global de VS Code puede añadirse explícitamente, pero no forma parte de esta primera especificación.

---

# 7. Manifest privado

El runtime privado debe poseer su propio proyecto npm mínimo.

`package.json` conceptual:

```json
{
    "name": "clrs-private-gui-runtime",
    "private": true,
    "version": "1.0.0",
    "type": "module",
    "dependencies": {
        "node-gtk": "4.1.1"
    }
}
```

Reglas:

```text
private = true
versión exacta
sin ^
sin ~
sin latest
```

El archivo no se mezcla con el `package.json` principal de la extensión.

---

# 8. `package-lock.json` privado

También se debe conservar un `package-lock.json` dentro de:

```text
.runtime/packages/
```

Su función es estabilizar las dependencias transitivas instaladas en esa instalación de CLRS.

Hay dos estados posibles.

### Primera instalación

Si no existe lock válido:

```text
npm install
    ↓
genera package-lock.json
```

### Reinstalación

Si existe un lock válido y corresponde al manifest:

```text
npm ci
```

puede utilizarse para obtener una instalación limpia y congelada.

En un proyecto JavaScript exportado con GUI, el `package.json` contiene además
la autorización fijada `"node-gtk@4.1.1": true` en `allowScripts`. Así, npm
puede ejecutar únicamente el script nativo de la versión revisada durante la
instalación limpia; los programas sin GUI no generan este manifest ni esta
autorización.

npm documenta que `npm ci`:

- exige un lockfile existente;
- falla si no coincide con `package.json`;
- elimina `node_modules` antes de instalar;
- no modifica el manifest ni el lock.

---

# 9. Comando de instalación

La dependencia se instala mediante npm, no mediante descarga manual del tarball.

Comando conceptual inicial:

```powershell
npm install
```

con:

```text
cwd = <extensionRoot>/.runtime/packages
```

y `package.json` ya preparado con:

```json
"node-gtk": "4.1.1"
```

También es válido utilizar explícitamente:

```powershell
npm install --save-exact node-gtk@4.1.1
```

si el adaptador crea el manifest de esta forma.

La implementación debe preferir el primer modelo:

```text
manifest declarado
    ↓
npm install
```

porque la dependencia deseada permanece visible y verificable antes de ejecutar npm.

---

## 9.1 Caché privada de npm

Se recomienda dirigir la caché de esta operación a:

```text
<extensionRoot>/.runtime/npm-cache
```

mediante entorno o argumento npm.

Ejemplo conceptual:

```text
npm_config_cache=<extensionRoot>/.runtime/npm-cache
```

Ventajas:

```text
instalación autocontenida
fácil eliminación
menos residuos externos
diagnóstico reproducible
```

No es un requisito semántico del lenguaje.

---

## 9.2 Sin ejecución mediante shell

El adaptador debe preferir:

```js
spawn(npmExecutable, args, {
    shell: false
})
```

en lugar de construir una cadena:

```js
exec(`npm install ...`)
```

Esto evita problemas de:

```text
espacios
quoting
inyección accidental
PowerShell
cmd.exe
bash
```

---

# 10. Descubrimiento de Node y npm

CLRS ya requiere Node.js y npm como parte del entorno de desarrollo.

El manager GUI debe utilizar el mismo entorno de ejecución elegido por CLRS siempre que sea posible.

No debe instalar una segunda copia de Node automáticamente.

---

## 10.1 Node de referencia

La documentación vigente de CLRS recomienda:

```text
Node.js 22 LTS
```

`node-gtk 4.1.1` publica binarios precompilados para:

```text
22
24
26
```

Para la primera implementación GUI, los majors aceptados son:

```text
22
24
26
```

Node 22 es la recomendación principal de CLRS.

---

## 10.2 Runtime no soportado

Si el usuario ejecuta GUI con un major fuera del conjunto validado:

```text
20
21
23
25
...
```

CLRS no debe iniciar silenciosamente una compilación nativa de `node-gtk`.

Debe emitir un diagnóstico previo similar a:

```text
CLRS GUI requiere una versión de Node.js compatible con
node-gtk 4.1.1.

Versiones validadas: 22, 24 y 26.
Se recomienda Node.js 22 LTS.
```

Esto favorece una instalación determinista.

Una futura opción explícita para compilar `node-gtk` desde fuente puede agregarse fuera de esta especificación.

---

# 11. Estado del administrador de dependencia

El manager debe distinguir como mínimo:

```text
UNKNOWN
CHECKING
MISSING
INSTALLING
READY
BROKEN
INCOMPATIBLE_NODE
MISSING_NATIVE_GTK
INCOMPATIBLE_GTK
FAILED
```

Flujo típico:

```text
UNKNOWN
   ↓
CHECKING
   ├── READY
   ├── MISSING
   │      ↓
   │  INSTALLING
   │      ↓
   │  CHECKING
   │      ↓
   │    READY
   │
   ├── BROKEN
   │      ↓
   │  REINSTALL
   │      ↓
   │    READY
   │
   └── INCOMPATIBLE_*
          ↓
        error
```

Este estado pertenece al manager, no al programa CLRS.

---

# 12. Comprobación rápida

Antes de ejecutar npm, la infraestructura puede realizar una comprobación barata:

```text
¿existe manifest?
¿existe lock?
¿se resuelve node-gtk?
¿version instalada = 4.1.1?
```

Pero ninguna de ellas por separado determina `READY`.

`READY` exige un probe real.

---

# 13. Resolución de `node-gtk`

## 13.1 Prohibición de ruta interna

No debe generarse:

```js
import ".../node_modules/node-gtk/lib/index.js";
```

ni cualquier ruta equivalente asumida manualmente.

---

## 13.2 Resolver desde el proyecto privado

La resolución debe estar anclada a:

```text
.runtime/packages/package.json
```

En ESM puede utilizarse un resolver basado en Node.

Ejemplo conceptual:

```js
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const requireFromPrivateRuntime = createRequire(
    pathToFileURL(privatePackageJsonPath)
);

const entryPath = requireFromPrivateRuntime.resolve(
    "node-gtk"
);
```

Esto utiliza:

```text
main
exports
algoritmo de resolución Node
```

en lugar de la estructura física esperada.

---

## 13.3 Conversión a URL ESM

Una vez resuelta la ruta:

```js
const entryUrl = pathToFileURL(
    entryPath
).href;
```

Resultado esperado en Windows:

```text
file:///C:/Users/.../node-gtk/...
```

No:

```text
C:\Users\...
```

El URL se entrega al generador como dato ya resuelto.

---

## 13.4 `NODE_PATH`

No se debe utilizar:

```text
NODE_PATH
```

para resolver la dependencia GUI.

La razón arquitectónica es que:

- CLRS genera ESM;
- `NODE_PATH` pertenece al modelo histórico de resolución CommonJS;
- una ruta explícitamente resuelta es más determinista;
- el JS temporal debe conocer exactamente qué instalación privada utiliza.

---

# 14. Bootstrap ESM de `node-gtk`

`node-gtk 4.1.1` declara soporte ESM.

El runtime GUI debe utilizar la **superficie pública vigente del paquete**.

La implementación exacta del bootstrap debe quedar encapsulada en un pequeño adaptador interno y validarse contra la instalación real de `4.1.1`.

No debe repartirse lógica de importación por:

```text
factories
propiedades
eventos
acciones
```

---

## 14.1 Requisito observable

El bootstrap debe producir un namespace GTK 4 utilizable por el runtime:

```text
Gtk API 4.0
```

y permitir construir:

```text
Gtk.Application
Gtk.Window
Gtk.Button
...
```

---

## 14.2 Compatibilidad con la nueva superficie ESM

Las versiones actuales de `node-gtk` promocionan imports GI ESM del estilo:

```js
import Gtk from "gi:Gtk-4.0";
```

La implementación debe comprobar el mecanismo público exacto de `4.1.1` durante el desarrollo.

Si el paquete requiere registrar hooks o bootstrap previo para resolver el esquema `gi:`, esa inicialización debe pertenecer al adaptador de dependencia y nunca al código CLRS.

---

## 14.3 No fijar el runtime a APIs legacy sin prueba

No debe asumirse como contrato de `4.1.1`:

```js
gi.require("Gtk", "4.0");
gi.startLoop();
```

únicamente porque ejemplos históricos de `node-gtk` los utilicen.

Si `4.1.1` conserva compatibilidad y la suite demuestra que esa superficie es oficialmente soportada, puede encapsularse internamente.

La API CLRS permanece idéntica en ambos casos.

---

# 15. Probe real de dependencia

El probe debe ejecutar un proceso Node aislado.

No debe cargar el addon nativo dentro del Extension Host principal.

Motivo:

```text
si el addon falla al cargar
si GTK falta
si una DLL falta
si hay una incompatibilidad ABI
```

el fallo debe permanecer aislado del proceso que mantiene VS Code.

---

## 15.1 Proceso probe

Conceptualmente:

```text
Node
  ↓
cargar node-gtk privado
  ↓
cargar Gtk API 4.0
  ↓
leer versión efectiva GTK
  ↓
resolver recursos GTK esenciales mediante GIO/GSettings
  ↓
crear/verificar objeto mínimo no visual si es necesario
  ↓
salir 0
```

El probe no debe abrir una ventana visible.

---

## 15.2 Resultado estructurado

Ejemplo:

```json
{
    "ok": true,
    "nodeGtkVersion": "4.1.1",
    "gtkMajor": 4,
    "gtkMinor": 18,
    "gtkMicro": 6
}
```

Los números son ilustrativos.

---

## 15.3 Versión mínima

Debe validarse:

```text
GTK >= 4.10
```

porque el catálogo inicial incluye:

```text
Gtk.AlertDialog
Gtk.FileDialog
```

---

# 16. Diferencias por plataforma

## 16.1 Windows

Para una combinación cubierta por los binarios precompilados de `node-gtk 4.1.1`:

```text
npm install
```

debe ser la ruta normal.

La distribución vigente declara que incluye GTK 4 / Adwaita para sus bibliotecas precompiladas en Windows.

Por ello CLRS no debe exigir:

```text
MSYS2
pacman
GTK instalado globalmente
```

para el caso normal soportado.

Si la combinación de Node/arquitectura no está cubierta, CLRS debe fallar con diagnóstico controlado en vez de iniciar automáticamente una compilación nativa.

---

## 16.2 Linux

La instalación npm no garantiza por sí misma que GTK 4 esté disponible.

El probe debe distinguir:

```text
node-gtk no instalado
```

de:

```text
GTK nativo no disponible
```

CLRS no debe ejecutar automáticamente:

```text
apt
apt-get
dnf
pacman
zypper
```

como root ni modificar el sistema.

Debe mostrar un diagnóstico que indique que GTK 4.10+ debe instalarse mediante el gestor de paquetes de la distribución.

---

## 16.3 macOS

Igual que en Linux, el paquete npm y GTK del sistema son requisitos separados.

CLRS no debe ejecutar automáticamente:

```text
brew install ...
```

Debe diagnosticar la ausencia de GTK.

---

## 16.4 Capacidad gráfica y probe aislado

El catálogo semántico identifica únicamente la capacidad `gui`, sin buscar nombres en el texto fuente. `NodeGtkDependencyManager` instala/repara exclusivamente `node-gtk@4.1.1` privado y valida la carga del binding, GTK 4, su versión efectiva (4.10 o superior) y sus recursos esenciales en un proceso Node separado.

La comprobación definitiva de recursos utiliza `Gio.SettingsSchemaSource.getDefault()` y `lookup("org.gtk.gtk4.Settings.FileChooser", true)`. Una carpeta o un archivo existente no sustituyen esta resolución real. Una fuente nula, un schema no resoluble o un fallo nativo durante esta fase producen `CLRS_GUI_DEP_GTK_RESOURCES_UNAVAILABLE`, con detalle técnico interno y mensaje público en español. El identificador no constituye una dependencia nueva que el estudiante deba instalar.

En el bundle oficial Windows, antes de cargar el addon, el hijo calcula `GSETTINGS_SCHEMA_DIR` y `XDG_DATA_DIRS` desde la entrada ESM efectiva y el directorio `lib/binding/node-v<ABI>-win32-<arquitectura>/share`. Se emplea el marcador `girepository-1.0` para distinguir este layout de builds contra GTK externo. La búsqueda privada no debe quedar enmascarada por schemas de otra instalación. El programa generado aplica la misma configuración antes de cargar node-gtk; no se modifica el entorno del Extension Host ni variables globales del sistema.

Linux/macOS conservan sus rutas nativas y realizan la misma resolución GIO. Si el GTK del sistema carece de recursos, no se reinstala npm para intentar solucionarlo ni se ejecutan gestores de paquetes nativos.

Un programa sin GUI no inicia este probe. GSettings es una verificación de recursos del propio GTK, no una capacidad adicional del lenguaje. La carga nativa nunca se realiza en el Extension Host; los fallos del hijo se convierten en diagnósticos CLRS en español.

La misma lógica canónica se utiliza en ejecución temporal y JavaScript exportado. CLRS no administra paquetes nativos del sistema operativo, no modifica variables globales ni reinicia aplicaciones. Las pruebas unitarias no dependen de GTK instalado; los ensayos nativos se ejecutan por separado y documentan la plataforma comprobada.

---

# 17. Concurrencia de instalación

Varias solicitudes de ejecución pueden llegar mientras `node-gtk` todavía se instala.

No deben iniciar varias instalaciones npm simultáneas sobre el mismo directorio.

---

## 17.1 Single-flight en el Extension Host

El manager mantiene una promesa compartida:

```js
ensurePromise
```

Si existe una instalación en progreso:

```text
run A ─┐
run B ─┼── espera la misma instalación
run C ─┘
```

No:

```text
npm install
npm install
npm install
```

en paralelo.

---

## 17.2 Múltiples Extension Hosts

La instalación concreta de una extensión puede ser visible para más de un proceso.

Por tanto, además del lock en memoria debe existir protección de filesystem.

Ubicación sugerida:

```text
.runtime/locks/node-gtk-4.1.1.lock
```

La adquisición debe ser atómica.

---

## 17.3 Lock obsoleto

El lock debe registrar metadatos suficientes:

```json
{
    "pid": 1234,
    "startedAt": "..."
}
```

Si el proceso propietario ya no existe y ha transcurrido un umbral razonable, puede considerarse obsoleto.

No debe borrarse un lock activo basándose únicamente en tiempo.

---

# 18. Instalación transaccional

Una instalación incompleta no debe convertirse en estado `READY`.

Se recomienda provisionar en un directorio de staging:

```text
.runtime/
├── packages/
└── staging/
    └── packages-<uuid>/
```

Flujo:

```text
crear staging
    ↓
crear package.json
    ↓
npm install
    ↓
probe
    ↓
si válido:
    publicar instalación
si falla:
    eliminar staging
```

---

## 18.1 Publicación

La sustitución debe ser tan atómica como permita la plataforma.

No se debe eliminar una instalación `READY` antes de haber validado su reemplazo.

Esto es especialmente importante en Windows, donde los archivos nativos pueden estar bloqueados por procesos en ejecución.

---

# 19. Reutilización de instalación

No se ejecuta npm en cada programa.

Cada ejecución GUI comienza con:

```text
ensureNodeGtk()
```

pero si:

```text
versión = 4.1.1
probe válido
```

el manager retorna inmediatamente.

---

## 19.1 Caché de validación en memoria

Durante la vida del mismo Extension Host se puede conservar:

```js
{
    version: "4.1.1",
    entryUrl: "...",
    gtkVersion: "4.x.y"
}
```

para evitar probes repetidos.

La caché queda invalidada si cambia:

```text
runtime path
Node executable
mtime/identidad del manifest
package-lock
versión requerida
```

---

# 20. Reparación

Si existe `node_modules/node-gtk` pero el probe falla:

```text
BROKEN
```

El manager puede realizar una única reparación automática.

Secuencia:

```text
probe falla
   ↓
eliminar/recrear instalación privada
   ↓
npm ci o npm install
   ↓
probe
```

Si vuelve a fallar:

```text
FAILED
```

No debe entrar en un ciclo infinito.

En Windows, los recursos GSettings no resolubles invalidan el runtime privado y activan como máximo una reparación por solicitud. El binario oficial de node-gtk 4.1.1 ya distribuye `gschemas.compiled`: se restaura la distribución completa, sin compilar schemas ni descargar herramientas de desarrollo. Un error final no debe prometer otro intento automático.

El probe completo, incluida la resolución GIO, debe pasar antes de publicar staging y repetirse en la ubicación definitiva. Si falla antes de publicar, la instalación anterior permanece intacta; si falla después del traslado, se restaura la anterior. No se alcanza `READY` en ninguno de esos fallos y se liberan staging y locks según la política transaccional existente.

---

# 21. Offline

Si el paquete no está instalado y la máquina no dispone de conexión al registry npm:

```text
no se puede ejecutar el primer programa GUI
```

El error debe distinguirse de:

```text
código CLRS inválido
GTK incompatible
Node incompatible
```

Ejemplo:

```text
No fue posible instalar la dependencia gráfica de CLRS.

Se requiere node-gtk 4.1.1 y npm no pudo acceder al registro.
Comprueba tu conexión o la configuración de npm.
```

Un programa sin GUI sigue funcionando offline.

---

# 22. Proxy y configuración npm

CLRS no implementa su propio cliente npm.

La instalación debe respetar la configuración normal del npm utilizado:

```text
registry
proxy
https-proxy
certificados
.npmrc aplicable
```

No debe sobrescribir credenciales ni registry salvo que exista una decisión explícita posterior.

---

# 23. Cancelación

La instalación puede ser lenta.

El usuario debe poder cancelar la operación cuando la infraestructura de comandos lo permita.

El manager debe:

```text
propagar AbortSignal o equivalente
detener el proceso npm
limpiar staging
liberar lock
no publicar instalación incompleta
```

Cancelar la instalación no debe dejar:

```text
READY
```

como estado.

---

# 24. Diagnósticos de provisionamiento

Se recomienda una familia de códigos:

```text
CLRS_GUI_DEP_*
```

Como mínimo:

```text
CLRS_GUI_DEP_NODE_UNSUPPORTED
CLRS_GUI_DEP_NPM_NOT_FOUND
CLRS_GUI_DEP_RUNTIME_NOT_WRITABLE
CLRS_GUI_DEP_INSTALL_FAILED
CLRS_GUI_DEP_RESOLUTION_FAILED
CLRS_GUI_DEP_NATIVE_LOAD_FAILED
CLRS_GUI_DEP_GTK_NOT_FOUND
CLRS_GUI_DEP_GTK_TOO_OLD
CLRS_GUI_DEP_LOCK_TIMEOUT
CLRS_GUI_DEP_CANCELLED
```

Los mensajes públicos están en español.

Los logs técnicos pueden conservar:

```text
exit code
stderr npm
ruta
stack
platform
arch
Node version
GTK version
```

sin mostrar información innecesaria al usuario.

---

# 25. Generación del JavaScript temporal

Una ejecución CLRS continúa generando **un solo archivo JavaScript temporal**.

Ejemplo:

```text
programa.clrs
    ↓
.clrs/js/...temporal.js
```

No se crea:

```text
GuiRuntime.js
```

como segundo artefacto requerido para ejecutar el programa.

---

## 25.1 Contenido conceptual

Cuando el programa usa GUI:

```text
programa.tmp.js
│
├── imports/runtime estándar necesarios
├── bootstrap de dependencia GUI
├── runtime estándar CLRS
├── runtime GUI CLRS
├── adaptador global de tema GTK
├── instrumentación
├── funciones CLRS transpiladas
└── punto de entrada CLRS
```

---

## 25.2 Runtime GUI canónico

El texto del runtime GUI debe derivarse de una única implementación fuente mantenida por CLRS.

No se escribe manualmente otra versión dentro del generador.

Ejemplo conceptual:

```text
src/standard-library/gui/
    ↓
runtime source
    ↓
JavaScriptGenerator
    ↓
temporal.js
```

La ruta exacta del repositorio puede adaptarse a la organización vigente.

La misma fuente canónica debe contener la lógica de:

```text
ESTABLECER_TEMA
OBTENER_TEMA
ESTABLECER_MODO_TEMA
OBTENER_MODO_TEMA
```

No debe existir una implementación de tema distinta para ejecución y exportación.

---

# 26. Programa sin GUI

Si:

```text
requiresGui = false
```

el artefacto no debe tener una carga ESM incondicional de `node-gtk`.

Son válidas dos estrategias.

### Estrategia A: poda

No insertar la sección GTK-dependiente.

```text
runtime estándar
programa
```

### Estrategia B: runtime común con inicialización diferida

Insertar helpers comunes pero no resolver/cargar GTK hasta una llamada GUI.

Para el pipeline actual se recomienda **A** porque el compilador ya conoce estructuralmente la capacidad requerida.

---

# 27. Programa con GUI

Si:

```text
requiresGui = true
```

antes de generar el artefacto ejecutable debe existir:

```js
GuiRuntimeGenerationContext
```

válido.

El generador puede materializar el URL absoluto ya resuelto.

Ejemplo conceptual:

```js
const __CLRS_NODE_GTK_ENTRY__ =
    "file:///C:/.../node-gtk/<entry>";
```

La cadena debe emitirse mediante escape seguro, por ejemplo:

```js
JSON.stringify(entryUrl)
```

---

# 28. Importación absoluta temporal

La ruta absoluta es una decisión deliberada para **ejecución administrada**.

Ventajas:

```text
no depende de NODE_PATH
no depende del cwd del programa
no depende de node_modules del workspace
no depende de instalación global
selecciona exactamente la copia privada de CLRS
```

Esta ruta no debe aparecer en el JavaScript exportable.

---

# 29. Bootstrap dinámico recomendado

Para evitar una carga nativa antes de que el runtime haya preparado diagnósticos, el bootstrap puede usar:

```js
await import(resolvedEntryUrl)
```

en vez de un import estático generado literalmente.

Esto también permite encapsular el fallo y convertirlo en un error CLRS.

Conceptualmente:

```js
let __clrsNodeGtk;

try {
    __clrsNodeGtk =
        await import(__CLRS_NODE_GTK_ENTRY__);
} catch (error) {
    throw __clrsGuiDependencyError(error);
}
```

El adaptador interno obtiene después la superficie pública necesaria para GTK 4.

---

## 29.1 Por qué no un bare specifier

No:

```js
import "node-gtk";
```

en el JS temporal, porque su ubicación normal está fuera del árbol de `node_modules` del artefacto.

La exportación sí utilizará el mecanismo de proyecto npm definido en `javascript-export.md`.

---

# 30. Inicialización GTK

La API pública CLRS no contiene:

```text
GTK_INIT
INICIAR_GTK
MAIN_LOOP
```

La inicialización pertenece al runtime.

El primer uso GUI debe asegurar internamente que GTK está preparado.

Un «primer uso GUI» puede ser una factory como:

```clrs
BOTON(
    "aceptar",
    "Aceptar"
)
```

pero también puede ser una configuración global:

```clrs
ESTABLECER_TEMA(
    "Adwaita"
)
```

Por ello el runtime no debe asumir que la primera operación gráfica siempre crea un widget.

---

# 31. Modelo de aplicación GTK

GTK recomienda `Gtk.Application` para administrar inicialización y ciclo de vida de ventanas.

El runtime CLRS debe administrar **una aplicación GTK interna por ejecución GUI**.

Conceptualmente:

```text
programKey
    ↓
GuiRuntimeSession
    ├── application
    ├── component registry
    ├── callbacks
    └── lifecycle
```

---

## 31.1 Application ID

El runtime no debe usar un ID fijo global como:

```text
org.clrs.app
```

porque múltiples programas CLRS pueden ejecutarse simultáneamente.

Debe derivar un ID válido y no sensible a partir de la identidad privada de la ejecución.

Ejemplo conceptual:

```text
io.clrs.runtime.p<hash>
```

No debe incluir la ruta completa ni datos personales.

También puede utilizarse un modo no único de `GApplication` cuando la superficie `node-gtk` y GTK lo permitan de forma estable.

La prioridad es:

```text
dos programas CLRS diferentes no se redirigen entre sí
```

---

# 32. `Window` y `ApplicationWindow`

Aunque CLRS exponga ambos tipos:

```text
VENTANA
VENTANA_APLICACION
```

el runtime puede asociar `Gtk.Window` ordinarias a la misma `Gtk.Application`.

GTK documenta que una `Gtk.Application` puede administrar también `Gtk.Window` normales.

Por ello:

```text
una aplicación por ejecución
```

es compatible con ambos componentes.

---

# 33. Registro antes de asociar ventanas

GTK establece que `Gtk.Application.add_window()` debe utilizarse después de que la aplicación haya iniciado/registrado su ciclo.

El runtime no debe asociar ventanas a una aplicación en un estado inválido.

El adaptador debe asegurar que la aplicación esté registrada/iniciada antes de:

```text
crear ApplicationWindow asociado
añadir Window ordinaria
```

---

# 34. Integración con el loop actual de `node-gtk`

Las versiones actuales de `node-gtk` anuncian una integración ESM con menos boilerplate y sin exigir al usuario manejar manualmente la integración de loop histórica.

CLRS no debe exponer ni copiar como requisito público:

```js
gi.startLoop();
Gtk.main();
```

El runtime debe utilizar el mecanismo soportado por `node-gtk 4.1.1`.

---

## 34.1 Prueba de vida obligatoria

La implementación no se considera válida hasta demostrar este caso:

```clrs
PRINCIPAL()
    VENTANA_APLICACION(
        "principal",
        "Prueba"
    )

    MOSTRAR(
        "principal"
    )
```

Comportamiento requerido:

```text
PRINCIPAL termina
    ↓
la ventana sigue abierta
    ↓
Node continúa vivo
    ↓
usuario cierra la última ventana
    ↓
la aplicación GTK termina
    ↓
Node finaliza
```

No es válido que el proceso Node termine inmediatamente al retornar `PRINCIPAL`.

---

## 34.2 Sin envolver el frontend innecesariamente

La implementación debe intentar preservar la forma vigente de generación de funciones y `PRINCIPAL`.

No debe reestructurarse todo el AST sólo para ejecutar el programa dentro de un callback `activate` si el runtime actual de `node-gtk` permite registrar/integrar la aplicación sin ello.

Si una limitación real de `node-gtk 4.1.1` obliga a una envoltura de entrada, el cambio debe limitarse a la fase de generación JavaScript y no modificar:

```text
AST
semántica
DAP
diagramador
modelo de funciones
```

---

# 35. Sesión GUI privada

El JS generado mantiene una sesión conceptual:

```js
const __clrsGuiSession = {
    programKey,
    application,
    settings,
    themeName,
    themeMode,
    baselineThemeState,
    components,
    connections,
    closing
};
```

La representación exacta es interna.

---

## 35.1 Registro de componentes

La sesión contiene:

```text
Map<componentId, ComponentRecord>
```

porque la `programKey` ya identifica la sesión del programa.

También es válido un registro global interno:

```text
Map<programKey, Map<componentId, ComponentRecord>>
```

si el runtime comparte proceso entre programas en el futuro.

Actualmente cada ejecución Node es aislada, por lo que un `Map` de sesión es suficiente siempre que preserve la semántica documentada.


## 35.2 Estado global de tema

El tema no se almacena dentro de cada `ComponentRecord`.

Pertenece al estado de la sesión:

```text
GuiRuntimeSession
├── settings
├── themeName
├── themeMode
├── baselineThemeState
└── components
```

Valores públicos normalizados:

```text
themeName → Cadena o valor inicial obtenido de GTK
themeMode → "sistema" | "claro" | "oscuro"
```

El valor inicial de:

```text
themeMode
```

es:

```text
"sistema"
```

mientras el nombre inicial se obtiene de la configuración GTK efectiva.

---

## 35.3 Obtención de `Gtk.Settings`

La implementación debe obtener la configuración correspondiente al display GTK utilizado por la sesión mediante la API pública disponible en GTK 4.

Conceptualmente:

```text
Gtk.Display / display predeterminado
        ↓
Gtk.Settings
```

No debe construir manualmente un archivo de tema ni editar configuración global del sistema.

La instancia efectiva de `Gtk.Settings` se mantiene como detalle privado del runtime.

---

## 35.4 Sin configuración explícita

Si el programa no llama:

```text
ESTABLECER_TEMA
ESTABLECER_MODO_TEMA
```

el runtime no debe sobrescribir:

```text
gtk-theme-name
preferencias de variante
CSS global
```

La ejecución utiliza la configuración GTK normal del entorno.

Esto es importante: **provisionar `node-gtk` no implica imponer una estética de CLRS**.

---

## 35.5 `ESTABLECER_TEMA`

La llamada:

```clrs
ESTABLECER_TEMA(
    "Adwaita"
)
```

se resuelve conceptualmente como:

```text
CLRS
    ↓
GuiThemeAdapter
    ↓
Gtk.Settings
    ↓
gtk-theme-name = "Adwaita"
```

El runtime debe:

```text
validar Cadena no vacía
asegurar inicialización GTK
obtener Gtk.Settings
establecer gtk-theme-name
actualizar themeName de sesión
```

No debe:

```text
buscar CSS de VS Code
generar paletas
copiar el tema dentro del temporal
interpretar el nombre como ruta
```

El nombre es un **nombre de tema GTK**.

---

## 35.6 `OBTENER_TEMA`

La consulta:

```clrs
tema = OBTENER_TEMA()
```

debe obtener el valor efectivo de `gtk-theme-name` desde `Gtk.Settings` cuando sea posible.

El estado almacenado en la sesión puede utilizarse como caché, pero no debe convertirse en una fuente paralela que contradiga a GTK.

---

## 35.7 Modo `"sistema"`, `"claro"` y `"oscuro"`

La API normalizada no expone directamente nombres de propiedades GTK.

El runtime utiliza un adaptador:

```text
GuiThemeModeAdapter
```

cuya responsabilidad es traducir:

```text
"sistema"
"claro"
"oscuro"
```

a las capacidades disponibles en la versión GTK efectiva.

### Compatibilidad con GTK 4.10

El mínimo de CLRS continúa siendo:

```text
GTK 4.10
```

Por tanto el adaptador no debe depender obligatoriamente de propiedades introducidas después de 4.10.

Cuando una API GTK posterior ofrezca una representación mejor de preferencia de esquema de color, puede utilizarse condicionalmente, pero no puede convertirse silenciosamente en requisito mínimo.

### Semántica

Los modos representan **preferencias**:

```text
"sistema"
→ restaurar/dejar la preferencia original del entorno

"claro"
→ solicitar una presentación clara

"oscuro"
→ solicitar una presentación oscura
```

GTK y el tema seleccionado conservan la autoridad sobre la apariencia final.

CLRS no debe prometer que todos los temas externos poseen ambas variantes.

---

## 35.8 Estado base para `"sistema"`

Antes de modificar por primera vez una preferencia de tema, el runtime debe conservar los valores relevantes obtenidos de GTK:

```text
baselineThemeState
```

Conceptualmente:

```js
{
    themeName: "...",
    darkPreference: ...
}
```

La representación exacta depende de la API GTK utilizada.

`ESTABLECER_MODO_TEMA("sistema")` debe restaurar la preferencia inicial que CLRS modificó, no inventar valores predeterminados.

Esto permite:

```text
entorno oscuro
    ↓
CLRS pide claro
    ↓
CLRS pide sistema
    ↓
retorna a la preferencia inicial del entorno
```

El cambio de modo no debe deshacer un `ESTABLECER_TEMA(nombre)` explícito, salvo que el contrato de GTK utilizado lo haga inevitable y esté documentado.

---

## 35.9 Orden de inicialización del tema

Se recomienda:

```text
bootstrap GTK
    ↓
obtener Settings
    ↓
aplicar configuración explícita de tema
    ↓
crear/presentar widgets
```

cuando el programa configura el tema al principio.

Ejemplo:

```clrs
PRINCIPAL()
    ESTABLECER_TEMA(
        "Adwaita"
    )

    ESTABLECER_MODO_TEMA(
        "oscuro"
    )

    VENTANA_APLICACION(
        "principal",
        "Aplicación"
    )
```

No obstante, las funciones siguen siendo válidas después de crear widgets.

GTK debe encargarse de recalcular los estilos existentes.

El runtime no recrea los widgets para cambiar el tema.

---

## 35.10 Alcance por proceso/display

`Gtk.Settings` puede estar asociado al display y no es una propiedad privada de cada widget.

En el modelo actual:

```text
una ejecución CLRS
    ↓
un proceso Node
    ↓
una sesión GTK
```

esto proporciona aislamiento práctico entre programas ejecutados por separado.

La `programKey` identifica la sesión CLRS, pero no debe presentarse como un mecanismo capaz de superar semánticas globales del propio backend GTK dentro de un mismo proceso/display.

Si en el futuro varias ejecuciones GUI comparten proceso, la política de temas deberá revisarse antes de permitir configuraciones simultáneas diferentes.

---

## 35.11 No CSS público

El runtime puede utilizar APIs internas de GTK necesarias para cargar/aplicar un tema, pero la primera versión no materializa una hoja CSS de usuario ni expone:

```text
ESTABLECER_CSS
CARGAR_CSS
CLASE_CSS
COLOR_FONDO
FUENTE
```

La decisión de tema continúa delegando la estética a GTK.


---

# 36. `programKey`

La key privada existente del runtime se utiliza para:

```text
aislamiento
nombres internos
recursos
diagnóstico
aplicación GTK
```

Nunca sustituye el ID público del componente.

Ejemplo:

```text
programKey = $interno_93ab...

"aceptar" → Gtk.Button
```

El usuario continúa viendo:

```text
"aceptar"
```

---

# 37. Callbacks y funciones CLRS

`CONECTAR` recibe una función CLRS validada.

El wrapper GTK:

```text
señal GTK
    ↓
normalizador de evento
    ↓
callback CLRS
```

Nunca entrega el objeto GTK al callback.

---

## 37.1 Errores dentro de callbacks

Si una función CLRS conectada lanza un error:

```text
GTK callback
   ↓
runtime CLRS
   ↓
instrumentación de ubicación
   ↓
error público localizado
```

No debe convertirse en un rechazo de Promise sin manejar.

---

## 37.2 Callbacks async

Si el generador CLRS produce funciones JavaScript `async`, el adaptador de señales debe invocarlas de forma segura.

Un callback GTK generalmente espera retorno sincrónico.

Por tanto deben distinguirse:

```text
evento informativo
→ callback puede continuar async

evento con retorno semántico inmediato
→ cerrar
→ activar_enlace
→ tecla_presionada
```

Para eventos cuyo retorno controla GTK, el contrato público debe requerir un resultado disponible de forma síncrona o utilizar una estrategia específica que preserve la semántica.

No se debe esperar asincrónicamente un retorno cuando GTK ya necesita decidir si propaga el evento.

Los detalles por evento son autoridad de `api-catalog.md`.

---

# 38. Operaciones asincrónicas de diálogos

`Gtk.FileDialog` y `Gtk.AlertDialog.choose()` utilizan APIs asincrónicas.

Las funciones CLRS como:

```text
ABRIR_ARCHIVO
GUARDAR_ARCHIVO
ELEGIR_ALERTA
```

se implementan mediante Promises internas.

Si el generador ya transpila funciones CLRS a `async`, estas operaciones se integran mediante `await` generado por la biblioteca estándar.

No debe bloquearse artificialmente el hilo principal de GTK.

## 38.1 Integración y cierre de operaciones

La implementación común registra `Gtk.Application`, asocia explícitamente sus
ventanas y atiende `GLib.MainContext.iteration(false)` en turnos acotados de Node.
No anida un bucle bloqueante en una continuación de Promise; así conserva la E/S,
los temporizadores y los callbacks asincrónicos del programa.

Los eventos informativos reciben copias de valores CLRS y no devuelven una
Promise a GTK. Sus continuaciones se rastrean hasta terminar. Los eventos de
respuesta inmediata conservan el retorno síncrono especificado por el catálogo.

Cada apertura de diálogo utiliza una instantánea de configuración y su propio
`Gio.Cancellable`. El cierre del padre cancela sus operaciones; la disposición
espera que GTK complete las cancelaciones antes de detener la integración.
`MOSTRAR_ALERTA` no espera respuesta en CLRS, pero su operación interna mantiene
la sesión viva y permite liberar el diálogo incluso sin ventana principal.

Antes de abrir un selector de archivos se comprueba con `Gio.SettingsSchemaSource`
que existe `org.gtk.gtk4.Settings.FileChooser`. Una instalación GTK incompleta
puede carecer de ese recurso y abortar dentro del selector. CLRS lo convierte
en `CLRS_GUI_DIALOG_RESOURCES_UNAVAILABLE`, sin instalar paquetes nativos ni
exigir esos recursos a ventanas, controles o alertas. La misma implementación
se incorpora al JavaScript generado, sin dependencia de VS Code.

---

# 39. Instrumentación

El runtime GUI forma parte del runtime generado, pero las llamadas del usuario deben conservar localización CLRS.

Errores de:

```text
ESTABLECER
CONECTAR
ANEXAR
ABRIR_ARCHIVO
...
```

deben poder atribuirse a la llamada CLRS correspondiente.

No debe señalarse como origen principal una línea interna del runtime GUI salvo en logs técnicos.

---

# 40. Estado de depuración

El registro GTK no debe volcarse automáticamente como estructura completa en:

```text
RuntimeStateInstrumentation
DAP
trace snapshots
```

porque contendría objetos nativos y estructuras no serializables.

Las variables del usuario siguen mostrando sus valores ordinarios:

```clrs
boton = "aceptar"
```

El depurador puede mostrar:

```text
boton = "aceptar"
```

No:

```text
GtkButton { ... }
```

## 40.1 Sesiones DAP y callbacks GUI

La depuración utiliza el mismo CLI, aprovisionamiento, runner, protocolo de
control y adaptador DAP que los programas de consola. No carga node-gtk en el
Extension Host ni crea un adaptador o sesión GTK paralelos. El programa generado
instala únicamente puertos internos de instrumentación para GUI.

Los breakpoints y pasos se sitúan en instrucciones CLRS. Entrar en una función
GUI estándar no presenta frames internos GTK. Los callbacks de respuesta
inmediata conservan su pila síncrona y su retorno booleano; Step Into entra en
su código CLRS y Step Out regresa al llamador cuando existe.
Un cierre u otro evento inmediato recibido desde el bucle GTK no hereda la pila
de PRINCIPAL suspendida en un diálogo: sin llamador CLRS activo tiene una pila
propia, manteniendo siempre la respuesta síncrona exigida por GTK.

Los callbacks informativos pueden solaparse al esperar diálogos. Sus pilas y
ubicaciones se conservan por contexto asincrónico, separadas de PRINCIPAL y de
otros callbacks. Se mantiene un solo hilo lógico DAP. Step Over/Out siguen el
contexto de origen; un breakpoint explícito en otro callback sigue siendo válido.
Las instantáneas sólo contienen parámetros, locales y globales del programa,
no el registro privado, objetos GTK ni los contextos de instrumentación.

Mientras GUI espera eventos o diálogos, el bucle cooperativo atiende las órdenes
de pausa/terminación. No genera impactos de breakpoint ni pasos por cada tick.
Al salir del último frame, un avance puede detenerse indicando espera de eventos
con la última ubicación CLRS, sin inventar un llamador. Un nuevo paso desde esa
espera se detiene en la próxima instrucción CLRS, no en el bucle GTK.

Durante una pausa se congela la ejecución Node y no se itera GTK ni se despachan
callbacks. La ventana puede dejar de responder temporalmente; se reanuda al
continuar. No se introduce una bomba de eventos reentrante dentro de un breakpoint.

Terminate/disconnect usan el canal existente. GUI propaga una cancelación interna
para desenrollar finally y disponer de ventanas, handlers y diálogos pendientes
antes de emitir el final cancelado. Se conserva el corte forzado existente si el
proceso deja de responder. Las excepciones GUI/callback conservan su ubicación
CLRS y se presentan por el canal habitual de error, sin mostrar stacks nativos
como diagnóstico principal.

---

## 40.2 Trazas y reproducción en el diagramador

La ejecución GUI publica ubicaciones CLRS y metadatos mínimos de flujo por el
canal de trazas existente, tanto con DAP como sin depuración. Los metadatos
distinguen instrucciones, entrada y retorno de funciones, espera de diálogo,
reanudación, espera de eventos y pausa del depurador. Un identificador interno
de contexto permite mantener separadas las continuaciones de callbacks; no
representa un objeto GTK ni expone variables, argumentos o recursos nativos.

La espera de un diálogo conserva la ubicación de la llamada CLRS que lo abrió.
Su resolución reanuda ese contexto. Si un callback interviene durante la espera,
la traza registra su entrada y retorno y recupera el contexto todavía suspendido.
Con varias esperas pendientes se conserva cada contexto independiente. Cuando
PRINCIPAL ha terminado y sólo quedan ventanas u operaciones pendientes, se
registra una espera sin ubicación activa; no se inventa una instrucción de espera.

El diagramador mantiene exclusivamente figuras y conexiones derivadas de la
sintaxis original. No añade símbolos ni aristas para eventos, callbacks o saltos.
Resalta las figuras existentes y presenta el estado de espera/reanudación en la
barra de ejecución. Si el flujo filtrado oculta el destino de un nuevo paso,
vuelve al diagrama completo existente para permitir seguirlo.

Las instantáneas, lotes incrementales y reproducción conservan estos metadatos
con los límites de traza habituales. Reproducir recorre la historia: no vuelve a
ejecutar callbacks ni abre diálogos GTK. La pausa de reproducción es distinta de
una pausa DAP del proceso. Los programas sin GUI conservan su trazado habitual
y no cargan dependencias GTK.

---

# 41. Limpieza del runtime GUI

Al terminar la aplicación:

```text
desconectar handlers cuando corresponda
marcar sesión en cierre
cerrar/retirar recursos auxiliares
limpiar Maps
liberar referencias a Gtk.Settings mantenidas por CLRS
descartar estado themeName/themeMode/baselineThemeState
liberar referencias JS mantenidas por CLRS
permitir finalización de aplicación
```

No se exige liberar manualmente cada `GObject` cuando el binding/GTK administra su ownership, pero el runtime no debe conservar referencias innecesarias después de finalizar.

---

# 42. Terminación normal

El código de salida del proceso debe seguir el modelo existente de CLRS.

Una aplicación GUI que:

```text
abre ventana
se usa normalmente
cierra última ventana
```

debe terminar con estado exitoso salvo que haya ocurrido un error CLRS/runtime.

---

# 43. Detener código

El comando existente:

```text
CLRS.stopCode
```

debe seguir pudiendo terminar un programa GUI.

No se crea un comando paralelo:

```text
CLRS.stopGui
```

El `NodeProgramRunner` continúa siendo la autoridad sobre el proceso hijo.

Al detener:

```text
solicitar finalización
    ↓
si no responde
    ↓
terminar proceso según política existente
    ↓
limpiar temporal
```

---

# 44. Múltiples ventanas

La ejecución Node continúa activa mientras la aplicación posea ventanas abiertas según el ciclo de vida GTK.

Cerrar una ventana no termina el programa si quedan otras ventanas activas.

Esto debe funcionar para:

```text
Window
ApplicationWindow
```

---

# 45. Programa GUI sin ventana persistente

Un programa puede usar:

```text
FileDialog
AlertDialog
```

sin mantener después una ventana.

El runtime debe conservar la aplicación/loop durante la operación asincrónica y permitir que termine al completar la última operación y no existir ventanas.

Puede utilizar internamente los mecanismos de hold/release de `GApplication` si son necesarios.

---

# 46. `hold` y operaciones pendientes

GTK/GIO permite mantener una aplicación viva mediante un contador de uso.

Para operaciones GUI asincrónicas sin ventana persistente:

```text
iniciar operación
    ↓
application hold
    ↓
resolver/rechazar
    ↓
application release
```

es una estrategia válida.

La implementación debe evitar:

```text
proceso termina mientras FileDialog está abierto
```

---

# 47. Fallo de GTK durante ejecución

Un error nativo inesperado después del probe debe clasificarse como fallo de runtime GUI.

No debe provocar reinstalación automática de `node-gtk` dentro del mismo proceso de usuario.

La reparación de dependencia pertenece al inicio de la siguiente ejecución.

---

# 48. Seguridad

La instalación automática ejecuta código de instalación npm de un paquete externo.

Por ello:

```text
paquete fijado
versión fijada
registry npm normal
sin latest
sin scripts construidos por el usuario
sin specifier aportado por el programa CLRS
```

El usuario CLRS no puede cambiar:

```text
node-gtk version
npm package
install directory
```

desde el lenguaje.

---

# 49. Integridad

`package-lock.json` registra integridad y URLs resueltas de las dependencias npm.

La instalación privada debe conservar el lock generado.

No se debe editar manualmente su contenido para “arreglar” una instalación.

---

# 50. Sin dependencia del workspace

Supongamos que el proyecto del usuario tiene:

```text
mi-proyecto/
└── node_modules/
    └── node-gtk@otra-version
```

La ejecución CLRS debe seguir utilizando:

```text
<extensionRoot>/.runtime/packages/node_modules/node-gtk
```

versión:

```text
4.1.1
```

El workspace no tiene autoridad sobre el runtime interno de CLRS.

---

# 51. Sin dependencia global

Aunque exista:

```powershell
npm install -g node-gtk
```

CLRS no debe utilizarlo como resolución principal.

La instalación global puede tener:

```text
otra versión
otra ABI
otro GTK
```

y romper reproducibilidad.

---

# 52. Sin copia de código fuente en `src/`

No se copia `node-gtk` dentro de:

```text
src/
```

El código fuente de CLRS contiene:

```text
adaptador
catálogo
runtime GUI propio
```

pero no el binding externo.

---

# 53. Una sola fuente del runtime GUI

Debe existir una sola implementación lógica de:

```text
component registry
property adapters
event adapters
actions
theme adapter
validation
dialogs
lifecycle
```

El temporal de ejecución y la exportación consumen esa fuente.

La diferencia es únicamente la estrategia de dependencia:

```text
TEMPORAL
→ URL privada absoluta resuelta

EXPORTADO
→ dependencia npm local al proyecto
```

---

# 54. Interacción con `CompilationArtifact`

El artefacto debe poder incluir metadatos equivalentes a:

```js
{
    temporary: true,
    runtimeCapabilities: ["gui"],
    runtimeDependencies: {
        nodeGtk: {
            version: "4.1.1"
        }
    }
}
```

No es obligatorio usar exactamente esa estructura.

La finalidad es que el artefacto pueda describir sus necesidades sin que el runner vuelva a analizar el texto CLRS.

---

# 55. Orden correcto del pipeline

El orden normativo para ejecución GUI es:

```text
1. resolver fuente
2. parsear
3. construir AST
4. analizar semántica
5. si hay errores → terminar
6. detectar capability GUI
7. si no hay GUI → pipeline actual
8. comprobar Node
9. asegurar node-gtk
10. probe GTK
11. construir GuiRuntimeGenerationContext
12. generar JavaScript
13. emitir artefacto temporal
14. lanzar Node
15. inicializar la sesión GUI al primer uso, incluyendo `Gtk.Settings`
16. aplicar tema/modo sólo si el programa lo solicita
17. ejecutar y mantener el ciclo GTK
18. recoger salida/error
19. limpiar artefacto temporal y estado GUI
```

No debe instalarse `node-gtk` antes de saber si:

```text
el programa siquiera es válido
```

---

# 56. Por qué la instalación ocurre después de semántica

Si el usuario escribe:

```clrs
esto no es sintaxis válida
```

no tiene sentido descargar GTK.

Por ello:

```text
frontend + semántica
```

preceden al provisionamiento.

---

# 57. Por qué la instalación ocurre antes de generar el temporal

El JS temporal necesita conocer:

```text
entryUrl absoluto real de node-gtk
```

Por ello la dependencia debe estar validada antes de generar el artefacto ejecutable GUI.

---

# 58. No almacenar rutas absolutas en el AST

La ruta privada:

```text
file:///C:/...
```

no forma parte del AST ni del SemanticModel.

Pertenece a:

```text
contexto de generación
```

Esto evita contaminar consumidores como:

```text
diagramador
complejidad
navegación
hover
tests estáticos
```

---

# 59. No persistir la ruta en documentos CLRS

No se modifica el `.clrs`.

No se genera:

```clrs
IMPORTAR_GTK("C:/...")
```

La dependencia es invisible desde el lenguaje.

---

# 60. Logging técnico

El manager puede registrar en canal de desarrollo:

```text
GUI capability detected
Node 22.x validated
private runtime path
node-gtk 4.1.1 resolved
GTK 4.x probe passed
entry URL resolved
theme configuration applied (sólo si fue explícita)
```

No debe imprimir todo esto en la terminal normal del programa salvo que exista un error.

---

# 61. Experiencia de primera ejecución

La primera ejecución GUI puede requerir descarga.

Desde 1.9.6, `GuiRuntimeProgressPresenter` abre una sección de preparación
únicamente al comenzar instalación o reparación. Los hitos confirmados se
conservan ante error y no se duplican entre staging y publicación. Por ejemplo:

```text
● CLRS Runtime
────────────────────────────────────────────────────────────
Preparando entorno gráfico
Puedes cancelar con Ctrl+C.
✓ Plataforma compatible
⠋ Preparando dependencias
```

El spinner aparece después de 200 ms de espera y actualiza una misma línea
cada 80 ms. Antes de imprimir hitos, errores o cancelación se limpia la línea
y se liberan sus temporizadores. El cursor permanece visible. Fuera de TTY
se imprimen estados textuales sin animación ni ANSI; `NO_COLOR` desactiva el
color y permite animar cuando la salida es TTY.

La primitiva interna de barra sólo calcula porcentajes a partir de bytes
recibidos y un total fiable. El adaptador npm actual no entrega esos datos;
la instalación usa spinner y no anuncia porcentajes ni una descarga completada
sin evidencia. No se exponen logs npm ni credenciales del registry.

Tras publicar y revalidar el runtime, se muestra `✓ Entorno gráfico preparado`
y comienza la ejecución normal. El tiempo del JavaScript excluye toda esta
preparación; véase [compilación y ejecución](../language/compilation.md#presentación-de-terminal-y-tiempo-de-ejecución).

Una ejecución posterior no debe repetir el aviso si la dependencia ya está lista.

---

# 62. No instalar en activación de la extensión

Está prohibido:

```text
activate()
    ↓
npm install node-gtk
```

La mera instalación/activación de CLRS no debe descargar GTK.

El trigger es:

```text
ejecutar un programa válido que requiere GUI
```

---

# 63. No instalar al editar

Hover, diagnostics, completion y análisis documental pueden conocer la API GUI sin instalar `node-gtk`.

La biblioteca estándar GUI está disponible estáticamente.

---

# 64. Tests sin GUI

La suite general del lenguaje no debe requerir `node-gtk` para ejecutar pruebas que no utilizan GUI.

Una prueba que invoque cualquiera de:

```text
ESTABLECER_TEMA
OBTENER_TEMA
ESTABLECER_MODO_TEMA
OBTENER_MODO_TEMA
```

sí se considera GUI para efectos de runtime.

Esto es importante para:

```text
CI
tests unitarios
parser
semántica
complejidad
diagramador
```

---

# 65. Tests del manager

El dependency manager debe poder probarse mediante adaptadores falsos sin ejecutar npm real.

Ejemplo de escenarios:

```text
missing → install → ready
ready → no install
broken → reinstall → ready
broken → reinstall → fail
unsupported Node → fail before npm
cancelled → cleanup
concurrent ensure → one install
```

---

# 66. Tests de integración reales

Debe existir una suite separable que utilice realmente:

```text
Node
npm
node-gtk 4.1.1
GTK
```

y pueda omitirse cuando el entorno CI no ofrezca GUI.

Debe probar como mínimo:

```text
resolve package
load native binding
load Gtk 4.0
version >= 4.10
create Button
create Window/ApplicationWindow
connect clicked
read default Gtk.Settings without overwriting it
set/get gtk-theme-name
apply normalized theme mode
change theme after widget creation
process remains alive with window
process exits after last window
```

---

# 67. Headless CI

No debe suponerse que crear una GUI funcionará en un CI sin display server.

Separar:

```text
dependency probe
```

de:

```text
visual/window integration
```

permite ejecutar parte de la suite sin abrir ventanas cuando GTK lo permita.

Las pruebas que requieran display deben etiquetarse como integración de plataforma.

---

# 68. Compatibilidad Windows

La suite de Windows debe probar específicamente:

```text
ruta con espacios
ruta con caracteres no ASCII
file URL correcta
DLLs resueltas
Node 22
instalación privada
stopCode
```

Nunca concatenar rutas Windows manualmente dentro de imports.

---

# 69. Compatibilidad Linux

Debe comprobar:

```text
node-gtk instalado
GTK 4.10+ disponible
error útil si GTK falta
sin ejecución automática de sudo
```

---

# 70. Compatibilidad macOS

Debe comprobar:

```text
node-gtk instalado
GTK disponible
diagnóstico si falta
vida del proceso al abrir ventana
```

---

# 71. Actualización de CLRS

Una nueva versión de la extensión puede tener otra raíz:

```text
...clrs-kit-esp-1.9.0/
...clrs-kit-esp-1.10.0/
```

Por tanto la instalación privada anterior no se considera automáticamente compartida.

La nueva versión:

```text
detecta GUI
    ↓
provisiona su propio runtime privado cuando sea necesario
```

Esto evita incompatibilidades cruzadas.

---

# 72. Desinstalación

Como la instalación se encuentra bajo la raíz privada de la extensión, su eliminación puede acompañar a la eliminación de la extensión.

No se necesita un desinstalador global de `node-gtk`.

---

# 73. Cambio futuro de versión

Para actualizar:

```text
4.1.1 → otra versión
```

deben modificarse explícitamente:

```text
architecture.md
runtime-pipeline.md
javascript-export.md
manifest privado
tests de integración
```

y revisar:

```text
Node soportado
GTK incluido/requerido
bootstrap ESM
binarios
API GI
```

No se actualiza silenciosamente al iniciar CLRS.

---

# 74. Pseudocódigo del caso de uso

```js
async function runClrsProgram(request) {
    const analysis =
        await compilationService.analyze(
            request.source,
            request.path
        );

    if (!analysis.ok) {
        return analysis.failure;
    }

    const requirements =
        runtimeRequirementDetector.detect(
            analysis.ast,
            analysis.semanticModel
        );

    let runtimeContext = {};

    if (requirements.gui) {
        const gtk =
            await nodeGtkDependencyManager.ensure({
                signal: request.signal
            });

        runtimeContext.gui = {
            enabled: true,
            nodeGtkVersion: gtk.version,
            nodeGtkEntryUrl: gtk.entryUrl,
            gtkVersion: gtk.gtkVersion
        };
    }

    const artifact =
        compilationService.generate({
            ast: analysis.ast,
            semanticModel: analysis.semanticModel,
            runtimeContext,
            temporary: true
        });

    const emitted =
        await fileSystemEmitter.writeArtifact(
            artifact
        );

    try {
        return await nodeProgramRunner.run(
            emitted,
            request
        );
    } finally {
        await emitted.cleanup();
    }
}
```

Es conceptual; no obliga a cambiar las APIs actuales de `CompilationService`.

---

# 75. Pseudocódigo de `ensure()`

```js
async function ensureNodeGtk() {
    validateSupportedNode();

    const cached = getValidatedCache();

    if (cached) {
        return cached;
    }

    return singleFlight(async () => {
        const resolved =
            await tryResolveAndProbe();

        if (resolved.ok) {
            return resolved.value;
        }

        if (resolved.kind === "native-gtk-missing") {
            throw nativeGtkDiagnostic();
        }

        await installOrRepair();

        const afterInstall =
            await tryResolveAndProbe();

        if (!afterInstall.ok) {
            throw dependencyDiagnostic(
                afterInstall
            );
        }

        return afterInstall.value;
    });
}
```

---

# 76. Pseudocódigo de resolución

```js
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

function resolveNodeGtk(
    privatePackageJsonPath
) {
    const privateRequire =
        createRequire(
            pathToFileURL(
                privatePackageJsonPath
            )
        );

    const entryPath =
        privateRequire.resolve(
            "node-gtk"
        );

    return {
        entryPath,
        entryUrl:
            pathToFileURL(
                entryPath
            ).href
    };
}
```

El código real debe manejar:

```text
package exports
errores de resolución
Windows
symlinks
```

sin asumir subdirectorios del paquete.

---

# 77. Pseudocódigo de generación

```js
function generateGuiBootstrap(context) {
    if (!context.gui?.enabled) {
        return "";
    }

    return `
const __clrsNodeGtkEntry =
    ${JSON.stringify(
        context.gui.nodeGtkEntryUrl
    )};

const __clrsNodeGtkModule =
    await import(
        __clrsNodeGtkEntry
    );

// NodeGtkBridge normaliza aquí
// la superficie pública de 4.1.1.
//
// GuiThemeAdapter forma parte del
// runtime GUI canónico y obtiene
// Gtk.Settings sólo al utilizarse.
`;
}
```

El runtime GUI real se incorpora después del bootstrap.

---

# 78. Invariantes del pipeline

La implementación se considera incorrecta si viola cualquiera de estas reglas:

1. Un programa sin GUI instala `node-gtk`.
2. Un programa sin GUI importa `node-gtk`.
3. La instalación ocurre al activar la extensión.
4. La detección de GUI se hace mediante regex.
5. `node-gtk` se instala globalmente.
6. Se utiliza `NODE_PATH`.
7. Se utiliza el `node_modules` del workspace.
8. Se codifica una ruta interna de `node-gtk`.
9. El generador conoce directamente `vscode`.
10. La ruta absoluta se almacena en el AST.
11. La ruta absoluta se escribe en el `.clrs`.
12. Se utiliza `node-gtk@latest`.
13. Se permite una versión de Node no validada y se compila nativamente en silencio.
14. CLRS ejecuta `apt`, `dnf`, `pacman`, `brew` o `sudo`.
15. Un fallo de instalación deja el runtime marcado `READY`.
16. Varias ejecuciones instalan npm simultáneamente en la misma carpeta.
17. El JS temporal necesita un segundo `GuiRuntime.js`.
18. El programa recibe objetos GTK.
19. Se reutiliza un ejemplo legacy de GTK 3 como contrato del runtime actual sin prueba.
20. El proceso termina mientras todavía existe una ventana GUI válida.
21. `CLRS.stopCode` deja de poder finalizar una aplicación GUI.
22. La ejecución GUI evita `CompilationService`/`NodeProgramRunner` mediante un pipeline paralelo.
23. El runtime impone un tema aunque el programa no llame funciones de tema.
24. La implementación extrae colores de VS Code para construir una paleta GTK.
25. `ESTABLECER_TEMA` se implementa como CSS propio en lugar de delegar el tema a GTK.
26. El modo claro/oscuro eleva silenciosamente el mínimo GTK por encima de 4.10.
27. El cambio de tema obliga a recrear manualmente todos los widgets.
28. La lógica de temas del temporal diverge de la utilizada por la exportación.

---

# 79. Criterios de aceptación

## Caso A — programa convencional

Fuente:

```clrs
PRINCIPAL()
    escribir "Hola"
```

Resultado:

```text
no detecta GUI
no crea .runtime si no existe
no ejecuta npm
no resuelve node-gtk
genera JS convencional
ejecuta mediante NodeProgramRunner
```

---

## Caso B — primera ejecución GUI

Fuente:

```clrs
PRINCIPAL()
    BOTON(
        "x",
        "Aceptar"
    )
```

Resultado:

```text
análisis válido
detecta GUI
comprueba Node
no encuentra dependencia
crea runtime privado
instala node-gtk 4.1.1
genera lock
resuelve paquete
probe OK
genera un solo JS temporal
ejecuta
```

---

## Caso C — segunda ejecución GUI

Resultado:

```text
detecta GUI
valida caché/runtime
no reinstala npm
genera temporal
ejecuta
```

---

## Caso D — instalación corrupta

Resultado:

```text
resolve/probe falla
manager marca BROKEN
reparación automática una vez
probe vuelve a ejecutarse
READY o error estable
```

---

## Caso E — Linux sin GTK

Resultado:

```text
node-gtk puede estar instalado
probe GTK falla
no ejecuta sudo
no ejecuta apt/dnf/pacman
explica que falta GTK 4.10+
```

---

## Caso F — Node incompatible

Resultado:

```text
falla antes de npm
informa majors soportados
recomienda Node 22
```

---

## Caso G — ruta Windows

Instalación:

```text
C:\Users\José Pérez\.vscode\extensions\...
```

Resultado:

```text
resolver obtiene entry
pathToFileURL produce URL válida
import funciona
```

---

## Caso H — vida de la GUI

Fuente:

```clrs
PRINCIPAL()
    VENTANA_APLICACION(
        "principal",
        "Hola"
    )

    MOSTRAR(
        "principal"
    )
```

Resultado:

```text
PRINCIPAL retorna
Node sigue vivo
ventana responde
usuario cierra ventana
Node termina correctamente
```

---

## Caso I — detener

Con ventana abierta:

```text
CLRS.stopCode
```

Resultado:

```text
se termina el proceso activo
se limpia temporal
no queda proceso GTK huérfano
```


---

## Caso J — tema predeterminado

Fuente:

```clrs
PRINCIPAL()
    VENTANA_APLICACION(
        "principal",
        "Aplicación"
    )

    MOSTRAR(
        "principal"
    )
```

Resultado:

```text
se inicializa GTK
se obtiene Settings cuando sea necesario
CLRS no sobrescribe gtk-theme-name
CLRS no impone modo claro/oscuro
no se genera CSS de paleta
GTK conserva la configuración del entorno
```

---

## Caso K — tema explícito

Fuente:

```clrs
PRINCIPAL()
    ESTABLECER_TEMA(
        "Adwaita"
    )

    VENTANA_APLICACION(
        "principal",
        "Aplicación"
    )

    MOSTRAR(
        "principal"
    )
```

Resultado:

```text
la llamada activa capability GUI
Gtk.Settings se obtiene de forma interna
gtk-theme-name se configura
themeName de sesión se actualiza
no se exponen objetos Settings a CLRS
```

---

## Caso L — modo de tema

Fuente:

```clrs
PRINCIPAL()
    ESTABLECER_MODO_TEMA(
        "oscuro"
    )
```

Resultado:

```text
"oscuro" se normaliza
el backend utiliza una capacidad compatible con GTK 4.10
el estado inicial queda disponible para volver a "sistema"
no se requiere una API introducida después de GTK 4.10
```

---

## Caso M — cambio en caliente

Secuencia:

```text
crear ventana
mostrar ventana
ESTABLECER_TEMA(...)
```

Resultado:

```text
el runtime modifica Gtk.Settings
no destruye/recrea componentes
GTK recalcula la apariencia según su sistema de estilos
el registro de IDs permanece intacto
```

---

# 80. Archivos y responsabilidades sugeridas

La implementación puede adaptar nombres, pero una división coherente sería:

```text
src/
├── standard-library/
│   └── gui/
│       ├── GuiCatalog.js
│       ├── GuiRuntime.js
│       ├── GuiThemeAdapter.js
│       └── index.js
│
├── compiler/
│   ├── runtime/
│   │   └── RuntimeRequirementDetector.js
│   └── ...
│
└── application/
    └── ports/
        └── RuntimeDependencyPort.js

extension/
├── adapters/
│   ├── NpmProcessAdapter.js
│   └── NodeGtkDependencyAdapter.js
│
└── runtime/
    ├── PrivateRuntimeLayout.js
    ├── NodeGtkResolver.js
    └── NodeGtkProbe.js
```

No es obligatorio introducir todos estos archivos si la arquitectura actual dispone de ubicaciones más apropiadas.

Lo obligatorio es conservar responsabilidades y dirección de dependencias.

---

# 81. Relación con otros documentos

```text
architecture.md
    ↓
define fronteras e invariantes

api-catalog.md
    ↓
define qué funciones activan GUI,
incluida configuración global de tema,
y qué runtime necesitan

runtime-pipeline.md
    ↓
define cómo se prepara y ejecuta

javascript-export.md
    ↓
define el modo portable,
sin ruta absoluta
```

Este documento tiene autoridad sobre:

```text
detección de runtime
instalación privada
autorrevisión
resolución
probe
JS temporal
ciclo de ejecución GUI
aplicación de tema durante ejecución
```

---

# 82. Referencias técnicas

### CLRS

La arquitectura vigente debe seguir considerando:

```text
LanguageFrontend
SemanticAnalyzer
JavaScriptGenerator
CompilationArtifact
FileSystemEmitter
NodeProgramRunner
StandartLibrary.js
```

como parte del pipeline convencional.

### node-gtk

- npm: <https://www.npmjs.com/package/node-gtk>
- repositorio: <https://github.com/romgrk/node-gtk>

### Node.js

- ESM: <https://nodejs.org/api/esm.html>
- Modules: <https://nodejs.org/api/modules.html>
- `module`: <https://nodejs.org/api/module.html>
- URL: <https://nodejs.org/api/url.html>
- Child process: <https://nodejs.org/api/child_process.html>

### npm

- install: <https://docs.npmjs.com/cli/commands/npm-install>
- ci: <https://docs.npmjs.com/cli/commands/npm-ci>
- package-lock: <https://docs.npmjs.com/cli/configuring-npm/package-lock-json>

### GTK

- GTK 4: <https://docs.gtk.org/gtk4/>
- `Gtk.Settings`: <https://docs.gtk.org/gtk4/class.Settings.html>
- `Gtk.Settings:gtk-theme-name`: <https://docs.gtk.org/gtk4/property.Settings.gtk-theme-name.html>
- `Gtk.Application`: <https://docs.gtk.org/gtk4/class.Application.html>
- `Gtk.Application.add_window`: <https://docs.gtk.org/gtk4/method.Application.add_window.html>
- `Gtk.Window:application`: <https://docs.gtk.org/gtk4/property.Window.application.html>
- `Gio.Application`: <https://docs.gtk.org/gio/class.Application.html>
- `Gio.Application.run`: <https://docs.gtk.org/gio/method.Application.run.html>

---

# 83. Resumen normativo

El pipeline definitivo queda:

```text
                  PROGRAMA CLRS
                       │
                       ▼
             FRONTEND + SEMÁNTICA
                       │
                       ▼
             DETECTOR DE CAPACIDAD
                       │
              ┌────────┴────────┐
              │                 │
          SIN GUI             CON GUI
              │                 │
              │          comprobar Node
              │                 │
              │         ensure node-gtk
              │                 │
              │           probe GTK
              │                 │
              └────────┬────────┘
                       ▼
             JAVASCRIPT GENERATOR
                       │
                       ▼
            UN ARTEFACTO TEMPORAL
                       │
                       ▼
                NodeProgramRunner
                       │
                       ▼
                   Node.js
                       │
                si usa GUI
                       │
                       ▼
        node-gtk privado 4.1.1
                       │
                       ▼
                    GTK 4
                 ┌─────┴─────┐
                 │           │
           componentes   Gtk.Settings
                              │
                       tema sólo si
                     el programa lo pide
```

La regla central es:

> **La GUI amplía el pipeline de ejecución existente mediante una dependencia nativa privada y perezosa; no crea un pipeline paralelo, no convierte `node-gtk` en una dependencia obligatoria para todos los programas CLRS y deja la apariencia general en manos del sistema de temas de GTK salvo configuración explícita del programa.**
