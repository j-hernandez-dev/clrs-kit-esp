# Arquitectura de la biblioteca GUI

## Arquitectura de integración GUI para CLRS Kit Español

**Estado:** especificación arquitectónica base  
**Fecha de referencia:** 2026-09-09  
**Backend GUI:** GTK 4 mediante `node-gtk`  
**Versión fijada de `node-gtk`:** `4.1.1`  
**Versión mínima de la API GTK requerida por el catálogo inicial:** `4.10`

---

## 0. Autoridad técnica externa

Cuando esta especificación describa comportamiento propio de GTK o de `node-gtk`, la implementación debe contrastarse con las fuentes vigentes en este orden:

1. documentación oficial de GTK 4: <https://docs.gtk.org/gtk4/>;
2. documentación publicada del paquete `node-gtk`: <https://www.npmjs.com/package/node-gtk>;
3. repositorio oficial de `node-gtk`: <https://github.com/romgrk/node-gtk>;
4. documentación técnica vigente de CLRS Kit Español.

Las decisiones de API pública de CLRS no tienen que copiar literalmente GTK, pero cualquier afirmación sobre jerarquía, disponibilidad, propiedades, señales, ciclo de vida o requisitos nativos debe conservar equivalencia semántica con GTK.

La versión mínima de GTK para el catálogo inicial es **GTK 4.10** porque `Gtk.AlertDialog` y `Gtk.FileDialog` están disponibles desde GTK 4.10. Si una plataforma dispone de una versión anterior, la dependencia debe considerarse incompatible para la GUI inicial aunque otros widgets puedan existir.

La versión `node-gtk 4.1.1` queda fijada por esta especificación. A la fecha de referencia es la versión publicada con el tag `latest`, pero CLRS no debe depender del tag dinámico `latest`.

---

## 1. Propósito

Este documento define la arquitectura de incorporación de interfaces gráficas de usuario (GUI) al lenguaje CLRS.

La GUI se incorpora como una capacidad de primera clase de la **biblioteca estándar de CLRS**, manteniendo el paradigma procedural del lenguaje y preservando la arquitectura vigente de compilación, transpilación y ejecución.

La integración debe permitir que un programa CLRS:

- cree componentes gráficos;
- identifique componentes mediante cadenas elegidas por el programa;
- configure y consulte propiedades;
- conecte eventos con funciones CLRS;
- ejecute acciones sobre componentes;
- componga jerarquías de widgets;
- seleccione de forma opcional el tema GTK y su preferencia de modo;
- ejecute aplicaciones GTK desde el pipeline convencional de CLRS;
- genere JavaScript exportable sin depender de la instalación de la extensión.

La implementación GTK pertenece exclusivamente al runtime. El programa CLRS no debe recibir ni manipular objetos JavaScript, objetos GObject, referencias nativas ni instancias de GTK.

---

## 2. Relación con la arquitectura vigente

Esta integración **extiende** el sistema actual; no introduce un pipeline paralelo.

Debe conservarse el flujo principal existente:

```text
Documento .clrs
      ↓
LanguageFrontend
      ↓
AST validado
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

La GUI se incorpora en las fronteras ya existentes:

```text
Documento .clrs
      ↓
Frontend / AST / Semántica
      ↓
Biblioteca estándar
      ├── funciones existentes
      └── GUI
            ↓
JavaScriptGenerator
      ↓
Runtime estándar + Runtime GUI
      ↓
Node.js
      ↓
node-gtk
      ↓
GTK 4
```

Se mantienen como invariantes del proyecto:

- `LanguageFrontend` continúa siendo la entrada compartida del lenguaje.
- El AST continúa siendo la frontera estable para los consumidores.
- `CompilationService` continúa siendo la fachada principal de compilación.
- No se crea un segundo parser, analizador semántico ni ejecutor de programas.
- `src/` continúa siendo independiente de VS Code.
- Las capacidades que requieran filesystem, procesos, rutas de la extensión o instalación de dependencias se resuelven en la infraestructura adecuada y se entregan a `src/` mediante contratos o configuración.
- El JavaScript generado continúa siendo ESM.
- Los errores dirigidos al usuario continúan presentándose en español.
- Los identificadores higiénicos existentes del compilador no se sustituyen ni se reutilizan como identidad de componentes GUI.
- La estructura y funcionalidad pertenecen a CLRS; la apariencia visual general se delega al sistema de temas de GTK.
- Si el programa no selecciona un tema o modo, CLRS no debe imponer una paleta propia y GTK conserva la configuración normal del entorno.

---

## 3. Alcance

La primera versión de la GUI comprende 24 componentes públicos:

```text
Window
ApplicationWindow

Label
Entry
PasswordEntry
TextView

Button
CheckButton
ToggleButton
LinkButton

SpinButton
Scale
ProgressBar
Spinner

DropDown
Calendar

Image

Box
Grid
ScrolledWindow

ListBox
ColumnView

AlertDialog
FileDialog
```

`AboutDialog` queda explícitamente fuera del catálogo inicial.

El detalle normativo de factories, propiedades, eventos y acciones pertenece a `api-catalog.md`.

---

## 4. Modelo conceptual

### 4.1 CLRS no incorpora objetos GUI como tipo de dato

La GUI no debe introducir en CLRS tipos públicos como:

```text
Objeto
Widget
Referencia
Handle
GtkButton
GObject
```

Un componente GTK existe únicamente en la capa de runtime.

El programa utiliza los tipos y valores ordinarios de CLRS. En particular, la identidad pública de un componente se expresa mediante una **cadena**.

Ejemplo:

```clrs
BOTON("aceptar", "Aceptar")

ESTABLECER(
    "aceptar",
    "texto",
    "Guardar"
)
```

También es válido almacenar el identificador en una variable:

```clrs
boton = "aceptar"

BOTON(
    boton,
    "Aceptar"
)

