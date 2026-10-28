# Bloque 10 — Modelo de costos GUI

## Alcance

`src/standard-library/gui/GuiCostCatalog.js` es la autoridad del costo directo
de las **61 funciones** y las propiedades de los **24 componentes** públicos.
`GuiFunctionCatalog.js` y la ayuda del editor proyectan ese contrato. No se
agregan funciones CLRS, capacidades de runtime ni dependencias nativas.

El análisis usa la resolución semántica existente, no coincidencias de texto:
una función de usuario homónima conserva su propio costo. El resultado se
integra en el álgebra, las funciones de costo, mejor/peor caso, recurrencias y
el informe actuales. El sidecar `report.guiCostModel` no es enumerable; el
contrato JSON histórico no cambia. El JavaScript generado no incluye el
analizador ni los metadatos de costos del catálogo.

## Unidades y supuestos

- Se analiza trabajo directo con argumentos válidos, no tiempo de reloj.
- `c` agrupa operaciones acotadas. Accesos al registro y operaciones nativas
  elementales se modelan como unitarios; anexar al modelo usa costo amortizado.
- `volumen GUI(x)` cuenta los caracteres y valores/celdas recorridos, incluyendo
  dimensiones interiores. No se sustituye el volumen de una matriz o colección
  de textos por la sola longitud de su arreglo exterior.
- Para literales: un escalar cuesta una unidad; una cadena, una unidad más sus
  caracteres decodificados; un arreglo, una unidad más los volúmenes de sus
  elementos. Los factores constantes no pretenden medir instrucciones de CPU.
- IDs y nombres de propiedades/eventos tienen tamaño acotado en este modelo.
  Los nombres de tema no son un enum cerrado y sí tienen longitud variable.
- Se excluyen aprovisionamiento/inicialización del entorno, dibujado y
  composición nativa, latencia de E/S y espera humana. Seleccionar una ruta
  mediante un diálogo no equivale a leer/escribir el contenido del archivo.
- El despacho de eventos, sus payloads y los cuerpos de callbacks, incluidos
  los inmediatos, no se suman al costo directo de la llamada GUI que los provoca.
  Cada callback tiene su análisis por invocación. La frecuencia de los eventos
  no se deduce de `n`: el informe **no acota la sesión interactiva completa**.
- Las medidas de entrada presuponen que otros callbacks no mutan esos datos
  concurrentemente. Las escrituras, alias o escapes detectados invalidan la
  conservación de la medida; no se reutiliza ciegamente el tamaño original.

Estos supuestos se muestran en el informe de complejidad, no sólo aquí.

## Catálogo de operaciones

Las fórmulas de estado describen qué trabajo interviene; no son una afirmación
de cota ajustada cuando el tamaño del estado no está probado desde la entrada.

| Operaciones | Modelo directo |
| --- | --- |
| VENTANA, VENTANA_APLICACION, ETIQUETA, BOTON, CASILLA, BOTON_ALTERNABLE, BOTON_ENLACE, LISTA_DESPLEGABLE, VISTA_COLUMNAS, DIALOGO_ALERTA | `c + volumen` de los textos/colecciones iniciales. |
| ENTRADA, ENTRADA_CONTRASENA, AREA_TEXTO, ENTRADA_NUMERICA, DESLIZADOR, BARRA_PROGRESO, INDICADOR_CARGA, CALENDARIO, CAJA, CUADRICULA, CONTENEDOR_DESPLAZABLE, LISTA_VISUAL, DIALOGO_ARCHIVO | Cantidad acotada de campos y operaciones. |
| IMAGEN | Carga/decodificación externa; la longitud de la ruta no determina los bytes ni píxeles procesados. |
| MOSTRAR, OCULTAR, ENFOCAR, QUITAR, MAXIMIZAR, MINIMIZAR, PANTALLA_COMPLETA, RESTAURAR, PULSAR_PROGRESO, INICIAR, PARAR, MARCAR_DIA, DESMARCAR_DIA, LIMPIAR_MARCAS, LIMPIAR_IMAGEN | Trabajo acotado bajo el modelo; no incluye renderizado ni despacho. El calendario tiene a lo sumo 31 marcas. |
| CONTENER, ANEXAR, PREPONER, COLOCAR | `c + h`, por comprobar los ancestros y evitar ciclos. |
| CERRAR | Desmontaje del estado alcanzado: ventanas, recursos, conexiones y operaciones pendientes. Las búsquedas/retiradas de conexiones pueden ser cuadráticas; no se presume costo constante ni lineal. |
| ANEXAR_FILA | `c + volumen(fila)`, por validación, copia y serialización; anexado amortizado, sin dibujado de celdas. |
| QUITAR_FILA, LIMPIAR_FILAS | Actualización/liberación del modelo de filas existente; su tamaño no es el ID recibido. |
| MOSTRAR_ALERTA, ELEGIR_ALERTA | Reconstrucción de la configuración existente, sin contar espera humana. |
| ABRIR_ARCHIVO, ABRIR_ARCHIVOS, GUARDAR_ARCHIVO, ELEGIR_CARPETA, ELEGIR_CARPETAS | Reconstrucción del selector y conversión de las rutas obtenidas; los plurales recorren todos los resultados. |
| ESTABLECER_TEMA, OBTENER_TEMA | Transferencia del nombre recibido o almacenado, sin recálculo de estilos/repintado. |
| ESTABLECER_MODO_TEMA, OBTENER_MODO_TEMA | Modo de dominio acotado. |
| CONECTAR | Registro de un número acotado de señales/controladores. `cambio` y `seleccion_cambiada` pueden leer y serializar una instantánea inicial de tamaño variable. Un evento dinámico no se presume constante. No ejecuta el callback al registrarlo. |
| ESTABLECER, OBTENER | Depende de la propiedad y del tipo demostrado; véase abajo. |

