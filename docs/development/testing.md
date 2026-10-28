# Pruebas del repositorio

El corpus incorpora la biblioteca GUI como área obligatoria. Su matriz,
regresiones multiplataforma y ensayos opt-in están delimitados en
[aceptación GUI](../gui/acceptance.md). `npm run test:gui:corpus` ejecuta
el cruce de capas sin GTK instalado; `npm run test:gui:corpus:native`
comprueba la instalación privada y los componentes con GTK real.

## Pruebas del repositorio

El repositorio contiene pruebas `*.test.js`, fixtures CLRS y corpus JSON versionados. Estas pruebas del código fuente no deben confundirse con las suites `*.clrs-tests.json` que los usuarios ejecutan desde el Test Explorer.

| Capa de validación | Cobertura principal |
|---|---|
| Unitarias Node | Dominio, lenguaje, compilación, pruebas CLRS, complejidad, diagrama y BROKER.95. |
| Corpus versionados | Aceptación BROKER.95, proveedores y resiliencia, aprendizaje multirruta, edición estructural del diagrama, literales de arreglo y exportación portable. |
| Extension Host | Activación real, comandos, proveedores, Testing API, terminal, Webviews y DAP. |
| Build frontend | Compilación reproducible de React, Mermaid, KaTeX y Kaplay. |

`test/fixtures/integral-corpus.v1.json` funciona como matriz de cierre: cada área obligatoria referencia pruebas existentes y no duplicadas. La validación exige parser y semántica, ejecución, pruebas, comparación, depuración, cobertura, acciones rápidas, jerarquía de llamadas, BROKER.95, diagramador, literales de arreglo, exportación portable y regresiones multiplataforma. `test/fixtures/array-literals-corpus.v1.json` detalla la trazabilidad de esta última capacidad del lenguaje desde el contrato del AST hasta complejidad y BROKER.95; `test/fixtures/gui/portable-export-corpus.v1.json` delimita por separado las comprobaciones reproducibles del generador portable y los smoke tests nativos. Ambas pruebas de corpus verifican además que sus evidencias formen parte de un comando ejecutado por el release.

### Comandos principales

El cierre de proveedores de 1.7.5 añade `test/fixtures/broker95-providers-corpus.v1.json`: referencia los once proveedores y ocho áreas (contrato/routing, seguridad/persistencia, transporte compatible, descubrimiento local, experiencia educativa, resiliencia, autoridad del dominio y composición). `test/broker95.providers.corpus.test.js` recorre los scripts desde `release:check`, incluyendo prehooks, y rechaza evidencias que existan pero no se ejecuten en el cierre. Además prueba el registro real junto con cada uno de los seis adaptadores nuevos, sus seis operaciones, recuperación transitoria, fallos definitivos, UTF-8 fragmentado, interrupción, cancelación y timeout durante la lectura HTTP/SSE.

Estas pruebas utilizan respuestas HTTP/SSE simuladas, sin claves reales ni gasto en APIs. Cubren el comportamiento de la extensión, no certifican la disponibilidad actual de todos los modelos o cuentas remotas. La validación de un proveedor concreto se completa mediante **Probar conexión** con la configuración del usuario.

