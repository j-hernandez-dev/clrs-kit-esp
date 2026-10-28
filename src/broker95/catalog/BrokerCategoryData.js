import {
    BrokerCategoryAudience
} from "./BrokerCategoryAudience.js";

const CLIENT = Object.freeze([
    BrokerCategoryAudience.CLIENT
]);
const LEARNING = Object.freeze([
    BrokerCategoryAudience.LEARNING
]);

// Fuente canónica: taxonomia_familias_algoritmicas_representativas.md.
// FND es exclusivamente curricular. Las otras familias pertenecen a los
// contratos de cliente. La dificultad está ligada a la categoría concreta.
const TAXONOMY = [
    {
        "familyId": "FND",
        "familyName": "Fundamental",
        "categories": [
            [
                "FND-OPERAT",
                "Operaciones básicas",
                "Cálculos aritméticos, porcentajes, conversiones y evaluación directa de fórmulas.",
                "Sumar dos números; calcular el promedio de tres calificaciones; calcular el precio final aplicando un descuento; obtener el IVA de una compra; convertir grados Celsius a Fahrenheit; convertir kilómetros a millas; calcular salario a partir de horas trabajadas; obtener el área y perímetro de una figura; calcular interés simple; evaluar una fórmula con valores dados.",
                "low"
            ],
            [
                "FND-IO",
                "Entrada y salida",
                "Lectura de datos sencillos, presentación de mensajes y resultados, y reconocimiento del flujo entrada-procesamiento-salida.",
                "Leer un nombre y mostrar un saludo; leer dos números y mostrar su suma; solicitar edad y mostrarla en una frase; leer base y altura y mostrar el área calculada; leer tres valores en líneas separadas y mostrar su promedio; mostrar varios resultados con etiquetas; leer un dato, procesarlo y mostrar únicamente el resultado solicitado.",
                "low"
            ],
            [
                "FND-DATA",
                "Datos y variables",
                "Valores, literales, identificadores, variables, asignación, actualización de estado y tipos de datos básicos.",
                "Guardar nombre, edad y estatura en variables apropiadas; intercambiar los valores de dos variables; actualizar el saldo después de una compra; aumentar un contador en cada operación; almacenar si un estudiante está aprobado mediante un booleano; convertir una entrada textual a número; calcular una división utilizando valores reales; actualizar la posición de un personaje mediante variables; conservar un valor inicial y compararlo posteriormente con su valor actualizado.",
                "low"
            ],
            [
                "FND-TEXT",
                "Texto básico",
                "Cadenas, concatenación, caracteres especiales, longitud, posiciones y conversiones elementales entre texto y otros valores.",
                "Concatenar nombre y apellido; construir un mensaje con nombre y edad; mostrar una cadena que contenga saltos de línea; obtener la longitud de una palabra; mostrar el primer y último carácter de una cadena; extraer un carácter dada su posición; convertir una entrada numérica en texto para incorporarla a un mensaje; convertir una cadena numérica a entero; reemplazar un carácter sencillo; formar una oración a partir de varias cadenas.",
                "low"
            ],
            [
                "FND-CONTROL",
                "Control de flujo",
                "Secuencia de instrucciones, comparaciones, condiciones, decisiones, ciclos, contadores y acumuladores.",
                "Determinar si un número es positivo, negativo o cero; determinar si un estudiante aprobó; obtener el mayor de tres números; calcular un descuento dependiendo del monto de compra; mostrar los números de 1 a N; mostrar los números pares hasta N; generar la tabla de multiplicar de un número; sumar los números de 1 a N; contar cuántos valores positivos se ingresaron; calcular el promedio de N valores mediante un acumulador; repetir la lectura hasta recibir un valor válido.",
                "low"
            ],
            [
                "FND-FUNC",
                "Funciones",
                "Definición e invocación de funciones, parámetros, argumentos, valores de retorno, ámbito básico y separación de responsabilidades.",
                "Crear una función que sume dos números; crear una función que calcule el área de un rectángulo; crear una función que determine si un número es par; crear una función que reciba tres números y devuelva el mayor; crear una función para convertir Celsius a Fahrenheit; crear una función que reciba varias calificaciones y devuelva su promedio; reutilizar una misma función con distintos argumentos; separar el cálculo de un programa en varias funciones; convertir código repetido en una función reutilizable; utilizar una variable local dentro de una función sin modificar otra variable externa.",
                "low"
            ],
            [
                "FND-COLLECTION",
                "Colecciones básicas",
                "Arreglos dinámicos, índices, recorridos elementales, matrices y paso de colecciones a funciones.",
                "Almacenar varias calificaciones en un arreglo; mostrar todos los elementos de una colección; acceder a un elemento mediante su índice; modificar un elemento en una posición determinada; agregar valores a una colección dinámica; sumar todos los elementos de un arreglo; calcular el promedio de una colección; encontrar el mayor valor mediante un recorrido; contar números pares de un arreglo; recorrer una matriz y mostrar sus elementos; sumar los elementos de una matriz; crear una función que reciba un arreglo y calcule su suma; crear una función que reciba una colección y devuelva su promedio.",
                "low"
            ],
            [
                "FND-ALG",
                "Algoritmos",
                "Construcción de soluciones paso a paso mediante entrada, procesamiento y salida.",
                "Diseñar un algoritmo para sumar dos números; calcular el promedio de N calificaciones; obtener área y perímetro de una figura; determinar el mayor de tres valores; generar los primeros N términos de una progresión aritmética; encontrar el máximo de una secuencia; realizar una búsqueda lineal sencilla.",
                "low"
            ],
            [
                "FND-ALG-ANALY",
                "Análisis de algoritmos",
                "Medición de costo temporal y espacial y análisis básico del crecimiento de algoritmos.",
                "Contar cuántas operaciones realiza un ciclo para una entrada N; obtener la función de costo de dos ciclos anidados; determinar la complejidad de una búsqueda lineal; determinar la complejidad de una búsqueda binaria; comparar el crecimiento de Bubble Sort y búsqueda lineal; identificar el término dominante de una función de costo; clasificar algoritmos sencillos como O(1), O(log n), O(n) u O(n²).",
                "medium"
            ],
            [
                "FND-ALG-RECUR",
                "Recursión",
                "Soluciones mediante casos base, llamadas recursivas y reducción progresiva del problema.",
                "Calcular factorial recursivamente; calcular Fibonacci recursivamente; sumar los números de 1 a N mediante recursión; calcular una potencia recursivamente; invertir una cadena recursivamente; encontrar el máximo de un arreglo mediante recursión; implementar búsqueda binaria recursiva; resolver Torres de Hanói.",
                "medium"
            ],
            [
                "FND-ALG-DESIGN",
                "Diseño de algoritmos",
                "Elección y construcción de estrategias para resolver problemas algorítmicos.",
                "Diseñar un algoritmo para encontrar máximo y mínimo; diseñar una solución para encontrar dos valores cuya suma sea un objetivo; diseñar búsqueda binaria sobre datos ordenados; diseñar un algoritmo de selección de actividades; diseñar una solución para cambio de monedas; diseñar un algoritmo para obtener el subarreglo de suma máxima; diseñar una solución para recorrer un laberinto; diseñar un generador de combinaciones o permutaciones; diseñar una solución para mochila 0/1.",
                "high"
            ],
            [
                "NUM-ALG-VERIF",
                "Verificación de algoritmos",
                "Comprobación de corrección mediante casos, trazas, invariantes, condiciones y terminación.",
                "Verificar una búsqueda lineal con elemento presente y ausente; verificar búsqueda binaria con valores límite; comprobar Bubble Sort con un arreglo ordenado, inverso y con repetidos; verificar factorial para 0, 1",
                "high"
            ]
        ]
    },
    {
        "familyId": "NUM",
        "familyName": "Procesamiento numérico",
        "categories": [
            [
                "NUM-ARITH",
                "Aritmética",
                "Aritmética; tasas; porcentajes; fórmulas escalares",
                "Sumar dos números; promedio de calificaciones; IVA y descuentos; interés simple; salario; consumo de combustible; IMC",
                "low"
            ],
            [
                "NUM-CONV",
                "Conversiones",
                "Conversión de unidades y magnitudes",
                "Celsius/Fahrenheit; kilómetros/metros; horas/minutos/segundos; conversión con tipo de cambio dado",
                "low"
            ],
            [
                "NUM-BASE",
                "Conversión de bases",
                "Representación posicional de enteros",
                "Decimal a binario; binario a decimal; decimal a hexadecimal",
                "medium"
            ],
            [
                "NUM-DIGIT",
                "Procesamiento de dígitos",
                "Descomposición aritmética de enteros",
                "Contar dígitos; sumar dígitos; invertir un número; comprobar capicúa",
                "low"
            ],
            [
                "NUM-ITER",
                "Iteración numérica",
                "Contadores, acumuladores y ciclos escalares",
                "Mostrar 1..N; sumar 1..N; tablas de multiplicar; factorial iterativo; potencia por multiplicaciones",
                "low"
            ],
            [
                "NUM-SEQ",
                "Secuencias",
                "Generación mediante reglas recurrentes sencillas",
                "Progresión aritmética; múltiplos de N; cuenta regresiva",
                "low"
            ],
            [
                "NUM-SEQ-SPEC",
                "Secuencias especializadas",
                "Secuencias de estado recurrente mayor",
                "Fibonacci iterativo; recurrencias lineales simples",
                "medium"
            ],
            [
                "NUM-COUNT",
                "Conteo",
                "Conteo por condiciones conocidas",
                "Positivos/negativos/ceros; pares/impares; ventas sobre un umbral",
                "low"
            ],
            [
                "NUM-COUNT-SPEC",
                "Conteo especializado",
                "Frecuencias indexadas por valor o categoría",
                "Histogramas; frecuencia de caracteres; repetidos; moda por conteo",
                "medium"
            ],
            [
                "NUM-STAT",
                "Estadística descriptiva",
                "Resúmenes estadísticos sobre colecciones",
                "Media; mediana; moda; varianza; desviación estándar; percentiles; normalización",
                "medium"
            ]
        ]
    },
    {
        "familyId": "CTRL",
        "familyName": "Clasificación y validación",
        "categories": [
            [
                "CTRL-RULE",
                "Clasificación por reglas",
                "Condicionales por igualdad, intervalo o combinación lógica",
                "Par/impar; positivo/negativo; aprobado/reprobado; tipo de triángulo; estación del año; clasificación de IMC",
                "low"
            ],
            [
                "CTRL-VALID",
                "Validación de entrada",
                "Comprobación de restricciones y repetición hasta validez",
                "Validar edad; validar calificación; exigir número positivo; contraseña hasta acertar",
                "low"
            ],
            [
                "CTRL-TARIFF",
                "Reglas tarifarias",
                "Decisiones escalonadas aplicadas a costos o beneficios",
                "Estacionamiento; boleto según edad; descuento por cantidad; tarifa de agua; horas extra",
                "low"
            ]
        ]
    },
    {
        "familyId": "GEOFORM",
        "familyName": "Geometría por fórmulas",
        "categories": [
            [
                "GEOFORM-MEASURE",
                "Medición geométrica",
                "Fórmulas directas sobre figuras o puntos",
                "Área y perímetro; volumen; circunferencia; hipotenusa; distancia entre dos puntos",
                "low"
            ],
            [
                "GEOFORM-TRANS",
                "Transformaciones geométricas",
                "Transformaciones explícitas sobre coordenadas",
                "Rotar un conjunto de puntos; aplicar transformaciones a coordenadas",
                "high"
            ]
        ]
    },
    {
        "familyId": "ARRAY",
        "familyName": "Arreglos",
        "categories": [
            [
                "ARRAY-TRAV",
                "Recorrido de arreglos",
                "Recorrido lineal y agregación",
                "Suma; promedio; máximo; mínimo; contar elementos mayores al promedio",
                "medium"
            ],
            [
                "ARRAY-TRANS",
                "Transformación de arreglos",
                "Reordenamiento, filtrado o partición",
                "Invertir; rotar; desplazar; separar pares/impares; eliminar valores",
                "medium"
            ],
            [
                "ARRAY-SET",
                "Operaciones de conjunto",
                "Relaciones entre dos colecciones",
                "Unión; intersección; diferencia; elementos comunes; eliminar duplicados",
                "medium"
            ],
            [
                "ARRAY-WINDOW",
                "Ventanas especializadas",
                "Mantenimiento incremental de segmentos contiguos",
                "Máxima suma de ventana; conteos por ventana; ventana con deque",
                "high"
            ]
        ]
    },
    {
        "familyId": "MATRIX",
        "familyName": "Matrices y rejillas",
        "categories": [
            [
                "MATRIX-OPS",
                "Operaciones matriciales",
                "Recorridos bidimensionales y operaciones por posición",
                "Suma de filas/columnas; diagonales; transpuesta; suma/resta; identidad",
                "medium"
            ],
            [
                "MATRIX-TRANS",
                "Transformación de matrices",
                "Reindexación de celdas",
                "Rotación 90°; reflexión horizontal/vertical",
                "medium"
            ],
            [
                "MATRIX-MUL",
                "Multiplicación matricial",
                "Producto matriz-matriz o matriz-vector",
                "Multiplicar matrices pequeñas; multiplicar una matriz por un vector",
                "medium"
            ],
            [
                "MATRIX-REGION",
                "Regiones conectadas",
                "Rejilla modelada como grafo implícito",
                "Flood fill; contar islas; componentes conexas en imágenes",
                "extreme"
            ]
        ]
    },
    {
        "familyId": "STRING",
        "familyName": "Algoritmos de texto",
        "categories": [
            [
                "STRING-PROC",
                "Procesamiento de cadenas",
                "Recorridos y transformaciones carácter a carácter",
                "Invertir cadena; contar vocales; reemplazar caracteres; capitalizar palabras; palabra más larga",
                "medium"
            ],
            [
                "STRING-PROP",
                "Propiedades de cadenas",
                "Comparación global de caracteres",
                "Palíndromos; anagramas; igualdad manual; frecuencia de caracteres",
                "medium"
            ],
            [
                "STRING-PAT-ELEM",
                "Búsqueda de patrones elemental",
                "Matching directo sin preprocesamiento especializado",
                "Naive string matching; contar apariciones de una subcadena",
                "medium"
            ],
            [
                "STRING-PAT-ADV",
                "Búsqueda de patrones avanzada",
                "Preprocesamiento o hashing rodante",
                "KMP; LPS; Rabin-Karp; Z-function; prefix function",
                "high"
            ],
            [
                "STRING-TRIE",
                "Tries",
                "Estructuras de prefijos",
                "Diccionario; autocompletado; búsqueda por prefijo",
                "high"
            ],
            [
                "STRING-LEX",
                "Análisis léxico",
                "Reconocimiento estructurado de tokens",
                "Tokenizar expresiones; reconocer números, identificadores y operadores; lexer sencillo",
                "high"
            ]
        ]
    },
    {
        "familyId": "SEARCH",
        "familyName": "Búsqueda",
        "categories": [
            [
                "SEARCH-ELEM",
                "Búsqueda elemental",
                "Búsqueda lineal y binaria estándar",
                "Buscar un valor; primera/última aparición; pertenencia; búsqueda binaria en arreglo ordenado",
                "medium"
            ],
            [
                "SEARCH-ADV",
                "Búsqueda especializada",
                "Condiciones de partición o estimación no directas",
                "Búsqueda por interpolación; arreglo rotado; punto de rotación; encontrar un pico; búsqueda binaria sobre respuesta",
                "high"
            ]
        ]
    },
    {
        "familyId": "SORT",
        "familyName": "Ordenamiento",
        "categories": [
            [
                "SORT-ELEM",
                "Ordenamiento elemental",
                "Ordenamientos locales con ciclos anidados",
                "Bubble Sort; Selection Sort; Insertion Sort; ordenar estudiantes por calificación",
                "medium"
            ],
            [
                "SORT-ADV",
                "Ordenamiento avanzado",
                "Divide y vencerás o montículos",
                "Merge Sort; Quicksort; Heap Sort; partición Lomuto/Hoare; contar inversiones",
                "high"
            ]
        ]
    },
    {
        "familyId": "SELECT",
        "familyName": "Selección y fusión",
        "categories": [
            [
                "SELECT-ORDER",
                "Selección por orden",
                "Obtención de extremos o posiciones relevantes",
                "Máximo; mínimo; segundo mayor; tres mayores",
                "medium"
            ],
            [
                "SELECT-K",
                "Selección especializada",
                "Selección parcial sin ordenar toda la entrada",
                "Quickselect; k-ésimo menor; top-k con heap",
                "high"
            ],
            [
                "SELECT-MERGE",
                "Fusión ordenada",
                "Recorrido coordinado de secuencias ordenadas",
                "Merge de arreglos ordenados; intercalado; join ordenado simple",
                "medium"
            ]
        ]
    },
    {
        "familyId": "LINEAR",
        "familyName": "Estructuras lineales",
        "categories": [
            [
                "LINEAR-STACK",
                "Pilas",
                "Estructura LIFO y aplicaciones",
                "Implementar pila; invertir cadena; paréntesis balanceados; evaluación postfix",
                "medium"
            ],
            [
                "LINEAR-QUEUE",
                "Colas",
                "FIFO, cola circular y deque",
                "Implementar cola; fila de atención; cola circular; simulación de clientes",
                "medium"
            ],
            [
                "LINEAR-LINKED",
                "Listas enlazadas",
                "Nodos y referencias explícitas",
                "Insertar/eliminar; invertir lista; lista doble; lista circular; detectar ciclo con Floyd",
                "high"
            ]
        ]
    },
    {
        "familyId": "HASH",
        "familyName": "Hashing",
        "categories": [
            [
                "HASH-USE",
                "Hashing aplicado",
                "Uso de mapa o conjunto hash como abstracción",
                "Frecuencias; deduplicación; pertenencia; detectar elementos comunes",
                "medium"
            ],
            [
                "HASH-IMPL",
                "Implementación de hashing",
                "Diseño de tabla, colisiones y redimensionamiento",
                "Encadenamiento; sondeo lineal/cuadrático; rehash; mapa clave-valor propio",
                "high"
            ]
        ]
    },
    {
        "familyId": "TREE",
        "familyName": "Estructuras arbóreas",
        "categories": [
            [
                "TREE-BINARY",
                "Árboles binarios",
                "Recorridos y propiedades estructurales",
                "Preorden/inorden/postorden; altura; hojas; balance; ancestro simple",
                "high"
            ],
            [
                "TREE-BST",
                "Árboles binarios de búsqueda",
                "Invariante de orden",
                "Insertar; buscar; eliminar con 0/1/2 hijos; sucesor y predecesor",
                "high"
            ],
            [
                "TREE-HEAP",
                "Montículos",
                "Propiedad heap y prioridad",
                "Min-heap; max-heap; heapify; build-heap; top-k",
                "high"
            ],
            [
                "TREE-RANGE",
                "Árboles de rango",
                "Consultas y actualizaciones sobre intervalos",
                "Fenwick Tree; Segment Tree; lazy propagation",
                "extreme"
            ],
            [
                "TREE-PERSIST",
                "Estructuras persistentes",
                "Versionado estructural con compartición",
                "Segment Tree persistente; consultas históricas; múltiples versiones",
                "extreme"
            ]
        ]
    },
    {
        "familyId": "MATHD",
        "familyName": "Matemática discreta algorítmica",
        "categories": [
            [
                "MATHD-NUM-ELEM",
                "Teoría de números elemental",
                "Propiedades enteras y algoritmos directos",
                "Primalidad por divisores; MCD; MCM; divisores; factorización simple",
                "medium"
            ],
            [
                "MATHD-NUM-ADV",
                "Teoría de números especializada",
                "Preprocesamiento o identidades enteras más elaboradas",
                "Criba de Eratóstenes; criba segmentada; Euclides extendido; ecuaciones diofánticas",
                "high"
            ],
            [
                "MATHD-MOD",
                "Aritmética modular",
                "Operaciones en congruencias",
                "Exponenciación modular; inversos; coeficientes de Bézout",
                "high"
            ],
            [
                "MATHD-COMB",
                "Conteo combinatorio",
                "Cálculo de configuraciones",
                "Coeficientes binomiales; triángulo de Pascal; combinaciones sin factoriales grandes",
                "high"
            ],
            [
                "MATHD-GEN",
                "Generación combinatoria",
                "Enumeración sistemática",
                "Permutaciones; combinaciones k; subconjuntos; permutaciones lexicográficas",
                "high"
            ],
            [
                "MATHD-PROB",
                "Probabilidad algorítmica elemental",
                "Simulación de eventos y estimación directa",
                "Monedas; dados; estimar probabilidades por simulación",
                "medium"
            ]
        ]
    },
    {
        "familyId": "NUMERIC",
        "familyName": "Métodos numéricos",
        "categories": [
            [
                "NUMERIC-ROOT",
                "Búsqueda de raíces",
                "Iteración con tolerancia y convergencia",
                "Bisección; Newton-Raphson; raíz cuadrada por Newton",
                "high"
            ],
            [
                "NUMERIC-INTEG",
                "Integración numérica",
                "Aproximación de integrales",
                "Rectángulos; trapecio; Simpson",
                "high"
            ],
            [
                "NUMERIC-INTERP",
                "Interpolación numérica",
                "Aproximación mediante muestras",
                "Interpolación lineal; Lagrange",
                "high"
            ],
            [
                "NUMERIC-OPT",
                "Optimización numérica",
                "Búsqueda de mínimos o máximos",
                "Búsqueda ternaria sobre función unimodal; optimización discreta sencilla",
                "high"
            ]
        ]
    },
    {
        "familyId": "LINALG",
        "familyName": "Álgebra lineal algorítmica",
        "categories": [
            [
                "LINALG-MAT",
                "Operaciones algebraicas con matrices",
                "Transformaciones y productos no triviales",
                "Multiplicación matricial; determinante mediante eliminación",
                "high"
            ],
            [
                "LINALG-SYS",
                "Sistemas de ecuaciones",
                "Eliminación y sustitución",
                "Eliminación gaussiana; sustitución hacia atrás; sistemas triangulares",
                "high"
            ]
        ]
    },
    {
        "familyId": "DP",
        "familyName": "Programación dinámica",
        "categories": [
            [
                "DP-SEQ",
                "Programación dinámica sobre secuencias",
                "Estados por posiciones de secuencias",
                "LCS; LIS; Levenshtein; reconstrucción de operaciones",
                "extreme"
            ],
            [
                "DP-CAP",
                "Programación dinámica por capacidad",
                "Estados sobre capacidad, monto o suma",
                "Mochila 0/1; mochila ilimitada; Coin Change; Subset Sum; Partition",
                "extreme"
            ],
            [
                "DP-INTERVAL",
                "Programación dinámica sobre intervalos",
                "Estados sobre segmentos o particiones",
                "Matrix Chain Multiplication; particiones óptimas",
                "extreme"
            ],
            [
                "DP-GRAPH",
                "Programación dinámica sobre grafos",
                "Estados asociados a vértices o etapas",
                "Floyd-Warshall; caminos en DAG; TSP con DP",
                "extreme"
            ]
        ]
    },
    {
        "familyId": "OPT",
        "familyName": "Optimización combinatoria",
        "categories": [
            [
                "OPT-SCHED",
                "Planificación",
                "Selección o calendarización bajo restricciones",
                "Interval scheduling; tareas con fechas límite; optimización de beneficios",
                "high"
            ],
            [
                "OPT-ASSIGN",
                "Asignación",
                "Correspondencia de recursos con costo",
                "Algoritmo Húngaro; trabajador-tarea",
                "extreme"
            ],
            [
                "OPT-COVER",
                "Cobertura",
                "Selección de subconjuntos que cubren restricciones",
                "Set Cover; Vertex Cover",
                "extreme"
            ],
            [
                "OPT-ROUTE",
                "Ruteo",
                "Optimización de recorridos",
                "TSP; reconstrucción de ruta óptima",
                "extreme"
            ],
            [
                "OPT-PACK",
                "Empaquetamiento",
                "Distribución bajo capacidades",
                "Bin Packing; First Fit; Cutting Stock simplificado",
                "extreme"
            ]
        ]
    },
    {
        "familyId": "CSP",
        "familyName": "Satisfacción de restricciones",
        "categories": [
            [
                "CSP-SEARCH",
                "Búsqueda con restricciones",
                "Exploración de asignaciones con poda",
                "Sudoku; N-Reinas; coloración de grafos; ciclo Hamiltoniano",
                "extreme"
            ]
        ]
    },
    {
        "familyId": "GRAPH-F",
        "familyName": "Fundamentos de grafos",
        "categories": [
            [
                "GRAPH-F-TRAV",
                "Recorridos",
                "Exploración de vértices y aristas",
                "BFS; DFS recursivo; DFS iterativo",
                "extreme"
            ],
            [
                "GRAPH-F-CONN",
                "Conectividad",
                "Componentes y alcanzabilidad",
                "Componentes conexas; camino entre vértices; DSU",
                "extreme"
            ],
            [
                "GRAPH-F-CYCLE",
                "Ciclos y bipartición",
                "Propiedades estructurales obtenidas mediante recorridos",
                "Ciclos dirigidos/no dirigidos; grafo bipartito; 2-coloración",
                "extreme"
            ],
            [
                "GRAPH-F-DAG",
                "Grafos acíclicos",
                "Dependencias y orden parcial",
                "Ordenamiento topológico; algoritmo de Kahn; dependencias",
                "extreme"
            ]
        ]
    },
    {
        "familyId": "GRAPH-O",
        "familyName": "Optimización en grafos",
        "categories": [
            [
                "GRAPH-O-SP",
                "Caminos mínimos",
                "Optimización de distancias",
                "BFS no ponderado; Dijkstra; Bellman-Ford; Floyd-Warshall",
                "extreme"
            ],
            [
                "GRAPH-O-MST",
                "Árboles de expansión mínima",
                "Selección de aristas de costo mínimo",
                "Kruskal; Prim",
                "extreme"
            ],
            [
                "GRAPH-O-LCA",
                "Consultas de ancestros",
                "Preprocesamiento de árboles",
                "LCA; binary lifting",
                "extreme"
            ]
        ]
    },
    {
        "familyId": "GRAPH-S",
        "familyName": "Estructura de grafos",
        "categories": [
            [
                "GRAPH-S-SCC",
                "Componentes fuertemente conexas",
                "Descomposición de grafos dirigidos",
                "Tarjan; Kosaraju",
                "extreme"
            ],
            [
                "GRAPH-S-BRIDGE",
                "Puentes y articulaciones",
                "Conectividad crítica",
                "Puentes; puntos de articulación",
                "extreme"
            ],
            [
                "GRAPH-S-EULER",
                "Recorridos eulerianos",
                "Recorridos que utilizan cada arista",
                "Hierholzer; camino/circuito Euleriano",
                "extreme"
            ],
            [
                "GRAPH-S-DYN",
                "Grafos dinámicos",
                "Mantenimiento tras modificaciones",
                "Conectividad dinámica; actualizar caminos tras cambios de aristas",
                "extreme"
            ]
        ]
    },
    {
        "familyId": "GRAPH-N",
        "familyName": "Redes de flujo",
        "categories": [
            [
                "GRAPH-N-FLOW",
                "Flujo máximo",
                "Red residual y caminos aumentantes",
                "Ford-Fulkerson; Edmonds-Karp; flujo máximo; corte mínimo",
                "extreme"
            ],
            [
                "GRAPH-N-MATCH",
                "Emparejamiento",
                "Asignaciones mediante caminos aumentantes",
                "Matching bipartito; trabajador-tarea por matching",
                "extreme"
            ]
        ]
    },
    {
        "familyId": "GEO",
        "familyName": "Geometría computacional",
        "categories": [
            [
                "GEO-PRED",
                "Predicados geométricos",
                "Orientación, intersección e inclusión",
                "Producto cruzado; colinealidad; intersección de segmentos; punto en polígono; ray casting",
                "high"
            ],
            [
                "GEO-HULL",
                "Envolvente convexa",
                "Construcción de frontera convexa",
                "Graham Scan; Monotonic Chain",
                "extreme"
            ],
            [
                "GEO-NEAR",
                "Vecindad espacial",
                "Proximidad entre puntos",
                "Closest Pair; nearest neighbor",
                "extreme"
            ],
            [
                "GEO-SWEEP",
                "Barrido geométrico",
                "Eventos ordenados y estructura activa",
                "Sweep Line; detección de múltiples intersecciones",
                "extreme"
            ],
            [
                "GEO-TESS",
                "Teselaciones",
                "Particiones espaciales",
                "Voronoi; Delaunay",
                "extreme"
            ]
        ]
    },
    {
        "familyId": "CRYPTO",
        "familyName": "Criptografía",
        "categories": [
            [
                "CRYPTO-CLASSIC",
                "Criptografía clásica",
                "Cifrados históricos y transformaciones reversibles",
                "César; Vigenère; sustitución; transposición; XOR educativo",
                "medium"
            ],
            [
                "CRYPTO-MOD",
                "Aritmética criptográfica",
                "Herramientas modulares para criptosistemas",
                "Exponenciación modular; inverso modular; Euclides extendido",
                "high"
            ],
            [
                "CRYPTO-ASYM",
                "Criptografía asimétrica",
                "Criptosistemas de clave pública educativos",
                "Generar claves RSA; cifrar/descifrar RSA; potencia modular e inversos",
                "extreme"
            ]
        ]
    },
    {
        "familyId": "COMP",
        "familyName": "Compresión de datos",
        "categories": [
            [
                "COMP-RLE",
                "Run-Length Encoding",
                "Codificación de rachas",
                "Comprimir y descomprimir RLE",
                "medium"
            ],
            [
                "COMP-HUFF-F",
                "Huffman fundamental",
                "Construcción de frecuencias, heap, árbol y códigos",
                "Construir árbol Huffman; generar códigos; comprimir texto educativo",
                "high"
            ],
            [
                "COMP-HUFF-S",
                "Huffman especializado",
                "Codificación/decodificación completa de flujo o archivo",
                "Codificar archivo con Huffman; decodificar flujo Huffman",
                "extreme"
            ],
            [
                "COMP-LZ",
                "Compresión por diccionario",
                "Referencias a secuencias previas o diccionario dinámico",
                "LZ77; LZ78; diccionario dinámico",
                "extreme"
            ],
            [
                "COMP-CODE",
                "Codificación compacta",
                "Representaciones binarias compactas",
                "VarInt; serialización binaria básica",
                "high"
            ]
        ]
    },
    {
        "familyId": "DATA",
        "familyName": "Procesamiento de datos",
        "categories": [
            [
                "DATA-FILTER",
                "Filtrado",
                "Selección por predicados",
                "Estudiantes aprobados; productos por rango; múltiples criterios",
                "medium"
            ],
            [
                "DATA-GROUP",
                "Agrupación",
                "Agrupar por clave y agregar",
                "Ventas por categoría; estudiantes por calificación; group-by",
                "medium"
            ],
            [
                "DATA-JOIN",
                "Fusión y joins",
                "Combinación por orden o clave",
                "Merge ordenado; join simple",
                "medium"
            ],
            [
                "DATA-RANGE",
                "Consultas por rango",
                "Preprocesamiento para intervalos",
                "Prefix sums; sumas/mínimos por intervalo",
                "high"
            ],
            [
                "DATA-OFFLINE",
                "Consultas offline",
                "Reordenamiento de consultas",
                "Mo's algorithm; procesamiento offline",
                "extreme"
            ],
            [
                "DATA-TIME",
                "Datos temporales",
                "Intervalos, solapamientos y calendarios",
                "Merge intervals; conflictos; programación de eventos",
                "high"
            ]
        ]
    },
    {
        "familyId": "RAND",
        "familyName": "Aleatorización y aproximación",
        "categories": [
            [
                "RAND-ALG",
                "Algoritmos aleatorizados",
                "Aleatoriedad para partición o selección",
                "Randomized Quicksort; Randomized Select; hashing aleatorizado",
                "high"
            ],
            [
                "RAND-MC",
                "Monte Carlo",
                "Respuesta probabilística o aproximada",
                "Estimación por muestreo; pruebas probabilísticas",
                "extreme"
            ],
            [
                "RAND-LV",
                "Las Vegas",
                "Correctitud garantizada con tiempo aleatorio",
                "Algoritmos Las Vegas educativos",
                "extreme"
            ],
            [
                "RAND-APPROX",
                "Aproximación",
                "Soluciones aproximadas a problemas difíciles",
                "Aproximaciones para TSP; Set Cover; Vertex Cover",
                "extreme"
            ]
        ]
    },
    {
        "familyId": "STREAM",
        "familyName": "Procesamiento online",
        "categories": [
            [
                "STREAM-F",
                "Streaming fundamental",
                "Una pasada con memoria acotada",
                "Acumulados y conteos sobre un flujo",
                "high"
            ],
            [
                "STREAM-S",
                "Streaming especializado",
                "Estructuras probabilísticas compactas",
                "Count-Min Sketch; HyperLogLog; Bloom Filter",
                "extreme"
            ],
            [
                "STREAM-ONLINE",
                "Algoritmos online",
                "Decisiones sin conocer el futuro",
                "Caching online; scheduling online",
                "extreme"
            ],
            [
                "STREAM-CACHE",
                "Algoritmos de caché",
                "Políticas de reemplazo y localidad",
                "LRU; FIFO; análisis de decisiones de caché",
                "high"
            ],
            [
                "STREAM-EXT",
                "Memoria externa",
                "Optimización de accesos a almacenamiento secundario",
                "External Merge Sort; B-tree conceptual",
                "extreme"
            ]
        ]
    },
    {
        "familyId": "SYS",
        "familyName": "Algoritmos concurrentes",
        "categories": [
            [
                "SYS-PAR",
                "Algoritmos paralelos",
                "Descomposición de trabajo y sincronización",
                "Reducción paralela; prefix sum paralelo; divide y vencerás paralelo",
                "extreme"
            ],
            [
                "SYS-DIST",
                "Algoritmos distribuidos",
                "Coordinación sin memoria compartida central",
                "Elección de líder; coordinación; consenso abstracto",
                "extreme"
            ]
        ]
    },
    {
        "familyId": "ADAPT",
        "familyName": "Algoritmos adaptativos",
        "categories": [
            [
                "ADAPT-INCR",
                "Algoritmos incrementales",
                "Actualización tras cambios pequeños",
                "Mantener agregados o índices después de inserciones",
                "extreme"
            ],
            [
                "ADAPT-DYN",
                "Algoritmos dinámicos",
                "Consultas y actualizaciones intercaladas",
                "Estructuras dinámicas; cambios durante la ejecución",
                "extreme"
            ],
            [
                "ADAPT-PARAM",
                "Algoritmos parametrizados",
                "Complejidad respecto de un parámetro k",
                "Vertex Cover parametrizado; FPT educativo",
                "extreme"
            ]
        ]
    },
    {
        "familyId": "ML",
        "familyName": "Aprendizaje algorítmico clásico",
        "categories": [
            [
                "ML-KNN",
                "k-Nearest Neighbors",
                "Clasificación basada en distancias",
                "k-NN; clasificar puntos según vecinos",
                "high"
            ],
            [
                "ML-KMEANS",
                "k-means",
                "Agrupamiento por centroides",
                "k-means; recomputar centroides hasta convergencia",
                "high"
            ],
            [
                "ML-HIER",
                "Clustering jerárquico",
                "Combinación progresiva de grupos",
                "Clustering jerárquico aglomerativo",
                "extreme"
            ],
            [
                "ML-RECOMM",
                "Recomendación",
                "Similitud, vecinos y ranking",
                "Similitud entre usuarios; recomendación por vecinos; ranking básico",
                "high"
            ]
        ]
    },
    {
        "familyId": "SIGNAL",
        "familyName": "Procesamiento de señales e imágenes",
        "categories": [
            [
                "SIGNAL-CONV",
                "Convolución",
                "Ventana ponderada sobre señales o imágenes",
                "Convolución discreta 1D; convolución 2D",
                "high"
            ],
            [
                "SIGNAL-DFT",
                "Transformada discreta de Fourier",
                "Cálculo directo del espectro",
                "DFT",
                "high"
            ],
            [
                "SIGNAL-FFT",
                "Transformada rápida de Fourier",
                "Divide y vencerás para cálculo espectral",
                "FFT",
                "extreme"
            ],
            [
                "SIGNAL-FILTER",
                "Filtrado",
                "Operaciones locales sobre señales",
                "Suavizado; filtros discretos",
                "high"
            ],
            [
                "SIGNAL-IMAGE",
                "Procesamiento de imágenes",
                "Regiones, componentes y bordes",
                "Flood fill; componentes conexas; detección básica de bordes",
                "extreme"
            ]
        ]
    },
    {
        "familyId": "BIO",
        "familyName": "Bioinformática",
        "categories": [
            [
                "BIO-ALIGN",
                "Alineamiento de secuencias",
                "DP con costos de coincidencia y gap",
                "Needleman-Wunsch; alineamiento global",
                "extreme"
            ],
            [
                "BIO-DIST",
                "Distancia genética",
                "Métricas estructuradas sobre secuencias",
                "Distancia genética; edición con costos",
                "extreme"
            ],
            [
                "BIO-ASSEMBLY",
                "Ensamblaje de secuencias",
                "Reconstrucción a partir de fragmentos",
                "Ensamblaje simplificado; secuenciación; Shortest Common Superstring",
                "extreme"
            ]
        ]
    },
    {
        "familyId": "STATE",
        "familyName": "Búsqueda de estados",
        "categories": [
            [
                "STATE-BFS",
                "Búsqueda no informada",
                "Configuraciones como nodos y transiciones como aristas",
                "8-puzzle con BFS; laberintos; navegación por estados",
                "extreme"
            ],
            [
                "STATE-ASTAR",
                "Búsqueda heurística",
                "Costo acumulado más heurística",
                "A* para 8-puzzle; navegación; path planning",
                "extreme"
            ],
            [
                "STATE-MOTION",
                "Planificación de movimiento",
                "Búsqueda de caminos bajo restricciones espaciales",
                "Robot en cuadrícula; ruta evitando obstáculos; espacio de configuraciones",
                "extreme"
            ]
        ]
    },
    {
        "familyId": "GAME",
        "familyName": "Juegos combinatorios",
        "categories": [
            [
                "GAME-MINIMAX",
                "Minimax",
                "Exploración adversarial de estados",
                "IA para tres en raya; estados ganadores/perdedores",
                "extreme"
            ],
            [
                "GAME-AB",
                "Poda alfa-beta",
                "Poda del árbol Minimax",
                "Minimax con poda alfa-beta",
                "extreme"
            ]
        ]
    },
    {
        "familyId": "NETWORK",
        "familyName": "Análisis de redes",
        "categories": [
            [
                "NETWORK-CENT",
                "Centralidad",
                "Importancia estructural de vértices",
                "Grado; closeness; betweenness simplificada; PageRank educativo",
                "extreme"
            ],
            [
                "NETWORK-COMM",
                "Comunidades y difusión",
                "Agrupamiento y propagación en grafos",
                "Comunidades sencillas; difusión de información",
                "extreme"
            ]
        ]
    },
    {
        "familyId": "VOTE",
        "familyName": "Votación y preferencias",
        "categories": [
            [
                "VOTE-PLURAL",
                "Pluralidad",
                "Conteo directo de votos",
                "Pluralidad; mayoría simple",
                "medium"
            ],
            [
                "VOTE-COND",
                "Condorcet",
                "Comparaciones par a par",
                "Ganador de Condorcet; matriz de comparaciones",
                "extreme"
            ],
            [
                "VOTE-RANK",
                "Agregación de rankings",
                "Combinación de órdenes de preferencia",
                "Combinar rankings; consenso de órdenes",
                "extreme"
            ]
        ]
    },
    {
        "familyId": "FIN",
        "familyName": "Algoritmos financieros",
        "categories": [
            [
                "FIN-RET",
                "Retornos financieros",
                "Transformaciones directas sobre series de precios",
                "Retornos simples/logarítmicos; acumulados",
                "medium"
            ],
            [
                "FIN-SERIES",
                "Series financieras",
                "Ventanas y eventos temporales",
                "Medias móviles; drawdown; detección de cambios",
                "high"
            ],
            [
                "FIN-ARB",
                "Arbitraje",
                "Oportunidades modeladas como caminos o ciclos",
                "Arbitraje con grafos; detección de ciclos de ganancia",
                "extreme"
            ]
        ]
    }
];

export const BROKER_CATEGORY_SOURCE = Object.freeze(
    TAXONOMY.map(rawFamily => Object.freeze({
        familyId: rawFamily.familyId,
        familyName: rawFamily.familyName,
        categories: Object.freeze(
            rawFamily.categories.map(rawCategory => Object.freeze({
                categoryId: rawCategory[0],
                categoryName: rawCategory[1],
                scope: rawCategory[2],
                representativeExamples: rawCategory[3],
                minimumRisk: rawCategory[4],
                audiences: rawFamily.familyId === "FND"
                    ? LEARNING
                    : CLIENT
            }))
        )
    }))
);
