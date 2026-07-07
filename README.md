# CLRS Kit Español

**clrs-kit-esp** es una extensión para Visual Studio Code orientada al soporte de un lenguaje de pseudocódigo, fuertemente inspirado en la sintaxis utilizada en el libro Introducción a Algoritmos (CLRS).

## 💻 Inicio en VS Code

| Concepto              | Descripción |
|----------------------|-------------|
| Extensión de archivo | `.clrs` |
| Ejecutar código      | Ejecuta el código escrito en CLRS mediante su transpilación a JavaScript y posterior ejecución en tiempo de ejecución. |
| Construir código (JS) | Transpila el código CLRS a JavaScript sin ejecutarlo, generando un archivo listo para ser usado en Node.js. |
| Costo | Genera automáticamente la función de costo de cada algoritmo construyendo expresiones simbólicas basadas en el número de operaciones elementales ejecutadas. |

## ⚙️ Estado actual (versión 1.1.5)

- Parser completo de CLRS construido con Chevrotain.
- Generación automática del Árbol de Sintaxis Abstracta (AST).
- Transpilador de CLRS a JavaScript.
- Ejecución de programas CLRS directamente desde Visual Studio Code.
- Generación de código JavaScript sin necesidad de ejecutarlo.
- Resaltado de sintaxis mediante una gramática TextMate.
- Configuración del lenguaje con indentación automática y plegado de código.
- Snippets integrados para la sintaxis de CLRS.
- Biblioteca estándar para manejo de archivos, cadenas, arreglos y funciones matemáticas.
- Reporte de errores de sintaxis y de ejecución.
- Soporte para funciones, arreglos, expresiones, condicionales, ciclos y operaciones de entrada/salida.
- Soporte para el uso de botón para ejecutar y construir.
- Soporte para muestreo de costo algorítmico.

---

## 📖 Filosofía del lenguaje

El lenguaje está diseñado bajo los siguientes principios:

- Sintaxis de pseudocódigo simple y cercana al español.
- Enfoque educativo y académico.
- Simplicidad para principiantes.
- Similitud con pseudocódigo CLRS.
- Caso de uso enfocado en el diseño y aprendizaje de algoritmos.

---

## 🛠️ Requisitos

- Visual Studio Code
- Node.js (para la ejecución)

---

## 🧑‍💻 Autor

Proyecto desarrollado por **j-hernandez-dev** como herramienta educativa abierta.

---

## 📜 Licencia (GPLv2)

Este proyecto es de código abierto. Puede ser modificado y extendido libremente, siempre que se mantenga la atribución al autor original.

---

## ⚠️ Problemas conocidos

* No hay soporte para el análisis semántico. Por lo que todo es realizado en el análisis de JavaScript sin especificar la localización del error.
* Es posible que determinado código se genere de manera incorrecta por el transpilador.

---

# 🧮 Características del lenguaje

## Comentarios

CLRS únicamente admite comentarios de una sola línea mediante `//`.

```text
// Comentario simple
```

## Variables

Las variables son dinámicas y débilmente tipadas. Esto significa que pueden almacenar valores de distintos tipos y cambiar de tipo durante la ejecución mediante conversiones implícitas cuando sea necesario.

```text
variable1 <- 10
variable2 <- "texto"
variable1 <- variable2
```

Las variables son siempre mutables; el lenguaje no dispone de constantes. Su ámbito es local a la función donde se definen y la asignación se realiza mediante el operador `<-`.

```text
variable1 <- 10
variable1 <- 2
variable1 <- 4
```

Las variables deben inicializarse en el momento de su creación, por lo que no es posible declararlas sin asignarles un valor inicial. Los valores admitidos son numéricos, cadenas y lógicos.

```text
variable1 <- 10
variable2 <- "texto"
variable3 <- VERDAD
```

## Arreglos

Los arreglos son dinámicos. Su tamaño y número de dimensiones se determinan automáticamente conforme se accede a nuevas posiciones.

