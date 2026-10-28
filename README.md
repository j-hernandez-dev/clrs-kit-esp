# **CLRS Kit Español**

**clrs-kit-esp** es una extensión para Visual Studio Code orientada al soporte de un lenguaje de programación tipo pseudocódigo, fuertemente inspirado en la sintaxis utilizada en el libro *Introducción a Algoritmos (CLRS) 4.ª edición*.

<a id="inicio-rapido"></a>

# **💻 Inicio rápido**

| Extensión de archivo | Descripción |
|----------------------|-------------|
| `.clrs` | Recomendada para habilitar las herramientas integradas en VS Code. Puedes ejecutar archivos con otras extensiones de archivo, pero no contarán con el soporte de la extensión. |

## **Requisito**

Es necesario tener Node.js instalado en el sistema. CLRS Kit Español lo utiliza como entorno de ejecución (Runtime) para correr el código JavaScript generado durante el proceso de transpilación.

[![Runtime - Node.js](https://img.shields.io/badge/runtime-Node.js-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/es/)

## **Comenzar a programar**

Si es tu primera vez con CLRS Kit Español, abre la guía interactiva para conocer las herramientas principales paso a paso:

* **Paleta de comandos → `Abrir inicio guiado de CLRS`**

Si ya comenzaste y quieres saber cuál es el siguiente paso recomendado según tu archivo o proyecto actual:

* **Paleta de comandos → `Abrir inicio contextual de CLRS`**

## **Licencia (GPL versión 2.0)**

Este proyecto es de código abierto y se distribuye bajo los términos de la licencia GPLv2. Puede ser modificado y distribuido libremente, siempre que se conserve el software resultante bajo la misma licencia. El código generado en JavaScript se distribuirá bajo su licencia correspondiente.

## **Recomendado**

Recursos opcionales que podrían mejorar tu experiencia con esta extensión.

[![Extension - One Dark Pro](https://img.shields.io/badge/extension-One_Dark_Pro-2979ff?style=flat-square&logo=react&logoColor=white)](https://marketplace.visualstudio.com/items?itemName=zhuangtongfa.Material-theme)
[![Font - JetBrains Mono](https://img.shields.io/badge/font-JetBrains_Mono-f42f7d?style=flat-square&logo=jetbrains&logoColor=white)](https://www.jetbrains.com/es-es/lp/mono/)

---

# **📑 Índice**

1. [Inicio rápido](#inicio-rapido)
2. [Comandos para VS Code](#comandos-vscode)
3. [Estado actual](#estado-actual)
4. [Filosofía del proyecto](#filosofia-proyecto)
5. [Características del lenguaje](#caracteristicas-lenguaje)
6. [Biblioteca estándar](#biblioteca-estandar)
7. [Biblioteca de interfaces gráficas](#biblioteca-gui)
8. [Análisis algorítmico](#analisis-algoritmico)
9. [Análisis de costo](#analisis-costo)
10. [Análisis de complejidad](#analisis-complejidad)
11. [Marco de pruebas funcionales](#marco-pruebas)
12. [Generador de diagramas de flujo](#diagramas-flujo)
13. [Videojuego BROKER.95](#broker95)

---

<a id="comandos-vscode"></a>

# **⌨️ Comandos para VS Code**

| Paleta de comandos | Descripción |
|--------------------|-------------|
| Ejecutar código CLRS | Transpila el código a JavaScript y lo ejecuta inmediatamente. |
| Mostrar/ocultar costo algorítmico | Muestra u oculta los costos algorítmicos del código activo. |
| Mostrar informe de complejidad algorítmica | Abre informe de complejidad algorítmica del código activo. |
| Mostrar diagrama de flujo | Abre visualizador de diagrama de flujo del código activo. |
| Jugar BROKER.95 | Abre videojuego educativo conectado al código activo. |
| Exportar diagrama de flujo SVG | Exporta el diagrama de flujo activo en formato SVG. |
| Depurar código CLRS | Inicia la sesión DAP del código activo. |
| Generar código JavaScript | Genera un proyecto JavaScript ejecutable y compilable, con perfil CLI o GUI según el programa. |
| Formatear documento CLRS | Normaliza la indentación y los espacios del documento activo. |
| Abrir inicio guiado de CLRS | Abre el recorrido nativo por las herramientas principales. |
| Abrir inicio contextual de CLRS | Sugiere las siguientes acciones según los archivos y el editor actual. |
| Crear programa CLRS | Abre una plantilla inicial sin guardarla automáticamente. |
| Crear suite de pruebas CLRS | Abre una definición inicial de pruebas sin guardarla automáticamente. |
| Crear proyecto CLRS de CLI | Genera un programa de CLI y una suite de pruebas. |
| Crear proyecto CLRS de GUI | Genera un programa de GUI y una suite de pruebas. |
| Instalar soporte para Copilot CLI | Instala las instrucciones personales de CLRS para Copilot CLI, limitadas a archivos `.clrs`. |

---

<a id="estado-actual"></a>

# **⚙️ Estado actual (versión 2.0.4)**

## **Lenguaje de programación**
- Analizador lexicográfico, analizador sintáctico y analizador semántico.
- Transpilador de CLRS a JavaScript.
- Generación de proyecto transpilado a JavaScript.
- Proyectos generados preparados para construir ejecutables distribuibles.
- Lanzador de programas CLRS mediante Node.js integrado con VS Code.
- Reporte de errores de sintaxis, semántica y ejecución.
- Biblioteca estándar para manejo de operaciones matemáticas, cadenas, arreglos y archivos.
- Biblioteca de interfaces gráficas con 24 componentes, propiedades, eventos y configuración de tema.
- Corpus de pruebas de la suite completa.
## **Herramientas de edición integradas a VS Code**
- Configuración del lenguaje con indentación automática y plegado de código.
- Fragmentos (Snippets) predefinidos para la sintaxis.
- Resaltado de sintaxis gramatical (TextMate) y resaltado semántico (Semantic Tokens).
- Analizador estático (Static Analysis) en línea, con subrayado y mensajes en español.
- Autocompletado inteligente (IntelliSense) para variables visibles, parámetros, funciones, biblioteca estándar y palabras reservadas del lenguaje.
- Vista de esquema (Outline), migas de pan (Breadcrumbs), navegación a definiciones (Code Navigation), búsqueda de referencias (Symbol Resolution) y renombrado seguro (Rename Symbol).
- Información de cursor (Hover Information) y ayuda de parámetros (Inlay Hints).
- Explorador de pruebas nativo para descubrir, ejecutar y depurar casos CLRS, con resultados, diferencias de salida y casos públicos del contrato activo de BROKER.95.
- Explicación visual de fallos con entrada, resultado esperado, resultado obtenido y primera diferencia encontrada.
- Explicación pedagógica de fallos para comprender de forma sencilla la causa probable de una diferencia.
- Acciones rápidas para corregir errores inequívocos o consultar una orientación contextual.
- Cobertura visual de cada prueba y del conjunto completo en el panel nativo y el diagrama de flujo.
- Jerarquía nativa de llamadas con navegación entre funciones y avisos informativos sobre funciones sin uso o recursivas.
- Inicio guiado nativo, creación de proyectos e inicio contextual para descubrir las herramientas según el estado del proyecto.
- Soporte de integración con Copilot CLI y Copilot chat.
## **Herramientas de aprendizaje integradas a VS Code**
- Visualizador en línea y en tiempo real de costo algorítmico.
- Informe interactivo de complejidad algorítmica, clasificación asintótica, mejor y peor caso, navegación al código, cadena de llamadas y alcance explícito de cada conclusión.
- Visualizador en tiempo real de diagrama de flujo, con minimapa interactivo, temas visuales, sincronización bidireccional y reproducción paso a paso de ejecución.
- Edición visual del código desde el diagrama mediante figuras y flechas seleccionables.
- Exportación de diagramas de flujo en formato SVG.
- Depurador DAP integrado con pausa y continuación (Continue), entrar (Step Into), pasar por encima (Step Over), salir (Step Out) y cancelación (Stop) controlada sobre la ejecución real.
- Puntos de interrupción (Breakpoints) básicos, condicionales, por conteo de impactos, disparados y punto de registro (Logpoints) con expresiones CLRS.
- Estado de depuración con pila de llamadas, parámetros, variables locales, variables globales y valores expandibles.
- Videojuego educativo BROKER.95 (Entorno de aprendizaje gamificado para programación y algoritmia) con escena Kaplay, sistema de terminal simulada, sistema de contratos y economía, sistema de aprendizaje progresivo, sistema de estadísticas y sistema de configuración.

---

<a id="filosofia-proyecto"></a>

# **📖 Filosofía del proyecto**

El proyecto está diseñado bajo los siguientes principios:

- Implementación de lenguaje tipo pseudocódigo (CLRS) en español.
- Baja fricción para principiantes y alto rigor para avanzados.
- Entorno de observación del código mediante diagramas y análisis.
- Entorno de diseño de algoritmos y prototipado algorítmico.
- Inteligencia artificial (LLM) como tutor de aprendizaje y enseñanza.
- Aprendizaje autodidacta orientado en la progresión y fundamentos.
- Construcción elemental del pensamiento y criterio computacional.

En una época donde la construcción de código se delega cada vez más a la inteligencia artificial, el trabajo del humano evoluciona hacia la orquestación estratégica de la toma de decisiones guiada por el criterio y el ingenio.

CLRS Kit Español busca hacer accesible, ejecutable y observable el razonamiento computacional, para que el estudiante no sólo escriba una solución, sino que pueda comprenderla, comprobarla, analizarla y justificarla.

---

<a id="caracteristicas-lenguaje"></a>

# **🧮 Características del lenguaje**

## **Comentarios**

CLRS admite comentarios de una sola línea mediante `//`.

```clrs-es
// Este es un comentario
escribir "Hola"
```

## **Variables y tipos de datos**

Las variables en CLRS son **dinámicas, débilmente tipadas y mutables**.

No existe una declaración separada de variables ni soporte para constantes. La primera asignación mediante `=` crea la variable y le asigna su valor inicial.

```clrs-es
edad = 20
nombre = "Ana"
activo = VERDAD
```

Las variables no pueden declararse sin un valor inicial.

CLRS admite cuatro tipos básicos de valores:

| Tipo     | Ejemplo            |
| -------- | ------------------ |
| Numérico | `25`, `3.14`, `-8` |
| Cadena   | `"Hola"`           |
| Lógico   | `VERDAD`, `FALSO`  |
| Sin valor | `NULO`             |

Una variable puede cambiar el tipo de valor que almacena durante la ejecución.

```clrs-es
dato = 10
dato = "texto"
```

## **Ámbito de las variables**

Las variables pueden tener **ámbito global** o **ámbito de función**.

Las estructuras `si`, `mientras` y `para` no crean ámbitos adicionales.

```clrs-es
valor = 10

si valor > 5
    resultado = valor * 2

escribir resultado
```

## **Salida**

La instrucción `escribir` permite mostrar información en la consola.

Puede utilizarse con:

* valores individuales;
* varias expresiones separadas por comas;
* concatenaciones;
* arreglos completos.

```clrs-es
nombre = "Ana"
edad = 20

escribir nombre
escribir "Edad:", edad
escribir "Hola " + nombre
```

## **Entrada**

La instrucción `leer` permite obtener valores desde la consola.

Puede leer una o varias variables en una misma instrucción y determina automáticamente el tipo del valor introducido.

```clrs-es
edad = 0
leer edad
```

También es posible leer varios valores:

```clrs-es
a = 0
b = 0

leer a, b
```

La instrucción `leer` asigna valores, pero **no declara variables**. Por ello, las variables deben existir previamente.

## **Secuencias de escape**

Las cadenas admiten las siguientes secuencias de escape:

| Secuencia | Significado      |
| --------- | ---------------- |
| `\n`      | Nueva línea      |
| `\t`      | Tabulación       |
| `\r`      | Retorno de carro |
| `\b`      | Retroceso        |
| `\"`      | Comillas dobles  |

Por ejemplo:

```clrs-es
escribir "Hola\nMundo"
```

## **Arreglos**

Los arreglos en CLRS son **dinámicos**.

Pueden inicializarse directamente mediante una lista de valores entre corchetes:

```clrs-es
numeros = [10, 20, 30]
```

También pueden construirse o ampliarse asignando valores directamente a sus posiciones:

```clrs-es
numeros[0] = 10
numeros[1] = 20
numeros[2] = 30
```

Su tamaño y estructura se determinan conforme se inicializan o utilizan nuevas posiciones.

CLRS también admite arreglos multidimensionales mediante arreglos anidados:

```clrs-es
matriz = [
    [10, 20],
    [30, 40]
]
```

También pueden construirse mediante índices:

```clrs-es
matriz[0][0] = 10
matriz[0][1] = 20
matriz[1][0] = 30
```

Es posible asignar arreglos completos entre variables. La asignación copia el contenido correspondiente.

```clrs-es
A[0] = 10
A[1] = 20

B = A
```

## **Estructuras selectivas**

CLRS dispone de una única estructura principal de selección: `si`.

Puede combinarse con `sino si` y `sino`.

```clrs-es
edad = 20

si edad >= 18
    escribir "Mayor de edad"
sino
    escribir "Menor de edad"
```

También pueden encadenarse varias condiciones:

```clrs-es
calificacion = 85

si calificacion >= 90
    escribir "Excelente"
sino si calificacion >= 70
    escribir "Aprobado"
sino
    escribir "No aprobado"
```

Los bloques de código se delimitan mediante **indentación**, por lo que debe mantenerse una estructura consistente.

## **Operadores**

CLRS incluye operadores similares a los utilizados en otros lenguajes de programación.

### **Aritméticos**

```clrs-es
+  -  *  /  %  ^
```

### **Relacionales**

```clrs-es
==  !=  <  >  <=  >=
```

### **Lógicos**

```clrs-es
y  o  no
```

Por ejemplo:

```clrs-es
si edad >= 18 y activo
    escribir "Acceso permitido"
```

## **Estructura iterativa ascendente**

La variante `hasta` incrementa automáticamente la variable de iteración hasta alcanzar el valor final.

```clrs-es
para i = 1 hasta 5
    escribir i
```

Resultado:

```clrs-es
1
2
3
4
5
```

## **Estructura iterativa descendente**

La variante `bajando` realiza el recorrido en sentido descendente.

```clrs-es
para i = 5 bajando 1
    escribir i
```

Resultado:

```clrs-es
5
4
3
2
1
```

## **Estructura iterativa condicional**

La estructura `mientras` ejecuta repetidamente un bloque mientras su condición sea verdadera.

```clrs-es
i = 1

mientras i <= 5
    escribir i
    i = i + 1
```

## **Funciones**

Las funciones se definen mediante:

* un identificador;
* una lista de parámetros;
* un bloque de instrucciones.

La convención utilizada en CLRS consiste en escribir los nombres de las funciones en **mayúsculas**, utilizando `_` para separar palabras.

```clrs-es
SUMAR(a, b)
    retornar a + b
```

Las funciones pueden recibir cualquier cantidad de parámetros.

```clrs-es
PROMEDIO(a, b, c)
    retornar (a + b + c) / 3
```

La instrucción `retornar` permite devolver un valor.

### **Llamadas a funciones**

Una función se invoca utilizando su nombre y sus argumentos:

```clrs-es
resultado = SUMAR(10, 20)
```

Las llamadas también pueden utilizarse directamente dentro de expresiones:

```clrs-es
total = SUMAR(10, 20) * 2
```

Después de una llamada no debe agregarse un bloque indentado, ya que este podría interpretarse como la definición de una función.

### **Arreglos como parámetros**

Las funciones pueden recibir arreglos.

Para indicar que un parámetro es un arreglo se especifica su número de dimensiones:

```clrs-es
MOSTRAR(datos[])
    para i = 0 hasta LONG(datos) - 1
        escribir datos[i]
```

Para arreglos de dos dimensiones:

```clrs-es
PROCESAR(matriz[][])
```

Al realizar la llamada, únicamente se utiliza el identificador del arreglo:

```clrs-es
MOSTRAR(numeros)
```

### **Función principal**

Una función llamada `PRINCIPAL` puede utilizarse como punto de entrada del programa.

```clrs-es
PRINCIPAL()
    escribir "Inicio del programa"
```

No es necesario invocarla explícitamente.

```clrs-es
PRINCIPAL()
```

se ejecuta automáticamente como punto de inicio del programa.

## **Ejemplo funcional de código**

Algoritmo clásico de ordenamiento burbuja.

```clrs-es
BURBUJA(A)
    n = LONG(A)

    para i = 0 hasta n - 2
        para j = 0 hasta n - i - 2
            si A[j] > A[j + 1]
                intercambio = A[j]
                A[j] = A[j + 1]
                A[j + 1] = intercambio

    retornar A

PRINCIPAL()
    A = [5, 2, 9, 1, 6]

    escribir "Sin ordenar:"
    escribir A

    escribir "Ordenado:"
    A = BURBUJA(A)
    escribir A
```

## **Diagnósticos**

Los errores causados por el código CLRS se muestran en español y conservan la ubicación obtenida del código fuente.

```text
CLRS Runtime
────────────────────────
▶ programa.clrs

✕ Error de sintaxis

  Se esperaba «)», pero se encontró «escribir».
  Línea 2, columna 5

────────────────────────
Estado: No ejecutado
```

---

<a id="biblioteca-estandar"></a>

# **📚 Biblioteca estándar de CLRS**

La biblioteca estándar de CLRS proporciona funciones integradas para el manejo operaciones matemáticas, cadenas, arreglos y archivos.

## **Archivos**

| Función CLRS | Descripción | Retorno |
|--------------|-------------|---------|
| `LEER_ARCHIVO(ruta)` | Lee el contenido de un archivo de texto. | Cadena |
| `EXISTE_ARCHIVO(ruta)` | Verifica si un archivo existe. | Lógico |
| `PESO_ARCHIVO(ruta)` | Obtiene el tamaño del archivo en bytes. | Número |
| `CREAR_ARCHIVO(ruta)` | Crea un archivo vacío. | - |
| `ESCRIBIR_ARCHIVO(ruta, contenido)` | Escribe contenido al final del archivo. | - |
| `ELIMINAR_ARCHIVO(ruta)` | Elimina un archivo si existe. | - |

## **Matemáticas**

| Función CLRS | Descripción | Retorno |
|--------------|-------------|---------|
| `ABS(x)` | Valor absoluto de un número. | Número |
| `MIN(a, b)` | Devuelve el menor de dos valores. | Número |
| `MAX(a, b)` | Devuelve el mayor de dos valores. | Número |
| `REDONDEA(x)` | Redondea al entero más cercano. | Número |
| `PISO(x)` | Redondea hacia abajo. | Número |
| `RAIZ(x)` | Raíz cuadrada. | Número |
| `RAIZCUB(x)` | Raíz cúbica. | Número |
| `EXP(x)` | e elevado a x. | Número |
| `LOGN(x)` | Logaritmo natural. | Número |
| `LOG10(x)` | Logaritmo base 10. | Número |
| `LOG2(x)` | Logaritmo base 2. | Número |
| `SEN(x)` | Seno de un ángulo. | Número |
| `COS(x)` | Coseno de un ángulo. | Número |
| `TAN(x)` | Tangente de un ángulo. | Número |
| `ARC(x)` | Arcoseno. | Número |
| `ARCOCOS(x)` | Arcocoseno. | Número |
| `RAD(x)` | Convierte grados a radianes. | Número |
| `GRAD(x)` | Convierte radianes a grados. | Número |
| `PI()` | Constante π. | Número |
| `E()` | Constante e. | Número |
| `ALEAT(min, max)` | Número aleatorio. | Número |
| `PROM(x)` | Promedio de un arreglo. | Número |
| `SUM(x)` | Suma total de un arreglo. | Número |
| `MED(x)` | Mediana de un conjunto. | Número |
| `VAR(x)` | Varianza de un conjunto. | Número |

## **Cadenas**

| Función CLRS | Descripción | Retorno |
|--------------|-------------|---------|
| `LONG(x)` | Longitud de una cadena o estructura. | Número |
| `CAR_EN(cadena, posición)` | Obtiene un carácter en una posición. | Cadena |
| `SUBCAD(cadena, inicio, fin)` | Extrae una subcadena. | Cadena |
| `MAYUS(cadena)` | Convierte a mayúsculas. | Cadena |
| `MINUS(cadena)` | Convierte a minúsculas. | Cadena |
| `RECORTA(cadena)` | Elimina espacios en blanco. | Cadena |
| `REEMP(cadena, viejo, nuevo)` | Reemplaza texto. | Cadena |
| `DIV(cadena, separador)` | Divide en arreglo. | Arreglo |
| `ES_CAD_NUM(cadena)` | Verifica si es número. | Lógico |
| `ES_VAC(cadena)` | Verifica si está vacía. | Lógico |
| `EMP_CON(cadena, texto)` | Verifica prefijo. | Lógico |
| `TERM_CON(cadena, texto)` | Verifica sufijo. | Lógico |

## **Arreglos**

| Función CLRS | Descripción | Retorno |
|--------------|-------------|---------|
| `AGREGA(arreglo, valor)` | Agrega un elemento al final. | Arreglo |
| `ELIM(arreglo, índice)` | Elimina un elemento. | Arreglo |
| `INSER(arreglo, índice, valor)` | Inserta en posición. | Arreglo |
| `INDICE(arreglo, valor)` | Índice de un elemento. | Número |
| `CONT(arreglo, valor)` | Verifica existencia. | Lógico |
| `ORDENA(arreglo)` | Ordena el arreglo. | Arreglo |
| `INVER(arreglo)` | Invierte el arreglo. | Arreglo |
| `COPIA(arreglo)` | Copia el arreglo. | Arreglo |
| `UNE(arreglo, separador)` | Une elementos en cadena. | Cadena |

## **Tipos**

| Función CLRS      | Descripción                                        | Retorno |
| ----------------- | -------------------------------------------------- | ------- |
| `ES_NUM(valor)` | Verifica si un valor es de tipo numérico.          | Lógico  |
| `ES_CAD(valor)` | Verifica si un valor es de tipo cadena.            | Lógico  |
| `ES_LOG(valor)` | Verifica si un valor es de tipo lógico (booleano). | Lógico  |
| `A_CAD(valor)` | Convierte un valor a una cadena de texto.          | Cadena  |
| `A_NUM(valor)` | Convierte un valor a un número.                    | Número  |
| `A_LOG(valor)` | Convierte un valor a un valor lógico.              | Lógico  |

## **Errores**

| Función CLRS | Descripción | Retorno |
| ---- | ---- | ---- |
| `LANZAR_ERROR(mensaje)` | Genera un error con un mensaje personalizado e interrumpe la ejecución. | - |

---

<a id="biblioteca-gui"></a>

# **🎨 Biblioteca de interfaces gráficas CLRS**

La biblioteca gráfica permite crear ventanas, controles y cuadros de diálogo desde un programa CLRS. Utiliza funciones de la biblioteca estándar y conserva la sintaxis habitual del lenguaje.

Cada componente se identifica mediante una cadena única dentro del programa. Ese identificador permite modificar sus propiedades, consultar su estado y conectar funciones a sus eventos.

## **Operaciones fundamentales**

| Operación | Significado |
|----|----|
| Creación | Registra un componente con ese ID |
| Propiedad | Modifica el componente registrado |
| Evento | Conecta comportamiento al componente |

## **Creación**

Cada componente se crea mediante una función de la biblioteca y se registra con un **identificador** único de tipo **Cadena** proporcionado por el programa. El identificador funciona como el nombre mediante el cual CLRS localiza y administra internamente el componente.

```clrs-es
boton = "guardar"

BOTON(boton, "Guardar")
```

`BOTON` crea el componente y lo registra con el identificador `"guardar"`. A partir de ese momento, el mismo identificador se utiliza para modificar sus propiedades, consultar su estado, conectarlo a eventos o ejecutar acciones.

```clrs-es
ESTABLECER(boton, "texto", "Aceptar")
CONECTAR(boton, "clic", GUARDAR)
OCULTAR(boton)
```

Las funciones de creación **no retornan el componente ni su identificador.** El ID ya se proporciona como argumento y debe ser único entre todos los componentes registrados durante la ejecución. Intentar crear otro componente con un identificador existente produce un error.

### **Creación de ventanas y contenedores**

| Función CLRS | Descripción |
|--------------|-------------|
| `VENTANA(id, titulo)` | Crea una ventana. |
| `VENTANA_APLICACION(id, titulo)` | Crea una ventana asociada a la aplicación. |
| `CAJA(id, orientacion, separacion)` | Organiza componentes en horizontal o vertical. |
| `CUADRICULA(id)` | Organiza componentes en filas y columnas. |
| `CONTENEDOR_DESPLAZABLE(id)` | Contiene un componente con desplazamiento. |

### **Creación de controles**

| Función CLRS | Descripción |
|--------------|-------------|
| `ETIQUETA(id, texto)` | Muestra texto. |
| `ENTRADA(id)` | Permite escribir una línea de texto. |
| `ENTRADA_CONTRASENA(id)` | Permite introducir texto protegido visualmente. |
| `AREA_TEXTO(id)` | Permite editar varias líneas. |
| `BOTON(id, texto)` | Crea un botón. |
| `CASILLA(id, texto)` | Crea una casilla de selección. |
| `BOTON_ALTERNABLE(id, texto)` | Crea un botón con estado activo o inactivo. |
| `BOTON_ENLACE(id, uri, texto)` | Crea un botón que abre un enlace. |
| `ENTRADA_NUMERICA(id, minimo, maximo, paso)` | Permite introducir un número dentro de un rango. |
| `DESLIZADOR(id, orientacion, minimo, maximo, paso)` | Permite elegir un número desplazando un control. |
| `BARRA_PROGRESO(id)` | Representa el progreso de una operación. |
| `INDICADOR_CARGA(id)` | Muestra actividad de duración indeterminada. |
| `LISTA_DESPLEGABLE(id, opciones)` | Permite elegir entre cadenas de un arreglo. |
| `CALENDARIO(id)` | Permite seleccionar una fecha. |
| `IMAGEN(id, archivo)` | Muestra una imagen desde una ruta. |
| `LISTA_VISUAL(id)` | Organiza componentes en filas seleccionables. |
| `VISTA_COLUMNAS(id, columnas)` | Presenta filas de datos con encabezados. |

Las funciones de creación no retornan nada. El argumento `id` registra el componente bajo una cadena única que posteriormente se utiliza con `ESTABLECER`, `OBTENER`, `CONECTAR` y las respectivas acciones compatibles.

### **Creación de cuadros de diálogo**

| Función CLRS | Descripción | Retorno |
|--------------|-------------|---------|
| `DIALOGO_ALERTA(id, mensaje)` | Crea y registra una alerta configurable. | - |
| `DIALOGO_ARCHIVO(id)` | Crea y registra un selector de archivos o carpetas. | - |

## **Propiedades**

Las propiedades se consultan y modifican mediante:

| Función | Descripción | Retorno |
|---------|-------------|---------|
| `ESTABLECER(id, propiedad, valor)` | Modifica una propiedad escribible admitida por el componente. | - |
| `OBTENER(id, propiedad)` | Consulta una propiedad legible admitida por el componente. | El valor indicado para la propiedad |

En las tablas siguientes:

- **RW**: puede utilizarse con `ESTABLECER` y `OBTENER`.
- **R**: sólo puede utilizarse con `OBTENER`.
- **W**: sólo puede utilizarse con `ESTABLECER`.
- La columna **Valor admitido** indica qué recibe `ESTABLECER` y, cuando la propiedad es legible, qué tipo de valor devuelve `OBTENER`.

### **Valores enumerados utilizados por las propiedades**

Algunas propiedades aceptan un conjunto cerrado de cadenas. Deben utilizarse exactamente los valores indicados.

| Dominio | Valores admitidos |
|---------|-------------------|
| Orientación | `"horizontal"`, `"vertical"` |
| Alineación | `"inicio"`, `"centro"`, `"fin"`, `"rellenar"` |
| Justificación | `"izquierda"`, `"derecha"`, `"centro"`, `"rellenar"` |
| Ajuste de texto | `"ninguno"`, `"caracter"`, `"palabra"`, `"palabra_caracter"` |
| Elipsis | `"ninguno"`, `"inicio"`, `"medio"`, `"fin"` |
| Posición | `"izquierda"`, `"derecha"`, `"arriba"`, `"abajo"` |
| Modo de selección | `"ninguno"`, `"unica"`, `"explorar"`, `"multiple"` |
| Política de desplazamiento | `"automatico"`, `"siempre"`, `"nunca"` |

### **Propiedades comunes de componentes visuales**

Todos los componentes visuales admiten las siguientes propiedades. No se aplican a `DIALOGO_ALERTA` ni `DIALOGO_ARCHIVO`, porque estos diálogos no son componentes visuales insertables en la interfaz.

| Propiedad | Valor admitido | Acceso |
|-----------|----------------|--------|
| `"visible"` | Lógico | RW |
| `"habilitado"` | Lógico | RW |
| `"opacidad"` | Número entre `0` y `1` | RW |
| `"ancho_minimo"` | Entero `>= -1`; `-1` restaura el tamaño natural | RW |
| `"alto_minimo"` | Entero `>= -1`; `-1` restaura el tamaño natural | RW |
| `"expandir_horizontal"` | Lógico | RW |
| `"expandir_vertical"` | Lógico | RW |
| `"alineacion_horizontal"` | `"inicio"`, `"centro"`, `"fin"` o `"rellenar"` | RW |
| `"alineacion_vertical"` | `"inicio"`, `"centro"`, `"fin"` o `"rellenar"` | RW |
| `"margen_superior"` | Entero `>= 0` | RW |
| `"margen_inferior"` | Entero `>= 0` | RW |
| `"margen_inicio"` | Entero `>= 0` | RW |
| `"margen_fin"` | Entero `>= 0` | RW |
| `"ayuda"` | Cadena o `NULO` | RW |
| `"enfocable"` | Lógico | RW |

### **Propiedades específicas por componente**

Las siguientes propiedades se agregan a las propiedades comunes anteriores.

#### **Ventanas**

| Componente | Propiedad | Valor admitido | Acceso |
|------------|-----------|----------------|--------|
| `VENTANA`, `VENTANA_APLICACION` | `"titulo"` | Cadena | RW |
| `VENTANA`, `VENTANA_APLICACION` | `"ancho"` | Entero `>= -1` | RW |
| `VENTANA`, `VENTANA_APLICACION` | `"alto"` | Entero `>= -1` | RW |
| `VENTANA`, `VENTANA_APLICACION` | `"redimensionable"` | Lógico | RW |
| `VENTANA`, `VENTANA_APLICACION` | `"modal"` | Lógico | RW |
| `VENTANA`, `VENTANA_APLICACION` | `"decorada"` | Lógico | RW |
| `VENTANA`, `VENTANA_APLICACION` | `"cerrable"` | Lógico | RW |
| `VENTANA`, `VENTANA_APLICACION` | `"ocultar_al_cerrar"` | Lógico | RW |
| `VENTANA`, `VENTANA_APLICACION` | `"maximizada"` | Lógico | R |
| `VENTANA`, `VENTANA_APLICACION` | `"pantalla_completa"` | Lógico | R |
| `VENTANA`, `VENTANA_APLICACION` | `"activa"` | Lógico | R |

`"ancho"` y `"alto"` representan el tamaño solicitado para la ventana, no necesariamente el tamaño efectivo instantáneo asignado por el sistema de ventanas.

#### **Texto y entradas**

| Componente | Propiedad | Valor admitido | Acceso |
|------------|-----------|----------------|--------|
| `ETIQUETA` | `"texto"` | Cadena | RW |
| `ETIQUETA` | `"seleccionable"` | Lógico | RW |
| `ETIQUETA` | `"ajuste_linea"` | Lógico | RW |
| `ETIQUETA` | `"modo_ajuste"` | `"ninguno"`, `"caracter"`, `"palabra"` o `"palabra_caracter"` | RW |
| `ETIQUETA` | `"justificacion"` | `"izquierda"`, `"derecha"`, `"centro"` o `"rellenar"` | RW |
| `ETIQUETA` | `"elipsis"` | `"ninguno"`, `"inicio"`, `"medio"` o `"fin"` | RW |
| `ETIQUETA` | `"ancho_caracteres"` | Entero `>= -1` | RW |
| `ENTRADA` | `"texto"` | Cadena | RW |
| `ENTRADA` | `"marcador"` | Cadena o `NULO` | RW |
| `ENTRADA` | `"editable"` | Lógico | RW |
| `ENTRADA` | `"longitud_maxima"` | Entero `>= 0` | RW |
| `ENTRADA` | `"ancho_caracteres"` | Entero `>= -1` | RW |
| `ENTRADA` | `"alineacion_texto"` | Número entre `0` y `1` | RW |
| `ENTRADA` | `"marco"` | Lógico | RW |
| `ENTRADA_CONTRASENA` | `"texto"` | Cadena | RW |
| `ENTRADA_CONTRASENA` | `"marcador"` | Cadena o `NULO` | RW |
| `ENTRADA_CONTRASENA` | `"editable"` | Lógico | RW |
| `ENTRADA_CONTRASENA` | `"mostrar_revelar"` | Lógico | RW |
| `ENTRADA_CONTRASENA` | `"activar_predeterminado"` | Lógico | RW |
| `AREA_TEXTO` | `"texto"` | Cadena | RW |
| `AREA_TEXTO` | `"editable"` | Lógico | RW |
| `AREA_TEXTO` | `"modo_ajuste"` | `"ninguno"`, `"caracter"`, `"palabra"` o `"palabra_caracter"` | RW |
| `AREA_TEXTO` | `"monoespaciado"` | Lógico | RW |
| `AREA_TEXTO` | `"acepta_tabulador"` | Lógico | RW |
| `AREA_TEXTO` | `"cursor_visible"` | Lógico | RW |
| `AREA_TEXTO` | `"sobrescritura"` | Lógico | RW |

#### **Botones**

| Componente | Propiedad | Valor admitido | Acceso |
|------------|-----------|----------------|--------|
| `BOTON` | `"texto"` | Cadena | RW |
| `BOTON` | `"icono"` | Cadena o `NULO` | RW |
| `BOTON` | `"marco"` | Lógico | RW |
| `CASILLA` | `"texto"` | Cadena | RW |
| `CASILLA` | `"activo"` | Lógico | RW |
| `CASILLA` | `"indeterminado"` | Lógico | RW |
| `CASILLA` | `"grupo"` | ID de otra `CASILLA` o `NULO` | RW |
| `BOTON_ALTERNABLE` | `"texto"` | Cadena | RW |
| `BOTON_ALTERNABLE` | `"icono"` | Cadena o `NULO` | RW |
| `BOTON_ALTERNABLE` | `"marco"` | Lógico | RW |
| `BOTON_ALTERNABLE` | `"activo"` | Lógico | RW |
| `BOTON_ALTERNABLE` | `"grupo"` | ID de otro `BOTON_ALTERNABLE` o `NULO` | RW |
| `BOTON_ENLACE` | `"texto"` | Cadena | RW |
| `BOTON_ENLACE` | `"icono"` | Cadena o `NULO` | RW |
| `BOTON_ENLACE` | `"marco"` | Lógico | RW |
| `BOTON_ENLACE` | `"uri"` | Cadena | RW |
| `BOTON_ENLACE` | `"visitado"` | Lógico | RW |

#### **Controles numéricos y progreso**

| Componente | Propiedad | Valor admitido | Acceso |
|------------|-----------|----------------|--------|
| `ENTRADA_NUMERICA` | `"valor"` | Número dentro del rango configurado | RW |
| `ENTRADA_NUMERICA` | `"minimo"` | Número; debe conservar `minimo <= maximo` | RW |
| `ENTRADA_NUMERICA` | `"maximo"` | Número; debe conservar `minimo <= maximo` | RW |
| `ENTRADA_NUMERICA` | `"paso"` | Número `> 0` | RW |
| `ENTRADA_NUMERICA` | `"decimales"` | Entero `>= 0` | RW |
| `ENTRADA_NUMERICA` | `"solo_numeros"` | Lógico | RW |
| `ENTRADA_NUMERICA` | `"ajustar_saltos"` | Lógico | RW |
| `ENTRADA_NUMERICA` | `"ciclico"` | Lógico | RW |
| `DESLIZADOR` | `"orientacion"` | `"horizontal"` o `"vertical"` | RW |
| `DESLIZADOR` | `"valor"` | Número dentro del rango configurado | RW |
| `DESLIZADOR` | `"minimo"` | Número; debe conservar `minimo <= maximo` | RW |
| `DESLIZADOR` | `"maximo"` | Número; debe conservar `minimo <= maximo` | RW |
| `DESLIZADOR` | `"paso"` | Número `> 0` | RW |
| `DESLIZADOR` | `"decimales"` | Entero `>= 0` | RW |
| `DESLIZADOR` | `"mostrar_valor"` | Lógico | RW |
| `DESLIZADOR` | `"posicion_valor"` | `"izquierda"`, `"derecha"`, `"arriba"` o `"abajo"` | RW |
| `DESLIZADOR` | `"mostrar_origen"` | Lógico | RW |
| `DESLIZADOR` | `"invertido"` | Lógico | RW |
| `BARRA_PROGRESO` | `"orientacion"` | `"horizontal"` o `"vertical"` | RW |
| `BARRA_PROGRESO` | `"progreso"` | Número entre `0` y `1` | RW |
| `BARRA_PROGRESO` | `"texto"` | Cadena o `NULO` | RW |
| `BARRA_PROGRESO` | `"mostrar_texto"` | Lógico | RW |
| `BARRA_PROGRESO` | `"invertido"` | Lógico | RW |
| `BARRA_PROGRESO` | `"paso_pulso"` | Número entre `0` y `1` | RW |
| `INDICADOR_CARGA` | `"activo"` | Lógico | R |

#### **Selección, fecha e imagen**

| Componente | Propiedad | Valor admitido | Acceso |
|------------|-----------|----------------|--------|
| `LISTA_DESPLEGABLE` | `"opciones"` | Arreglo de cadenas | RW |
| `LISTA_DESPLEGABLE` | `"seleccion"` | Entero base cero; `-1` significa sin selección | RW |
| `LISTA_DESPLEGABLE` | `"valor"` | Cadena o `NULO`; corresponde a la opción seleccionada | R |
| `LISTA_DESPLEGABLE` | `"busqueda"` | Lógico | RW |
| `LISTA_DESPLEGABLE` | `"mostrar_flecha"` | Lógico | RW |
| `CALENDARIO` | `"fecha"` | `[anio, mes, dia]`; mes `1..12` y fecha válida | RW |
| `CALENDARIO` | `"mostrar_dias_semana"` | Lógico | RW |
| `CALENDARIO` | `"mostrar_encabezado"` | Lógico | RW |
| `CALENDARIO` | `"mostrar_numeros_semana"` | Lógico | RW |
| `IMAGEN` | `"archivo"` | Cadena con una ruta de archivo local | W |
| `IMAGEN` | `"icono"` | Cadena o `NULO` | RW |
| `IMAGEN` | `"tamano_pixel"` | Entero `>= -1`; `-1` permite el tamaño natural/configurado | RW |

`"archivo"` e `"icono"` son fuentes alternativas para `IMAGEN`; establecer una nueva fuente reemplaza la anterior.

#### **Contenedores**

| Componente | Propiedad | Valor admitido | Acceso |
|------------|-----------|----------------|--------|
| `CAJA` | `"orientacion"` | `"horizontal"` o `"vertical"` | RW |
| `CAJA` | `"separacion"` | Entero `>= 0` | RW |
| `CAJA` | `"homogeneo"` | Lógico | RW |
| `CUADRICULA` | `"separacion_filas"` | Entero `>= 0` | RW |
| `CUADRICULA` | `"separacion_columnas"` | Entero `>= 0` | RW |
| `CUADRICULA` | `"filas_homogeneas"` | Lógico | RW |
| `CUADRICULA` | `"columnas_homogeneas"` | Lógico | RW |
| `CONTENEDOR_DESPLAZABLE` | `"politica_horizontal"` | `"automatico"`, `"siempre"` o `"nunca"` | RW |
| `CONTENEDOR_DESPLAZABLE` | `"politica_vertical"` | `"automatico"`, `"siempre"` o `"nunca"` | RW |
| `CONTENEDOR_DESPLAZABLE` | `"desplazamiento_cinetico"` | Lógico | RW |
| `CONTENEDOR_DESPLAZABLE` | `"desplazamiento_superpuesto"` | Lógico | RW |
| `CONTENEDOR_DESPLAZABLE` | `"marco"` | Lógico | RW |
| `CONTENEDOR_DESPLAZABLE` | `"ancho_contenido_minimo"` | Entero `>= -1` | RW |
| `CONTENEDOR_DESPLAZABLE` | `"alto_contenido_minimo"` | Entero `>= -1` | RW |
| `CONTENEDOR_DESPLAZABLE` | `"ancho_contenido_maximo"` | Entero `>= -1` | RW |
| `CONTENEDOR_DESPLAZABLE` | `"alto_contenido_maximo"` | Entero `>= -1` | RW |

#### **Listas y tablas**

| Componente | Propiedad | Valor admitido | Acceso |
|------------|-----------|----------------|--------|
| `LISTA_VISUAL` | `"modo_seleccion"` | `"ninguno"`, `"unica"`, `"explorar"` o `"multiple"` | RW |
| `LISTA_VISUAL` | `"activar_un_clic"` | Lógico | RW |
| `LISTA_VISUAL` | `"separadores"` | Lógico | RW |
| `LISTA_VISUAL` | `"seleccion"` | Según `"modo_seleccion"`: `NULO`; entero o `-1`; o arreglo de enteros base cero | RW |
| `VISTA_COLUMNAS` | `"columnas"` | Arreglo de cadenas | RW |
| `VISTA_COLUMNAS` | `"datos"` | Arreglo bidimensional; cada fila debe tener el mismo número de celdas que `"columnas"` | RW |
| `VISTA_COLUMNAS` | `"modo_seleccion"` | `"ninguno"`, `"unica"`, `"explorar"` o `"multiple"` | RW |
| `VISTA_COLUMNAS` | `"seleccion"` | Según `"modo_seleccion"`: `NULO`; entero o `-1`; o arreglo de enteros base cero | RW |
| `VISTA_COLUMNAS` | `"reordenable"` | Lógico | RW |
| `VISTA_COLUMNAS` | `"separadores_filas"` | Lógico | RW |
| `VISTA_COLUMNAS` | `"separadores_columnas"` | Lógico | RW |
| `VISTA_COLUMNAS` | `"activar_un_clic"` | Lógico | RW |
| `VISTA_COLUMNAS` | `"seleccion_arrastre"` | Lógico | RW |

Las celdas de `"datos"` admiten `Cadena`, `Número`, `Lógico` o `NULO`.

Para `"seleccion"`:

- con `"ninguno"`, `OBTENER` devuelve `NULO`;
- con `"unica"` o `"explorar"`, se utiliza un entero base cero y `-1` representa ausencia de selección;
- con `"multiple"`, se utiliza un arreglo de enteros base cero.

### **Propiedades de cuadros de diálogo**

Los cuadros de diálogo no heredan las propiedades comunes de los componentes visuales.

#### **Cuadros de diálogo**

| Componente | Propiedad | Valor admitido | Acceso |
|------------|-----------|----------------|--------|
| `DIALOGO_ALERTA` | `"mensaje"` | Cadena | RW |
| `DIALOGO_ALERTA` | `"detalle"` | Cadena o `NULO` | RW |
| `DIALOGO_ALERTA` | `"botones"` | Arreglo de cadenas | RW |
| `DIALOGO_ALERTA` | `"boton_cancelar"` | Entero base cero dentro de `"botones"` o `-1` para ninguno | RW |
| `DIALOGO_ALERTA` | `"boton_predeterminado"` | Entero base cero dentro de `"botones"` o `-1` para ninguno | RW |
| `DIALOGO_ALERTA` | `"modal"` | Lógico | RW |
| `DIALOGO_ARCHIVO` | `"titulo"` | Cadena o `NULO` | RW |
| `DIALOGO_ARCHIVO` | `"etiqueta_aceptar"` | Cadena o `NULO` | RW |
| `DIALOGO_ARCHIVO` | `"modal"` | Lógico | RW |
| `DIALOGO_ARCHIVO` | `"archivo_inicial"` | Cadena con ruta local o `NULO` | RW |
| `DIALOGO_ARCHIVO` | `"carpeta_inicial"` | Cadena con ruta local o `NULO` | RW |
| `DIALOGO_ARCHIVO` | `"nombre_inicial"` | Cadena o `NULO` | RW |
| `DIALOGO_ARCHIVO` | `"filtros"` | Arreglo de filtros con formato `[nombre, patrones[]]` | RW |
| `DIALOGO_ARCHIVO` | `"filtro_predeterminado"` | Entero base cero dentro de `"filtros"` o `-1` para ninguno | RW |

Ejemplo de `"filtros"`:

```clrs-es
[
    ["Imágenes", ["*.png", "*.jpg", "*.jpeg"]],
    ["Texto", ["*.txt", "*.md"]]
]
```

Los índices de opciones, filas, columnas, botones y filtros comienzan en cero.

## **Acciones específicas por componente**

| Función CLRS | Componentes admitidos | Retorno |
|--------------|-----------------------|---------|
| `MOSTRAR(id)` | Todos los componentes visuales | - |
| `OCULTAR(id)` | Todos los componentes visuales | - |
| `ENFOCAR(id)` | Todos los componentes | Lógico |
| `CONTENER(contenedor, componente)` | `VENTANA`, `VENTANA_APLICACION`, `CONTENEDOR_DESPLAZABLE` | - |
| `ANEXAR(contenedor, componente)` | `CAJA`, `LISTA_VISUAL` | - |
| `PREPONER(contenedor, componente)` | `CAJA`, `LISTA_VISUAL` | - |
| `QUITAR(contenedor, componente)` | `VENTANA`, `VENTANA_APLICACION`, `CAJA`, `CUADRICULA`, `CONTENEDOR_DESPLAZABLE`, `LISTA_VISUAL` | - |
| `COLOCAR(cuadricula, componente, columna, fila, ancho, alto)` | `CUADRICULA` | - |
| `CERRAR(id)` | `VENTANA`, `VENTANA_APLICACION` | - |
| `MAXIMIZAR(id)` | `VENTANA`, `VENTANA_APLICACION` | - |
| `MINIMIZAR(id)` | `VENTANA`, `VENTANA_APLICACION` | - |
| `PANTALLA_COMPLETA(id)` | `VENTANA`, `VENTANA_APLICACION` | - |
| `RESTAURAR(id)` | `VENTANA`, `VENTANA_APLICACION` | - |
| `PULSAR_PROGRESO(id)` | `BARRA_PROGRESO` | - |
| `INICIAR(id)` | `INDICADOR_CARGA` | - |
| `PARAR(id)` | `INDICADOR_CARGA` | - |
| `MARCAR_DIA(id, dia)` | `CALENDARIO` | - |
| `DESMARCAR_DIA(id, dia)` | `CALENDARIO` | - |
| `LIMPIAR_MARCAS(id)` | `CALENDARIO` | - |
| `LIMPIAR_IMAGEN(id)` | `IMAGEN` | - |
| `ANEXAR_FILA(id, fila)` | `VISTA_COLUMNAS` | - |
| `QUITAR_FILA(id, indice)` | `VISTA_COLUMNAS` | - |
| `LIMPIAR_FILAS(id)` | `VISTA_COLUMNAS` | - |

## **Acciones de cuadros de diálogo**

| Función CLRS | Descripción | Retorno |
|--------------|-------------|---------|
| `MOSTRAR_ALERTA(id, ventana)` | Muestra una alerta sin esperar su respuesta. | - |
| `ELEGIR_ALERTA(id, ventana)` | Espera la elección de un botón. | Número; `-1` al cancelar sin botón de cancelación |
| `ABRIR_ARCHIVO(id, ventana)` | Selecciona un archivo. | Cadena o `NULO` |
| `ABRIR_ARCHIVOS(id, ventana)` | Selecciona varios archivos. | Arreglo de cadenas |
| `GUARDAR_ARCHIVO(id, ventana)` | Selecciona una ruta de destino. | Cadena o `NULO` |
| `ELEGIR_CARPETA(id, ventana)` | Selecciona una carpeta. | Cadena o `NULO` |
| `ELEGIR_CARPETAS(id, ventana)` | Selecciona varias carpetas. | Arreglo de cadenas |

## **Eventos**

Los eventos permiten asociar una función CLRS a una acción o cambio que ocurre sobre un componente. La conexión se realiza mediante `CONECTAR`, utilizando el identificador del componente, el nombre del evento y la función que debe ejecutarse.

```clrs-es
SALUDAR(id)
    escribir "Se pulsó: " + id

BOTON("saludar", "Saludar")
CONECTAR("saludar", "clic", SALUDAR)
```

Cuando ocurre el evento `"clic"` sobre el botón `"saludar"`, CLRS ejecuta la función `SALUDAR`.

La función conectada recibe siempre primero el **identificador del componente** que originó el evento y, según el tipo de evento, puede recibir después información adicional como texto, valores, índices, coordenadas o teclas.

```clrs-es
CAMBIAR(id, texto)
    escribir texto

ENTRADA("nombre")
CONECTAR("nombre", "cambio", CAMBIAR)
```

### **Eventos comunes de componentes visuales**

Los siguientes eventos pueden conectarse a cualquier componente visual. No se aplican a `DIALOGO_ALERTA` ni `DIALOGO_ARCHIVO`.

| Evento | Callback |
|--------|----------|
| `"puntero_entro"` | `FUNCION(id, x, y)` |
| `"puntero_movido"` | `FUNCION(id, x, y)` |
| `"puntero_salio"` | `FUNCION(id)` |
| `"presionado"` | `FUNCION(id, veces, x, y, boton)` |
| `"liberado"` | `FUNCION(id, veces, x, y, boton)` |
| `"tecla_presionada"` | `FUNCION(id, tecla, codigo, modificadores)` |
| `"tecla_liberada"` | `FUNCION(id, tecla, codigo, modificadores)` |

### **Eventos específicos por componente**

| Evento | Componentes admitidos | Callback |
|--------|-----------------------|----------|
| `"cerrar"` | `VENTANA`, `VENTANA_APLICACION` | `FUNCION(id)` |
| `"cambio"` | `ENTRADA`, `ENTRADA_CONTRASENA`, `AREA_TEXTO` | `FUNCION(id, texto)` |
| `"clic"` | `BOTON`, `BOTON_ALTERNABLE`, `BOTON_ENLACE` | `FUNCION(id)` |
| `"activar"` | `ENTRADA`, `ENTRADA_CONTRASENA` | `FUNCION(id, texto)` |
| `"activar"` | `BOTON`, `CASILLA`, `LISTA_DESPLEGABLE` | `FUNCION(id)` |
| `"activar"` | `ENTRADA_NUMERICA` | `FUNCION(id, valor)` |
| `"alternado"` | `CASILLA`, `BOTON_ALTERNABLE` | `FUNCION(id, activo)` |
| `"activar_enlace"` | `BOTON_ENLACE` | `FUNCION(id, uri)` |
| `"valor_cambiado"` | `ENTRADA_NUMERICA`, `DESLIZADOR` | `FUNCION(id, valor)` |
| `"seleccion_cambiada"` | `LISTA_DESPLEGABLE` | `FUNCION(id, indice, valor)` |
| `"seleccion_cambiada"` | `LISTA_VISUAL`, `VISTA_COLUMNAS` | `FUNCION(id, seleccion)` |
| `"fila_activada"` | `LISTA_VISUAL` | `FUNCION(id, indice)` |
| `"fila_activada"` | `VISTA_COLUMNAS` | `FUNCION(id, indice, fila)` |
| `"fecha_cambiada"` | `CALENDARIO` | `FUNCION(id, fecha)` |
| `"borde_alcanzado"` | `CONTENEDOR_DESPLAZABLE` | `FUNCION(id, borde)` |
| `"borde_excedido"` | `CONTENEDOR_DESPLAZABLE` | `FUNCION(id, borde)` |

Los eventos `"cerrar"`, `"activar_enlace"` y `"tecla_presionada"` requieren una respuesta inmediata. Sus callbacks no pueden realizar operaciones que suspendan la ejecución.

Devolver `VERDADERO` detiene la acción predeterminada; `FALSO` o `NULO` permiten continuar.

## **Tema y apariencia**

| Función CLRS | Descripción | Retorno |
|--------------|-------------|---------|
| `ESTABLECER_TEMA(nombre)` | Selecciona un tema GTK disponible. | - |
| `OBTENER_TEMA()` | Consulta el nombre del tema vigente. | Cadena |
| `ESTABLECER_MODO_TEMA(modo)` | Selecciona `"sistema"`, `"claro"` u `"oscuro"`. | - |
| `OBTENER_MODO_TEMA()` | Consulta el modo de apariencia vigente. | Cadena |

Si el programa no configura un tema, se conserva la apariencia normal de GTK. La biblioteca no expone CSS ni estilos arbitrarios.

### **Tema incluido en Windows**

La distribución GTK utilizada por CLRS en Windows incluye **Adwaita** como tema base.

| Tema | Modo claro | Modo oscuro |
|------|------------|-------------|
| `Adwaita` | `ESTABLECER_MODO_TEMA("claro")` | `ESTABLECER_MODO_TEMA("oscuro")` |

GTK también puede utilizar otros temas instalados en el sistema. Esto se aplica tanto a Windows como a otros sistemas operativos. La disponibilidad de cada tema y de sus variantes clara u oscura depende del propio tema y del entorno donde se ejecute el programa.

## **Ejemplo funcional de código**

Interfaz gráfica de usuario para cambiar el mensaje en una etiqueta.

```clrs-es
principalVentana = "principalVentana"
saludoCaja = "saludoCaja"
saludoEtiqueta = "saludoEtiqueta"
saludarBoton = "saludarBoton"
sistemaTema = "sistema"

SALUDAR()
    ESTABLECER(saludoEtiqueta, "texto", "¡Hola mundo desde GUI!")
    escribir "¡Hola mundo desde CLI!"

PRINCIPAL()
    ESTABLECER_TEMA(sistemaTema)

    VENTANA(principalVentana, "Mi primera interfaz")
    CAJA(saludoCaja, "vertical", 8)
    ETIQUETA(saludoEtiqueta, "Pulsa el botón")
    BOTON(saludarBoton, "Saludar")

    CONTENER(principalVentana, saludoCaja)
    ANEXAR(saludoCaja, saludoEtiqueta)
    ANEXAR(saludoCaja, saludarBoton)
    CONECTAR(saludarBoton, "clic", SALUDAR)

    MOSTRAR(principalVentana)
```

## **Ejecución y exportación**

La GUI requiere Node.js 22, 24 o 26 y GTK 4.10 o superior. Al ejecutar por primera vez un programa gráfico, CLRS prepara automáticamente una instalación privada de `node-gtk@4.1.1`.

En Windows, la distribución compatible de `node-gtk` incluye los recursos de GTK. En Linux y macOS, GTK debe estar disponible en el sistema; CLRS comprueba su disponibilidad, pero no instala paquetes del sistema. Los programas sin GUI no utilizan GTK.

**Generar código JavaScript** crea el proyecto en `app/<nombre-del-programa>/`. Los proyectos CLI incluyen `<programa>.js`, `package.json` y `package-lock.json`; los proyectos GUI añaden `prepare-packable.cjs` y `bootstrap.cjs`. Los nombres se normalizan automáticamente.

Para preparar y ejecutar el proyecto:

```powershell
npm ci
npm start
````

Para construir un ejecutable:

```text
Windows:      npm run build:win
Linux/macOS:  npm run build:unix
```

La distribución se genera en `dist/`. Los proyectos exportados funcionan sin VS Code ni la extensión, y los ejecutables CLI ya construidos no requieren Node.js. Los recursos externos, como imágenes, deben distribuirse junto con el programa cuando éste los utilice.

La validación nativa se realizó en Windows x64 con Node 24 y GTK 4.22.4. Las demás configuraciones cuentan con pruebas automatizadas de compatibilidad y regresión, pero no están certificadas nativamente.

---

<a id="analisis-algoritmico"></a>

# **📊 Análisis algorítmico**

CLRS Kit Español incluye herramientas para estudiar el comportamiento teórico de un algoritmo directamente desde el código fuente.

El análisis se divide en dos partes:

1. **Análisis de costo:** muestra cómo se construye la función de costo a partir de las instrucciones.
2. **Análisis de complejidad:** simplifica ese costo y determina, cuando es posible, su orden de crecimiento asintótico.

---

<a id="analisis-costo"></a>

# **🧮 Análisis de costo**

El análisis de costo permite observar cuánto trabajo aporta cada parte de un algoritmo.

Las expresiones se generan automáticamente a partir del Árbol de Sintaxis Abstracta (AST).

| Funcionalidad              | Descripción                                                       |
| -------------------------- | ----------------------------------------------------------------- |
| **Costo por instrucción**  | Muestra la expresión de costo asociada a una línea de código.     |
| **Costo de ciclos**        | Calcula el número de iteraciones cuando puede determinarse.       |
| **Costo de condicionales** | Representa el trabajo producido por las diferentes ramas.         |
| **Costo entre funciones**  | Propaga el costo de funciones llamadas desde otras funciones.     |
| **Mostrar/Ocultar**        | Permite activar o esconder las expresiones de costo en el editor. |

Por ejemplo:

```clrs-es
SUMAR(A[])
    total = 0

    para i = 0 hasta LONG(A) - 1
        total = total + A[i]

    retornar total
```

El analizador puede reconocer que el cuerpo del ciclo se ejecuta aproximadamente `n` veces y construir una función de costo a partir de sus instrucciones.

## **Iteraciones**

El analizador intenta determinar cuántas veces se ejecuta cada ciclo.

### **Ciclos `para`**

Reconoce recorridos ascendentes y descendentes:

```clrs-es
para i = 0 hasta n - 1
    escribir i
```

```clrs-es
para i = n bajando 1
    escribir i
```

### **Ciclos `mientras`**

También reconoce progresiones sencillas.

#### **Crecimiento aditivo**

```clrs-es
i = 0

mientras i < n
    i = i + 1
```

El número de iteraciones crece linealmente con `n`.

#### **Reducción multiplicativa**

```clrs-es
i = n

mientras i > 1
    i = i / 2
```

El número de iteraciones crece logarítmicamente.

También se reconocen algunas transformaciones equivalentes:

```clrs-es
i = PISO(i / 2)
```

```clrs-es
i = REDONDEA(i / 2)
```

## **Cuando el costo no puede determinarse**

El analizador utiliza un criterio conservador.

Si no puede demostrar cuántas veces se ejecuta una estructura, la cantidad se conserva como desconocida:

```text
?
```

Esto puede ocurrir, por ejemplo, cuando:

* el límite cambia dentro del ciclo;
* la actualización depende de una condición;
* el paso no puede determinarse;
* no puede demostrarse la terminación;
* intervienen funciones cuyo efecto no puede analizarse.

El analizador evita asumir automáticamente que un ciclo realiza `n` iteraciones cuando no existe evidencia suficiente.

## **Llamadas entre funciones**

El costo puede propagarse entre funciones propias del programa.

```clrs-es
PROCESAR(A[])
    ORDENAR(A)
    retornar A
```

El análisis conserva:

* la función llamada;
* los parámetros utilizados;
* los argumentos reales;
* el costo transferido entre funciones.

Los parámetros que no participan en la complejidad no afectan innecesariamente el resultado.

---

<a id="analisis-complejidad"></a>

# **📈 Análisis de complejidad**

El análisis de complejidad utiliza las expresiones de costo para estudiar cómo crece el trabajo del algoritmo conforme aumenta el tamaño de la entrada.

El informe puede analizar cada función de manera independiente.

| Funcionalidad           | Descripción                                                      |
| ----------------------- | ---------------------------------------------------------------- |
| **Informe por función** | Muestra el costo, su simplificación y la conclusión asintótica.  |
| **Mejor caso**          | Analiza el escenario de menor trabajo cuando puede determinarse. |
| **Peor caso**           | Analiza el escenario de mayor trabajo cuando puede determinarse. |
| **CodeLens**            | Muestra `Ver análisis de complejidad` sobre las funciones.       |
| **Ir al código fuente** | Permite regresar directamente a la declaración analizada.        |
| **Verificación**        | Explica qué evidencia respalda la conclusión obtenida.           |

## **Interpretación de los resultados**

El informe distingue diferentes tipos de conclusiones.

| Resultado                         | Significado                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------------- |
| **Θ(f(n))**                       | Se determinó una cota ajustada para el crecimiento.                                   |
| **O(f(n))**                       | Se determinó una cota superior.                                                       |
| **Ω(f(n))**                       | Se determinó una cota inferior.                                                       |
| **Bajo condiciones**              | El resultado depende de ciertas hipótesis sobre la entrada o el algoritmo.            |
| **Cota estructural conservadora** | La conclusión se obtiene únicamente a partir de la estructura demostrable del código. |
| **No determinado**                | No existe evidencia suficiente para justificar una complejidad.                       |

Cuando el resultado no puede justificarse, la interfaz muestra:

```text
No determinado
```

## **Simplificación asintótica**

El clasificador puede:

* eliminar constantes;
* ignorar coeficientes constantes;
* combinar productos;
* reconocer ciclos anidados;
* seleccionar términos dominantes;
* conservar diferentes variables cuando existen varias medidas de entrada.

Por ejemplo:

```text
3n² + 5n + 8
```

se clasifica como:

```text
O(n²)
```

## **Complejidad multivariable**

Cuando un algoritmo depende de varias entradas independientes, el análisis puede conservar diferentes variables.

Por ejemplo:

```clrs-es
PROCESAR(A[], B[])
```

puede producir una clasificación como:

```text
O(n + m)
```

donde `n` representa el tamaño de `A` y `m` el tamaño de `B`.

## **Complejidades reconocidas**

El analizador puede determinar automáticamente muchas familias comunes:

| Complejidad      |   Soporte  | Ejemplo típico                                  |
| ---------------- | :--------: | ----------------------------------------------- |
| **O(1)**         |      ✅     | Operaciones constantes                          |
| **O(n)**         |      ✅     | Recorrido de un arreglo                         |
| **O(n²)**        |      ✅     | Dos ciclos anidados                             |
| **O(n³)**        |      ✅     | Tres ciclos anidados                            |
| **O(nᵏ)**        |      ✅     | Número fijo de ciclos anidados                  |
| **O(log n)**     |      ✅     | División repetida del tamaño                    |
| **O(n log n)**   |      ✅     | Combinación de trabajo lineal y logarítmico     |
| **O(2ⁿ)**        |      ✅     | Algunas recurrencias con ramificación constante |
| **O(n!)**        |      ✅     | Algunas recurrencias con ramificación variable  |
| **Recurrencias** | ⚠️ Parcial | Depende de que la estructura pueda demostrarse  |

## **Sumatorias y ciclos dependientes**

El analizador también puede reconocer algunas sumatorias cuyo número de iteraciones depende del índice.

Por ejemplo:

```clrs-es
para i = 1 hasta n
    para j = 1 hasta n / i
        escribir j
```

La suma:

```text
n/1 + n/2 + n/3 + ... + n/n
```

puede clasificarse como:

```text
O(n log n)
```

Cuando la forma de la sumatoria no puede demostrarse de manera segura, el resultado permanece como **No determinado**.

## **Funciones recursivas**

Las funciones recursivas se estudian mediante sus relaciones de recurrencia.

El analizador puede reconocer reducciones como:

```text
T(n - 1)
T(n / 2)
2T(n / 2)
T(√n)
```

y algunas estructuras más complejas.

Según el caso, puede utilizar métodos como:

| Método                     | Uso principal                                           |
| -------------------------- | ------------------------------------------------------- |
| **Sustitución**            | Reducciones aditivas sencillas                          |
| **Teorema Maestro**        | Subproblemas del mismo tamaño                           |
| **Akra–Bazzi**             | Algunas particiones desiguales                          |
| **Raíces características** | Algunas recurrencias ramificadas                        |
| **Productos factoriales**  | Recurrencias donde el número de llamadas depende de `n` |

Ejemplos que pueden reconocerse:

```text
T(n) = T(n - 1) + O(1)
```

```text
T(n) = 2T(n / 2) + O(n)
```

```text
T(n) = T(√n) + O(1)
```

En el último caso puede obtenerse:

```text
O(log log n)
```

cuando las condiciones necesarias pueden demostrarse.

### **Recursión mutua**

El analizador también estudia grupos de funciones que se llaman entre sí.

```clrs-es
A(n)
    B(n - 1)

B(n)
    A(n - 1)
```

Estas relaciones se analizan mediante el grafo de llamadas.

Si el sistema no puede demostrar una reducción válida, un caso base o una familia de recurrencia soportada, el resultado permanece como:

```text
No determinado
```

## **Informe de complejidad**

El botón **Mostrar informe de complejidad algorítmica** abre una vista dedicada al análisis de las funciones del documento.

Cada función puede mostrar:

1. **Función de costo**
2. **Simplificación algebraica**
3. **Conclusión asintótica**
4. **Verificación del resultado**

Las expresiones matemáticas se muestran mediante KaTeX.

Cuando intervienen varias funciones, el informe puede mostrar también la cadena de llamadas utilizada para obtener el resultado.

```text
PRINCIPAL
   ↓
ORDENAR
   ↓
PARTICIONAR
```

Desde el informe es posible regresar a la declaración correspondiente mediante **Ir al código fuente**.

## **Mejor y peor caso**

Cuando la estructura del algoritmo permite distinguir diferentes comportamientos, el informe presenta por separado:

```text
Mejor caso
```

y

```text
Peor caso
```

Cada resultado indica además si se trata de:

* una cota ajustada;
* una cota superior o inferior;
* un resultado condicionado;
* una cota conservadora;
* un resultado no determinado.

## **Alcance del análisis**

El análisis es deliberadamente conservador.

Una complejidad sólo se presenta cuando existe evidencia suficiente para justificarla. Algunos algoritmos, ciclos o recurrencias pueden permanecer como **No determinado** si su comportamiento no puede demostrarse automáticamente.

El análisis automático no sustituye el razonamiento manual. Su objetivo es proporcionar una referencia visual y ayudar a comprender cómo el código se relaciona con su función de costo y su crecimiento asintótico.

---

<a id="marco-pruebas"></a>

# **🧪 Marco de pruebas funcionales**

El marco de pruebas funcionales permite comprobar de forma repetible que un programa CLRS se comporta como esperas. Las suites aparecen en el panel **Pruebas** de VS Code y utilizan el mismo analizador, runtime y depurador que la ejecución normal del lenguaje.

Una prueba CLRS sigue una idea sencilla:

Para estas líneas de entrada, el programa debe producir estas líneas de salida.

Las pruebas de proyectos propios se escriben como datos declarativos en archivos `*.clrs-tests.json`. No necesitas programar funciones de prueba ni utilizar una biblioteca adicional: describes los casos y CLRS Kit se encarga de descubrirlos, ejecutarlos, compararlos y presentar sus resultados.

En BROKER.95 no es necesario crear estos archivos para resolver un contrato. Sus casos públicos se proyectan automáticamente en el mismo panel y CIPHER conserva el contexto pedagógico del ejercicio. El formato declarativo está disponible principalmente para programas y ejercicios propios, donde mantener las pruebas como código facilita revisarlas, compartirlas y versionarlas.

## **Relación entre el programa y la prueba**

Considera el programa `suma.clrs`:

```clrs-es
PRINCIPAL()
    a = 0
    b = 0

    leer a
    leer b

    escribir a + b
```

Un caso con esta definición:

```json
{
  "input": ["5", "8"],
  "expectedOutput": ["13"]
}
```

entrega `5` al primer `leer`, `8` al segundo y espera una línea `13` producida mediante `escribir`.

- Cada elemento de `input` representa una línea de entrada, en el mismo orden en que el programa la consume.
- Cada elemento de `expectedOutput` representa una línea completa de salida, en el mismo orden en que debería mostrarse.
- `input: []` significa que el caso no proporciona entrada.
- `expectedOutput: []` significa que el programa no debería producir salida.

## **Crear una suite desde cero**

1. Guarda el programa que quieres probar, por ejemplo `suma.clrs`.
2. Crea junto a él un archivo cuyo nombre termine en `.clrs-tests.json`, por ejemplo `suma.clrs-tests.json`.
3. Declara la identidad de la suite, el programa relativo y su arreglo de casos.
4. Agrega primero un caso normal cuyo resultado puedas calcular con claridad.
5. Añade casos límite y casos que recorran decisiones diferentes.
6. Selecciona un comparador distinto de `exact` únicamente cuando el comportamiento esperado lo requiera.
7. Guarda el archivo. VS Code lo validará y CLRS Kit lo descubrirá automáticamente en el panel **Pruebas**.
8. Ejecuta un caso, la suite completa o todas las pruebas del proyecto.

También puedes partir de **Paleta de comandos → `Crear suite de pruebas CLRS`** o generar un proyecto completo mediante **`Crear proyecto CLRS`**.

## **Estructura completa de una suite**

```json
{
  "version": 1,
  "id": "suite:suma",
  "name": "Pruebas de suma",
  "program": "./suma.clrs",
  "cases": [
    {
      "id": "case:positivos",
      "name": "Suma dos números positivos",
      "input": ["5", "8"],
      "expectedOutput": ["13"],
      "comparison": "number",
      "timeoutMs": 5000
    },
    {
      "id": "case:ceros",
      "name": "Conserva el cero",
      "input": ["0", "0"],
      "expectedOutput": ["0"],
      "comparison": "number"
    },
    {
      "id": "case:signos-distintos",
      "name": "Combina valores positivos y negativos",
      "input": ["-3", "7"],
      "expectedOutput": ["4"],
      "comparison": "number"
    }
  ]
}
```

Una suite apunta a un programa y puede contener tantos casos independientes como necesites.

### **Campos de la suite**

| Campo | Obligatorio | Descripción |
|---|:---:|---|
| `$schema` | No | Referencia opcional a un JSON Schema. Normalmente no es necesaria porque VS Code valida automáticamente los archivos `*.clrs-tests.json`. |
| `version` | Sí | Versión del formato declarativo. El valor vigente es `1`. |
| `id` | Sí | Identificador técnico y estable de la suite, por ejemplo `suite:suma`. Debe comenzar con un carácter alfanumérico y puede utilizar letras, números, `.`, `_`, `:`, `/` o `-`. |
| `name` | Sí | Nombre legible que aparecerá como raíz de la suite en el panel **Pruebas**. |
| `program` | Sí | Ruta relativa desde la suite hasta el archivo `.clrs` que será ejecutado. |
| `cases` | Sí | Arreglo de casos pertenecientes a la suite. Puede estar vacío mientras preparas la definición. |

Los campos adicionales no reconocidos se rechazan para evitar errores silenciosos en una definición.

### **Campos de cada caso**

| Campo | Obligatorio | Valor predeterminado | Descripción |
|---|:---:|---|---|
| `id` | Sí | - | Identificador único dentro de la suite, por ejemplo `case:positivos`. Conviene conservarlo estable aunque después cambies el nombre visible. |
| `name` | Sí | - | Descripción breve del comportamiento que comprueba el caso. |
| `input` | Sí | - | Arreglo de líneas entregadas a las instrucciones `leer`. Cada elemento debe ser una cadena sin saltos de línea internos. |
| `expectedOutput` | Sí | - | Arreglo de líneas que el programa debería producir mediante `escribir`. |
| `comparison` | No | `exact` | Estrategia utilizada para comparar la salida obtenida con la esperada. |
| `timeoutMs` | No | `5000` | Tiempo máximo del caso en milisegundos. Admite valores entre `1` y `60000`. |

## **Elegir casos útiles**

Una suite pequeña suele comenzar con tres tipos de casos:

1. **Caso normal:** una entrada representativa del uso esperado.
2. **Caso límite:** cero, colección vacía, un único elemento, valor mínimo o límite de una condición.
3. **Camino alternativo:** una entrada que obligue a tomar otra rama de una decisión o a no entrar en un ciclo.

Por ejemplo, para una condición `si edad >= 18`, una suite útil debería comprobar al menos un valor mayor, uno menor y el límite exacto `18`. Las pruebas deben basarse en lo que el programa promete hacer, no en los pasos internos concretos de una implementación actual.

## **Comparadores disponibles**

Si omites `comparison`, se utiliza `exact`. Los demás comparadores permiten expresar con precisión qué diferencias son relevantes para el ejercicio.

| Comparador | Qué comprueba | Forma de `expectedOutput` |
|---|---|---|
| `exact` | Texto idéntico, incluidos espacios y saltos de línea. | `["Hola"]` |
| `trimmed` | Texto igual después de ignorar espacios exteriores. | `["Hola"]` |
| `normalized-whitespace` | Texto igual después de normalizar bloques de espacios, tabulaciones y saltos. | `["uno dos"]` |
| `lines` | Las mismas líneas en el mismo orden; considera equivalentes los saltos LF y CRLF. | `["primera", "segunda"]` |
| `unordered-lines` | Las mismas líneas en cualquier orden, conservando las repeticiones. | `["rojo", "verde"]` |
| `number` | Un único número finito, sin texto adicional. | `["13"]` |
| `number-tolerance` | Un número dentro de una tolerancia absoluta. | `["3.14 ± 0.01"]` o `["3.14 +/- 0.01"]` |
| `json` | Igualdad estructural de un valor JSON; el orden de las propiedades de un objeto no importa. | `["{\"a\":1,\"b\":2}"]` |
| `array-ordered` | Igualdad estructural de un arreglo JSON respetando posiciones y duplicados. | `["[1,2,3]"]` |
| `array-unordered` | Igualdad estructural de un arreglo JSON sin exigir orden, pero conservando duplicados. | `["[1,2,3]"]` |
| `boolean` | Un valor lógico equivalente a `true`, `false`, `VERDAD` o `FALSO`. | `["VERDAD"]` |
| `contains` | La salida contiene el fragmento esperado. | `["resultado: 13"]` |
| `regex-safe` | La salida satisface una expresión regular lineal y acotada. | `["^item-\\d+$"]` |

`regex-safe` está deliberadamente limitado: no admite grupos, alternancias, referencias internas ni más de un cuantificador. Para resultados estructurados conviene preferir `json`, `array-ordered` o `array-unordered` en lugar de comparar manualmente su representación textual.

Ejemplo de tolerancia numérica:

```json
{
  "id": "case:aproximacion",
  "name": "Acepta una aproximación de pi",
  "input": [],
  "expectedOutput": ["3.1416 ± 0.001"],
  "comparison": "number-tolerance"
}
```

## **Descubrimiento, ejecución y depuración**

Después de guardar una suite válida:

1. abre el panel **Pruebas** desde la barra de actividad de VS Code;
2. localiza la suite y expande sus casos;
3. utiliza **Ejecutar** sobre un caso para aislarlo o sobre la suite para comprobarlos todos;
4. utiliza **Depurar** sobre un caso para iniciar el DAP con su entrada declarada;
5. corrige el programa y vuelve a ejecutar sin modificar manualmente la entrada cada vez.

La depuración conserva puntos de interrupción, ejecución paso a paso, pila de llamadas y variables. Cada caso se ejecuta de forma independiente con su propia entrada, timeout y evidencia.

## **Resultados, divergencias y cobertura**

Cuando una prueba falla, su resultado puede mostrar:

- entrada utilizada;
- salida esperada;
- salida obtenida;
- primera diferencia encontrada;
- explicación pedagógica determinista;
- ubicación relacionada en el código;
- duración y estado de ejecución.

La cobertura registra qué instrucciones, declaraciones y resultados de decisión fueron recorridos. VS Code puede mostrar la cobertura de un caso o la acumulada por varias pruebas, y el diagrama de flujo proyecta la misma evidencia como nodos ejecutados, parciales o no recorridos.

Una cobertura alta no demuestra por sí sola que el programa sea correcto: indica qué partes fueron ejecutadas y ayuda a descubrir caminos que todavía no poseen un caso representativo.

## **Si una suite no aparece**

Comprueba que:

- el nombre termine exactamente en `.clrs-tests.json`;
- `program` sea una ruta relativa hacia un archivo `.clrs` existente;
- todos los campos obligatorios estén presentes;
- los identificadores de suite y caso no estén repetidos;
- `input` y `expectedOutput` sean arreglos de cadenas;
- el formato de `expectedOutput` sea válido para el comparador seleccionado.

---

<a id="diagramas-flujo"></a>

# **🗺️ Generador de diagramas de flujo**

El generador de diagramas de flujo convierte automáticamente el código CLRS en una representación visual del flujo del programa.

El diagrama se abre dentro de Visual Studio Code y permanece sincronizado con el archivo mientras trabajas.

## **Abrir el diagrama**

Puedes abrirlo desde:

* **Paleta de comandos → `Mostrar diagrama de flujo`**

El diagrama aparecerá en un panel junto al editor.

## **Sincronización con el código**

El diagrama se actualiza automáticamente cuando modificas el archivo.

También se sincroniza con la posición del cursor:

* La instrucción actual se resalta en el diagrama.
* Al seleccionar un nodo, el editor puede llevarte a su línea correspondiente.
* No es necesario regenerar manualmente el diagrama después de cada cambio.

Esto permite utilizar el diagrama como una representación visual del código mientras programas.

## **Editar el código desde el diagrama**

Las figuras y algunas flechas del diagrama pueden seleccionarse para modificar el código de una forma visual.

Al seleccionar una figura puedes:

* cambiar sus valores o expresiones;
* utilizar **Ir** para abrir su línea en el editor;
* eliminar la instrucción o el bloque que representa.

Al seleccionar una flecha compatible puedes insertar una nueva asignación, entrada, salida, decisión, ciclo, retorno o llamada a función en ese punto del flujo.

El botón **`ƒ`** permite agregar una función nueva al documento completo. Antes de aplicar cada cambio se comprueba que el código resultante continúe siendo válido, y las ediciones pueden deshacerse normalmente desde Visual Studio Code.

## **Diagramar sólo una parte del código**

Si seleccionas un fragmento antes de abrir el generador, se crea un diagrama únicamente para esa selección.

Esto resulta útil para estudiar:

* una función;
* un ciclo;
* un condicional;
* una sección concreta de un programa grande.

El contenido seleccionado permanece como ámbito del diagrama durante esa sesión.

## **Elementos compatibles**

El generador reconoce las principales estructuras de CLRS.

| Elemento             | Soporte |
| -------------------- | :-----: |
| `PRINCIPAL`          |    ✅    |
| Funciones            |    ✅    |
| Llamadas a funciones |    ✅    |
| Asignaciones         |    ✅    |
| `leer`               |    ✅    |
| `escribir`           |    ✅    |
| `si`                 |    ✅    |
| `sino si`            |    ✅    |
| `sino`               |    ✅    |
| `mientras`           |    ✅    |
| `para`               |    ✅    |
| `retornar`           |    ✅    |

Las funciones se muestran como **subgrafos independientes**, facilitando la lectura de programas con varias funciones.

## **Apariencia**

El diagrama puede adaptarse visualmente desde su barra de herramientas.

El tema predeterminado es **VS Code**, por lo que utiliza los colores del tema activo del editor.

Esto permite que el diagrama se adapte automáticamente a:

* temas claros;
* temas oscuros;
* temas de alto contraste.

También están disponibles otros estilos:

| Tema    |
| ------- |
| VS Code |
| Clásico |
| Moderno |
| Pastel  |
| Sobrio  |
| Oscuro  |

Los cambios se aplican inmediatamente.

### **Dirección del flujo**

Puedes cambiar la orientación del diagrama.

| Dirección      | Descripción                  |
| -------------- | ---------------------------- |
| **Vertical**   | Flujo de arriba hacia abajo  |
| **Horizontal** | Flujo de izquierda a derecha |

La orientación se aplica tanto al flujo principal como a las funciones.

## **Navegación**

El diagrama puede explorarse de forma interactiva.

Entre las acciones disponibles se encuentran:

* acercar y alejar con zoom;
* desplazar el diagrama;
* ajustar todo el contenido al panel;
* centrar el nodo actual;
* abrir una instrucción directamente en el editor;
* navegar entre nodos mediante teclado;
* consultar la línea y columna de una instrucción.

Esto facilita trabajar con diagramas grandes sin perder la referencia del código original.

### **Buscar nodos**

El campo **Buscar nodo…** permite localizar contenido dentro del diagrama.

La búsqueda puede encontrar:

* texto de instrucciones;
* identificadores;
* tipos de nodo;
* referencias.

No distingue entre mayúsculas, minúsculas o tildes.

Controles disponibles:

| Acción              | Control               |
| ------------------- | --------------------- |
| Siguiente resultado | `Enter` o `↓`         |
| Resultado anterior  | `Mayús + Enter` o `↑` |

Las coincidencias se resaltan y la coincidencia activa se centra automáticamente.

### **Mostrar sólo una parte del flujo**

La opción **Flujo visible** permite seleccionar qué parte del programa quieres visualizar.

Puedes mostrar:

* todo el programa;
* flujo principal;
* flujo global;
* una función concreta.

Cuando una función se muestra de forma aislada, la sincronización con el código sigue funcionando.

Si exportas el diagrama en ese momento, sólo se exportará el flujo visible.

### **Minimapa**

El minimapa muestra una vista general del diagrama.

Permite:

* conocer qué parte del diagrama estás observando;
* seguir el zoom y desplazamiento;
* moverte rápidamente haciendo clic en otra zona.

Puede mostrarse u ocultarse desde la barra de herramientas.

## **Visualización de la ejecución**

El diagrama también puede mostrar el recorrido real de un programa mientras se ejecuta.

Con el diagrama abierto, utiliza:

* **`Ejecutar código CLRS`**

La ejecución continúa realizándose normalmente en la terminal integrada.

Por lo tanto, características como:

* `leer`;
* `escribir`;
* errores de ejecución;

mantienen su comportamiento habitual.

### **Durante la ejecución**

El diagrama muestra visualmente el recorrido realizado por el programa.

| Estado                 | Comportamiento                          |
| ---------------------- | --------------------------------------- |
| **Nodo actual**        | Se resalta y se centra automáticamente  |
| **Nodos visitados**    | Permanecen señalados                    |
| **Ejecución correcta** | Se muestra como finalización correcta   |
| **Error**              | Se identifica el último nodo alcanzado  |
| **Interrupción**       | La ejecución se marca como interrumpida |

Esto permite observar el algoritmo como una secuencia de pasos reales.

### **Revisar la traza**

Después o durante la ejecución puedes revisar el recorrido mediante los controles inferiores.

Entre las acciones disponibles se encuentran:

* ir al primer paso;
* paso anterior;
* reproducir;
* pausar;
* paso siguiente;
* regresar al paso más reciente.

La reproducción admite diferentes velocidades:

```text
0.5×
1×
2×
```

Cuando estás situado en el paso más reciente, los nuevos eventos pueden seguirse en vivo.

### **La traza corresponde al código ejecutado**

La traza pertenece exactamente a la versión del archivo que fue ejecutada.

Si modificas el código después de la ejecución, la traza anterior se descarta para evitar mostrar pasos que ya no corresponden con el nuevo programa.

El diagrama y el depurador funcionan de manera independiente.

### **Límite de la traza**

Por seguridad, el panel conserva como máximo:

```text
10 000 pasos
```

Si el programa supera esta cantidad, la ejecución continúa normalmente, pero el diagrama indica que la traza fue limitada.

## **Exportar el diagrama**

Los diagramas pueden exportarse como archivos **SVG**.

Utiliza:

* **Paleta de comandos → `Exportar diagrama de flujo SVG`**

Después selecciona la ubicación y el nombre del archivo.

El formato SVG puede ampliarse sin perder calidad.

Es especialmente útil para:

* documentación;
* reportes;
* presentaciones;
* tareas;
* proyectos académicos.

### **Exportación de vistas parciales**

Si estás visualizando únicamente una función o un flujo específico, la exportación genera solamente esa parte del diagrama.

Esto permite crear diagramas individuales de funciones sin tener que modificar el código fuente.

## **Consideraciones**

* Los diagramas se generan a partir del **Árbol de Sintaxis Abstracta (AST)** del programa.
* El código debe ser sintácticamente válido para poder generar el diagrama.
* Las funciones se organizan automáticamente como subgrafos.
* La vista se mantiene sincronizada con el documento mientras trabajas.
* El diagrama de ejecución normal y el depurador funcionan de forma independiente.
* Si el código cambia, las trazas antiguas se descartan para evitar mostrar información incorrecta.

## **Uso práctico**

El generador puede utilizarse principalmente para tres tareas:

| Uso            | Para qué sirve                                     |
| -------------- | -------------------------------------------------- |
| **Comprender** | Visualizar cómo se organiza el flujo del algoritmo |
| **Revisar**    | Seguir condiciones, ciclos, funciones y llamadas   |
| **Documentar** | Exportar diagramas para reportes o proyectos       |

El objetivo del generador no es sustituir la lectura del código, sino **hacer visible su estructura y su ejecución** de una forma más fácil de seguir.

---

<a id="broker95"></a>

# **🎮 Videojuego BROKER.95**

**BROKER.95** es un videojuego educativo integrado en CLRS Kit Español.

Su objetivo es convertir la práctica de programación en una experiencia basada en **contratos, progresión, recompensas, riesgo y aprendizaje**. El código continúa escribiéndose normalmente en el editor de Visual Studio Code. 

Puedes abrirlo mediante:

* **Paleta de comandos → `Jugar BROKER.95`**
* El botón con icono de mando disponible en documentos `.clrs`

## **CIPHER**

Dentro del juego interactúas con **CIPHER**, una inteligencia artificial que participa como:

* generador de contratos;
* tutor durante la resolución;
* asistente para dudas;
* evaluador de entregas.

CIPHER puede ayudarte a comprender errores y orientar tu solución, pero el progreso del juego depende de los resultados obtenidos al resolver los contratos. 

## **Contratos**

Los contratos representan problemas de programación que debes resolver utilizando CLRS.

Cada contrato puede incluir:

* descripción del problema;
* requerimientos;
* casos de prueba;
* recompensa potencial;
* nivel de riesgo.

El flujo principal es:

```text
OBTENER CONTRATO
       ↓
ACEPTAR
       ↓
PROGRAMAR EN CLRS
       ↓
REVISAR
       ↓
ENTREGAR
       ↓
RESULTADO Y RECOMPENSA
```

Los contratos pueden abarcar desde ejercicios elementales hasta problemas algorítmicos más avanzados. 

### **Riesgo y recompensa**

Los contratos pueden tener diferentes niveles de riesgo:

| Riesgo      | Enfoque general                  |
| ----------- | -------------------------------- |
| **Bajo**    | Problemas sencillos              |
| **Medio**   | Mayor variedad de casos          |
| **Alto**    | Soluciones más exigentes         |
| **Extremo** | Problemas algorítmicos avanzados |

Una mejor resolución puede producir una mayor recompensa.

El juego también mantiene elementos como:

* saldo;
* alerta;
* contratos completados;
* contratos fallidos;
* estadísticas;
* progreso.

## **Aprendizaje**

BROKER.95 incluye un modo de aprendizaje estructurado en dos rutas:

| Ruta             | Lecciones |
| ---------------- | --------: |
| **Programación** |        50 |
| **Algoritmia**   |        57 |

Programación está disponible desde el inicio.

Algoritmia se desbloquea después de completar la ruta de Programación.

### **Ruta de aprendizaje**

Cada ruta se presenta como un recorrido progresivo formado por secciones y lecciones.

Las lecciones pueden incluir:

* objetivo;
* explicación;
* ejemplos en CLRS;
* conceptos nuevos;
* notas;
* ejercicios prácticos.

El progreso se conserva y las lecciones se desbloquean de forma secuencial.

### **Ejercicios educativos**

Desde una lección puedes solicitar un ejercicio relacionado con los conocimientos estudiados hasta ese momento.

Los ejercicios:

* mantienen una dificultad reducida;
* utilizan conocimientos ya introducidos;
* evitan conceptos futuros;
* se evalúan principalmente por su funcionamiento;
* pueden recomendar herramientas de CLRS como apoyo, pero nunca exigirlas.

## **Ayuda durante un contrato**

BROKER.95 dispone de varias formas de interactuar con CIPHER.

| Comando              | Función                                                  |
| -------------------- | -------------------------------------------------------- |
| `ai -review`         | Revisa tu solución y proporciona orientación             |
| `ai -ask [pregunta]` | Permite hacer una pregunta sobre el contrato y tu código |
| `ai -push`           | Entrega la solución para su evaluación                   |

`ai -ask` está pensado para resolver dudas sin entregar ni evaluar todavía el contrato. 

## **Terminal de BROKER.95**

El juego incluye una terminal propia para administrar contratos. 

Algunos comandos principales son:

| Comando         | Acción                                 |
| --------------- | -------------------------------------- |
| `ai -gameinfo`  | Explica cómo funciona BROKER.95        |
| `ai -new`       | Solicita un nuevo contrato             |
| `ai -get`       | Muestra los contratos disponibles      |
| `ai -read <id>` | Consulta un contrato                   |
| `ai -set <id>`  | Acepta un contrato                     |
| `ai -review`    | Solicita una revisión                  |
| `ai -ask`       | Pregunta a CIPHER                      |
| `ai -push`      | Entrega la solución                    |
| `ai -info`      | Muestra el estado actual de la partida |

Si el usuario no tiene experiencia en el uso de una terminal de comandos, se proporciona un acercamiento muy básico e intuitivo para que consiga familiarizarse con este tipo de sistema.

## **El código sigue en Visual Studio Code**

BROKER.95 no incluye un editor de código independiente.

Los programas se escriben directamente en archivos `.clrs` utilizando el editor habitual de Visual Studio Code.

Esto permite utilizar junto al juego las demás herramientas de CLRS Kit Español, como:

* diagnósticos;
* ejecución;
* depuración;
* diagramas de flujo;
* análisis algorítmico.

BROKER.95 funciona como una **capa de práctica y aprendizaje alrededor del entorno normal de CLRS**, no como un sustituto del editor. 

## **Modelos de IA**

CIPHER puede utilizar diferentes proveedores de IA o un modelo local.

Entre las opciones disponibles se encuentran:

* OpenAI;
* Groq;
* Gemini;
* DeepSeek;
* xAI;
* Together AI;
* Z.AI;
* Hugging Face;
* OpenRouter;
* Ollama local;
* LM Studio local.

La configuración se realiza desde el propio panel de BROKER.95.

Tus claves de acceso se guardan de forma segura en tu sistema. La extensión sólo las utiliza para conectarse al proveedor que elijas; no las publica ni las comparte con otros proveedores. Si eliges un proveedor remoto, tus consultas y el código necesario para ayudarte se envían a ese proveedor.

Se recomienda ampliamente un modelo **igual o superior a 7B de parámetros** para una experiencia rápida y respuestas precisas.

## **Progreso persistente**

La partida conserva automáticamente información como:

* dinero;
* alerta;
* contratos;
* estadísticas;
* progreso educativo;
* mejores resultados.

El progreso de Programación y Algoritmia se mantiene de forma independiente. 

## **Objetivo de BROKER.95**

BROKER.95 busca transformar la práctica repetida de programación en una experiencia más motivadora mediante:

```text
APRENDER
   ↓
RECIBIR UN RETO
   ↓
PROGRAMAR
   ↓
COMPROBAR
   ↓
RECIBIR RETROALIMENTACIÓN
   ↓
MEJORAR
   ↓
PROGRESAR
```

La idea central no es sustituir el aprendizaje tradicional, sino ofrecer un entorno donde **practicar programación y algoritmia mediante problemas concretos, progresión y retroalimentación continua**.
