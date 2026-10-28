# Aceptación y publicación GUI

La entrega 1.9.6 conserva el cierre de los bloques 1–14 de implementación. El contrato vigente
es el [catálogo GUI](api-catalog.md); el corpus verifica su integración con el
resto de CLRS. El cierre de implementación no certifica combinaciones nativas
que no se hayan ejecutado.

Para la exportación vigente, el contrato operativo es
[Exportación JavaScript y proyecto GUI portable](javascript-export.md): `app`
contiene el proyecto fuente y su `dist` interno aparece únicamente después de
`build:win` o `build:unix`.

## Corpus reproducible

[`acceptance-corpus.v1.json`](../../test/fixtures/gui/acceptance-corpus.v1.json)
declara diez áreas: contrato/semántica, entorno privado, controles/runtime,
eventos/diálogos, depuración, editor/diagramador, costos, pruebas/BROKER.95,
exportación y regresiones multiplataforma.

`test/gui.corpus.test.js` recorre el grafo de scripts de `release:check`,
incluidos prehooks, y comprueba que cada evidencia se ejecute realmente. Los
escenarios CLRS de consola, símbolos homónimos, contención, eventos y
cancelación atraviesan parser, semántica, generación y procesos Node reales.
Se prueban LF/CRLF, rutas con espacios, caracteres no ASCII y `#`, y resolución
del binding mediante URL privada o paquete local. GTK se sustituye por dobles
explícitos en esta suite.

```powershell
npm run test:gui:corpus
npm run release:check
```

El segundo comando incluye corpus generales, GUI, BROKER.95, lint, build y
Extension Host. Las pruebas puras no requieren bibliotecas GTK instaladas.
`.github/workflows/integral-corpus.yml` declara Windows/Linux/macOS con Node
22/24/26. Declarar la matriz no significa que ya se haya ejecutado remotamente.

## Aceptación nativa

```powershell
npm run test:gui:corpus:native
npm run test:gui:debug:native
node scripts/gui/validate-schema-repair.mjs
npm run test:gui:portable-install:native -- test/fixtures/gui/export.win32-x64.node24.json
npm run test:gui:portable-build:native -- test/fixtures/gui/portable-build.win32-x64.node24.json
```

Los ensayos nativos son opt-in. El corpus instala y reutiliza node-gtk privado
en un directorio de prueba dentro de `.runtime/`, valida GTK/GSettings, ejecuta
controles, eventos y FileDialog en procesos hijos con tiempo límite y retira la
instalación aislada. La reparación de schemas es un ensayo específico de Windows.
Ninguno administra paquetes del sistema.

El exportador se valida con un lock real: se traslada el proyecto, se elimina
el origen y se ejecuta `npm ci` sin ignorar scripts. El ensayo rechaza avisos de
install bloqueado, comprueba el binding ABI de `node-gtk@4.1.1`, el CLI de
`@yao-pkg/pkg`, la inmutabilidad del lock y luego ejecuta `npm start` y el entry
directamente desde otro directorio. `npm start` no pasa por bootstrap, no
genera la variante packable y no crea `dist/` ni `bin/`. La comprobación DAP
cubre entrada/salida de callbacks, variables, espera de FileDialog, pausa y
terminación.

El build portable permanece en un smoke test distinto. Construye sólo para el
host, copia el ejecutable fuera del proyecto y elimina fuentes y `node_modules`.
El primer arranque debe extraer addon y typelibs junto al ejecutable; el segundo
debe reutilizar exactamente el mismo árbol. El workflow manual
`portable_build_native` ofrece una matriz Windows/Ubuntu/macOS Node 24 sin
convertirla en gate normal de publicación.

En CI, la entrada manual `gui_native` permite ejecutar este conjunto sobre
Windows x64 con Node 24. Los informes registran las versiones efectivamente
encontradas; las bibliotecas GTK externas de Linux/macOS requieren un entorno
adecuado antes de ejecutar estos ensayos.

## Evidencia y límites

| Alcance | Evidencia |
|---|---|
| Instalación privada, reutilización, ventanas, controles, eventos y FileDialog reales en Windows x64 | [acceptance.win32-x64.node24.json](../../test/fixtures/gui/acceptance.win32-x64.node24.json) |
| Instalación npm autónoma, binding, CLI `pkg`, arranque normal y equivalencia con GTK real | [export.win32-x64.node24.json](../../test/fixtures/gui/export.win32-x64.node24.json) |
| Build `pkg`, ejecutable aislado, extracción y reutilización en Windows x64 | [portable-build.win32-x64.node24.json](../../test/fixtures/gui/portable-build.win32-x64.node24.json) |
| DAP con GTK real | [debug.win32-x64.node24.json](../../test/fixtures/gui/debug.win32-x64.node24.json) |
| Detección de copia dañada y reparación privada de schemas | [schema-repair.win32-x64.node24.json](../../test/fixtures/gui/schema-repair.win32-x64.node24.json) |
| Matriz de requisitos e implementación | [contract-traceability.v1.json](../../test/fixtures/gui/contract-traceability.v1.json) |
| Resultado del cierre, contenido del VSIX, ejecución del CLI empaquetado y SHA-256 | [release-1.9.0.json](../../test/fixtures/gui/release-1.9.0.json) |

Los ensayos locales nativos utilizan Windows x64, Node 24.16.0, node-gtk
4.1.1 y GTK 4.22.4. La apertura y cancelación de las cinco operaciones de
FileDialog se verifican realmente. La selección interactiva de una ruta,
la apariencia visual, GTK exactamente 4.10 y la ejecución nativa en otras
plataformas/arquitecturas/versiones permanecen fuera de esa evidencia.
En particular, Linux y macOS pueden necesitar GTK 4, GLib y bibliotecas
dinámicas instaladas por el sistema; CLRS no ejecuta gestores de paquetes para
proporcionarlas.

## Artefacto publicable

El procedimiento general es [Build, VSIX y publicación](../development/release.md).
La distribución incluye bundles, frontend y recursos declarativos; excluye
`docs/`, `test/`, `.runtime/`, fuentes y dependencias de desarrollo.
node-gtk permanece fuera del VSIX y del manifest raíz.

La preparación del VSIX no sube automáticamente la extensión al Marketplace.
La publicación remota es un paso posterior del mantenedor.

El cierre local pasó el gate completo: 1,578 ejecuciones de pruebas Node en
18 grupos de comandos (algunas repetidas), incluidas 1,103 pruebas de la suite
principal y 97 previas, más 25 pruebas del Extension Host. El build pasó y lint
conservó seis advertencias preexistentes sin errores. Vite y vsce mantuvieron
sus avisos de tamaño/cantidad de chunks del frontend.

El VSIX contiene 201 entradas y mide 10,111,111 bytes. Se extrajo en una carpeta
aislada y su CLI empaquetado ejecutó consola y nombres homónimos sin crear
runtime GUI; después instaló su dependencia privada y ejecutó un callback de
cierre con GTK real. La copia, staging y locks se limpiaron.
