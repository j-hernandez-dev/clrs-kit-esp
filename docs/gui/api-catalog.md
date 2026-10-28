# Catálogo de API GUI

## Catálogo de API GUI de la biblioteca estándar de CLRS

**Estado:** especificación normativa de API pública  
**Fecha de referencia:** 2026-09-09  
**Documento arquitectónico superior:** `architecture.md`  
**Backend:** GTK 4 mediante `node-gtk`  
**Versión fijada de `node-gtk`:** `4.1.1`  
**Versión mínima de GTK:** `4.10`

---

## 0. Propósito y autoridad

Este documento es la **fuente de verdad de la API pública GUI de CLRS**.

Define:

- nombres de funciones visibles desde CLRS;
- firmas de creación;
- propiedades aceptadas por `ESTABLECER` y `OBTENER`;
- eventos aceptados por `CONECTAR`;
- acciones procedurales;
- configuración global de tema;
- tipos y dominios de los valores;
- semántica normalizada entre CLRS y GTK;
- errores que deben producirse cuando una operación no es válida.

No define:

- el provisionamiento privado de `node-gtk`;
- la generación del JavaScript temporal;
- la exportación con npm;
- detalles de rutas de instalación;
- cambios en diagramador, BROKER.95, pruebas o complejidad.

Esos aspectos pertenecen a los demás documentos de la integración GUI.

### 0.1 Fuentes técnicas externas

Para comprobar equivalencia con GTK se debe priorizar:

1. documentación oficial de GTK 4: <https://docs.gtk.org/gtk4/>;
2. documentación de `node-gtk`: <https://www.npmjs.com/package/node-gtk>;
3. repositorio de `node-gtk`: <https://github.com/romgrk/node-gtk>;
4. documentación técnica vigente de CLRS.

Los nombres JavaScript concretos expuestos por `node-gtk` **no son parte del contrato público de CLRS**. Los mapeos de este documento se expresan preferentemente mediante clases, propiedades, métodos y señales canónicas de GTK.

---

## 1. Principios de la API pública

La API GUI debe conservar estas reglas:

1. CLRS permanece procedural.
2. No se agrega un tipo público `Widget`, `Objeto`, `GObject`, `Referencia` ni equivalente.
3. Los componentes se identifican mediante cadenas ordinarias elegidas por el programa.
4. Toda función de creación recibe el identificador como primer argumento.
5. El identificador no determina el tipo.
6. El identificador debe ser único dentro de la ejecución GUI.
7. El objeto GTK nunca se devuelve al programa.
8. `ESTABLECER`, `OBTENER` y `CONECTAR` validan contra este catálogo.
9. No existe reflexión libre sobre propiedades o señales GTK.
10. Los nombres públicos de propiedades y eventos se escriben en español, en minúsculas y con `_`.
11. Las funciones siguen la convención CLRS: mayúsculas y `_`.
12. Las diferencias de señales, controladores, gestos, buffers y objetos auxiliares permanecen dentro del runtime.
13. La apariencia visual general pertenece al sistema de temas de GTK, no a propiedades de estilo individuales expuestas por CLRS.
14. Si el programa no configura un tema, CLRS no interviene y GTK utiliza su configuración normal.

---

## 2. Tipos visibles usados por la GUI

La GUI reutiliza los valores existentes de CLRS.

| Nombre usado en este documento | Representación CLRS |
|---|---|
| `Cadena` | cadena normal |
| `Número` | número normal |
| `Entero` | `Número` validado como entero |
| `Lógico` | valor lógico |
| `Arreglo` | arreglo CLRS |
| `Nulo` | valor nulo |
| `IdentificadorGUI` | `Cadena` utilizada como identificador de componente |
| `FunciónCLRS` | identificador de una función CLRS válido en la posición especial de `CONECTAR` |

`IdentificadorGUI` no constituye un nuevo tipo del lenguaje.

Ejemplo:

```clrs
id = "aceptar"

BOTON(
    id,
    "Aceptar"
)
```

`id` sigue siendo una cadena normal.

---

## 3. Convenciones de propiedades

Cada propiedad declara uno de estos accesos:

| Acceso | Significado |
|---|---|
| `R` | sólo lectura mediante `OBTENER` |
| `W` | sólo escritura mediante `ESTABLECER` |
| `RW` | lectura y escritura |

Ejemplo:

```text
texto : Cadena : RW
```

permite:

```clrs
ESTABLECER(
    "titulo",
    "texto",
    "Nuevo título"
)

texto = OBTENER(
    "titulo",
    "texto"
)
```

Una propiedad existente pero marcada `R` debe producir error si se intenta modificar.

Una propiedad marcada `W` debe producir error si se intenta consultar.

---

## 4. Funciones generales

### 4.1 `ESTABLECER`

```clrs
ESTABLECER(
    componente,
    propiedad,
    dato
)
```

**Parámetros**

```text
componente : IdentificadorGUI
propiedad  : Cadena
dato       : valor compatible con la propiedad
```

**Retorno**

```text
ninguno
```

Proceso conceptual:

```text
programKey
   ↓
componente
   ↓
registro GUI
   ↓
tipo real
   ↓
catálogo del tipo
   ↓
propiedad
   ↓
setter/adaptador GTK
```

No debe acceder a propiedades GObject arbitrarias mediante el nombre suministrado por el usuario.

---

### 4.2 `OBTENER`

```clrs
valor = OBTENER(
    componente,
    propiedad
)
```

**Parámetros**

```text
componente : IdentificadorGUI
propiedad  : Cadena
```

**Retorno**

El tipo declarado por la propiedad.

`OBTENER` tampoco utiliza reflexión libre sobre GTK.

---

### 4.3 `CONECTAR`

```clrs
CONECTAR(
    componente,
    evento,
    FUNCION
)
```

Ejemplo:

```clrs
AL_CLIC(componente)
    escribir componente

CONECTAR(
    "aceptar",
    "clic",
    AL_CLIC
)
```

El tercer argumento es un **identificador de función CLRS resuelto por el compilador**.

No es:

```clrs
"AL_CLIC"
```

y esta capacidad no obliga a convertir las funciones de CLRS en valores de primera clase para todos los contextos del lenguaje.

El compilador/semántica puede tratar la tercera posición de `CONECTAR` como un contrato especial de la biblioteca estándar.

### 4.4 Regla de callbacks

Todos los callbacks GUI reciben como primer argumento el identificador público del componente que originó el evento.

Ejemplo:

```clrs
CAMBIO_ENTRADA(componente, texto)
    escribir componente
    escribir texto
```

Nunca reciben:

```text
Gtk.Widget
Gtk.Button
GObject
punteros
objetos JavaScript
```

Los demás argumentos dependen del evento.

---

## 5. Valores enumerados normalizados

### 5.1 Orientación

```text
"horizontal"
"vertical"
```

Mapeo:

```text
Gtk.Orientation.HORIZONTAL
Gtk.Orientation.VERTICAL
```

---

### 5.2 Alineación de widgets

```text
"inicio"
"centro"
"fin"
"rellenar"
```

Mapeo:

```text
Gtk.Align.START
Gtk.Align.CENTER
Gtk.Align.END
Gtk.Align.FILL
```

---

### 5.3 Justificación de texto

```text
"izquierda"
"derecha"
"centro"
"rellenar"
```

Mapeo:

```text
Gtk.Justification.LEFT
Gtk.Justification.RIGHT
Gtk.Justification.CENTER
Gtk.Justification.FILL
```

---

### 5.4 Ajuste de texto

```text
"ninguno"
"caracter"
"palabra"
"palabra_caracter"
```

Para controles que usan `Pango.WrapMode`, los tres modos con ajuste se traducen a:

```text
Pango.WrapMode.CHAR
Pango.WrapMode.WORD
Pango.WrapMode.WORD_CHAR
```

`"ninguno"` desactiva el ajuste cuando el componente dispone de una propiedad separada para ello.

---

### 5.5 Elipsis

```text
"ninguno"
"inicio"
"medio"
"fin"
```

Mapeo:

```text
Pango.EllipsizeMode.NONE
Pango.EllipsizeMode.START
Pango.EllipsizeMode.MIDDLE
Pango.EllipsizeMode.END
```

---

### 5.6 Posición

```text
"izquierda"
"derecha"
"arriba"
"abajo"
```

Mapeo:

```text
Gtk.PositionType.LEFT
Gtk.PositionType.RIGHT
Gtk.PositionType.TOP
Gtk.PositionType.BOTTOM
```

---

### 5.7 Selección

```text
"ninguno"
"unica"
"explorar"
"multiple"
```

Para `ListBox`:

```text
Gtk.SelectionMode.NONE
Gtk.SelectionMode.SINGLE
Gtk.SelectionMode.BROWSE
Gtk.SelectionMode.MULTIPLE
```

Para `ColumnView`, el runtime debe obtener semántica equivalente mediante el `Gtk.SelectionModel` apropiado.

---

### 5.8 Política de desplazamiento

```text
"automatico"
"siempre"
"nunca"
```

Mapeo:

```text
Gtk.PolicyType.AUTOMATIC
Gtk.PolicyType.ALWAYS
Gtk.PolicyType.NEVER
```

La API inicial no expone `GTK_POLICY_EXTERNAL`.

---

## 6. Propiedades comunes a `Gtk.Widget`

Los siguientes nombres están disponibles para todos los componentes de este catálogo cuya clase GTK derive de `Gtk.Widget`.

No se aplican a:

```text
AlertDialog
FileDialog
```

