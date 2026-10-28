# Diagramas de flujo

Las llamadas GUI conservan las figuras derivadas de la sintaxis. La traza
transporta espera, reanudación y contexto de callbacks; la reproducción señala
los nodos existentes sin añadir figuras o flechas ajenas al programa.
Su contrato de flujo se comparte con [runtime GUI](../gui/runtime-pipeline.md)
y se verifica en el [corpus GUI](../gui/acceptance.md).

## Diagramas de flujo

El diagrama se genera dentro del Webview; el Host entrega código/AST y conserva la integración con VS Code.

`DiagramDocumentSession` enlaza cada panel con la URI, el `TextDocument` y, cuando corresponde, el alcance seleccionado que originó el diagrama. El enlace no depende de que el `TextEditor` original siga siendo la instancia visible: al mover el archivo o el Webview entre grupos o ventanas, la sesión adopta el editor visible del mismo documento. El panel conserva su contexto al ocultarse, responde a cada nueva señal `webview-ready` y se reutiliza al volver a ejecutar el comando sobre el mismo documento y alcance.

El Host reutiliza `DocumentAnalysisService` para adjuntar los diagnósticos semánticos de la versión documental exacta. Estos avisos se presentan en español dentro del Webview sin invalidar el modelo Mermaid ni bloquear la navegación o edición del diagrama; los errores léxicos, sintácticos o de generación continúan utilizando el estado bloqueante existente. Los diagramas de fragmentos omiten el análisis semántico aislado para no producir falsos positivos al perder el contexto exterior de la selección.

`DiagramDomInteraction` proyecta además los errores sintácticos y semánticos localizables sobre el SVG renderizado. La ubicación 1-based del diagnóstico se relaciona con el nodo más específico del modelo vigente y la figura recibe `clrs-diagram-diagnostic-error`, `aria-invalid` y el número de diagnósticos asociados. La presentación reutiliza el contorno rojo y el brillo exterior de un fallo de ejecución, pero conserva un estado independiente para que reproducir una traza, buscar, seleccionar o editar no borre el aviso. El resaltado se reconstruye después de cada render, cambio de alcance o actualización documental y se limpia al desaparecer el diagnóstico. Si una fuente sintácticamente inválida todavía no posee una figura segura en el último modelo válido, se mantiene el reporte textual y no se señala un nodo aproximado.

| Parte | Implementación |
|---|---|
| Controlador y panel | `DiagramCommandController`, `VSCodeDiagramHost` |
| Modelo | `frontend/src/builders/`, `frontend/src/visitor/` |
| Identidad editable | `DiagramEditableIdentity`, `DiagramContext` |
| Editor flotante | `DiagramNodeEditor`, `DiagramNodeEditorModel` |
| Inserción estructural | `DiagramInsertionEditor`, `DiagramInsertionEditorModel` |
| Creación de funciones | `DiagramFunctionEditor`, `DiagramFunctionEditorModel` |
| Esquema compartido de edición | `src/diagram/editing/DiagramEditSchema.js` |
| Transformación autoritativa | `DiagramSourceEditService` |
| Errores de edición | `DiagramEditingError` |
| Corpus de regresión | `test/diagram.editing.corpus.test.js`, `test/fixtures/diagram-editing-corpus.v1.json` |
| Estado | `DiagramModelStore` |
| Mermaid | `MermaidInitializer`, `MermaidRenderer` |
| Navegación | `DiagramViewport`, `DiagramNavigation`, `DiagramMinimap` |
| Sincronización | `Bridge`, `DiagramSelection`, `DiagramDomInteraction` |
| Trazas | `ExecutionTraceState`, `ExecutionToolbar`, `DiagramExecutionProjection` |
| Animación de reproducción | `DiagramPlaybackAnimation` |
| Exportación | `SvgExporter`, `DiagramSvgStyler` |
| Temas | `ThemeManager` y `themes/presets/` |