```text
arreglo[0] <- 10
arregloBi[2][2] <- 10
```

Es posible asignar un arreglo completo a una variable o el contenido de una variable a un arreglo. En ambos casos, la asignación copia el contenido correspondiente.

```text
variable1 <- arreglo
arregloBi <- variable2
```

## Entrada y salida

La instrucción `escribir` permite mostrar información en la consola. Puede imprimir valores individuales, varios valores separados por comas, expresiones concatenadas y arreglos completos.

```text
escribir variable1
escribir arreglo
escribir variable1, variable2, variable3
escribir variable1 + variable2 + variable3
```

La instrucción `leer` permite obtener datos desde la consola. Es posible leer una o varias variables en una sola instrucción. El tipo del valor leído se determina automáticamente.

```text
leer variable1
leer variable1, variable2, variable3
```

## Estructuras de selección

La única estructura de selección es `si`, junto con las variantes `sino si` y `sino`. Los bloques de código se delimitan mediante indentación, por lo que es importante mantener una indentación consistente.

```text
si variable3 o VERDAD
    escribir "a"
sino si variable1 > 3
    escribir "b"
sino si variable2 = "texto"
    escribir "c"
sino
    escribir "d"
```

## Operadores

CLRS dispone de operadores lógicos, relacionales y aritméticos similares a los de otros lenguajes. La comparación de igualdad utiliza el operador `=`.

```text
si VERDAD y VERDAD
    escribir "a"

si FALSO o VERDAD
    escribir "b"

si 10 > 20
    escribir "c"

si 20 < 10
    escribir "d"

si 10 = 10
    escribir "e"

si 20 != 10
    escribir "f"
```

## Ciclo `para`

La estructura `para` dispone de dos variantes.

La variante `hasta` incrementa automáticamente la variable de iteración hasta que alcance el valor indicado por la expresión final.

```text
para i <- 0 hasta 5
    escribir i
```

La variante `bajando` decrementa automáticamente la variable de iteración hasta alcanzar el valor indicado.

```text
para j <- 5 bajando 0
    escribir j
```

## Ciclo `mientras`

La estructura `mientras` ejecuta repetidamente un bloque de instrucciones mientras la condición evaluada sea verdadera.

```text
mientras variable3 y FALSO
    escribir "no entra"
```

## Funciones

Las funciones se definen mediante un identificador, una lista de parámetros y un bloque de código.

```text
holaMundo()
    escribir "Hola mundo"
```

Su invocación utiliza la misma sintaxis que su definición. Después de una llamada no debe agregarse un bloque indentado, ya que este podría interpretarse como el cuerpo de una nueva función.

```text
holaMundo()
```

Las funciones pueden recibir cualquier cantidad de parámetros y devolver un valor mediante la instrucción `retornar`.

```text
suma(a, b)
    retornar a + b
```

También es posible recibir arreglos como parámetros. Para ello únicamente se especifica el número de dimensiones del arreglo.

```text
suma2(a, b[])
    retornar a + b[0]
```

Las llamadas a funciones pueden utilizarse como parte de cualquier expresión. Los arreglos se pasan simplemente mediante su identificador.

```text
variable1 <- suma(1, 2)
escribir suma(1, 2)

variable1 <- suma2(1, arreglo)
escribir suma2(1, arreglo)
```

Es posible utilizar como identificador `principal` en una función para usarlo como punto de entrada. No es necesario realizar una llamada explícita.

```text
principal()
    escribir "Hola mundo"

principal() // No es necesario, se ejecutaría 2 veces
```

## Ejemplo

Ejemplo completo de Bubble Sort.
```text
arreglo[0] <- 5
arreglo[1] <- 2
arreglo[2] <- 9
arreglo[3] <- 1
arreglo[4] <- 6

n <- LONGITUD(arreglo)

escribir n
i <- 0
j <- 0

para i <- 0 hasta n - 1
    para j <- 0 hasta n - i - 2
        si arreglo[j] > arreglo[j + 1]
            temp <- arreglo[j]
            arreglo[j] <- arreglo[j + 1]
            arreglo[j + 1] <- temp
escribir arreglo
```