ESTABLECER(
    boton,
    "texto",
    "Guardar"
)
```

La variable `boton` contiene una cadena ordinaria. No contiene un objeto, una referencia especial ni una instancia GTK.

---

## 5. Identidad de componentes

### 5.1 Identificador proporcionado por el programa

Toda función de creación recibe como primer argumento un identificador de componente.

Ejemplo:

```clrs
BOTON("guardar", "Guardar")
ENTRADA("nombre")
ETIQUETA("titulo", "Usuario")
```

El identificador:

- debe ser una cadena;
- es elegido libremente por el programador;
- no requiere prefijos ni nomenclatura especial;
- debe ser único dentro de la sesión GUI del programa;
- no determina el tipo del componente;
- puede almacenarse, copiarse, pasarse como argumento o construirse mediante operaciones normales de cadenas.

No se debe inferir el tipo a partir del texto:

```text
"boton-1"    ≠ necesariamente Button
"principal"  ≠ necesariamente Window
```

La única autoridad sobre el tipo es el registro interno del runtime.

### 5.2 Espacio único de identificadores GUI

Dentro de una ejecución, un identificador GUI corresponde como máximo a un componente.

Esto debe rechazarse:

```clrs
BOTON("principal", "Aceptar")
ENTRADA("principal")
```

El segundo intento debe producir un error de interfaz por identificador duplicado.

La unicidad se aplica entre tipos distintos. No existe un namespace independiente para botones, ventanas, entradas u otros componentes.

---

## 6. Aislamiento por programa

La identidad proporcionada por el usuario no debe utilizarse como clave global sin aislamiento.

El runtime debe reutilizar el mecanismo existente de **key privada de programa/ejecución** para aislar recursos y evitar colisiones entre programas o sesiones.

El modelo conceptual recomendado es:

```text
registroGUI
│
├── programKey_A
│      ├── "aceptar" → ComponentRecord
│      ├── "nombre"  → ComponentRecord
│      └── "ventana" → ComponentRecord
│
└── programKey_B
       ├── "aceptar" → ComponentRecord
       └── "ventana" → ComponentRecord
```

La estructura puede implementarse como:

```js
Map<programKey, Map<componentId, ComponentRecord>>
```

o mediante una representación equivalente que preserve las mismas garantías.

La `programKey`:

- pertenece al runtime;
- no es visible desde CLRS;
- no debe incorporarse al identificador que ve el usuario;
- no debe obligar a modificar el identificador original;
- debe permitir limpiar de forma inequívoca todos los componentes de una ejecución.

No se deben concatenar nombres del usuario y claves privadas como contrato público.

---

## 7. Registro interno de componentes

Cada componente creado se registra conceptualmente mediante un registro similar a:

```js
{
    type: "Button",
    gtk: gtkButton
}
```

El registro mínimo debe conservar:

- identificador público;
- tipo canónico CLRS del componente;
- objeto GTK asociado;
- pertenencia a la `programKey`.

Puede conservar metadatos privados adicionales cuando sean necesarios para:

- controladores de eventos;
- modelos GTK;
- buffers;
- gestos;
- recursos auxiliares;
- cleanup;
- operaciones asincrónicas.

La configuración global de tema no pertenece a cada `ComponentRecord`; se conserva en la sesión GUI de la ejecución.

Dichos metadatos no forman parte de la API pública.

### 7.1 Resolución

Toda operación sobre un componente sigue el mismo principio:

```text
identificador CLRS
      ↓
programKey actual
      ↓
registro GUI
      ↓
ComponentRecord
      ↓
tipo canónico
      ↓
catálogo de capacidades
      ↓
objeto GTK
```

Ejemplo:

```clrs
ESTABLECER(
    "guardar",
    "texto",
    "Continuar"
)
```

se resuelve conceptualmente como:

```text
"guardar"
    ↓
registro
    ↓
Button
    ↓
propiedad "texto"
    ↓
adaptador de propiedad
    ↓
Gtk.Button
```

---

## 8. Separación entre API CLRS y GTK

CLRS no debe ser un reflejo directo de la API de GTK.

El runtime actúa como una capa de adaptación:

```text
CLRS                         GTK / node-gtk

BOTON(...)            →      Gtk.Button
"texto"               →      label
"habilitado"          →      sensitive
"clic"                →      clicked
ESTABLECER(...)       →      setter GTK
OBTENER(...)          →      getter GTK
CONECTAR(...)         →      signal/controller/gesture
```

Esto permite:

- utilizar terminología coherente con CLRS;
- ocultar diferencias accidentales entre widgets;
- normalizar propiedades equivalentes;
- presentar errores comprensibles;
- evitar que cambios menores de GTK se filtren al lenguaje;
- mantener un backend sustituible en el futuro.

Los nombres exactos y mapeos son autoridad de `api-catalog.md`.

---

## 9. Cuatro familias de operaciones

La API GUI se organiza arquitectónicamente en cuatro grupos.

### 9.1 Creación

Cada componente posee una función factory procedural:

```clrs
BOTON(id, ...)
ENTRADA(id, ...)
VENTANA(id, ...)
```

Las funciones de creación:

1. validan el identificador;
2. comprueban unicidad;
3. crean el objeto GTK;
4. registran tipo y objeto;
5. no devuelven el objeto GTK.

El primer argumento identifica el recurso que será creado.

### 9.2 Propiedades

Las propiedades utilizan las operaciones generales:

```clrs
ESTABLECER(componente, propiedad, dato)
OBTENER(componente, propiedad)
```

`ESTABLECER` y `OBTENER` no deben ejecutar reflexión libre sobre GTK.

Toda propiedad debe existir explícitamente en el catálogo de capacidades del tipo correspondiente.

### 9.3 Eventos

La conexión de eventos utiliza:

```clrs
CONECTAR(
    componente,
    evento,
    FUNCION
)
```

La función CLRS se utiliza como callback.

`CONECTAR` debe consultar el catálogo del tipo antes de crear cualquier conexión GTK.

El backend puede resolver un evento mediante mecanismos diferentes:

```text
signal
gesture
event controller
buffer signal
property notification
callback asincrónico
```

La diferencia permanece oculta para CLRS.

### 9.4 Acciones

Las operaciones que representan comportamiento y no estado se expresan mediante funciones procedurales específicas:

```clrs
MOSTRAR(...)
CERRAR(...)