| Propiedad CLRS | Tipo | Acceso | GTK |
|---|---|---:|---|
| `visible` | Lógico | RW | `GtkWidget:visible` |
| `habilitado` | Lógico | RW | `GtkWidget:sensitive` |
| `opacidad` | Número `0..1` | RW | `GtkWidget:opacity` |
| `ancho_minimo` | Entero `>= -1` | RW | `GtkWidget:width-request` |
| `alto_minimo` | Entero `>= -1` | RW | `GtkWidget:height-request` |
| `expandir_horizontal` | Lógico | RW | `GtkWidget:hexpand` |
| `expandir_vertical` | Lógico | RW | `GtkWidget:vexpand` |
| `alineacion_horizontal` | Cadena enumerada | RW | `GtkWidget:halign` |
| `alineacion_vertical` | Cadena enumerada | RW | `GtkWidget:valign` |
| `margen_superior` | Entero `>= 0` | RW | `GtkWidget:margin-top` |
| `margen_inferior` | Entero `>= 0` | RW | `GtkWidget:margin-bottom` |
| `margen_inicio` | Entero `>= 0` | RW | `GtkWidget:margin-start` |
| `margen_fin` | Entero `>= 0` | RW | `GtkWidget:margin-end` |
| `ayuda` | Cadena o Nulo | RW | `GtkWidget:tooltip-text` |
| `enfocable` | Lógico | RW | `GtkWidget:focusable` |

`ancho_minimo = -1` y `alto_minimo = -1` restauran el comportamiento natural de GTK.

---

## 7. Acciones comunes a widgets

### 7.1 `MOSTRAR`

```clrs
MOSTRAR(componente)
```

Para un widget ordinario:

```text
GtkWidget.show()
```

Para `Window` y `ApplicationWindow` el runtime debe preferir:

```text
GtkWindow.present()
```

porque representa correctamente la presentación de una ventana de nivel superior.

---

### 7.2 `OCULTAR`

```clrs
OCULTAR(componente)
```

Mapeo conceptual:

```text
GtkWidget.hide()
```

---

### 7.3 `ENFOCAR`

```clrs
resultado = ENFOCAR(componente)
```

**Retorno**

```text
Lógico
```

Mapeo conceptual:

```text
GtkWidget.grab_focus()
```

---

## 8. Eventos comunes de entrada

Estos eventos son opcionales para cualquier componente derivado de `Gtk.Widget`.

El runtime crea el controlador o gesto **solamente cuando el programa conecta el evento**.

### 8.1 Eventos de puntero

| Evento CLRS | Callback | Backend GTK |
|---|---|---|
| `puntero_entro` | `FUNCION(id, x, y)` | `GtkEventControllerMotion::enter` |
| `puntero_salio` | `FUNCION(id)` | `GtkEventControllerMotion::leave` |
| `puntero_movido` | `FUNCION(id, x, y)` | `GtkEventControllerMotion::motion` |

`x` y `y` son números en coordenadas del widget.

### 8.2 Gestos de presión

| Evento CLRS | Callback | Backend GTK |
|---|---|---|
| `presionado` | `FUNCION(id, veces, x, y, boton)` | `GtkGestureClick::pressed` |
| `liberado` | `FUNCION(id, veces, x, y, boton)` | `GtkGestureClick::released` |

`boton` utiliza la numeración de botones de puntero de GDK.

Estos eventos no reemplazan eventos semánticos como `"clic"` de `Button`.

### 8.3 Teclado

| Evento CLRS | Callback | Backend GTK |
|---|---|---|
| `tecla_presionada` | `FUNCION(id, tecla, codigo, modificadores[])` | `GtkEventControllerKey::key-pressed` |
| `tecla_liberada` | `FUNCION(id, tecla, codigo, modificadores[])` | `GtkEventControllerKey::key-released` |

`tecla` es el nombre normalizado disponible para el keyval cuando GTK puede resolverlo.

`codigo` conserva el código físico informado por GDK.

`modificadores` es un arreglo de cadenas normalizadas, por ejemplo:

```clrs
["shift", "control"]
```

Para `tecla_presionada`, si la función devuelve `VERDADERO`, el runtime considera manejado el evento cuando el backend permita detener su propagación.

---

# 9. Configuración global de tema

La configuración estética general de una aplicación CLRS se delega al sistema de temas de GTK.

La API inicial **no expone** propiedades públicas como:

```text
color_fondo
color_texto
fuente
borde
radio_borde
css
```

sobre los componentes.

El programador se concentra en:

```text
estructura
estado
eventos
funcionalidad
```

mientras GTK determina la presentación visual mediante su sistema de temas.

La configuración de tema es **global para la sesión GUI del programa** y no pertenece a un componente individual.

---

## 9.1 Comportamiento predeterminado

Si el programa no llama ninguna función de tema:

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

CLRS no debe establecer manualmente un tema ni una paleta.

GTK utiliza la configuración normal disponible en el entorno.

---

## 9.2 `ESTABLECER_TEMA`

```clrs
ESTABLECER_TEMA(nombre)
```

**Parámetros**

```text
nombre : Cadena
```

Ejemplo:

```clrs
ESTABLECER_TEMA(
    "Adwaita"
)
```

La función establece el nombre del tema GTK utilizado por la sesión GUI.

Mapeo conceptual:

```text
Gtk.Settings
    ↓
gtk-theme-name
```

El nombre se trata como un nombre de tema GTK, no como un enum cerrado definido por CLRS.

Por tanto no debe existir una lista fija del lenguaje como:

```text
"tema_1"
"tema_2"
"tema_3"
```

La disponibilidad real de un tema puede depender de la plataforma y del entorno GTK.

### Retorno

```text
ninguno
```

### Validación

Debe rechazarse:

```text
valor no Cadena
Cadena vacía
```

### Semántica

La función afecta a la sesión GUI completa.

No se asocia a:

```text
Window
Button
Entry
otro componente
```

El runtime debe aplicar el cambio mediante `Gtk.Settings` y permitir que GTK vuelva a calcular estilos según su mecanismo normal.

---

## 9.3 `OBTENER_TEMA`

```clrs
tema = OBTENER_TEMA()
```

**Retorno**

```text
Cadena
```

Devuelve el nombre de tema GTK que la sesión está utilizando en ese momento.

Mapeo conceptual:

```text
Gtk.Settings
    ↓
gtk-theme-name
```

Ejemplo:

```clrs
tema = OBTENER_TEMA()

escribir tema
```

---

## 9.4 `ESTABLECER_MODO_TEMA`

```clrs
ESTABLECER_MODO_TEMA(modo)
```

La API pública normaliza tres valores:

```text
"sistema"
"claro"
"oscuro"
```

### `"sistema"`

CLRS deja de imponer una preferencia explícita de modo y permite que el entorno GTK determine la variante aplicable.

### `"claro"`

Solicita una presentación clara cuando el backend GTK y el tema seleccionado dispongan de una variante compatible.

### `"oscuro"`

Solicita una presentación oscura cuando el backend GTK y el tema seleccionado dispongan de una variante compatible.

### Retorno

```text
ninguno
```

### Importante

`ESTABLECER_MODO_TEMA` expresa una **preferencia global de apariencia**, no sustituye al nombre del tema.

Por ejemplo:

```clrs
ESTABLECER_TEMA(
    "Adwaita"
)

ESTABLECER_MODO_TEMA(
    "oscuro"
)
```

representa:

```text
tema base = Adwaita
preferencia = oscuro
```

No debe interpretarse como un segundo nombre de tema independiente.

### Compatibilidad GTK 4.10

El catálogo mantiene GTK 4.10 como mínimo.

La implementación no debe depender obligatoriamente de propiedades de preferencia de color introducidas en versiones posteriores de GTK.

El runtime puede utilizar el mecanismo de variante/tema compatible con la versión efectiva, siempre que preserve la semántica pública:

```text
"sistema"
"claro"
"oscuro"
```

y no eleve silenciosamente el mínimo GTK.

---

## 9.5 `OBTENER_MODO_TEMA`

Se incorpora también la consulta simétrica:

```clrs
modo = OBTENER_MODO_TEMA()
```

**Retorno**

```text
Cadena
```

Valores normalizados:

```text
"sistema"
"claro"
"oscuro"
```

El resultado representa la preferencia que CLRS mantiene para la sesión GUI, no necesariamente una inspección perfecta de todos los detalles internos del tema GTK.

Si el programa nunca ha establecido una preferencia:

```text
"sistema"
```

es el valor inicial.

---

## 9.6 Orden de aplicación

Se recomienda configurar el tema antes de crear la interfaz:

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

    BOTON(
        "aceptar",
        "Aceptar"
    )

    CONTENER(
        "principal",
        "aceptar"
    )

    MOSTRAR(
        "principal"
    )
```

No obstante, las funciones deben seguir siendo válidas después de haber creado widgets.

GTK puede volver a aplicar estilos a los componentes existentes.

---

## 9.7 Tema inexistente o no cargable

La API debe distinguir entre:

```text
nombre inválido desde CLRS
```

y:

```text
tema solicitado no disponible/cargable por GTK
```

Cuando el runtime pueda detectar de forma fiable que el tema no existe o no puede cargarse, debe producir un error GUI controlado.

Cuando GTK aplique un fallback propio sin ofrecer una señal fiable de fallo, CLRS no debe inventar una garantía que GTK no proporciona.

La implementación y las pruebas deben documentar el comportamiento real de la versión GTK soportada.

---

## 9.8 Tema y JavaScript exportado

Las funciones de tema forman parte del runtime GUI canónico.

Por tanto deben comportarse igual en:

```text
ejecución administrada por CLRS
JavaScript exportado
```

El proyecto exportado no depende de VS Code para decidir el tema.

Ejemplo:

```clrs
ESTABLECER_TEMA(
    "Adwaita"
)
```

queda materializado en el comportamiento de `programa.js`.

Si el programa no establece un tema, el JavaScript exportado utiliza la configuración GTK del equipo donde se ejecute.

---

## 9.9 Tema y `programKey`

La preferencia de tema pertenece conceptualmente a la sesión GUI del programa.

Debe asociarse al estado privado de la ejecución:

```text
programKey
    ↓