| Comando | Alcance |
|---|---|
| `npm run lint` | ESLint sobre código fuente y pruebas. |
| `npm run pretest:unit` | Infraestructura crítica del lenguaje, comparadores, explicación pedagógica y diagnósticos derivados del grafo. |
| `npm run test:unit` | Suite Node principal. |
| `npm run test:gui:export` | Exportación GUI portable de cinco archivos, lock, staging, respaldo y publicación transaccional. |
| `npm run test:gui:packable` | Región canónica de carga GUI, recorrido Node normal intacto, loader obligatorio en la variante `pkg` y validaciones estructurales. |
| `npm run test:gui:prepare-packable` | Generador CJS, nombres dinámicos, plataformas, regeneración y preservación del JavaScript fuente. |
| `npm run test:gui:bootstrap` | Bootstrap CJS, extracción física, entorno GTK, redirección nativa estrecha y arranque packable. |
| `npm run test:gui:portable-manifest` | Manifest portable, scripts host, assets y validación determinista del lock de runtime/desarrollo. |
| `npm run test:gui:portable-corpus` | Corpus sin red de identidad, frontera GUI/no GUI, cinco artefactos, arranque normal, preparación reproducible y atomicidad. |
| `npm run test:cli:export-architecture` | Contrato, clasificación, manifest, transacción, lock npm v3 y presentación diferenciada CLI/GUI. |
| `npm run test:cli:export-corpus` | Corpus determinista CLI: cuatro fuentes, snapshots repetibles, aislamiento GUI y ejecución temporal intacta, sin red ni build nativo. |
| `npm run test:cli:export-docs` | Coherencia determinista entre contrato, guía CLI/GUI, README, requisitos, comandos y salidas de build documentadas. |
| `npm run test:cli:lock:native` | Ensayo opt-in con npm real: lock CLI v3 validado y ausencia de `node_modules`, sin ejecutar scripts. |
| `npm run test:cli:install:native` | Ensayo opt-in: traslada el proyecto CLI, ejecuta `npm ci`, conserva el lock, valida `pkg` local y ejecuta el entry normal con `npm start` y Node. |
| `npm run test:cli:build:native` | Smoke test opt-in del host: construye el binario CLI, lo aísla y valida stdin/stdout/stderr, argumentos, exit code y ausencia de residuos GUI. |
| `npm run test:gui:portable-lock:native` | Ensayo opt-in con npm real: genera sólo el lock portable en un temporal, sin instalar ni ejecutar scripts. |
| `npm run test:gui:portable-install:native` | Ensayo opt-in con npm y GTK reales: `npm ci`, binding autorizado, CLI de `pkg` disponible y `npm start` sobre el entry normal. |
| `npm run test:gui:portable-build:native` | Smoke test opt-in por host: build `pkg`, ejecutable aislado, extracción inicial de GTK y reutilización byte a byte en el segundo arranque. |
| `npm run test:terminal` | Presentación CLI, procesos reales con E/S, diagnósticos, reloj monotónico y progreso GUI. |
| `npm run test:broker95:learning` | Dominio, UI y flujos completos de Aprendizaje. |
| `npm run test:broker95:learning:corpus` | Corpus multirruta enfocado. |
| `npm run test:broker95:corpus` | Corpus de aceptación general del juego. |
| `npm run test:broker95:providers` | Contrato, registro/routing, experiencia educativa y corpus integral de proveedores. |
| `npm run test:broker95:gemini` | Adaptador Gemini. |
| `npm run test:broker95:deepseek` | Adaptador DeepSeek. |
| `npm run test:broker95:ollama` | Adaptador Ollama. |
| `npm run test:broker95:openai` | Adaptador OpenAI. |
| `npm run test:broker95:openai-compatible` | Transporte común de los seis adaptadores nuevos. |
| `npm run test:broker95:remote-compatible` | Perfiles remotos, sondas, routing, límites y errores. |
| `npm run test:broker95:lmstudio` | Descubrimiento de modelos y seguridad local. |
| `npm run test:broker95:resilience` | Reintentos y clasificación de fallos. |
| `npm run test:trajectory` | Trayectorias de ciclos. |
| `npm run test:diagram:corpus` | Corpus versionado de edición visual del diagrama. |
| `npm run test:extension` | Extension Host real mediante `vscode-test`. |
| `npm run test:all` | Lint, suites Node, corpus, build y Extension Host. |
| `npm run test:corpus:integrity` | Integridad de la matriz, metadatos de release, rutas Windows/POSIX y frontera publicable. |
| `npm run test:corpus` | Cierre integral: integridad, Aprendizaje y `test:all`. |
| `npm run release:check` | Alias obligatorio del corpus integral para publicación. |

### Estrategia

Desde 1.9.6, `test:terminal` forma parte de `test:all` y del cierre de release.
Combina pruebas de procesos Node reales para la ejecución CLRS con streams
TTY y planificadores inyectados para animación determinista. Las pruebas de
aprovisionamiento utilizan copias temporales y dobles explícitos; no descargan
GTK ni modifican el runtime privado del desarrollador. La barra porcentual se
prueba con contadores de bytes controlados porque npm no entrega un total fiable.

La ejecución local valida Windows; no certifica por sí sola la matriz nativa
Linux/macOS ni la apariencia en cada emulador de terminal. Los resultados deben
distinguir entrada y cancelación en procesos reales de las señales inyectadas
o de los streams TTY simulados.

- **Unitarias:** modelos, validadores, servicios y adaptadores con puertos falsos.
- **Caracterización:** preservan comportamiento estable del frontend, transpilador y diagramador.
- **Solidez:** contraejemplos para evitar clasificaciones asintóticas incorrectas.
- **Corpus:** escenarios versionados que cruzan varias capas reales.
- **Extension Host:** activación, comandos, diagnósticos, artefactos y DAP dentro de VS Code.
- **Testing API:** descubrimiento, selección, exclusión, ejecución, presentación, depuración y reconciliación del contrato BROKER.95 activo.

`.vscode-test.mjs` utiliza una instalación local de VS Code cuando la encuentra o descarga/usa la estable gestionada por `@vscode/test-electron`. Puede forzarse una instalación mediante `VSCODE_EXECUTABLE_PATH`.

`.github/workflows/integral-corpus.yml` declara la misma ejecución en `windows-latest`, `ubuntu-latest` y `macos-latest`; Linux utiliza `xvfb-run` para el Extension Host. La entrada manual `portable_build_native` habilita además el smoke test de ejecutable host con Node 24 y conserva una evidencia separada por plataforma. La prueba local de rutas mantiene cobertura determinista aunque la matriz remota aún no se haya ejecutado para una revisión concreta.
La entrada manual `cli_native` ejecuta por separado la instalación y el arranque
normal del proyecto CLI trasladado en esos tres hosts; no construye todavía el
ejecutable.
La entrada `cli_build_native` construye y ejecuta el binario CLI correspondiente
a cada host, también con evidencia separada y sin cross-compilation.

---

El empaquetado se describe en [Build, VSIX y publicación](release.md).