---

# 📚 Biblioteca estándar de CLRS

La biblioteca estándar de CLRS proporciona funciones integradas para manejo de archivos, operaciones matemáticas, cadenas y arreglos.

---

## 📁 Archivos

| Función CLRS | Descripción | Retorno |
|--------------|-------------|---------|
| `LEER_ARCHIVO(ruta)` | Lee el contenido de un archivo de texto. | Cadena |
| `EXISTE_ARCHIVO(ruta)` | Verifica si un archivo existe. | Lógico |
| `PESO_ARCHIVO(ruta)` | Obtiene el tamaño del archivo en bytes. | Número |
| `CREAR_ARCHIVO(ruta)` | Crea un archivo vacío. | - |
| `ESCRIBIR_ARCHIVO(ruta, contenido)` | Escribe contenido al final del archivo. | - |
| `ELIMINAR_ARCHIVO(ruta)` | Elimina un archivo si existe. | - |

---

## 🔢 Matemáticas

| Función CLRS | Descripción | Retorno |
|--------------|-------------|---------|
| `ABSOLUTO(x)` | Valor absoluto de un número. | Número |
| `MINIMO(a, b)` | Devuelve el menor de dos valores. | Número |
| `MAXIMO(a, b)` | Devuelve el mayor de dos valores. | Número |
| `REDONDEO(x)` | Redondea al entero más cercano. | Número |
| `PISO(x)` | Redondea hacia abajo. | Número |
| `RAIZ2(x)` | Raíz cuadrada. | Número |
| `RAIZ3(x)` | Raíz cúbica. | Número |
| `EXPONENCIAL(x)` | e elevado a x. | Número |
| `LOG(x)` | Logaritmo natural. | Número |
| `LOG10(x)` | Logaritmo base 10. | Número |
| `LOG2(x)` | Logaritmo base 2. | Número |
| `SENO(x)` | Seno de un ángulo. | Número |
| `COSENO(x)` | Coseno de un ángulo. | Número |
| `TANGENTE(x)` | Tangente de un ángulo. | Número |
| `ARCOSENO(x)` | Arcoseno. | Número |
| `ARCOCOSENO(x)` | Arcocoseno. | Número |
| `A_RADIANES(x)` | Convierte grados a radianes. | Número |
| `A_GRADOS(x)` | Convierte radianes a grados. | Número |
| `PI()` | Constante π. | Número |
| `EULER()` | Constante e. | Número |
| `ALEATORIO(min, max)` | Número aleatorio. | Número |
| `PROMEDIO(x)` | Promedio de un arreglo. | Número |
| `SUMATORIA(x)` | Suma total de un arreglo. | Número |
| `MEDIANA(x)` | Mediana de un conjunto. | Número |
| `VARIANZA(x)` | Varianza de un conjunto. | Número |

---

## 🔤 Cadenas

| Función CLRS | Descripción | Retorno |
|--------------|-------------|---------|
| `LONGITUD(x)` | Longitud de una cadena o estructura. | Número |
| `CARACTER_EN(cadena, posición)` | Obtiene un carácter en una posición. | Cadena |
| `SUB_CADENA(cadena, inicio, fin)` | Extrae una subcadena. | Cadena |
| `BUSCAR(cadena, texto)` | Posición de una subcadena. | Número |
| `CONTIENE(cadena, texto)` | Verifica si contiene un texto. | Lógico |
| `MAYUSCULAS(cadena)` | Convierte a mayúsculas. | Cadena |
| `MINUSCULAS(cadena)` | Convierte a minúsculas. | Cadena |
| `RECORTAR(cadena)` | Elimina espacios en blanco. | Cadena |
| `REEMPLAZAR(cadena, viejo, nuevo)` | Reemplaza texto. | Cadena |
| `DIVIDIR(cadena, separador)` | Divide en arreglo. | Arreglo |
| `ES_NUMERO(cadena)` | Verifica si es número. | Lógico |
| `ES_VACIA(cadena)` | Verifica si está vacía. | Lógico |
| `EMPIEZA_CON(cadena, texto)` | Verifica prefijo. | Lógico |
| `TERMINA_CON(cadena, texto)` | Verifica sufijo. | Lógico |

