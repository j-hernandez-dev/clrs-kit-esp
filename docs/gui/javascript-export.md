# Exportación JavaScript y proyectos ejecutables CLI/GUI

**Estado:** contrato normativo vigente  
**Ámbito:** comando **Generar código JavaScript**  
**Runtime CLI:** Node.js compatible  
**Runtime GUI:** GTK 4 mediante `node-gtk@4.1.1`  
**Empaquetador:** `@yao-pkg/pkg@^6.22.0`  

Este documento define el resultado observable para quien exporta un programa.
El perfil CLI y su evidencia se detallan en
[Exportación CLI compilable](../language/cli-executable-export.md). El diseño
del loader, bootstrap y runtime gráfico se detalla en
[Exportación GUI a ejecutable portable](portable-executable-export.md).

## 1. Dos recorridos independientes

La ejecución administrada por CLRS y la exportación permanente comparten el
runtime generado, pero no sus dependencias ni sus rutas:

```text
Ejecutar / depurar / probar
→ artefacto temporal privado
→ Node y node-gtk administrados por CLRS
→ limpieza automática

Generar código JavaScript
→ proyecto fuente bajo app/
→ perfil CLI de tres archivos o perfil GUI de cinco archivos
→ sin rutas al runtime privado de CLRS
```

La preparación para `pkg` no participa en la ejecución temporal. La exportación
genera el lock, pero no instala módulos ni ejecuta el programa. Tampoco copia
la instalación privada de `node-gtk`.

| Perfil | Proyecto inicial | Entrada de `pkg` | Preparación del build |
|---|---|---|---|
| CLI | JavaScript + `package.json` + `package-lock.json` | `<programa>.js` | `pkg` directo, sin GTK ni helpers |
| GUI | JavaScript + manifest + lock + dos helpers | `bootstrap.cjs` | `prepare-packable.cjs` genera el packable antes de `pkg` |

## 2. Identidad y raíz de salida

Todas las exportaciones permanentes del comando usan una identidad canónica
derivada del nombre del documento y se escriben en:

```text
app/<programa>/
```

La normalización elimina acentos, convierte a minúsculas, sustituye caracteres
no portables por guiones, evita nombres reservados de Windows y proporciona un
fallback estable. La carpeta, el entry, los scripts y la salida del build
proceden de esa misma identidad. Sólo GUI deriva además nombres packable. La
clave interna utilizada por los temporales nunca forma parte de los nombres
públicos.

`app` contiene proyectos fuente exportados. El directorio `dist` que puede
aparecer dentro de uno de esos proyectos contiene únicamente el resultado de
un build solicitado después por el usuario.

## 3. Perfil CLI: programa sin GUI

La necesidad de GUI se obtiene de
`semanticModel.gui.usage.requiresGui`; nunca se infiere buscando nombres en el
texto o en el JavaScript generado. Cuando es falsa, el resultado inicial es:

```text
app/<programa>/
├── <programa>.js
├── package.json
└── package-lock.json
```

Son exactamente tres archivos iniciales. El JavaScript es simultáneamente la
fuente normal, la entrada de `npm start` y la entrada de `pkg`. No se crean
`node-gtk`, helpers, `node_modules`, `*.packable.js`, `bin/` ni `dist/`.
La exportación invoca npm sólo para producir y validar el lock sin instalar.

## 4. Perfil GUI

Cuando la capacidad semántica GUI está presente, se publica atómicamente:

```text
app/<programa>/
├── <programa>.js
├── prepare-packable.cjs
├── bootstrap.cjs
├── package.json
└── package-lock.json
```

Son exactamente cinco archivos iniciales. No forman parte de la exportación
inicial:

```text
node_modules/
<programa>.packable.js
bin/
dist/
```

`<programa>.js` es ESM normal, legible y ejecutable por Node. Contiene el
runtime estándar y GUI generado, las decisiones explícitas de tema escritas en
CLRS y el programa transpilado. No contiene rutas absolutas a la extensión.

## 5. Flujo normal desde código fuente

El recorrido habitual continúa siendo:

```text
Generar código JavaScript
→ abrir app/<programa>/
→ npm ci
→ npm start
```

`npm start` ejecuta directamente:

```text
node ./<programa>.js
```

No pasa por `bootstrap.cjs`, no genera la variante packable y no crea `bin/` o
`dist/`. En CLI tampoco existe ese bootstrap. Una vez exportado el proyecto,
CLRS y VS Code no son necesarios para este recorrido. CLI sólo requiere un
Node compatible; GUI requiere además GTK 4.10 o superior y sus bibliotecas del
sistema.