INICIAR(...)
PARAR(...)


ANEXAR(...)
QUITAR(...)
CONTENER(...)
COLOCAR(...)
```

No se debe forzar una acción dentro de `ESTABLECER` cuando conceptualmente representa una operación.

---

## 10. Catálogo de capacidades

El runtime GUI debe utilizar un catálogo canónico para determinar qué puede hacer cada componente.

El modelo conceptual es:

```text
ComponentType
├── propiedades
│   ├── lectura
│   └── escritura
├── eventos
└── acciones
```

Por ejemplo:

```text
Button
├── propiedades
│   ├── texto
│   ├── marco
│   └── propiedades comunes de Widget
├── eventos
│   └── clic
└── acciones
    ├── MOSTRAR
    └── OCULTAR
```

Una propiedad o evento específico de un componente no debe agregarse al núcleo común únicamente para hacerlo accesible.

La reutilización debe modelarse mediante capacidades compartidas o composición de catálogos, no mediante una falsa universalización.

---

## 11. Propiedades comunes y específicas

El hecho de que muchos componentes compartan capacidades GTK no implica que todos acepten todas las propiedades.

Ejemplo conceptual:

```text
Widget
├── visible
├── habilitado
├── opacidad
├── alineación
└── márgenes

Button
├── capacidades Widget
├── texto
└── marco

Entry
├── capacidades Widget
├── texto
├── marcador
└── editable

ProgressBar
├── capacidades Widget
├── progreso
└── texto
```

La implementación puede reutilizar definiciones comunes, pero la validación pública siempre ocurre contra el tipo efectivo registrado.

---

## 12. Componentes que no son Widgets

No todos los recursos expuestos por la GUI representan un `Gtk.Widget`.

En particular:

```text
AlertDialog
FileDialog
```

deben tratarse como recursos GUI registrados, pero no deben recibir automáticamente propiedades, eventos o acciones de `Widget`.

Esto evita inconsistencias como permitir márgenes, visibilidad o composición de contenedores sobre un recurso que GTK no modela como widget.

El catálogo es la fuente de autoridad, no una supuesta herencia universal.

---

## 13. Ventanas y aplicación GTK

CLRS expone deliberadamente dos conceptos:

```text
VENTANA               → Window
VENTANA_APLICACION    → ApplicationWindow
```

No deben colapsarse en una única abstracción.

### 13.1 Window

`VENTANA` representa una ventana de nivel superior general basada en `Gtk.Window`.

GTK permite asociar también una `Gtk.Window` ordinaria a una `Gtk.Application` mediante su propiedad `application` o mediante `Gtk.Application.add_window()`. Por tanto, la diferencia pública entre `VENTANA` y `VENTANA_APLICACION` no debe explicarse como «administrada frente a no administrada», sino como **ventana general frente a la subclase especializada que integra capacidades de aplicación**.

### 13.2 ApplicationWindow

`VENTANA_APLICACION` representa `Gtk.ApplicationWindow`.

`Gtk.ApplicationWindow` es una subclase de `Gtk.Window` que se integra específicamente con `Gtk.Application` e implementa además integración de acciones de ventana y menús de aplicación.

El runtime debe mantener una instancia coherente de `Gtk.Application` por ejecución GUI cuando se creen `ApplicationWindow`.

Varias `ApplicationWindow` pueden pertenecer a la misma aplicación.

La existencia de `Gtk.Application` es un detalle del runtime; no constituye un componente público adicional de CLRS.

No se debe convertir silenciosamente una `Window` en `ApplicationWindow`, ni viceversa. Ambas funciones públicas deben conservar la clase GTK que prometen.

---

## 14. Composición estructural

CLRS define la estructura de la GUI proceduralmente dentro del mismo lenguaje.

No existe un archivo HTML, XML o lenguaje declarativo obligatorio separado.

Ejemplo conceptual:

```clrs
CAJA(
    "contenido",
    "vertical",
    10
)

ETIQUETA(
    "titulo",
    "Nombre"
)

ENTRADA("nombre")
BOTON("aceptar", "Aceptar")

ANEXAR("contenido", "titulo")
ANEXAR("contenido", "nombre")
ANEXAR("contenido", "aceptar")
```

La relación:

```text
CAJA "contenido"
│
├── ETIQUETA "titulo"
├── ENTRADA "nombre"
└── BOTON "aceptar"
```

es traducida por el runtime a la estructura GTK correspondiente.

Las funciones de composición deben validar tanto el contenedor como el componente hijo.

---

## 15. Ciclo de vida de un componente

El ciclo conceptual es:

```text
identificador CLRS
      ↓
CREAR
      ↓
REGISTRAR
      ↓
CONFIGURAR
      ↓
CONECTAR EVENTOS
      ↓
COMPONER
      ↓
MOSTRAR / UTILIZAR
      ↓
MODIFICAR DURANTE EJECUCIÓN
      ↓
FINALIZAR PROGRAMA
      ↓
