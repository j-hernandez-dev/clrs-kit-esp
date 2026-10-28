# Exportación portable — instalación y ejecución normal

## Contrato de salida

`Generar código JavaScript` toma la decisión desde la capacidad semántica
`gui`. Un programa de consola conserva un único archivo bajo `app/<programa>/`
y no invoca npm. Un programa GUI publica exactamente el entry normal,
`prepare-packable.cjs`, `bootstrap.cjs`, `package.json` y `package-lock.json`.

El proyecto GUI declara `node-gtk@4.1.1`, autoriza únicamente su install script,
incluye `@yao-pkg/pkg@^6.22.0` para el build posterior y fija `npm start`
directamente al entry normal. El lockfile se produce en staging sin ejecutar
scripts, se valida antes de publicar y no admite enlaces, rutas locales,
credenciales ni rutas privadas del runtime de la extensión.

## Validación automatizada

`test/portable.export.corpus.test.js` cubre sin red ambas ramas, nombres,
estructura, arranque normal, preparación y atomicidad. El ensayo nativo se
mantiene separado para que el cierre determinista no dependa del registro npm
ni de GTK.

## Ensayo nativo

La evidencia `export.win32-x64.node24.json` corresponde a Windows x64, Node
24.16.0, ABI 137, npm 11.13.0, `node-gtk` 4.1.1, `@yao-pkg/pkg` 6.22.0 y GTK
4.22.4. Exportó el proyecto en una carpeta temporal, lo trasladó fuera del
origen y ejecutó un `npm ci` real. La salida no clasificó el install de
`node-gtk` como bloqueado; el binding `node-v137-win32-x64/node_gtk.node` y el
CLI `pkg` quedaron disponibles y el lock no cambió.

Después, `npm start` ejecutó exclusivamente el entry normal. No se creó la
variante packable, `dist/` ni `bin/`, y los helpers y fuentes permanecieron
intactos. También se ejecutó el entry desde otro directorio y se comparó su
salida con una ejecución equivalente que usa el binding administrado por CLRS.
Todos los temporales se eliminaron al finalizar.

No certifica otras plataformas o ABI, GTK exactamente 4.10, apariencia visual,
interacción manual ni selección de archivos. Esta evidencia concreta tampoco
construye con `pkg` ni valida la extracción/reutilización de `bin/`; esas
comprobaciones están separadas en
`portable-build.win32-x64.node24.json` para no confundir `npm start` con el
recorrido de distribución.