Cada modelo generado asigna una identidad determinista e inmutable a sus nodos y conexiones. Para los nodos procedentes de código, el descriptor conserva la figura CLRS editable, el rango fuente, el ámbito, el bloque contenedor, la rama, el índice de sentencia y el tamaño directo del bloque cuando determina el impacto de una eliminación. Para las conexiones, conserva su relación de control (`sequence`, `branch`, `loop-entry`, `loop-back`, entre otras) y, cuando la operación es estructuralmente segura, el punto exacto de inserción dentro del bloque. Las fusiones continúan siendo auxiliares y sólo se materializan cuando al menos una rama puede proseguir: un bloque anidado cuyas rutas terminan en `retornar` propaga que no existe continuación y no deja un punto de cruce desconectado. El inicio de una función representa su declaración y el `Fin` sintético de una función representa un punto seguro donde puede materializarse posteriormente `retornar`.

`DiagramExpressionVisitor` traduce la estructura del AST a etiquetas legibles sin convertirla en otra sintaxis. Los operadores internos `&&` y `||` se proyectan como `y` y `o`, la negación como `no` y los literales lógicos conservan exactamente `VERDAD` y `FALSO`; los arreglos se proyectan recursivamente con sus corchetes, comas, llamadas y dimensiones. Así las condiciones y asignaciones visibles, junto con sus valores iniciales de edición, conservan la sintaxis CLRS mientras el AST y el documento permanecen intactos. Aceptar un editor sin cambiar un literal lógico vuelve a materializar el mismo literal válido. Si una asignación contiene un arreglo multilínea, `DiagramSourceEditService` reemplaza el rango completo de la sentencia al aceptar una edición, evitando dejar filas o cierres residuales.

La propiedad `identity` es deliberadamente no enumerable: está disponible en memoria para interacción, búsqueda y futuras ediciones, pero no altera el contrato JSON histórico ni contamina la exportación. Cada conexión sí emite su `modelId` como identificador Mermaid explícito, de modo que el SVG puede relacionar una flecha concreta con el descriptor del modelo sin inferirla por posición o por sus extremos.

`DiagramDomInteraction` proyecta esas identidades sobre el SVG ya renderizado. Las figuras editables y las conexiones que poseen un punto de inserción son operables mediante puntero, `Enter` o barra espaciadora; `Escape` y el fondo del lienzo limpian la selección. El estado seleccionado permanece en React por identidad, por lo que sobrevive a un nuevo render del tema sin almacenar nodos DOM obsoletos. Los elementos incorporan rol, orden de tabulación, estado `aria-pressed` y etiquetas descriptivas. La interacción detiene el inicio accidental del paneo, mientras CSS aumenta el contorno de la geometría Mermaid o el grosor de la flecha durante hover, foco y selección, respetando `prefers-reduced-motion`. Para que la punta acompañe al trazo sin colorear otras conexiones que Mermaid haga compartir, cada flecha recibe un clon aislado de su marcador; su punta conserva el color temático o el verde de ejecución y crece de forma sutil durante hover, foco o selección, y el marcador original se restaura al desmontar la interacción. El contorno rectangular nativo del grupo SVG se suprime para no superponer una caja ajena a la figura. Cada conexión incorpora además una copia SVG transparente situada detrás del trazo visible: ofrece una zona de selección de 18 px —24 px en dispositivos de puntero grueso— sin alterar la geometría, las puntas ni la exportación visual de Mermaid.

Seleccionar una conexión editable abre `DiagramInsertionEditor`. Antes de aceptar, el panel identifica el destino estructural como secuencia del bloque, rama Sí o rama No y como inicio, punto intermedio o final. Su paleta ofrece retorno, asignación, entrada, salida, decisión, `mientras`, ambos sentidos de `para` y llamada de subproceso; `retornar` se oculta cuando el punto no pertenece a una función. Los campos reutilizan las definiciones y valores iniciales del editor de nodos, por lo que la creación y la edición conservan la misma sintaxis y vocabulario visual. Mientras la solicitud está pendiente, la selección queda ligada a esa flecha y no puede sustituirse silenciosamente por otra entidad antes de recibir la respuesta correlacionada del Host.