LIMPIAR REGISTRO Y RECURSOS
```

La finalización del proceso CLRS debe liberar el estado asociado a su `programKey`.

Una eventual operación pública explícita para destruir componentes sólo debe incorporarse si se define posteriormente en el catálogo. No debe inventarse como consecuencia de esta arquitectura.

---

## 16. Errores del runtime GUI

Los errores de uso deben producir diagnósticos controlados en español.

Como mínimo deben distinguirse:

```text
identificador no válido
identificador duplicado
componente inexistente
propiedad inexistente
propiedad no legible
propiedad no modificable
valor incompatible
evento inexistente
acción incompatible
relación de contención inválida
fallo de inicialización GTK
dependencia node-gtk no disponible
fallo de instalación de dependencia
nombre de tema no válido
modo de tema no válido
tema no disponible cuando GTK permita detectarlo de forma fiable
```

Ejemplos:

```text
Ya existe un componente con el identificador "principal".
```

```text
No existe un componente con el identificador "aceptar".
```

```text
La propiedad "progreso" no está disponible para Button.
```

```text
Button no admite la operación INICIAR.
```

Los errores públicos deben disponer de códigos estables de acuerdo con las convenciones vigentes del proyecto.

Los detalles técnicos de `node-gtk`, GTK, rutas y procesos pueden registrarse internamente sin filtrarse innecesariamente al usuario.

---

## 17. Biblioteca estándar

GUI forma parte de la biblioteca estándar de CLRS.

Esto incluye tanto las funciones que operan sobre componentes como la configuración global de tema:

```text
ESTABLECER_TEMA
OBTENER_TEMA
ESTABLECER_MODO_TEMA
OBTENER_MODO_TEMA
```

Sus funciones deben incorporarse al mismo catálogo canónico utilizado por las demás funciones integradas para que puedan participar en:

- resolución semántica;
- autocompletado;
- firmas;
- hover/ayuda;
- documentación;
- generación JavaScript;
- clasificación de efectos cuando corresponda.

No debe crearse una segunda biblioteca estándar paralela.

### 17.1 Runtime GUI incluido

La implementación fuente del runtime GUI pertenece a CLRS y debe existir como una única fuente de verdad.

El runtime GUI puede materializarse dentro del JavaScript generado, pero no debe mantenerse una implementación diferente para:

```text
ejecución
exportación
pruebas
```

Las diferentes salidas pueden cambiar la forma de resolver dependencias externas, pero deben reutilizar el mismo núcleo de comportamiento GUI.

---

## 18. Temas y apariencia visual

La primera integración GUI de CLRS no incorpora un sistema propio de estilos por componente.

La responsabilidad se divide así:

```text
CLRS
│
├── estructura
├── funcionalidad
├── estado
├── eventos
└── selección opcional de tema
        ↓
      GTK
        ↓
 sistema de temas
        ↓
 apariencia final
```

El objetivo es que el programador pueda construir una interfaz completa sin tener que definir:

```text
colores
tipografías
bordes
radios
padding visual
hover
pressed
focus
CSS
```

GTK continúa siendo la autoridad sobre esos aspectos mediante su sistema de temas.

### 18.1 Comportamiento predeterminado

Si un programa no configura explícitamente la apariencia:

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

CLRS no debe cargar una hoja CSS propia para reconstruir la apariencia ni seleccionar obligatoriamente un tema concreto.

El runtime utiliza la configuración normal que GTK tenga disponible en el entorno de ejecución.

### 18.2 Configuración global de tema

La biblioteca estándar GUI expone configuración global de sesión mediante:

```clrs
ESTABLECER_TEMA(nombre)
OBTENER_TEMA()

ESTABLECER_MODO_TEMA(modo)
OBTENER_MODO_TEMA()
```

Los modos públicos normalizados son:

```text
"sistema"
"claro"
"oscuro"
```

Estas funciones no pertenecen a ningún componente particular.

Conceptualmente:

```text
GuiRuntimeSession
├── themeName
├── themeMode
├── application
├── components
└── callbacks
```

La fuente de verdad de sus firmas, valores y errores es `api-catalog.md`.

### 18.3 Correspondencia con GTK

La selección del nombre de tema se basa en la configuración global de GTK, principalmente `Gtk.Settings` y su propiedad `gtk-theme-name`.

CLRS no debe copiar ni reimplementar internamente los temas GTK.

La intención arquitectónica es:

```text
ESTABLECER_TEMA("Adwaita")
        ↓
runtime GUI
        ↓
Gtk.Settings
        ↓
sistema de temas GTK
```

La preferencia:

```clrs
ESTABLECER_MODO_TEMA(
    "oscuro"
)
```

representa una preferencia global de variante/apariencia y no un segundo tema independiente.

Como el mínimo arquitectónico continúa siendo GTK 4.10, la implementación no puede exigir silenciosamente una propiedad introducida en versiones posteriores. El runtime debe utilizar un mecanismo compatible con la versión efectiva de GTK y conservar la semántica pública:

```text
"sistema"
"claro"
"oscuro"
```

### 18.4 El tema no forma parte del registro de componentes

El tema no se almacena como:

```text
"boton" → theme
"entrada" → theme
```

El `Map` de componentes conserva exclusivamente recursos GUI identificables.

La configuración de apariencia pertenece a la sesión:

```text
programKey
    ↓
GuiRuntimeSession
        ├── theme
        └── componentRegistry