GuiRuntimeSession
    ├── themeName
    ├── themeMode
    ├── application
    └── components
```

No se almacena como variable global compartida entre ejecuciones independientes de CLRS.

Si GTK expone ciertas configuraciones por display o proceso, el runtime debe preservar la semántica de aislamiento hasta donde lo permita el backend.

---

## 9.10 No exponer CSS en la primera versión

La primera API no incorpora:

```text
ESTABLECER_CSS
CARGAR_CSS
CLASE_CSS
ESTILO
COLOR
FUENTE
```

Esto es deliberado.

El objetivo de la primera integración es:

> permitir que el estudiante construya estructura y comportamiento mientras GTK conserva la responsabilidad estética mediante temas.

Una futura API de estilos puede añadirse mediante una especificación independiente sin alterar esta frontera.

---

# 10. Catálogo de componentes

---

## 9.1 `Window`

### Función de creación

```clrs
VENTANA(
    id,
    titulo
)
```

**Parámetros**

```text
id     : IdentificadorGUI
titulo : Cadena
```

**GTK**

```text
Gtk.Window
```

La función crea y registra una ventana general.

### Propiedades específicas

Además de las propiedades comunes de `Gtk.Widget`:

| Propiedad | Tipo | Acceso | GTK |
|---|---|---:|---|
| `titulo` | Cadena | RW | `GtkWindow:title` |
| `ancho` | Entero `>= -1` | RW | tamaño predeterminado |
| `alto` | Entero `>= -1` | RW | tamaño predeterminado |
| `redimensionable` | Lógico | RW | `GtkWindow:resizable` |
| `modal` | Lógico | RW | `GtkWindow:modal` |
| `decorada` | Lógico | RW | `GtkWindow:decorated` |
| `cerrable` | Lógico | RW | `GtkWindow:deletable` |
| `ocultar_al_cerrar` | Lógico | RW | `GtkWindow:hide-on-close` |
| `maximizada` | Lógico | R | estado de ventana |
| `pantalla_completa` | Lógico | R | estado de ventana |
| `activa` | Lógico | R | `GtkWindow:is-active` |

`ancho` y `alto` corresponden al tamaño predeterminado solicitado, no al tamaño efectivo instantáneo asignado por el compositor.

### Acciones

```clrs
CONTENER(ventana, componente)
QUITAR(ventana, componente)