### Propiedades

- Escalares/enums y fecha de tres números: trabajo acotado.
- Texto: el setter valida/transfiere el dato; el getter depende de la longitud
  almacenada. Los setters de imagen dependen del recurso, no sólo de su nombre.
- `datos`, `opciones`, `columnas`: recorridos, validación, copia o serialización.
  Reemplazar columnas también valida filas existentes y reconstruye conexiones.
- `seleccion`: DropDown conserva el índice escalar; listas/tablas pueden recorrer
  filas o selecciones y ordenar índices. Cambiar `modo_seleccion` puede reconstruir
  estado; consultar su enum es acotado. `grupo` puede recorrer miembros existentes.
- Diálogos: cualquier setter reconstruye la configuración, incluidos los botones
  o filtros ya guardados. No se atribuye O(1) sólo porque el nuevo dato sea booleano.

El tipo se obtiene de una factory dominante en un tramo lineal de la misma
función, nunca del prefijo del ID. Sin ese hecho se consideran los tipos públicos
compatibles: sólo se usa un modelo determinado cuando coinciden sus categorías.
Ramas, llamadas desconocidas, cierres, conexiones y suspensiones invalidan esos
hechos locales. Nombres dinámicos/prototipos no se convierten en propiedades.

## Composición y límites de precisión

Los literales locales dominantes sin alias/escrituras/escapes conservan su
volumen. Los parámetros no mutados se representan con medidas simbólicas y
reciben alias `n`, `m`, etc. en la notación asintótica, sin perder su expresión
original. Por ejemplo, repetir una transferencia de texto `n` veces produce
`O(n m)`, donde `m` es el volumen del texto, no su valor numérico.

La anotación algebraica `dato GUI(v, l)` preserva el volumen de arreglos y cadenas
al sustituir parámetros entre funciones. No es una función del lenguaje ni
convierte un arreglo en un número. El segundo argumento es opcional: sólo guarda
la longitud exterior cuando se conoce. `volumen GUI` se reduce a `v` y `LONG` a
`l`; nunca se usa el volumen profundo como longitud exterior. Una medida de
volumen desconocido no recibe un alias de tamaño conocido.
Las recurrencias reutilizan los mecanismos existentes de composición y tamaños.

No se reconstruye el heap GTK ni el historial completo de modelos, callbacks,
jerarquías, archivos o selecciones del usuario. Cuando ese estado es necesario
pero no se puede demostrar su tamaño, se conserva **O(?)** con la operación,
el modelo y la causa en español. Se reutiliza `CLRS_ASYMPTOTIC_UNKNOWN_COST`;
no se presenta como una función estándar faltante ni como un error de GTK.
Las mutaciones/alias se tratan conservadoramente, por función, sin prometer un
análisis general de alias o una cota de eventos. Esto puede perder precisión
incluso en casos que una persona podría resolver manualmente.

## Verificación

`npm run test:gui:cost` ejecuta 16 pruebas enfocadas, incluidas también en
`npm run test:unit`. Cubren los 61 descriptores, 24 factories y todas las
propiedades; constantes/volúmenes; modelos dinámicos; nombres homónimos y
prototipos; ramas, ciclos, recurrencias, reenvíos y mutaciones; instantáneas de
eventos; callbacks separados; ayuda y ausencia del analizador en JS generado.

Son pruebas del análisis estático: **no requieren GTK y no son mediciones de
rendimiento nativo**. Se reutiliza además el corpus de regresión de lenguaje,
generación, DAP, diagramador, runtime y exportación. Las validaciones nativas de
bloques anteriores conservan su evidencia y límites; no se certifican nuevas
plataformas ni se modifica el aprovisionamiento. No se cambia versión ni se
genera VSIX en este bloque.