```

Por tanto:

```clrs
ESTABLECER_TEMA(
    "Adwaita"
)
```

afecta a la interfaz de esa ejecución y no requiere recorrer desde CLRS cada componente.

### 18.5 Cambios durante la ejecución

Aunque se recomienda configurar el tema antes de crear la interfaz, las funciones de tema pueden invocarse durante la ejecución.

GTK es responsable de volver a calcular el estilo de los widgets existentes según sus capacidades.

CLRS no debe recrear manualmente todos los componentes para simular el cambio.

### 18.6 Aislamiento

La intención pública es que cada programa CLRS posea su propia configuración de tema dentro de su sesión GUI.

Actualmente las ejecuciones normales de CLRS ocurren en procesos Node separados, lo que proporciona una frontera natural de aislamiento.

Si en el futuro varias ejecuciones compartieran un mismo proceso/display GTK, el runtime deberá revisar cuidadosamente las implicaciones de `Gtk.Settings`, ya que determinadas configuraciones GTK pueden aplicarse a nivel de display y no ser intrínsecamente locales a un widget.

La `programKey` continúa siendo la identidad privada de la sesión, pero no debe prometer aislamiento de tema más fuerte que el que GTK permita en el backend utilizado.

### 18.7 No exponer CSS en la primera versión

La primera API GUI no incorpora:

```text
ESTABLECER_CSS
CARGAR_CSS
CLASE_CSS
ESTILO
COLOR_FONDO
COLOR_TEXTO
FUENTE
```

Esto es una decisión arquitectónica deliberada.

No impide utilizar `Gtk.CssProvider` internamente en el futuro, pero CSS no forma parte del contrato público inicial.

Una futura API de estilos deberá especificarse por separado y no debe aparecer accidentalmente como escape genérico hacia GTK.

### 18.8 Exportación

La selección de tema pertenece al programa y debe sobrevivir a la exportación.

Ejemplo:

```clrs
ESTABLECER_TEMA(
    "Adwaita"
)
```

debe conservar el mismo significado cuando el programa se ejecute como proyecto JavaScript exportado.

No se debe depender de:

```text
VS Code
tema de VS Code
extensionRoot
```

para aplicar el tema.

Si el programa no configura ninguno, el proyecto exportado utiliza la configuración GTK del sistema donde se ejecute.

---

## 19. Dependencia externa `node-gtk`

`node-gtk` es una dependencia externa del runtime GUI, no código fuente de CLRS.

La versión fijada por esta especificación es:

```text
node-gtk 4.1.1
```

No se debe utilizar:

```text
node-gtk@latest
```

en la instalación administrada por CLRS ni en los artefactos exportados mientras esta especificación mantenga `4.1.1`.

Una actualización de versión debe ser una decisión explícita del proyecto, acompañada por pruebas de compatibilidad y actualización de las especificaciones correspondientes.

### 18.1 No copiar `node-gtk` a `src/`

No se debe:

- copiar el código fuente de `node-gtk` dentro de CLRS;
- mantener un fork implícito en `src/`;
- depender de rutas internas fijas del paquete;
- asumir manualmente cuál es su archivo de entrada.

npm continúa siendo la autoridad de distribución de la dependencia.

---

## 20. Instalación privada y perezosa

`node-gtk` no se incluye obligatoriamente dentro del VSIX inicial.

La extensión debe provisionarlo únicamente cuando un programa realmente requiera GUI.

La instalación npm privada de `node-gtk` y la disponibilidad de las bibliotecas nativas GTK son dos comprobaciones distintas:

- **Windows:** la distribución vigente de `node-gtk` publica binarios precompilados y empaqueta GTK 4 / Adwaita para las bibliotecas precompiladas soportadas; para este caso, `npm install node-gtk@4.1.1` debe ser la vía normal de provisionamiento.
- **Linux:** `node-gtk` requiere las bibliotecas GTK nativas disponibles en el sistema. CLRS puede instalar privadamente el paquete npm, pero no debe asumir que eso instala GTK 4 del sistema.
- **macOS:** `node-gtk` requiere igualmente las bibliotecas GTK nativas instaladas en el sistema.

CLRS no debe ejecutar automáticamente `apt`, `dnf`, `pacman`, `brew` u otros gestores de paquetes del sistema. Debe verificar compatibilidad y, si faltan bibliotecas nativas, presentar un diagnóstico explícito con la acción requerida.

### Capacidad gráfica y orientación al usuario final

La dependencia npm privada `node-gtk@4.1.1` y GTK son requisitos distintos. Un programa sin GUI no comprueba ninguno. Un programa que utiliza el catálogo GUI activa únicamente `gui`: se asegura la instalación privada del binding y se comprueba que GTK 4 puede cargarse y que su versión efectiva es al menos 4.10.

La validación se ejecuta en un proceso Node separado, nunca carga el addon en el Extension Host. La misma política se incorpora al JavaScript exportado. CLRS administra únicamente dependencias npm privadas; no instala GTK ni otros paquetes nativos del sistema operativo.

En Windows se comprueba primero la instalación privada y sus bibliotecas empaquetadas antes de atribuir el fallo a GTK del sistema. Linux/macOS reciben orientación para instalar GTK con las herramientas apropiadas; CLRS no las ejecuta ni solicita privilegios.

La versión nativa detectada debe satisfacer al menos GTK `4.10`, debido a `AlertDialog` y `FileDialog`.

La distribución vigente de `node-gtk 4.1.1` ofrece binarios precompilados para Node.js 22, 24 y 26. La referencia actual del proyecto CLRS es Node.js 22; la verificación de dependencia debe rechazar o diagnosticar de forma controlada un runtime Node no soportado antes de intentar una ejecución GUI.

Ubicación conceptual:

```text
<extensionRoot>/
└── .runtime/
    ├── npm-cache/
    └── packages/
        ├── package.json
        ├── package-lock.json
        └── node_modules/
            └── node-gtk/
```

La ubicación concreta puede ajustarse mientras cumpla estas propiedades:

- es privada a la extensión;
- no requiere instalación global;
- no modifica el proyecto del usuario;
- puede eliminarse junto con la instalación de la extensión;
- permite resolver determinísticamente `node-gtk`;
- no obliga a incluir sus binarios nativos dentro del código fuente de CLRS.

---

## 21. Detección de uso GUI

Aunque GUI forme parte permanente de la biblioteca estándar, la dependencia nativa no debe instalarse para programas que no utilizan GUI.

Ejemplo:

```clrs
escribir "Hola"
```

no debe provocar una descarga de `node-gtk`.

La detección debe basarse en información estructurada del lenguaje:

```text
AST
SemanticModel
catálogo canónico de biblioteca estándar
```

No debe realizarse mediante búsquedas textuales o expresiones regulares sobre el código fuente.

Flujo conceptual:

```text
programa CLRS
      ↓
análisis normal
      ↓
¿existen llamadas a funciones GUI?
      │
      ├── no → pipeline convencional
      │
      └── sí
           ↓
      asegurar node-gtk 4.1.1
           ↓
      continuar pipeline convencional