CERRAR(ventana)
MAXIMIZAR(ventana)
MINIMIZAR(ventana)
PANTALLA_COMPLETA(ventana)
RESTAURAR(ventana)
```

Mapeos principales:

```text
CONTENER            → GtkWindow.set_child()
CERRAR              → GtkWindow.close()
MAXIMIZAR           → GtkWindow.maximize()
MINIMIZAR           → GtkWindow.minimize()
PANTALLA_COMPLETA   → GtkWindow.fullscreen()
RESTAURAR           → unfullscreen + unmaximize + unminimize según estado
```

Una ventana sólo admite un hijo principal mediante `CONTENER`.

### Eventos

| Evento | Callback | GTK |
|---|---|---|
| `cerrar` | `FUNCION(id)` | `GtkWindow::close-request` |

Si el callback de `cerrar` devuelve:

```text
VERDADERO → impedir el cierre
FALSO/Nulo → permitir el comportamiento normal
```

---

## 9.2 `ApplicationWindow`

### Función de creación

```clrs
VENTANA_APLICACION(
    id,
    titulo
)
```

**GTK**

```text
Gtk.ApplicationWindow
```

`Gtk.ApplicationWindow` hereda de `Gtk.Window` y se integra con `Gtk.Application`.

El runtime administra internamente la aplicación GTK de la ejecución.

### Propiedades

Hereda todo el catálogo público de `Window`.

La API inicial no expone `show-menubar`, acciones `GAction` ni modelos de menú porque dichos conceptos todavía no forman parte del catálogo de 24 componentes.

### Acciones

Las mismas que `Window`.

### Eventos

Los mismos que `Window`.

---

## 9.3 `Label`

### Función de creación

```clrs
ETIQUETA(
    id,
    texto
)
```

**GTK**

```text
Gtk.Label
```

### Propiedades específicas

| Propiedad | Tipo | Acceso | GTK |
|---|---|---:|---|
| `texto` | Cadena | RW | `GtkLabel:label` / texto literal |
| `seleccionable` | Lógico | RW | `GtkLabel:selectable` |
| `ajuste_linea` | Lógico | RW | `GtkLabel:wrap` |
| `modo_ajuste` | Cadena enumerada | RW | `GtkLabel:wrap-mode` |
| `justificacion` | Cadena enumerada | RW | `GtkLabel:justify` |
| `elipsis` | Cadena enumerada | RW | `GtkLabel:ellipsize` |
| `ancho_caracteres` | Entero `>= -1` | RW | `GtkLabel:width-chars` |

La API inicial trata `texto` como texto literal. No interpreta automáticamente Pango markup.

### Eventos específicos

Ninguno en el catálogo inicial.

Los eventos genéricos de entrada continúan disponibles.

---

## 9.4 `Entry`

### Función de creación

```clrs
ENTRADA(id)
```

**GTK**

```text
Gtk.Entry
```

### Propiedades específicas

`Gtk.Entry` implementa `Gtk.Editable`; el runtime utiliza esa interfaz para las propiedades de edición.

| Propiedad | Tipo | Acceso | GTK |
|---|---|---:|---|
| `texto` | Cadena | RW | `GtkEditable:text` |
| `marcador` | Cadena o Nulo | RW | `GtkEntry:placeholder-text` |
| `editable` | Lógico | RW | `GtkEditable:editable` |
| `longitud_maxima` | Entero `>= 0` | RW | `GtkEntry:max-length` |
| `ancho_caracteres` | Entero `>= -1` | RW | `GtkEditable:width-chars` |
| `alineacion_texto` | Número `0..1` | RW | `GtkEditable:xalign` |
| `marco` | Lógico | RW | `GtkEntry:has-frame` |

### Eventos específicos

| Evento | Callback | GTK |
|---|---|---|
| `cambio` | `FUNCION(id, texto)` | `GtkEditable::changed` |
| `activar` | `FUNCION(id, texto)` | `GtkEntry::activate` |

`activar` representa normalmente la activación mediante Enter.

---

## 9.5 `PasswordEntry`

### Función de creación

```clrs
ENTRADA_CONTRASENA(id)
```

**GTK**

```text
Gtk.PasswordEntry
```

Debe utilizarse `Gtk.PasswordEntry` en lugar de simular una contraseña mediante `Gtk.Entry`, porque GTK incorpora comportamiento específico para secretos.

### Propiedades específicas

| Propiedad | Tipo | Acceso | GTK |
|---|---|---:|---|
| `texto` | Cadena | RW | `GtkEditable:text` |
| `marcador` | Cadena o Nulo | RW | `GtkPasswordEntry:placeholder-text` |
| `editable` | Lógico | RW | `GtkEditable:editable` |
| `mostrar_revelar` | Lógico | RW | `GtkPasswordEntry:show-peek-icon` |
| `activar_predeterminado` | Lógico | RW | `GtkPasswordEntry:activates-default` |

### Eventos específicos

| Evento | Callback | GTK |
|---|---|---|
| `cambio` | `FUNCION(id, texto)` | `GtkEditable::changed` |
| `activar` | `FUNCION(id, texto)` | `GtkPasswordEntry::activate` |

El runtime no debe imprimir, registrar ni incluir automáticamente el contenido de una contraseña en diagnósticos técnicos.

---

## 9.6 `TextView`

### Función de creación

```clrs
AREA_TEXTO(id)
```

**GTK**

```text
Gtk.TextView
```

El `Gtk.TextBuffer` asociado permanece oculto para CLRS.

### Propiedades específicas

| Propiedad | Tipo | Acceso | Backend |
|---|---|---:|---|
| `texto` | Cadena | RW | `GtkTextBuffer` |
| `editable` | Lógico | RW | `GtkTextView:editable` |
| `modo_ajuste` | Cadena enumerada | RW | `GtkTextView:wrap-mode` |
| `monoespaciado` | Lógico | RW | `GtkTextView:monospace` |
| `acepta_tabulador` | Lógico | RW | `GtkTextView:accepts-tab` |
| `cursor_visible` | Lógico | RW | `GtkTextView:cursor-visible` |
| `sobrescritura` | Lógico | RW | `GtkTextView:overwrite` |

Para `modo_ajuste`, `"ninguno"` se traduce a `Gtk.WrapMode.NONE`.

### Eventos específicos

| Evento | Callback | Backend |
|---|---|---|
| `cambio` | `FUNCION(id, texto)` | `GtkTextBuffer::changed` |

El evento se conecta al buffer, no a una señal ficticia de `Gtk.TextView`.

---

## 9.7 `Button`

### Función de creación

```clrs
BOTON(
    id,
    texto
)
```

**GTK**

```text
Gtk.Button
```

### Propiedades específicas

| Propiedad | Tipo | Acceso | GTK |
|---|---|---:|---|
| `texto` | Cadena | RW | `GtkButton:label` |
| `icono` | Cadena o Nulo | RW | `GtkButton:icon-name` |
| `marco` | Lógico | RW | `GtkButton:has-frame` |

`texto` e `icono` representan las formas simples de contenido soportadas por CLRS.

Si se cambia entre texto e icono, el runtime debe mantener un resultado determinista y no exponer el `child` GTK arbitrario.

### Eventos específicos

| Evento | Callback | GTK |
|---|---|---|
| `clic` | `FUNCION(id)` | `GtkButton::clicked` |
| `activar` | `FUNCION(id)` | `GtkButton::activate` |

`clic` es un evento semántico del botón y es distinto de los eventos genéricos `presionado` y `liberado`.

---

## 9.8 `CheckButton`

### Función de creación

```clrs
CASILLA(
    id,
    texto
)
```

**GTK**

```text
Gtk.CheckButton
```

### Propiedades específicas

| Propiedad | Tipo | Acceso | GTK |
|---|---|---:|---|
| `texto` | Cadena | RW | `GtkCheckButton:label` |
| `activo` | Lógico | RW | `GtkCheckButton:active` |
| `indeterminado` | Lógico | RW | `GtkCheckButton:inconsistent` |
| `grupo` | IdentificadorGUI o Nulo | RW | `GtkCheckButton:group` |

`grupo` referencia otra `CheckButton`.

El runtime valida que el identificador proporcionado corresponda realmente a una `CheckButton`.

Agrupar casillas permite obtener comportamiento mutuamente excluyente según las reglas de GTK.

### Eventos específicos

| Evento | Callback | GTK |
|---|---|---|
| `alternado` | `FUNCION(id, activo)` | `GtkCheckButton::toggled` |
| `activar` | `FUNCION(id)` | `GtkCheckButton::activate` |

---

## 9.9 `ToggleButton`

### Función de creación

```clrs
BOTON_ALTERNABLE(
    id,
    texto
)
```

**GTK**

```text
Gtk.ToggleButton
```

### Propiedades específicas

Hereda las propiedades simples de `Button` y agrega:

| Propiedad | Tipo | Acceso | GTK |
|---|---|---:|---|
| `activo` | Lógico | RW | `GtkToggleButton:active` |
| `grupo` | IdentificadorGUI o Nulo | RW | `GtkToggleButton:group` |

`grupo` sólo acepta otro `ToggleButton`.

### Eventos específicos

| Evento | Callback | GTK |
|---|---|---|
| `clic` | `FUNCION(id)` | heredado de `GtkButton::clicked` |
| `alternado` | `FUNCION(id, activo)` | `GtkToggleButton::toggled` |

---

## 9.10 `LinkButton`

### Función de creación

```clrs
BOTON_ENLACE(
    id,
    uri,
    texto
)
```

**Parámetros**

```text
id    : IdentificadorGUI
uri   : Cadena
texto : Cadena
```

**GTK**

```text
Gtk.LinkButton
```

### Propiedades específicas

Hereda las propiedades públicas simples de `Button` y agrega:

| Propiedad | Tipo | Acceso | GTK |
|---|---|---:|---|
| `uri` | Cadena | RW | `GtkLinkButton:uri` |
| `visitado` | Lógico | RW | `GtkLinkButton:visited` |

### Eventos específicos

| Evento | Callback | GTK |
|---|---|---|
| `clic` | `FUNCION(id)` | heredado de `GtkButton::clicked` |
| `activar_enlace` | `FUNCION(id, uri)` | `GtkLinkButton::activate-link` |

Si el callback de `activar_enlace` devuelve `VERDADERO`, se considera que el programa manejó el enlace y puede impedirse la apertura predeterminada.

Si devuelve `FALSO` o Nulo, se permite el comportamiento predeterminado de GTK.

---

## 9.11 `SpinButton`

### Función de creación

```clrs
ENTRADA_NUMERICA(
    id,
    minimo,
    maximo,
    paso
)
```

**Validación**

```text
minimo <= maximo
paso > 0
```

**GTK**

```text
Gtk.SpinButton
gtk_spin_button_new_with_range()
```

### Propiedades específicas

| Propiedad | Tipo | Acceso | Backend |
|---|---|---:|---|
| `valor` | Número | RW | `GtkSpinButton` |
| `minimo` | Número | RW | rango |
| `maximo` | Número | RW | rango |
| `paso` | Número `> 0` | RW | incremento |
| `decimales` | Entero `>= 0` | RW | `digits` |
| `solo_numeros` | Lógico | RW | `numeric` |
| `ajustar_saltos` | Lógico | RW | `snap-to-ticks` |
| `ciclico` | Lógico | RW | `wrap` |

Modificar `minimo` o `maximo` debe conservar el otro límite y volver a configurar el rango.

Modificar `paso` conserva un incremento de página interno definido por el runtime.

### Eventos específicos

| Evento | Callback | GTK |
|---|---|---|
| `valor_cambiado` | `FUNCION(id, valor)` | `GtkSpinButton::value-changed` |
| `activar` | `FUNCION(id, valor)` | `GtkSpinButton::activate` |

---

## 9.12 `Scale`

### Función de creación

```clrs
DESLIZADOR(
    id,
    orientacion,
    minimo,
    maximo,
    paso
)
```

**GTK**

```text
Gtk.Scale
gtk_scale_new_with_range()
```

### Propiedades específicas

| Propiedad | Tipo | Acceso | Backend |
|---|---|---:|---|
| `orientacion` | Cadena enumerada | RW | `GtkOrientable:orientation` |
| `valor` | Número | RW | `GtkRange` |
| `minimo` | Número | RW | rango |
| `maximo` | Número | RW | rango |
| `paso` | Número `> 0` | RW | incremento |
| `decimales` | Entero `>= 0` | RW | `GtkScale:digits` |
| `mostrar_valor` | Lógico | RW | `GtkScale:draw-value` |
| `posicion_valor` | Cadena enumerada | RW | `GtkScale:value-pos` |
| `mostrar_origen` | Lógico | RW | `GtkScale:has-origin` |
| `invertido` | Lógico | RW | `GtkRange:inverted` |

### Eventos específicos

| Evento | Callback | GTK |
|---|---|---|
| `valor_cambiado` | `FUNCION(id, valor)` | `GtkRange::value-changed` |

---

## 9.13 `ProgressBar`

### Función de creación

```clrs
BARRA_PROGRESO(id)
```

**GTK**

```text
Gtk.ProgressBar
```

### Propiedades específicas

| Propiedad | Tipo | Acceso | GTK |
|---|---|---:|---|
| `orientacion` | Cadena enumerada | RW | `GtkOrientable:orientation` |
| `progreso` | Número `0..1` | RW | `GtkProgressBar:fraction` |
| `texto` | Cadena o Nulo | RW | `GtkProgressBar:text` |
| `mostrar_texto` | Lógico | RW | `GtkProgressBar:show-text` |
| `invertido` | Lógico | RW | `GtkProgressBar:inverted` |
| `paso_pulso` | Número `0..1` | RW | `GtkProgressBar:pulse-step` |

### Acción específica

```clrs
PULSAR_PROGRESO(id)
```

Mapeo:

```text
GtkProgressBar.pulse()
```

Esta acción permite utilizar el modo de actividad indeterminada de la barra.

### Eventos específicos

Ninguno en el catálogo inicial.

---

## 9.14 `Spinner`

### Función de creación

```clrs
INDICADOR_CARGA(id)
```

**GTK**

```text
Gtk.Spinner
```

La instancia se crea detenida.

### Propiedades específicas

| Propiedad | Tipo | Acceso | GTK |
|---|---|---:|---|
| `activo` | Lógico | R | `GtkSpinner:spinning` |

El estado se modifica mediante acciones y no mediante `ESTABLECER`.

### Acciones específicas

```clrs
INICIAR(id)
PARAR(id)
```

Mapeo:

```text
INICIAR → GtkSpinner.start()
PARAR   → GtkSpinner.stop()
```

### Eventos específicos

Ninguno.

---

## 9.15 `DropDown`

### Función de creación

```clrs
LISTA_DESPLEGABLE(
    id,
    opciones[]
)
```

Cada opción debe ser una `Cadena`.

**GTK**

```text
Gtk.DropDown
gtk_drop_down_new_from_strings()
```

El runtime administra internamente el modelo de cadenas.

### Propiedades específicas

| Propiedad | Tipo | Acceso | Backend |
|---|---|---:|---|
| `opciones` | Arreglo de Cadena | RW | modelo interno |
| `seleccion` | Entero | RW | `GtkDropDown:selected` |
| `valor` | Cadena o Nulo | R | item seleccionado |
| `busqueda` | Lógico | RW | `GtkDropDown:enable-search` |
| `mostrar_flecha` | Lógico | RW | `GtkDropDown:show-arrow` |

CLRS normaliza:

```text
seleccion = -1
```

como «sin selección», aunque GTK utilice internamente `GTK_INVALID_LIST_POSITION`.

Si se reemplaza `opciones`, la selección se conserva sólo cuando el índice continúa siendo válido; en caso contrario pasa a `-1`.

### Eventos específicos

| Evento | Callback | Backend |
|---|---|---|
| `seleccion_cambiada` | `FUNCION(id, indice, valor)` | `notify::selected` |
| `activar` | `FUNCION(id)` | `GtkDropDown::activate` |

Cuando no existe selección:

```text
indice = -1
valor = Nulo
```

---

## 9.16 `Calendar`

### Función de creación

```clrs
CALENDARIO(id)
```

**GTK**

```text
Gtk.Calendar
```

### Representación de fecha

CLRS utiliza:

```clrs
[anio, mes, dia]
```

Ejemplo:

```clrs
[2026, 9, 9]
```

El mes visible para CLRS siempre utiliza:

```text
1 .. 12
```

aunque APIs históricas de GTK hayan utilizado `0 .. 11` para propiedades individuales.

### Propiedades específicas

| Propiedad | Tipo | Acceso | Backend |
|---|---|---:|---|
| `fecha` | `[Entero, Entero, Entero]` | RW | `GtkCalendar` + `GDateTime` |
| `mostrar_dias_semana` | Lógico | RW | `show-day-names` |
| `mostrar_encabezado` | Lógico | RW | `show-heading` |
| `mostrar_numeros_semana` | Lógico | RW | `show-week-numbers` |

La implementación compatible con GTK 4.10 debe preferir las operaciones de fecha disponibles en esa versión y no depender de setters agregados en GTK posteriores.

### Acciones específicas

```clrs
MARCAR_DIA(calendario, dia)
DESMARCAR_DIA(calendario, dia)
LIMPIAR_MARCAS(calendario)
```

`dia` debe estar entre `1` y `31`; GTK determina si tiene sentido dentro del mes actual.

### Eventos específicos

| Evento | Callback | Backend |
|---|---|---|
| `fecha_cambiada` | `FUNCION(id, fecha[])` | síntesis sobre señales de calendario |

El runtime puede sintetizar `fecha_cambiada` a partir de:

```text
day-selected
next-month
next-year
prev-month
prev-year
```

y siempre entrega la fecha normalizada `[anio, mes, dia]`.

---

## 9.17 `Image`

### Función de creación

```clrs
IMAGEN(
    id,
    archivo
)
```

**Parámetros**

```text
archivo : Cadena
```

**GTK**

```text
Gtk.Image
```

### Propiedades específicas

| Propiedad | Tipo | Acceso | Backend |
|---|---|---:|---|
| `archivo` | Cadena | W | `GtkImage.set_from_file()` |
| `icono` | Cadena o Nulo | RW | `GtkImage:icon-name` |
| `tamano_pixel` | Entero `>= -1` | RW | `GtkImage:pixel-size` |

`archivo` e `icono` son fuentes alternativas.

Establecer una nueva fuente reemplaza la anterior.

`tamano_pixel = -1` permite que GTK utilice el tamaño natural/configurado.

La API inicial conserva deliberadamente `Gtk.Image`; no sustituye silenciosamente el componente por `Gtk.Picture`.

### Acciones específicas

```clrs
LIMPIAR_IMAGEN(id)
```

Mapeo:

```text
GtkImage.clear()
```

### Eventos específicos

Ninguno.

---

## 9.18 `Box`

### Función de creación

```clrs
CAJA(
    id,
    orientacion,
    separacion
)
```

**GTK**

```text
Gtk.Box
```

### Propiedades específicas

| Propiedad | Tipo | Acceso | GTK |
|---|---|---:|---|
| `orientacion` | Cadena enumerada | RW | `GtkOrientable:orientation` |
| `separacion` | Entero `>= 0` | RW | `GtkBox:spacing` |
| `homogeneo` | Lógico | RW | `GtkBox:homogeneous` |

### Acciones específicas

```clrs
ANEXAR(caja, componente)
PREPONER(caja, componente)
QUITAR(caja, componente)
```

Mapeo:

```text
ANEXAR   → GtkBox.append()
PREPONER → GtkBox.prepend()
QUITAR   → GtkBox.remove()
```

Un componente ya contenido por otro padre debe producir un error controlado o ser retirado de forma explícita antes de anexarse; el runtime no debe reparentarlo silenciosamente.

### Eventos específicos

Ninguno.

---

## 9.19 `Grid`

### Función de creación

```clrs
CUADRICULA(id)
```

**GTK**

```text
Gtk.Grid
```

### Propiedades específicas

| Propiedad | Tipo | Acceso | GTK |
|---|---|---:|---|
| `separacion_filas` | Entero `>= 0` | RW | `GtkGrid:row-spacing` |
| `separacion_columnas` | Entero `>= 0` | RW | `GtkGrid:column-spacing` |
| `filas_homogeneas` | Lógico | RW | `GtkGrid:row-homogeneous` |
| `columnas_homogeneas` | Lógico | RW | `GtkGrid:column-homogeneous` |

### Acción `COLOCAR`

```clrs
COLOCAR(
    cuadricula,
    componente,
    columna,
    fila,
    ancho,
    alto
)
```

**Validación**

```text
columna : Entero
fila    : Entero
ancho   : Entero > 0
alto    : Entero > 0
```

Mapeo:

```text
GtkGrid.attach(
    child,
    columna,
    fila,
    ancho,
    alto
)
```

### Acción `QUITAR`

```clrs
QUITAR(
    cuadricula,
    componente
)
```

Mapeo:

```text
GtkGrid.remove()
```

### Eventos específicos

Ninguno.

---

## 9.20 `ScrolledWindow`

### Función de creación

```clrs
CONTENEDOR_DESPLAZABLE(id)
```

**GTK**

```text
Gtk.ScrolledWindow
```

GTK inserta internamente un `GtkViewport` cuando el hijo no implementa `GtkScrollable`; CLRS no debe exponer ese detalle.

### Propiedades específicas

| Propiedad | Tipo | Acceso | GTK |
|---|---|---:|---|
| `politica_horizontal` | Cadena enumerada | RW | `hscrollbar-policy` |
| `politica_vertical` | Cadena enumerada | RW | `vscrollbar-policy` |
| `desplazamiento_cinetico` | Lógico | RW | `kinetic-scrolling` |
| `desplazamiento_superpuesto` | Lógico | RW | `overlay-scrolling` |
| `marco` | Lógico | RW | `has-frame` |
| `ancho_contenido_minimo` | Entero `>= -1` | RW | `min-content-width` |
| `alto_contenido_minimo` | Entero `>= -1` | RW | `min-content-height` |
| `ancho_contenido_maximo` | Entero `>= -1` | RW | `max-content-width` |
| `alto_contenido_maximo` | Entero `>= -1` | RW | `max-content-height` |

### Acciones específicas

```clrs
CONTENER(
    desplazable,
    componente
)