La conexión `No` de una decisión sin alternativa conserva un punto de inserción sintético. Si el usuario inserta allí una figura, el servicio autoritativo verifica que el AST vigente todavía carezca de esa rama y crea de forma atómica `sino` junto con la instrucción o estructura inicial solicitada. Del mismo modo, el modelo `Inicio → Fin` de un documento completamente vacío expone el punto canónico `__main__/body`, permitiendo crear la primera sentencia sin inventar un AST paralelo en el Webview.

La creación de declaraciones no se representa como una figura insertable en una flecha. El botón `ƒ` abre `DiagramFunctionEditor`, cuya acción principal se presenta como **Crear subproceso**; solicita un identificador y una lista opcional de parámetros y emite la operación `create-function`. Esta acción sólo está disponible cuando la sesión representa el documento completo: una selección parcial no posee autoridad suficiente para decidir el orden de declaraciones de nivel superior. El Host comprueba duplicados contra el AST vigente, inserta la función antes de `PRINCIPAL`, genera `retornar 0` como contenido inicial válido y vuelve a analizar el programa antes de aplicar una única edición reversible.

Una figura seleccionada abre `DiagramNodeEditor` sobre el lienzo. El formulario es una proyección de un borrador producido por `DiagramNodeEditorModel`: no extrae datos de la etiqueta Mermaid, sino del descriptor `editor` que los visitantes construyen directamente desde el AST. Retorno, asignación, lectura, escritura, decisión, ciclo `mientras`, ambos sentidos de `para`, llamada de subproceso y declaración de función comparten el mismo contrato de formulario; cada tipo declara sus campos, obligatoriedad y valores iniciales equivalentes a los snippets del lenguaje. La expresión de una terminal de retorno es opcional: en un `Fin` sintético, aceptar el valor vacío cierra el formulario sin producir una edición, mientras que introducir una expresión materializa `retornar`. El terminal de inicio de cada función muestra únicamente su firma y permite editar identificador y parámetros. `DiagramEditorPresence` aplica a los editores de nodo, inserción y función una entrada breve de opacidad, desplazamiento y escala, y conserva el último formulario durante 130 ms para completar su salida antes de desmontarlo. La animación queda desactivada cuando el sistema solicita movimiento reducido.

La llamada `PRINCIPAL()` del flujo global es una proyección sintética de la declaración de entrada y no una sentencia independiente del archivo. Su identidad abre **Subproceso · llamada** y conserva visibles el identificador y los argumentos derivados, pero el borrador se marca de sólo lectura: los campos permiten consultar y copiar sus valores, `Aceptar` permanece bloqueado y la figura tampoco puede eliminarse. La protección no depende únicamente de la interfaz; `DiagramNodeEditorModel` impide construir una intención de edición y `DiagramSourceEditService` rechaza una carga manipulada con `CLRS_DIAGRAM_EDIT_READ_ONLY`. De este modo, la llamada implícita nunca modifica el encabezado real ni materializa una segunda invocación que ejecutaría el programa dos veces. La declaración sí puede editarse o eliminarse desde el terminal de inicio de su subgraph; el Host retira su encabezado y cuerpo completos y la siguiente regeneración hace desaparecer automáticamente la llamada global. El Host valida que una actualización legítima conserve el número y el orden de declaraciones y que no introduzca identificadores de función duplicados; para una eliminación verifica que desaparezca exactamente la declaración seleccionada.