```

---

## 22. Autorrevisión de la dependencia

Antes de ejecutar un programa que utiliza GUI, la infraestructura debe comprobar que la instalación privada sea utilizable.

No basta con comprobar que exista un directorio llamado:

```text
node_modules/node-gtk
```

La revisión debe comprobar, como mínimo:

1. que la versión de Node utilizada para la ejecución sea compatible con el binding fijado;
2. que `node-gtk@4.1.1` pueda resolverse desde el entorno privado;
3. que el addon nativo pueda cargarse;
4. que `Gtk` pueda requerirse mediante GObject Introspection con API `4.0`;
5. que la versión efectiva de GTK satisfaga el mínimo `4.10` requerido por el catálogo inicial.

Si `node-gtk`:

- no existe;
- está incompleto;
- no puede resolverse;
- no puede cargarse;

el sistema debe intentar provisionar nuevamente la versión npm fijada.

Si lo que falta es una biblioteca nativa del sistema en Linux o macOS, CLRS debe detener la ejecución GUI y emitir un diagnóstico accionable; no debe modificar automáticamente el sistema operativo.

La instalación automática debe ocurrir antes de lanzar el programa CLRS que requiere GUI.

Los detalles completos del provisionamiento pertenecen a `runtime-pipeline.md`.

---

## 23. Resolución del paquete

El runtime no debe asumir una estructura interna como:

```text
node-gtk/lib/index.js
node-gtk/src/index.js
```

La infraestructura debe utilizar la resolución de módulos de Node/npm para obtener el entry point real de la instalación privada.

El resultado puede convertirse a una URL `file://` válida para ESM cuando sea necesario.

La ruta absoluta es un detalle válido **únicamente para la ejecución administrada por CLRS**.

---

## 24. JavaScript temporal de ejecución

La ejecución convencional continúa generando un único artefacto JavaScript temporal.

El runtime GUI debe quedar incorporado en ese mismo archivo generado.

No se requiere un segundo `GuiRuntime.js` temporal o externo.

Modelo:

```text
programa.clrs
      ↓
programa temporal.js
      ├── runtime estándar
      ├── runtime GUI
      └── programa transpilado
             ↓
           Node.js
             ↓
          node-gtk privado
```

La **fuente canónica** del runtime GUI forma parte de la biblioteca estándar aunque un programa concreto no utilice GUI. Sin embargo, un programa sin GUI no debe cargar ni requerir `node-gtk`.

La generación puede cumplir esta regla de dos formas válidas:

- materializando el código común del runtime GUI pero dejando la carga de GTK detrás de una inicialización condicionada; o
- omitiendo del artefacto concreto la sección GTK-dependiente cuando el análisis estructurado demuestre que no existe uso GUI.

En ningún caso debe existir un `import` estático incondicional de `node-gtk` en un programa que no utiliza GUI, porque ESM resolvería y cargaría esa dependencia antes de ejecutar el cuerpo del programa.

La ruta privada absoluta de `node-gtk` sólo puede materializarse cuando el artefacto es de ejecución administrada, el programa requiere GUI y la dependencia ha sido validada.

El artefacto temporal continúa sujeto al ciclo de limpieza vigente de `CompilationArtifact`/`FileSystemEmitter`.

Los detalles normativos pertenecen a `runtime-pipeline.md`.

---

## 25. JavaScript exportable

El JavaScript exportado debe conservar el comportamiento del runtime GUI, pero no puede depender de una ruta absoluta de la instalación de CLRS.

La arquitectura distingue:

```text
EJECUCIÓN ADMINISTRADA
→ puede resolver node-gtk desde la instalación privada de CLRS

EXPORTACIÓN
→ debe resolver node-gtk como dependencia del proyecto exportado
```

La exportación GUI produce como unidad fuente portable:

```text
app/programa/
├── programa.js
├── prepare-packable.cjs
├── bootstrap.cjs
├── package.json
└── package-lock.json
```

`package.json` y `package-lock.json` deben fijar la versión compatible indicada por la especificación, actualmente:

```text
node-gtk 4.1.1
```

`programa.js` no debe contener una ruta absoluta hacia la extensión. Continúa
siendo el entry normal de `npm start`; los dos helpers pertenecen exclusivamente
a la construcción posterior mediante `pkg`. La exportación inicial no incluye
`node_modules`, la variante packable, `bin` ni `dist`.

Los detalles pertenecen a `javascript-export.md`.

---

## 26. Una sola implementación del runtime GUI

Debe existir una única implementación fuente del comportamiento GUI.

No se permiten ramas funcionalmente independientes como:

```text
GuiRuntimeForExecution
GuiRuntimeForExport
GuiRuntimeForTests
```

La misma regla se aplica al sistema de temas: ejecución y exportación deben reutilizar la misma lógica de `ESTABLECER_TEMA` y `ESTABLECER_MODO_TEMA`.

que evolucionen por separado.

El mismo runtime debe materializarse bajo configuraciones diferentes:

```text
Runtime GUI canónico
      │
      ├── ejecución
      │     └── resolución privada de node-gtk
      │
      └── exportación
            └── resolución por dependencia npm del proyecto
```

Esto evita divergencias entre ejecutar un `.clrs` y ejecutar el JavaScript exportado.

---

## 27. Integración ESM

Todo código nuevo debe respetar la convención vigente de ECMAScript Modules.

`node-gtk 4.1.1` declara soporte ESM. La adaptación de CLRS debe seguir la superficie pública vigente del paquete y no traducir ejemplos históricos de CommonJS/GTK 3 como si fueran el contrato actual.

Las rutas absolutas de módulos que deban incorporarse a un artefacto temporal deben convertirse mediante mecanismos estándar de Node, por ejemplo `pathToFileURL`, en lugar de construir manualmente URLs o rutas específicas de Windows.

No deben emitirse imports del tipo:

```js
import ... from "C:\Users\...";
```

Debe utilizarse una URL ESM correctamente resuelta cuando aplique:

```text
file:///C:/...
```

La infraestructura debe encargarse de esta conversión; el programa CLRS no conoce la ruta.

---

## 28. Separación de responsabilidades propuesta

La integración debe respetar aproximadamente las siguientes responsabilidades, adaptándolas a la estructura real del repositorio sin introducir dependencias invertidas.