QUITAR(
    desplazable,
    componente
)
```

Sólo puede existir un hijo principal.

### Eventos específicos

| Evento | Callback | GTK |
|---|---|---|
| `borde_alcanzado` | `FUNCION(id, borde)` | `GtkScrolledWindow::edge-reached` |
| `borde_excedido` | `FUNCION(id, borde)` | `GtkScrolledWindow::edge-overshot` |

`borde` se normaliza como:

```text
"izquierda"
"derecha"
"arriba"
"abajo"
```

---

## 9.21 `ListBox`

### Función de creación

```clrs
LISTA_VISUAL(id)
```

El nombre `LISTA_VISUAL` evita confundir este componente con los arreglos de datos de CLRS.

**GTK**

```text
Gtk.ListBox
```

`Gtk.ListBox` puede recibir widgets normales mediante `append`; GTK crea internamente `GtkListBoxRow` cuando es necesario.

CLRS no expone `GtkListBoxRow` como componente separado en el catálogo inicial.

### Propiedades específicas

| Propiedad | Tipo | Acceso | Backend |
|---|---|---:|---|
| `modo_seleccion` | Cadena enumerada | RW | `selection-mode` |
| `activar_un_clic` | Lógico | RW | `activate-on-single-click` |
| `separadores` | Lógico | RW | `show-separators` |
| `seleccion` | Número o Arreglo | RW | selección normalizada |

Semántica de `seleccion`:

```text
modo "ninguno"  → OBTENER devuelve Nulo
modo "unica"    → Entero o -1
modo "explorar" → Entero o -1
modo "multiple" → Arreglo de enteros
```

Para `ESTABLECER`:

```text
"unica"/"explorar" → recibe Entero
"multiple"          → recibe Arreglo de Enteros
```

### Acciones específicas

```clrs
ANEXAR(lista, componente)
PREPONER(lista, componente)
QUITAR(lista, componente)
```

### Eventos específicos

| Evento | Callback | GTK |
|---|---|---|
| `fila_activada` | `FUNCION(id, indice)` | `GtkListBox::row-activated` |
| `seleccion_cambiada` | `FUNCION(id, seleccion)` | `row-selected` / `selected-rows-changed` |

El runtime convierte `GtkListBoxRow` en el índice lógico visible para CLRS.

---

## 9.22 `ColumnView`

### Función de creación

```clrs
VISTA_COLUMNAS(
    id,
    columnas[]
)
```

Ejemplo:

```clrs
VISTA_COLUMNAS(
    "usuarios",
    ["Nombre", "Edad", "Activo"]
)
```

**GTK**

```text
Gtk.ColumnView
```

### 9.22.1 Abstracción deliberada

`Gtk.ColumnView` requiere:

- un `Gtk.SelectionModel`;
- un modelo de elementos;
- `Gtk.ColumnViewColumn`;
- factories de celdas.

Estos objetos no se exponen a CLRS.

El runtime debe construirlos internamente y conservar un modelo real compatible con el framework de listas de GTK.

No es válido implementar `VISTA_COLUMNAS` dibujando una tabla falsa con `Gtk.Grid` mientras el registro declare que el componente es `ColumnView`.

### Propiedades específicas

| Propiedad | Tipo | Acceso | Backend |
|---|---|---:|---|
| `columnas` | Arreglo de Cadena | RW | columnas/factories internos |
| `datos` | Arreglo bidimensional | RW | modelo interno |
| `modo_seleccion` | Cadena enumerada | RW | `Gtk.SelectionModel` |
| `seleccion` | Número o Arreglo | RW | modelo de selección |
| `reordenable` | Lógico | RW | `GtkColumnView:reorderable` |
| `separadores_filas` | Lógico | RW | `show-row-separators` |
| `separadores_columnas` | Lógico | RW | `show-column-separators` |
| `activar_un_clic` | Lógico | RW | `single-click-activate` |
| `seleccion_arrastre` | Lógico | RW | `enable-rubberband` |

### 9.22.2 Formato de `datos`

```clrs
[
    ["Ana", 24, VERDADERO],
    ["Luis", 31, FALSO]
]
```

Cada fila debe tener el mismo número de celdas que `columnas`.

Las celdas iniciales admiten:

```text
Cadena
Número
Lógico
Nulo
```

El runtime presenta cada valor mediante una conversión textual estable de CLRS.

No se exponen widgets de celda individuales.

### 9.22.3 Selección

La propiedad `seleccion` sigue el mismo contrato normalizado que `ListBox`.

### Acciones específicas

```clrs
ANEXAR_FILA(
    vista,
    fila[]
)