El editor conserva la acción `Ir` como navegación explícita al rango fuente, cierra con `Cancelar` o `Escape`, valida campos requeridos y representa `Aceptar`/`Eliminar` mediante intenciones inmutables y serializables (`update-node` y `delete-node`). Cada intención transporta identidad, figura, rango fuente y contexto estructural del bloque. React y Mermaid no son autoridad sobre el documento: el Webview sólo solicita una operación correlacionada y queda bloqueado mientras el Host responde.

`Eliminar` utiliza una confirmación en dos etapas. El formulario calcula únicamente la presentación del impacto —una instrucción, una rama alternativa, un bloque de control o una función completa— y explica que el cambio será una sola operación compatible con Deshacer de VS Code. La intención incluye esa confirmación, pero el Host no confía en ella: vuelve a obtener el tipo de impacto desde la identidad AST y rechaza cualquier discrepancia. `Escape` regresa del aviso al formulario sin modificar el código.

`DiagramSourceEditService` vuelve a analizar el texto vigente y reconstruye la identidad determinista desde el AST. Antes de producir un cambio comprueba la versión exacta del documento, la existencia y tipo de la figura, su rango desplazado, ámbito, bloque y rama, además de admitir exclusivamente los campos declarados por `DiagramEditSchema`. Los valores se limitan a una sola sentencia: se rechazan saltos de línea, caracteres nulos, campos adicionales o cargas excesivas, evitando que un formulario pueda inyectar bloques CLRS arbitrarios.

Una actualización sustituye únicamente la sentencia o encabezado correspondiente y conserva la indentación y el cuerpo de `si`, `mientras` y `para`. Una eliminación simple retira su línea completa; eliminar una estructura de control utiliza el rango completo del AST, incluidas sus ramas asociadas. Una rama `sino si` puede retirarse sin afectar el `si`, otras alternativas ni el `sino` posterior. Si se elimina la última sentencia directa de la rama `No`, el rango autoritativo incluye también su encabezado `sino`, evitando conservar un bloque alternativo vacío; mientras existan sentencias hermanas sólo se retira la seleccionada. Entre varias terminales explícitas de una función, únicamente la última terminal estructural queda protegida: los retornos anteriores pueden eliminarse como sentencias, pero el cierre siempre conserva un `Retornar` o un `Fin`. Vaciar la expresión del retorno final elimina la sentencia completa y proyecta un `Fin` sintético, editable y no eliminable; escribir una expresión en ese `Fin` materializa nuevamente una sentencia `retornar`. Cuando el retorno era la única instrucción raíz, un comentario canónico no ejecutable conserva el bloque de la declaración sin introducir un retorno sin expresión. El terminal de inicio sí puede eliminar una función mediante el rango completo de su declaración y cuerpo. Los demás cuerpos obligatorios de decisión o ciclo no pueden quedar vacíos y producen `CLRS_DIAGRAM_EDIT_EMPTY_BLOCK`.

Una inserción resuelve el `scopeId`, contenedor, rama e índice contra el AST nuevo, conserva el estilo de indentación y salto de línea del archivo y coloca la sentencia antes, entre o después de las instrucciones correctas. Las estructuras de control incluyen un cuerpo inicial válido que luego puede editarse desde su propia figura. El texto candidato se analiza antes de entregarse al adaptador de VS Code y también se comprueba que conserve la envolvente de funciones del documento. El flujo global admite llamadas a cualquier función declarada tanto al inicio como al final de su secuencia; si aún no contiene sentencias ejecutables, utiliza la primera declaración como ancla segura e inserta antes de ella. Regresiones específicas protegen los tres casos.

Las inserciones desde un diagrama de fragmento sólo se permiten cuando la selección comienza al inicio de una línea. Esta restricción evita separar accidentalmente la sangría que permanece fuera del alcance seleccionado; para cualquier selección parcial insegura, el Host solicita abrir el diagrama completo en lugar de inferir offsets.