```text
src/standard-library/
│
├── catálogo GUI
├── metadatos de firmas
├── propiedades/eventos/acciones canónicas
├── configuración global de tema
└── fuente del runtime GUI

src/compiler/
│
├── detectar necesidades de generación
├── materializar runtime estándar
├── materializar runtime GUI
└── producir CompilationArtifact

src/application/ o infraestructura neutral
│
└── contratos necesarios para dependencias externas

extension/
│
├── conocer extensionRoot
├── provisionar dependencia privada
├── resolver instalación de node-gtk
└── entregar configuración al caso de uso

NodeProgramRunner
└── ejecutar el artefacto generado
```

La ubicación exacta de nuevos archivos debe seguir las convenciones existentes del repositorio y puede refinarse durante la implementación.

Lo obligatorio es la dirección de dependencias:

```text
dominio/lenguaje
      ✕ no conoce VS Code

infraestructura/extensión
      ✓ conoce filesystem/procesos/ruta privada

compilador
      ✓ recibe información resuelta
      ✕ no debe descubrir por sí mismo la instalación de VS Code
```

---

## 27.1 Restricciones GTK que afectan al catálogo

Las siguientes características de GTK son relevantes para las especificaciones derivadas:

- `Gtk.ApplicationWindow` hereda de `Gtk.Window`.
- `Gtk.AlertDialog` y `Gtk.FileDialog` son objetos `GObject`, no subclases de `Gtk.Widget`, y existen desde GTK 4.10.
- `Gtk.FileDialog` utiliza una API asincrónica para abrir, guardar o seleccionar archivos.
- `Gtk.Image` continúa siendo un widget válido en GTK 4; se orienta especialmente a imágenes/iconos, mientras `Gtk.Picture` cubre otros casos de presentación. La API pública inicial de CLRS conserva deliberadamente `IMAGEN` → `Gtk.Image`.
- `Gtk.ColumnView` es un widget basado en modelos y factories. La API CLRS puede simplificar su uso, pero el runtime debe respetar el modelo GTK en lugar de simular una tabla mediante widgets no relacionados.
- Los eventos de GTK 4 pueden provenir de señales del widget, `Gtk.EventController`, gestos u objetos auxiliares. `CONECTAR` debe ocultar esa diferencia sin inventar capacidades no soportadas.

Estas restricciones se detallarán como mapeos normativos en `api-catalog.md`.

---

## 29. No-alcance

Esta especificación no define cambios funcionales en:

- generador de diagramas de flujo;
- analizador de costo;
- analizador de complejidad;
- BROKER.95;
- marco de pruebas funcionales;
- DAP;
- modelo curricular;
- Webviews existentes.

La incorporación de GUI no autoriza a reestructurar esos subsistemas.

Tampoco forma parte de esta primera integración:

```text
extraer colores del tema de VS Code
traducir un tema de VS Code a CSS GTK
generar una paleta propia de CLRS
exponer CSS de usuario
```

La apariencia se delega al sistema de temas GTK.

Cuando alguno requiera compatibilidad con las nuevas funciones de biblioteca estándar, su comportamiento debe integrarse mediante los contratos vigentes y con el cambio mínimo necesario.

Las decisiones específicas para esos módulos se definirán fuera de este documento.

---

## 30. Invariantes arquitectónicos de GUI

La implementación se considera incompatible con esta especificación si viola cualquiera de estos invariantes:

1. **CLRS no expone objetos GTK.**
2. **Los componentes se identifican públicamente mediante cadenas CLRS ordinarias.**
3. **La nomenclatura del identificador es libre.**
4. **El tipo del componente nunca se infiere del identificador.**
5. **Los identificadores GUI son únicos dentro de la ejecución.**
6. **El registro está aislado mediante la key privada del programa.**
7. **GTK y `node-gtk` pertenecen al runtime, no al modelo paradigmático de CLRS.**
8. **GUI forma parte de la biblioteca estándar existente; no existe una biblioteca paralela.**
9. **`ESTABLECER`, `OBTENER` y `CONECTAR` sólo operan sobre capacidades declaradas en el catálogo.**
10. **Las acciones se mantienen separadas de las propiedades cuando representan comportamiento.**
11. **`Window` y `ApplicationWindow` continúan siendo conceptos públicos distintos.**
12. **`AlertDialog` y `FileDialog` no adquieren automáticamente capacidades de Widget.**
13. **El runtime GUI posee una única implementación fuente.**
14. **La ejecución GUI continúa usando el pipeline convencional de compilación y Node.**
15. **`node-gtk` se instala de forma privada y perezosa.**
16. **Un programa sin GUI no obliga a instalar ni cargar `node-gtk`.**
17. **La versión de `node-gtk` está fijada explícitamente; actualmente es `4.1.1`.**
18. **La resolución de `node-gtk` no depende de su estructura interna.**
19. **El JavaScript temporal puede usar una ruta privada absoluta resuelta por la extensión.**
20. **El JavaScript exportado nunca depende de una ruta absoluta de CLRS.**
21. **La ejecución temporal continúa produciendo un único archivo JavaScript generado.**
22. **La incorporación de GUI no introduce un parser, semántica o runner alternativos.**
23. **El catálogo inicial exige GTK 4.10 o superior.**
24. **CLRS no instala automáticamente dependencias nativas del sistema mediante gestores de paquetes.**
25. **Un programa sin GUI no contiene una carga ESM incondicional de `node-gtk`.**
26. **Si el programa no configura tema, CLRS no impone uno.**
27. **El tema es configuración global de la sesión GUI, no propiedad individual de un componente.**
28. **La primera API no expone CSS ni setters estéticos arbitrarios.**
29. **La configuración de tema debe conservar la misma semántica en ejecución administrada y exportación.**
30. **La implementación de modo claro/oscuro no puede elevar silenciosamente el mínimo GTK 4.10.**

---

## 31. Criterios de aceptación arquitectónicos

Una implementación inicial satisface esta especificación cuando puede demostrarse que:

```text
A. Programa sin GUI
   → compila y ejecuta mediante el pipeline existente
   → no instala node-gtk
   → no carga GTK

B. Primer programa con GUI
   → se reconoce estructuralmente el uso de GUI
   → se valida node-gtk privado
   → si falta, se instala node-gtk 4.1.1
   → se resuelve su entry point sin asumir rutas internas
   → se genera un único JS temporal
   → el runtime GUI está incorporado
   → el programa se ejecuta mediante Node

C. Ejecución GUI posterior
   → reutiliza la instalación válida
   → no reinstala innecesariamente la dependencia

D. Identidad
   → BOTON("x", ...) registra "x"
   → ESTABLECER("x", ...) resuelve el mismo componente
   → un segundo componente "x" es rechazado
   → otro programa puede utilizar "x" sin colisión gracias a programKey

E. Encapsulación
   → ningún objeto Gtk.* es visible desde CLRS
   → ninguna propiedad GTK no catalogada puede invocarse por reflexión libre

F. Exportación
   F1. Programa sin GUI
   → genera únicamente app/<programa>/<programa>.js
   → no invoca npm ni incluye node-gtk

   F2. Programa con GUI
   → genera un proyecto fuente de cinco archivos bajo app/<programa>/
   → incorpora prepare-packable.cjs y bootstrap.cjs para el build posterior
   → fija node-gtk 4.1.1
   → npm start conserva el recorrido JavaScript normal
   → build:win/build:unix generan dist sólo para la plataforma host
   → no contiene rutas absolutas hacia la extensión

G. Tema predeterminado
   → programa no llama funciones de tema
   → CLRS no establece paleta ni CSS propio
   → GTK conserva su configuración normal

H. Tema explícito
   → ESTABLECER_TEMA("Adwaita") actualiza la configuración global
   → OBTENER_TEMA() devuelve el nombre vigente
   → el cambio no requiere recrear el registro de componentes

I. Modo
   → "sistema", "claro" y "oscuro" son los únicos valores públicos normalizados
   → un modo inválido produce error controlado
   → el backend mantiene compatibilidad con GTK 4.10

J. Exportación de tema
   → la configuración explícita forma parte del comportamiento de programa.js
   → no depende del tema de VS Code ni de la instalación de CLRS
```

---

## 32. Documentos derivados

Esta especificación define la arquitectura general. Las decisiones detalladas se distribuyen únicamente en tres documentos derivados:

```text
architecture.md
        │
        ├── api-catalog.md
        │      API pública, componentes,
        │      propiedades, eventos y acciones
        │
        ├── runtime-pipeline.md
        │      detección, provisionamiento,
        │      resolución, generación temporal
        │      y ejecución
        │
        └── javascript-export.md
               generación portable,
               package.json, package-lock.json
               y dependencia npm
```

En caso de conflicto:

- `architecture.md` tiene autoridad sobre fronteras, invariantes y responsabilidades;
- `api-catalog.md` tiene autoridad sobre la API pública GUI;
- `runtime-pipeline.md` tiene autoridad sobre ejecución y dependencia privada;
- `javascript-export.md` tiene autoridad sobre artefactos exportables.

Ninguno de estos documentos reemplaza las invariantes generales documentadas en
[`../README.md`](../README.md).

---

## 33. Referencias externas de implementación

Fuentes que deben consultarse durante la implementación y revisión:

- GTK 4 API: <https://docs.gtk.org/gtk4/>
- `Gtk.ApplicationWindow`: <https://docs.gtk.org/gtk4/class.ApplicationWindow.html>
- `Gtk.Window:application`: <https://docs.gtk.org/gtk4/property.Window.application.html>
- `Gtk.Application.add_window()`: <https://docs.gtk.org/gtk4/method.Application.add_window.html>
- Diálogos GTK 4: <https://docs.gtk.org/gtk4/section-dialogs.html>
- `Gtk.AlertDialog`: <https://docs.gtk.org/gtk4/class.AlertDialog.html>
- `Gtk.FileDialog`: <https://docs.gtk.org/gtk4/class.FileDialog.html>
- `Gtk.Image`: <https://docs.gtk.org/gtk4/class.Image.html>
- `Gtk.ColumnView`: <https://docs.gtk.org/gtk4/class.ColumnView.html>
- `node-gtk` npm: <https://www.npmjs.com/package/node-gtk>
- `node-gtk` repository: <https://github.com/romgrk/node-gtk>

La documentación oficial de GTK tiene prioridad para semántica de GTK; la documentación vigente de `node-gtk` tiene prioridad para resolución del binding, compatibilidad de Node, instalación y comportamiento específico del paquete.

---

## 34. Referencias específicas de temas

- `Gtk.Settings`: <https://docs.gtk.org/gtk4/class.Settings.html>
- `Gtk.Settings:gtk-theme-name`: <https://docs.gtk.org/gtk4/property.Settings.gtk-theme-name.html>
- GTK CSS overview: <https://docs.gtk.org/gtk4/css-overview.html>
- `Gtk.CssProvider`: <https://docs.gtk.org/gtk4/class.CssProvider.html>

La propiedad `gtk-theme-name` es la referencia principal para la selección por nombre. Las preferencias claro/oscuro deben implementarse respetando las capacidades reales de la versión GTK efectiva y el mínimo 4.10 definido por esta arquitectura.

---

## 35. Resumen del diseño

```text
                         CLRS
                          │
                  biblioteca estándar
                          │
                    API GUI procedural
                          │
         identificadores de cadena del programa
                          │
                          ▼
                Runtime GUI canónico
                          │
          ┌───────────────┼────────────────┐
          │               │                │
 registro por        catálogo GUI      tema de sesión
 programKey                                │
          │               │          Gtk.Settings
          └───────────────┼────────────────┘
                          ▼
                      node-gtk
                          ▼
                        GTK 4
                          │
                          ▼
                 sistema de temas GTK
```

La regla fundamental es:

> **CLRS describe, identifica y opera los componentes; el runtime posee y administra los objetos GTK, mientras la apariencia general se delega al sistema de temas GTK.**

Esta frontera permite incorporar GUI sin convertir CLRS en un lenguaje orientado a objetos, sin exponer detalles nativos de GTK, sin obligar al estudiante a diseñar estilos y sin crear un pipeline de ejecución alternativo.