QUITAR_FILA(
    vista,
    indice
)

LIMPIAR_FILAS(vista)
```

Las acciones modifican el modelo interno conservando `Gtk.ColumnView` y sus factories.

### Eventos específicos

| Evento | Callback | Backend |
|---|---|---|
| `fila_activada` | `FUNCION(id, indice, fila[])` | `GtkColumnView::activate` |
| `seleccion_cambiada` | `FUNCION(id, seleccion)` | `Gtk.SelectionModel::selection-changed` |

---

## 9.23 `AlertDialog`

### Función de creación

```clrs
DIALOGO_ALERTA(
    id,
    mensaje
)
```

**GTK**

```text
Gtk.AlertDialog
```

Disponible desde GTK 4.10.

No deriva de `Gtk.Widget`.

Por ello no admite:

```text
visible
márgenes
alineación
MOSTRAR(widget)
OCULTAR(widget)
eventos genéricos de puntero
eventos genéricos de teclado
```

### Propiedades específicas

| Propiedad | Tipo | Acceso | GTK |
|---|---|---:|---|
| `mensaje` | Cadena | RW | `message` |
| `detalle` | Cadena o Nulo | RW | `detail` |
| `botones` | Arreglo de Cadena | RW | `buttons` |
| `boton_cancelar` | Entero | RW | `cancel-button` |
| `boton_predeterminado` | Entero | RW | `default-button` |
| `modal` | Lógico | RW | `modal` |

`boton_cancelar` y `boton_predeterminado` utilizan índices base cero.

`-1` significa que no se define dicho botón.

Un índice distinto de `-1` debe estar dentro de `botones`.

### Acción `MOSTRAR_ALERTA`

```clrs
MOSTRAR_ALERTA(
    dialogo,
    ventana
)
```

`ventana` acepta:

```text
IdentificadorGUI de Window
IdentificadorGUI de ApplicationWindow
Nulo
```

Mapeo:

```text
GtkAlertDialog.show()
```

No espera una respuesta.

### Acción `ELEGIR_ALERTA`

```clrs
respuesta = ELEGIR_ALERTA(
    dialogo,
    ventana
)
```

**Retorno**

```text
Entero
```

Mapeo:

```text
GtkAlertDialog.choose()
GtkAlertDialog.choose_finish()
```

El resultado es el índice del botón elegido.

Si el diálogo se cancela y no existe `boton_cancelar`, el resultado normalizado es:

```text
-1
```

Esto coincide con el comportamiento documentado de `gtk_alert_dialog_choose_finish()`.

### Eventos específicos

Ninguno.

La respuesta se obtiene mediante la acción asincrónica `ELEGIR_ALERTA`.

---

## 9.24 `FileDialog`

### Función de creación

```clrs
DIALOGO_ARCHIVO(id)
```

**GTK**

```text
Gtk.FileDialog
```

Disponible desde GTK 4.10.

Es un objeto GObject asincrónico y no un widget.

### Propiedades específicas

| Propiedad | Tipo | Acceso | Backend |
|---|---|---:|---|
| `titulo` | Cadena o Nulo | RW | `title` |
| `etiqueta_aceptar` | Cadena o Nulo | RW | `accept-label` |
| `modal` | Lógico | RW | `modal` |
| `archivo_inicial` | Cadena o Nulo | RW | `initial-file` |
| `carpeta_inicial` | Cadena o Nulo | RW | `initial-folder` |
| `nombre_inicial` | Cadena o Nulo | RW | `initial-name` |
| `filtros` | Arreglo | RW | `GtkFileFilter` + lista interna |
| `filtro_predeterminado` | Entero | RW | `default-filter` normalizado |

### 9.24.1 Formato de filtros

CLRS utiliza:

```clrs
[
    [
        "Imágenes",
        ["*.png", "*.jpg", "*.jpeg"]
    ],
    [
        "Texto",
        ["*.txt", "*.md"]
    ]
]
```

Cada filtro se representa como:

```text
[nombre, patrones[]]
```

El runtime crea los `Gtk.FileFilter` correspondientes.

`filtro_predeterminado` utiliza un índice base cero.

`-1` significa «sin filtro predeterminado explícito».

### 9.24.2 Rutas locales

La API pública de archivos de CLRS trabaja con rutas.

Por ello, `FileDialog` devuelve cadenas de rutas locales y no objetos `Gio.File`.

Si GTK devuelve un recurso que no puede representarse como ruta local, el runtime debe producir un error controlado de recurso no local en lugar de exponer el objeto GIO.

### Acciones

#### `ABRIR_ARCHIVO`

```clrs
ruta = ABRIR_ARCHIVO(
    dialogo,
    ventana
)
```

**Retorno**

```text
Cadena o Nulo
```

`Nulo` significa cancelación normal del usuario.

La función **no lee el archivo**; únicamente selecciona una ruta.

---

#### `ABRIR_ARCHIVOS`

```clrs
rutas = ABRIR_ARCHIVOS(
    dialogo,
    ventana
)
```

**Retorno**

```text
Arreglo de Cadena
```

Cancelación:

```clrs
[]
```

---

#### `GUARDAR_ARCHIVO`

```clrs
ruta = GUARDAR_ARCHIVO(
    dialogo,
    ventana
)
```

**Retorno**

```text
Cadena o Nulo
```

La función selecciona un destino.

No crea ni escribe el archivo por sí misma.

---

#### `ELEGIR_CARPETA`

```clrs
ruta = ELEGIR_CARPETA(
    dialogo,
    ventana
)
```

**Retorno**

```text
Cadena o Nulo
```

---

#### `ELEGIR_CARPETAS`

```clrs
rutas = ELEGIR_CARPETAS(
    dialogo,
    ventana
)
```

**Retorno**

```text
Arreglo de Cadena
```

Cancelación:

```clrs
[]
```

### Eventos específicos

Ninguno.

Las operaciones se expresan mediante las acciones asincrónicas del diálogo.

---

# 11. Tabla resumida de factories

| CLRS | Componente | GTK |
|---|---|---|
| `VENTANA(id, titulo)` | Window | `Gtk.Window` |
| `VENTANA_APLICACION(id, titulo)` | ApplicationWindow | `Gtk.ApplicationWindow` |
| `ETIQUETA(id, texto)` | Label | `Gtk.Label` |
| `ENTRADA(id)` | Entry | `Gtk.Entry` |
| `ENTRADA_CONTRASENA(id)` | PasswordEntry | `Gtk.PasswordEntry` |
| `AREA_TEXTO(id)` | TextView | `Gtk.TextView` |
| `BOTON(id, texto)` | Button | `Gtk.Button` |
| `CASILLA(id, texto)` | CheckButton | `Gtk.CheckButton` |
| `BOTON_ALTERNABLE(id, texto)` | ToggleButton | `Gtk.ToggleButton` |
| `BOTON_ENLACE(id, uri, texto)` | LinkButton | `Gtk.LinkButton` |
| `ENTRADA_NUMERICA(id, minimo, maximo, paso)` | SpinButton | `Gtk.SpinButton` |
| `DESLIZADOR(id, orientacion, minimo, maximo, paso)` | Scale | `Gtk.Scale` |
| `BARRA_PROGRESO(id)` | ProgressBar | `Gtk.ProgressBar` |
| `INDICADOR_CARGA(id)` | Spinner | `Gtk.Spinner` |
| `LISTA_DESPLEGABLE(id, opciones[])` | DropDown | `Gtk.DropDown` |
| `CALENDARIO(id)` | Calendar | `Gtk.Calendar` |
| `IMAGEN(id, archivo)` | Image | `Gtk.Image` |
| `CAJA(id, orientacion, separacion)` | Box | `Gtk.Box` |
| `CUADRICULA(id)` | Grid | `Gtk.Grid` |
| `CONTENEDOR_DESPLAZABLE(id)` | ScrolledWindow | `Gtk.ScrolledWindow` |
| `LISTA_VISUAL(id)` | ListBox | `Gtk.ListBox` |
| `VISTA_COLUMNAS(id, columnas[])` | ColumnView | `Gtk.ColumnView` |
| `DIALOGO_ALERTA(id, mensaje)` | AlertDialog | `Gtk.AlertDialog` |
| `DIALOGO_ARCHIVO(id)` | FileDialog | `Gtk.FileDialog` |

---

# 12. Tabla resumida de acciones

| Acción | Componentes principales |
|---|---|
| `MOSTRAR` | todos los widgets |
| `OCULTAR` | todos los widgets |
| `ENFOCAR` | todos los widgets |
| `CONTENER` | Window, ApplicationWindow, ScrolledWindow |
| `QUITAR` | Window, ApplicationWindow, Box, Grid, ScrolledWindow, ListBox |
| `ANEXAR` | Box, ListBox |
| `PREPONER` | Box, ListBox |
| `COLOCAR` | Grid |
| `CERRAR` | Window, ApplicationWindow |
| `MAXIMIZAR` | Window, ApplicationWindow |
| `MINIMIZAR` | Window, ApplicationWindow |
| `PANTALLA_COMPLETA` | Window, ApplicationWindow |
| `RESTAURAR` | Window, ApplicationWindow |
| `PULSAR_PROGRESO` | ProgressBar |
| `INICIAR` | Spinner |
| `PARAR` | Spinner |
| `MARCAR_DIA` | Calendar |
| `DESMARCAR_DIA` | Calendar |
| `LIMPIAR_MARCAS` | Calendar |
| `LIMPIAR_IMAGEN` | Image |
| `ANEXAR_FILA` | ColumnView |
| `QUITAR_FILA` | ColumnView |
| `LIMPIAR_FILAS` | ColumnView |
| `MOSTRAR_ALERTA` | AlertDialog |
| `ELEGIR_ALERTA` | AlertDialog |
| `ABRIR_ARCHIVO` | FileDialog |
| `ABRIR_ARCHIVOS` | FileDialog |
| `GUARDAR_ARCHIVO` | FileDialog |
| `ELEGIR_CARPETA` | FileDialog |
| `ELEGIR_CARPETAS` | FileDialog |

La coincidencia de un nombre como `PARAR` en más de un tipo no implica reflexión. El runtime resuelve primero el tipo registrado y después consulta el catálogo de acciones permitido para ese tipo.

Las funciones globales de tema quedan fuera de esta tabla porque no operan sobre un componente:

| Función global | Propósito |
|---|---|
| `ESTABLECER_TEMA(nombre)` | Seleccionar el nombre del tema GTK de la sesión |
| `OBTENER_TEMA()` | Consultar el nombre de tema vigente |
| `ESTABLECER_MODO_TEMA(modo)` | Establecer `"sistema"`, `"claro"` u `"oscuro"` |
| `OBTENER_MODO_TEMA()` | Consultar la preferencia normalizada de modo |

---

# 13. Reglas de contención

La API debe validar la jerarquía de widgets.

### 12.1 Un solo padre GTK

Un widget no puede pertenecer simultáneamente a dos padres.

Esto debe rechazarse:

```clrs
CAJA(
    "a",
    "vertical",
    5
)

