# CLRS Kit Español

**gaddis-kit-esp** es una extensión para Visual Studio Code orientada al soporte de un lenguaje de pseudocódigo, fuertemente inspirado en la sintaxis utilizada en el libro Introducción a Algoritmos (CLRS).

## 💻 Inicio en VS Code

| Concepto              | Descripción |
|----------------------|-------------|
| Extensión de archivo | `.clrs` |
| Ejecutar código      | Ejecuta el código escrito en CLRS mediante su transpilación a JavaScript y posterior ejecución en tiempo de ejecución. |
| Construir código (JS) | Transpila el código CLRS a JavaScript sin ejecutarlo, generando un archivo listo para ser usado en Node.js. |

## ⚙️ Estado actual (versión 1.0.1)

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
- Soporte para CodeLens en el uso de botón para ejecutar y construir.

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