---

## 📦 Arreglos

| Función CLRS | Descripción | Retorno |
|--------------|-------------|---------|
| `AGREGAR(arreglo, valor)` | Agrega un elemento al final. | Número |
| `ELIMINAR(arreglo, índice)` | Elimina un elemento. | - |
| `INSERTAR(arreglo, índice, valor)` | Inserta en posición. | - |
| `BUSCAR_INDICE(arreglo, valor)` | Índice de un elemento. | Número |
| `CONTIENE_VALOR(arreglo, valor)` | Verifica existencia. | Lógico |
| `ORDENAR(arreglo)` | Ordena el arreglo. | - |
| `INVERTIR(arreglo)` | Invierte el arreglo. | Arreglo |
| `COPIAR(arreglo)` | Copia el arreglo. | Arreglo |
| `UNIR(arreglo, separador)` | Une elementos en cadena. | Cadena |

---

# 📊 Análisis de costo

El análisis de costo permite visualizar cómo se construye la función de costo de un algoritmo de forma teórica directamente desde el código fuente.

| Funcionalidad              | Descripción                                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Expresión de costo de bloque** | Muestra la expresión de costo encima de funciones y estructuras de control.                                        |
| **Expresión de costo de línea**  | Muestra el costo individual de cada instrucción al final de la línea correspondiente.                              |
| **Copiar expresión**       | Permite copiar cualquier expresión de costo al portapapeles mediante un clic.                                      |
| **Mostrar/Ocultar**        | Activa o desactiva toda la visualización del análisis desde un botón en el editor.                                 |

La herramienta de análisis de costo genera expresiones de costo a partir del Árbol de Sintaxis Abstracta (AST). El análisis se basa únicamente en la estructura sintáctica del código y no realiza un análisis semántico avanzado.

Por ello, estructuras cuya complejidad depende del comportamiento de las variables, de la reducción del problema en bucles o de la recursión no pueden resolverse automáticamente. Estos son los casos en los que la herramienta no puede determinar el costo de forma exacta.

| Complejidad                                  | Determina el costo | Observaciones                                                                                     |
| -------------------------------------------- | :------------------: | ------------------------------------------------------------------------------------------------- |
| **O(1)**                                     |           ✅          | Operaciones de costo constante.                                                                   |
| **O(n)**                                     |           ✅          | Bucles lineales y recorridos simples.                                                             |
| **O(n²)**                                    |           ✅          | Dos niveles de iteración anidados.                                                                |
| **O(n³)**                                    |           ✅          | Tres niveles de iteración anidados.                                                               |
| **O(nᵏ)**                                    |           ✅          | Cualquier número fijo de ciclos anidados puede deducirse estructuralmente.                        |
| **O(log n)**                                 |           ❌          | Requiere identificar reducciones del problema (por ejemplo, dividir entre dos en cada iteración). |
| **O(n log n)**                               |           ❌          | Generalmente implica recursión o una combinación de iteración con reducción del problema.         |
| **O(2ⁿ)**                                    |           ❌          | Requiere analizar recursión múltiple o crecimiento exponencial.                                   |
| **O(n!)**                                    |           ❌          | Depende de estructuras recursivas o permutaciones, no sólo de la sintaxis.                        |
| **Complejidades definidas por recurrencias** |           ❌          | Es necesario resolver ecuaciones de recurrencia mediante técnicas matemáticas.                    |

Aunque no calcula automáticamente la notación asintótica, sí genera la función de costo correspondiente, la cual puede simplificarse algebraicamente para obtener la notación Big O.

No sustituye el análisis manual, pero proporciona una referencia visual que facilita el análisis de costo en una amplia variedad de casos.