CAJA(
    "b",
    "vertical",
    5
)

BOTON(
    "x",
    "Aceptar"
)

ANEXAR("a", "x")
ANEXAR("b", "x")
```

La segunda operación no debe reparentar silenciosamente `x`.

### 12.2 Contenedores de un hijo

```text
Window
ApplicationWindow
ScrolledWindow
```

admiten un único hijo mediante `CONTENER`.

Si ya existe un hijo, otro `CONTENER` debe fallar hasta que se retire explícitamente con `QUITAR`.

### 12.3 Contenedores múltiples

```text
Box
Grid
ListBox
```

admiten múltiples hijos según las reglas de sus acciones.

### 12.4 Componentes no contenibles

```text
AlertDialog
FileDialog
```

no son widgets y no pueden utilizarse como hijos.

---

# 14. Reglas de identidad y referencias entre componentes

Cuando una propiedad o acción recibe otro `IdentificadorGUI`, el runtime debe validar:

1. existencia;
2. pertenencia a la misma `programKey`;
3. tipo esperado;
4. estado válido del componente.

Ejemplo:

```clrs
CASILLA(
    "a",
    "A"
)

BOTON(
    "b",
    "B"
)

ESTABLECER(
    "a",
    "grupo",
    "b"
)
```

debe fallar porque `"b"` no es `CheckButton`.

---

# 15. Propiedades sintéticas

Algunas propiedades CLRS no corresponden a una única propiedad GObject.

Ejemplos:

```text
SpinButton.minimo
SpinButton.maximo
SpinButton.paso

Scale.minimo
Scale.maximo
Scale.paso

Calendar.fecha

ListBox.seleccion
ColumnView.datos
ColumnView.seleccion

```

Estas propiedades son igualmente parte oficial de la API.

El catálogo puede implementar una propiedad mediante:

- uno o varios métodos;
- un objeto auxiliar;
- un modelo;
- un buffer;
- metadatos privados del runtime.

El usuario no debe poder distinguir estas diferencias mediante la API pública.

---

# 16. Eventos sintéticos

También son válidos eventos CLRS que normalizan varios mecanismos GTK.

Ejemplos:

```text
Calendar.fecha_cambiada
DropDown.seleccion_cambiada
TextView.cambio
ColumnView.seleccion_cambiada
```

El catálogo interno debe declarar el mecanismo real, por ejemplo:

```js
{
    evento: "cambio",
    backend: "buffer-signal",
    signal: "changed"
}
```

o:

```js
{
    evento: "tecla_presionada",
    backend: "event-controller-key"
}
```

No debe asumirse que todo evento se implementa mediante:

```js
widget.on("nombre", ...)
```

---

# 17. Catálogo interno recomendado

La estructura exacta es interna, pero debe permitir expresar capacidades compartidas y específicas.

Ejemplo conceptual:

```js
const propiedadesWidget = {
    visible: {
        read: true,
        write: true,
        // ...
    },

    habilitado: {
        read: true,
        write: true,
        // ...
    }
};

const catalogo = {
    Button: {
        widget: true,

        propiedades: {
            ...propiedadesWidget,

            texto: {
                read: true,
                write: true
            },

            marco: {
                read: true,
                write: true
            }
        },

        eventos: {
            clic: {
                backend: "signal",
                signal: "clicked"
            }
        },

        acciones: [
            "MOSTRAR",
            "OCULTAR",
            "ENFOCAR"
        ]
    }
};
```

El catálogo canónico no debe duplicarse entre:

```text
semántica
hover
runtime
documentación
```

Cuando sea posible, estas superficies deben derivarse de los mismos descriptores fuente o de proyecciones generadas.

---

# 18. Validación de identificadores

Toda factory debe validar:

```text
tipo = Cadena
identificador no vacío
identificador no registrado previamente
```

No se exige ninguna nomenclatura.

Son válidos:

```clrs
BOTON(
    "aceptar",
    "Aceptar"
)

BOTON(
    "boton principal",
    "Continuar"
)

BOTON(
    "x",
    "X"
)
```

La API no interpreta prefijos como:

```text
btn-
comp-
window-
```

---

# 19. Errores normativos

Se recomienda utilizar códigos estables bajo el prefijo:

```text
CLRS_GUI_
```

Como mínimo deben existir equivalentes a:

| Código | Situación |
|---|---|
| `CLRS_GUI_INVALID_ID` | identificador no válido |
| `CLRS_GUI_DUPLICATE_ID` | identificador ya registrado |
| `CLRS_GUI_COMPONENT_NOT_FOUND` | componente inexistente |
| `CLRS_GUI_WRONG_COMPONENT_TYPE` | componente existente pero de tipo incompatible |
| `CLRS_GUI_PROPERTY_NOT_FOUND` | propiedad no catalogada |
| `CLRS_GUI_PROPERTY_READ_ONLY` | escritura sobre propiedad R |
| `CLRS_GUI_PROPERTY_WRITE_ONLY` | lectura sobre propiedad W |
| `CLRS_GUI_INVALID_PROPERTY_VALUE` | dato fuera del dominio permitido |
| `CLRS_GUI_EVENT_NOT_FOUND` | evento no catalogado |
| `CLRS_GUI_ACTION_NOT_SUPPORTED` | acción incompatible |
| `CLRS_GUI_PARENT_CONFLICT` | widget ya contenido por otro padre |
| `CLRS_GUI_CHILD_NOT_FOUND` | intento de retirar un hijo que no pertenece al contenedor |
| `CLRS_GUI_INVALID_CALLBACK` | tercer argumento de `CONECTAR` no es función válida |
| `CLRS_GUI_FILE_NOT_LOCAL` | `Gio.File` sin ruta local representable |
| `CLRS_GUI_DIALOG_RESOURCES_UNAVAILABLE` | faltan los recursos de configuración GTK necesarios para abrir el selector de archivos |
| `CLRS_GUI_INVALID_THEME_NAME` | nombre de tema no válido |
| `CLRS_GUI_THEME_UNAVAILABLE` | tema solicitado no disponible/cargable cuando el backend puede detectarlo |
| `CLRS_GUI_INVALID_THEME_MODE` | modo distinto de `"sistema"`, `"claro"` u `"oscuro"` |

Los mensajes públicos deben estar en español.

Ejemplo:

```text
La propiedad "progreso" no está disponible para Button.
```

No:

```text
TypeError: widget.setFraction is not a function
```

---

# 20. Ejemplo mínimo completo

```clrs
AL_PRESIONAR(componente)
    nombre = OBTENER(
        "nombre",
        "texto"
    )

    ESTABLECER(
        "resultado",
        "texto",
        "Hola, " + nombre
    )


PRINCIPAL()
    ESTABLECER_TEMA(
        "Adwaita"
    )

    ESTABLECER_MODO_TEMA(
        "oscuro"
    )

    VENTANA_APLICACION(
        "principal",
        "Ejemplo"
    )

    ESTABLECER(
        "principal",
        "ancho",
        420
    )

    ESTABLECER(
        "principal",
        "alto",
        220
    )

    CAJA(
        "contenido",
        "vertical",
        10
    )

    ESTABLECER(
        "contenido",
        "margen_superior",
        20
    )

    ESTABLECER(
        "contenido",
        "margen_inferior",
        20
    )

    ESTABLECER(
        "contenido",
        "margen_inicio",
        20
    )

    ESTABLECER(
        "contenido",
        "margen_fin",
        20
    )

    ETIQUETA(
        "titulo",
        "Escribe tu nombre"
    )

    ENTRADA(
        "nombre"
    )

    ESTABLECER(
        "nombre",
        "marcador",
        "Nombre"
    )

    BOTON(
        "aceptar",
        "Aceptar"
    )

    ETIQUETA(
        "resultado",
        ""
    )

    ANEXAR(
        "contenido",
        "titulo"
    )

    ANEXAR(
        "contenido",
        "nombre"
    )

    ANEXAR(
        "contenido",
        "aceptar"
    )

    ANEXAR(
        "contenido",
        "resultado"
    )

    CONTENER(
        "principal",
        "contenido"
    )

    CONECTAR(
        "aceptar",
        "clic",
        AL_PRESIONAR
    )

    MOSTRAR(
        "principal"
    )