La aplicación posee un segundo cortafuegos en `DiagramDocumentSession.applyEdits`: inmediatamente antes de crear el `WorkspaceEdit`, vuelve a comparar la versión y el fragmento fuente esperado. Si el usuario escribió, cambió el alcance o regeneró el diagrama durante la operación, el cambio se rechaza como obsoleto en lugar de aplicarse sobre otra sentencia. Los fallos vuelven al formulario como errores estructurados en español y no modifican el archivo.

El botón de guardado no depende del editor que tenga el foco. El Webview emite `save-document`, `DiagramCommandController` verifica que la solicitud pertenezca al panel vigente y `VSCodeDiagramHost` delega en `DiagramDocumentSession.save()`, que guarda exactamente el `TextDocument` enlazado al diagrama.

El corpus versionado de edición visual reúne 31 requisitos trazables en nueve áreas: identidad, interacción, actualización, eliminación, inserción, funciones, seguridad, Host y regresión. Además de enlazar cada requisito con su prueba concreta, ejecuta un recorrido integral sobre código CLRS real que actualiza una figura, inserta desde una flecha, elimina ramas y retornos, crea, edita o elimina funciones y comprueba que el programa final continúa siendo analizable.

El SVG exportado debe ser autónomo: no puede depender de `foreignObject`, estilos exclusivos del navegador ni el fondo general del Webview. Los fondos internos de subgraphs sí forman parte del diagrama.

`MermaidInitializer` utiliza un padding compacto de 8 px. Como Mermaid aplica ese espacio de manera diferente según la figura, las etiquetas compensan la geometría antes del layout: procesos, subprocesos, terminales, entrada/salida y preparaciones cortas parten de una altura común de 36 px, mientras las etiquetas extensas conservan crecimiento natural y los conectores se anclan sobre la forma definitiva. El padding menor reduce el espacio interior de los rombos sin imponerles la altura rectangular; los puntos de fusión mantienen sus proporciones propias. El inicio de una función conserva una sola línea con su firma y los retornos explícitos usan la etiqueta única `Retornar expresión`, como las demás instrucciones; así la edición, la vista Mermaid y la exportación SVG comparten la misma geometría. La reserva horizontal también se serializa en texto SVG mediante espacios no separables invisibles, evitando que terminales breves como `Fin` colapsen hacia una forma casi circular tanto en la vista como en la exportación autónoma. `DiagramSvgStyler` completa las etiquetas `Sí`/`No` de las conexiones después del render: tanto el fondo SVG como su variante HTML reciben un relleno temático opaco, sin borde y con radio máximo para formar una cápsula compacta sin modificar la trayectoria de la flecha.

La exportación SVG conserva ahora una instantánea del diagrama después del layout y del estilizado, pero antes de que `svg-pan-zoom` incorpore su viewport interactivo. `SvgExporter` reutiliza esa geometría exacta y sustituye cada `foreignObject` por texto y fondos SVG nativos: el archivo resultante mantiene tamaños, proporciones, conectores, colores, tipografía y etiquetas de rama próximos a la vista del editor, sigue siendo transparente y no depende de HTML ni de propiedades exclusivas del Webview. Los fondos nativos de las etiquetas de conexión serializan `rx` y `ry` a la mitad de su altura, junto con opacidad completa, por lo que las cápsulas también funcionan en visores SVG externos. Las etiquetas nativas neutralizan el trazo heredado de las clases de figura para que los glifos no reciban el contorno de los nodos. Además, la familia calculada en el editor se acompaña de alternativas monoespaciadas portables (`Consolas`, `Courier New` y `monospace`), evitando letras deformadas cuando un visor externo no dispone de la fuente preferida. Como Mermaid puede omitir el `viewBox` del elemento insertado, la captura lo deriva del `getBBox()` real con un margen estable antes de serializar; así la solicitud de exportación siempre entrega dimensiones autónomas válidas al Extension Host y permite abrir el diálogo de guardado.