## 6. Manifests y lockfiles

El manifest CLI tiene esta forma:

```json
{
  "name": "programa",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "bin": "./programa.js",
  "scripts": {
    "start": "node ./programa.js",
    "build:win": "pkg . --targets host --output ./dist/programa.exe",
    "build:unix": "pkg . --targets host --output ./dist/programa"
  },
  "engines": {
    "node": ">=22 <23 || >=24 <25 || >=26 <27"
  },
  "devDependencies": {
    "@yao-pkg/pkg": "^6.22.0"
  }
}
```

No contiene `dependencies`, `allowScripts` ni `pkg.assets`. En particular, no
declara `node-gtk`, bootstrap, preparador o variante packable.

El manifest GUI añade su infraestructura especializada:

```json
{
  "name": "programa",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "bin": "./bootstrap.cjs",
  "scripts": {
    "start": "node ./programa.js",
    "build:win": "node ./prepare-packable.cjs && pkg . --targets host --output ./dist/programa/programa.exe",
    "build:unix": "node ./prepare-packable.cjs && pkg . --targets host --output ./dist/programa/programa"
  },
  "engines": {
    "node": ">=22 <23 || >=24 <25 || >=26 <27"
  },
  "dependencies": {
    "node-gtk": "4.1.1"
  },
  "allowScripts": {
    "node-gtk@4.1.1": true
  },
  "devDependencies": {
    "@yao-pkg/pkg": "^6.22.0"
  },
  "pkg": {
    "assets": [
      "node_modules/node-gtk/lib/binding/**/*",
      "programa.packable.js"
    ]
  }
}
```

La autorización GUI está restringida a `node-gtk@4.1.1`. No se usa una aprobación
genérica, `dangerously-allow-all-scripts`, configuración global de npm,
`.npmrc` generado ni un `postinstall` propio.

`package.json` se escribe antes del lock. `package-lock.json` lo genera npm con
una operación equivalente a:

```text
npm install --package-lock-only --ignore-scripts --include=dev
```

La exportación no ejecuta el install. Antes de publicar, cada perfil aplica su
validador estricto. CLI exige un grafo de desarrollo cerrado para `pkg` y
prohíbe residuos GUI. GUI valida además `node-gtk@4.1.1`, URLs HTTPS,
integridades y ausencia de enlaces o rutas locales. El usuario ejecuta después
un `npm ci` real; sólo GUI prepara el binding autorizado.

## 7. Construcción del ejecutable por perfil

Después de `npm ci`, el usuario construye en la plataforma destino:

```text
Windows → npm run build:win
Linux   → npm run build:unix
macOS   → npm run build:unix
```

Ambos perfiles usan `--targets host`; no realizan cross-compilation. CLI
construye directamente desde su JavaScript y produce:

```text
app/<programa>/dist/<programa>.exe   # Windows
app/<programa>/dist/<programa>       # Linux/macOS
```

El ejecutable CLI integra su runtime Node. El usuario final no necesita Node
para abrir el binario ya construido. Conserva stdin, stdout, stderr, argumentos
y códigos de salida, y no extrae archivos GTK al ejecutarse.

GUI produce:

```text
app/<programa>/dist/<programa>/<programa>.exe   # Windows
app/<programa>/dist/<programa>/<programa>       # Linux/macOS
```

El build ejecuta primero `prepare-packable.cjs`. Ese helper lee siempre el
entry normal, valida el protocolo GUI y genera de forma determinista:

```text
<programa>.packable.js
```

El entry normal no se modifica. La variante adapta únicamente los imports
generados y la carga de `node-gtk` al contexto CommonJS del bootstrap; exige el
loader del ejecutable y no intenta resolver el binding dentro del snapshot.

`pkg` usa `bootstrap.cjs` como entrada. El manifest incluye como assets el
binding nativo y la variante packable.

## 8. Primera y siguientes ejecuciones del portable GUI

El ejecutable debe poder copiarse como archivo aislado fuera del proyecto.
Durante su primer arranque, `bootstrap.cjs`:

1. valida plataforma, arquitectura y ABI de Node;
2. localiza en el snapshot el binding y los typelibs empaquetados;
3. materializa un runtime físico confinado junto al ejecutable;
4. configura las variables GTK/GI con rutas físicas;
5. redirige únicamente la carga de `node_gtk.node` esperada;
6. registra el loader global antes de iniciar el packable;
7. ejecuta el programa.

El layout resultante es conceptual:

```text
<directorio-del-ejecutable>/
├── <programa>[.exe]
└── bin/
    └── node-v<ABI>-<plataforma>-<arquitectura>/
        ├── .<programa>-runtime
        ├── node_gtk.node
        └── recursos GI/GTK empaquetados
```

Un segundo arranque reutiliza el runtime sólo si el marcador, el addon, los
typelibs y la identidad completa coinciden. Un runtime incompleto se repara por
medio de staging; no se acepta silenciosamente.

## 9. Plataforma, recursos y límites reales

La instalación nativa y el build corresponden al host:

```text
Windows → construir en Windows
Linux   → construir en Linux
macOS   → construir en macOS
```

No se promete que un artefacto construido en un sistema funcione en otro. CLI
no necesita GTK. La distribución GUI incorpora el binding npm y los typelibs
encontrados, pero no instala paquetes del sistema. Linux y macOS pueden seguir
necesitando GTK 4, GLib y bibliotecas dinámicas compatibles. CLRS no ejecuta
`apt`, `dnf`, `brew` ni otro gestor del sistema.

Los recursos externos del programa —imágenes, plantillas, configuración o
datos— no se incluyen automáticamente en el ejecutable. Deben distribuirse en
las rutas que utilice el programa o declararse explícitamente cuando exista un
contrato de assets. Un archivo creado o leído durante la ejecución no se vuelve
un asset embebido por ese solo hecho.

La evidencia nativa actual certifica Windows x64, Node 24.16.0, ABI 137,
`node-gtk@4.1.1`, `@yao-pkg/pkg@6.22.0` y GTK 4.22.4. Linux y macOS están
declarados en un workflow manual opt-in, pero no cuentan aún con evidencia real
equivalente en este repositorio.

## 10. Transacción, cancelación y seguridad

Cada exportación es una unidad indivisible:

```text
identidad y rutas validadas
→ lock por proyecto
→ staging hermano
→ tres archivos CLI o cinco archivos GUI
→ generación y validación del lock
→ validación completa
→ publicación por rename
```

Un fallo o una cancelación elimina staging y lock sin publicar una unidad
parcial. Si ya existe una exportación válida, se mueve a un respaldo y se
restaura si falla la publicación. Los cambios del usuario en el respaldo no se
borran automáticamente.

Los artefactos generados no deben contener rutas al workspace, `.runtime/`,
`extensionRoot`, credenciales, `NODE_PATH` ni una instalación global o privada
de `node-gtk`. El bootstrap no intercepta addons arbitrarios y confina toda
extracción a su directorio administrado.

## 11. Invariantes

- La detección GUI es semántica.
- Un proyecto CLI contiene tres archivos iniciales y usa npm sólo para el lock.
- Un proyecto GUI contiene cinco archivos iniciales.
- `npm start` siempre usa el JavaScript normal.
- CLI construye directamente desde ese JavaScript y nunca genera packable.
- GUI deriva el packable sin modificar la fuente limpia.
- `node-gtk` permanece fijado exactamente a `4.1.1`.
- El lock lo genera npm sin ejecutar scripts durante la exportación.
- `app` es fuente; `dist` es resultado de build.
- Los scripts construyen sólo para `host`.
- Ninguna ruta del runtime privado de CLRS sobrevive en el proyecto.

## 12. Validación y evidencias

Las comprobaciones CLI deterministas son:

```powershell
npm run test:cli:export-architecture
npm run test:cli:export-corpus
```

Los ensayos CLI opt-in con npm o `pkg` reales son:

```powershell
npm run test:cli:lock:native
npm run test:cli:install:native
npm run test:cli:build:native
```

La evidencia local actual de instalación y build corresponde a Windows x64
con Node 24. Linux y macOS están declarados como matrices manuales, pero aún no
tienen evidencia equivalente conservada.

Las comprobaciones deterministas, sin red ni GTK, son:

```powershell
npm run test:gui:export
npm run test:gui:packable
npm run test:gui:prepare-packable
npm run test:gui:bootstrap
npm run test:gui:portable-manifest
npm run test:gui:portable-corpus
```

Los ensayos opt-in que sí usan npm o GTK reales son:

```powershell
npm run test:gui:portable-lock:native
npm run test:gui:portable-install:native
npm run test:gui:portable-build:native
```

La evidencia de instalación y arranque normal está en
`test/fixtures/gui/export.win32-x64.node24.json`; la evidencia del ejecutable,
extracción inicial y reutilización está en
`test/fixtures/gui/portable-build.win32-x64.node24.json`.

Estas pruebas verifican integración y comportamiento observable. No garantizan
apariencia idéntica entre temas, disponibilidad de todos los runtimes GTK ni
portabilidad binaria entre plataformas.