```

El programa no manipula ningún objeto GTK.

---

# 21. Ejemplo de diálogo

```clrs
PRINCIPAL()
    VENTANA_APLICACION(
        "principal",
        "Archivos"
    )

    DIALOGO_ARCHIVO(
        "selector"
    )

    ESTABLECER(
        "selector",
        "titulo",
        "Seleccionar imagen"
    )

    ESTABLECER(
        "selector",
        "filtros",
        [
            [
                "Imágenes",
                ["*.png", "*.jpg", "*.jpeg"]
            ]
        ]
    )

    ruta = ABRIR_ARCHIVO(
        "selector",
        "principal"
    )

    si ruta != nulo
        escribir ruta

    MOSTRAR(
        "principal"
    )
```

`ABRIR_ARCHIVO` devuelve una ruta; no un `Gio.File`.

---

# 22. Compatibilidad mínima con GTK 4.10

La API pública inicial debe poder implementarse sobre GTK 4.10.

Por esta razón:

- no se deben convertir APIs agregadas después de GTK 4.10 en requisitos involuntarios;
- `AlertDialog` y `FileDialog` establecen el mínimo 4.10;
- cuando GTK haya agregado métodos más modernos posteriormente, el runtime puede utilizarlos condicionalmente, pero debe conservar una ruta compatible con el mínimo declarado;
- una futura elevación del mínimo GTK debe actualizar explícitamente `architecture.md` y este catálogo.

Un ejemplo relevante es `Calendar`: el contrato CLRS usa una propiedad sintética `fecha`, de modo que el runtime puede utilizar la API disponible en la versión efectiva sin filtrar diferencias históricas de mes, `GDateTime` o setters agregados posteriormente.

---

# 23. Funciones que no deben existir como escape a GTK

La primera implementación no debe agregar funciones públicas como:

```text
GTK_SET
GTK_GET
GTK_SIGNAL
GTK_CALL
OBTENER_OBJETO
OBJETO_GTK
EJECUTAR_METODO
ESTABLECER_CSS
CARGAR_CSS
```

Tampoco debe aceptar:

```clrs
ESTABLECER(
    "boton",
    "has-frame",
    VERDADERO
)
```

si el catálogo público declara:

```text
"marco"
```

La finalidad del catálogo es mantener una frontera semántica propia de CLRS.

---

# 24. Cambios futuros del catálogo

Una nueva propiedad, evento, acción o componente debe cumplir:

```text
1. tener utilidad clara para el modelo procedural de CLRS;
2. disponer de mapeo estable a GTK;
3. declarar tipos y errores;
4. no exponer objetos GTK;
5. indicar si exige elevar la versión mínima de GTK;
6. incorporarse al catálogo canónico utilizado por runtime e inteligencia del lenguaje;
7. contar con pruebas positivas y negativas.
```

No se debe agregar automáticamente cada miembro que aparezca en una nueva versión de GTK.

El catálogo es deliberadamente **curado**, no un mirror completo de GObject Introspection.

---

# 25. Invariantes de este catálogo

La implementación debe conservar:

1. `ESTABLECER`, `OBTENER` y `CONECTAR` sólo aceptan nombres declarados.
2. El componente real se resuelve antes que la propiedad/evento/acción.
3. Un identificador GUI nunca implica un tipo.
4. Las propiedades comunes sólo se heredan por recursos que sean `Gtk.Widget`.
5. `AlertDialog` y `FileDialog` no reciben capacidades de `Widget`.
6. `TextView.texto` se implementa mediante su buffer.
7. `DropDown.seleccion_cambiada` no se finge como una señal inexistente.
8. Los eventos genéricos de entrada utilizan controladores/gestos de GTK 4.
9. `ColumnView` utiliza internamente el framework de modelos/factories de GTK.
11. Las fechas de `Calendar` se normalizan a `[anio, mes, dia]` con mes `1..12`.
12. Los índices visibles para CLRS son base cero salvo los conceptos naturalmente humanos como día y mes.
13. La cancelación normal de `FileDialog` no se presenta como error.
14. Ninguna función de selección de `FileDialog` lee o escribe archivos automáticamente.
15. Los callbacks reciben identificadores CLRS, nunca instancias GTK.
16. Si el programa no configura tema, CLRS no impone uno.
17. El tema es configuración global de la sesión GUI, no propiedad de un widget.
18. La primera API no expone CSS ni propiedades estéticas arbitrarias.
19. La implementación de `"claro"`/`"oscuro"` debe conservar compatibilidad con GTK 4.10.

---

# 26. Criterios mínimos de pruebas

El catálogo debe contar con pruebas que demuestren como mínimo:

```text
Factory:
- crea el tipo correcto
- rechaza ID duplicado
- rechaza ID no cadena

Propiedad:
- ESTABLECER válido modifica estado
- OBTENER válido recupera estado
- propiedad inexistente falla
- propiedad de otro tipo falla
- lectura/escritura inválida falla
- enum inválido falla

Evento:
- CONECTAR ejecuta callback CLRS
- callback recibe ID original
- datos se normalizan
- evento inexistente falla

Contención:
- ANEXAR válido funciona
- segundo padre falla
- QUITAR valida pertenencia

Diálogos:
- cancelación se normaliza
- elección devuelve índice/ruta
- no se filtran GObject/Gio.File

ColumnView:
- utiliza modelo real
- datos y columnas permanecen sincronizados
- selección se normaliza

Calendar:
- mes CLRS 1..12
- fecha se conserva sobre GTK mínimo soportado

Tema:
- sin funciones de tema → GTK conserva configuración normal
- ESTABLECER_TEMA actualiza configuración global
- OBTENER_TEMA devuelve el valor vigente
- modo inválido falla
- "sistema"/"claro"/"oscuro" se normalizan
- widgets ya creados reaccionan al cambio cuando GTK lo soporte
- ejecución administrada y exportada conservan la misma semántica
```

---

# 27. Referencias oficiales GTK

Documentación general:

- <https://docs.gtk.org/gtk4/class.Widget.html>
- <https://docs.gtk.org/gtk4/iface.Editable.html>
- <https://docs.gtk.org/gtk4/class.EventControllerKey.html>
- <https://docs.gtk.org/gtk4/class.EventControllerMotion.html>
- <https://docs.gtk.org/gtk4/class.GestureClick.html>
- Gtk.Settings: <https://docs.gtk.org/gtk4/class.Settings.html>
- `gtk-theme-name`: <https://docs.gtk.org/gtk4/property.Settings.gtk-theme-name.html>

Componentes:

- Window: <https://docs.gtk.org/gtk4/class.Window.html>
- ApplicationWindow: <https://docs.gtk.org/gtk4/class.ApplicationWindow.html>
- Label: <https://docs.gtk.org/gtk4/class.Label.html>
- Entry: <https://docs.gtk.org/gtk4/class.Entry.html>
- PasswordEntry: <https://docs.gtk.org/gtk4/class.PasswordEntry.html>
- TextView: <https://docs.gtk.org/gtk4/class.TextView.html>
- TextBuffer: <https://docs.gtk.org/gtk4/class.TextBuffer.html>
- Button: <https://docs.gtk.org/gtk4/class.Button.html>
- CheckButton: <https://docs.gtk.org/gtk4/class.CheckButton.html>
- ToggleButton: <https://docs.gtk.org/gtk4/class.ToggleButton.html>
- LinkButton: <https://docs.gtk.org/gtk4/class.LinkButton.html>
- SpinButton: <https://docs.gtk.org/gtk4/class.SpinButton.html>
- Scale: <https://docs.gtk.org/gtk4/class.Scale.html>
- Range: <https://docs.gtk.org/gtk4/class.Range.html>
- ProgressBar: <https://docs.gtk.org/gtk4/class.ProgressBar.html>
- Spinner: <https://docs.gtk.org/gtk4/class.Spinner.html>
- DropDown: <https://docs.gtk.org/gtk4/class.DropDown.html>
- Calendar: <https://docs.gtk.org/gtk4/class.Calendar.html>
- Image: <https://docs.gtk.org/gtk4/class.Image.html>
- Box: <https://docs.gtk.org/gtk4/class.Box.html>
- Grid: <https://docs.gtk.org/gtk4/class.Grid.html>
- ScrolledWindow: <https://docs.gtk.org/gtk4/class.ScrolledWindow.html>
- ListBox: <https://docs.gtk.org/gtk4/class.ListBox.html>
- ColumnView: <https://docs.gtk.org/gtk4/class.ColumnView.html>
- AlertDialog: <https://docs.gtk.org/gtk4/class.AlertDialog.html>
- FileDialog: <https://docs.gtk.org/gtk4/class.FileDialog.html>

---

# 28. Resumen normativo

La API pública queda organizada así:

```text
CREAR
    ↓
factory específica
    ↓
registro por identificador

CONFIGURAR
    ↓
ESTABLECER / OBTENER
    ↓
catálogo tipado

REACCIONAR
    ↓
CONECTAR
    ↓
señal / buffer / controller / gesture / notify

COMPONER
    ↓
ANEXAR / CONTENER / COLOCAR / QUITAR

ACTUAR
    ↓
MOSTRAR / CERRAR / INICIAR / etc.

CONFIGURAR APARIENCIA GLOBAL
    ↓
ESTABLECER_TEMA / ESTABLECER_MODO_TEMA
    ↓
sistema de temas GTK
```

La regla central de este documento es:

> **Toda capacidad GUI visible en CLRS debe estar declarada explícitamente en el catálogo y traducirse a GTK sin exponer el modelo de objetos GTK al programa; la apariencia general se delega al sistema de temas GTK y sólo se controla mediante configuración global explícita.**