La barra inferior separa dos operaciones. El botón de contorno `▷`, situado junto al estado, solicita **Ejecutar código CLRS**; el Webview envía `execute-document` y `DiagramCommandController` comprueba que el mensaje pertenezca al panel vigente antes de entregar su `DiagramDocumentSession` al mismo `CodeCommandController` utilizado por `CLRS.runCode`. De este modo se guarda y ejecuta exactamente el archivo enlazado aunque el foco esté en el Webview o éste se encuentre en otra ventana, sin depender de `activeTextEditor`, duplicar el runtime ni crear otra terminal. Los controles `|←`, `←`, `▶`, `→` y `→|` recorren después la traza recibida.

El menú superior del editor ordena sus accesos como **Ejecutar**, **Análisis**, **Diagrama**, **Jugar BROKER.95**, **Crear** e **Inicio**, sin cambiar sus comandos. En la barra propia del diagramador, `⤒` aparece inmediatamente después de guardar y solicita **Exportar diagrama de flujo** mediante la ruta `export-svg` ya utilizada por `Bridge` y `SvgExporter`. Un separador delimita estas dos operaciones frente a creación de funciones y navegación.

**Centrar y ajustar el nodo activo** sincroniza primero las dimensiones de `svg-pan-zoom` con el tamaño vigente del Webview y después calcula el zoom y el desplazamiento del nodo. El enfoque permanece así correcto al redimensionar una ventana o un grupo de editores de VS Code y no depende de ejecutar previamente **Ajustar el flujo visible**.

Los brillos de hover, error e indicación de ubicación (`Ir`) interpolan su filtro durante 180 ms, sin retraso inicial y con el mismo desvanecido al retirarse. El filtro neutro y los colores directos evitan un salto de color al final de la interpolación. Seleccionar una figura mantiene el brillo de su contorno junto a las hormigas marchantes; seleccionar una flecha conserva brillo y grosor mientras siga abierto el editor de inserción. Las flechas visitadas usan el mismo verde que las figuras ejecutadas y también crecen de 3 a 6 px durante hover. La ejecución activa mantiene prioridad sobre la selección de una figura, sin modificar geometría, relleno ni texto.

### Contrato de recorrido visual

La traza del runtime es la evidencia de la ejecución real y no se reescribe
para satisfacer la presentación. Tanto la ejecución GUI como la normal por
terminal publican ubicaciones y transiciones estructurales reales, incluidas
la entrada y salida de cada marco de función. El Webview combina esa traza con
el AST/modelo vigente para derivar una **secuencia visual normalizada**. No
lee posiciones, geometría ni proximidad del SVG, y no inventa instrucciones
CLRS, eventos DAP, cobertura ni flechas Mermaid.

Cada paso normalizado identifica la figura, el contexto de ejecución, el frame
cuando corresponde, el índice del evento real que lo originó y las conexiones
del modelo que llegan a él. Una figura alcanzada siempre ocupa un paso antes de
quedar visitada; no existe una segunda ruta que coloree terminales o conexiones
fuera de esa secuencia. La misma lista gobierna el contador, `|←`, `←`, `→`,
`→|`, la reproducción automática, el foco activo, las figuras visitadas, las
flechas recorridas, el pulso y el destello de llegada.

Las reglas de pasos son:

- `Inicio` global existe exactamente una vez y es el primer paso de toda
  ejecución presentada. No se agrega otro `Inicio` al entrar en funciones.
- Proceso, entrada, salida y llamada son pasos lineales y continúan por su
  sucesor estructural.
- Una decisión `si` es un paso en cada evaluación. Sólo se recorre la rama
  tomada; la rama No sin `sino` alcanza la continuación exterior. La rama sólo
  llega a `Fin` cuando no hay sucesor alcanzable en el ámbito.
- La decisión de `mientras` es un paso en cada evaluación. Un resultado
  verdadero recorre `loop-entry`, el cuerpo y `loop-back`; un resultado falso
  sale a la continuación y no vuelve a visitar cuerpo ni decisión.
