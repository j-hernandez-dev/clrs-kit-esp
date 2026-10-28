# Bloque 11 — Pruebas funcionales y evidencias de BROKER.95

## Integración

`CLRSTestExecutor` y `BrokerTestExecutionService` preparan la capacidad GUI
resuelta semánticamente antes de generar JavaScript. Comparten el mismo puerto
`GuiRuntimePreparation` y el administrador privado `NodeGtkDependencyManager`
que la compilación. `CLRSTestRuntimePreparation` es únicamente un adaptador de
ese puerto: no contiene otro instalador, probe ni implementación GTK.

La composición de VS Code proporciona la misma preparación a ambos servicios.
El proceso de cada caso utiliza el ejecutable Node validado y el runtime GUI
productivo generado. El addon nativo nunca se importa en el Extension Host.
Sin GUI, sin casos seleccionados o con cancelación previa no se aprovisiona GTK.
Una fuente inválida tampoco inicia el runtime.

El aprovisionamiento tiene sus propios límites y no consume el presupuesto de
ejecución de los casos. Cada caso conserva su proceso, directorio temporal,
entrada estándar, comparación de salida, semilla, límites y cobertura. Sólo
los procesos GUI heredan las variables de sesión gráfica necesarias; no se
propagan credenciales, `NODE_PATH` ni `NODE_OPTIONS`. El JavaScript generado
construye el entorno de recursos GTK privados con la lógica existente.

Al cancelar, exceder la salida o agotar el tiempo, el corredor compartido
termina también los descendientes GUI, incluidos los probes aislados. Utiliza
`taskkill /T /F` sin shell y sin ventana en Windows; un grupo de procesos
separado en POSIX. Se espera el cierre antes de leer la cobertura disponible
y retirar los temporales. El cierre forzado no certifica la ejecución de
finalizadores JavaScript: la liberación de recursos corresponde al proceso.

## Qué acredita una prueba

Las pruebas siguen contrastando entrada/salida y estado de terminación; no se
añade un formato de automatización visual ni se simulan clics del estudiante.
Una ventana abierta o un diálogo pendiente puede agotar el tiempo asignado.
Ese resultado no demuestra por sí solo un ciclo infinito. Pasar una prueba de
salida tampoco certifica apariencia, accesibilidad ni interacción gráfica.

La cobertura procede exclusivamente de eventos ejecutados. Registrar un
callback no lo marca como ejecutado. Se conserva cobertura parcial cuando el
proceso instrumentado llegó a emitirla antes de una interrupción.

Los diagnósticos conocidos de preparación conservan su código `CLRS_GUI_*`
y mensaje público en español, sin adjuntar errores internos del instalador.
BROKER.95 registra esos casos como fallo de inicio, no como salida incorrecta.
La revisión/evaluación se detiene antes de llamar a CIPHER o liquidar el
contrato cuando falla esa preparación o se cancelan las pruebas.

## Evidencia estática y CIPHER

Las funciones GUI siguen siendo llamadas de biblioteca estándar. Las
referencias a callbacks se obtienen del modelo semántico, no de nombres
buscados en el texto. `callbackRegistrations` registra activación potencial
dependiente de eventos y `observedExecution: false`.

Esas relaciones permiten considerar potencialmente alcanzables los callbacks
registrados desde funciones alcanzables y las funciones que éstos utilizan.
No añaden llamadas síncronas ni ciclos ficticios al grafo de recursión. Una
función homónima del usuario no se interpreta como API GUI; un registro situado
en una función inalcanzable no vuelve alcanzable su callback.

La evidencia existente incorpora metadatos GUI de interpretación: registro no
equivale a ejecución, trabajo directo no acota una sesión interactiva y no hay
validación visual. La proyección compacta de pruebas conserva esos límites
junto a stdout, stderr y estados observados. No incorpora rutas del runtime,
objetos GTK, claves ni resultados visuales inventados. No cambia rúbricas,
recompensas, reglas, lecciones ni progreso del juego.

## Corpus y alcance de la validación

`npm run test:gui:testing` ejecuta quince regresiones específicas y las suites
de revisión/evaluación. Todas están incluidas en `npm run test:unit`.

Se comprueban:

- Generación y ejecución reales en Node, callbacks, cobertura y aislamiento
  entre casos; una segunda ejecución no reutiliza los IDs del primer caso.
- Callback registrado pero no ejecutado; diagnóstico de API con línea CLRS.
- Cancelación determinista de FileDialog con `NULO` y limpieza del runtime.
- Espera de ventana/diálogo, timeout, cancelación, cierre de descendientes y
  retirada de directorios temporales.
- Ausencia de GTK en programas de consola, fuentes inválidas y cancelaciones;
  fallo/cancelación durante preparación, sin iniciar casos.
- Selección interna del Node validado y filtrado del entorno.
- Llamadas GUI estándar, callbacks potenciales, código muerto y homónimos en
  las evidencias estáticas; proyección compacta sin datos del runtime.
- BROKER.95 no envía una evaluación a CIPHER ni modifica la partida ante un
  fallo de preparación GUI o cancelación.

`binding-testing-stub.mjs` sustituye únicamente el binding GTK mediante los
dobles ya utilizados por el corpus. El generador, runtime, probe hijo y corredor
de procesos son reales. El doble cancela los diálogos de forma determinista y
comprueba recursos pendientes al cerrar normalmente la aplicación. No se
introduce este comportamiento en el producto.

Validación de este bloque: Windows, **1085/1085 pruebas principales** y
**97/97 previas**, sin fallos ni omisiones. Compilación de Extension Host, CLI y
webview satisfactoria; lint sin errores y con seis advertencias preexistentes.
Vite mantiene el aviso de chunks mayores de 500 kB.

No se ejecutaron nuevos ensayos nativos GTK en este bloque. La instalación de
prueba previa ya no está presente; las evidencias nativas de bloques anteriores
conservan su alcance original y no sustituyen esta limitación. No se certifican
Linux/macOS, apariencia visual, selección manual de archivos ni interacción
de usuario en VS Code. La cancelación de descendientes se comprobó con procesos
Node reales en Windows; su rama POSIX sigue pendiente de validación nativa.

Versión conservada: **1.8.1**. Sin VSIX ni avance al siguiente bloque.