- `para` separa Preparación y Decisión de bucle. La primera visita inicializa;
  tras el cuerpo, cada nueva visita a Preparación actualiza la variable y
  recorre `loop-back`, y cada Decisión evalúa si existe otra iteración. La
  regla es idéntica para `hasta` y `bajando`; la rama falsa alcanza la
  continuación o el `Fin` real del ámbito.
- El terminal con la firma de una función es un paso de entrada en cada
  invocación. No es el mismo paso que la figura de llamada.
- `Retornar expresión` es un paso terminal real: finaliza inmediatamente el
  frame, omite toda figura posterior y todo regreso al ciclo envolvente, y no
  agrega un `Fin` sintético.
- El `Fin` de función es un paso cuando el frame termina naturalmente; el
  `Fin` global es el último paso de una ejecución correcta no truncada. Error,
  cancelación o truncamiento no completan un `Fin` que no haya sido alcanzado.

`Fin` representa el cierre de un ámbito, nunca el fin local de una rama o del
cuerpo de un ciclo. El generador sólo materializa el terminal del ámbito y
propaga la continuidad de ramas y bloques anidados. Una rama sin alternativa,
una salida falsa, una fusión o un cuerpo terminado conservan su sucesor
exterior; un `Retornar` explícito, en cambio, comunica que esa ruta no continúa.

`DiagramExecutionProjection` distingue la llamada automática global
`PRINCIPAL()` del encabezado que comparte su ubicación: la llamada y la entrada
de función son pasos distintos. Por contexto mantiene una pila de frames con
`frameId`, `parentFrameId`, función y ámbito. La llamada conserva implícitamente
la posición alcanzada en el llamador; al procesar `Retornar` o la salida natural
se desapila el frame y el siguiente evento se proyecta directamente sobre su
continuación. Por ello llamadas anidadas, repetidas, recursivas o ejecutadas
dentro de expresiones, ramas y ciclos no vuelven a presentar la llamada ni la
declaración al regresar.

Las conexiones se resuelven exclusivamente por sus identidades y relaciones
del modelo (`sequence`, `branch`, `loop-entry`, `loop-back` y salida de ciclo).
Una ruta puede atravesar fusiones auxiliares sin convertirlas en pasos, pero
sólo incorpora las aristas realmente recorridas. Los saltos entre función y
llamador pertenecen a la secuencia sin crear una flecha inexistente entre
ámbitos. El estado visual es un plegado puro del prefijo elegido: el destino
es activo, los pasos anteriores son visitados y las transiciones entrantes son
recorridas. Rebobinar reconstruye ese plegado y no deja clases DOM acumuladas.

Durante el avance consecutivo de reproducción, `DiagramPlaybackAnimation` recorre esas trayectorias y reserva los últimos 100 ms para el destello de llegada. La secuencia completa dura 650 ms en `0.5×`, 450 ms en `1×` y 250 ms en `2×`; tanto el avance manual como el automático consultan la velocidad seleccionada. Es una decoración visual no bloqueante: no modifica la cadencia de los pasos, la traza ni la ejecución en vivo. Sus trazos transitorios no se incorporan al modelo, al minimapa ni a la instantánea exportable; se eliminan al terminar y se cancelan al rebobinar, cambiar de traza o regenerar el SVG. Con movimiento reducido se omiten el pulso y las animaciones de selección.

El diagrama de una ejecución normal puede reproducir la traza después de finalizar. Las clases de estado se aplican al nodo Mermaid y la hoja visual contempla tanto figuras directas como la geometría anidada de sus terminales; por ello los inicios, retornos y `Fin` reciben el mismo brillo exterior de ejecución o error que procesos, entradas, salidas y decisiones. Esta representación permanece separada del estado DAP: cerrar o regenerar el Webview no debe alterar una sesión de depuración.

---

