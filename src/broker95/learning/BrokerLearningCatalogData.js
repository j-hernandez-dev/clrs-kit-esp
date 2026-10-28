import {
    BrokerLearningContentBlockKind,
    BrokerLearningExampleLanguage
} from "./BrokerLearningContent.js";

const FND = "FND";

const REWARDS = Object.freeze([
    10, 12, 14, 16, 18, 20, 22, 24, 26, 28,
    30, 32, 34, 36, 38, 40, 42, 44, 46, 48,
    50, 52, 54, 56, 58, 60, 62, 64, 66, 68,
    70, 72, 74, 76, 78, 80, 82, 84, 86, 88,
    90, 92, 94, 96, 98, 100, 102, 104, 106, 108,
    110, 112, 114, 116, 118, 120, 122, 124, 126, 128,
    130, 132, 134, 136, 138, 140, 142, 144, 146, 148,
    150, 152, 154, 156, 158, 160, 162, 164, 166, 168,
    170, 172, 174, 176, 178, 180, 182, 184, 186, 188,
    190, 192, 194, 196, 198, 200, 202, 204, 206, 208,
    210, 212, 214, 216, 218, 220, 250
]);

/**
 * Forma práctica esperada para cada lección de Programación. CIPHER recibe
 * estas descripciones como una restricción curricular concreta, separada del
 * objetivo conceptual, y debe proponer un contrato que pueda resolverse sólo
 * con los conocimientos acumulados hasta la lección correspondiente.
 */
const EXPECTED_CONTRACTS = Object.freeze([
    "Crear un programa de una sola instrucción que muestre exactamente un mensaje literal y permita observar que una instrucción escrita produce una salida durante la ejecución.",
    "Representar una tarea muy breve como una secuencia ordenada de instrucciones de salida que comuniquen sus pasos principales desde el inicio hasta el final.",
    "Crear un programa con varias instrucciones de salida cuyo significado dependa del orden de ejecución y producir la secuencia exacta solicitada.",
    "Representar conceptualmente una transformación sencilla mediante entrada, procesamiento y salida, comunicando esas tres etapas con instrucciones básicas de escritura sin utilizar todavía entrada real ni cálculos.",
    "Mostrar varios valores numéricos, textuales y lógicos relacionados con una situación sencilla, reconociéndolos como datos con valores y significados diferentes.",
    "Producir salidas utilizando directamente literales numéricos, de cadena y lógicos, distinguiendo la representación escrita del valor que expresa cada literal.",
    "Identificar nombres descriptivos para los datos de una situación sencilla y comunicar la relación entre cada identificador conceptual y el dato que representa, sin exigir todavía variables.",
    "Crear variables para conservar valores sencillos y mostrar posteriormente el valor almacenado en cada una.",
    "Inicializar variables mediante su primera asignación, reasignar al menos una de ellas y mostrar el valor final, utilizando = únicamente como operador de asignación.",
    "Representar una secuencia de cambios de estado mediante varias reasignaciones a una misma variable y mostrar los estados solicitados en el orden en que ocurren.",
    "Crear variables con valores numéricos, textuales y lógicos, mostrar sus contenidos y reasignar una variable con un valor de otra clase para observar el sistema de tipos dinámico de CLRS.",
    "Almacenar una cadena en una variable y mostrar un texto que conserve correctamente palabras, espacios y símbolos como parte de una misma secuencia de caracteres.",
    "Construir un mensaje nuevo mediante concatenación de fragmentos de texto y variables, respetando exactamente el orden y los espacios requeridos.",
    "Producir una salida textual que requiera saltos de línea, tabulaciones o comillas internas utilizando únicamente las secuencias de escape disponibles en CLRS.",
    "Examinar una cadena mediante LONG y CAR_EN, mostrando su longitud y los caracteres solicitados en posiciones basadas en cero.",
    "Transformar una cadena mediante una o más operaciones como MAYUS, MINUS, RECORTA, SUBCAD o REEMP y mostrar exactamente el texto resultante.",
    "Leer uno o pocos datos en variables previamente inicializadas, comprobar su clase cuando el problema lo requiera, realizar una conversión explícita mediante las funciones disponibles y mostrar el resultado obtenido.",
    "Construir expresiones sencillas con literales y variables, almacenar los valores evaluados y mostrarlos para reconocer la relación entre operandos, operadores y resultado.",
    "Obtener dos valores numéricos y calcular con ellos los resultados aritméticos solicitados mediante suma, resta, multiplicación o división, mostrando únicamente los resultados requeridos.",
    "Evaluar una expresión con las reglas normales de precedencia y otra versión agrupada explícitamente con paréntesis, mostrando ambos resultados para observar cómo cambia la evaluación.",
    "Comparar valores mediante operadores relacionales, almacenar resultados lógicos y producir las salidas solicitadas distinguiendo claramente la asignación = de la igualdad ==.",
    "Construir una condición compuesta mediante comparaciones y los operadores y, o o no, y mostrar el valor lógico producido por la regla.",
    "Completar o construir un programa muy breve que combine una secuencia con una selección guiada para observar que el flujo puede continuar normalmente o ejecutar adicionalmente un bloque según una condición.",
    "Crear un programa con una selección simple si que produzca una salida adicional únicamente cuando la condición sea verdadera y continúe después con el flujo normal.",
    "Clasificar un valor entre varias alternativas mutuamente excluyentes mediante si, sino si y sino, produciendo exactamente una sola clasificación.",
    "Repetir una acción mediante mientras, actualizar dentro del ciclo el estado que controla su condición y producir la salida esperada garantizando que la repetición termine.",
    "Recorrer una secuencia sencilla, contar únicamente las veces que se cumple una condición y mostrar el contador final.",
    "Procesar varios valores durante una repetición, acumular progresivamente las cantidades requeridas y mostrar el resultado final después de terminar el recorrido.",
    "Recorrer un intervalo conocido mediante para, en sentido ascendente o descendente según el problema, utilizando la variable de iteración dentro del bloque para producir la secuencia solicitada.",
    "Combinar dos ciclos anidados para producir todas las combinaciones requeridas entre los valores del ciclo exterior y del interior, respetando el orden de recorrido.",
    "Analizar una tarea pequeña, distinguir conceptualmente sus responsabilidades o subproblemas y producir la salida solicitada con las construcciones ya conocidas, sin exigir todavía la definición de funciones.",
    "Definir una función sencilla con nombre y cuerpo que represente una responsabilidad concreta, sin requerir todavía su invocación; mantener un flujo principal mínimo que permita ejecutar el programa correctamente.",
    "Definir una función e invocarla desde PRINCIPAL una o más veces, produciendo salidas que permitan observar la transferencia del control hacia la función y el regreso al punto posterior a cada llamada.",
    "Crear una función con uno o más parámetros e invocarla con argumentos diferentes para reutilizar el mismo comportamiento y producir resultados distintos a partir de los valores recibidos.",
    "Crear una función que calcule y retorne un valor, utilizar el resultado de la llamada en una asignación o expresión y mostrar el resultado final.",
    "Crear un programa con una variable global y una función que utilice una variable local del mismo nombre, produciendo salidas que permitan distinguir el ámbito local del global según las reglas de CLRS.",
    "Reorganizar una solución breve con una responsabilidad repetida extrayéndola a una función parametrizada, manteniendo exactamente el mismo comportamiento y las mismas salidas observables.",
    "Trabajar con varios valores relacionados como partes de una misma colección conceptual y producir las salidas solicitadas en su orden, sin exigir todavía sintaxis de índices o construcción de arreglos.",
    "Dada una colección representada conceptualmente con índices basados en cero, identificar qué valores corresponden a los índices solicitados y producir esas salidas sin exigir todavía la construcción del arreglo en CLRS.",
    "Crear un arreglo con un literal entre corchetes, actualizar posteriormente uno o más elementos mediante sus índices y mostrar los valores finales de las posiciones solicitadas.",
    "Obtener la longitud de un arreglo mediante LONG y recorrer sistemáticamente todos sus elementos desde el índice 0 hasta LONG(A) - 1 para producir el resultado solicitado.",
    "Modificar y consultar un arreglo utilizando las operaciones de biblioteca apropiadas entre AGREGA, INSER, ELIM, INDICE y CONT, distinguiendo actualización, modificación estructural y consulta mediante resultados observables.",
    "Construir una matriz pequeña mediante asignaciones con doble índice, consultar o actualizar posiciones concretas de fila y columna y mostrar los valores solicitados.",
    "Recorrer sistemáticamente todos los elementos de una matriz pequeña mediante un ciclo exterior para las filas y un ciclo interior para las columnas, procesando cada posición para producir el resultado requerido.",
    "Enviar un arreglo como argumento a una función con parámetro de arreglo, recorrer o procesar sus elementos dentro de la función y utilizar desde PRINCIPAL el valor retornado o la salida producida.",
    "Resolver un problema completo y pequeño identificando sus datos de entrada, realizando el procesamiento necesario mediante las construcciones ya conocidas y produciendo únicamente la salida final solicitada.",
    "Resolver un problema de varias etapas combinando entrada, repetición y selección, y conservar mediante un contador, un acumulador o ambos los resultados parciales necesarios para producir la salida final.",
    "Resolver un problema completo compuesto por varias responsabilidades, organizar las que resulte apropiado separar mediante funciones y coordinar desde PRINCIPAL la información y los resultados necesarios para obtener la salida solicitada.",
    "Resolver un problema integrador a partir de sus datos y resultados requeridos, seleccionando libremente entre arreglos, recorridos, condiciones, contadores, acumuladores y funciones, y comprobar que el programa produzca exactamente los resultados esperados.",
    "Resolver un ejercicio integrador breve eligiendo libremente entre variables, expresiones, decisiones, ciclos, funciones y arreglos, produciendo la salida solicitada como demostración de que los fundamentos pueden combinarse y transferirse más allá de una construcción específica."
]);

const SECTION_DEFINITIONS = Object.freeze([
    [
        1,
        "Del problema al programa",
        "Comprender qué es un programa, cómo se relaciona con un problema y cómo una computadora ejecuta instrucciones en un orden determinado.",
        1,
        4
    ],
    [
        2,
        "Representar información",
        "Comprender cómo los programas representan valores mediante datos, literales, identificadores y variables.",
        5,
        11
    ],
    [
        3,
        "Texto y entrada",
        "Aprender a representar texto, construir mensajes, examinar cadenas y recibir datos desde el usuario.",
        12,
        17
    ],
    [
        4,
        "Expresiones y operaciones",
        "Aprender a combinar y transformar valores mediante expresiones y operadores, comprendiendo cómo se evalúan en un programa.",
        18,
        22
    ],
    [
        5,
        "Control de flujo y programación estructurada",
        "Modificar el flujo de ejecución para comprender cómo permiten cambiar el estado de un programa mediante estructuras selectivas e iterativas.",
        23,
        30
    ],
    [
        6,
        "Funciones y programación procedimental",
        "Aprender a dividir una solución en subprogramas con responsabilidades claras.",
        31,
        37
    ],
    [
        7,
        "Arreglos y colecciones",
        "Aprender a trabajar con múltiples valores mediante arreglos e índices.",
        38,
        45
    ],
    [
        8,
        "Resolver problemas completos",
        "Integrar los conocimientos previos para resolver problemas computacionales sencillos de principio a fin, consolidando el razonamiento con poca sintaxis nueva.",
        46,
        50
    ]
]);

export const BROKER_LEARNING_CURRICULUM_SOURCE =
    Object.freeze({
        sections: Object.freeze(
            SECTION_DEFINITIONS
                .map(
                    ([
                        order,
                        title,
                        description,
                        firstLesson,
                        lastLesson
                    ]) => section(
                        order,
                        title,
                        description,
                        firstLesson,
                        lastLesson
                    )
                )
        ),
        lessons: Object.freeze([
            lesson({
                order: 1,
                section: 1,
                title: "Código fuente y programa",

                objective:
                    "Comprender cómo una acción que queremos realizar con una computadora puede expresarse mediante una instrucción escrita, formando código fuente que posteriormente puede ejecutarse como parte de un programa.",

                problemStatement:
                    "Queremos que una computadora muestre un mensaje. ¿Cómo podemos expresar esa acción para que la computadora pueda ejecutarla?",

                concepts: [
                    "programa",
                    "código fuente",
                    "instrucción",
                    "lenguaje de programación",
                    "ejecución"
                ],

                explanation: [
                    paragraph(
                        "Antes de programar existe una intención: queremos que la computadora realice alguna acción. En este primer problema queremos algo muy sencillo: hacer que muestre un mensaje."
                    ),

                    paragraph(
                        "La computadora necesita que esa acción esté expresada de una forma que pueda procesarse. Para ello utilizamos un lenguaje de programación, es decir, un sistema de reglas con el que podemos escribir instrucciones."
                    ),

                    callout(
                        "Del propósito a la acción",
                        [
                            "Queremos que ocurra algo",
                            "        →",
                            "escribimos una instrucción",
                            "        →",
                            "la computadora la ejecuta",
                            "        →",
                            "ocurre una acción observable"
                        ].join("\n")
                    ),

                    paragraph(
                        "Una instrucción expresa una acción concreta que debe realizarse durante la ejecución. Por ejemplo, podemos escribir una instrucción que indique que cierto texto debe mostrarse como salida."
                    ),

                    paragraph(
                        "Las instrucciones escritas mediante un lenguaje de programación forman código fuente. El código fuente es la representación escrita con la que una persona expresa el comportamiento que desea obtener."
                    ),

                    paragraph(
                        "Cuando ese código es procesado y sus instrucciones comienzan a realizarse, hablamos de ejecución. Durante la ejecución, las instrucciones dejan de ser únicamente texto escrito y producen acciones y resultados."
                    ),

                    callout(
                        "Código escrito y ejecución",
                        [
                            "CÓDIGO FUENTE",
                            "",
                            "escribir \"Hola\"",
                            "",
                            "        → ejecutar",
                            "",
                            "ACCIÓN",
                            "",
                            "se muestra:",
                            "Hola"
                        ].join("\n")
                    ),

                    paragraph(
                        "Un programa reúne instrucciones organizadas para realizar una tarea. Un programa puede ser extremadamente pequeño, como en este primer ejemplo, o estar formado por muchas instrucciones que colaboran para resolver problemas más grandes."
                    ),

                    list([
                        "Instrucción: indicación concreta que expresa una acción que debe realizarse.",
                        "Lenguaje de programación: sistema de reglas utilizado para expresar instrucciones.",
                        "Código fuente: representación escrita de las instrucciones de un programa.",
                        "Programa: conjunto organizado de instrucciones destinado a realizar una tarea.",
                        "Ejecución: proceso mediante el cual las instrucciones producen acciones y resultados."
                    ]),

                    paragraph(
                        "Es importante distinguir el código fuente de su ejecución. Podemos leer una instrucción escrita sin ejecutarla; ejecutar significa hacer que esa representación produzca realmente el comportamiento indicado."
                    ),

                    paragraph(
                        "En esta ruta utilizaremos CLRS para representar y ejecutar los fundamentos de programación. No necesitas conocer todavía todas sus reglas: por ahora basta con comprender que `escribir` permite expresar una primera acción observable."
                    )
                ],

                examples: [
                    text(
                        "lesson-001-source-execution",
                        [
                            "INTENCIÓN",
                            "",
                            "Mostrar el mensaje Hola",
                            "",
                            "        ↓",
                            "",
                            "CÓDIGO FUENTE",
                            "",
                            "escribir \"Hola\"",
                            "",
                            "        ↓",
                            "",
                            "EJECUCIÓN",
                            "",
                            "        ↓",
                            "",
                            "RESULTADO",
                            "",
                            "Hola"
                        ].join("\n"),
                        "Del código a una acción",
                        "La instrucción escrita representa una acción; durante la ejecución, esa acción produce un resultado observable."
                    ),

                    clrs(
                        "lesson-001-output",
                        'escribir "Hola"',
                        "Una primera instrucción",
                        "La instrucción `escribir` expresa que el valor indicado debe mostrarse. Al ejecutar el programa, el resultado observable es el mensaje \"Hola\"."
                    )
                ],

                knowledge: [
                    "comprender que un programa expresa acciones mediante instrucciones",
                    "reconocer una instrucción de programa",
                    "comprender qué es el código fuente",
                    "comprender qué es un programa",
                    "comprender qué significa ejecutar un programa",
                    "diferenciar código fuente y ejecución",
                    "relacionar una instrucción escrita con una acción observable",
                    "producir una salida básica mediante escribir"
                ],

                notes: [
                    callout(
                        "Otros lenguajes",
                        "La forma exacta de escribir una instrucción cambia entre lenguajes de programación, pero las ideas de instrucción, código fuente, programa y ejecución son conceptos generales que volverás a encontrar en otros lenguajes."
                    )
                ],

                category: "FND-IO"
            }),
            lesson({
                order: 2,
                section: 1,
                title: "De un problema a instrucciones",

                objective:
                    "Comprender que una necesidad puede convertirse primero en una solución formada por pasos ordenados y después representarse mediante instrucciones de un programa.",

                problemStatement:
                    "Un sistema debe comunicar que una tarea comienza, se realiza y termina. ¿Cómo podemos transformar esa necesidad en una serie de acciones que la computadora pueda ejecutar?",

                concepts: [
                    "problema",
                    "solución",
                    "paso",
                    "algoritmo",
                    "implementación"
                ],

                explanation: [
                    paragraph(
                        "En la lección anterior partimos de una acción muy sencilla: queríamos que la computadora mostrara un mensaje y la expresamos mediante una instrucción. Sin embargo, muchos problemas requieren realizar varias acciones para llegar al resultado esperado."
                    ),

                    paragraph(
                        "Antes de escribir esas instrucciones conviene comprender qué queremos conseguir. Un problema representa una necesidad, pregunta o tarea que requiere una solución."
                    ),

                    callout(
                        "Problema de esta lección",
                        [
                            "Necesitamos comunicar:",
                            "",
                            "1. que una tarea comienza",
                            "2. que se está realizando",
                            "3. que ha terminado",
                            "",
                            "¿Qué acciones debe realizar",
                            "el programa y en qué orden?"
                        ].join("\n")
                    ),

                    paragraph(
                        "Una solución describe cómo podemos pasar de la situación inicial al resultado deseado. Para poder representarla mediante un programa, podemos dividirla en pasos: acciones concretas que deben realizarse siguiendo un orden."
                    ),

                    callout(
                        "Del problema a los pasos",
                        [
                            "PROBLEMA",
                            "",
                            "Comunicar el desarrollo",
                            "de una tarea",
                            "",
                            "        →",
                            "",
                            "SOLUCIÓN",
                            "",
                            "1. Mostrar que comienza",
                            "2. Mostrar que se realiza",
                            "3. Mostrar que termina"
                        ].join("\n")
                    ),

                    paragraph(
                        "Cuando una solución se expresa mediante pasos ordenados y suficientemente claros para resolver un problema, podemos hablar de un algoritmo en un sentido introductorio. Por ahora basta con comprenderlo como la descripción organizada de cómo alcanzar un resultado."
                    ),

                    paragraph(
                        "El algoritmo todavía no es necesariamente código. La implementación aparece cuando esos pasos se representan utilizando las reglas de un lenguaje de programación."
                    ),

                    callout(
                        "Algoritmo e implementación",
                        [
                            "ALGORITMO",
                            "",
                            "1. Mostrar el inicio",
                            "2. Mostrar el progreso",
                            "3. Mostrar el final",
                            "",
                            "        → representar",
                            "",
                            "IMPLEMENTACIÓN EN CLRS",
                            "",
                            "escribir \"Proceso iniciado\"",
                            "escribir \"Procesando datos\"",
                            "escribir \"Proceso terminado\""
                        ].join("\n")
                    ),

                    paragraph(
                        "Esto permite que una misma idea de solución pueda representarse posteriormente con lenguajes diferentes. Las instrucciones concretas pueden cambiar, mientras que los pasos que queremos realizar pueden conservarse."
                    ),

                    paragraph(
                        "El orden de los pasos también forma parte de la solución. Si primero indicamos que una tarea terminó y después que comenzó, cada instrucción puede ser válida por separado, pero el resultado completo dejará de representar correctamente lo que queríamos comunicar."
                    ),

                    list([
                        "Problema: necesidad, pregunta o tarea que queremos resolver.",
                        "Solución: manera propuesta de alcanzar el resultado deseado.",
                        "Paso: acción concreta que forma parte de la solución.",
                        "Algoritmo: organización de pasos que describe cómo resolver un problema, presentada aquí de forma introductoria.",
                        "Implementación: representación de esos pasos mediante las reglas de un lenguaje de programación."
                    ]),

                    paragraph(
                        "En esta etapa utilizaremos problemas deliberadamente pequeños. Lo importante todavía no es diseñar algoritmos complejos, sino acostumbrarnos a no comenzar por la sintaxis: primero comprendemos qué debe ocurrir y después escribimos las instrucciones que lo representan."
                    )
                ],

                examples: [
                    text(
                        "lesson-002-problem-solution",
                        [
                            "PROBLEMA",
                            "",
                            "Informar que un proceso",
                            "comienza, se realiza y termina.",
                            "",
                            "        ↓",
                            "",
                            "PASOS DE LA SOLUCIÓN",
                            "",
                            "1. Mostrar que comienza.",
                            "2. Mostrar que se está realizando.",
                            "3. Mostrar que terminó."
                        ].join("\n"),
                        "Pensar antes de programar",
                        "Antes de escribir código identificamos qué acciones son necesarias para producir el resultado esperado."
                    ),

                    clrs(
                        "lesson-002-implementation",
                        [
                            'escribir "Proceso iniciado"',
                            'escribir "Procesando datos"',
                            'escribir "Proceso terminado"'
                        ].join("\n"),
                        "Representar la solución en CLRS",
                        "Cada instrucción representa uno de los pasos previamente identificados. El código es la implementación concreta de esa solución."
                    ),

                    text(
                        "lesson-002-complete-model",
                        [
                            "PROBLEMA",
                            "   ↓",
                            "SOLUCIÓN",
                            "   ↓",
                            "PASOS",
                            "   ↓",
                            "IMPLEMENTACIÓN",
                            "   ↓",
                            "EJECUCIÓN",
                            "   ↓",
                            "RESULTADO"
                        ].join("\n"),
                        "Del problema al resultado",
                        "El código aparece después de comprender la necesidad y organizar una forma de resolverla."
                    )
                ],

                knowledge: [
                    "comprender qué representa un problema en el contexto de programación",
                    "comprender que una solución puede organizarse mediante pasos",
                    "identificar acciones necesarias para resolver una tarea sencilla",
                    "representar una solución como pasos ordenados",
                    "comprender qué es un algoritmo en sentido introductorio",
                    "diferenciar una solución algorítmica de su implementación en código",
                    "relacionar problema, solución, pasos, implementación, ejecución y resultado"
                ],

                notes: [
                    callout(
                        "Profundización posterior",
                        "En esta ruta utilizamos algoritmo como una introducción a la idea de una solución organizada mediante pasos. La ruta de Algoritmia estudiará posteriormente con mayor profundidad qué caracteriza a un algoritmo, cómo se representa, analiza y justifica."
                    ),

                    callout(
                        "Otros lenguajes",
                        "Una misma solución puede implementarse con lenguajes diferentes. La sintaxis cambia, pero el problema y la idea general de los pasos necesarios para resolverlo pueden permanecer."
                    )
                ],

                category: "FND-CONTROL"
            }),
            lesson({
                order: 3,
                section: 1,
                title: "Flujo secuencial",

                objective:
                    "Comprender que, cuando ninguna estructura altera el flujo, las instrucciones se ejecutan una después de otra siguiendo el orden en que aparecen en el programa.",

                problemStatement:
                    "Un programa debe mostrar primero que una tarea inicia, después que está trabajando y finalmente que termina. Si las tres instrucciones existen, ¿por qué también importa el orden en que están escritas?",

                concepts: [
                    "flujo de ejecución",
                    "flujo secuencial",
                    "orden de instrucciones"
                ],

                explanation: [
                    paragraph(
                        "En la lección anterior aprendimos a transformar una tarea en una serie de pasos ordenados. Ahora necesitamos comprender qué ocurre cuando esas instrucciones se ejecutan."
                    ),

                    paragraph(
                        "Cuando ninguna decisión, repetición u otra estructura modifica el recorrido, la ejecución avanza de forma secuencial: comienza en una instrucción, realiza su acción y después continúa con la siguiente."
                    ),

                    callout(
                        "Problema de esta lección",
                        [
                            "Queremos obtener:",
                            "",
                            "Inicio",
                            "Procesando",
                            "Fin",
                            "",
                            "Tenemos las tres instrucciones.",
                            "",
                            "¿Basta con que existan",
                            "o también importa su orden?"
                        ].join("\n")
                    ),

                    paragraph(
                        "La posición de una instrucción dentro del flujo determina cuándo se realiza su acción. Por ello, dos programas pueden utilizar exactamente las mismas instrucciones y producir resultados diferentes únicamente porque las ordenan de otra manera."
                    ),

                    callout(
                        "Flujo secuencial",
                        [
                            "Instrucción 1",
                            "      →",
                            "Instrucción 2",
                            "      →",
                            "Instrucción 3",
                            "      →",
                            "Fin"
                        ].join("\n")
                    ),

                    paragraph(
                        "La computadora no necesita elegir entre estas instrucciones ni repetirlas. Simplemente continúa hacia la siguiente cuando termina la anterior. A este comportamiento básico lo llamamos flujo secuencial."
                    ),

                    paragraph(
                        "Por ejemplo, si queremos comunicar las etapas de una tarea, mostrar primero `Inicio`, después `Procesando` y finalmente `Fin` representa correctamente la secuencia esperada."
                    ),

                    paragraph(
                        "Si cambiamos el orden y mostramos primero `Fin`, las instrucciones continúan siendo válidas individualmente, pero el comportamiento completo ya no representa correctamente el proceso que queríamos comunicar."
                    ),

                    callout(
                        "El orden forma parte del comportamiento",
                        [
                            "Orden esperado:",
                            "",
                            "Inicio",
                            "  →",
                            "Procesando",
                            "  →",
                            "Fin",
                            "",
                            "Orden incorrecto:",
                            "",
                            "Fin",
                            "  →",
                            "Procesando",
                            "  →",
                            "Inicio"
                        ].join("\n")
                    ),

                    paragraph(
                        "Seguir mentalmente el flujo significa preguntarnos qué instrucción se ejecuta ahora y cuál se ejecutará después. Esta habilidad será importante más adelante, cuando el flujo pueda cambiar mediante decisiones y ciclos."
                    ),

                    paragraph(
                        "Por ahora trabajaremos solamente con secuencias. Las estructuras que pueden seleccionar caminos diferentes o repetir instrucciones aparecerán posteriormente."
                    )
                ],

                examples: [
                    text(
                        "lesson-003-flow-model",
                        [
                            "CÓDIGO",
                            "",
                            "Instrucción 1",
                            "      ↓",
                            "Instrucción 2",
                            "      ↓",
                            "Instrucción 3",
                            "",
                            "      ↓",
                            "",
                            "RESULTADO EN EL MISMO ORDEN"
                        ].join("\n"),
                        "Seguir el flujo",
                        "En una secuencia sencilla, podemos seguir la ejecución avanzando de una instrucción a la siguiente."
                    ),

                    clrs(
                        "lesson-003-sequence",
                        [
                            'escribir "Inicio"',
                            'escribir "Procesando"',
                            'escribir "Fin"'
                        ].join("\n"),
                        "Una secuencia correcta",
                        "Las instrucciones se ejecutan de arriba hacia abajo y producen las salidas Inicio, Procesando y Fin en ese mismo orden."
                    ),

                    clrs(
                        "lesson-003-order-change",
                        [
                            'escribir "Fin"',
                            'escribir "Procesando"',
                            'escribir "Inicio"'
                        ].join("\n"),
                        "Las mismas instrucciones, otro resultado",
                        "No hemos cambiado las instrucciones utilizadas, solamente su posición. Como el flujo sigue ese nuevo orden, también cambia la secuencia de salida."
                    ),

                    text(
                        "lesson-003-trace",
                        [
                            "Paso 1",
                            'escribir "Inicio"',
                            "Salida hasta ahora: Inicio",
                            "",
                            "Paso 2",
                            'escribir "Procesando"',
                            "Salida hasta ahora:",
                            "Inicio",
                            "Procesando",
                            "",
                            "Paso 3",
                            'escribir "Fin"',
                            "Salida final:",
                            "Inicio",
                            "Procesando",
                            "Fin"
                        ].join("\n"),
                        "Seguir la ejecución paso a paso",
                        "Observar el estado de la salida después de cada instrucción permite comprender cómo se construye progresivamente el resultado."
                    )
                ],

                knowledge: [
                    "comprender qué es el flujo de ejecución",
                    "comprender el flujo secuencial",
                    "comprender que una instrucción se ejecuta después de finalizar la anterior",
                    "seguir mentalmente una secuencia sencilla de instrucciones",
                    "reconocer que el orden de las instrucciones forma parte del comportamiento del programa",
                    "reconocer que cambiar el orden puede cambiar el resultado observable"
                ],

                notes: [
                    callout(
                        "Otros lenguajes",
                        "La ejecución secuencial es un fundamento general de la programación. La sintaxis cambia entre lenguajes, pero las instrucciones normalmente avanzan en un orden definido mientras ninguna estructura modifique el flujo."
                    )
                ],

                recommendedTools: [
                    "execution-trace"
                ],

                category: "FND-CONTROL"
            }),
            lesson({
                order: 4,
                section: 1,
                title: "Entrada, procesamiento y salida",

                objective:
                    "Comprender el modelo Entrada–Procesamiento–Salida como una forma de identificar qué información utiliza una solución, qué transformación realiza y qué resultado produce.",

                problemStatement:
                    "Queremos comprender cómo un programa pasa de cierta información inicial a un resultado. ¿Cómo podemos distinguir qué información recibe, qué hace con ella y qué produce al final?",

                concepts: [
                    "entrada",
                    "procesamiento",
                    "salida",
                    "transformación"
                ],

                explanation: [
                    paragraph(
                        "Hasta ahora hemos visto que un problema puede convertirse en pasos y que las instrucciones se ejecutan siguiendo un flujo. Ahora podemos observar una solución desde otra perspectiva: preguntándonos con qué información comienza, qué ocurre con ella y qué resultado se obtiene."
                    ),

                    callout(
                        "Problema de esta lección",
                        [
                            "Tenemos una tarea:",
                            "",
                            "obtener el total de dos cantidades.",
                            "",
                            "Sabemos que existen:",
                            "",
                            "• datos iniciales",
                            "• una transformación",
                            "• un resultado",
                            "",
                            "¿Cómo podemos distinguir",
                            "cada una de estas partes?"
                        ].join("\n")
                    ),

                    paragraph(
                        "Una forma sencilla de hacerlo es mediante el modelo Entrada–Procesamiento–Salida. Este modelo permite describir una solución como una transformación que parte de ciertos datos y produce un resultado."
                    ),

                    callout(
                        "Modelo general",
                        [
                            "ENTRADA",
                            "   →",
                            "PROCESAMIENTO",
                            "   →",
                            "SALIDA"
                        ].join("\n")
                    ),

                    paragraph(
                        "La entrada representa la información que la solución necesita para trabajar. Por ejemplo, si queremos obtener la suma de dos cantidades, esas dos cantidades forman parte de la entrada."
                    ),

                    paragraph(
                        "El procesamiento representa lo que debe hacerse con la información disponible. En el ejemplo anterior, el procesamiento consiste en sumar las dos cantidades."
                    ),

                    paragraph(
                        "La salida representa el resultado producido después del procesamiento. Si las cantidades fueran 10 y 15, el resultado de esa transformación sería 25."
                    ),

                    callout(
                        "Una transformación sencilla",
                        [
                            "ENTRADA",
                            "10 y 15",
                            "",
                            "   →",
                            "",
                            "PROCESAMIENTO",
                            "sumar las cantidades",
                            "",
                            "   →",
                            "",
                            "SALIDA",
                            "25"
                        ].join("\n")
                    ),

                    list([
                        "Entrada: información necesaria para realizar una tarea.",
                        "Procesamiento: acciones o transformaciones realizadas sobre la información.",
                        "Salida: resultado obtenido después del procesamiento."
                    ]),

                    paragraph(
                        "El modelo no indica todavía cómo debemos escribir cada parte en un lenguaje de programación. Su propósito es ayudarnos a comprender y organizar la solución antes de preocuparnos por la implementación concreta."
                    ),

                    paragraph(
                        "La entrada tampoco tiene que provenir siempre de una persona. Dependiendo del programa, la información puede proceder de un archivo, de otro sistema, de un dispositivo o encontrarse ya disponible dentro del propio programa."
                    ),

                    paragraph(
                        "De la misma manera, una salida no tiene que aparecer necesariamente en pantalla. Puede almacenarse, enviarse a otro sistema o utilizarse posteriormente como parte de otro procesamiento."
                    ),

                    callout(
                        "Una forma de analizar problemas",
                        [
                            "Cuando observes una tarea, pregunta:",
                            "",
                            "1. ¿Qué información necesito?",
                            "   → ENTRADA",
                            "",
                            "2. ¿Qué debo hacer con ella?",
                            "   → PROCESAMIENTO",
                            "",
                            "3. ¿Qué resultado debo obtener?",
                            "   → SALIDA"
                        ].join("\n")
                    ),

                    paragraph(
                        "Todavía no sabemos recibir datos durante la ejecución ni realizar cálculos mediante variables y operadores. Esos conocimientos aparecerán después. Por ahora utilizaremos `escribir` únicamente para practicar la idea de que un programa puede comunicar información como salida."
                    )
                ],

                examples: [
                    text(
                        "lesson-004-transformation",
                        [
                            "Problema:",
                            "obtener el total de dos cantidades",
                            "",
                            "ENTRADA",
                            "10 y 15",
                            "",
                            "      ↓",
                            "",
                            "PROCESAMIENTO",
                            "sumar",
                            "",
                            "      ↓",
                            "",
                            "SALIDA",
                            "25"
                        ].join("\n"),
                        "Analizar una solución",
                        "Antes de implementar el cálculo podemos identificar qué información necesita la solución, qué transformación realiza y qué resultado debe producir."
                    ),

                    text(
                        "lesson-004-another-problem",
                        [
                            "Problema:",
                            "obtener la longitud de un trayecto",
                            "",
                            "ENTRADA",
                            "distancia inicial y distancia final",
                            "",
                            "PROCESAMIENTO",
                            "obtener la diferencia",
                            "",
                            "SALIDA",
                            "longitud del trayecto"
                        ].join("\n"),
                        "El modelo puede aplicarse a distintos problemas",
                        "Entrada, procesamiento y salida describen funciones dentro de la solución; los datos y las transformaciones concretas cambian según el problema."
                    ),

                    clrs(
                        "lesson-004-output",
                        [
                            'escribir "Resultado"',
                            "escribir 25"
                        ].join("\n"),
                        "Comunicar una salida",
                        "Todavía no calculamos el valor 25 mediante código. Lo utilizamos directamente para observar que una solución puede comunicar un resultado mediante una salida."
                    )
                ],

                knowledge: [
                    "comprender el modelo Entrada–Procesamiento–Salida",
                    "identificar la entrada de una solución sencilla",
                    "identificar el procesamiento de una solución sencilla",
                    "identificar la salida de una solución sencilla",
                    "comprender una solución como una transformación de información",
                    "utilizar Entrada–Procesamiento–Salida como modelo para analizar una tarea",
                    "comprender que entrada, procesamiento y salida no dependen de una sintaxis específica"
                ],

                notes: [
                    callout(
                        "No es una estructura obligatoria",
                        "Entrada–Procesamiento–Salida es un modelo útil para comprender y organizar soluciones. No significa que todos los programas deban estar divididos literalmente en tres bloques de código."
                    ),

                    callout(
                        "Más adelante",
                        "Cuando conozcas variables, entrada de datos y expresiones, podrás implementar las tres etapas de este modelo dentro de programas completos."
                    )
                ],

                category: "FND-IO"
            }),
            lesson({
                order: 5,
                section: 2,
                title: "Datos y valores",

                objective:
                    "Comprender que los programas trabajan con información representada mediante datos y que cada dato puede contener un valor concreto cuyo significado depende del problema.",

                problemStatement:
                    "Un programa debe trabajar con información sobre un pedido: contiene 3 productos, pertenece a \"Ana\" y está pagado. ¿Qué representan esos elementos dentro del programa y qué significado tiene cada uno?",

                concepts: [
                    "dato",
                    "valor",
                    "representación",
                    "significado"
                ],

                explanation: [
                    paragraph(
                        "En la lección anterior vimos que una solución puede recibir información, procesarla y producir resultados. Ahora necesitamos observar con más detalle qué es esa información cuando aparece dentro de un programa."
                    ),

                    callout(
                        "Problema de esta lección",
                        [
                            "Un pedido contiene:",
                            "",
                            "3 productos",
                            "cliente: Ana",
                            "pagado: verdadero",
                            "",
                            "¿Cómo representa un programa",
                            "esta información?"
                        ].join("\n")
                    ),

                    paragraph(
                        "Los programas trabajan con datos. Un dato representa información que puede utilizarse durante la ejecución de una solución."
                    ),

                    paragraph(
                        "El valor es el contenido concreto asociado con esa información. En nuestro ejemplo, `3`, `\"Ana\"` y `VERDAD` representan valores concretos que el programa puede utilizar."
                    ),

                    callout(
                        "Datos del problema",
                        [
                            "Cantidad de productos",
                            "→ 3",
                            "",
                            "Nombre del cliente",
                            "→ \"Ana\"",
                            "",
                            "Pedido pagado",
                            "→ VERDAD"
                        ].join("\n")
                    ),

                    paragraph(
                        "El valor por sí solo no siempre explica qué significa dentro del problema. Por ejemplo, el número `3` podría representar productos, intentos, personas, puntos o cualquier otra cantidad. El contexto nos permite interpretar qué representa."
                    ),

                    callout(
                        "Valor y significado",
                        [
                            "Valor:",
                            "3",
                            "",
                            "En este problema significa:",
                            "3 productos",
                            "",
                            "En otro problema podría significar:",
                            "3 intentos",
                            "3 estudiantes",
                            "3 puntos"
                        ].join("\n")
                    ),

                    paragraph(
                        "Por eso conviene distinguir entre la representación utilizada por el programa y el significado que esa información posee dentro del problema que estamos resolviendo."
                    ),

                    list([
                        "Dato: representación de información que puede utilizar un programa.",
                        "Valor: contenido concreto representado, como 3, \"Ana\" o VERDAD.",
                        "Representación: forma utilizada para expresar información dentro del programa.",
                        "Significado: interpretación que adquiere un dato según el contexto del problema."
                    ]),

                    paragraph(
                        "Los valores pueden representar distintas clases de información. Algunos expresan cantidades, otros expresan texto y otros permiten representar situaciones como verdadero o falso. Más adelante estudiaremos cómo los lenguajes organizan formalmente estas diferencias mediante tipos de datos."
                    ),

                    paragraph(
                        "También aprenderemos posteriormente a dar nombres a los datos y conservar valores para utilizarlos varias veces. Por ahora nos concentraremos únicamente en reconocer la información y los valores concretos con los que trabaja un programa."
                    )
                ],

                examples: [
                    text(
                        "lesson-005-order-data",
                        [
                            "PROBLEMA",
                            "Información de un pedido",
                            "",
                            "Cantidad",
                            "3",
                            "",
                            "Cliente",
                            "Ana",
                            "",
                            "Pagado",
                            "VERDAD"
                        ].join("\n"),
                        "Información y valores",
                        "Cada elemento representa una pieza de información del mismo problema y posee un valor concreto."
                    ),

                    text(
                        "lesson-005-value-context",
                        [
                            "Valor:",
                            "3",
                            "",
                            "Contexto actual:",
                            "cantidad de productos",
                            "",
                            "Significado:",
                            "el pedido contiene 3 productos",
                            "",
                            "El mismo valor podría adquirir",
                            "otro significado en otro problema."
                        ].join("\n"),
                        "El contexto aporta significado",
                        "El programa puede trabajar con el valor 3, pero su interpretación depende de aquello que representa dentro de la solución."
                    ),

                    clrs(
                        "lesson-005-values",
                        [
                            "escribir 3",
                            "escribir \"Ana\"",
                            "escribir VERDAD"
                        ].join("\n"),
                        "Utilizar valores en instrucciones",
                        "Las instrucciones trabajan directamente con los valores del problema. Todavía no necesitamos almacenarlos ni asignarles nombres para poder mostrarlos."
                    )
                ],

                knowledge: [
                    "comprender que los programas trabajan con información representada mediante datos",
                    "comprender qué es un dato",
                    "comprender qué es un valor",
                    "diferenciar dato, valor, representación y significado",
                    "reconocer valores que representan cantidades, texto y estados lógicos de forma introductoria",
                    "comprender que el significado de un valor depende del contexto del problema"
                ],

                notes: [
                    callout(
                        "Más adelante",
                        "Todavía no estamos estudiando formalmente tipos de datos, literales, identificadores ni variables. Estas ideas permitirán precisar cómo se representan, nombran y almacenan los valores en las siguientes lecciones."
                    )
                ],

                category: "FND-DATA"
            }),
            lesson({
                order: 6,
                section: 2,
                title: "Literales",

                objective:
                    "Comprender que un literal es una representación escrita directamente en el código para expresar un valor concreto y reconocer las formas básicas utilizadas por CLRS.",

                problemStatement:
                    "Un programa necesita utilizar directamente tres valores conocidos: una cantidad, el nombre de un producto y si está disponible. ¿Cómo podemos escribir esos valores directamente dentro del código?",

                concepts: [
                    "literal",
                    "literal numérico",
                    "literal de cadena",
                    "literal lógico"
                ],

                explanation: [
                    paragraph(
                        "En la lección anterior aprendimos que los programas trabajan con valores. Ahora necesitamos saber cómo podemos representar directamente uno de esos valores cuando escribimos el código fuente."
                    ),

                    callout(
                        "Problema de esta lección",
                        [
                            "Queremos representar directamente:",
                            "",
                            "Cantidad:",
                            "3",
                            "",
                            "Producto:",
                            "Teclado",
                            "",
                            "Disponible:",
                            "verdadero",
                            "",
                            "¿Cómo escribimos estos valores",
                            "dentro del código?"
                        ].join("\n")
                    ),

                    paragraph(
                        "Cuando escribimos directamente en el código una representación que expresa un valor concreto, utilizamos un literal."
                    ),

                    callout(
                        "Valor y literal",
                        [
                            "VALOR",
                            "contenido que queremos representar",
                            "",
                            "        →",
                            "",
                            "LITERAL",
                            "forma escrita directamente",
                            "en el código"
                        ].join("\n")
                    ),

                    paragraph(
                        "Por ejemplo, el programa puede trabajar con el valor numérico tres. Cuando escribimos directamente `3` dentro del código, esa representación es un literal numérico."
                    ),

                    paragraph(
                        "La misma idea se aplica al texto. El valor textual Teclado puede representarse en CLRS mediante el literal de cadena `\"Teclado\"`. Las comillas permiten delimitar el texto dentro del código; no forman parte del contenido textual representado."
                    ),

                    paragraph(
                        "También podemos representar directamente valores lógicos. CLRS utiliza los literales `VERDAD` y `FALSO` para expresar los dos valores lógicos disponibles."
                    ),

                    callout(
                        "Representar los valores del problema",
                        [
                            "Cantidad",
                            "valor: 3",
                            "literal: 3",
                            "",
                            "Producto",
                            "valor: Teclado",
                            "literal: \"Teclado\"",
                            "",
                            "Disponible",
                            "valor: verdadero",
                            "literal: VERDAD"
                        ].join("\n")
                    ),

                    list([
                        "Literal numérico: representa directamente un valor numérico, como 3, 25 o 3.5.",
                        "Literal de cadena: representa directamente texto delimitado por comillas, como \"Teclado\".",
                        "Literal lógico: representa directamente un valor lógico mediante VERDAD o FALSO."
                    ]),

                    paragraph(
                        "Es importante no utilizar las palabras valor y literal como si significaran exactamente lo mismo. Un valor es aquello que el programa representa y utiliza; literal describe una forma concreta de escribir directamente ese valor dentro del código fuente."
                    ),

                    paragraph(
                        "Además, no todos los valores utilizados por un programa tienen que aparecer como literales. Más adelante podremos obtener valores mediante variables, operaciones, funciones o datos recibidos durante la ejecución."
                    ),

                    paragraph(
                        "Por ahora utilizaremos literales directamente dentro de instrucciones sencillas. Esto permite practicar cómo se representa información concreta antes de aprender a darle nombres y conservarla mediante variables."
                    )
                ],

                examples: [
                    text(
                        "lesson-006-product-values",
                        [
                            "INFORMACIÓN DEL PROBLEMA",
                            "",
                            "Cantidad:",
                            "3",
                            "",
                            "Producto:",
                            "Teclado",
                            "",
                            "Disponible:",
                            "verdadero",
                            "",
                            "        ↓",
                            "",
                            "REPRESENTACIÓN EN EL CÓDIGO",
                            "",
                            "3",
                            "\"Teclado\"",
                            "VERDAD"
                        ].join("\n"),
                        "De valores a literales",
                        "La información del problema se representa mediante formas concretas que pueden escribirse directamente en el código."
                    ),

                    clrs(
                        "lesson-006-literals",
                        [
                            "escribir 3",
                            'escribir "Teclado"',
                            "escribir VERDAD"
                        ].join("\n"),
                        "Utilizar literales directamente",
                        "Cada instrucción utiliza un literal escrito directamente en el código: uno numérico, uno de cadena y uno lógico."
                    ),

                    text(
                        "lesson-006-value-vs-literal",
                        [
                            "Contenido textual:",
                            "Teclado",
                            "",
                            "Literal en el código:",
                            "\"Teclado\"",
                            "",
                            "Las comillas permiten representar",
                            "el texto dentro del código.",
                            "",
                            "El contenido representado sigue siendo:",
                            "Teclado"
                        ].join("\n"),
                        "El literal es una representación",
                        "El valor textual y la forma utilizada para escribirlo en el código deben distinguirse conceptualmente."
                    )
                ],

                knowledge: [
                    "comprender qué es un literal",
                    "diferenciar un valor de su representación literal",
                    "reconocer literales numéricos",
                    "reconocer literales de cadena",
                    "reconocer literales lógicos",
                    "utilizar literales directamente dentro de instrucciones sencillas",
                    "comprender que no todos los valores utilizados por un programa tienen que provenir de literales"
                ],

                notes: [
                    callout(
                        "Otros lenguajes",
                        "Los lenguajes pueden admitir otras clases y formas de literales, como caracteres, valores nulos, colecciones u otras construcciones. En esta ruta nos concentraremos únicamente en las representaciones necesarias para los fundamentos trabajados con CLRS."
                    )
                ],

                category: "FND-DATA"
            }),
            lesson({
                order: 7,
                section: 2,
                title: "Identificadores",

                objective:
                    "Comprender que un identificador es un nombre utilizado para reconocer elementos de un programa y que elegir nombres descriptivos ayuda a expresar qué representa cada elemento dentro de una solución.",

                problemStatement:
                    "Un programa trabaja con información sobre la edad, el precio y la cantidad de productos. Si utilizamos nombres como x, y y z, ¿cómo podemos saber con facilidad qué representa cada elemento?",

                concepts: [
                    "identificador",
                    "nombre descriptivo",
                    "nomenclatura"
                ],

                explanation: [
                    paragraph(
                        "En la lección anterior aprendimos a representar directamente valores mediante literales. Sin embargo, cuando una solución comienza a manejar varios elementos, necesitamos una forma de reconocer qué representa cada uno."
                    ),

                    callout(
                        "Problema de esta lección",
                        [
                            "Tenemos tres elementos:",
                            "",
                            "x",
                            "y",
                            "z",
                            "",
                            "Uno representa una edad.",
                            "Otro representa un precio.",
                            "Otro representa una cantidad.",
                            "",
                            "¿Podemos saber cuál es cuál",
                            "solamente leyendo esos nombres?"
                        ].join("\n")
                    ),

                    paragraph(
                        "Para reconocer elementos dentro de un programa utilizamos identificadores. Un identificador es un nombre que permite distinguir y referirse a un elemento del código."
                    ),

                    paragraph(
                        "Todavía no necesitamos utilizar identificadores dentro de variables reales. Primero debemos comprender para qué sirven como nombres. Más adelante veremos cómo pueden identificar variables, funciones y otros elementos del programa."
                    ),

                    callout(
                        "Nombrar un elemento",
                        [
                            "Elemento del programa",
                            "        →",
                            "identificador",
                            "        →",
                            "nombre que permite",
                            "reconocerlo"
                        ].join("\n")
                    ),

                    paragraph(
                        "Un identificador puede ser corto y aun así ser válido, pero un nombre descriptivo comunica mejor qué representa el elemento dentro del problema."
                    ),

                    callout(
                        "El nombre comunica significado",
                        [
                            "x",
                            "→ no explica claramente qué representa",
                            "",
                            "edad",
                            "→ comunica que el elemento",
                            "   representa una edad",
                            "",
                            "p",
                            "→ poco significado",
                            "",
                            "precioTotal",
                            "→ comunica una intención más clara"
                        ].join("\n")
                    ),

                    paragraph(
                        "Esto se relaciona con una idea que ya conocemos: el mismo valor puede tener significados diferentes dependiendo del contexto. Un identificador descriptivo ayuda a expresar ese contexto dentro del código."
                    ),

                    paragraph(
                        "Por ejemplo, el valor `25` podría representar una edad, una cantidad de productos, puntos o una temperatura. Nombres como `edad`, `cantidadProductos`, `puntos` o `temperatura` permiten distinguir esas interpretaciones."
                    ),

                    callout(
                        "Valor e identificador no son lo mismo",
                        [
                            "IDENTIFICADOR",
                            "edad",
                            "",
                            "        → identifica",
                            "",
                            "VALOR",
                            "25",
                            "",
                            "El nombre ayuda a expresar",
                            "qué representa el valor."
                        ].join("\n")
                    ),

                    paragraph(
                        "Elegir nombres claros no cambia por sí mismo el resultado que produce un programa. Su propósito es hacer que la solución sea más fácil de leer, comprender y mantener."
                    ),

                    list([
                        "Identificador: nombre utilizado para reconocer un elemento dentro de un programa.",
                        "Nombre descriptivo: identificador que comunica con claridad qué representa o cuál es el propósito de un elemento.",
                        "Nomenclatura: forma utilizada para construir y organizar los nombres dentro del código."
                    ]),

                    paragraph(
                        "Los lenguajes establecen reglas sobre qué formas pueden utilizarse como identificadores y los equipos también pueden adoptar convenciones para escribir nombres de manera consistente. No es necesario memorizar ahora todas esas reglas: lo importante es comprender que una convención de escritura y una regla obligatoria del lenguaje no son lo mismo."
                    ),

                    callout(
                        "Convención y regla",
                        [
                            "CONVENCIÓN",
                            "forma recomendada de escribir nombres",
                            "",
                            "≠",
                            "",
                            "REGLA DEL LENGUAJE",
                            "condición que determina",
                            "si un nombre es válido"
                        ].join("\n")
                    ),

                    paragraph(
                        "En las siguientes lecciones comenzaremos a utilizar identificadores de manera concreta para dar nombres a valores dentro de un programa."
                    )
                ],

                examples: [
                    text(
                        "lesson-007-naming-problem",
                        [
                            "Información del problema:",
                            "",
                            "25 años",
                            "120 pesos",
                            "4 productos",
                            "",
                            "Nombres poco descriptivos:",
                            "",
                            "x",
                            "y",
                            "z",
                            "",
                            "Nombres más descriptivos:",
                            "",
                            "edad",
                            "precio",
                            "cantidadProductos"
                        ].join("\n"),
                        "Dar significado mediante nombres",
                        "Los nombres descriptivos permiten reconocer con mayor facilidad qué representa cada elemento dentro de la solución."
                    ),

                    text(
                        "lesson-007-value-identifier",
                        [
                            "VALOR",
                            "25",
                            "",
                            "Puede representar:",
                            "",
                            "edad",
                            "cantidadProductos",
                            "puntos",
                            "temperatura",
                            "",
                            "El valor no cambia.",
                            "El identificador expresa",
                            "qué significa en el problema."
                        ].join("\n"),
                        "Identificador y contexto",
                        "Un identificador ayuda a comunicar la interpretación que tiene un dato dentro de una solución."
                    ),

                    text(
                        "lesson-007-conventions",
                        [
                            "Ejemplos de nombres con varias palabras:",
                            "",
                            "camelCase",
                            "cantidadProductos",
                            "",
                            "snake_case",
                            "cantidad_productos",
                            "",
                            "PascalCase",
                            "CantidadProductos",
                            "",
                            "Los lenguajes y proyectos",
                            "pueden utilizar convenciones distintas."
                        ].join("\n"),
                        "Distintas formas de escribir nombres",
                        "Las convenciones ayudan a mantener consistencia, pero no determinan por sí mismas qué identificadores acepta un lenguaje."
                    )
                ],

                knowledge: [
                    "comprender qué es un identificador",
                    "comprender que un identificador permite reconocer un elemento de un programa",
                    "diferenciar identificador y valor",
                    "comprender cómo un nombre puede aportar contexto a un valor",
                    "reconocer la utilidad de los nombres descriptivos",
                    "elegir identificadores que comuniquen el propósito de un elemento",
                    "diferenciar una convención de nomenclatura de una regla del lenguaje"
                ],

                notes: [
                    callout(
                        "Convenciones en otros lenguajes",
                        "Lenguajes y comunidades diferentes pueden preferir convenciones como camelCase, snake_case o PascalCase. Estas diferencias son secundarias frente al principio general: utilizar nombres que comuniquen claramente el propósito de los elementos."
                    )
                ],

                category: "FND-DATA"
            }),
            lesson({
                order: 8,
                section: 2,
                title: "Variables",

                objective:
                    "Comprender que una variable permite asociar un identificador con un valor para poder utilizar ese valor posteriormente dentro del programa.",

                problemStatement:
                    "Un programa necesita utilizar varias veces la edad de una persona. En lugar de escribir directamente el valor cada vez, ¿cómo podemos darle un nombre y utilizarlo posteriormente?",

                concepts: [
                    "variable",
                    "identificador",
                    "valor"
                ],

                explanation: [
                    paragraph(
                        "En la lección anterior aprendimos que un identificador permite dar nombre a un elemento del programa. Ahora podemos utilizar esa idea para conservar un valor y referirnos a él mediante un nombre."
                    ),

                    callout(
                        "Problema de esta lección",
                        [
                            "Necesitamos utilizar la edad:",
                            "",
                            "20",
                            "",
                            "en diferentes partes del programa.",
                            "",
                            "¿Tenemos que escribir siempre",
                            "directamente el valor 20?",
                            "",
                            "¿O podemos darle un nombre?"
                        ].join("\n")
                    ),

                    paragraph(
                        "Una variable permite asociar un identificador con un valor. El identificador proporciona un nombre mediante el cual podemos volver a utilizar el valor dentro del programa."
                    ),

                    callout(
                        "Una variable relaciona",
                        [
                            "IDENTIFICADOR",
                            "edad",
                            "",
                            "        →",
                            "",
                            "VALOR",
                            "20"
                        ].join("\n")
                    ),

                    paragraph(
                        "En CLRS podemos escribir `edad = 20` para establecer que el identificador `edad` está relacionado con el valor `20`. Después podemos utilizar `edad` en otras instrucciones en lugar de escribir nuevamente el valor directamente."
                    ),


                    paragraph(
                        "Es importante distinguir los elementos que aparecen en esta instrucción. `edad` es el identificador utilizado como nombre de la variable, mientras que `20` es el valor que queda asociado con ella."
                    ),

                    callout(
                        "Identificador, variable y valor",
                        [
                            "edad = 20",
                            "",
                            "edad",
                            "→ identificador",
                            "",
                            "edad relacionada con un valor",
                            "→ variable",
                            "",
                            "20",
                            "→ valor"
                        ].join("\n")
                    ),

                    paragraph(
                        "Una ventaja de utilizar una variable es que el valor puede emplearse varias veces a través del mismo nombre. De esta manera, las instrucciones pueden expresar con mayor claridad qué información están utilizando."
                    ),


                    paragraph(
                        "El nombre de una variable también aporta contexto. `edad` comunica mejor qué representa el valor que un nombre poco descriptivo como `x`, aplicando lo aprendido sobre identificadores."
                    ),

                    paragraph(
                        "En esta lección nos concentraremos en la relación entre nombre y valor. En las siguientes estudiaremos con mayor precisión qué ocurre cuando una variable aparece por primera vez, cómo se le asignan valores y cómo esos valores pueden cambiar durante la ejecución."
                    )
                ],

                examples: [
                    text(
                        "lesson-008-from-literal-to-variable",
                        [
                            "VALOR",
                            "20",
                            "",
                            "        ↓",
                            "",
                            "queremos conservarlo",
                            "y utilizarlo mediante un nombre",
                            "",
                            "        ↓",
                            "",
                            "VARIABLE",
                            "",
                            "edad = 20",
                            "",
                            "        ↓",
                            "",
                            "escribir edad"
                        ].join("\n"),
                        "Del valor a la variable",
                        "La variable permite utilizar un identificador para referirnos posteriormente al valor asociado."
                    ),

                    clrs(
                        "lesson-008-variable",
                        [
                            "edad = 20",
                            "escribir edad"
                        ].join("\n"),
                        "Nombre y valor",
                        "`edad` es el identificador utilizado por la variable y `20` es el valor asociado. Al escribir `edad`, el programa utiliza ese valor."
                    ),

                    clrs(
                        "lesson-008-descriptive-names",
                        [
                            "edad = 20",
                            "cantidadProductos = 3",
                            "nombreCliente = \"Ana\"",
                            "",
                            "escribir edad",
                            "escribir cantidadProductos",
                            "escribir nombreCliente"
                        ].join("\n"),
                        "Varias variables",
                        "Cada variable utiliza un identificador descriptivo para conservar y reutilizar un valor relacionado con el problema."
                    )
                ],

                knowledge: [
                    "comprender qué es una variable",
                    "comprender que una variable relaciona un identificador con un valor",
                    "diferenciar identificador, variable y valor",
                    "utilizar un identificador para acceder posteriormente al valor asociado",
                    "comprender que una variable permite reutilizar un valor",
                    "utilizar nombres descriptivos para representar información mediante variables"
                ],

                notes: [
                    callout(
                        "Lo estudiaremos después",
                        "En esta lección `edad = 20` se utiliza para observar la relación entre nombre y valor. La declaración, inicialización y asignación se estudiarán específicamente en la siguiente lección, mientras que el cambio de valores y la mutabilidad se estudiarán posteriormente."
                    )
                ],

                category: "FND-DATA"
            }),
            lesson({
                order: 9,
                section: 2,
                title:
                    "Declaración, inicialización y asignación",

                objective:
                    "Distinguir declaración, inicialización, asignación y reasignación, comprendiendo qué ocurre cuando una variable recibe su primer valor y cuando posteriormente recibe uno nuevo en CLRS.",

                problemStatement:
                    "Un programa necesita registrar un estado que comienza como \"Pendiente\" y posteriormente cambia a \"Completado\". ¿Qué ocurre cuando el nombre aparece por primera vez y qué cambia cuando volvemos a asignarle otro valor?",

                concepts: [
                    "declaración",
                    "inicialización",
                    "asignación",
                    "reasignación"
                ],

                explanation: [
                    paragraph(
                        "En la lección anterior utilizamos variables relacionando un identificador con un valor. Ahora vamos a observar con mayor precisión qué ocurre cuando esa relación se establece por primera vez y qué ocurre cuando posteriormente utilizamos la misma variable otra vez."
                    ),

                    callout(
                        "Problema de esta lección",
                        [
                            "Un proceso comienza con:",
                            "",
                            "estado → Pendiente",
                            "",
                            "y después debe convertirse en:",
                            "",
                            "estado → Completado",
                            "",
                            "¿Es lo mismo establecer",
                            "el primer valor que",
                            "cambiarlo posteriormente?"
                        ].join("\n")
                    ),

                    paragraph(
                        "La declaración es el momento en que una variable y su identificador pasan a formar parte del programa. Algunos lenguajes utilizan una construcción específica para declarar variables; CLRS utiliza un modelo más sencillo."
                    ),

                    paragraph(
                        "En CLRS, cuando asignamos por primera vez un valor a un identificador, esa primera asignación introduce implícitamente la variable. Por ello no necesitamos escribir una declaración separada."
                    ),

                    paragraph(
                        "La inicialización consiste en proporcionar a una variable su primer valor. Como CLRS introduce la variable mediante su primera asignación, declaración implícita e inicialización ocurren juntas."
                    ),

                    callout(
                        "Primera asignación",
                        [
                            "estado = \"Pendiente\"",
                            "",
                            "        →",
                            "",
                            "declaración implícita",
                            "+",
                            "inicialización",
                            "+",
                            "asignación"
                        ].join("\n")
                    ),

                    paragraph(
                        "La asignación es la operación mediante la cual establecemos un valor para una variable. En CLRS utilizamos el operador `=` para representar esta operación."
                    ),

                    paragraph(
                        "Si posteriormente utilizamos `=` sobre una variable que ya existe, ya no estamos introduciendo una nueva variable ni proporcionando su primer valor. Estamos realizando otra asignación sobre la misma variable."
                    ),

                    paragraph(
                        "Cuando una variable que ya tenía un valor recibe uno nuevo, hablamos de reasignación."
                    ),

                    callout(
                        "Asignación posterior",
                        [
                            "estado = \"Completado\"",
                            "",
                            "        →",
                            "",
                            "la variable ya existe",
                            "",
                            "        →",
                            "",
                            "reasignación"
                        ].join("\n")
                    ),

                    list([
                        "Declaración: introduce una variable y su identificador en el programa.",
                        "Inicialización: proporciona a una variable su primer valor.",
                        "Asignación: establece un valor para una variable mediante `=`.",
                        "Reasignación: asigna un nuevo valor a una variable que ya había sido inicializada."
                    ]),

                    paragraph(
                        "Por tanto, una misma instrucción puede participar en más de un concepto. En `estado = \"Pendiente\"`, la operación es una asignación y, como es la primera vez que aparece esa variable, también produce su declaración implícita e inicialización."
                    ),

                    paragraph(
                        "En cambio, en `estado = \"Completado\"` seguimos utilizando una asignación, pero ahora se trata específicamente de una reasignación porque `estado` ya tenía un valor."
                    ),

                    callout(
                        "No confundir = con ==",
                        "En CLRS, `=` establece un valor en una variable. Más adelante utilizaremos `==` para preguntar si dos valores son iguales. Asignar y comparar son operaciones diferentes."
                    ),

                    paragraph(
                        "Por ahora nos interesa reconocer cuándo aparece una variable por primera vez y cuándo vuelve a recibir un valor. En la siguiente lección estudiaremos con más detalle qué significa para la ejecución que ese valor pueda ir cambiando con el tiempo."
                    )
                ],

                examples: [
                    text(
                        "lesson-009-operation-model",
                        [
                            "PRIMERA VEZ",
                            "",
                            "estado = \"Pendiente\"",
                            "",
                            "declaración implícita",
                            "+",
                            "inicialización",
                            "+",
                            "asignación",
                            "",
                            "        ↓",
                            "",
                            "DESPUÉS",
                            "",
                            "estado = \"Completado\"",
                            "",
                            "reasignación"
                        ].join("\n"),
                        "No todas las asignaciones representan el mismo momento",
                        "La primera asignación introduce la variable y establece su valor inicial. Una asignación posterior reutiliza esa misma variable."
                    ),

                    clrs(
                        "lesson-009-status",
                        [
                            'estado = "Pendiente"',
                            "escribir estado",
                            "",
                            'estado = "Completado"',
                            "escribir estado"
                        ].join("\n"),
                        "Del valor inicial a una reasignación",
                        "La primera asignación declara implícitamente `estado` y lo inicializa. La segunda conserva el mismo identificador, pero establece un nuevo valor."
                    ),

                    clrs(
                        "lesson-009-number",
                        [
                            "puntos = 10",
                            "escribir puntos",
                            "",
                            "puntos = 15",
                            "escribir puntos"
                        ].join("\n"),
                        "La misma idea con un valor numérico",
                        "`puntos` recibe primero el valor 10 y posteriormente el valor 15. La segunda asignación no crea otra variable llamada `puntos`."
                    )
                ],

                knowledge: [
                    "comprender qué es una declaración de variable",
                    "comprender qué es la inicialización de una variable",
                    "comprender qué es una asignación",
                    "comprender qué es una reasignación",
                    "diferenciar declaración, inicialización, asignación y reasignación",
                    "comprender que la primera asignación declara implícitamente una variable en CLRS",
                    "reconocer que una asignación posterior reutiliza la misma variable",
                    "comprender que = representa asignación en CLRS",
                    "distinguir de forma introductoria la asignación = de la comparación =="
                ],

                notes: [
                    callout(
                        "Otros lenguajes",
                        "Algunos lenguajes separan explícitamente la declaración de una variable de su inicialización, mientras que otros permiten combinarlas. CLRS simplifica este proceso: la primera asignación introduce implícitamente la variable y establece su valor inicial."
                    )
                ],

                category: "FND-DATA"
            }),
            lesson({
                order: 10,
                section: 2,
                title: "Mutabilidad y estado",

                objective:
                    "Comprender que el estado de un programa describe los valores existentes en un momento de la ejecución y que una variable mutable puede recibir nuevos valores, produciendo cambios en ese estado.",

                problemStatement:
                    "Una puntuación comienza en 10, posteriormente pasa a 15 y finalmente a 25. ¿Cómo puede una misma variable representar esa información mientras su valor cambia durante la ejecución?",

                concepts: [
                    "estado",
                    "mutabilidad",
                    "cambio de estado"
                ],

                explanation: [
                    paragraph(
                        "En la lección anterior vimos que una variable puede recibir una asignación inicial y posteriormente ser reasignada. Ahora necesitamos comprender qué significa ese cambio mientras el programa se está ejecutando."
                    ),

                    callout(
                        "Problema de esta lección",
                        [
                            "La puntuación cambia durante una partida:",
                            "",
                            "10",
                            "→",
                            "15",
                            "→",
                            "25",
                            "",
                            "La información sigue siendo",
                            "la misma puntuación.",
                            "",
                            "¿Cómo representamos sus",
                            "distintos valores en el tiempo?"
                        ].join("\n")
                    ),

                    paragraph(
                        "En un momento determinado de la ejecución, cada variable posee un valor actual. Los valores que existen en ese instante forman parte del estado del programa."
                    ),

                    paragraph(
                        "Podemos imaginar el estado como una fotografía tomada durante la ejecución. Esa fotografía nos permite responder preguntas como: ¿qué valor tiene `puntos` en este momento?, ¿qué valor tiene otra variable?, ¿qué información conserva actualmente el programa?"
                    ),

                    callout(
                        "Estado como una fotografía",
                        [
                            "Momento 1",
                            "",
                            "puntos → 10",
                            "",
                            "        → cambia",
                            "",
                            "Momento 2",
                            "",
                            "puntos → 15",
                            "",
                            "        → cambia",
                            "",
                            "Momento 3",
                            "",
                            "puntos → 25"
                        ].join("\n")
                    ),

                    paragraph(
                        "Una variable es mutable cuando el valor asociado con ella puede modificarse durante la ejecución. Las variables de CLRS son mutables, por lo que una misma variable puede recibir valores diferentes mediante reasignaciones."
                    ),

                    paragraph(
                        "El identificador puede permanecer igual mientras cambia el valor asociado. En nuestro problema seguimos hablando de la variable `puntos`; no necesitamos crear una variable distinta para representar cada momento."
                    ),


                    paragraph(
                        "Cuando `puntos` pasa de 10 a 15, el valor actual de esa variable deja de ser 10 y pasa a ser 15. Una reasignación no crea otra variable con el mismo nombre: modifica el valor asociado con la variable existente."
                    ),

                    callout(
                        "Cambio de estado",
                        [
                            "ANTES",
                            "",
                            "puntos → 10",
                            "",
                            "puntos = 15",
                            "",
                            "DESPUÉS",
                            "",
                            "puntos → 15"
                        ].join("\n")
                    ),

                    list([
                        "Estado: valores actuales que forman parte del programa en un momento determinado de la ejecución.",
                        "Mutabilidad: capacidad de una variable para recibir un valor diferente durante la ejecución.",
                        "Cambio de estado: modificación de uno o más valores actuales del programa."
                    ]),

                    paragraph(
                        "Seguir los cambios de estado permite comprender cómo evoluciona un programa. Cuando una solución produce un resultado incorrecto, una pregunta útil consiste en observar qué valor tenía cada variable antes y después de ejecutar una instrucción."
                    ),

                    paragraph(
                        "Más adelante utilizaremos esta misma idea para construir resultados progresivamente. Los contadores y acumuladores, por ejemplo, dependen de variables cuyo estado cambia repetidamente mientras se ejecuta un ciclo."
                    )
                ],

                examples: [
                    text(
                        "lesson-010-state-sequence",
                        [
                            "Momento 1",
                            "puntos → 10",
                            "",
                            "Momento 2",
                            "puntos → 15",
                            "",
                            "Momento 3",
                            "puntos → 25",
                            "",
                            "Mismo identificador",
                            "↓",
                            "distintos valores actuales"
                        ].join("\n"),
                        "El estado cambia con el tiempo",
                        "Observar la variable en distintos momentos permite distinguir el identificador permanente del valor que posee actualmente."
                    ),

                    clrs(
                        "lesson-010-state",
                        [
                            "puntos = 10",
                            "escribir puntos",
                            "",
                            "puntos = 15",
                            "escribir puntos",
                            "",
                            "puntos = 25",
                            "escribir puntos"
                        ].join("\n"),
                        "Observar los cambios",
                        "Cada salida permite observar el valor actual de `puntos` después de cada asignación."
                    ),

                    text(
                        "lesson-010-trace",
                        [
                            "Después de:",
                            "puntos = 10",
                            "",
                            "Estado:",
                            "puntos → 10",
                            "",
                            "Después de:",
                            "puntos = 15",
                            "",
                            "Estado:",
                            "puntos → 15",
                            "",
                            "Después de:",
                            "puntos = 25",
                            "",
                            "Estado:",
                            "puntos → 25"
                        ].join("\n"),
                        "Seguir el estado paso a paso",
                        "Una traza permite relacionar cada instrucción ejecutada con el estado resultante de la variable."
                    ),

                    clrs(
                        "lesson-010-changing-state",
                        [
                            "puntos = 10",
                            "escribir puntos",
                            "",
                            "puntos = 15",
                            "escribir puntos",
                            "",
                            "puntos = 25",
                            "escribir puntos"
                        ].join("\n"),
                        "Una variable, distintos estados",
                        "El identificador `puntos` permanece igual. Cada reasignación modifica su valor actual y, por tanto, cambia el estado del programa."
                    ),
                ],

                knowledge: [
                    "comprender qué significa estado durante la ejecución de un programa",
                    "interpretar el estado como los valores actuales existentes en un momento determinado",
                    "comprender qué significa que una variable sea mutable",
                    "comprender que una misma variable puede poseer distintos valores en diferentes momentos",
                    "reconocer una reasignación como una operación que produce un cambio de estado",
                    "distinguir el identificador de una variable de su valor actual",
                    "seguir una secuencia sencilla de cambios de estado"
                ],

                notes: [
                    callout(
                        "Transferencia a otros lenguajes",
                        "La mutabilidad aparece de diferentes maneras según el lenguaje. Algunos también ofrecen construcciones para impedir que determinados valores sean reasignados. En CLRS nos concentraremos en variables mutables para comprender cómo evoluciona el estado de un programa."
                    )
                ],

                recommendedTools: [
                    "execution-trace",
                    "debugger"
                ],

                category: "FND-DATA"
            }),
            lesson({
                order: 11,
                section: 2,
                title: "Tipos de datos y sistemas de tipos",

                objective:
                    "Comprender que los valores pertenecen a diferentes tipos de datos, que esas diferencias determinan qué representan y cómo pueden utilizarse, y reconocer de forma introductoria que los lenguajes establecen distintas reglas para trabajar con los tipos.",

                problemStatement:
                    "Un programa necesita representar la edad de una persona, su nombre y si su cuenta está activa. Aunque los tres son valores, ¿por qué no representan la misma clase de información y cómo distingue un lenguaje esas diferencias?",

                concepts: [
                    "tipo de dato",
                    "sistema de tipos",
                    "tipado dinámico",
                    "tipado estático",
                    "tipado fuerte",
                    "tipado débil",
                    "inferencia de tipos"
                ],

                explanation: [
                    paragraph(
                        "Durante esta sección hemos trabajado con números, texto y valores lógicos. Todos ellos permiten representar información, pero no representan la misma clase de contenido. Para distinguir estas diferencias utilizamos la idea de tipo de dato."
                    ),

                    callout(
                        "Problema de esta lección",
                        [
                            "Una cuenta contiene:",
                            "",
                            "edad → 25",
                            "nombre → \"Ana\"",
                            "activa → VERDAD",
                            "",
                            "Los tres son valores.",
                            "",
                            "¿Representan la misma",
                            "clase de información?"
                        ].join("\n")
                    ),

                    paragraph(
                        "Un tipo de dato describe una clase de valores y permite establecer qué clase de información representan y qué formas de utilizarlos tienen sentido."
                    ),

                    callout(
                        "El tipo clasifica el valor",
                        [
                            "25",
                            "→",
                            "NÚMERO",
                            "",
                            "\"Ana\"",
                            "→",
                            "CADENA",
                            "",
                            "VERDAD",
                            "→",
                            "LÓGICO"
                        ].join("\n")
                    ),

                    paragraph(
                        "Los valores numéricos representan cantidades o magnitudes. Las cadenas representan texto formado por caracteres. Los valores lógicos permiten representar dos estados fundamentales: verdadero y falso."
                    ),

                    list([
                        "Número: representa información numérica, como 25 o 19.5.",
                        "Cadena: representa información textual, como \"Ana\" o \"México\".",
                        "Lógico: representa uno de los valores VERDAD o FALSO."
                    ]),

                    paragraph(
                        "El tipo no depende solamente de lo que un valor parece significar para una persona. Por ejemplo, `\"25\"` y `25` pueden resultar visualmente parecidos, pero el primero representa texto y el segundo representa un número."
                    ),

                    callout(
                        "Contenido parecido, tipos diferentes",
                        [
                            "25",
                            "→ número",
                            "",
                            "\"25\"",
                            "→ cadena",
                            "",
                            "El contenido visible puede parecer",
                            "similar, pero el programa los",
                            "trata como clases de valores distintas."
                        ].join("\n")
                    ),

                    paragraph(
                        "Las diferencias entre tipos también importan porque no todas las operaciones tienen el mismo significado para todos los valores. Una operación apropiada para números puede no tener sentido para un valor lógico, mientras que una operación diseñada para texto responde a otra clase de información."
                    ),

                    paragraph(
                        "Además de los tipos individuales, un lenguaje posee reglas que determinan cómo se clasifican y utilizan esos valores. Al conjunto de estas reglas lo llamamos sistema de tipos."
                    ),

                    callout(
                        "Dos niveles diferentes",
                        [
                            "TIPO DE DATO",
                            "¿Qué clase de valor es?",
                            "",
                            "25 → número",
                            "\"Ana\" → cadena",
                            "VERDAD → lógico",
                            "",
                            "        →",
                            "",
                            "SISTEMA DE TIPOS",
                            "¿Qué reglas utiliza el lenguaje",
                            "para trabajar con esas clases?"
                        ].join("\n")
                    ),

                    paragraph(
                        "Una característica que permite comparar sistemas de tipos es el momento en que se establecen o comprueban los tipos. De manera introductoria, hablamos de tipado estático cuando gran parte de estas comprobaciones ocurre antes de ejecutar el programa, y de tipado dinámico cuando el tipo de los valores se determina principalmente durante la ejecución."
                    ),

                    callout(
                        "Estático y dinámico",
                        [
                            "TIPADO ESTÁTICO",
                            "",
                            "los tipos se establecen o",
                            "comprueban principalmente",
                            "antes de la ejecución",
                            "",
                            "TIPADO DINÁMICO",
                            "",
                            "los tipos se determinan",
                            "principalmente durante",
                            "la ejecución"
                        ].join("\n")
                    ),

                    paragraph(
                        "CLRS utiliza un modelo dinámico. No necesitamos escribir un tipo junto al identificador cuando creamos una variable, y una misma variable puede recibir valores de tipos diferentes en distintos momentos."
                    ),


                    paragraph(
                        "También se utilizan las expresiones tipado fuerte y tipado débil para describir, de forma general, qué tan libremente permite un lenguaje combinar o convertir valores de tipos diferentes. Estas expresiones no poseen una única definición formal compartida por todos los lenguajes, por lo que deben interpretarse con cuidado."
                    ),

                    paragraph(
                        "Para esta ruta consideraremos CLRS dinámico y débilmente tipado: sus reglas permiten trabajar con tipos sin declaraciones explícitas y admiten determinadas conversiones o interacciones entre valores con mayor flexibilidad que sistemas más restrictivos."
                    ),

                    paragraph(
                        "Por último, algunos lenguajes pueden deducir un tipo sin que el programador lo escriba explícitamente. A esta capacidad la llamamos inferencia de tipos. Inferir un tipo no significa necesariamente que el lenguaje sea dinámico: un lenguaje puede inferir tipos y aun así utilizar un sistema de tipos estático."
                    ),

                    callout(
                        "No confundir",
                        [
                            "TIPADO DINÁMICO",
                            "→ cuándo se determina o comprueba",
                            "  el tipo durante la ejecución",
                            "",
                            "INFERENCIA",
                            "→ el lenguaje deduce un tipo",
                            "  sin que tengamos que escribirlo",
                            "",
                            "Son propiedades diferentes."
                        ].join("\n")
                    ),

                    paragraph(
                        "No necesitamos dominar todavía todas las diferencias entre sistemas de tipos. Lo importante es reconocer que número, cadena y lógico son clases distintas de valores y comprender que cada lenguaje establece reglas propias para trabajar con ellas."
                    )
                ],

                examples: [
                    clrs(
                        "lesson-011-account-data",
                        [
                            "edad = 25",
                            'nombre = "Ana"',
                            "activa = VERDAD",
                            "",
                            "escribir edad",
                            "escribir nombre",
                            "escribir activa"
                        ].join("\n"),
                        "Una situación, diferentes tipos",
                        "`edad` utiliza un valor numérico, `nombre` una cadena y `activa` un valor lógico. Cada tipo permite representar una clase diferente de información dentro del mismo problema."
                    ),

                    text(
                        "lesson-011-number-vs-string",
                        [
                            "25",
                            "↓",
                            "número",
                            "",
                            "\"25\"",
                            "↓",
                            "cadena",
                            "",
                            "Aunque ambos contienen",
                            "los caracteres 2 y 5 al observarlos,",
                            "representan clases de valores diferentes."
                        ].join("\n"),
                        "El tipo forma parte de la representación",
                        "Un valor numérico y una cadena que contiene dígitos no deben considerarse automáticamente equivalentes."
                    ),

                    clrs(
                        "lesson-011-dynamic",
                        [
                            "dato = 25",
                            "escribir dato",
                            "",
                            'dato = "Ana"',
                            "escribir dato",
                            "",
                            "dato = VERDAD",
                            "escribir dato"
                        ].join("\n"),
                        "Tipos diferentes en distintos momentos",
                        "CLRS permite que la misma variable utilice valores numéricos, de cadena y lógicos durante diferentes momentos de la ejecución."
                    ),

                    clrs(
                        "lesson-011-dynamic-variable",
                        [
                            "dato = 20",
                            "escribir dato",
                            "",
                            'dato = "veinte"',
                            "escribir dato"
                        ].join("\n"),
                        "El tipo puede cambiar durante la ejecución",
                        "La variable `dato` utiliza primero un valor numérico y posteriormente una cadena. CLRS no exige declarar previamente un tipo fijo para esa variable."
                    ),
                ],

                knowledge: [
                    "comprender qué es un tipo de dato",
                    "reconocer valores numéricos, de cadena y lógicos",
                    "comprender que el tipo permite clasificar valores según la información que representan",
                    "distinguir un valor numérico de una cadena que contiene dígitos",
                    "comprender que diferentes tipos pueden admitir diferentes formas de utilización",
                    "comprender qué es un sistema de tipos",
                    "diferenciar de forma introductoria tipado estático y dinámico",
                    "reconocer de forma introductoria la distinción entre tipado fuerte y débil",
                    "comprender qué significa inferencia de tipos",
                    "diferenciar inferencia de tipos y tipado dinámico",
                    "comprender que CLRS utiliza un modelo dinámico y débilmente tipado"
                ],

                notes: [
                    callout(
                        "Las categorías pueden variar entre lenguajes",
                        "Otros lenguajes pueden distinguir enteros, números reales, caracteres, referencias, objetos y muchas otras clases de valores. La clasificación concreta cambia, pero la idea general de utilizar tipos para distinguir clases de información es transferible."
                    ),

                    callout(
                        "Fuerte y débil",
                        "Las expresiones tipado fuerte y tipado débil se utilizan de maneras diferentes en la literatura y entre comunidades. En esta ruta funcionan como una introducción comparativa, no como una clasificación universal con una frontera única y exacta."
                    )
                ],

                category: "FND-DATA"
            }),
            lesson({
                order: 12,
                section: 3,
                title: "Cadenas de caracteres",

                objective:
                    "Comprender que una cadena representa información textual mediante una secuencia ordenada de caracteres y aprender a conservar y utilizar cadenas mediante variables.",

                problemStatement:
                    "Un programa necesita conservar el nombre completo \"Ana López\" como una sola pieza de información. ¿Cómo puede representar ese texto y qué elementos forman realmente su contenido?",

                concepts: [
                    "cadena",
                    "carácter",
                    "secuencia de caracteres"
                ],

                explanation: [
                    paragraph(
                        "En la sección anterior aprendimos que una cadena es un tipo de valor utilizado para representar información textual. Ahora estudiaremos con mayor detalle cómo está organizado ese texto."
                    ),

                    callout(
                        "Problema de esta lección",
                        [
                            "Queremos representar:",
                            "",
                            "Ana López",
                            "",
                            "como una sola pieza",
                            "de información.",
                            "",
                            "¿Qué contiene realmente",
                            "ese valor textual?"
                        ].join("\n")
                    ),

                    paragraph(
                        "Una cadena es una secuencia ordenada de caracteres. Cada letra, dígito, espacio o símbolo que forma parte del texto ocupa un lugar dentro de esa secuencia."
                    ),

                    callout(
                        "Una cadena contiene caracteres",
                        [
                            "\"Ana\"",
                            "",
                            "A   n   a",
                            "",
                            "→   →   →",
                            "",
                            "caracteres"
                        ].join("\n")
                    ),

                    paragraph(
                        "Un carácter es una unidad individual que forma parte del texto. Por ejemplo, la cadena `\"Ana\"` está formada por los caracteres `A`, `n` y `a`."
                    ),

                    paragraph(
                        "El orden de los caracteres importa. Las cadenas `\"Ana\"` y `\"naA\"` contienen caracteres semejantes, pero representan textos diferentes porque su organización no es la misma."
                    ),

                    callout(
                        "El orden forma parte del texto",
                        [
                            "\"Ana\"",
                            "",
                            "A → n → a",
                            "",
                            "no representa lo mismo que",
                            "",
                            "\"naA\"",
                            "",
                            "n → a → A"
                        ].join("\n")
                    ),

                    paragraph(
                        "Los espacios también forman parte de una cadena. En `\"Ana López\"`, el espacio entre el nombre y el apellido pertenece al contenido textual y ocupa un lugar dentro de la secuencia."
                    ),

                    callout(
                        "El espacio también es un carácter",
                        [
                            "\"Ana López\"",
                            "",
                            "A n a ␠ L ó p e z",
                            "",
                            "        ↑",
                            "      espacio"
                        ].join("\n")
                    ),

                    paragraph(
                        "En CLRS escribimos directamente una cadena mediante un literal delimitado por comillas. Las comillas permiten indicar dónde comienza y termina el literal, pero no forman parte del texto representado."
                    ),

                    paragraph(
                        "Por ejemplo, `\"Ana López\"` es la representación escrita en el código, mientras que el contenido de la cadena es simplemente Ana López."
                    ),


                    paragraph(
                        "Una variable puede conservar una cadena del mismo modo que anteriormente conservamos valores numéricos o lógicos. La diferencia está en el tipo de información representada: en este caso trabajamos con texto."
                    ),

                    paragraph(
                        "Comprender que una cadena es una secuencia será importante en las siguientes lecciones. Primero aprenderemos a combinar cadenas y después podremos examinar elementos como su longitud y las posiciones de sus caracteres."
                    )
                ],

                examples: [
                    text(
                        "lesson-012-string-sequence",
                        [
                            "CADENA",
                            "",
                            "\"Ana López\"",
                            "",
                            "        ↓",
                            "",
                            "SECUENCIA DE CARACTERES",
                            "",
                            "A",
                            "n",
                            "a",
                            "␠",
                            "L",
                            "ó",
                            "p",
                            "e",
                            "z"
                        ].join("\n"),
                        "El texto está formado por caracteres",
                        "La cadena representa una única pieza de información textual, pero internamente podemos comprenderla como una secuencia ordenada de caracteres."
                    ),

                    clrs(
                        "lesson-012-strings",
                        [
                            'nombre = "Ana López"',
                            'mensaje = "Registro completado"',
                            "",
                            "escribir nombre",
                            "escribir mensaje"
                        ].join("\n"),
                        "Trabajar con información textual",
                        "Ambas variables conservan valores de cadena y pueden utilizarse posteriormente mediante sus identificadores."
                    ),

                    text(
                        "lesson-012-quotes",
                        [
                            "Código:",
                            "",
                            "\"Ana López\"",
                            "",
                            "Contenido de la cadena:",
                            "",
                            "Ana López",
                            "",
                            "Las comillas delimitan",
                            "el literal en el código;",
                            "no forman parte del contenido."
                        ].join("\n"),
                        "Literal y contenido textual",
                        "La sintaxis utilizada para representar una cadena debe distinguirse del texto que esa representación contiene."
                    ),

                    clrs(
                        "lesson-012-store-string",
                        [
                            'nombre = "Ana López"',
                            "escribir nombre"
                        ].join("\n"),
                        "Conservar texto en una variable",
                        "La variable `nombre` queda asociada con una cadena. Al utilizar posteriormente el identificador, el programa trabaja con el texto almacenado."
                    ),
                ],

                knowledge: [
                    "comprender que una cadena representa información textual",
                    "comprender qué es un carácter de forma introductoria",
                    "comprender que una cadena es una secuencia ordenada de caracteres",
                    "reconocer que el orden de los caracteres forma parte del contenido de una cadena",
                    "comprender que espacios y símbolos pueden formar parte de una cadena",
                    "distinguir las comillas del contenido textual representado",
                    "almacenar y utilizar cadenas mediante variables"
                ],

                notes: [
                    callout(
                        "Carácter y cadena",
                        "Algunos lenguajes poseen un tipo específico para representar un carácter individual y otro para representar cadenas. CLRS trabaja principalmente con cadenas; en esta ruta utilizaremos carácter como concepto para comprender los elementos que forman el texto."
                    )
                ],

                category: "FND-TEXT"
            }),
            lesson({
                order: 13,
                section: 3,
                title: "Concatenación",

                objective:
                    "Comprender que concatenar consiste en unir cadenas en un orden determinado para construir nuevo texto y utilizar esta operación para combinar fragmentos y valores textuales.",

                problemStatement:
                    "Un programa conoce el nombre de una persona y necesita construir un saludo personalizado. Si tenemos por separado \"Hola, \" y \"Ana\", ¿cómo podemos unir ambos fragmentos para producir \"Hola, Ana\"?",

                concepts: [
                    "concatenación",
                    "fragmento",
                    "cadena resultante"
                ],

                explanation: [
                    paragraph(
                        "En la lección anterior aprendimos que una cadena es una secuencia ordenada de caracteres. Sin embargo, un programa no siempre dispone desde el principio de todo el texto que desea mostrar. Muchas veces necesita construirlo a partir de varias partes."
                    ),

                    callout(
                        "Problema de esta lección",
                        [
                            "Tenemos:",
                            "",
                            "\"Hola, \"",
                            "",
                            "y",
                            "",
                            "\"Ana\"",
                            "",
                            "Queremos obtener:",
                            "",
                            "\"Hola, Ana\"",
                            "",
                            "¿Cómo unimos ambas partes?"
                        ].join("\n")
                    ),

                    paragraph(
                        "Concatenar significa unir dos o más cadenas para producir una nueva cadena. Cada una de las partes utilizadas para construir el resultado puede entenderse como un fragmento."
                    ),

                    callout(
                        "Concatenación",
                        [
                            "\"Hola, \"",
                            "    +",
                            "\"Ana\"",
                            "",
                            "    →",
                            "",
                            "\"Hola, Ana\""
                        ].join("\n")
                    ),

                    paragraph(
                        "En CLRS podemos utilizar el operador `+` para concatenar cadenas. Cuando escribimos `\"Hola, \" + \"Ana\"`, los caracteres de ambas cadenas se unen respetando el orden en que aparecen."
                    ),

                    paragraph(
                        "El orden importa porque concatenar no reorganiza los fragmentos. Primero se coloca el contenido de la cadena situada a la izquierda y después el contenido de la cadena situada a la derecha."
                    ),

                    callout(
                        "El orden cambia el resultado",
                        [
                            "\"Hola, \" + \"Ana\"",
                            "",
                            "→ \"Hola, Ana\"",
                            "",
                            "\"Ana\" + \"Hola, \"",
                            "",
                            "→ \"AnaHola, \""
                        ].join("\n")
                    ),

                    paragraph(
                        "Los espacios y signos también forman parte de las cadenas. La concatenación no agrega automáticamente espacios entre los fragmentos. Si necesitamos uno, debe formar parte del texto que estamos construyendo."
                    ),

                    callout(
                        "Los espacios no aparecen solos",
                        [
                            "\"Hola\" + \"Ana\"",
                            "→ \"HolaAna\"",
                            "",
                            "\"Hola \" + \"Ana\"",
                            "→ \"Hola Ana\""
                        ].join("\n")
                    ),

                    paragraph(
                        "La concatenación resulta especialmente útil cuando una parte del texto se encuentra almacenada en una variable. Podemos combinar texto fijo con información que cambia según el problema."
                    ),


                    paragraph(
                        "El operador `+` también puede utilizarse con valores numéricos, pero en ese caso representa una operación diferente: la suma. No debemos confundir la operación con el símbolo utilizado para escribirla."
                    ),

                    callout(
                        "Mismo símbolo, operaciones distintas",
                        [
                            "10 + 5",
                            "",
                            "→ suma numérica",
                            "→ 15",
                            "",
                            "\"Hola \" + \"Ana\"",
                            "",
                            "→ concatenación",
                            "→ \"Hola Ana\""
                        ].join("\n")
                    ),

                    paragraph(
                        "Más adelante estudiaremos con mayor detalle los operadores y las expresiones. Por ahora basta con reconocer que, cuando utilizamos `+` para construir texto, estamos concatenando cadenas."
                    )
                ],

                examples: [
                    clrs(
                        "lesson-013-greeting",
                        [
                            'nombre = "Ana"',
                            'escribir "Hola, " + nombre'
                        ].join("\n"),
                        "Construir un saludo",
                        "El programa combina una parte fija del mensaje con el nombre almacenado en la variable y produce `Hola, Ana`."
                    ),

                    clrs(
                        "lesson-013-built-string",
                        [
                            'producto = "Teclado"',
                            'mensaje = "Producto: " + producto',
                            "",
                            "escribir mensaje"
                        ].join("\n"),
                        "Guardar el texto construido",
                        "El resultado de una concatenación es otra cadena, por lo que también puede conservarse en una variable y utilizarse posteriormente."
                    ),

                    text(
                        "lesson-013-order-space",
                        [
                            "\"Hola\" + \"Ana\"",
                            "→ \"HolaAna\"",
                            "",
                            "\"Hola \" + \"Ana\"",
                            "→ \"Hola Ana\"",
                            "",
                            "\"Ana\" + \"Hola \"",
                            "→ \"AnaHola \""
                        ].join("\n"),
                        "Orden y espacios",
                        "La concatenación conserva exactamente los fragmentos y el orden utilizados. Los espacios deben formar parte explícita de alguna cadena."
                    ),

                    clrs(
                        "lesson-013-variable-message",
                        [
                            'nombre = "Ana"',
                            'mensaje = "Hola, " + nombre',
                            "",
                            "escribir mensaje"
                        ].join("\n"),
                        "Construir un mensaje personalizado",
                        "La cadena fija `\"Hola, \"` se concatena con el valor almacenado en `nombre`. El resultado es una nueva cadena que queda almacenada en `mensaje`."
                    ),
                ],

                knowledge: [
                    "comprender qué significa concatenar cadenas",
                    "comprender que una concatenación produce una nueva cadena",
                    "construir texto a partir de varios fragmentos",
                    "concatenar una cadena con el valor textual almacenado en una variable",
                    "comprender que el orden de los fragmentos modifica el resultado",
                    "comprender que los espacios deben formar parte explícita del texto",
                    "diferenciar concatenación de suma numérica de forma introductoria"
                ],

                notes: [
                    callout(
                        "Otros lenguajes",
                        "Muchos lenguajes permiten concatenar cadenas, aunque la sintaxis puede cambiar. Algunos utilizan `+`, mientras que otros proporcionan operadores, funciones o mecanismos específicos para construir texto."
                    )
                ],

                category: "FND-TEXT"
            }),
            lesson({
                order: 14,
                section: 3,
                title: "Secuencias de escape",

                objective:
                    "Comprender que una secuencia de escape permite representar dentro de una cadena caracteres o efectos textuales que necesitan una escritura especial, y utilizar las secuencias básicas disponibles en CLRS.",

                problemStatement:
                    "Un programa necesita mostrar un reporte en varias líneas e incluir un mensaje entre comillas. ¿Cómo podemos representar saltos de línea, tabulaciones y comillas sin romper la cadena que estamos escribiendo?",

                concepts: [
                    "secuencia de escape",
                    "barra invertida",
                    "carácter especial"
                ],

                explanation: [
                    paragraph(
                        "En las lecciones anteriores aprendimos a representar cadenas y a construir nuevo texto mediante concatenación. Sin embargo, algunas partes del texto necesitan una representación especial dentro del código."
                    ),

                    callout(
                        "Problema de esta lección",
                        [
                            "Queremos producir:",
                            "",
                            "Nombre:    Ana",
                            "Estado:    \"Activo\"",
                            "",
                            "Necesitamos:",
                            "",
                            "• cambiar de línea",
                            "• separar información",
                            "• incluir comillas",
                            "",
                            "¿Cómo representamos",
                            "todo eso dentro de una cadena?"
                        ].join("\n")
                    ),

                    paragraph(
                        "Por ejemplo, si queremos que una parte del mensaje aparezca en otra línea, necesitamos representar un salto de línea. También podemos necesitar introducir una tabulación o unas comillas que formen parte del propio texto."
                    ),

                    paragraph(
                        "Para estos casos utilizamos secuencias de escape. Una secuencia de escape es una combinación que comienza con una barra invertida `\\` y utiliza el carácter siguiente para indicar una representación especial."
                    ),

                    callout(
                        "Código y contenido representado",
                        [
                            "En el código:",
                            "",
                            "\"Hola\\nMundo\"",
                            "",
                            "        →",
                            "",
                            "Al utilizar la cadena:",
                            "",
                            "Hola",
                            "Mundo"
                        ].join("\n")
                    ),

                    paragraph(
                        "La secuencia `\\n` está escrita mediante dos caracteres visibles en el código, pero representa un salto de línea cuando se utiliza la cadena. Esto muestra nuevamente una diferencia importante entre cómo escribimos algo en el código y el contenido que esa escritura representa."
                    ),

                    list([
                        "`\\n`: representa un salto de línea.",
                        "`\\t`: representa una tabulación.",
                        "`\\r`: representa un retorno.",
                        "`\\b`: representa un retroceso.",
                        "`\\\"`: representa una comilla dentro de una cadena."
                    ]),

                    paragraph(
                        "Una secuencia de escape forma parte de la representación de la cadena. No es una instrucción independiente y no se ejecuta por separado: participa en la construcción del contenido textual."
                    ),

                    paragraph(
                        "El salto de línea permite continuar el texto en otra línea. La tabulación permite introducir una separación horizontal. Ambas son especialmente útiles cuando queremos organizar una salida textual."
                    ),

                    callout(
                        "Organizar una salida",
                        [
                            "Código:",
                            "",
                            "\"Nombre:\\tAna\\nEstado:\\tActivo\"",
                            "",
                            "        →",
                            "",
                            "Resultado:",
                            "",
                            "Nombre:    Ana",
                            "Estado:    Activo"
                        ].join("\n")
                    ),

                    paragraph(
                        "Las comillas necesitan un tratamiento especial porque también se utilizan para delimitar un literal de cadena. Si queremos que una comilla forme parte del contenido, podemos representarla mediante `\\\"`."
                    ),

                    callout(
                        "Comillas dentro del texto",
                        [
                            "Código:",
                            "",
                            "\"Estado: \\\"Activo\\\"\"",
                            "",
                            "        →",
                            "",
                            "Contenido:",
                            "",
                            "Estado: \"Activo\""
                        ].join("\n")
                    ),

                    paragraph(
                        "CLRS también reconoce `\\r` y `\\b`. Sus efectos son más específicos y pueden resultar menos evidentes visualmente que un salto de línea o una tabulación. En esta etapa basta con reconocer qué representan; la práctica principal se concentrará en `\\n`, `\\t` y `\\\"`."
                    ),

                    paragraph(
                        "Las secuencias de escape permiten mantener una cadena como una sola representación en el código mientras expresamos contenido que no sería cómodo o posible escribir directamente de la forma habitual."
                    )
                ],

                examples: [
                    text(
                        "lesson-014-escape-model",
                        String.raw`\n  → salto de línea
\t  → tabulación
\r  → retorno
\b  → retroceso
\"  → comillas`,
                        "Representaciones especiales",
                        "La barra invertida señala que la combinación siguiente debe interpretarse de una manera especial dentro de la cadena."
                    ),

                    clrs(
                        "lesson-014-formatted-output",
                        String.raw`escribir "Nombre:\tAna\nEstado:\tActivo"`,
                        "Un reporte en varias líneas",
                        "La tabulación separa cada etiqueta de su valor y `\\n` hace que la segunda parte del reporte aparezca en una nueva línea."
                    ),

                    clrs(
                        "lesson-014-quotes",
                        String.raw`escribir "Estado: \"Activo\""`,
                        "Incluir comillas",
                        "Las comillas escapadas forman parte del contenido de la cadena y no se interpretan como el final anticipado del literal."
                    ),

                    clrs(
                        "lesson-014-combined",
                        String.raw`escribir "Usuario:\tAna\nMensaje:\t\"Acceso permitido\""`,
                        "Combinar varias secuencias",
                        "Una misma cadena puede utilizar diferentes secuencias de escape para organizar y representar correctamente su contenido."
                    )
                ],

                knowledge: [
                    "comprender qué es una secuencia de escape",
                    "comprender la función de la barra invertida en una secuencia de escape",
                    "distinguir la representación escrita de una secuencia y el contenido que produce",
                    "representar saltos de línea mediante \\n",
                    "representar tabulaciones mediante \\t",
                    "incluir comillas dentro de una cadena mediante \\\"",
                    "reconocer de forma introductoria las secuencias \\r y \\b",
                    "combinar secuencias de escape para organizar una salida textual"
                ],

                notes: [
                    callout(
                        "Representación en otros lenguajes",
                        "Las secuencias de escape aparecen en muchos lenguajes de programación y suelen utilizar una barra invertida, aunque el conjunto exacto de secuencias disponibles y su comportamiento puede variar."
                    )
                ],

                category: "FND-TEXT"
            }),
            lesson({
                order: 15,
                section: 3,
                title: "Examinar cadenas",

                objective:
                    "Comprender que una cadena puede examinarse como una secuencia ordenada de caracteres, obteniendo su longitud y consultando caracteres mediante sus posiciones.",

                problemStatement:
                    "Un programa recibe el código textual \"CLRS\" y necesita saber cuántos caracteres contiene y cuál es su primer carácter. ¿Cómo podemos examinar esa cadena sin modificarla?",

                concepts: [
                    "longitud",
                    "posición",
                    "acceso a caracteres"
                ],

                explanation: [
                    paragraph(
                        "En las lecciones anteriores aprendimos que una cadena es una secuencia ordenada de caracteres. Ahora aprovecharemos esa estructura para consultar información sobre una cadena sin cambiar su contenido."
                    ),

                    callout(
                        "Problema de esta lección",
                        [
                            "Tenemos:",
                            "",
                            "\"CLRS\"",
                            "",
                            "Queremos responder:",
                            "",
                            "¿Cuántos caracteres contiene?",
                            "",
                            "¿Cuál es su primer carácter?",
                            "",
                            "Necesitamos examinar la cadena,",
                            "no transformarla."
                        ].join("\n")
                    ),

                    paragraph(
                        "Una propiedad básica de una cadena es su longitud. La longitud indica cuántos caracteres contiene la secuencia."
                    ),

                    paragraph(
                        "En CLRS utilizamos `LONG` para obtener la longitud de una cadena. Por ejemplo, `LONG(\"CLRS\")` produce el valor 4 porque la cadena contiene cuatro caracteres."
                    ),

                    callout(
                        "Longitud",
                        [
                            "Cadena:",
                            "\"CLRS\"",
                            "",
                            "Caracteres:",
                            "C   L   R   S",
                            "",
                            "Cantidad:",
                            "4",
                            "",
                            "LONG(\"CLRS\")",
                            "→ 4"
                        ].join("\n")
                    ),

                    paragraph(
                        "Todos los caracteres que forman parte del contenido cuentan para la longitud. Esto incluye letras, dígitos, espacios y símbolos."
                    ),

                    callout(
                        "Los espacios también cuentan",
                        [
                            "Cadena:",
                            "\"A B\"",
                            "",
                            "Caracteres:",
                            "A   ␠   B",
                            "",
                            "LONG(\"A B\")",
                            "→ 3"
                        ].join("\n")
                    ),

                    paragraph(
                        "Como una cadena es una secuencia ordenada, también podemos identificar sus caracteres mediante posiciones. En CLRS, las posiciones de una cadena comienzan en cero."
                    ),

                    callout(
                        "Posiciones desde cero",
                        [
                            "Cadena:",
                            "C   L   R   S",
                            "",
                            "Posición:",
                            "0   1   2   3"
                        ].join("\n")
                    ),

                    paragraph(
                        "Esto significa que el primer carácter se encuentra en la posición 0, el segundo en la posición 1 y así sucesivamente."
                    ),

                    paragraph(
                        "CLRS proporciona `CAR_EN` para consultar el carácter ubicado en una posición determinada. Por ejemplo, `CAR_EN(\"CLRS\", 0)` produce `\"C\"`, mientras que `CAR_EN(\"CLRS\", 2)` produce `\"R\"`."
                    ),

                    callout(
                        "Posición y carácter",
                        [
                            "CAR_EN(\"CLRS\", 2)",
                            "",
                            "2",
                            "→ posición",
                            "",
                            "\"R\"",
                            "→ carácter encontrado"
                        ].join("\n")
                    ),

                    paragraph(
                        "La posición y el carácter no son lo mismo. La posición es un número que indica dónde buscar dentro de la secuencia; el carácter es el contenido que encontramos en ese lugar."
                    ),

                    list([
                        "`LONG(texto)`: obtiene la cantidad de caracteres de una cadena.",
                        "`CAR_EN(texto, posicion)`: obtiene el carácter ubicado en la posición indicada."
                    ]),

                    paragraph(
                        "Si una cadena contiene `n` caracteres, sus posiciones comienzan en 0 y avanzan hasta `n - 1`. Por ejemplo, una cadena de longitud 4 posee las posiciones 0, 1, 2 y 3."
                    ),

                    paragraph(
                        "En esta lección únicamente estamos consultando información sobre la cadena. No estamos alterando su contenido. En la siguiente aprenderemos operaciones que sí permiten producir nuevas cadenas transformadas."
                    )
                ],

                examples: [
                    clrs(
                        "lesson-015-length",
                        [
                            'codigo = "CLRS"',
                            "longitud = LONG(codigo)",
                            "",
                            "escribir longitud"
                        ].join("\n"),
                        "Conocer la longitud",
                        "`LONG(codigo)` produce 4 porque la cadena almacenada contiene cuatro caracteres."
                    ),

                    clrs(
                        "lesson-015-character",
                        [
                            'codigo = "CLRS"',
                            "primero = CAR_EN(codigo, 0)",
                            "",
                            "escribir primero"
                        ].join("\n"),
                        "Consultar el primer carácter",
                        "Las posiciones comienzan en cero, por lo que `CAR_EN(codigo, 0)` obtiene el primer carácter: `\"C\"`."
                    ),

                    clrs(
                        "lesson-015-multiple-positions",
                        [
                            'codigo = "CLRS"',
                            "primero = CAR_EN(codigo, 0)",
                            "tercero = CAR_EN(codigo, 2)",
                            "",
                            "escribir primero",
                            "escribir tercero"
                        ].join("\n"),
                        "Examinar distintas posiciones",
                        "La posición 0 contiene `\"C\"` y la posición 2 contiene `\"R\"`. La cadena original permanece igual."
                    ),

                    text(
                        "lesson-015-length-and-index",
                        [
                            "Cadena:",
                            "\"CLRS\"",
                            "",
                            "LONG",
                            "→ 4 caracteres",
                            "",
                            "Posiciones válidas:",
                            "0, 1, 2, 3",
                            "",
                            "CAR_EN(..., 0)",
                            "→ \"C\"",
                            "",
                            "CAR_EN(..., 3)",
                            "→ \"S\""
                        ].join("\n"),
                        "Longitud y posiciones se relacionan",
                        "Una cadena de longitud 4 posee cuatro posiciones accesibles comenzando desde cero."
                    )
                ],

                knowledge: [
                    "comprender que una cadena puede examinarse sin modificarla",
                    "obtener la longitud de una cadena mediante LONG",
                    "comprender que los espacios también cuentan como caracteres",
                    "comprender que las posiciones de una cadena comienzan en cero",
                    "consultar un carácter mediante CAR_EN",
                    "diferenciar posición y carácter",
                    "relacionar la longitud de una cadena con sus posiciones válidas de forma introductoria"
                ],

                notes: [
                    callout(
                        "Índices en otros lenguajes",
                        "Muchos lenguajes utilizan posiciones que comienzan en cero para acceder a los elementos de una secuencia. La sintaxis concreta puede cambiar, pero distinguir entre posición y contenido es una idea transferible."
                    )
                ],

                recommendedTools: [
                    "execution-trace"
                ],

                category: "FND-TEXT"
            }),
            lesson({
                order: 16,
                section: 3,
                title: "Transformar cadenas",

                objective:
                    "Comprender que una cadena puede utilizarse como punto de partida para producir nuevo texto y aplicar funciones de CLRS para normalizar, extraer y reemplazar contenido.",

                problemStatement:
                    "Un programa contiene el código textual \"  broker-95  \", pero necesita utilizarlo sin espacios exteriores y completamente en mayúsculas. ¿Cómo podemos transformar la cadena original hasta obtener \"BROKER-95\"?",

                concepts: [
                    "transformación de cadenas",
                    "normalización de texto",
                    "subcadena",
                    "reemplazo"
                ],

                explanation: [
                    paragraph(
                        "En la lección anterior aprendimos a examinar una cadena mediante su longitud y las posiciones de sus caracteres. Ahora resolveremos una necesidad diferente: obtener nuevo texto a partir de una cadena existente."
                    ),

                    callout(
                        "Problema de esta lección",
                        [
                            "Tenemos:",
                            "",
                            "\"  broker-95  \"",
                            "",
                            "Necesitamos obtener:",
                            "",
                            "\"BROKER-95\"",
                            "",
                            "¿Cómo podemos transformar",
                            "el texto hasta conseguirlo?"
                        ].join("\n")
                    ),

                    paragraph(
                        "Transformar una cadena significa utilizar un valor textual como punto de partida para producir otro valor textual. La operación conserva alguna relación con el contenido original, pero genera un resultado adaptado a la necesidad del programa."
                    ),

                    callout(
                        "Transformar una cadena",
                        [
                            "CADENA ORIGINAL",
                            "",
                            "\"  broker-95  \"",
                            "",
                            "        → operación",
                            "",
                            "CADENA RESULTANTE",
                            "",
                            "\"broker-95\"",
                            "",
                            "        → operación",
                            "",
                            "\"BROKER-95\""
                        ].join("\n")
                    ),

                    paragraph(
                        "CLRS proporciona funciones de biblioteca para realizar distintas transformaciones. Cada una recibe texto y produce un valor resultante que podemos guardar en una variable o utilizar posteriormente."
                    ),

                    list([
                        "`MAYUS(texto)`: produce una versión del texto en mayúsculas.",
                        "`MINUS(texto)`: produce una versión del texto en minúsculas.",
                        "`RECORTA(texto)`: produce texto sin los espacios exteriores.",
                        "`SUBCAD(texto, inicio, fin)`: obtiene una parte de la cadena.",
                        "`REEMP(texto, viejo, nuevo)`: produce texto reemplazando un fragmento por otro."
                    ]),

                    paragraph(
                        "Para resolver nuestro problema podemos realizar más de una transformación. Primero retiramos los espacios exteriores mediante `RECORTA` y después convertimos el resultado a mayúsculas mediante `MAYUS`."
                    ),


                    paragraph(
                        "Guardar los resultados intermedios en variables permite observar con claridad cada transformación. Una cadena se utiliza como entrada de una operación y el resultado obtenido puede convertirse en la entrada de la siguiente."
                    ),

                    callout(
                        "Transformaciones encadenadas",
                        [
                            "\"  broker-95  \"",
                            "",
                            "        → RECORTA",
                            "",
                            "\"broker-95\"",
                            "",
                            "        → MAYUS",
                            "",
                            "\"BROKER-95\""
                        ].join("\n")
                    ),

                    paragraph(
                        "`MAYUS` y `MINUS` permiten normalizar el uso de mayúsculas y minúsculas. Esto puede ser útil cuando queremos que distintos textos sigan una representación consistente."
                    ),

                    paragraph(
                        "`SUBCAD` permite obtener solamente una parte del texto. Para ello utilizamos posiciones dentro de la cadena, aprovechando el conocimiento adquirido en la lección anterior."
                    ),


                    paragraph(
                        "`REEMP` resuelve otra necesidad: sustituir un fragmento por otro. El texto resultante conserva el resto del contenido y utiliza el nuevo fragmento en el lugar correspondiente."
                    ),


                    paragraph(
                        "No es necesario memorizar todas estas funciones como una lista aislada. Lo importante es reconocer el patrón común: partimos de una cadena, aplicamos una operación y obtenemos un nuevo valor textual que podemos seguir utilizando."
                    ),

                    callout(
                        "Examinar y transformar",
                        [
                            "EXAMINAR",
                            "",
                            "cadena",
                            "→",
                            "obtener información sobre ella",
                            "",
                            "LONG",
                            "CAR_EN",
                            "",
                            "        ≠",
                            "",
                            "TRANSFORMAR",
                            "",
                            "cadena",
                            "→",
                            "obtener nuevo texto",
                            "",
                            "MAYUS",
                            "MINUS",
                            "RECORTA",
                            "SUBCAD",
                            "REEMP"
                        ].join("\n")
                    )
                ],

                examples: [
                    clrs(
                        "lesson-016-normalization",
                        [
                            'codigo = "  broker-95  "',
                            "limpio = RECORTA(codigo)",
                            "normalizado = MAYUS(limpio)",
                            "",
                            "escribir normalizado"
                        ].join("\n"),
                        "Normalizar texto",
                        "Dos transformaciones consecutivas permiten retirar los espacios exteriores y obtener una representación uniforme en mayúsculas."
                    ),

                    clrs(
                        "lesson-016-case",
                        [
                            'texto = "Hola Mundo"',
                            "mayusculas = MAYUS(texto)",
                            "minusculas = MINUS(texto)",
                            "",
                            "escribir mayusculas",
                            "escribir minusculas"
                        ].join("\n"),
                        "Cambiar mayúsculas y minúsculas",
                        "Una misma cadena puede utilizarse como punto de partida para producir diferentes resultados textuales."
                    ),

                    clrs(
                        "lesson-016-substring",
                        [
                            'codigo = "CLRS-2026"',
                            "prefijo = SUBCAD(codigo, 0, 4)",
                            "",
                            "escribir prefijo"
                        ].join("\n"),
                        "Extraer un fragmento",
                        "`SUBCAD` permite construir una nueva cadena a partir de una parte del texto original."
                    ),

                    clrs(
                        "lesson-016-replace",
                        [
                            'mensaje = "Estado: pendiente"',
                            'resultado = REEMP(mensaje, "pendiente", "completado")',
                            "",
                            "escribir resultado"
                        ].join("\n"),
                        "Sustituir contenido",
                        "`REEMP` produce una versión del texto en la que el fragmento indicado ha sido reemplazado."
                    ),

                    clrs(
                        "lesson-016-normalize",
                        [
                            'codigo = "  broker-95  "',
                            "limpio = RECORTA(codigo)",
                            "normalizado = MAYUS(limpio)",
                            "",
                            "escribir normalizado"
                        ].join("\n"),
                        "Normalizar un código",
                        "`RECORTA` produce primero `\"broker-95\"`. Después, `MAYUS` utiliza ese resultado para producir `\"BROKER-95\"`."
                    ),

                    clrs(
                        "lesson-016-substring-concept",
                        [
                            'codigo = "CLRS-2026"',
                            "prefijo = SUBCAD(codigo, 0, 4)",
                            "",
                            "escribir prefijo"
                        ].join("\n"),
                        "Extraer una parte",
                        "`SUBCAD` utiliza posiciones para producir una cadena formada únicamente por el fragmento solicitado."
                    ),

                    clrs(
                        "lesson-016-replace-concept",
                        [
                            'mensaje = "Estado: pendiente"',
                            'resultado = REEMP(mensaje, "pendiente", "completado")',
                            "",
                            "escribir resultado"
                        ].join("\n"),
                        "Reemplazar un fragmento",
                        "`REEMP` produce un nuevo texto en el que `\"pendiente\"` es sustituido por `\"completado\"`."
                    ),
                ],

                knowledge: [
                    "comprender qué significa transformar una cadena",
                    "comprender que una transformación produce un valor textual resultante",
                    "normalizar texto mediante MAYUS, MINUS y RECORTA",
                    "extraer una parte de una cadena mediante SUBCAD",
                    "reemplazar un fragmento mediante REEMP",
                    "utilizar posiciones previamente aprendidas para extraer texto",
                    "guardar resultados intermedios de transformaciones en variables",
                    "combinar varias transformaciones de forma progresiva",
                    "diferenciar examinar una cadena de transformarla"
                ],

                notes: [
                    callout(
                        "Bibliotecas en otros lenguajes",
                        "Los nombres y la sintaxis de estas operaciones cambian entre lenguajes, pero transformar texto mediante operaciones de mayúsculas, minúsculas, recorte, extracción y reemplazo es una necesidad común en programación."
                    )
                ],

                category: "FND-TEXT"
            }),
            lesson({
                order: 17,
                section: 3,
                title: "Leer y convertir datos",

                objective:
                    "Comprender cómo un programa puede recibir valores durante la ejecución, comprobar qué clase de valor posee y obtener explícitamente una representación de otro tipo cuando sea necesario.",

                problemStatement:
                    "Un programa necesita trabajar con información que no conoce al escribir el código, sino que recibe durante la ejecución. ¿Cómo puede recibir ese valor, reconocer qué tipo de dato obtuvo y convertirlo cuando necesita otra representación?",

                concepts: [
                    "entrada de datos",
                    "comprobación de tipo",
                    "conversión de datos"
                ],

                explanation: [
                    paragraph(
                        "Hasta ahora, la mayor parte de la información utilizada por nuestros programas estaba escrita directamente en el código mediante literales y variables. Sin embargo, muchos valores solo se conocen cuando el programa ya se está ejecutando."
                    ),

                    callout(
                        "Problema de esta lección",
                        [
                            "Al escribir el programa",
                            "todavía no conocemos el dato.",
                            "",
                            "        → ejecución",
                            "",
                            "el programa recibe un valor",
                            "",
                            "        →",
                            "",
                            "necesitamos poder:",
                            "",
                            "1. recibirlo",
                            "2. reconocer qué tipo posee",
                            "3. convertirlo si necesitamos",
                            "   otra representación"
                        ].join("\n")
                    ),

                    paragraph(
                        "La información que llega mientras el programa se ejecuta forma parte de su entrada. En CLRS utilizamos la instrucción `leer` para recibir un valor y asignarlo a una variable."
                    ),

                    paragraph(
                        "`leer` necesita una variable que ya exista. Como CLRS introduce las variables mediante su primera asignación, debemos proporcionar primero un valor inicial y después utilizar esa variable como destino de la entrada."
                    ),

                    callout(
                        "Preparar y recibir",
                        [
                            "edad = 0",
                            "leer edad",
                            "",
                            "        →",
                            "",
                            "edad contiene ahora",
                            "el valor recibido"
                        ].join("\n")
                    ),

                    paragraph(
                        "La primera línea no representa el dato definitivo que queremos recibir. Su función es introducir e inicializar la variable para que posteriormente `leer` pueda asignarle el valor proporcionado durante la ejecución."
                    ),


                    paragraph(
                        "CLRS puede recibir valores de distintas clases. La entrada no debe entenderse como texto de manera obligatoria: dependiendo del valor recibido, el programa puede trabajar con un número, una cadena o un valor lógico."
                    ),

                    paragraph(
                        "Cuando necesitamos conocer la clase del valor actual podemos utilizar funciones de comprobación. Estas operaciones no cambian el valor: únicamente producen `VERDAD` o `FALSO` como respuesta."
                    ),

                    list([
                        "`ES_NUM(valor)`: produce VERDAD si el valor es numérico.",
                        "`ES_CAD(valor)`: produce VERDAD si el valor es una cadena.",
                        "`ES_LOG(valor)`: produce VERDAD si el valor es lógico."
                    ]),

                    callout(
                        "Comprobar un valor",
                        [
                            "dato",
                            "→",
                            "ES_NUM(dato)",
                            "→",
                            "VERDAD o FALSO",
                            "",
                            "El valor de dato",
                            "no se modifica."
                        ].join("\n")
                    ),


                    paragraph(
                        "Comprobar un tipo y convertir un valor resuelven problemas diferentes. Comprobar responde a una pregunta sobre el valor que ya tenemos. Convertir intenta obtener a partir de él un valor perteneciente a otro tipo."
                    ),

                    callout(
                        "Comprobar ≠ convertir",
                        [
                            "COMPROBAR",
                            "",
                            "ES_NUM(valor)",
                            "→",
                            "¿es numérico?",
                            "→",
                            "VERDAD / FALSO",
                            "",
                            "        ≠",
                            "",
                            "CONVERTIR",
                            "",
                            "A_NUM(valor)",
                            "→",
                            "obtener un valor numérico"
                        ].join("\n")
                    ),

                    paragraph(
                        "CLRS proporciona funciones para solicitar conversiones explícitas entre las clases de valores utilizadas en esta ruta."
                    ),

                    list([
                        "`A_NUM(valor)`: obtiene una representación numérica cuando la conversión es válida.",
                        "`A_CAD(valor)`: obtiene una representación de cadena.",
                        "`A_LOG(valor)`: obtiene una representación lógica cuando la conversión es válida."
                    ]),

                    paragraph(
                        "Por ejemplo, la cadena `\"25\"` contiene texto. Si una solución necesita trabajar con ese contenido como un número, podemos solicitar su conversión mediante `A_NUM`."
                    ),


                    paragraph(
                        "Una conversión explícita no debe realizarse automáticamente después de cada `leer`. Primero debemos considerar qué valor necesita realmente la solución. Si ya recibimos un número y necesitamos un número, convertirlo nuevamente no aporta nada."
                    ),

                    callout(
                        "Tres operaciones distintas",
                        [
                            "RECIBIR",
                            "leer dato",
                            "",
                            "        →",
                            "",
                            "COMPROBAR",
                            "ES_NUM(dato)",
                            "",
                            "        →",
                            "",
                            "CONVERTIR",
                            "A_NUM(dato)",
                            "",
                            "Cada operación responde",
                            "a una necesidad diferente."
                        ].join("\n")
                    ),

                    paragraph(
                        "Todavía no sabemos tomar caminos diferentes dependiendo de una comprobación. Más adelante, cuando estudiemos condiciones, podremos utilizar resultados como `ES_NUM(dato)` para decidir qué debe hacer el programa ante diferentes clases de entrada."
                    )
                ],

                examples: [
                    clrs(
                        "lesson-017-read-value",
                        [
                            'nombre = ""',
                            "leer nombre",
                            "",
                            "escribir nombre"
                        ].join("\n"),
                        "Recibir información desconocida al escribir el programa",
                        "El valor de `nombre` se obtiene durante la ejecución. La variable debe existir antes de utilizarse como destino de `leer`."
                    ),

                    clrs(
                        "lesson-017-type-check",
                        [
                            'dato = "25"',
                            "",
                            "escribir ES_NUM(dato)",
                            "escribir ES_CAD(dato)"
                        ].join("\n"),
                        "Comprobar sin modificar",
                        "`ES_NUM` y `ES_CAD` responden preguntas sobre el tipo actual de `dato`; ninguna de las dos operaciones transforma su valor."
                    ),

                    clrs(
                        "lesson-017-to-number",
                        [
                            'texto = "25"',
                            "numero = A_NUM(texto)",
                            "",
                            "escribir numero",
                            "escribir ES_NUM(numero)"
                        ].join("\n"),
                        "Obtener otra representación",
                        "La conversión produce un nuevo valor numérico a partir del contenido textual que representa un número."
                    ),

                    clrs(
                        "lesson-017-to-string",
                        [
                            "puntos = 100",
                            "texto = A_CAD(puntos)",
                            "",
                            "escribir texto",
                            "escribir ES_CAD(texto)"
                        ].join("\n"),
                        "Convertir un número a texto",
                        "`A_CAD` permite obtener una representación textual del valor almacenado en `puntos`."
                    ),

                    clrs(
                        "lesson-017-input",
                        [
                            "edad = 0",
                            "leer edad",
                            "",
                            "escribir edad"
                        ].join("\n"),
                        "Recibir un valor durante la ejecución",
                        "La variable `edad` existe antes de ejecutar `leer`. Después de la lectura, su valor actual pasa a ser el valor recibido y puede utilizarse normalmente."
                    ),

                    clrs(
                        "lesson-017-check",
                        [
                            'dato = "25"',
                            "",
                            "escribir ES_NUM(dato)",
                            "escribir ES_CAD(dato)"
                        ].join("\n"),
                        "Preguntar qué tipo de valor tenemos",
                        "`dato` contiene una cadena. Las comprobaciones producen resultados lógicos sin transformar el contenido almacenado."
                    ),

                    clrs(
                        "lesson-017-conversion",
                        [
                            'texto = "25"',
                            "numero = A_NUM(texto)",
                            "",
                            "escribir numero",
                            "escribir ES_NUM(numero)"
                        ].join("\n"),
                        "Convertir texto a un valor numérico",
                        "`A_NUM` produce a partir de la cadena una representación numérica. La comprobación posterior permite observar que el resultado pertenece ahora a la clase numérica."
                    ),
                ],

                knowledge: [
                    "comprender que un programa puede recibir información desconocida hasta el momento de la ejecución",
                    "recibir valores mediante leer",
                    "comprender que la variable utilizada por leer debe existir previamente en CLRS",
                    "comprender que leer asigna a la variable el valor recibido",
                    "comprobar valores mediante ES_NUM, ES_CAD y ES_LOG",
                    "comprender que una comprobación produce un valor lógico sin transformar el dato",
                    "convertir valores mediante A_NUM, A_CAD y A_LOG",
                    "diferenciar comprobación de tipo y conversión",
                    "comprender que no toda entrada necesita una conversión posterior"
                ],

                notes: [
                    callout(
                        "Entrada en otros lenguajes",
                        "La forma de recibir información y el tipo inicial de los datos de entrada dependen del lenguaje y de la fuente utilizada. No debe suponerse que toda operación de entrada de todos los lenguajes produzca siempre una cadena."
                    )
                ],

                recommendedTools: [
                    "execution-trace"
                ],

                category: "FND-IO"
            }),
            lesson({
                order: 18,
                section: 4,
                title: "Expresiones, operadores y operandos",

                objective:
                    "Comprender que una expresión utiliza valores y operaciones para producir un resultado, e identificar los operadores y operandos que participan en su evaluación.",

                problemStatement:
                    "Un programa conoce dos cantidades, 10 y 5, pero necesita obtener un nuevo valor a partir de ellas. ¿Cómo podemos representar la operación que combina esos valores y produce el resultado 15?",

                concepts: [
                    "expresión",
                    "operador",
                    "operando",
                    "evaluación"
                ],

                explanation: [
                    paragraph(
                        "Hasta ahora hemos trabajado con valores, variables, concatenaciones y conversiones. En muchos casos, un programa no se limita a utilizar un valor existente: necesita combinar o transformar valores para obtener uno nuevo."
                    ),

                    callout(
                        "Problema de esta lección",
                        [
                            "Tenemos dos valores:",
                            "",
                            "10",
                            "5",
                            "",
                            "Queremos obtener:",
                            "",
                            "15",
                            "",
                            "¿Cómo representamos",
                            "la operación que produce",
                            "ese nuevo valor?"
                        ].join("\n")
                    ),

                    paragraph(
                        "Una expresión es una construcción que puede evaluarse para producir un valor. Evaluar una expresión significa realizar las operaciones que representa hasta obtener su resultado."
                    ),

                    callout(
                        "De valores a resultado",
                        [
                            "10 + 5",
                            "",
                            "   → evaluar",
                            "",
                            "15"
                        ].join("\n")
                    ),

                    paragraph(
                        "Dentro de una expresión podemos distinguir operadores y operandos. Un operador indica qué operación debe realizarse, mientras que los operandos son los valores sobre los que actúa esa operación."
                    ),

                    callout(
                        "Partes de una expresión",
                        [
                            "10   +   5",
                            "↑    ↑   ↑",
                            "│    │   └─ operando",
                            "│    └───── operador",
                            "└────────── operando",
                            "",
                            "        → evaluar",
                            "",
                            "Resultado: 15"
                        ].join("\n")
                    ),

                    list([
                        "Expresión: construcción que puede evaluarse para producir un valor.",
                        "Operador: símbolo o construcción que indica qué operación debe realizarse.",
                        "Operando: valor utilizado por un operador.",
                        "Evaluación: proceso mediante el cual una expresión produce su resultado.",
                        "Resultado: valor obtenido después de evaluar la expresión."
                    ]),

                    paragraph(
                        "Los operandos no tienen que aparecer siempre como literales. También pueden utilizarse variables. Cuando una variable participa en una expresión, se utiliza el valor que posee en ese momento."
                    ),


                    paragraph(
                        "También podemos utilizar el resultado de una expresión directamente, sin guardarlo primero en otra variable."
                    ),


                    paragraph(
                        "Las expresiones no son exclusivamente numéricas. Ya hemos utilizado concatenaciones como `\"Hola \" + nombre`. Esa construcción también produce un valor: una nueva cadena."
                    ),

                    callout(
                        "Distintos resultados",
                        [
                            "10 + 5",
                            "→",
                            "15",
                            "",
                            "\"Hola \" + \"Ana\"",
                            "→",
                            "\"Hola Ana\"",
                            "",
                            "En ambos casos existe:",
                            "",
                            "operandos",
                            "+",
                            "una operación",
                            "+",
                            "un resultado"
                        ].join("\n")
                    ),

                    paragraph(
                        "Por ahora no estudiaremos todas las operaciones disponibles ni sus reglas de prioridad. El objetivo es reconocer la estructura común de una expresión. En las siguientes lecciones estudiaremos con mayor detalle las operaciones aritméticas y cómo se determina el orden de evaluación."
                    )
                ],

                examples: [
                    text(
                        "lesson-018-expression-model",
                        [
                            "EXPRESIÓN",
                            "",
                            "10 + 5",
                            "",
                            "Operandos:",
                            "10 y 5",
                            "",
                            "Operador:",
                            "+",
                            "",
                            "        ↓ evaluación",
                            "",
                            "Resultado:",
                            "15"
                        ].join("\n"),
                        "Partes de una expresión",
                        "Los operandos proporcionan los valores, el operador indica qué hacer con ellos y la evaluación produce un resultado."
                    ),

                    clrs(
                        "lesson-018-variables",
                        [
                            "cantidadA = 10",
                            "cantidadB = 5",
                            "",
                            "resultado = cantidadA + cantidadB",
                            "",
                            "escribir resultado"
                        ].join("\n"),
                        "Utilizar valores almacenados",
                        "Las variables pueden participar como operandos. Durante la evaluación se utilizan sus valores actuales."
                    ),

                    clrs(
                        "lesson-018-text-expression",
                        [
                            'nombre = "Ana"',
                            'mensaje = "Hola " + nombre',
                            "",
                            "escribir mensaje"
                        ].join("\n"),
                        "Una expresión puede producir texto",
                        "La concatenación ya conocida también puede entenderse como una expresión porque combina valores y produce una nueva cadena."
                    ),

                    clrs(
                        "lesson-018-variable-expression",
                        [
                            "a = 10",
                            "b = 5",
                            "",
                            "resultado = a + b",
                            "escribir resultado"
                        ].join("\n"),
                        "Variables como operandos",
                        "Cuando se evalúa `a + b`, se utilizan los valores actuales asociados con `a` y `b`. La expresión produce 15 y ese resultado se asigna a `resultado`."
                    ),

                    clrs(
                        "lesson-018-direct-expression",
                        [
                            "a = 10",
                            "b = 5",
                            "",
                            "escribir a + b"
                        ].join("\n"),
                        "Utilizar directamente el resultado",
                        "Antes de realizar la salida, el programa evalúa `a + b`. El valor producido por la expresión es el que finalmente se muestra."
                    ),
                ],

                knowledge: [
                    "comprender qué es una expresión",
                    "comprender qué significa evaluar una expresión",
                    "comprender que una expresión produce un valor",
                    "identificar operadores dentro de expresiones sencillas",
                    "identificar operandos dentro de expresiones sencillas",
                    "reconocer literales y variables como operandos",
                    "utilizar el resultado de una expresión en una asignación",
                    "utilizar directamente el resultado de una expresión",
                    "reconocer que las expresiones pueden producir diferentes tipos de valores"
                ],

                notes: [
                    callout(
                        "La sintaxis puede cambiar",
                        "Los lenguajes utilizan distintos operadores y reglas para construir expresiones, pero la idea de combinar operandos mediante operaciones para producir valores es un fundamento general de la programación."
                    )
                ],

                category: "FND-OPERAT"
            }),
            lesson({
                order: 19,
                section: 4,
                title: "Operaciones aritméticas",

                objective:
                    "Comprender cómo los operadores aritméticos permiten realizar cálculos con valores numéricos y producir nuevos resultados que pueden utilizarse o conservarse en variables.",

                problemStatement:
                    "Un producto cuesta 15 y queremos comprar 4 unidades. ¿Cómo podemos hacer que el programa calcule el subtotal en lugar de escribir directamente el resultado 60?",

                concepts: [
                    "operación aritmética",
                    "suma",
                    "resta",
                    "multiplicación",
                    "división"
                ],

                explanation: [
                    paragraph(
                        "En la lección anterior aprendimos que una expresión combina operandos mediante un operador para producir un valor. Ahora utilizaremos esa estructura para resolver cálculos con cantidades numéricas."
                    ),

                    callout(
                        "Problema de esta lección",
                        [
                            "Precio de una unidad:",
                            "15",
                            "",
                            "Cantidad:",
                            "4",
                            "",
                            "Necesitamos obtener:",
                            "",
                            "subtotal = 60",
                            "",
                            "¿Cómo puede calcularlo",
                            "el programa?"
                        ].join("\n")
                    ),

                    paragraph(
                        "Cuando los valores representan cantidades, podemos utilizar operadores aritméticos para construir expresiones numéricas. CLRS proporciona las operaciones básicas de suma, resta, multiplicación y división."
                    ),

                    list([
                        "`+`: suma dos valores numéricos.",
                        "`-`: obtiene la diferencia entre dos valores numéricos.",
                        "`*`: multiplica dos valores numéricos.",
                        "`/`: divide un valor numérico entre otro."
                    ]),

                    paragraph(
                        "En nuestro problema, el subtotal depende del precio de una unidad y de la cantidad comprada. Como necesitamos repetir el precio cuatro veces de manera numérica, podemos utilizar una multiplicación."
                    ),

                    callout(
                        "Del problema a la expresión",
                        [
                            "precio → 15",
                            "cantidad → 4",
                            "",
                            "        →",
                            "",
                            "precio * cantidad",
                            "",
                            "        → evaluar",
                            "",
                            "60"
                        ].join("\n")
                    ),


                    paragraph(
                        "Cada operador representa una operación diferente. Utilizar los mismos operandos con operadores distintos puede producir resultados completamente diferentes."
                    ),

                    callout(
                        "Mismos operandos, distintas operaciones",
                        [
                            "20 + 4",
                            "→ 24",
                            "",
                            "20 - 4",
                            "→ 16",
                            "",
                            "20 * 4",
                            "→ 80",
                            "",
                            "20 / 4",
                            "→ 5"
                        ].join("\n")
                    ),

                    paragraph(
                        "Los operandos pueden ser literales o variables. Cuando utilizamos una variable, la expresión trabaja con el valor que esa variable posee en el momento de la evaluación."
                    ),

                    paragraph(
                        "El resultado también es un valor. Podemos utilizarlo inmediatamente o asignarlo a una variable cuando necesitamos conservarlo para instrucciones posteriores."
                    ),


                    paragraph(
                        "Ya utilizamos anteriormente el símbolo `+` para concatenar cadenas. Cuando trabajamos con valores numéricos, `+` representa suma. El significado de una operación debe comprenderse junto con los valores sobre los que actúa."
                    ),

                    callout(
                        "Suma y concatenación",
                        [
                            "10 + 5",
                            "→ suma numérica",
                            "→ 15",
                            "",
                            "\"Hola \" + \"Ana\"",
                            "→ concatenación",
                            "→ \"Hola Ana\""
                        ].join("\n")
                    ),

                    paragraph(
                        "En esta lección utilizaremos principalmente una operación por expresión. Cuando una expresión contiene varias operaciones diferentes aparece una nueva pregunta: ¿cuál debe evaluarse primero? Ese será el problema de la siguiente lección."
                    )
                ],

                examples: [
                    clrs(
                        "lesson-019-purchase",
                        [
                            "precio = 15",
                            "cantidad = 4",
                            "",
                            "subtotal = precio * cantidad",
                            "",
                            "escribir subtotal"
                        ].join("\n"),
                        "Calcular el costo de varias unidades",
                        "La multiplicación permite obtener el subtotal a partir del precio unitario y la cantidad."
                    ),

                    text(
                        "lesson-019-operators",
                        [
                            "20 + 4  → 24",
                            "20 - 4  → 16",
                            "20 * 4  → 80",
                            "20 / 4  → 5"
                        ].join("\n"),
                        "Cuatro operaciones aritméticas",
                        "Los mismos valores pueden participar en operaciones diferentes según el resultado que necesitemos obtener."
                    ),

                    clrs(
                        "lesson-019-results",
                        [
                            "a = 20",
                            "b = 4",
                            "",
                            "suma = a + b",
                            "resta = a - b",
                            "producto = a * b",
                            "division = a / b",
                            "",
                            "escribir suma",
                            "escribir resta",
                            "escribir producto",
                            "escribir division"
                        ].join("\n"),
                        "Observar diferentes resultados",
                        "Cambiar el operador cambia la relación entre los operandos y, por tanto, el valor producido por la expresión."
                    ),

                    clrs(
                        "lesson-019-subtotal",
                        [
                            "precio = 15",
                            "cantidad = 4",
                            "",
                            "subtotal = precio * cantidad",
                            "",
                            "escribir subtotal"
                        ].join("\n"),
                        "Calcular un subtotal",
                        "Los valores actuales de `precio` y `cantidad` funcionan como operandos. El operador `*` los multiplica y la expresión produce el valor 60."
                    ),

                    clrs(
                        "lesson-019-store-result",
                        [
                            "total = 20",
                            "personas = 4",
                            "",
                            "porPersona = total / personas",
                            "",
                            "escribir porPersona"
                        ].join("\n"),
                        "Conservar el resultado de una división",
                        "La expresión `total / personas` produce el valor 5. Ese resultado queda asociado con `porPersona` y puede utilizarse posteriormente."
                    ),
                ],

                knowledge: [
                    "comprender qué es una operación aritmética",
                    "construir expresiones numéricas mediante suma",
                    "construir expresiones numéricas mediante resta",
                    "construir expresiones numéricas mediante multiplicación",
                    "construir expresiones numéricas mediante división",
                    "utilizar literales y variables como operandos numéricos",
                    "comprender que una expresión aritmética produce un valor",
                    "almacenar el resultado de una operación aritmética en una variable",
                    "diferenciar de forma introductoria la suma numérica de la concatenación textual"
                ],

                notes: [
                    callout(
                        "Operaciones en otros lenguajes",
                        "Los símbolos `+`, `-`, `*` y `/` son comunes en muchos lenguajes de programación. Sin embargo, los detalles del comportamiento numérico pueden variar según los tipos y las reglas de cada lenguaje."
                    )
                ],

                category: "FND-OPERAT"
            }),
            lesson({
                order: 20,
                section: 4,
                title: "Precedencia y paréntesis",

                objective:
                    "Comprender que una expresión con varias operaciones sigue reglas de precedencia y utilizar paréntesis para representar explícitamente el agrupamiento que requiere un cálculo.",

                problemStatement:
                    "Se comprarán 2 kits. Cada kit cuesta 3 por materiales y 4 por armado. ¿Cómo debemos escribir el cálculo para que ambos costos se sumen primero y después se multipliquen por la cantidad de kits?",

                concepts: [
                    "precedencia",
                    "agrupamiento",
                    "paréntesis",
                    "asociatividad"
                ],

                explanation: [
                    paragraph(
                        "En la lección anterior resolvimos cálculos que utilizaban principalmente una operación a la vez. Sin embargo, muchos problemas necesitan combinar varias operaciones dentro de una misma expresión."
                    ),

                    callout(
                        "Problema de esta lección",
                        [
                            "Cantidad de kits:",
                            "2",
                            "",
                            "Costo de materiales por kit:",
                            "3",
                            "",
                            "Costo de armado por kit:",
                            "4",
                            "",
                            "Cada kit cuesta:",
                            "3 + 4",
                            "",
                            "y necesitamos ese costo",
                            "para 2 kits.",
                            "",
                            "¿Cómo expresamos correctamente",
                            "ese cálculo?"
                        ].join("\n")
                    ),

                    paragraph(
                        "Cuando una expresión contiene varios operadores, el programa necesita determinar qué operación debe evaluarse primero. Las reglas que establecen esa prioridad se conocen como precedencia de operadores."
                    ),

                    paragraph(
                        "En las operaciones aritméticas básicas que utilizaremos, la multiplicación y la división tienen mayor precedencia que la suma y la resta."
                    ),

                    callout(
                        "Precedencia aritmética básica",
                        [
                            "Mayor prioridad:",
                            "* y /",
                            "",
                            "Después:",
                            "+ y -"
                        ].join("\n")
                    ),

                    paragraph(
                        "Por ejemplo, si escribimos `2 * 3 + 4`, la multiplicación se evalúa primero. El programa obtiene primero 6 y después suma 4, produciendo 10."
                    ),

                    callout(
                        "Sin agrupamiento adicional",
                        [
                            "2 * 3 + 4",
                            "",
                            "→ primero 2 * 3",
                            "",
                            "6 + 4",
                            "",
                            "→",
                            "",
                            "10"
                        ].join("\n")
                    ),

                    paragraph(
                        "Pero ese resultado no representa correctamente nuestro problema. Los 3 de materiales y los 4 de armado pertenecen a cada kit, por lo que primero necesitamos obtener el costo completo de un kit."
                    ),

                    paragraph(
                        "Los paréntesis permiten establecer explícitamente un agrupamiento. Las operaciones contenidas en ellos se evalúan antes de continuar con las operaciones exteriores."
                    ),

                    callout(
                        "Agrupar según el problema",
                        [
                            "2 * (3 + 4)",
                            "",
                            "→ primero 3 + 4",
                            "",
                            "2 * 7",
                            "",
                            "→",
                            "",
                            "14"
                        ].join("\n")
                    ),

                    paragraph(
                        "El agrupamiento no debe elegirse únicamente para obtener un resultado deseado. Debe representar correctamente la relación entre las cantidades del problema."
                    ),

                    callout(
                        "Del problema a la expresión",
                        [
                            "Costo de un kit:",
                            "",
                            "materiales + armado",
                            "",
                            "3 + 4",
                            "",
                            "        →",
                            "",
                            "Costo de todos los kits:",
                            "",
                            "cantidad * costo de un kit",
                            "",
                            "2 * (3 + 4)"
                        ].join("\n")
                    ),

                    paragraph(
                        "Por tanto, los paréntesis pueden cambiar el resultado de una expresión, pero su utilidad principal es expresar de manera explícita qué operaciones forman una unidad dentro del cálculo."
                    ),


                    paragraph(
                        "Cuando no existen paréntesis, la precedencia proporciona un orden de evaluación preestablecido. Esto permite interpretar expresiones como `2 + 3 * 4` sin necesidad de añadir agrupamientos en cada operación."
                    ),

                    callout(
                        "Una expresión sin paréntesis",
                        [
                            "2 + 3 * 4",
                            "",
                            "→ multiplicación primero",
                            "",
                            "2 + 12",
                            "",
                            "→",
                            "",
                            "14"
                        ].join("\n")
                    ),

                    paragraph(
                        "Cuando aparecen operadores con la misma precedencia, también existen reglas que determinan cómo se agrupan. A esta propiedad se le llama asociatividad. En esta etapa basta con reconocer que existe; cuando el agrupamiento sea importante para expresar el problema, utilizaremos paréntesis para hacerlo evidente."
                    ),

                    paragraph(
                        "Los paréntesis también pueden utilizarse para mejorar la claridad incluso cuando las reglas de precedencia ya producirían el resultado correcto. Un cálculo debe ser correcto, pero también conviene que comunique con claridad la intención de quien lo escribió."
                    )
                ],

                examples: [
                    clrs(
                        "lesson-020-problem",
                        [
                            "cantidad = 2",
                            "materiales = 3",
                            "armado = 4",
                            "",
                            "total = cantidad * (materiales + armado)",
                            "",
                            "escribir total"
                        ].join("\n"),
                        "Agrupar según el significado",
                        "Primero se calcula el costo completo de cada kit y después se multiplica por la cantidad. El resultado es 14."
                    ),

                    clrs(
                        "lesson-020-precedence",
                        [
                            "resultado = 2 + 3 * 4",
                            "",
                            "escribir resultado"
                        ].join("\n"),
                        "Aplicar la precedencia",
                        "La multiplicación tiene prioridad sobre la suma, por lo que primero se obtiene 12 y después 14."
                    ),

                    clrs(
                        "lesson-020-parentheses",
                        [
                            "resultado = (2 + 3) * 4",
                            "",
                            "escribir resultado"
                        ].join("\n"),
                        "Cambiar el agrupamiento",
                        "Los paréntesis hacen que `2 + 3` se evalúe primero. El valor 5 se multiplica después por 4 y produce 20."
                    ),

                    text(
                        "lesson-020-comparison",
                        [
                            "2 + 3 * 4",
                            "",
                            "↓",
                            "2 + 12",
                            "↓",
                            "14",
                            "",
                            "----------------",
                            "",
                            "(2 + 3) * 4",
                            "",
                            "↓",
                            "5 * 4",
                            "↓",
                            "20"
                        ].join("\n"),
                        "El agrupamiento puede cambiar el resultado",
                        "Las mismas cantidades y operadores pueden producir valores diferentes cuando cambia la forma en que se agrupan las operaciones."
                    ),

                    clrs(
                        "lesson-020-kit-cost",
                        [
                            "cantidad = 2",
                            "materiales = 3",
                            "armado = 4",
                            "",
                            "total = cantidad * (materiales + armado)",
                            "",
                            "escribir total"
                        ].join("\n"),
                        "Representar correctamente el cálculo",
                        "Los paréntesis indican que primero debe obtenerse el costo completo de un kit. Después ese resultado se multiplica por la cantidad."
                    ),
                ],

                knowledge: [
                    "comprender qué significa precedencia de operadores",
                    "reconocer que multiplicación y división tienen prioridad sobre suma y resta",
                    "seguir el orden de evaluación de una expresión aritmética sencilla",
                    "comprender qué significa agrupar operaciones",
                    "utilizar paréntesis para establecer un agrupamiento explícito",
                    "representar mediante paréntesis la estructura requerida por un problema",
                    "comprender que diferentes agrupamientos pueden producir resultados diferentes",
                    "reconocer de forma introductoria qué significa asociatividad"
                ],

                notes: [
                    callout(
                        "Reglas transferibles",
                        "La precedencia, el agrupamiento y la asociatividad aparecen en muchos lenguajes de programación. Los conjuntos exactos de operadores pueden variar, por lo que al aprender otro lenguaje también conviene conocer sus reglas particulares."
                    )
                ],

                recommendedTools: [
                    "execution-trace"
                ],

                category: "FND-OPERAT"
            }),
            lesson({
                order: 21,
                section: 4,
                title: "Comparaciones",

                objective:
                    "Comprender que una comparación es una expresión que relaciona dos valores para responder una pregunta mediante VERDAD o FALSO, y distinguir claramente la comparación de igualdad de la asignación.",

                problemStatement:
                    "Un sistema conoce la edad de una persona y necesita responder preguntas como: ¿tiene al menos 18 años?, ¿tiene exactamente 18?, ¿su edad es diferente de 18? ¿Cómo podemos representar esas preguntas dentro del programa?",

                concepts: [
                    "comparación",
                    "operador de comparación",
                    "igualdad",
                    "desigualdad",
                    "resultado lógico"
                ],

                explanation: [
                    paragraph(
                        "Hasta ahora hemos utilizado expresiones principalmente para calcular números o construir texto. Sin embargo, un programa también necesita responder preguntas sobre los valores con los que trabaja."
                    ),

                    callout(
                        "Problema de esta lección",
                        [
                            "Tenemos:",
                            "",
                            "edad → 18",
                            "",
                            "Queremos responder:",
                            "",
                            "¿edad es mayor que 18?",
                            "¿edad es al menos 18?",
                            "¿edad es exactamente 18?",
                            "",
                            "Cada pregunta necesita",
                            "una respuesta lógica."
                        ].join("\n")
                    ),

                    paragraph(
                        "Una comparación es una expresión que relaciona dos valores mediante un operador de comparación. Al evaluarse, produce uno de dos valores lógicos: `VERDAD` cuando la relación se cumple y `FALSO` cuando no se cumple."
                    ),

                    callout(
                        "Una comparación también es una expresión",
                        [
                            "18 >= 18",
                            "",
                            "   → evaluar",
                            "",
                            "VERDAD"
                        ].join("\n")
                    ),

                    paragraph(
                        "Los valores que participan en una comparación funcionan como operandos, mientras que el operador indica qué relación queremos comprobar."
                    ),

                    list([
                        "`>`: comprueba si el valor de la izquierda es mayor que el de la derecha.",
                        "`<`: comprueba si el valor de la izquierda es menor que el de la derecha.",
                        "`>=`: comprueba si el valor de la izquierda es mayor o igual que el de la derecha.",
                        "`<=`: comprueba si el valor de la izquierda es menor o igual que el de la derecha.",
                        "`==`: comprueba si ambos valores son iguales.",
                        "`!=`: comprueba si ambos valores son diferentes."
                    ]),

                    paragraph(
                        "Por ejemplo, si `edad` contiene 18, la comparación `edad >= 18` produce `VERDAD`, porque 18 es mayor o igual que 18. En cambio, `edad > 18` produce `FALSO`, porque 18 no es mayor que 18."
                    ),

                    callout(
                        "La pregunta cambia el resultado",
                        [
                            "edad → 18",
                            "",
                            "edad > 18",
                            "→ FALSO",
                            "",
                            "edad >= 18",
                            "→ VERDAD",
                            "",
                            "edad == 18",
                            "→ VERDAD",
                            "",
                            "edad != 18",
                            "→ FALSO"
                        ].join("\n")
                    ),

                    paragraph(
                        "Una comparación consulta los valores actuales, pero no los modifica. Después de evaluar `edad >= 18`, la variable `edad` continúa conteniendo el mismo valor."
                    ),

                    paragraph(
                        "Esto diferencia una comparación de una asignación. En CLRS, `=` establece un valor en una variable, mientras que `==` pregunta si dos valores son iguales."
                    ),

                    callout(
                        "Asignar ≠ comparar",
                        [
                            "edad = 18",
                            "",
                            "→ asignación",
                            "→ modifica o establece el valor",
                            "",
                            "edad == 18",
                            "",
                            "→ comparación",
                            "→ produce VERDAD o FALSO",
                            "→ no modifica edad"
                        ].join("\n")
                    ),

                    paragraph(
                        "Esta diferencia también puede entenderse mediante el estado del programa. Una asignación puede producir un cambio de estado; una comparación únicamente observa los valores actuales y produce un nuevo valor lógico."
                    ),


                    paragraph(
                        "Por ahora observaremos o almacenaremos directamente los resultados de las comparaciones. En lecciones posteriores utilizaremos estos valores lógicos para decidir qué instrucciones debe ejecutar el programa."
                    )
                ],

                examples: [
                    text(
                        "lesson-021-comparison-model",
                        [
                            "VALORES",
                            "",
                            "18 y 18",
                            "",
                            "        ↓",
                            "",
                            "PREGUNTA",
                            "",
                            "18 >= 18",
                            "",
                            "        ↓ evaluación",
                            "",
                            "RESPUESTA",
                            "",
                            "VERDAD"
                        ].join("\n"),
                        "Comparar significa responder una pregunta",
                        "La comparación no produce otra cantidad: produce un valor lógico que indica si la relación se cumple."
                    ),

                    clrs(
                        "lesson-021-age-comparisons",
                        [
                            "edad = 18",
                            "",
                            "escribir edad > 18",
                            "escribir edad < 18",
                            "escribir edad >= 18",
                            "escribir edad <= 18",
                            "escribir edad == 18",
                            "escribir edad != 18"
                        ].join("\n"),
                        "Comparar el mismo valor de distintas maneras",
                        "La variable conserva el valor 18. Lo que cambia en cada expresión es la relación que se pregunta."
                    ),

                    clrs(
                        "lesson-021-assignment-vs-equality",
                        [
                            "edad = 18",
                            "esIgual = edad == 18",
                            "",
                            "escribir edad",
                            "escribir esIgual"
                        ].join("\n"),
                        "Asignación e igualdad",
                        "`=` establece el valor de `edad`. `==` compara ese valor con 18 y produce un resultado lógico."
                    ),

                    clrs(
                        "lesson-021-store-result",
                        [
                            "edad = 20",
                            "limite = 18",
                            "",
                            "cumple = edad >= limite",
                            "",
                            "escribir cumple"
                        ].join("\n"),
                        "Variables como operandos",
                        "Una comparación puede utilizar variables en ambos lados. Se comparan sus valores actuales y el resultado se almacena en `cumple`."
                    ),

                    clrs(
                        "lesson-021-store-comparison",
                        [
                            "edad = 18",
                            "",
                            "esMayorDeEdad = edad >= 18",
                            "",
                            "escribir esMayorDeEdad"
                        ].join("\n"),
                        "Guardar una respuesta lógica",
                        "La comparación `edad >= 18` produce `VERDAD`. Como ese resultado también es un valor, puede almacenarse en una variable."
                    ),
                ],

                knowledge: [
                    "comprender qué es una comparación",
                    "comprender que una comparación es una expresión",
                    "comprender que una comparación produce VERDAD o FALSO",
                    "utilizar operadores de mayor que, menor que, mayor o igual y menor o igual",
                    "comparar valores mediante igualdad y desigualdad",
                    "comprender que una comparación consulta valores sin modificarlos",
                    "diferenciar asignación mediante = y comparación de igualdad mediante ==",
                    "utilizar variables como operandos de una comparación",
                    "almacenar el resultado lógico de una comparación en una variable"
                ],

                notes: [
                    callout(
                        "Transferencia a otros lenguajes",
                        "Los operadores `>`, `<`, `>=`, `<=`, `==` y `!=` aparecen con formas similares en muchos lenguajes. Sin embargo, las reglas exactas de comparación entre distintos tipos de valores pueden variar."
                    )
                ],

                category: "FND-OPERAT"
            }),
            lesson({
                order: 22,
                section: 4,
                title: "Condiciones compuestas",

                objective:
                    "Comprender cómo combinar valores y expresiones lógicas mediante y, o y no para representar reglas formadas por varias condiciones y obtener un único resultado lógico.",

                problemStatement:
                    "Una persona puede acceder únicamente si tiene al menos 18 años y además cuenta con permiso. Una sola comparación ya no representa toda la regla. ¿Cómo podemos combinar ambas condiciones en una única expresión lógica?",

                concepts: [
                    "condición compuesta",
                    "conjunción",
                    "disyunción",
                    "negación",
                    "operador lógico"
                ],

                explanation: [
                    paragraph(
                        "En la lección anterior aprendimos a construir comparaciones que producen `VERDAD` o `FALSO`. Sin embargo, muchas reglas dependen de más de una condición."
                    ),

                    callout(
                        "Problema de esta lección",
                        [
                            "Para permitir el acceso se requiere:",
                            "",
                            "edad >= 18",
                            "",
                            "Y",
                            "",
                            "tener permiso",
                            "",
                            "Una sola comparación",
                            "no expresa la regla completa.",
                            "",
                            "¿Cómo combinamos ambas?"
                        ].join("\n")
                    ),

                    paragraph(
                        "Una condición compuesta combina uno o más valores o expresiones lógicas para producir un nuevo resultado lógico. En CLRS utilizamos los operadores `y`, `o` y `no`."
                    ),

                    list([
                        "`y`: combina dos condiciones y produce `VERDAD` únicamente cuando ambas son verdaderas.",
                        "`o`: combina dos condiciones y produce `VERDAD` cuando al menos una es verdadera.",
                        "`no`: invierte un valor lógico."
                    ]),

                    paragraph(
                        "La conjunción se representa mediante `y`. Es apropiada cuando una regla exige que varios requisitos se cumplan al mismo tiempo."
                    ),

                    callout(
                        "Conjunción",
                        [
                            "condición A",
                            "      y",
                            "condición B",
                            "",
                            "        →",
                            "",
                            "VERDAD solamente",
                            "si ambas se cumplen"
                        ].join("\n")
                    ),

                    paragraph(
                        "En nuestro problema podemos obtener primero cada condición de forma independiente. La comparación `edad >= 18` responde si se cumple el requisito de edad, mientras que `tienePermiso` representa el segundo requisito."
                    ),


                    callout(
                        "Cómo funciona y",
                        [
                            "VERDAD y VERDAD",
                            "→ VERDAD",
                            "",
                            "VERDAD y FALSO",
                            "→ FALSO",
                            "",
                            "FALSO y VERDAD",
                            "→ FALSO",
                            "",
                            "FALSO y FALSO",
                            "→ FALSO"
                        ].join("\n")
                    ),

                    paragraph(
                        "La disyunción se representa mediante `o`. La utilizamos cuando una regla puede cumplirse mediante una alternativa o mediante otra. Basta con que al menos una condición sea verdadera."
                    ),

                    callout(
                        "Cómo funciona o",
                        [
                            "VERDAD o VERDAD",
                            "→ VERDAD",
                            "",
                            "VERDAD o FALSO",
                            "→ VERDAD",
                            "",
                            "FALSO o VERDAD",
                            "→ VERDAD",
                            "",
                            "FALSO o FALSO",
                            "→ FALSO"
                        ].join("\n")
                    ),


                    paragraph(
                        "La negación se representa mediante `no`. A diferencia de `y` y `o`, trabaja sobre un solo valor lógico y produce su contrario."
                    ),

                    callout(
                        "Negación",
                        [
                            "no VERDAD",
                            "→ FALSO",
                            "",
                            "no FALSO",
                            "→ VERDAD"
                        ].join("\n")
                    ),


                    paragraph(
                        "Los operandos de un operador lógico pueden ser variables lógicas o expresiones que produzcan valores lógicos. Por eso una comparación puede participar directamente en una condición compuesta."
                    ),

                    callout(
                        "Expresiones dentro de expresiones",
                        [
                            "edad >= 18",
                            "→",
                            "VERDAD / FALSO",
                            "",
                            "tienePermiso",
                            "→",
                            "VERDAD / FALSO",
                            "",
                            "        → combinar",
                            "",
                            "(edad >= 18) y tienePermiso",
                            "",
                            "        →",
                            "",
                            "VERDAD / FALSO"
                        ].join("\n")
                    ),

                    paragraph(
                        "Una condición compuesta sigue siendo una expresión: se evalúa y produce un valor. La diferencia es que utiliza operaciones lógicas para representar reglas formadas por varias condiciones."
                    ),

                    paragraph(
                        "Por ahora únicamente construiremos, almacenaremos y mostraremos esos resultados. En la siguiente lección aprenderemos a utilizar un valor lógico para decidir si una instrucción debe ejecutarse o no."
                    )
                ],

                examples: [
                    clrs(
                        "lesson-022-and",
                        [
                            "edad = 20",
                            "tienePermiso = VERDAD",
                            "",
                            "cumpleEdad = edad >= 18",
                            "puedeEntrar = cumpleEdad y tienePermiso",
                            "",
                            "escribir puedeEntrar"
                        ].join("\n"),
                        "Dos requisitos simultáneos",
                        "La regla completa solo se cumple cuando tanto el requisito de edad como el permiso son verdaderos."
                    ),

                    clrs(
                        "lesson-022-or",
                        [
                            "pagaEfectivo = FALSO",
                            "pagaTarjeta = VERDAD",
                            "",
                            "puedePagar = pagaEfectivo o pagaTarjeta",
                            "",
                            "escribir puedePagar"
                        ].join("\n"),
                        "Dos alternativas válidas",
                        "La expresión produce `VERDAD` porque al menos una forma de pago está disponible."
                    ),

                    clrs(
                        "lesson-022-not",
                        [
                            "estaBloqueado = VERDAD",
                            "disponible = no estaBloqueado",
                            "",
                            "escribir disponible"
                        ].join("\n"),
                        "Negar una condición",
                        "`no` invierte el valor lógico. Como `estaBloqueado` es `VERDAD`, `disponible` recibe `FALSO`."
                    ),

                    clrs(
                        "lesson-022-direct-comparison",
                        [
                            "edad = 20",
                            "tienePermiso = VERDAD",
                            "",
                            "puedeEntrar = (edad >= 18) y tienePermiso",
                            "",
                            "escribir puedeEntrar"
                        ].join("\n"),
                        "Combinar una comparación directamente",
                        "La comparación `edad >= 18` produce un valor lógico que puede participar como operando de `y`."
                    ),

                    clrs(
                        "lesson-022-access",
                        [
                            "edad = 20",
                            "tienePermiso = VERDAD",
                            "",
                            "cumpleEdad = edad >= 18",
                            "puedeEntrar = cumpleEdad y tienePermiso",
                            "",
                            "escribir puedeEntrar"
                        ].join("\n"),
                        "Combinar dos requisitos",
                        "`cumpleEdad` y `tienePermiso` deben contener `VERDAD` para que `puedeEntrar` también produzca `VERDAD`."
                    ),

                    clrs(
                        "lesson-022-payment",
                        [
                            "pagaEfectivo = FALSO",
                            "pagaTarjeta = VERDAD",
                            "",
                            "puedePagar = pagaEfectivo o pagaTarjeta",
                            "",
                            "escribir puedePagar"
                        ].join("\n"),
                        "Representar alternativas",
                        "El pago puede realizarse porque al menos una de las dos posibilidades contiene `VERDAD`."
                    ),

                    clrs(
                        "lesson-022-negation",
                        [
                            "estaBloqueado = VERDAD",
                            "puedeUsarse = no estaBloqueado",
                            "",
                            "escribir puedeUsarse"
                        ].join("\n"),
                        "Expresar la ausencia de una condición",
                        "Como `estaBloqueado` contiene `VERDAD`, su negación produce `FALSO`."
                    ),
                ],

                knowledge: [
                    "comprender qué es una condición compuesta",
                    "comprender que una condición compuesta sigue siendo una expresión",
                    "comprender que una condición compuesta produce VERDAD o FALSO",
                    "combinar requisitos simultáneos mediante y",
                    "combinar alternativas mediante o",
                    "invertir un valor lógico mediante no",
                    "interpretar la conjunción, disyunción y negación",
                    "combinar resultados de comparaciones con valores lógicos",
                    "representar reglas formadas por varias condiciones"
                ],

                notes: [
                    callout(
                        "Operadores lógicos en otros lenguajes",
                        "La idea de conjunción, disyunción y negación es general, aunque su sintaxis cambia. Algunos lenguajes utilizan palabras y otros símbolos como &&, || o !."
                    )
                ],

                category: "FND-OPERAT"
            }),
            lesson({
                order: 23,
                section: 5,
                title: "Programación estructurada",

                objective:
                    "Comprender que el flujo de un programa puede organizarse mediante secuencia, selección e iteración, y reconocer las estructuras de control como mecanismos que permiten dirigir de forma ordenada qué instrucciones se ejecutan.",

                problemStatement:
                    "Hasta ahora nuestros programas avanzaban instrucción tras instrucción siguiendo prácticamente un único recorrido. ¿Qué ocurre cuando una acción solo debe realizarse en determinadas situaciones o cuando más adelante necesitemos repetir un conjunto de instrucciones?",

                concepts: [
                    "control de flujo",
                    "estructura de control",
                    "secuencia",
                    "selección",
                    "iteración",
                    "bloque"
                ],

                explanation: [
                    paragraph(
                        "Desde las primeras lecciones hemos seguido programas cuyo recorrido era principalmente secuencial: una instrucción se ejecutaba y después continuaba la siguiente. Este modelo permite resolver muchas tareas sencillas, pero no todos los problemas siguen siempre un único recorrido."
                    ),

                    callout(
                        "El flujo que ya conocemos",
                        [
                            "Instrucción A",
                            "     →",
                            "Instrucción B",
                            "     →",
                            "Instrucción C",
                            "     →",
                            "Fin"
                        ].join("\n")
                    ),

                    paragraph(
                        "Las comparaciones y condiciones de las lecciones anteriores nos permiten producir respuestas como `VERDAD` o `FALSO`. Sin embargo, hasta ahora esas respuestas no modificaban realmente el recorrido del programa: las almacenábamos o las mostrábamos."
                    ),

                    callout(
                        "Problema de esta lección",
                        [
                            "Tenemos una condición:",
                            "",
                            "puedeEntrar",
                            "",
                            "que puede contener:",
                            "",
                            "VERDAD",
                            "o",
                            "FALSO",
                            "",
                            "Pero ahora queremos que",
                            "esa respuesta influya en",
                            "qué instrucciones se ejecutan."
                        ].join("\n")
                    ),

                    paragraph(
                        "Controlar el flujo significa establecer reglas que determinan cómo continúa la ejecución. En lugar de disponer únicamente de una línea recta de instrucciones, podemos organizar recorridos que seleccionan acciones o que regresan para repetirlas."
                    ),

                    paragraph(
                        "La programación estructurada organiza este comportamiento mediante estructuras comprensibles y delimitadas. En esta ruta trabajaremos principalmente con tres formas fundamentales: secuencia, selección e iteración."
                    ),

                    list([
                        "Secuencia: continuar ejecutando instrucciones una después de otra.",
                        "Selección: decidir si un bloque o recorrido debe formar parte de la ejecución según una condición.",
                        "Iteración: volver a ejecutar un bloque siguiendo una regla de repetición.",
                        "Estructura de control: construcción que organiza y dirige el flujo de ejecución."
                    ]),

                    callout(
                        "Tres formas fundamentales del flujo",
                        [
                            "SECUENCIA",
                            "",
                            "A → B → C",
                            "",
                            "",
                            "SELECCIÓN",
                            "",
                            "       condición",
                            "       /      \\",
                            " ejecutar    omitir",
                            "",
                            "",
                            "ITERACIÓN",
                            "",
                            "       condición",
                            "           →",
                            "        bloque",
                            "           │",
                            "           └── puede regresar"
                        ].join("\n")
                    ),

                    paragraph(
                        "La secuencia ya la conocemos. Si ninguna estructura interviene, el flujo continúa hacia la siguiente instrucción tal como hemos hecho desde el comienzo de la ruta."
                    ),


                    paragraph(
                        "La selección introduce por primera vez la posibilidad de que una instrucción forme parte de una ejecución y de otra no. Para observar la idea utilizaremos de forma inicial la estructura `si`."
                    ),


                    paragraph(
                        "Observa que la ejecución continúa después de la estructura. Controlar el flujo no significa perder el orden: significa que ahora existen reglas que determinan qué recorrido debe seguirse."
                    ),

                    callout(
                        "La secuencia sigue existiendo",
                        [
                            "puedeEntrar = VERDAD",
                            "        →",
                            "evaluar si",
                            "        →",
                            "ejecutar o saltar el bloque",
                            "        →",
                            "continuar con \"Fin\""
                        ].join("\n")
                    ),

                    paragraph(
                        "Las instrucciones controladas por una estructura forman un bloque. En CLRS, la indentación permite reconocer visualmente qué instrucciones pertenecen a ese bloque."
                    ),

                    callout(
                        "Un bloque",
                        [
                            "si puedeEntrar",
                            "    escribir \"Acceso permitido\"",
                            "",
                            "↑ condición",
                            "",
                            "    ↑ instrucción perteneciente",
                            "      al bloque"
                        ].join("\n")
                    ),

                    paragraph(
                        "La iteración será la tercera forma fundamental. Su propósito es permitir que un bloque vuelva a ejecutarse en lugar de continuar siempre hacia adelante. Por ahora basta con reconocer la idea; aprenderemos su sintaxis y comportamiento en las lecciones dedicadas a ciclos."
                    ),

                    callout(
                        "La iteración, por ahora conceptualmente",
                        [
                            "evaluar una regla",
                            "        →",
                            "ejecutar un bloque",
                            "        →",
                            "volver a comprobar",
                            "        →",
                            "repetir o continuar"
                        ].join("\n")
                    ),

                    paragraph(
                        "No necesitamos dominar todavía selección e iteración. El objetivo de esta lección es cambiar nuestra forma de observar un programa: a partir de ahora no solo preguntaremos qué instrucciones existen, sino también qué recorrido puede seguir la ejecución."
                    ),

                    paragraph(
                        "Las siguientes lecciones desarrollarán cada estructura progresivamente. Primero estudiaremos cómo tomar una decisión mediante `si`; posteriormente elegiremos entre varias alternativas y finalmente aprenderemos distintas formas de repetición."
                    )
                ],

                examples: [
                    text(
                        "lesson-023-flow-model",
                        [
                            "HASTA AHORA",
                            "",
                            "flujo principalmente secuencial",
                            "",
                            "A → B → C",
                            "",
                            "        ↓",
                            "",
                            "A PARTIR DE AHORA",
                            "",
                            "el flujo también puede:",
                            "",
                            "SELECCIONAR",
                            "qué recorrido seguir",
                            "",
                            "o",
                            "",
                            "REPETIR",
                            "un recorrido"
                        ].join("\n"),
                        "Del flujo secuencial al control de flujo",
                        "La nueva etapa de la ruta amplía el modelo secuencial sin reemplazarlo: la secuencia continúa siendo parte fundamental de todos los programas."
                    ),

                    clrs(
                        "lesson-023-sequential-program",
                        [
                            'escribir "Inicio"',
                            'escribir "Verificando acceso"',
                            'escribir "Fin"'
                        ].join("\n"),
                        "Un único recorrido",
                        "Sin una estructura de control, todas las instrucciones participan en el mismo recorrido secuencial."
                    ),

                    clrs(
                        "lesson-023-control-preview",
                        [
                            "puedeEntrar = VERDAD",
                            "",
                            "si puedeEntrar",
                            '    escribir "Acceso permitido"',
                            "",
                            'escribir "Fin"'
                        ].join("\n"),
                        "Una primera estructura de control",
                        "`si` permite observar que una condición puede comenzar a influir en el recorrido. Su funcionamiento se desarrollará en profundidad en la siguiente lección."
                    ),

                    text(
                        "lesson-023-three-structures",
                        [
                            "SECUENCIA",
                            "hacer A",
                            "↓",
                            "hacer B",
                            "",
                            "SELECCIÓN",
                            "¿se cumple?",
                            "↙       ↘",
                            "sí       no",
                            "",
                            "ITERACIÓN",
                            "¿repetir?",
                            "↙       ↘",
                            "sí       no",
                            "↑",
                            "└── volver"
                        ].join("\n"),
                        "Tres formas de organizar la ejecución",
                        "En esta lección solo construimos el mapa general. Cada forma de control se desarrollará posteriormente."
                    ),

                    clrs(
                        "lesson-023-sequence",
                        [
                            'escribir "Inicio"',
                            'escribir "Procesando"',
                            'escribir "Fin"'
                        ].join("\n"),
                        "El recorrido secuencial conocido",
                        "Las tres instrucciones forman un único recorrido y se ejecutan una después de otra."
                    ),

                    clrs(
                        "lesson-023-first-selection",
                        [
                            "puedeEntrar = VERDAD",
                            "",
                            "si puedeEntrar",
                            '    escribir "Acceso permitido"',
                            "",
                            'escribir "Fin"'
                        ].join("\n"),
                        "Una primera modificación del flujo",
                        "Cuando `puedeEntrar` contiene `VERDAD`, el bloque asociado con `si` se ejecuta. La siguiente lección estudiará con detalle cómo funciona esta estructura."
                    ),
                ],

                knowledge: [
                    "comprender qué significa controlar el flujo de ejecución",
                    "comprender que el flujo secuencial continúa siendo la forma básica de ejecución",
                    "reconocer una estructura de control como mecanismo para organizar el recorrido del programa",
                    "reconocer la secuencia como forma de flujo",
                    "reconocer conceptualmente la selección",
                    "reconocer conceptualmente la iteración",
                    "comprender de forma introductoria qué es un bloque de instrucciones",
                    "comprender la función estructural de la indentación",
                    "reconocer de forma inicial que una condición puede influir en qué instrucciones se ejecutan"
                ],

                notes: [
                    callout(
                        "Mapa antes que detalle",
                        "Esta lección introduce el modelo general del control de flujo. `si` aparece únicamente como una primera representación de selección; su evaluación, sus recorridos y el comportamiento de sus bloques se desarrollarán en la siguiente lección."
                    ),

                    callout(
                        "Programación estructurada",
                        "La idea general es construir programas mediante estructuras de flujo comprensibles y delimitadas. En esta ruta nos concentraremos en secuencia, selección e iteración como fundamentos para organizar la ejecución."
                    )
                ],

                recommendedTools: [
                    "flowchart",
                    "execution-trace"
                ],

                category: "FND-CONTROL"
            }),
            lesson({
                order: 24,
                section: 5,
                title: "Tomar una decisión con si",

                objective:
                    "Comprender cómo una condición puede controlar el flujo de ejecución y utilizar si para ejecutar un bloque únicamente cuando esa condición produce VERDAD.",

                problemStatement:
                    "Un sistema debe mostrar \"Descuento disponible\" únicamente cuando una compra alcance al menos 1000. ¿Cómo podemos hacer que esa instrucción forme parte de la ejecución solo cuando se cumple la condición?",

                concepts: [
                    "decisión",
                    "selección",
                    "condición",
                    "bloque",
                    "si"
                ],

                explanation: [
                    paragraph(
                        "En la lección anterior descubrimos que el flujo de un programa no tiene que seguir siempre un único recorrido. Ahora aprenderemos nuestra primera estructura de selección con detalle: `si`."
                    ),

                    callout(
                        "Problema de esta lección",
                        [
                            "Regla:",
                            "",
                            "mostrar",
                            "\"Descuento disponible\"",
                            "",
                            "solo cuando:",
                            "",
                            "total >= 1000",
                            "",
                            "Si la compra no alcanza",
                            "esa cantidad, el mensaje",
                            "no debe ejecutarse."
                        ].join("\n")
                    ),

                    paragraph(
                        "La estructura `si` permite condicionar la ejecución de un bloque. Primero evalúa una expresión lógica y después utiliza su resultado para determinar si las instrucciones del bloque deben formar parte del recorrido."
                    ),

                    callout(
                        "Modelo de una decisión",
                        [
                            "condición",
                            "",
                            "total >= 1000",
                            "",
                            "        → evaluar",
                            "",
                            "VERDAD o FALSO",
                            "",
                            "        →",
                            "",
                            "VERDAD",
                            "→ ejecutar el bloque",
                            "",
                            "FALSO",
                            "→ omitir el bloque",
                            "",
                            "        →",
                            "",
                            "continuar"
                        ].join("\n")
                    ),

                    paragraph(
                        "Si la condición produce `VERDAD`, las instrucciones pertenecientes al bloque de `si` se ejecutan. Cuando terminan, el programa continúa con la primera instrucción situada después de la estructura."
                    ),


                    paragraph(
                        "Si la condición produce `FALSO`, el bloque se omite completamente. La ejecución no se detiene: continúa directamente con la primera instrucción posterior a la estructura."
                    ),


                    callout(
                        "Dos recorridos posibles",
                        [
                            "total >= 1000",
                            "",
                            "       /      \\",
                            " VERDAD        FALSO",
                            "    →            →",
                            "ejecutar       omitir",
                            " bloque         bloque",
                            "       \\      /",
                            "        continuar"
                        ].join("\n")
                    ),

                    paragraph(
                        "Las instrucciones controladas por `si` forman un bloque. En CLRS, la indentación indica qué instrucciones pertenecen a ese bloque."
                    ),

                    callout(
                        "La indentación delimita el bloque",
                        [
                            "si total >= 1000",
                            "    escribir \"Descuento disponible\"",
                            "    escribir \"Beneficio aplicado\"",
                            "",
                            "escribir \"Compra procesada\"",
                            "",
                            "Las dos instrucciones indentadas",
                            "dependen de la condición.",
                            "",
                            "La última se encuentra",
                            "fuera del bloque."
                        ].join("\n")
                    ),

                    paragraph(
                        "Esto significa que la posición y la indentación forman parte de la estructura del programa. Una instrucción situada fuera del bloque se ejecuta después de la decisión independientemente de que la condición haya sido verdadera o falsa."
                    ),

                    paragraph(
                        "La condición de `si` debe producir un valor lógico. Puede ser una comparación, una variable lógica o una condición compuesta como las estudiadas anteriormente."
                    ),



                    paragraph(
                        "Una estructura `si` representa una selección simple: existe una acción que debe ejecutarse únicamente cuando se cumple una regla. Si la regla no se cumple, simplemente continuamos sin ejecutar ese bloque."
                    ),

                    paragraph(
                        "En la siguiente lección resolveremos una necesidad diferente: situaciones en las que no basta con ejecutar u omitir un bloque, sino que debemos elegir obligatoriamente entre dos o más alternativas."
                    )
                ],

                examples: [
                    clrs(
                        "lesson-024-discount",
                        [
                            "total = 1200",
                            "",
                            "si total >= 1000",
                            '    escribir "Descuento disponible"',
                            "",
                            'escribir "Compra procesada"'
                        ].join("\n"),
                        "Ejecutar una acción cuando se cumple una regla",
                        "El mensaje de descuento depende de la comparación. La última instrucción pertenece nuevamente al flujo común."
                    ),

                    text(
                        "lesson-024-flow",
                        [
                            "total >= 1000",
                            "",
                            "        ↓",
                            "",
                            "¿VERDAD?",
                            "",
                            "sí",
                            "↓",
                            "mostrar descuento",
                            "↓",
                            "continuar",
                            "",
                            "no",
                            "↓",
                            "continuar"
                        ].join("\n"),
                        "Seguir el flujo de si",
                        "Los recorridos pueden diferir temporalmente, pero ambos vuelven a encontrarse después de la estructura."
                    ),

                    clrs(
                        "lesson-024-two-instructions",
                        [
                            "total = 1500",
                            "",
                            "si total >= 1000",
                            '    escribir "Descuento disponible"',
                            '    escribir "Beneficio aplicado"',
                            "",
                            'escribir "Fin"'
                        ].join("\n"),
                        "Un bloque puede contener varias instrucciones",
                        "Todas las instrucciones indentadas dependen del mismo resultado lógico."
                    ),

                    clrs(
                        "lesson-024-compound",
                        [
                            "edad = 20",
                            "tienePermiso = VERDAD",
                            "",
                            "si (edad >= 18) y tienePermiso",
                            '    escribir "Acceso permitido"'
                        ].join("\n"),
                        "Reutilizar condiciones compuestas",
                        "Una expresión lógica aprendida anteriormente puede controlar directamente una selección."
                    ),

                    clrs(
                        "lesson-024-true",
                        [
                            "total = 1200",
                            "",
                            "si total >= 1000",
                            '    escribir "Descuento disponible"',
                            "",
                            'escribir "Compra procesada"'
                        ].join("\n"),
                        "Cuando la condición es verdadera",
                        "`total >= 1000` produce `VERDAD`, por lo que el mensaje del bloque se muestra. Después se continúa con `Compra procesada`."
                    ),

                    clrs(
                        "lesson-024-false",
                        [
                            "total = 700",
                            "",
                            "si total >= 1000",
                            '    escribir "Descuento disponible"',
                            "",
                            'escribir "Compra procesada"'
                        ].join("\n"),
                        "Cuando la condición es falsa",
                        "La comparación produce `FALSO`, por lo que `Descuento disponible` no se ejecuta. El programa continúa con la instrucción posterior."
                    ),

                    clrs(
                        "lesson-024-logical-condition",
                        [
                            "tieneBeneficio = VERDAD",
                            "",
                            "si tieneBeneficio",
                            '    escribir "Beneficio disponible"'
                        ].join("\n"),
                        "Utilizar una variable lógica",
                        "Como `tieneBeneficio` ya contiene un valor lógico, puede utilizarse directamente como condición."
                    ),

                    clrs(
                        "lesson-024-compound-condition",
                        [
                            "total = 1200",
                            "clienteFrecuente = VERDAD",
                            "",
                            "si (total >= 1000) y clienteFrecuente",
                            '    escribir "Descuento especial"'
                        ].join("\n"),
                        "Utilizar una condición compuesta",
                        "La selección puede utilizar directamente una expresión lógica construida a partir de varias condiciones."
                    ),
                ],

                knowledge: [
                    "comprender cómo una condición controla el flujo mediante si",
                    "comprender la selección simple",
                    "utilizar una comparación como condición de si",
                    "utilizar una variable lógica como condición de si",
                    "utilizar una condición compuesta como condición de si",
                    "ejecutar un bloque cuando una condición produce VERDAD",
                    "omitir un bloque cuando una condición produce FALSO",
                    "comprender que ambos recorridos continúan después de la estructura",
                    "reconocer mediante la indentación qué instrucciones pertenecen al bloque",
                    "comprender que un bloque puede contener varias instrucciones"
                ],

                notes: [
                    callout(
                        "Una sola alternativa",
                        "En esta lección `si` responde a una pregunta sencilla: ejecutar o no ejecutar un bloque. Todavía no utilizamos `sino` ni `sino si`; esas construcciones aparecerán cuando necesitemos elegir explícitamente entre varias alternativas."
                    )
                ],

                recommendedTools: [
                    "flowchart",
                    "execution-trace"
                ],

                category: "FND-CONTROL"
            }),
            lesson({
                order: 25,
                section: 5,
                title: "Elegir entre varias alternativas",

                objective:
                    "Comprender cómo una cadena de decisión permite elegir una sola alternativa entre varias mediante si, sino si y sino, evaluando las condiciones en un orden determinado.",

                problemStatement:
                    "Un sistema debe clasificar una calificación como \"Excelente\", \"Aprobado\" o \"Reprobado\". Como debe producir una sola categoría, ¿cómo podemos evaluar varias condiciones y ejecutar únicamente la primera alternativa que corresponda?",

                concepts: [
                    "cadena de decisión",
                    "alternativa",
                    "rama",
                    "sino si",
                    "sino",
                    "orden de evaluación"
                ],

                explanation: [
                    paragraph(
                        "En la lección anterior utilizamos `si` para resolver una decisión sencilla: ejecutar un bloque cuando una condición es verdadera o simplemente omitirlo cuando es falsa. Sin embargo, algunos problemas necesitan elegir explícitamente una respuesta entre varias posibilidades."
                    ),

                    callout(
                        "Problema de esta lección",
                        [
                            "Tenemos una calificación:",
                            "",
                            "nota → 85",
                            "",
                            "Debemos elegir una sola categoría:",
                            "",
                            "90 o más",
                            "→ Excelente",
                            "",
                            "70 a 89",
                            "→ Aprobado",
                            "",
                            "menos de 70",
                            "→ Reprobado",
                            "",
                            "¿Cómo hacemos que solamente",
                            "una alternativa se ejecute?"
                        ].join("\n")
                    ),

                    paragraph(
                        "Para representar esta clase de decisión, CLRS permite formar una cadena con `si`, uno o más `sino si` y, cuando sea necesario, un `sino` final."
                    ),

                    callout(
                        "Una cadena de alternativas",
                        [
                            "si condición 1",
                            "    alternativa 1",
                            "sino si condición 2",
                            "    alternativa 2",
                            "sino",
                            "    alternativa restante"
                        ].join("\n")
                    ),

                    paragraph(
                        "La evaluación comienza por la condición de `si`. Si produce `VERDAD`, se ejecuta su bloque y la cadena termina: las condiciones posteriores ya no necesitan evaluarse."
                    ),

                    paragraph(
                        "Si la primera condición produce `FALSO`, el programa continúa con el siguiente `sino si`. Cada condición adicional solamente se evalúa cuando ninguna de las anteriores fue verdadera."
                    ),

                    callout(
                        "Evaluar hasta encontrar una alternativa",
                        [
                            "condición 1",
                            "   →",
                            "¿VERDAD?",
                            "   ├─ sí → ejecutar rama 1",
                            "   │        y salir de la cadena",
                            "   │",
                            "   └─ no",
                            "       →",
                            "   condición 2",
                            "       →",
                            "   ¿VERDAD?",
                            "       ├─ sí → ejecutar rama 2",
                            "       └─ no → continuar"
                        ].join("\n")
                    ),

                    paragraph(
                        "`sino` representa el caso restante. No necesita una condición porque solamente puede alcanzarse cuando todas las condiciones anteriores de la misma cadena produjeron `FALSO`."
                    ),


                    callout(
                        "Seguir el caso de nota = 85",
                        [
                            "¿85 >= 90?",
                            "→ FALSO",
                            "",
                            "        →",
                            "",
                            "¿85 >= 70?",
                            "→ VERDAD",
                            "",
                            "        →",
                            "",
                            "Ejecutar:",
                            "\"Aprobado\"",
                            "",
                            "        →",
                            "",
                            "No evaluar más alternativas"
                        ].join("\n")
                    ),

                    paragraph(
                        "Una cadena de decisión selecciona como máximo una rama. Este comportamiento resulta apropiado cuando las alternativas representan resultados mutuamente excluyentes, como asignar una sola categoría a una calificación."
                    ),

                    paragraph(
                        "El orden de las condiciones es parte de la lógica. Una condición demasiado general colocada antes puede capturar un caso que debería haber llegado a una condición más específica."
                    ),

                    callout(
                        "El orden importa",
                        [
                            "Orden correcto:",
                            "",
                            "si nota >= 90",
                            "    Excelente",
                            "sino si nota >= 70",
                            "    Aprobado",
                            "",
                            "----------------",
                            "",
                            "Orden problemático:",
                            "",
                            "si nota >= 70",
                            "    Aprobado",
                            "sino si nota >= 90",
                            "    Excelente",
                            "",
                            "Una nota de 95 cumpliría",
                            "la primera condición y nunca",
                            "alcanzaría \"Excelente\"."
                        ].join("\n")
                    ),

                    paragraph(
                        "Esto ocurre porque `sino si` no representa decisiones independientes. Cada nueva condición depende de que todas las anteriores hayan producido `FALSO`."
                    ),

                    paragraph(
                        "Por esa razón, una cadena `si / sino si / sino` debe distinguirse de varios `si` separados. Con varios `si`, cada condición se evalúa como una decisión independiente y más de un bloque puede ejecutarse."
                    ),


                    callout(
                        "Cadena o decisiones independientes",
                        [
                            "si / sino si / sino",
                            "",
                            "→ alternativas relacionadas",
                            "→ como máximo una rama",
                            "",
                            "varios si",
                            "",
                            "→ decisiones independientes",
                            "→ pueden ejecutarse varios bloques"
                        ].join("\n")
                    ),

                    paragraph(
                        "La decisión debe modelar correctamente el problema. Cuando necesitamos elegir una sola categoría entre varias, una cadena de alternativas suele expresar mejor esa relación que varias decisiones independientes."
                    ),

                    paragraph(
                        "Con `si`, `sino si` y `sino` ya podemos construir recorridos diferentes según distintas condiciones. La siguiente etapa introducirá otro cambio en el flujo: en lugar de elegir únicamente qué ejecutar, aprenderemos a hacer que un bloque vuelva a ejecutarse."
                    )
                ],

                examples: [
                    clrs(
                        "lesson-025-category",
                        [
                            "nota = 85",
                            "",
                            "si nota >= 90",
                            '    escribir "Excelente"',
                            "sino si nota >= 70",
                            '    escribir "Aprobado"',
                            "sino",
                            '    escribir "Reprobado"'
                        ].join("\n"),
                        "Elegir una sola categoría",
                        "Las condiciones se evalúan en orden y solamente se ejecuta la primera rama aplicable."
                    ),

                    clrs(
                        "lesson-025-temperature",
                        [
                            "temperatura = 12",
                            "",
                            "si temperatura >= 30",
                            '    escribir "Calor"',
                            "sino si temperatura >= 20",
                            '    escribir "Templado"',
                            "sino",
                            '    escribir "Frio"'
                        ].join("\n"),
                        "Utilizar un caso restante",
                        "`sino` cubre cualquier temperatura que no haya cumplido ninguna condición anterior."
                    ),

                    text(
                        "lesson-025-order",
                        [
                            "nota = 95",
                            "",
                            "CORRECTO",
                            "",
                            "¿nota >= 90?",
                            "→ VERDAD",
                            "→ Excelente",
                            "",
                            "INCORRECTO",
                            "",
                            "¿nota >= 70?",
                            "→ VERDAD",
                            "→ Aprobado",
                            "",
                            "La condición más general",
                            "impide alcanzar la específica."
                        ].join("\n"),
                        "El orden modifica la clasificación",
                        "Cuando varias condiciones pueden cumplirse simultáneamente, colocar primero la condición adecuada es parte esencial de la solución."
                    ),

                    clrs(
                        "lesson-025-independent",
                        [
                            "numero = 10",
                            "",
                            "si numero > 0",
                            '    escribir "Positivo"',
                            "",
                            "si numero == 10",
                            '    escribir "Es diez"'
                        ].join("\n"),
                        "No toda decisión forma una cadena",
                        "Las dos preguntas son independientes, por lo que ambas pueden producir acciones."
                    ),

                    clrs(
                        "lesson-025-grades",
                        [
                            "nota = 85",
                            "",
                            "si nota >= 90",
                            '    escribir "Excelente"',
                            "sino si nota >= 70",
                            '    escribir "Aprobado"',
                            "sino",
                            '    escribir "Reprobado"'
                        ].join("\n"),
                        "Clasificar una calificación",
                        "La primera comparación produce `FALSO`. La segunda produce `VERDAD`, por lo que se ejecuta únicamente `Aprobado` y la cadena termina."
                    ),

                    clrs(
                        "lesson-025-independent-if",
                        [
                            "numero = 10",
                            "",
                            "si numero > 0",
                            '    escribir "Positivo"',
                            "",
                            "si numero == 10",
                            '    escribir "Es diez"'
                        ].join("\n"),
                        "Dos decisiones independientes",
                        "Las dos condiciones se evalúan por separado. Como ambas son verdaderas, ambos mensajes pueden mostrarse."
                    ),
                ],

                knowledge: [
                    "comprender qué es una cadena de decisión",
                    "utilizar si como primera alternativa",
                    "utilizar sino si para representar alternativas condicionadas adicionales",
                    "utilizar sino para representar el caso restante",
                    "comprender que las condiciones de una cadena se evalúan en orden",
                    "comprender que se ejecuta la primera alternativa cuya condición produce VERDAD",
                    "comprender que una cadena ejecuta como máximo una de sus ramas",
                    "reconocer que el orden de las condiciones puede modificar el resultado",
                    "diferenciar una cadena si-sino si-sino de varios si independientes",
                    "elegir entre varias categorías mediante condiciones ordenadas"
                ],

                notes: [
                    callout(
                        "Otras estructuras de selección",
                        "Otros lenguajes pueden ofrecer construcciones como switch, case o match para ciertos tipos de selección. La idea transferible es distinguir cuándo varias alternativas forman una única elección y cuándo representan decisiones independientes."
                    )
                ],

                recommendedTools: [
                    "flowchart",
                    "execution-trace"
                ],

                category: "FND-CONTROL"
            }),
            lesson({
                order: 26,
                section: 5,
                title: "Repetición con mientras",

                objective:
                    "Comprender cómo mientras repite un bloque mientras una condición produzca VERDAD, y cómo el cambio del estado permite que la repetición avance hasta terminar.",

                problemStatement:
                    "Un programa debe mostrar una cuenta regresiva desde 3 hasta 1. ¿Cómo podemos repetir las mismas instrucciones mientras todavía quede un número por mostrar, sin escribir el bloque tres veces?",

                concepts: [
                    "iteración",
                    "ciclo",
                    "mientras",
                    "condición de continuación",
                    "actualización",
                    "terminación"
                ],

                explanation: [
                    paragraph(
                        "En las últimas lecciones aprendimos a modificar el flujo mediante decisiones: dependiendo de una condición, un bloque podía ejecutarse, omitirse o competir con otras alternativas. Ahora estudiaremos otra forma de control presentada conceptualmente al inicio de esta sección: la iteración."
                    ),

                    callout(
                        "Problema de esta lección",
                        [
                            "Queremos producir:",
                            "",
                            "3",
                            "2",
                            "1",
                            "",
                            "Podríamos escribir tres",
                            "instrucciones diferentes...",
                            "",
                            "pero la acción es esencialmente",
                            "la misma:",
                            "",
                            "mostrar el valor actual",
                            "y avanzar al siguiente estado.",
                            "",
                            "¿Cómo podemos repetirla?"
                        ].join("\n")
                    ),

                    paragraph(
                        "Una iteración permite que un bloque vuelva a ejecutarse. En CLRS, la estructura `mientras` expresa una repetición controlada por una condición lógica."
                    ),

                    paragraph(
                        "`mientras` comienza evaluando su condición. Si produce `VERDAD`, el bloque se ejecuta. Al terminar el bloque, el flujo regresa a la condición y vuelve a evaluarla utilizando el estado actual del programa."
                    ),

                    callout(
                        "Flujo de mientras",
                        [
                            "evaluar condición",
                            "        →",
                            "¿VERDAD?",
                            "     /       \\",
                            "   sí         no",
                            "   →           →",
                            "ejecutar     continuar",
                            " bloque",
                            "   →",
                            "cambiar estado",
                            "   →",
                            "volver a evaluar"
                        ].join("\n")
                    ),

                    paragraph(
                        "Cada vez que el bloque se ejecuta completamente hablamos de una iteración. Un mismo ciclo puede realizar muchas iteraciones, una sola o ninguna."
                    ),

                    paragraph(
                        "Para resolver nuestra cuenta regresiva necesitamos representar el valor actual. Comenzaremos en 3, mostraremos ese valor y después lo reduciremos antes de volver a comprobar la condición."
                    ),


                    callout(
                        "Tres elementos fundamentales",
                        [
                            "ESTADO INICIAL",
                            "",
                            "numero = 3",
                            "",
                            "        →",
                            "",
                            "CONDICIÓN",
                            "",
                            "numero > 0",
                            "",
                            "        →",
                            "",
                            "ACTUALIZACIÓN",
                            "",
                            "numero = numero - 1"
                        ].join("\n")
                    ),

                    paragraph(
                        "El estado inicial determina desde qué situación comienza la repetición. La condición responde si debe ejecutarse otra iteración. La actualización modifica información relacionada con esa condición."
                    ),

                    paragraph(
                        "Podemos seguir la ejecución observando cómo cambia el valor de `numero` después de cada iteración."
                    ),

                    callout(
                        "Traza de la cuenta regresiva",
                        [
                            "numero = 3",
                            "3 > 0 → VERDAD",
                            "mostrar 3",
                            "numero pasa a 2",
                            "",
                            "numero = 2",
                            "2 > 0 → VERDAD",
                            "mostrar 2",
                            "numero pasa a 1",
                            "",
                            "numero = 1",
                            "1 > 0 → VERDAD",
                            "mostrar 1",
                            "numero pasa a 0",
                            "",
                            "numero = 0",
                            "0 > 0 → FALSO",
                            "terminar el ciclo"
                        ].join("\n")
                    ),

                    paragraph(
                        "Esta traza muestra una relación importante: después de modificar el estado, `mientras` no continúa automáticamente ejecutando el bloque. Primero regresa a la condición y vuelve a evaluarla."
                    ),

                    callout(
                        "Una iteración",
                        [
                            "evaluar condición",
                            "        →",
                            "ejecutar bloque",
                            "        →",
                            "actualizar estado",
                            "        →",
                            "volver a la condición"
                        ].join("\n")
                    ),

                    paragraph(
                        "Como la condición se evalúa antes de entrar al bloque, también es posible que un ciclo `mientras` realice cero iteraciones. Esto ocurre cuando la condición ya es falsa desde el principio."
                    ),


                    paragraph(
                        "La actualización es especialmente importante porque puede acercar el estado hacia la terminación. En la cuenta regresiva, cada iteración disminuye `numero` hasta alcanzar 0."
                    ),

                    paragraph(
                        "Si una condición permanece verdadera y nada modifica el estado necesario para hacerla falsa, el programa puede continuar repitiendo el bloque indefinidamente."
                    ),

                    callout(
                        "Un ciclo que no avanza",
                        [
                            "numero = 3",
                            "",
                            "mientras numero > 0",
                            "    escribir numero",
                            "",
                            "numero nunca cambia",
                            "",
                            "        →",
                            "",
                            "numero > 0",
                            "continúa siendo VERDAD",
                            "",
                            "        →",
                            "",
                            "el ciclo no termina"
                        ].join("\n")
                    ),

                    paragraph(
                        "Por eso, antes de construir un `mientras` conviene poder responder tres preguntas: ¿qué condición permite seguir repitiendo?, ¿qué cambia durante cada iteración? y ¿qué hará que finalmente la condición produzca `FALSO`?"
                    ),

                    paragraph(
                        "En esta lección utilizamos una variable para controlar el avance de la repetición. En la siguiente estudiaremos un patrón diferente: utilizar una variable específicamente para registrar cuántas veces ocurre algo."
                    )
                ],

                examples: [
                    clrs(
                        "lesson-026-while",
                        [
                            "numero = 3",
                            "",
                            "mientras numero > 0",
                            "    escribir numero",
                            "    numero = numero - 1",
                            "",
                            'escribir "Fin"'
                        ].join("\n"),
                        "Repetir hasta alcanzar un estado final",
                        "La condición permite repetir mientras `numero` sea mayor que cero. La actualización hace que el ciclo avance hacia su terminación."
                    ),

                    text(
                        "lesson-026-trace",
                        [
                            "numero = 3",
                            "↓",
                            "3 > 0 → VERDAD",
                            "↓",
                            "mostrar 3",
                            "↓",
                            "numero = 2",
                            "",
                            "2 > 0 → VERDAD",
                            "↓",
                            "mostrar 2",
                            "↓",
                            "numero = 1",
                            "",
                            "1 > 0 → VERDAD",
                            "↓",
                            "mostrar 1",
                            "↓",
                            "numero = 0",
                            "",
                            "0 > 0 → FALSO",
                            "↓",
                            "Fin"
                        ].join("\n"),
                        "Seguir el ciclo paso a paso",
                        "Cada nueva evaluación utiliza el estado producido por la iteración anterior."
                    ),

                    clrs(
                        "lesson-026-zero",
                        [
                            "numero = 0",
                            "",
                            "mientras numero > 0",
                            '    escribir "Repetición"',
                            "    numero = numero - 1",
                            "",
                            'escribir "Fin"'
                        ].join("\n"),
                        "Cero iteraciones",
                        "Como la condición es falsa antes de la primera entrada al bloque, únicamente se muestra `Fin`."
                    ),

                    clrs(
                        "lesson-026-ascending",
                        [
                            "numero = 1",
                            "",
                            "mientras numero <= 3",
                            "    escribir numero",
                            "    numero = numero + 1"
                        ].join("\n"),
                        "El estado también puede avanzar en otra dirección",
                        "La actualización aumenta `numero`. El ciclo termina cuando el valor pasa de 3 y la condición deja de cumplirse."
                    ),

                    clrs(
                        "lesson-026-countdown",
                        [
                            "numero = 3",
                            "",
                            "mientras numero > 0",
                            "    escribir numero",
                            "    numero = numero - 1",
                            "",
                            'escribir "Fin"'
                        ].join("\n"),
                        "Una cuenta regresiva",
                        "Mientras `numero > 0` sea verdadero, el bloque se ejecuta. Cada iteración disminuye `numero`, acercando el programa al momento en que la condición será falsa."
                    ),

                    clrs(
                        "lesson-026-zero-iterations",
                        [
                            "numero = 0",
                            "",
                            "mientras numero > 0",
                            "    escribir numero",
                            "    numero = numero - 1",
                            "",
                            'escribir "Fin"'
                        ].join("\n"),
                        "Un ciclo puede no ejecutarse",
                        "Como `numero > 0` produce `FALSO` desde la primera comprobación, el bloque se omite y la ejecución continúa directamente con `Fin`."
                    ),
                ],

                knowledge: [
                    "comprender qué es una iteración",
                    "comprender qué es un ciclo",
                    "utilizar mientras para repetir un bloque",
                    "comprender que la condición se evalúa antes de cada iteración",
                    "comprender que mientras vuelve a evaluar la condición después de ejecutar el bloque",
                    "comprender que un ciclo mientras puede realizar cero iteraciones",
                    "identificar el estado inicial de una repetición",
                    "identificar la condición que permite continuar",
                    "actualizar el estado dentro de una repetición",
                    "comprender cómo una actualización puede conducir hacia la terminación",
                    "seguir paso a paso las iteraciones de un ciclo sencillo",
                    "reconocer un ciclo que puede no terminar"
                ],

                notes: [
                    callout(
                        "Otras formas de repetición",
                        "Los lenguajes pueden ofrecer diferentes estructuras de iteración. En esta ruta aprenderemos posteriormente `para`, que resulta apropiado para determinadas repeticiones controladas por un recorrido conocido."
                    )
                ],

                recommendedTools: [
                    "flowchart",
                    "execution-trace",
                    "debugger"
                ],

                category: "FND-CONTROL"
            }),
            lesson({
                order: 27,
                section: 5,
                title: "Contadores",

                objective:
                    "Comprender cómo una variable puede registrar cuántas veces ocurre un evento, inicializándose antes de una repetición e incrementándose únicamente cuando aparece el caso que se desea contar.",

                problemStatement:
                    "Un programa recorre los valores desde -2 hasta 2 y necesita saber cuántos de ellos son positivos. El ciclo permite examinarlos uno por uno, pero ¿cómo podemos conservar la cantidad de casos positivos encontrados durante todo el recorrido?",

                concepts: [
                    "contador",
                    "conteo",
                    "evento",
                    "incremento"
                ],

                explanation: [
                    paragraph(
                        "En la lección anterior aprendimos a repetir un bloque mediante `mientras` y a modificar el estado para que la repetición avance. Sin embargo, recorrer varios casos plantea una nueva necesidad: puede interesarnos saber cuántas veces ocurrió algo durante ese recorrido."
                    ),

                    callout(
                        "Problema de esta lección",
                        [
                            "Recorremos:",
                            "",
                            "-2, -1, 0, 1, 2",
                            "",
                            "Queremos responder:",
                            "",
                            "¿cuántos valores",
                            "son positivos?",
                            "",
                            "El ciclo permite examinarlos,",
                            "pero necesitamos conservar",
                            "la cantidad encontrada."
                        ].join("\n")
                    ),

                    paragraph(
                        "Un contador es una variable cuyo propósito es registrar cuántas veces ocurre determinado evento. No es una estructura especial de CLRS: es un patrón construido mediante una variable, una condición cuando sea necesaria y una actualización."
                    ),

                    paragraph(
                        "Normalmente un contador comienza en `0`, porque antes de examinar los casos todavía no hemos registrado ninguna ocurrencia."
                    ),

                    callout(
                        "Patrón básico de un contador",
                        [
                            "contador = 0",
                            "",
                            "        →",
                            "",
                            "cuando ocurre el evento",
                            "",
                            "        →",
                            "",
                            "contador = contador + 1"
                        ].join("\n")
                    ),

                    paragraph(
                        "La actualización `contador = contador + 1` utiliza el valor actual del contador, suma una nueva ocurrencia y reasigna el resultado a la misma variable."
                    ),

                    callout(
                        "Registrar una nueva ocurrencia",
                        [
                            "positivos = 1",
                            "",
                            "aparece otro positivo",
                            "",
                            "        →",
                            "",
                            "positivos = positivos + 1",
                            "",
                            "        →",
                            "",
                            "positivos = 2"
                        ].join("\n")
                    ),

                    paragraph(
                        "En nuestro problema no queremos contar todas las iteraciones. Queremos contar únicamente aquellas en las que el valor actual es mayor que cero. Por eso el incremento debe encontrarse dentro de una decisión."
                    ),


                    paragraph(
                        "Este ejemplo utiliza dos variables que cambian durante el ciclo, pero cada una tiene una responsabilidad diferente."
                    ),

                    callout(
                        "Dos responsabilidades distintas",
                        [
                            "numero",
                            "",
                            "→ representa el valor actual",
                            "→ hace avanzar el recorrido",
                            "",
                            "----------------",
                            "",
                            "positivos",
                            "",
                            "→ registra ocurrencias",
                            "→ aumenta únicamente",
                            "  cuando aparece un positivo"
                        ].join("\n")
                    ),

                    paragraph(
                        "Podemos seguir el contador observando únicamente los momentos en los que ocurre el evento de interés."
                    ),

                    callout(
                        "Traza del conteo",
                        [
                            "numero = -2",
                            "¿es positivo? → no",
                            "positivos = 0",
                            "",
                            "numero = -1",
                            "¿es positivo? → no",
                            "positivos = 0",
                            "",
                            "numero = 0",
                            "¿es positivo? → no",
                            "positivos = 0",
                            "",
                            "numero = 1",
                            "¿es positivo? → sí",
                            "positivos = 1",
                            "",
                            "numero = 2",
                            "¿es positivo? → sí",
                            "positivos = 2",
                            "",
                            "Resultado final:",
                            "2 positivos"
                        ].join("\n")
                    ),

                    paragraph(
                        "La posición del incremento es esencial. Si escribiéramos `positivos = positivos + 1` fuera de `si`, el programa aumentaría el contador en todas las iteraciones y dejaría de representar la cantidad de números positivos."
                    ),

                    callout(
                        "¿Qué estamos contando?",
                        [
                            "Incrementar siempre",
                            "→ contar todas las iteraciones",
                            "",
                            "Incrementar solo si ocurre algo",
                            "→ contar ese evento"
                        ].join("\n")
                    ),

                    paragraph(
                        "Contar cada iteración también es válido cuando esa es realmente la información que necesitamos. En ese caso, el contador se incrementa una vez en cada vuelta del ciclo."
                    ),


                    paragraph(
                        "El valor final de un contador tiene significado porque cada incremento corresponde exactamente a una ocurrencia del evento definido por el problema."
                    ),

                    paragraph(
                        "Por eso, antes de utilizar un contador conviene responder dos preguntas: ¿qué acontecimiento quiero contar? y ¿en qué momento exacto debo incrementar la variable?"
                    ),

                    paragraph(
                        "En la siguiente lección estudiaremos un patrón parecido. En lugar de registrar cuántas veces ocurre algo, necesitaremos conservar un resultado que se construye progresivamente a partir de diferentes cantidades."
                    )
                ],

                examples: [
                    clrs(
                        "lesson-027-count-condition",
                        [
                            "numero = -2",
                            "positivos = 0",
                            "",
                            "mientras numero <= 2",
                            "    si numero > 0",
                            "        positivos = positivos + 1",
                            "",
                            "    numero = numero + 1",
                            "",
                            "escribir positivos"
                        ].join("\n"),
                        "Contar casos que cumplen una condición",
                        "El ciclo examina cinco valores, pero el contador únicamente registra los dos que son positivos."
                    ),

                    text(
                        "lesson-027-counter-trace",
                        [
                            "positivos = 0",
                            "",
                            "-2 → no contar → 0",
                            "-1 → no contar → 0",
                            " 0 → no contar → 0",
                            " 1 → contar    → 1",
                            " 2 → contar    → 2",
                            "",
                            "Resultado:",
                            "positivos = 2"
                        ].join("\n"),
                        "El contador conserva la cantidad encontrada",
                        "Cada incremento corresponde a una nueva ocurrencia del evento que estamos registrando."
                    ),

                    clrs(
                        "lesson-027-all-iterations",
                        [
                            "numero = 1",
                            "vueltas = 0",
                            "",
                            "mientras numero <= 3",
                            "    vueltas = vueltas + 1",
                            "    numero = numero + 1",
                            "",
                            "escribir vueltas"
                        ].join("\n"),
                        "Contar cada vuelta",
                        "Cuando el evento de interés es simplemente realizar una iteración, el contador aumenta en cada ejecución del bloque."
                    ),

                    clrs(
                        "lesson-027-no-events",
                        [
                            "numero = -3",
                            "positivos = 0",
                            "",
                            "mientras numero <= 0",
                            "    si numero > 0",
                            "        positivos = positivos + 1",
                            "",
                            "    numero = numero + 1",
                            "",
                            "escribir positivos"
                        ].join("\n"),
                        "También pueden ocurrir cero eventos",
                        "Aunque el ciclo sí realiza varias iteraciones, ninguna cumple la condición. Por eso el contador conserva su valor inicial 0."
                    ),

                    clrs(
                        "lesson-027-positive-counter",
                        [
                            "numero = -2",
                            "positivos = 0",
                            "",
                            "mientras numero <= 2",
                            "    si numero > 0",
                            "        positivos = positivos + 1",
                            "",
                            "    numero = numero + 1",
                            "",
                            "escribir positivos"
                        ].join("\n"),
                        "Contar únicamente los valores positivos",
                        "`numero` permite avanzar por los valores del recorrido. `positivos` solamente cambia cuando el valor examinado cumple `numero > 0`. Al finalizar, contiene 2."
                    ),

                    clrs(
                        "lesson-027-count-iterations",
                        [
                            "numero = 1",
                            "vueltas = 0",
                            "",
                            "mientras numero <= 3",
                            "    vueltas = vueltas + 1",
                            "    numero = numero + 1",
                            "",
                            "escribir vueltas"
                        ].join("\n"),
                        "Contar todas las iteraciones",
                        "Como `vueltas` aumenta una vez en cada ejecución del bloque, su valor final indica cuántas iteraciones fueron realizadas."
                    ),
                ],

                knowledge: [
                    "comprender qué es un contador",
                    "comprender que contador describe una responsabilidad de una variable y no una estructura especial del lenguaje",
                    "inicializar un contador antes de comenzar el conteo",
                    "comprender el patrón contador = contador + 1",
                    "registrar una nueva ocurrencia mediante un incremento",
                    "incrementar un contador únicamente cuando ocurre el evento de interés",
                    "utilizar una condición para decidir cuándo incrementar un contador",
                    "utilizar contadores dentro de una repetición",
                    "distinguir un contador de una variable que hace avanzar el ciclo",
                    "interpretar el valor final de un contador como la cantidad de ocurrencias registradas"
                ],

                notes: [
                    callout(
                        "Formas abreviadas en otros lenguajes",
                        "Algunos lenguajes permiten escribir incrementos mediante formas como `i++` o `i += 1`. En CLRS utilizamos `i = i + 1`, lo que mantiene explícitos el valor anterior, el cálculo del nuevo valor y la reasignación."
                    )
                ],

                recommendedTools: [
                    "execution-trace",
                    "debugger"
                ],

                category: "FND-CONTROL"
            }),
            lesson({
                order: 28,
                section: 5,
                title: "Acumuladores",

                objective:
                    "Comprender cómo una variable puede conservar un resultado parcial y actualizarlo progresivamente al incorporar nuevos valores durante una repetición.",

                problemStatement:
                    "Un programa debe recibir tres cantidades y mostrar su suma total al terminar. Como los valores llegan uno después de otro, ¿cómo podemos conservar lo acumulado hasta el momento e incorporar cada nueva cantidad sin perder el resultado anterior?",

                concepts: [
                    "acumulador",
                    "acumulación",
                    "resultado parcial",
                    "actualización progresiva"
                ],

                explanation: [
                    paragraph(
                        "En la lección anterior utilizamos contadores para registrar cuántas veces ocurre un evento. Ahora resolveremos una necesidad diferente: en lugar de contar casos, queremos combinar progresivamente los valores que van apareciendo."
                    ),

                    callout(
                        "Problema de esta lección",
                        [
                            "Llegan tres cantidades:",
                            "",
                            "4",
                            "7",
                            "2",
                            "",
                            "Queremos obtener:",
                            "",
                            "13",
                            "",
                            "Pero los valores se procesan",
                            "uno después de otro.",
                            "",
                            "¿Cómo conservamos lo obtenido",
                            "hasta cada momento?"
                        ].join("\n")
                    ),

                    paragraph(
                        "Un acumulador es una variable cuyo propósito es conservar un resultado parcial. Cada vez que aparece un nuevo valor, ese valor se combina con el resultado que ya estaba almacenado y el acumulador se actualiza."
                    ),

                    callout(
                        "Idea de acumulación",
                        [
                            "resultado anterior",
                            "        +",
                            "nuevo valor",
                            "        →",
                            "nuevo resultado parcial"
                        ].join("\n")
                    ),

                    paragraph(
                        "Cuando queremos construir una suma progresiva, utilizamos normalmente un acumulador inicializado en `0`. El cero representa que todavía no hemos incorporado ningún valor a la suma."
                    ),

                    callout(
                        "Patrón de suma acumulada",
                        [
                            "total = 0",
                            "",
                            "cuando aparece un valor:",
                            "",
                            "total = total + valor"
                        ].join("\n")
                    ),

                    paragraph(
                        "La instrucción `total = total + valor` utiliza primero el valor actual de `total`. Después incorpora el nuevo valor y asigna nuevamente el resultado a la misma variable."
                    ),

                    callout(
                        "Actualizar el resultado parcial",
                        [
                            "total = 7",
                            "valor = 4",
                            "",
                            "total = total + valor",
                            "",
                            "        →",
                            "",
                            "total = 7 + 4",
                            "",
                            "        →",
                            "",
                            "total = 11"
                        ].join("\n")
                    ),

                    paragraph(
                        "Lo importante es que después de cada actualización el acumulador resume todo lo procesado hasta ese momento. No necesitamos conservar por separado cada suma anterior."
                    ),

                    callout(
                        "El resultado crece progresivamente",
                        [
                            "Inicio",
                            "total = 0",
                            "",
                            "incorporar 4",
                            "total = 4",
                            "",
                            "incorporar 7",
                            "total = 11",
                            "",
                            "incorporar 2",
                            "total = 13"
                        ].join("\n")
                    ),

                    paragraph(
                        "Podemos combinar este patrón con una repetición. El ciclo se encarga de procesar varios valores y el acumulador conserva el resultado parcial entre una iteración y la siguiente."
                    ),


                    paragraph(
                        "Este ejemplo también permite distinguir dos responsabilidades. `cantidad` registra cuántos valores se han procesado, mientras que `total` conserva la suma de esos valores."
                    ),

                    callout(
                        "Contador y acumulador",
                        [
                            "cantidad = cantidad + 1",
                            "",
                            "→ registra una nueva ocurrencia",
                            "→ responde: ¿cuántos?",
                            "",
                            "----------------",
                            "",
                            "total = total + valor",
                            "",
                            "→ incorpora una cantidad",
                            "→ responde: ¿cuánto llevamos?"
                        ].join("\n")
                    ),

                    paragraph(
                        "Aunque ambas variables cambian dentro del mismo ciclo, no representan la misma información. El contador aumenta siempre en una unidad por cada evento registrado; el acumulador incorpora el valor que corresponda al resultado que se está construyendo."
                    ),

                    paragraph(
                        "También es posible utilizar un acumulador sin un contador cuando la condición del ciclo ya dispone de otra variable para controlar la repetición."
                    ),


                    paragraph(
                        "La inicialización debe tener sentido para la operación que se está realizando. En una suma utilizamos `0` porque incorporar el primer valor a cero conserva ese valor. No debe interpretarse como una regla universal según la cual cualquier acumulador siempre comienza en cero."
                    ),

                    paragraph(
                        "En esta lección nos concentraremos en la suma acumulada porque permite observar con claridad el patrón. La idea general es conservar un resultado parcial y actualizarlo cada vez que aparece nueva información."
                    ),

                    paragraph(
                        "Después de aprender a controlar una repetición con `mientras`, contar eventos y acumular resultados, estamos preparados para estudiar otra estructura de repetición especialmente útil cuando conocemos de antemano el recorrido que queremos realizar."
                    )
                ],

                examples: [
                    clrs(
                        "lesson-028-accumulator",
                        [
                            "valor = 1",
                            "total = 0",
                            "",
                            "mientras valor <= 3",
                            "    total = total + valor",
                            "    valor = valor + 1",
                            "",
                            "escribir total"
                        ].join("\n"),
                        "Suma progresiva",
                        "Después de cada iteración, `total` representa la suma de todos los valores procesados hasta ese momento."
                    ),

                    text(
                        "lesson-028-trace",
                        [
                            "Inicio:",
                            "total = 0",
                            "",
                            "valor 1",
                            "0 + 1 → total = 1",
                            "",
                            "valor 2",
                            "1 + 2 → total = 3",
                            "",
                            "valor 3",
                            "3 + 3 → total = 6",
                            "",
                            "Resultado:",
                            "total = 6"
                        ].join("\n"),
                        "Seguir el resultado parcial",
                        "El acumulador no comienza de nuevo en cada iteración: conserva el resultado producido por las anteriores."
                    ),

                    clrs(
                        "lesson-028-counter-vs-accumulator",
                        [
                            "cantidad = 0",
                            "valor = 0",
                            "total = 0",
                            "",
                            "mientras cantidad < 3",
                            "    leer valor",
                            "    total = total + valor",
                            "    cantidad = cantidad + 1",
                            "",
                            "escribir cantidad",
                            "escribir total"
                        ].join("\n"),
                        "Contar y acumular información diferente",
                        "`cantidad` indica cuántos valores fueron recibidos. `total` indica cuánto suman esos valores."
                    ),

                    text(
                        "lesson-028-counter-comparison",
                        [
                            "CONTADOR",
                            "",
                            "contador = contador + 1",
                            "",
                            "cada evento aporta:",
                            "1",
                            "",
                            "----------------",
                            "",
                            "ACUMULADOR",
                            "",
                            "total = total + valor",
                            "",
                            "cada incorporación aporta:",
                            "el valor procesado"
                        ].join("\n"),
                        "Dos patrones relacionados",
                        "Ambos actualizan una variable durante una repetición, pero conservan información diferente."
                    ),

                    clrs(
                        "lesson-028-input-sum",
                        [
                            "cantidad = 0",
                            "valor = 0",
                            "total = 0",
                            "",
                            "mientras cantidad < 3",
                            "    leer valor",
                            "    total = total + valor",
                            "    cantidad = cantidad + 1",
                            "",
                            "escribir total"
                        ].join("\n"),
                        "Acumular valores recibidos",
                        "`cantidad` controla cuántos valores se han procesado. `total` conserva la suma parcial e incorpora cada nuevo valor leído."
                    ),

                    clrs(
                        "lesson-028-progressive-sum",
                        [
                            "valor = 1",
                            "total = 0",
                            "",
                            "mientras valor <= 3",
                            "    total = total + valor",
                            "    valor = valor + 1",
                            "",
                            "escribir total"
                        ].join("\n"),
                        "Construir una suma progresivamente",
                        "El acumulador incorpora 1, después 2 y finalmente 3. Al terminar, `total` contiene 6."
                    ),
                ],

                knowledge: [
                    "comprender qué es un acumulador",
                    "comprender que un acumulador es una responsabilidad de una variable",
                    "comprender qué es un resultado parcial",
                    "inicializar correctamente un acumulador de suma",
                    "comprender el patrón total = total + valor",
                    "incorporar valores progresivamente a un resultado",
                    "conservar el resultado parcial entre iteraciones",
                    "utilizar un acumulador dentro de un ciclo",
                    "distinguir un contador de un acumulador",
                    "comprender que el valor final de un acumulador resume los valores incorporados"
                ],

                notes: [
                    callout(
                        "La inicialización depende de la operación",
                        "Para una suma progresiva, `0` es un valor inicial natural. Otros tipos de acumulación pueden requerir valores iniciales diferentes; por eso conviene comprender qué resultado parcial representa la variable en lugar de memorizar que todo acumulador comienza en cero."
                    )
                ],

                recommendedTools: [
                    "execution-trace",
                    "debugger"
                ],

                category: "FND-CONTROL"
            }),
            lesson({
                order: 29,
                section: 5,
                title: "Ciclo para",

                objective:
                    "Comprender cómo para expresa un recorrido conocido mediante una variable de iteración que avanza automáticamente entre un valor inicial y un límite, tanto en sentido ascendente como descendente.",

                problemStatement:
                    "Un programa debe mostrar consecutivamente los pasos del 1 al 5. Ya conocemos exactamente dónde comienza y dónde termina el recorrido. ¿Cómo podemos expresar esa repetición sin administrar manualmente una condición y una actualización en cada iteración?",

                concepts: [
                    "ciclo para",
                    "variable de iteración",
                    "recorrido",
                    "límite",
                    "recorrido ascendente",
                    "recorrido descendente"
                ],

                explanation: [
                    paragraph(
                        "Con `mientras` aprendimos a repetir un bloque mientras una condición permanezca verdadera. Ese modelo resulta muy flexible, pero algunos problemas presentan una estructura más específica: conocemos desde el principio los valores que debe recorrer la repetición."
                    ),

                    callout(
                        "Problema de esta lección",
                        [
                            "Queremos recorrer:",
                            "",
                            "1 → 2 → 3 → 4 → 5",
                            "",
                            "Ya conocemos:",
                            "",
                            "inicio → 1",
                            "límite → 5",
                            "",
                            "No necesitamos descubrir",
                            "durante la ejecución",
                            "cuándo termina el recorrido."
                        ].join("\n")
                    ),

                    paragraph(
                        "Para este tipo de repetición, CLRS proporciona el ciclo `para`. Esta estructura expresa directamente un recorrido mediante un valor inicial, un límite y una variable de iteración."
                    ),

                    callout(
                        "Estructura básica",
                        [
                            "para i = inicio hasta limite",
                            "    bloque",
                            "",
                            "i",
                            "→ variable de iteración",
                            "",
                            "inicio",
                            "→ primer valor del recorrido",
                            "",
                            "limite",
                            "→ último valor del recorrido"
                        ].join("\n")
                    ),

                    paragraph(
                        "La variable de iteración representa el valor actual del recorrido. En cada iteración, el bloque se ejecuta utilizando ese valor y la estructura `para` administra automáticamente su avance hacia el siguiente."
                    ),


                    callout(
                        "Seguir el recorrido",
                        [
                            "paso = 1",
                            "→ ejecutar bloque",
                            "",
                            "paso = 2",
                            "→ ejecutar bloque",
                            "",
                            "paso = 3",
                            "→ ejecutar bloque",
                            "",
                            "paso = 4",
                            "→ ejecutar bloque",
                            "",
                            "paso = 5",
                            "→ ejecutar bloque",
                            "",
                            "→ terminar"
                        ].join("\n")
                    ),

                    paragraph(
                        "En CLRS, el límite indicado por `hasta` forma parte del recorrido. Por eso `para paso = 1 hasta 5` utiliza también el valor 5 antes de terminar."
                    ),

                    callout(
                        "Límite inclusivo",
                        [
                            "para i = 1 hasta 5",
                            "",
                            "recorre:",
                            "",
                            "1, 2, 3, 4, 5",
                            "",
                            "El valor 5",
                            "también participa."
                        ].join("\n")
                    ),

                    paragraph(
                        "Esto diferencia al recorrido de algunas condiciones que hemos escrito anteriormente. Por ejemplo, `i < 5` deja de cumplirse cuando `i` alcanza 5, mientras que `para i = 1 hasta 5` incluye ese valor en el recorrido."
                    ),

                    paragraph(
                        "Una ventaja de `para` es que no necesitamos escribir manualmente una actualización como `i = i + 1` para expresar el avance básico. La propia estructura modifica la variable de iteración."
                    ),

                    callout(
                        "Mientras y para",
                        [
                            "CON mientras",
                            "",
                            "i = 1",
                            "mientras i <= 5",
                            "    escribir i",
                            "    i = i + 1",
                            "",
                            "----------------",
                            "",
                            "CON para",
                            "",
                            "para i = 1 hasta 5",
                            "    escribir i"
                        ].join("\n")
                    ),

                    paragraph(
                        "Ambas estructuras pueden expresar este recorrido, pero `para` comunica de forma más directa que estamos recorriendo una serie conocida de valores."
                    ),

                    paragraph(
                        "La variable de iteración no solamente controla el recorrido. Como contiene el valor actual, también puede utilizarse dentro del bloque para realizar operaciones."
                    ),


                    paragraph(
                        "No todos los recorridos avanzan de menor a mayor. CLRS permite expresar recorridos descendentes mediante `bajando`."
                    ),


                    callout(
                        "Dos direcciones",
                        [
                            "ASCENDENTE",
                            "",
                            "para i = 1 hasta 5",
                            "",
                            "1 → 2 → 3 → 4 → 5",
                            "",
                            "----------------",
                            "",
                            "DESCENDENTE",
                            "",
                            "para i = 5 bajando 1",
                            "",
                            "5 → 4 → 3 → 2 → 1"
                        ].join("\n")
                    ),

                    paragraph(
                        "También en un recorrido descendente el límite es inclusivo. `para i = 5 bajando 1` ejecuta el bloque cuando `i` vale 1 antes de terminar."
                    ),

                    paragraph(
                        "Elegir entre `mientras` y `para` depende de la forma del problema. `mientras` resulta natural cuando la repetición depende principalmente de una condición cuyo número de iteraciones no está expresado directamente como un recorrido. `para` resulta natural cuando conocemos el inicio y el límite de los valores que queremos recorrer."
                    ),

                    callout(
                        "Elegir según el problema",
                        [
                            "¿La repetición continúa",
                            "mientras se cumpla una regla?",
                            "",
                            "→ mientras",
                            "",
                            "¿Existe un recorrido conocido",
                            "desde un inicio hasta un límite?",
                            "",
                            "→ para"
                        ].join("\n")
                    ),

                    paragraph(
                        "En la siguiente lección veremos qué ocurre cuando una repetición debe ejecutarse completamente dentro de otra repetición, formando recorridos anidados."
                    )
                ],

                examples: [
                    clrs(
                        "lesson-029-for-up",
                        [
                            "para i = 1 hasta 5",
                            "    escribir i"
                        ].join("\n"),
                        "Recorrido ascendente",
                        "La variable `i` toma los valores 1, 2, 3, 4 y 5. El límite final forma parte del recorrido."
                    ),

                    text(
                        "lesson-029-for-up-trace",
                        [
                            "i = 1 → ejecutar bloque",
                            "i = 2 → ejecutar bloque",
                            "i = 3 → ejecutar bloque",
                            "i = 4 → ejecutar bloque",
                            "i = 5 → ejecutar bloque",
                            "",
                            "terminar recorrido"
                        ].join("\n"),
                        "Seguir la variable de iteración",
                        "Cada valor del intervalo corresponde a una ejecución completa del bloque."
                    ),

                    clrs(
                        "lesson-029-for-down",
                        [
                            "para i = 5 bajando 1",
                            "    escribir i"
                        ].join("\n"),
                        "Recorrido descendente",
                        "`bajando` permite recorrer los valores desde un límite superior hacia uno inferior, incluyendo ambos extremos."
                    ),

                    clrs(
                        "lesson-029-for-calculation",
                        [
                            "para numero = 1 hasta 4",
                            "    cuadrado = numero * numero",
                            "    escribir cuadrado"
                        ].join("\n"),
                        "Utilizar cada valor del recorrido",
                        "La variable de iteración puede participar en el procesamiento realizado dentro del bloque."
                    ),

                    clrs(
                        "lesson-029-basic-for",
                        [
                            "para paso = 1 hasta 5",
                            "    escribir paso"
                        ].join("\n"),
                        "Recorrer una serie conocida",
                        "El bloque se ejecuta una vez para cada valor del recorrido: 1, 2, 3, 4 y 5."
                    ),

                    clrs(
                        "lesson-029-use-current-value",
                        [
                            "para numero = 1 hasta 4",
                            "    doble = numero * 2",
                            "    escribir doble"
                        ].join("\n"),
                        "Utilizar el valor actual del recorrido",
                        "En cada iteración, `numero` contiene un valor diferente. Ese valor puede participar normalmente en expresiones dentro del bloque."
                    ),

                    clrs(
                        "lesson-029-descending",
                        [
                            "para numero = 5 bajando 1",
                            "    escribir numero"
                        ].join("\n"),
                        "Recorrer en sentido descendente",
                        "La variable comienza en 5 y toma sucesivamente los valores 4, 3, 2 y 1."
                    ),
                ],

                knowledge: [
                    "comprender qué problema resuelve un ciclo para",
                    "comprender qué es una variable de iteración",
                    "utilizar para para expresar un recorrido conocido",
                    "identificar el valor inicial y el límite de un recorrido",
                    "realizar recorridos ascendentes mediante hasta",
                    "realizar recorridos descendentes mediante bajando",
                    "comprender que los límites del recorrido son inclusivos en CLRS",
                    "comprender que para administra automáticamente el avance básico de la variable de iteración",
                    "utilizar el valor actual de la variable de iteración dentro del bloque",
                    "distinguir cuándo resulta más natural expresar una repetición mediante mientras o mediante para"
                ],

                notes: [
                    callout(
                        "La forma de para cambia entre lenguajes",
                        "La idea de un ciclo controlado por un recorrido aparece en muchos lenguajes, aunque su sintaxis y las reglas sobre límites pueden cambiar. Al transferir este conocimiento, no debe suponerse que todos los lenguajes utilizan recorridos inclusivos como CLRS."
                    )
                ],

                recommendedTools: [
                    "execution-trace"
                ],

                category: "FND-CONTROL"
            }),
            lesson({
                order: 30,
                section: 5,
                title: "Ciclos anidados",

                objective:
                    "Comprender cómo una repetición puede contener otra, distinguiendo el ciclo exterior del ciclo interior y siguiendo cómo el recorrido interior se completa nuevamente en cada iteración exterior.",

                problemStatement:
                    "Un programa debe procesar 2 grupos y, dentro de cada grupo, recorrer 3 elementos. ¿Cómo podemos expresar que el recorrido de los 3 elementos debe realizarse completamente para cada uno de los grupos?",

                concepts: [
                    "ciclo anidado",
                    "anidamiento",
                    "ciclo exterior",
                    "ciclo interior",
                    "recorrido"
                ],

                explanation: [
                    paragraph(
                        "Hasta ahora cada repetición realizaba un único recorrido. Sin embargo, algunos problemas contienen repetición en más de un nivel: por cada elemento de un recorrido necesitamos realizar otro recorrido completo."
                    ),

                    callout(
                        "Problema de esta lección",
                        [
                            "Tenemos:",
                            "",
                            "2 grupos",
                            "",
                            "y cada grupo contiene:",
                            "",
                            "3 elementos",
                            "",
                            "Necesitamos recorrer:",
                            "",
                            "grupo 1",
                            "    elemento 1",
                            "    elemento 2",
                            "    elemento 3",
                            "",
                            "grupo 2",
                            "    elemento 1",
                            "    elemento 2",
                            "    elemento 3",
                            "",
                            "¿Cómo representamos",
                            "dos niveles de repetición?"
                        ].join("\n")
                    ),

                    paragraph(
                        "Una estructura de control puede encontrarse dentro del bloque de otra. Cuando colocamos un ciclo dentro de otro ciclo hablamos de ciclos anidados."
                    ),

                    paragraph(
                        "En un anidamiento distinguimos un ciclo exterior y un ciclo interior. El exterior controla el recorrido principal. Dentro de cada una de sus iteraciones, el ciclo interior realiza su propio recorrido."
                    ),

                    list([
                        "Ciclo exterior: controla el recorrido de primer nivel y contiene al otro ciclo.",
                        "Ciclo interior: se ejecuta dentro de cada iteración del ciclo exterior.",
                        "Anidamiento: relación en la que una estructura se encuentra dentro del bloque de otra."
                    ]),

                    callout(
                        "Idea fundamental",
                        [
                            "iteración exterior 1",
                            "        →",
                            "recorrido interior completo",
                            "",
                            "        →",
                            "",
                            "iteración exterior 2",
                            "        →",
                            "recorrido interior completo",
                            "",
                            "        →",
                            "",
                            "..."
                        ].join("\n")
                    ),

                    paragraph(
                        "Para nuestro problema podemos utilizar un `para` para recorrer los grupos y colocar dentro de su bloque otro `para` encargado de recorrer los elementos."
                    ),


                    callout(
                        "Recorrido producido",
                        [
                            "grupo = 1",
                            "",
                            "    elemento = 1 → 11",
                            "    elemento = 2 → 12",
                            "    elemento = 3 → 13",
                            "",
                            "grupo = 2",
                            "",
                            "    elemento = 1 → 21",
                            "    elemento = 2 → 22",
                            "    elemento = 3 → 23"
                        ].join("\n")
                    ),

                    paragraph(
                        "El ciclo exterior no avanza inmediatamente después de comenzar una iteración. Primero debe ejecutarse todo su bloque, y ese bloque contiene al ciclo interior. Por ello, el recorrido interior debe terminar antes de que el exterior continúe con su siguiente valor."
                    ),

                    callout(
                        "Quién avanza primero",
                        [
                            "grupo = 1",
                            "",
                            "    elemento = 1",
                            "    elemento = 2",
                            "    elemento = 3",
                            "",
                            "termina ciclo interior",
                            "",
                            "        →",
                            "",
                            "grupo avanza a 2",
                            "",
                            "        →",
                            "",
                            "    elemento vuelve a recorrer",
                            "    1, 2 y 3"
                        ].join("\n")
                    ),

                    paragraph(
                        "Cuando comienza una nueva iteración exterior, el ciclo interior inicia nuevamente su recorrido. No continúa desde el valor donde terminó anteriormente; ejecuta otra vez el recorrido establecido por su propia estructura."
                    ),


                    paragraph(
                        "La indentación permite reconocer esta relación estructural. El ciclo interior pertenece al bloque del ciclo exterior, y las instrucciones de su propio bloque aparecen un nivel adicional de indentación."
                    ),

                    callout(
                        "Niveles de indentación",
                        [
                            "para grupo = 1 hasta 2",
                            "    para elemento = 1 hasta 3",
                            "        escribir ...",
                            "",
                            "nivel 1",
                            "→ ciclo exterior",
                            "",
                            "nivel 2",
                            "→ ciclo interior",
                            "",
                            "nivel 3",
                            "→ bloque del ciclo interior"
                        ].join("\n")
                    ),

                    paragraph(
                        "Los ciclos anidados son útiles cuando el problema posee naturalmente varios niveles de recorrido. No debemos añadir otro ciclo únicamente porque sea posible; cada nivel de repetición debe corresponder a una necesidad del problema."
                    ),

                    paragraph(
                        "Por ejemplo, más adelante trabajaremos con información organizada en filas y columnas. En ese contexto será natural recorrer varias columnas por cada fila. Por ahora basta con comprender el patrón general de un recorrido completo dentro de otro."
                    ),

                    paragraph(
                        "Con esta lección completamos las estructuras de control fundamentales de esta sección: secuencia, selección e iteración, junto con patrones como contadores, acumuladores y composición de ciclos."
                    )
                ],

                examples: [
                    clrs(
                        "lesson-030-nested-loops",
                        [
                            "para grupo = 1 hasta 2",
                            "    para elemento = 1 hasta 3",
                            "        codigo = grupo * 10 + elemento",
                            "        escribir codigo"
                        ].join("\n"),
                        "Un recorrido dentro de otro",
                        "El recorrido interior 1, 2, 3 se ejecuta completamente para cada uno de los valores 1 y 2 del recorrido exterior."
                    ),

                    text(
                        "lesson-030-nested-trace",
                        [
                            "grupo = 1",
                            "→ elemento = 1",
                            "→ elemento = 2",
                            "→ elemento = 3",
                            "",
                            "grupo = 2",
                            "→ elemento = 1",
                            "→ elemento = 2",
                            "→ elemento = 3"
                        ].join("\n"),
                        "Seguir el orden de las iteraciones",
                        "El valor exterior permanece fijo mientras el recorrido interior se completa."
                    ),

                    clrs(
                        "lesson-030-two-by-two",
                        [
                            "para exterior = 1 hasta 2",
                            "    para interior = 1 hasta 2",
                            "        valor = exterior * 10 + interior",
                            "        escribir valor"
                        ].join("\n"),
                        "Observar todas las combinaciones",
                        "El programa produce 11, 12, 21 y 22 porque cada valor exterior se combina con todos los valores del recorrido interior."
                    ),

                    clrs(
                        "lesson-030-nested-count",
                        [
                            "cantidad = 0",
                            "",
                            "para grupo = 1 hasta 2",
                            "    para elemento = 1 hasta 3",
                            "        cantidad = cantidad + 1",
                            "",
                            "escribir cantidad"
                        ].join("\n"),
                        "Contar las ejecuciones interiores",
                        "El contador se incrementa una vez por cada ejecución del bloque interior. Dos recorridos exteriores de tres elementos producen seis ejecuciones."
                    ),

                    clrs(
                        "lesson-030-groups",
                        [
                            "para grupo = 1 hasta 2",
                            "    para elemento = 1 hasta 3",
                            "        codigo = grupo * 10 + elemento",
                            "        escribir codigo"
                        ].join("\n"),
                        "Dos niveles de recorrido",
                        "Para cada valor de `grupo`, el ciclo de `elemento` vuelve a recorrer los valores 1, 2 y 3. Los códigos producidos permiten observar cada combinación."
                    ),

                    text(
                        "lesson-030-trace",
                        [
                            "grupo = 1",
                            "    elemento = 1",
                            "    elemento = 2",
                            "    elemento = 3",
                            "",
                            "grupo = 2",
                            "    elemento = 1",
                            "    elemento = 2",
                            "    elemento = 3"
                        ].join("\n"),
                        "Seguir ambos niveles",
                        "Mientras `grupo` conserva un mismo valor, `elemento` completa todo su recorrido. Solo entonces cambia `grupo`."
                    ),
                ],

                knowledge: [
                    "comprender qué significa anidar ciclos",
                    "distinguir el ciclo exterior del ciclo interior",
                    "utilizar una repetición dentro del bloque de otra",
                    "comprender que el ciclo interior completa su recorrido en cada iteración exterior",
                    "comprender que el ciclo exterior no avanza hasta que termina el recorrido interior correspondiente",
                    "comprender que el ciclo interior inicia nuevamente su recorrido en cada iteración exterior",
                    "seguir simultáneamente los valores de dos variables de iteración",
                    "reconocer los diferentes niveles estructurales mediante la indentación",
                    "relacionar varios niveles de repetición con varios niveles del problema"
                ],

                notes: [
                    callout(
                        "Preparación para recorridos posteriores",
                        "El mismo modelo será útil más adelante cuando trabajemos con estructuras organizadas en dos dimensiones. En esta lección todavía no necesitamos arreglos ni matrices: el objetivo es comprender únicamente la composición de recorridos."
                    )
                ],

                recommendedTools: [
                    "execution-trace",
                    "debugger"
                ],

                category: "FND-CONTROL"
            }),
            lesson({
                order: 31,
                section: 6,
                title: "Programación procedimental",

                objective:
                    "Comprender la programación procedimental como una forma de organizar una solución mediante responsabilidades diferenciadas que pueden representarse mediante subprogramas y coordinarse para resolver un problema completo.",

                problemStatement:
                    "Un programa calcula el subtotal de una compra, determina un descuento, obtiene el total final y muestra el resultado. Todo puede escribirse en un único flujo, pero conforme se añaden responsabilidades resulta más difícil comprender la solución como una sola pieza. ¿Cómo podemos comenzar a organizar el programa en partes con propósitos claramente diferenciados?",

                concepts: [
                    "programación procedimental",
                    "descomposición",
                    "responsabilidad",
                    "subproblema",
                    "subprograma"
                ],

                explanation: [
                    paragraph(
                        "Hasta ahora hemos aprendido a construir y controlar el flujo de un programa mediante expresiones, decisiones y ciclos. Estas herramientas permiten resolver problemas cada vez más complejos, pero también hacen que una solución pueda comenzar a reunir muchas instrucciones con propósitos diferentes."
                    ),

                    callout(
                        "Un problema que comienza a crecer",
                        [
                            "Procesar una compra",
                            "",
                            "→",
                            "",
                            "calcular subtotal",
                            "determinar descuento",
                            "obtener total final",
                            "mostrar resultado",
                            "",
                            "Todas las acciones pertenecen",
                            "al mismo problema,",
                            "pero no tienen",
                            "la misma responsabilidad."
                        ].join("\n")
                    ),

                    paragraph(
                        "Cuando una solución contiene varias responsabilidades, podemos intentar comprenderla en partes más pequeñas. A este proceso lo llamamos descomposición."
                    ),

                    paragraph(
                        "Una responsabilidad describe qué parte del trabajo debe realizarse. Por ejemplo, calcular un subtotal tiene un propósito diferente de determinar un descuento o mostrar un resultado."
                    ),

                    callout(
                        "Pensar por responsabilidades",
                        [
                            "PROBLEMA COMPLETO",
                            "",
                            "Procesar una compra",
                            "",
                            "        →",
                            "",
                            "RESPONSABILIDADES",
                            "",
                            "calcular subtotal",
                            "",
                            "determinar descuento",
                            "",
                            "obtener total",
                            "",
                            "mostrar resultado"
                        ].join("\n")
                    ),

                    paragraph(
                        "Cuando aislamos una parte del problema para razonar sobre ella, podemos considerarla un subproblema. Resolver varios subproblemas relacionados y coordinar sus resultados permite construir la solución del problema completo."
                    ),

                    callout(
                        "Problema y subproblemas",
                        [
                            "Problema:",
                            "procesar una compra",
                            "",
                            "        → descomponer",
                            "",
                            "Subproblema A",
                            "calcular subtotal",
                            "",
                            "Subproblema B",
                            "determinar descuento",
                            "",
                            "Subproblema C",
                            "obtener total final"
                        ].join("\n")
                    ),

                    paragraph(
                        "El subproblema pertenece al razonamiento sobre la solución. Un subprograma, en cambio, pertenece al programa: es una unidad de código que agrupa instrucciones relacionadas para realizar una responsabilidad determinada."
                    ),

                    callout(
                        "Subproblema ≠ subprograma",
                        [
                            "SUBPROBLEMA",
                            "",
                            "parte del problema",
                            "que necesitamos resolver",
                            "",
                            "        → puede representarse mediante",
                            "",
                            "SUBPROGRAMA",
                            "",
                            "parte organizada del código",
                            "que realiza una responsabilidad"
                        ].join("\n")
                    ),

                    paragraph(
                        "La programación procedimental organiza soluciones utilizando este tipo de unidades de trabajo. En lugar de observar todo el programa como una única secuencia extensa, podemos pensar en subprogramas con responsabilidades reconocibles que colaboran para producir el resultado completo."
                    ),

                    paragraph(
                        "Las estructuras que ya conocemos no desaparecen. Secuencias, decisiones, ciclos, contadores y acumuladores pueden encontrarse dentro de los subprogramas. Lo que cambia es la manera en que organizamos esas instrucciones."
                    ),

                    callout(
                        "No reemplazamos lo aprendido",
                        [
                            "variables",
                            "expresiones",
                            "decisiones",
                            "ciclos",
                            "",
                            "        →",
                            "",
                            "pueden formar parte",
                            "de responsabilidades",
                            "organizadas en subprogramas"
                        ].join("\n")
                    ),

                    paragraph(
                        "En CLRS utilizaremos funciones como el mecanismo principal para representar estos subprogramas. Todavía no necesitamos conocer su sintaxis: primero debemos comprender qué responsabilidad queremos separar y por qué esa parte existe dentro de la solución."
                    ),

                    callout(
                        "Primero la responsabilidad",
                        [
                            "¿Qué necesita resolver",
                            "el programa?",
                            "",
                            "        →",
                            "",
                            "¿Qué responsabilidades",
                            "puedo reconocer?",
                            "",
                            "        →",
                            "",
                            "¿Qué parte podría",
                            "representarse mediante",
                            "un subprograma?",
                            "",
                            "        →",
                            "",
                            "después aprenderemos",
                            "a escribir la función"
                        ].join("\n")
                    ),

                    paragraph(
                        "Descomponer no significa crear una parte diferente para cada instrucción. Una separación resulta útil cuando existe una responsabilidad con significado propio dentro de la solución."
                    ),

                    paragraph(
                        "Tampoco es necesario decidir todavía la división perfecta de un programa. En esta etapa basta con aprender a reconocer que una solución puede estar formada por partes relacionadas con responsabilidades diferentes."
                    ),

                    paragraph(
                        "Las siguientes lecciones convertirán esta idea conceptual en código. Primero aprenderemos cómo definir una función, después cómo invocarla, cómo proporcionarle información y cómo obtener un resultado de ella."
                    )
                ],

                examples: [
                    text(
                        "lesson-031-purchase-decomposition",
                        [
                            "PROBLEMA",
                            "",
                            "Procesar una compra",
                            "",
                            "        ↓",
                            "",
                            "RESPONSABILIDADES",
                            "",
                            "1. Calcular subtotal",
                            "2. Determinar descuento",
                            "3. Obtener total final",
                            "4. Mostrar resultado",
                            "",
                            "        ↓",
                            "",
                            "SOLUCIÓN COMPLETA",
                            "",
                            "coordinar las partes"
                        ].join("\n"),
                        "Reconocer responsabilidades",
                        "El problema sigue siendo uno solo, pero puede comprenderse mediante partes con propósitos diferentes."
                    ),

                    text(
                        "lesson-031-subproblem-subprogram",
                        [
                            "NECESIDAD",
                            "",
                            "obtener el subtotal",
                            "",
                            "        ↓",
                            "",
                            "SUBPROBLEMA",
                            "",
                            "calcular precio × cantidad",
                            "",
                            "        ↓",
                            "",
                            "SUBPROGRAMA",
                            "",
                            "una parte del código",
                            "podrá encargarse",
                            "de ese cálculo"
                        ].join("\n"),
                        "Del problema al programa",
                        "El subproblema pertenece a la descomposición de la solución; posteriormente un subprograma puede representar esa responsabilidad en código."
                    ),

                    clrs(
                        "lesson-031-before-functions",
                        [
                            "precio = 100",
                            "cantidad = 3",
                            "",
                            "subtotal = precio * cantidad",
                            "descuento = subtotal * 0.10",
                            "total = subtotal - descuento",
                            "",
                            "escribir total"
                        ].join("\n"),
                        "Un flujo con varias responsabilidades",
                        "El programa funciona como un único flujo, pero ya podemos reconocer distintos trabajos: obtener el subtotal, calcular el descuento, obtener el total y mostrarlo."
                    ),

                    text(
                        "lesson-031-procedural-model",
                        [
                            "PROBLEMA COMPLETO",
                            "",
                            "        ↓",
                            "",
                            "RESPONSABILIDAD A",
                            "RESPONSABILIDAD B",
                            "RESPONSABILIDAD C",
                            "",
                            "        ↓",
                            "",
                            "SUBPROGRAMAS",
                            "",
                            "        ↓",
                            "",
                            "COORDINACIÓN",
                            "",
                            "        ↓",
                            "",
                            "RESULTADO"
                        ].join("\n"),
                        "Modelo procedimental",
                        "La solución puede organizarse mediante partes que realizan responsabilidades diferenciadas y después colaboran para resolver el problema completo."
                    )
                ],

                knowledge: [
                    "comprender la idea general de programación procedimental",
                    "comprender qué significa descomponer una solución",
                    "reconocer responsabilidades diferentes dentro de un problema",
                    "comprender qué es un subproblema",
                    "comprender conceptualmente qué es un subprograma",
                    "diferenciar subproblema y subprograma",
                    "comprender que un subprograma puede representar una responsabilidad dentro de la solución",
                    "comprender que los subprogramas pueden coordinarse para resolver un problema completo",
                    "reconocer que las estructuras de control ya aprendidas pueden formar parte de subprogramas"
                ],

                notes: [
                    callout(
                        "Descomponer no significa fragmentar arbitrariamente",
                        "No existe una regla según la cual cada paso deba convertirse en un subprograma. En esta etapa buscamos responsabilidades con significado propio; más adelante trabajaremos con mayor profundidad cómo dividir problemas completos."
                    )
                ],

                category: "FND-FUNC"
            }),
            lesson({
                order: 32,
                section: 6,
                title: "Crear una función",

                objective:
                    "Comprender cómo una responsabilidad puede representarse mediante una función y reconocer los elementos básicos de su definición: nombre, paréntesis y cuerpo.",

                problemStatement:
                    "Hemos identificado la responsabilidad de mostrar el estado de un proceso como una parte diferenciada de la solución. ¿Cómo podemos convertir esa responsabilidad en una unidad de código identificable, en lugar de mantener sus instrucciones mezcladas con el resto del programa?",

                concepts: [
                    "función",
                    "definición de función",
                    "nombre de función",
                    "cuerpo de función"
                ],

                explanation: [
                    paragraph(
                        "En la lección anterior aprendimos a reconocer responsabilidades dentro de una solución. Ahora comenzaremos a representar esas responsabilidades como unidades concretas de código."
                    ),

                    callout(
                        "Problema de esta lección",
                        [
                            "Responsabilidad:",
                            "",
                            "mostrar el estado",
                            "de un proceso",
                            "",
                            "Actualmente podríamos escribir:",
                            "",
                            "escribir \"Inicio\"",
                            "escribir \"Procesando\"",
                            "escribir \"Fin\"",
                            "",
                            "Pero queremos identificar",
                            "esas instrucciones como",
                            "una unidad con propósito propio."
                        ].join("\n")
                    ),

                    paragraph(
                        "En CLRS utilizaremos funciones como el mecanismo principal para construir subprogramas. Una función agrupa instrucciones relacionadas bajo un nombre que identifica la responsabilidad que realiza."
                    ),

                    callout(
                        "De responsabilidad a función",
                        [
                            "RESPONSABILIDAD",
                            "",
                            "mostrar el estado",
                            "",
                            "        → representar en código",
                            "",
                            "FUNCIÓN",
                            "",
                            "MOSTRAR_ESTADO()",
                            "    ..."
                        ].join("\n")
                    ),

                    paragraph(
                        "Crear una función comienza por definirla. La definición establece qué función existe y qué instrucciones forman parte de su comportamiento."
                    ),


                    paragraph(
                        "En esta primera aproximación distinguiremos principalmente dos elementos: el nombre de la función y su cuerpo. Los paréntesis forman parte de la definición y adquirirán una función adicional cuando estudiemos parámetros."
                    ),

                    callout(
                        "Anatomía básica",
                        [
                            "MOSTRAR_ESTADO()",
                            "↑",
                            "nombre de la función",
                            "",
                            "    escribir \"Inicio\"",
                            "    escribir \"Procesando\"",
                            "    escribir \"Fin\"",
                            "    ↑",
                            "    cuerpo"
                        ].join("\n")
                    ),

                    paragraph(
                        "El nombre permite identificar la función dentro del programa. Conviene que describa la responsabilidad que representa. En esta ruta escribiremos los nombres de funciones de CLRS en mayúsculas, utilizando nombres como `SALUDAR`, `MOSTRAR_ESTADO` o `CALCULAR_TOTAL`."
                    ),

                    paragraph(
                        "Los paréntesis forman parte de la definición. En nuestros primeros ejemplos estarán vacíos porque todavía no proporcionaremos información a la función. Más adelante aprenderemos a declarar parámetros dentro de ellos."
                    ),

                    paragraph(
                        "El cuerpo es el bloque indentado situado debajo de la definición. Puede contener una o varias instrucciones y representa el trabajo asociado con la función."
                    ),


                    paragraph(
                        "Las estructuras que aprendimos anteriormente también pueden formar parte del cuerpo de una función. Crear una función no reemplaza variables, expresiones, decisiones o ciclos: permite organizarlos dentro de una responsabilidad."
                    ),


                    paragraph(
                        "Existe una distinción especialmente importante: definir una función no significa ejecutar su cuerpo. La definición establece qué trabajo puede realizar la función, pero por sí sola no solicita que ese trabajo ocurra en ese momento."
                    ),

                    callout(
                        "Definir ≠ ejecutar",
                        [
                            "SALUDAR()",
                            "    escribir \"Hola\"",
                            "",
                            "significa:",
                            "",
                            "\"existe una función llamada SALUDAR",
                            "cuyo cuerpo contiene esta instrucción\"",
                            "",
                            "no significa:",
                            "",
                            "\"mostrar Hola ahora\""
                        ].join("\n")
                    ),

                    paragraph(
                        "Esta diferencia explica por qué una función puede estar definida en el programa sin que sus instrucciones formen parte todavía del recorrido de ejecución."
                    ),

                    paragraph(
                        "Por ahora utilizaremos funciones que realizan acciones mediante su cuerpo y no estudiaremos valores de retorno. Más adelante aprenderemos cómo una función puede recibir información y cómo puede producir un valor reutilizable."
                    ),

                    paragraph(
                        "La siguiente lección resolverá la pregunta que queda pendiente: una vez que una función está definida, ¿cómo hacemos que el programa ejecute realmente su cuerpo?"
                    )
                ],

                examples: [
                    clrs(
                        "lesson-032-simple-function",
                        [
                            "SALUDAR()",
                            '    escribir "Hola"'
                        ].join("\n"),
                        "Una función sencilla",
                        "`SALUDAR` identifica el subprograma y su cuerpo contiene una sola instrucción."
                    ),

                    text(
                        "lesson-032-parts",
                        [
                            "MOSTRAR_ESTADO()",
                            "└──────┬──────┘",
                            "       ↓",
                            "      nombre",
                            "",
                            "    escribir \"Inicio\"",
                            "    escribir \"Fin\"",
                            "    └──────────────┘",
                            "           ↓",
                            "         cuerpo"
                        ].join("\n"),
                        "Reconocer las partes de una función",
                        "La definición proporciona un nombre a la unidad de código y delimita mediante indentación las instrucciones que forman su cuerpo."
                    ),

                    clrs(
                        "lesson-032-responsibility",
                        [
                            "MOSTRAR_ESTADO()",
                            '    escribir "Inicio"',
                            '    escribir "Procesando"',
                            '    escribir "Fin"'
                        ].join("\n"),
                        "Agrupar instrucciones relacionadas",
                        "Las tres instrucciones comparten una misma responsabilidad y quedan organizadas dentro de una función identificable."
                    ),

                    text(
                        "lesson-032-definition-not-execution",
                        [
                            "DEFINIR",
                            "",
                            "SALUDAR()",
                            "    escribir \"Hola\"",
                            "",
                            "        ≠",
                            "",
                            "EJECUTAR",
                            "",
                            "La definición describe",
                            "qué hará la función.",
                            "",
                            "Todavía falta solicitar",
                            "su ejecución."
                        ].join("\n"),
                        "La definición no ejecuta el cuerpo",
                        "Crear una función y hacer que esa función participe en la ejecución son operaciones diferentes."
                    ),

                    clrs(
                        "lesson-032-function-definition",
                        [
                            "MOSTRAR_ESTADO()",
                            '    escribir "Inicio"',
                            '    escribir "Procesando"',
                            '    escribir "Fin"'
                        ].join("\n"),
                        "Representar una responsabilidad mediante una función",
                        "`MOSTRAR_ESTADO` identifica la responsabilidad y las instrucciones indentadas constituyen el cuerpo que describe su trabajo."
                    ),

                    clrs(
                        "lesson-032-body",
                        [
                            "MOSTRAR_MENSAJE()",
                            '    escribir "Proceso iniciado"',
                            '    escribir "Proceso terminado"'
                        ].join("\n"),
                        "Un cuerpo con varias instrucciones",
                        "Las dos instrucciones indentadas pertenecen al mismo cuerpo y forman parte de la responsabilidad representada por `MOSTRAR_MENSAJE`."
                    ),

                    clrs(
                        "lesson-032-control-inside-function",
                        [
                            "MOSTRAR_ACCESO()",
                            "    edad = 20",
                            "",
                            "    si edad >= 18",
                            '        escribir "Acceso permitido"'
                        ].join("\n"),
                        "Una función puede contener estructuras conocidas",
                        "La decisión sigue funcionando como antes, pero ahora forma parte del cuerpo de una función con una responsabilidad identificable."
                    ),
                ],

                knowledge: [
                    "comprender qué es una función",
                    "comprender que una función puede representar una responsabilidad",
                    "comprender qué significa definir una función",
                    "reconocer el nombre de una función",
                    "reconocer los paréntesis como parte de su definición",
                    "reconocer el cuerpo de una función",
                    "comprender que el cuerpo es un bloque de instrucciones",
                    "comprender que las estructuras previamente aprendidas pueden formar parte del cuerpo",
                    "comprender que definir una función no ejecuta su cuerpo",
                    "relacionar conceptualmente una función con un subprograma"
                ],

                notes: [
                    callout(
                        "Función como término de esta ruta",
                        "En esta ruta utilizamos `función` para los subprogramas definidos mediante la sintaxis de funciones de CLRS. Algunas funciones realizarán principalmente acciones y otras, más adelante, producirán valores mediante `retornar`."
                    )
                ],

                category: "FND-FUNC"
            }),
            lesson({
                order: 33,
                section: 6,
                title: "Invocar una función",

                objective:
                    "Comprender cómo una llamada hace que una función participe en la ejecución, siguiendo el flujo desde el punto de invocación hacia su cuerpo y posteriormente hacia la instrucción siguiente.",

                problemStatement:
                    "Ya existe una función llamada SALUDAR que contiene las instrucciones necesarias para mostrar un saludo, pero definirla no produce ninguna salida. ¿Cómo hacemos que el programa ejecute realmente ese trabajo en el momento que lo necesita?",

                concepts: [
                    "invocación",
                    "llamada a función",
                    "flujo de llamada",
                    "punto de entrada"
                ],

                explanation: [
                    paragraph(
                        "En la lección anterior aprendimos a definir una función. La definición establece que existe una unidad de código con un nombre y un cuerpo, pero no solicita por sí sola que ese cuerpo se ejecute."
                    ),

                    callout(
                        "Problema de esta lección",
                        [
                            "Ya tenemos:",
                            "",
                            "SALUDAR()",
                            "    escribir \"Hola\"",
                            "",
                            "La función está definida.",
                            "",
                            "Pero todavía necesitamos:",
                            "",
                            "hacer que su cuerpo",
                            "participe en la ejecución."
                        ].join("\n")
                    ),

                    paragraph(
                        "Para utilizar una función debemos invocarla. Invocar, llamar o realizar una llamada a una función significa solicitar la ejecución de la función identificada por ese nombre."
                    ),

                    callout(
                        "Definir ≠ invocar",
                        [
                            "DEFINICIÓN",
                            "",
                            "SALUDAR()",
                            "    escribir \"Hola\"",
                            "",
                            "→ establece qué trabajo",
                            "  puede realizar SALUDAR",
                            "",
                            "----------------",
                            "",
                            "LLAMADA",
                            "",
                            "SALUDAR()",
                            "",
                            "→ solicita ejecutar",
                            "  ese trabajo"
                        ].join("\n")
                    ),

                    paragraph(
                        "La definición y la llamada pueden mostrar el mismo nombre seguido de paréntesis, pero cumplen funciones diferentes dentro del programa. La definición posee un cuerpo indentado; la llamada aparece dentro del flujo como una instrucción que utiliza una función ya definida."
                    ),


                    paragraph(
                        "Una llamada modifica temporalmente el recorrido que estábamos siguiendo. Cuando la ejecución alcanza `SALUDAR()`, pasa al cuerpo de esa función y ejecuta sus instrucciones."
                    ),

                    paragraph(
                        "Cuando el cuerpo termina, la ejecución continúa con la instrucción situada después de la llamada. Por eso una función puede participar en medio de un flujo sin reemplazar las instrucciones que se encuentran antes o después."
                    ),

                    callout(
                        "Flujo de una llamada",
                        [
                            "PRINCIPAL",
                            "",
                            "escribir \"Antes\"",
                            "        →",
                            "SALUDAR() ─────────────┐",
                            "                       →",
                            "                cuerpo de SALUDAR",
                            "                escribir \"Hola\"",
                            "                       →",
                            "                termina el cuerpo",
                            "                       │",
                            "        ┌──────────────┘",
                            "        →",
                            "escribir \"Después\""
                        ].join("\n")
                    ),


                    paragraph(
                        "La llamada no copia las instrucciones de la función en el lugar donde aparece. La función continúa definida como una unidad independiente; la llamada indica cuándo debe ejecutarse esa unidad."
                    ),

                    callout(
                        "Una definición, varios usos",
                        [
                            "DEFINICIÓN",
                            "",
                            "SALUDAR()",
                            "    escribir \"Hola\"",
                            "",
                            "        →",
                            "",
                            "LLAMADA 1",
                            "SALUDAR()",
                            "",
                            "LLAMADA 2",
                            "SALUDAR()",
                            "",
                            "LLAMADA 3",
                            "SALUDAR()"
                        ].join("\n")
                    ),

                    paragraph(
                        "Una función definida una sola vez puede invocarse varias veces. Cada vez que la ejecución alcanza una llamada, el cuerpo vuelve a ejecutarse."
                    ),


                    paragraph(
                        "Las llamadas también pueden combinarse con las estructuras de control que ya conocemos. Si una llamada se encuentra dentro de un bloque condicionado, solamente se alcanza cuando ese bloque forma parte de la ejecución."
                    ),


                    paragraph(
                        "`PRINCIPAL` tiene un papel especial en CLRS: funciona como punto de entrada automático del programa. No necesitamos escribir una llamada explícita a `PRINCIPAL`; la ejecución comienza en su cuerpo y desde allí podemos invocar otras funciones."
                    ),

                    callout(
                        "Punto de entrada",
                        [
                            "inicio del programa",
                            "        →",
                            "PRINCIPAL()",
                            "        →",
                            "sus instrucciones",
                            "        →",
                            "llamadas a otras funciones",
                            "cuando corresponda"
                        ].join("\n")
                    ),

                    paragraph(
                        "Por ahora nuestras funciones no reciben información mediante parámetros ni producen valores mediante `retornar`. El siguiente paso será aprender cómo una misma función puede trabajar con valores diferentes proporcionados en cada llamada."
                    )
                ],

                examples: [
                    clrs(
                        "lesson-033-function-call",
                        [
                            "MOSTRAR_ESTADO()",
                            '    escribir "Sistema listo"',
                            "",
                            "PRINCIPAL()",
                            "    MOSTRAR_ESTADO()"
                        ].join("\n"),
                        "Hacer que una función participe en la ejecución",
                        "La definición establece el comportamiento y la llamada dentro de `PRINCIPAL` provoca que ese comportamiento se ejecute."
                    ),

                    text(
                        "lesson-033-definition-vs-call",
                        [
                            "DEFINICIÓN",
                            "",
                            "SALUDAR()",
                            "    escribir \"Hola\"",
                            "",
                            "→ describe el subprograma",
                            "",
                            "----------------",
                            "",
                            "LLAMADA",
                            "",
                            "SALUDAR()",
                            "",
                            "→ solicita su ejecución"
                        ].join("\n"),
                        "Dos apariciones con responsabilidades distintas",
                        "El contexto permite distinguir la definición de la llamada: la primera introduce el cuerpo; la segunda utiliza la función."
                    ),

                    clrs(
                        "lesson-033-flow-order",
                        [
                            "SALUDAR()",
                            '    escribir "Hola"',
                            "",
                            "PRINCIPAL()",
                            '    escribir "Uno"',
                            "    SALUDAR()",
                            '    escribir "Dos"'
                        ].join("\n"),
                        "Seguir el orden de ejecución",
                        "La salida `Uno`, `Hola`, `Dos` permite observar exactamente en qué punto la llamada incorpora el cuerpo de la función al recorrido."
                    ),

                    clrs(
                        "lesson-033-reuse",
                        [
                            "SEPARADOR()",
                            '    escribir "-----"',
                            "",
                            "PRINCIPAL()",
                            '    escribir "Seccion 1"',
                            "    SEPARADOR()",
                            '    escribir "Seccion 2"',
                            "    SEPARADOR()"
                        ].join("\n"),
                        "Invocar la misma responsabilidad varias veces",
                        "Una sola definición puede utilizarse desde distintos puntos del flujo mediante varias llamadas."
                    ),

                    clrs(
                        "lesson-033-definition-and-call",
                        [
                            "SALUDAR()",
                            '    escribir "Hola"',
                            "",
                            "PRINCIPAL()",
                            "    SALUDAR()"
                        ].join("\n"),
                        "Definir y después invocar",
                        "`SALUDAR` se define como una función. Dentro de `PRINCIPAL`, `SALUDAR()` es una llamada que provoca la ejecución de su cuerpo."
                    ),

                    clrs(
                        "lesson-033-flow",
                        [
                            "SALUDAR()",
                            '    escribir "Hola"',
                            "",
                            "PRINCIPAL()",
                            '    escribir "Antes"',
                            "    SALUDAR()",
                            '    escribir "Después"'
                        ].join("\n"),
                        "Entrar en una función y continuar",
                        "La salida es `Antes`, después `Hola` y finalmente `Después`. La llamada hace que el cuerpo de `SALUDAR` forme parte del recorrido en ese punto."
                    ),

                    clrs(
                        "lesson-033-multiple-calls",
                        [
                            "SALUDAR()",
                            '    escribir "Hola"',
                            "",
                            "PRINCIPAL()",
                            "    SALUDAR()",
                            "    SALUDAR()",
                            "    SALUDAR()"
                        ].join("\n"),
                        "Reutilizar una función",
                        "La función se define una sola vez, pero las tres llamadas hacen que su cuerpo se ejecute tres veces."
                    ),

                    clrs(
                        "lesson-033-call-inside-if",
                        [
                            "MOSTRAR_BENEFICIO()",
                            '    escribir "Beneficio disponible"',
                            "",
                            "PRINCIPAL()",
                            "    tieneBeneficio = VERDAD",
                            "",
                            "    si tieneBeneficio",
                            "        MOSTRAR_BENEFICIO()",
                            "",
                            '    escribir "Fin"'
                        ].join("\n"),
                        "Una llamada dentro del flujo conocido",
                        "Las decisiones siguen controlando el recorrido. La función solamente se invoca cuando la ejecución alcanza la llamada situada dentro del bloque."
                    ),
                ],

                knowledge: [
                    "comprender qué significa invocar una función",
                    "comprender qué es una llamada a función",
                    "diferenciar claramente definición e invocación",
                    "reconocer una llamada dentro del flujo del programa",
                    "comprender que una llamada provoca la ejecución del cuerpo de la función",
                    "seguir el flujo desde una llamada hacia el cuerpo de la función",
                    "comprender que la ejecución continúa después de terminar el cuerpo",
                    "invocar una función varias veces",
                    "comprender que cada llamada vuelve a ejecutar el cuerpo",
                    "comprender el papel automático de PRINCIPAL como punto de entrada"
                ],

                notes: [
                    callout(
                        "PRINCIPAL es especial",
                        "`PRINCIPAL` utiliza la misma apariencia general de una función, pero CLRS lo reconoce como punto de entrada y comienza allí la ejecución automáticamente. No debe escribirse una llamada adicional a `PRINCIPAL`."
                    )
                ],

                recommendedTools: [
                    "execution-trace",
                    "call-stack"
                ],

                category: "FND-FUNC"
            }),
            lesson({
                order: 34,
                section: 6,
                title: "Parámetros y argumentos",

                objective:
                    "Comprender cómo una función puede recibir información mediante parámetros y cómo cada llamada proporciona valores concretos mediante argumentos.",

                problemStatement:
                    "La función SALUDAR puede mostrar un saludo, pero queremos utilizar la misma función para saludar a Ana, Luis o cualquier otra persona sin crear una función diferente para cada nombre. ¿Cómo podemos proporcionar a la función un dato diferente cada vez que la invocamos?",

                concepts: [
                    "parámetro",
                    "argumento",
                    "entrada de una función",
                    "correspondencia por posición"
                ],

                explanation: [
                    paragraph(
                        "En la lección anterior aprendimos que una función definida una sola vez puede invocarse varias veces. Sin embargo, nuestras funciones realizaban siempre su trabajo sin recibir nueva información desde cada llamada."
                    ),

                    callout(
                        "Problema de esta lección",
                        [
                            "Queremos reutilizar:",
                            "",
                            "SALUDAR",
                            "",
                            "pero necesitamos obtener:",
                            "",
                            "\"Hola Ana\"",
                            "\"Hola Luis\"",
                            "\"Hola Elena\"",
                            "",
                            "No queremos crear:",
                            "",
                            "SALUDAR_ANA",
                            "SALUDAR_LUIS",
                            "SALUDAR_ELENA",
                            "",
                            "¿Cómo puede la misma función",
                            "trabajar con datos diferentes?"
                        ].join("\n")
                    ),

                    paragraph(
                        "Para que una función pueda trabajar con información proporcionada desde una llamada utilizamos parámetros y argumentos."
                    ),

                    paragraph(
                        "Un parámetro es un nombre declarado en la definición de una función que representa información que la función espera recibir. Dentro del cuerpo, ese nombre permite utilizar el valor proporcionado al realizar la llamada."
                    ),


                    callout(
                        "El parámetro representa un dato esperado",
                        [
                            "SALUDAR(nombre)",
                            "        ↑",
                            "        │",
                            "     parámetro",
                            "",
                            "La función conoce el nombre",
                            "con el que trabajará:",
                            "",
                            "nombre",
                            "",
                            "pero no necesita conocer",
                            "todavía su valor concreto."
                        ].join("\n")
                    ),

                    paragraph(
                        "Un argumento es el valor o dato concreto que proporcionamos al invocar la función."
                    ),


                    callout(
                        "Parámetro ≠ argumento",
                        [
                            "DEFINICIÓN",
                            "",
                            "SALUDAR(nombre)",
                            "        ↑",
                            "    parámetro",
                            "",
                            "----------------",
                            "",
                            "LLAMADA",
                            "",
                            "SALUDAR(\"Ana\")",
                            "        ↑",
                            "     argumento"
                        ].join("\n")
                    ),

                    paragraph(
                        "La relación entre ambos puede comprenderse como un flujo de información: la llamada proporciona un argumento y la función utiliza ese valor mediante el parámetro correspondiente."
                    ),

                    callout(
                        "Flujo de información",
                        [
                            "LLAMADA",
                            "",
                            "SALUDAR(\"Ana\")",
                            "",
                            "        →",
                            "",
                            "argumento",
                            "\"Ana\"",
                            "",
                            "        → proporciona valor a",
                            "",
                            "parámetro",
                            "nombre",
                            "",
                            "        →",
                            "",
                            "cuerpo",
                            "\"Hola \" + nombre",
                            "",
                            "        →",
                            "",
                            "\"Hola Ana\""
                        ].join("\n")
                    ),

                    paragraph(
                        "La definición de la función no cambia cuando proporcionamos argumentos diferentes. Cada llamada puede entregar un nuevo valor y el mismo cuerpo trabaja con la información recibida en esa ejecución."
                    ),


                    callout(
                        "Misma función, distintas ejecuciones",
                        [
                            "SALUDAR(\"Ana\")",
                            "→ nombre representa \"Ana\"",
                            "→ \"Hola Ana\"",
                            "",
                            "SALUDAR(\"Luis\")",
                            "→ nombre representa \"Luis\"",
                            "→ \"Hola Luis\"",
                            "",
                            "SALUDAR(\"Elena\")",
                            "→ nombre representa \"Elena\"",
                            "→ \"Hola Elena\""
                        ].join("\n")
                    ),

                    paragraph(
                        "Una función puede necesitar más de un dato. En ese caso declaramos varios parámetros dentro de los paréntesis y proporcionamos varios argumentos al realizar la llamada."
                    ),


                    paragraph(
                        "Cuando existen varios parámetros, la posición establece la correspondencia entre ellos y los argumentos. El primer argumento proporciona información al primer parámetro, el segundo al segundo parámetro y así sucesivamente."
                    ),

                    callout(
                        "Correspondencia por posición",
                        [
                            "DEFINICIÓN",
                            "",
                            "MOSTRAR_PERSONA(nombre, edad)",
                            "                ↑       ↑",
                            "                │       │",
                            "             primero  segundo",
                            "",
                            "LLAMADA",
                            "",
                            "MOSTRAR_PERSONA(\"Ana\", 25)",
                            "                ↑      ↑",
                            "                │      │",
                            "             nombre   edad"
                        ].join("\n")
                    ),

                    paragraph(
                        "Por eso, al realizar una llamada debemos proporcionar la información de acuerdo con los parámetros esperados por la función. Cambiar la posición de los argumentos puede cambiar el significado con el que la función recibe los datos."
                    ),

                    paragraph(
                        "Los argumentos tampoco tienen que ser siempre literales. Una variable puede proporcionar su valor como argumento durante una llamada."
                    ),


                    paragraph(
                        "Hasta ahora el flujo de información entre funciones tiene una sola dirección: la llamada proporciona datos y la función los utiliza. Todavía falta resolver la dirección complementaria: ¿cómo puede una función calcular un valor y entregarlo de regreso al lugar desde el que fue llamada?"
                    )
                ],

                examples: [
                    clrs(
                        "lesson-034-parameters",
                        [
                            "SALUDAR(nombre)",
                            '    escribir "Hola " + nombre',
                            "",
                            "PRINCIPAL()",
                            '    SALUDAR("Ana")'
                        ].join("\n"),
                        "Parámetro y argumento",
                        "`nombre` pertenece a la definición y representa el dato esperado. `\"Ana\"` pertenece a la llamada y proporciona el valor concreto."
                    ),

                    clrs(
                        "lesson-034-reuse",
                        [
                            "SALUDAR(nombre)",
                            '    escribir "Hola " + nombre',
                            "",
                            "PRINCIPAL()",
                            '    SALUDAR("Ana")',
                            '    SALUDAR("Luis")',
                            '    SALUDAR("Elena")'
                        ].join("\n"),
                        "Reutilizar una función con información diferente",
                        "La definición permanece igual mientras cada llamada proporciona un argumento diferente."
                    ),

                    clrs(
                        "lesson-034-multiple",
                        [
                            "MOSTRAR_PERSONA(nombre, edad)",
                            '    escribir "Nombre: " + nombre',
                            '    escribir "Edad: " + A_CAD(edad)',
                            "",
                            "PRINCIPAL()",
                            '    MOSTRAR_PERSONA("Ana", 25)'
                        ].join("\n"),
                        "Varios parámetros y argumentos",
                        "Los argumentos proporcionan valores a los parámetros correspondientes según su posición."
                    ),

                    text(
                        "lesson-034-information-flow",
                        [
                            "LLAMADA",
                            "",
                            "MOSTRAR_PERSONA(\"Ana\", 25)",
                            "",
                            "        ↓",
                            "",
                            "\"Ana\" → nombre",
                            "25    → edad",
                            "",
                            "        ↓",
                            "",
                            "CUERPO DE LA FUNCIÓN",
                            "",
                            "utiliza nombre y edad"
                        ].join("\n"),
                        "La llamada proporciona información",
                        "Los parámetros ofrecen nombres internos con los que el cuerpo de la función puede trabajar con los valores proporcionados."
                    ),

                    clrs(
                        "lesson-034-parameter-definition",
                        [
                            "SALUDAR(nombre)",
                            '    escribir "Hola " + nombre'
                        ].join("\n"),
                        "Definir un parámetro",
                        "`nombre` es un parámetro. La función puede utilizarlo en su cuerpo aunque todavía no se haya determinado qué nombre concreto recibirá en una llamada."
                    ),

                    clrs(
                        "lesson-034-argument-call",
                        [
                            "SALUDAR(nombre)",
                            '    escribir "Hola " + nombre',
                            "",
                            "PRINCIPAL()",
                            '    SALUDAR("Ana")'
                        ].join("\n"),
                        "Proporcionar un argumento",
                        "En la llamada, `\"Ana\"` es el argumento. Durante esa ejecución, la función puede trabajar con ese valor mediante el parámetro `nombre`."
                    ),

                    clrs(
                        "lesson-034-different-arguments",
                        [
                            "SALUDAR(nombre)",
                            '    escribir "Hola " + nombre',
                            "",
                            "PRINCIPAL()",
                            '    SALUDAR("Ana")',
                            '    SALUDAR("Luis")',
                            '    SALUDAR("Elena")'
                        ].join("\n"),
                        "Una función, diferentes datos",
                        "Las tres llamadas utilizan la misma definición. En cada ejecución, el parámetro `nombre` permite trabajar con el argumento proporcionado en esa llamada."
                    ),

                    clrs(
                        "lesson-034-multiple-parameters",
                        [
                            "MOSTRAR_PERSONA(nombre, edad)",
                            '    escribir "Nombre: " + nombre',
                            '    escribir "Edad: " + A_CAD(edad)',
                            "",
                            "PRINCIPAL()",
                            '    MOSTRAR_PERSONA("Ana", 25)'
                        ].join("\n"),
                        "Recibir más de un dato",
                        "`MOSTRAR_PERSONA` declara dos parámetros. La llamada proporciona dos argumentos que corresponden respectivamente con `nombre` y `edad`."
                    ),

                    clrs(
                        "lesson-034-variable-arguments",
                        [
                            "MOSTRAR_PERSONA(nombre, edad)",
                            '    escribir "Nombre: " + nombre',
                            '    escribir "Edad: " + A_CAD(edad)',
                            "",
                            "PRINCIPAL()",
                            '    persona = "Luis"',
                            "    anios = 30",
                            "",
                            "    MOSTRAR_PERSONA(persona, anios)"
                        ].join("\n"),
                        "Utilizar variables como argumentos",
                        "La llamada utiliza los valores actuales de `persona` y `anios` para proporcionar la información esperada por los parámetros."
                    ),
                ],

                knowledge: [
                    "comprender qué es un parámetro",
                    "comprender qué es un argumento",
                    "diferenciar parámetros y argumentos",
                    "comprender que un parámetro representa información esperada por una función",
                    "declarar parámetros en la definición de una función",
                    "proporcionar argumentos durante una llamada",
                    "comprender cómo un argumento proporciona un valor al parámetro correspondiente",
                    "invocar una misma función con valores diferentes",
                    "utilizar variables como argumentos",
                    "utilizar varios parámetros y argumentos",
                    "comprender la correspondencia por posición entre parámetros y argumentos",
                    "comprender que los parámetros permiten que una función trabaje con datos proporcionados desde diferentes llamadas"
                ],

                notes: [
                    callout(
                        "La forma puede variar entre lenguajes",
                        "La idea de proporcionar información a un subprograma mediante parámetros y argumentos es ampliamente transferible, aunque la sintaxis, las reglas de tipos y otros detalles de las llamadas pueden variar entre lenguajes."
                    )
                ],

                recommendedTools: [
                    "execution-trace",
                    "call-stack"
                ],

                category: "FND-FUNC"
            }),
            lesson({
                order: 35,
                section: 6,
                title: "Valores de retorno",

                objective:
                    "Comprender cómo una función puede producir y devolver un valor mediante retornar, y cómo el resultado de una llamada puede almacenarse, mostrarse o participar en otras expresiones.",

                problemStatement:
                    "Una función puede recibir un precio y una cantidad para calcular un subtotal, pero otra parte del programa necesita utilizar ese resultado posteriormente. ¿Cómo puede la función entregar el valor calculado al lugar desde el que fue llamada?",

                concepts: [
                    "valor de retorno",
                    "retornar",
                    "resultado de una llamada",
                    "función con retorno"
                ],

                explanation: [
                    paragraph(
                        "En la lección anterior aprendimos a proporcionar información a una función mediante argumentos. Ese flujo permite que la función reciba los datos que necesita para realizar su trabajo."
                    ),

                    callout(
                        "Hasta ahora",
                        [
                            "PRINCIPAL",
                            "",
                            "precio = 100",
                            "cantidad = 3",
                            "",
                            "        → argumentos",
                            "",
                            "CALCULAR_SUBTOTAL(precio, cantidad)",
                            "",
                            "La información viaja",
                            "hacia la función."
                        ].join("\n")
                    ),

                    paragraph(
                        "Sin embargo, una función que realiza un cálculo suele producir información que otra parte del programa necesita utilizar. En nuestro problema, la función puede calcular el subtotal, pero necesitamos recuperar ese resultado."
                    ),

                    callout(
                        "Problema de esta lección",
                        [
                            "precio = 100",
                            "cantidad = 3",
                            "",
                            "        →",
                            "",
                            "CALCULAR_SUBTOTAL",
                            "",
                            "        → calcula",
                            "",
                            "300",
                            "",
                            "Pero...",
                            "",
                            "¿cómo vuelve 300",
                            "al lugar de la llamada?"
                        ].join("\n")
                    ),

                    paragraph(
                        "En CLRS utilizamos `retornar` para entregar un valor desde una función. El valor retornado se convierte en el resultado producido por la llamada."
                    ),


                    callout(
                        "Flujo completo de información",
                        [
                            "LLAMADA",
                            "",
                            "CALCULAR_SUBTOTAL(100, 3)",
                            "",
                            "        →",
                            "",
                            "parámetros",
                            "precio = 100",
                            "cantidad = 3",
                            "",
                            "        →",
                            "",
                            "cálculo",
                            "precio * cantidad",
                            "",
                            "        →",
                            "",
                            "300",
                            "",
                            "        → retornar",
                            "",
                            "la llamada produce 300"
                        ].join("\n")
                    ),

                    paragraph(
                        "Por tanto, una llamada a una función con retorno también puede entenderse como una expresión que produce un valor."
                    ),

                    callout(
                        "La llamada produce un valor",
                        [
                            "resultado = CALCULAR_SUBTOTAL(100, 3)",
                            "",
                            "            →",
                            "",
                            "CALCULAR_SUBTOTAL(100, 3)",
                            "produce",
                            "300",
                            "",
                            "            →",
                            "",
                            "resultado = 300"
                        ].join("\n")
                    ),

                    paragraph(
                        "La expresión situada después de `retornar` se evalúa para obtener el valor que será entregado. Por eso también podemos retornar directamente una expresión."
                    ),


                    paragraph(
                        "Como la llamada produce un valor, no es obligatorio almacenarlo inmediatamente en una variable. Puede utilizarse directamente en un lugar que necesite ese valor."
                    ),


                    paragraph(
                        "El resultado de una llamada también puede convertirse en un operando dentro de una expresión mayor."
                    ),


                    callout(
                        "Evaluación por etapas",
                        [
                            "SUMAR(2, 3) * 2",
                            "",
                            "        →",
                            "",
                            "5 * 2",
                            "",
                            "        →",
                            "",
                            "10"
                        ].join("\n")
                    ),

                    paragraph(
                        "Es especialmente importante distinguir `retornar` de `escribir`. Ambas operaciones pueden utilizar el mismo valor, pero cumplen responsabilidades distintas."
                    ),

                    callout(
                        "retornar ≠ escribir",
                        [
                            "escribir resultado",
                            "",
                            "→ comunica el valor",
                            "  como salida del programa",
                            "",
                            "----------------",
                            "",
                            "retornar resultado",
                            "",
                            "→ entrega el valor",
                            "  al punto de llamada",
                            "  para que pueda utilizarse"
                        ].join("\n")
                    ),

                    paragraph(
                        "Si una función únicamente muestra un cálculo mediante `escribir`, otra parte del programa no obtiene ese valor como resultado de la llamada. En cambio, al retornarlo, el código que realizó la llamada puede decidir posteriormente qué hacer con él."
                    ),


                    paragraph(
                        "Esto permite separar responsabilidades con mayor claridad: una función puede encargarse de producir un resultado, mientras que otra parte del programa decide cómo utilizarlo."
                    ),

                    callout(
                        "Dos responsabilidades",
                        [
                            "FUNCIÓN",
                            "",
                            "calcular",
                            "→",
                            "retornar resultado",
                            "",
                            "        →",
                            "",
                            "LLAMADOR",
                            "",
                            "recibir resultado",
                            "→",
                            "almacenarlo",
                            "mostrarlo",
                            "o utilizarlo"
                        ].join("\n")
                    ),

                    paragraph(
                        "Con parámetros y valores de retorno ya podemos representar un flujo de información en ambas direcciones: una llamada proporciona datos a una función y esa función puede producir un resultado que vuelve al punto de llamada."
                    ),

                    callout(
                        "Entrada y resultado de una función",
                        [
                            "argumentos",
                            "",
                            "PRINCIPAL ─────────→ FUNCIÓN",
                            "",
                            "          datos de entrada",
                            "",
                            "PRINCIPAL ←───────── FUNCIÓN",
                            "",
                            "          valor retornado"
                        ].join("\n")
                    ),

                    paragraph(
                        "En la siguiente lección estudiaremos otra consecuencia de organizar el programa mediante funciones: los identificadores definidos dentro de una función no necesariamente están disponibles en todas las partes del programa."
                    )
                ],

                examples: [
                    clrs(
                        "lesson-035-return",
                        [
                            "SUMAR(a, b)",
                            "    retornar a + b",
                            "",
                            "PRINCIPAL()",
                            "    resultado = SUMAR(5, 3)",
                            "    escribir resultado"
                        ].join("\n"),
                        "Calcular y retornar",
                        "`SUMAR` recibe dos valores, produce 8 y entrega ese resultado a la llamada."
                    ),

                    text(
                        "lesson-035-return-trace",
                        [
                            "resultado = SUMAR(5, 3)",
                            "",
                            "1. argumento 5 → a",
                            "2. argumento 3 → b",
                            "3. evaluar a + b",
                            "4. obtener 8",
                            "5. retornar 8",
                            "6. SUMAR(5, 3) produce 8",
                            "7. resultado = 8"
                        ].join("\n"),
                        "Seguir el valor retornado",
                        "El valor se calcula dentro de la función y después vuelve al punto donde se realizó la llamada."
                    ),

                    clrs(
                        "lesson-035-direct-expression",
                        [
                            "DOBLE(numero)",
                            "    retornar numero * 2",
                            "",
                            "PRINCIPAL()",
                            "    escribir DOBLE(6)"
                        ].join("\n"),
                        "Utilizar directamente una llamada",
                        "`DOBLE(6)` produce un valor que puede utilizarse directamente como parte de otra instrucción."
                    ),

                    clrs(
                        "lesson-035-return-in-expression",
                        [
                            "SUMAR(a, b)",
                            "    retornar a + b",
                            "",
                            "PRINCIPAL()",
                            "    total = SUMAR(2, 3) * 2",
                            "    escribir total"
                        ].join("\n"),
                        "Utilizar una llamada como operando",
                        "El resultado 5 producido por la llamada se incorpora a una expresión mayor y el resultado final es 10."
                    ),

                    clrs(
                        "lesson-035-basic-return",
                        [
                            "CALCULAR_SUBTOTAL(precio, cantidad)",
                            "    subtotal = precio * cantidad",
                            "    retornar subtotal",
                            "",
                            "PRINCIPAL()",
                            "    resultado = CALCULAR_SUBTOTAL(100, 3)",
                            "    escribir resultado"
                        ].join("\n"),
                        "Devolver un cálculo",
                        "`CALCULAR_SUBTOTAL` produce 300 y lo retorna. La llamada completa produce entonces ese valor, que se asigna a `resultado`."
                    ),

                    clrs(
                        "lesson-035-return-expression",
                        [
                            "DOBLE(numero)",
                            "    retornar numero * 2",
                            "",
                            "PRINCIPAL()",
                            "    resultado = DOBLE(6)",
                            "    escribir resultado"
                        ].join("\n"),
                        "Retornar el resultado de una expresión",
                        "La expresión `numero * 2` produce 12 y `retornar` entrega ese valor al punto de llamada."
                    ),

                    clrs(
                        "lesson-035-direct-use",
                        [
                            "DOBLE(numero)",
                            "    retornar numero * 2",
                            "",
                            "PRINCIPAL()",
                            "    escribir DOBLE(6)"
                        ].join("\n"),
                        "Utilizar directamente el resultado",
                        "`DOBLE(6)` produce 12 y ese valor es utilizado directamente por `escribir`."
                    ),

                    clrs(
                        "lesson-035-call-in-expression",
                        [
                            "SUMAR(a, b)",
                            "    retornar a + b",
                            "",
                            "PRINCIPAL()",
                            "    total = SUMAR(2, 3) * 2",
                            "    escribir total"
                        ].join("\n"),
                        "Una llamada dentro de otra expresión",
                        "`SUMAR(2, 3)` produce 5. Después ese valor participa como operando en `5 * 2`, produciendo 10."
                    ),

                    clrs(
                        "lesson-035-caller-decides",
                        [
                            "CALCULAR_DOBLE(numero)",
                            "    retornar numero * 2",
                            "",
                            "PRINCIPAL()",
                            "    doble = CALCULAR_DOBLE(5)",
                            "",
                            "    escribir doble",
                            "    resultadoFinal = doble + 10",
                            "    escribir resultadoFinal"
                        ].join("\n"),
                        "El llamador decide cómo utilizar el resultado",
                        "La función se concentra en calcular el doble. `PRINCIPAL` recibe ese valor y puede mostrarlo, almacenarlo o utilizarlo en nuevos cálculos."
                    ),
                ],

                knowledge: [
                    "comprender qué es un valor de retorno",
                    "utilizar retornar para entregar un valor desde una función",
                    "comprender que la expresión de retornar produce el valor que será entregado",
                    "comprender que una llamada con retorno produce un valor",
                    "asignar el resultado de una llamada a una variable",
                    "utilizar directamente el resultado de una llamada",
                    "utilizar una llamada como parte de una expresión",
                    "diferenciar claramente retornar de escribir",
                    "comprender que el código llamador decide cómo utilizar el valor retornado",
                    "comprender el flujo de información desde los argumentos hacia la función y desde el retorno hacia el llamador"
                ],

                notes: [
                    callout(
                        "Funciones con distintas responsabilidades",
                        "Una función puede realizar acciones, producir un valor o formar parte de una solución que combine ambas necesidades. En esta lección el objetivo principal es comprender el retorno como mecanismo para entregar un resultado reutilizable al punto de llamada."
                    )
                ],

                recommendedTools: [
                    "execution-trace",
                    "call-stack"
                ],

                category: "FND-FUNC"
            }),
            lesson({
                order: 36,
                section: 6,
                title: "Ámbito",

                objective:
                    "Comprender cómo el ámbito determina dónde puede utilizarse un identificador, distinguir el ámbito global del ámbito de función en CLRS y reconocer cuándo un nombre local oculta a uno global.",

                problemStatement:
                    "Un programa contiene varias funciones y algunas utilizan identificadores con los mismos nombres. ¿Cómo determina CLRS qué variable representa cada nombre y desde qué partes del programa puede utilizarse?",

                concepts: [
                    "ámbito",
                    "visibilidad",
                    "ámbito global",
                    "ámbito de función",
                    "variable local",
                    "ocultamiento de nombres"
                ],

                explanation: [
                    paragraph(
                        "Ahora que nuestros programas contienen varias funciones, los identificadores pueden aparecer en diferentes partes del código. Un mismo programa puede tener variables globales, parámetros y variables creadas dentro de distintas funciones."
                    ),

                    callout(
                        "Problema de esta lección",
                        [
                            "Tenemos varias partes del programa:",
                            "",
                            "ámbito global",
                            "función A",
                            "función B",
                            "PRINCIPAL",
                            "",
                            "y pueden aparecer nombres como:",
                            "",
                            "estado",
                            "resultado",
                            "mensaje",
                            "",
                            "¿Desde dónde puede utilizarse",
                            "cada identificador?",
                            "",
                            "¿Y qué ocurre si el mismo",
                            "nombre aparece en dos ámbitos?"
                        ].join("\n")
                    ),

                    paragraph(
                        "El ámbito de un identificador determina la región del programa en la que ese identificador puede utilizarse para referirse a un elemento determinado. La visibilidad describe, en consecuencia, desde qué lugares ese nombre está disponible."
                    ),

                    paragraph(
                        "En CLRS trabajaremos con dos niveles principales para las variables: ámbito global y ámbito de función."
                    ),

                    callout(
                        "Ámbitos de variables en CLRS",
                        [
                            "ÁMBITO GLOBAL",
                            "",
                            "variable creada",
                            "fuera de cualquier función",
                            "",
                            "----------------",
                            "",
                            "ÁMBITO DE FUNCIÓN",
                            "",
                            "parámetros",
                            "y variables creadas",
                            "dentro de una función"
                        ].join("\n")
                    ),

                    paragraph(
                        "Una variable creada fuera de cualquier función pertenece al ámbito global. Su nombre puede utilizarse desde otras partes del programa de acuerdo con las reglas de resolución de nombres de CLRS."
                    ),


                    paragraph(
                        "Una variable creada mediante una asignación dentro de una función pertenece al ámbito de esa función. Otras funciones no obtienen automáticamente acceso a ese identificador local."
                    ),

                    callout(
                        "Una variable local pertenece a su función",
                        [
                            "MOSTRAR()",
                            '    detalle = "Listo"',
                            "    escribir detalle",
                            "",
                            "detalle",
                            "→ pertenece a MOSTRAR",
                            "",
                            "otra función",
                            "→ no obtiene automáticamente",
                            "  ese identificador"
                        ].join("\n")
                    ),

                    paragraph(
                        "Los parámetros también pertenecen al ámbito de la función que los declara. El parámetro existe como nombre disponible para el cuerpo de esa función y permite trabajar con el argumento recibido durante cada llamada."
                    ),


                    paragraph(
                        "`PRINCIPAL` también es una función. Por ello, una variable creada mediante asignación dentro de `PRINCIPAL` pertenece al ámbito de `PRINCIPAL`; no se convierte en una variable global solamente por encontrarse en el punto de entrada del programa."
                    ),

                    callout(
                        "PRINCIPAL también tiene ámbito propio",
                        [
                            "PRINCIPAL()",
                            "    numero = 10",
                            "",
                            "numero",
                            "→ local de PRINCIPAL",
                            "",
                            "No es lo mismo que:",
                            "",
                            "numero = 10",
                            "",
                            "PRINCIPAL()",
                            "    ...",
                            "",
                            "donde numero se creó",
                            "fuera de las funciones"
                        ].join("\n")
                    ),

                    paragraph(
                        "Dos ámbitos diferentes pueden contener identificadores con el mismo nombre. Esto no significa necesariamente que se trate de la misma variable."
                    ),

                    paragraph(
                        "En CLRS, una asignación realizada dentro de una función crea o reutiliza un identificador perteneciente a esa función. Si existe globalmente otro identificador con el mismo nombre, el identificador local es el que se utiliza dentro de esa función."
                    ),

                    callout(
                        "Ocultamiento de nombres",
                        [
                            'estado = "Global"',
                            "",
                            "MOSTRAR()",
                            '    estado = "Local"',
                            "    escribir estado",
                            "",
                            "Dentro de MOSTRAR:",
                            "",
                            'estado → "Local"',
                            "",
                            "Fuera de MOSTRAR:",
                            "",
                            'estado → "Global"'
                        ].join("\n")
                    ),


                    paragraph(
                        "A este fenómeno lo llamamos ocultamiento de nombres: dentro de determinado ámbito, un identificador más local puede hacer que otro identificador con el mismo nombre deje de ser el que se utiliza allí."
                    ),

                    callout(
                        "Mismo texto, distinta referencia",
                        [
                            "estado",
                            "",
                            "en ámbito global",
                            "→ variable global",
                            "",
                            "estado",
                            "",
                            "dentro de MOSTRAR",
                            "→ variable local de MOSTRAR",
                            "",
                            "El nombre escrito es igual.",
                            "La variable representada no."
                        ].join("\n")
                    ),

                    paragraph(
                        "El ámbito tampoco debe confundirse con la indentación. La indentación permite expresar qué instrucciones pertenecen a una estructura, pero en CLRS no todos los bloques crean un nuevo ámbito de variables."
                    ),

                    paragraph(
                        "Los bloques de `si`, `mientras` y `para` no introducen un ámbito adicional. Una variable creada mediante asignación dentro de esos bloques sigue perteneciendo al ámbito de la función que contiene la estructura, o al ámbito global cuando la estructura se encuentra fuera de una función."
                    ),


                    callout(
                        "Bloque ≠ nuevo ámbito en CLRS",
                        [
                            "FUNCIÓN",
                            "",
                            "    si ...",
                            "        variable = ...",
                            "",
                            "    mientras ...",
                            "        otra = ...",
                            "",
                            "    para ...",
                            "        dato = ...",
                            "",
                            "Las estructuras cambian",
                            "el flujo y forman bloques,",
                            "",
                            "pero no crean nuevos",
                            "ámbitos de variables."
                        ].join("\n")
                    ),

                    paragraph(
                        "Comprender el ámbito permite razonar con mayor precisión sobre un programa dividido en funciones: podemos identificar qué información pertenece a cada parte y evitar asumir que cualquier variable está disponible desde cualquier lugar."
                    ),

                    paragraph(
                        "Las reglas exactas de ámbito dependen del lenguaje. La idea de que un identificador posee una región de visibilidad es transferible, pero otros lenguajes pueden introducir ámbitos adicionales, por ejemplo en bloques condicionales o iterativos."
                    ),

                    paragraph(
                        "En la siguiente lección utilizaremos todo lo aprendido sobre funciones para reorganizar código existente sin cambiar el comportamiento que produce el programa."
                    )
                ],

                examples: [
                    clrs(
                        "lesson-036-global-local",
                        [
                            'mensaje = "Global"',
                            "",
                            "MOSTRAR()",
                            '    detalle = "Local"',
                            "    escribir mensaje",
                            "    escribir detalle",
                            "",
                            "PRINCIPAL()",
                            "    MOSTRAR()"
                        ].join("\n"),
                        "Ámbito global y ámbito de función",
                        "`mensaje` pertenece al ámbito global. `detalle` pertenece únicamente al ámbito de `MOSTRAR`."
                    ),

                    text(
                        "lesson-036-visibility-model",
                        [
                            "ÁMBITO GLOBAL",
                            "",
                            'mensaje = "Global"',
                            "",
                            "┌────────────────────────────┐",
                            "│ MOSTRAR                    │",
                            "│                            │",
                            '│ detalle = "Local"          │',
                            "│                            │",
                            "│ puede utilizar mensaje     │",
                            "│ puede utilizar detalle     │",
                            "└────────────────────────────┘",
                            "",
                            "detalle pertenece",
                            "a MOSTRAR"
                        ].join("\n"),
                        "Diferentes regiones de visibilidad",
                        "El lugar donde se crea un identificador influye en las partes del programa desde las que puede utilizarse."
                    ),

                    clrs(
                        "lesson-036-shadowing-example",
                        [
                            'estado = "Global"',
                            "",
                            "MOSTRAR()",
                            '    estado = "Local"',
                            "    escribir estado",
                            "",
                            "PRINCIPAL()",
                            "    MOSTRAR()",
                            "    escribir estado"
                        ].join("\n"),
                        "Ocultamiento de nombres",
                        "Existen dos identificadores llamados `estado` en ámbitos diferentes. La función utiliza su identificador local y el valor global permanece independiente."
                    ),

                    clrs(
                        "lesson-036-principal-local",
                        [
                            "MOSTRAR()",
                            '    mensaje = "Dentro de MOSTRAR"',
                            "    escribir mensaje",
                            "",
                            "PRINCIPAL()",
                            '    mensaje = "Dentro de PRINCIPAL"',
                            "    MOSTRAR()",
                            "    escribir mensaje"
                        ].join("\n"),
                        "Cada función posee su propio ámbito",
                        "`MOSTRAR` y `PRINCIPAL` pueden utilizar un identificador llamado `mensaje`, pero cada uno pertenece al ámbito de su función."
                    ),

                    clrs(
                        "lesson-036-no-block-scope-example",
                        [
                            "MOSTRAR()",
                            "    si VERDAD",
                            '        resultado = "Correcto"',
                            "",
                            "    escribir resultado",
                            "",
                            "PRINCIPAL()",
                            "    MOSTRAR()"
                        ].join("\n"),
                        "Las decisiones no crean ámbito en CLRS",
                        "`resultado` pertenece a `MOSTRAR` aunque su primera asignación se encuentre dentro del bloque de `si`."
                    ),

                    clrs(
                        "lesson-036-global",
                        [
                            'mensaje = "Sistema activo"',
                            "",
                            "MOSTRAR()",
                            "    escribir mensaje",
                            "",
                            "PRINCIPAL()",
                            "    MOSTRAR()"
                        ].join("\n"),
                        "Utilizar una variable global",
                        "`mensaje` se crea fuera de cualquier función y pertenece al ámbito global. `MOSTRAR` puede utilizar ese nombre porque no crea dentro de sí otro identificador local llamado `mensaje`."
                    ),

                    clrs(
                        "lesson-036-parameter-scope",
                        [
                            "SALUDAR(nombre)",
                            '    escribir "Hola " + nombre',
                            "",
                            "PRINCIPAL()",
                            '    SALUDAR("Ana")'
                        ].join("\n"),
                        "Un parámetro pertenece a su función",
                        "`nombre` es un identificador del ámbito de `SALUDAR`. Puede utilizarse en su cuerpo porque forma parte de la definición de esa función."
                    ),

                    clrs(
                        "lesson-036-shadowing",
                        [
                            'estado = "Global"',
                            "",
                            "MOSTRAR()",
                            '    estado = "Local"',
                            "    escribir estado",
                            "",
                            "PRINCIPAL()",
                            "    MOSTRAR()",
                            "    escribir estado"
                        ].join("\n"),
                        "El mismo nombre en dos ámbitos",
                        "La asignación dentro de `MOSTRAR` utiliza un identificador local de esa función. Por eso primero se muestra `Local`; después, desde `PRINCIPAL`, el nombre global continúa representando `Global`."
                    ),

                    clrs(
                        "lesson-036-no-block-scope",
                        [
                            "MOSTRAR()",
                            "    si VERDAD",
                            '        mensaje = "Visible"',
                            "",
                            "    escribir mensaje",
                            "",
                            "PRINCIPAL()",
                            "    MOSTRAR()"
                        ].join("\n"),
                        "Un bloque si no crea otro ámbito",
                        "`mensaje` se asigna dentro de `si`, pero continúa perteneciendo al ámbito de `MOSTRAR`. Como en este ejemplo la condición es `VERDAD`, la asignación ocurre y el identificador puede utilizarse después del bloque."
                    ),
                ],

                knowledge: [
                    "comprender qué es el ámbito de un identificador",
                    "comprender qué significa visibilidad",
                    "reconocer variables pertenecientes al ámbito global",
                    "reconocer variables pertenecientes al ámbito de una función",
                    "comprender que los parámetros pertenecen al ámbito de su función",
                    "comprender que PRINCIPAL posee su propio ámbito de función",
                    "distinguir una variable global de una variable creada dentro de PRINCIPAL",
                    "comprender que dos funciones pueden utilizar identificadores con el mismo nombre sin representar necesariamente la misma variable",
                    "comprender el ocultamiento de un nombre global mediante un identificador local",
                    "comprender que una asignación dentro de una función crea o reutiliza un identificador local de esa función",
                    "comprender que si, mientras y para no crean ámbitos adicionales de variables en CLRS",
                    "comprender que las reglas concretas de ámbito pueden variar entre lenguajes"
                ],

                notes: [
                    callout(
                        "Ámbito de bloque en otros lenguajes",
                        "Algunos lenguajes crean ámbitos adicionales dentro de bloques como condicionales o ciclos. CLRS no lo hace: `si`, `mientras` y `para` modifican la estructura del flujo, pero las variables que se crean en ellos continúan perteneciendo al ámbito global o al ámbito de la función que los contiene."
                    )
                ],

                recommendedTools: [
                    "call-stack",
                    "debugger"
                ],

                category: "FND-FUNC"
            }),
            lesson({
                order: 37,
                section: 6,
                title: "Refactorización mediante funciones",

                objective:
                    "Comprender la refactorización como una modificación de la estructura interna del código que conserva su comportamiento observable, y utilizar funciones para representar responsabilidades repetidas cuando su extracción mejora la organización de la solución.",

                problemStatement:
                    "Un programa saluda a varias personas y funciona correctamente, pero la misma operación de construir y mostrar el saludo aparece repetida. ¿Podemos reorganizar el código para representar esa responsabilidad una sola vez sin cambiar la salida que produce el programa?",

                concepts: [
                    "refactorización",
                    "comportamiento observable",
                    "extracción de función",
                    "responsabilidad",
                    "reutilización"
                ],

                explanation: [
                    paragraph(
                        "Hasta ahora hemos aprendido a crear funciones, invocarlas, proporcionarles información mediante parámetros, obtener resultados mediante retornar y comprender el ámbito de sus identificadores. Con esas herramientas ya podemos utilizarlas no solo al construir programas nuevos, sino también para reorganizar programas existentes."
                    ),

                    callout(
                        "Problema de esta lección",
                        [
                            "El programa ya funciona:",
                            "",
                            "\"Hola Ana\"",
                            "\"Hola Luis\"",
                            "\"Hola Elena\"",
                            "",
                            "Pero la misma responsabilidad",
                            "aparece escrita varias veces:",
                            "",
                            "construir y mostrar",
                            "un saludo.",
                            "",
                            "¿Podemos reorganizar",
                            "el código sin cambiar",
                            "el resultado?"
                        ].join("\n")
                    ),

                    paragraph(
                        "Refactorizar significa modificar la estructura interna de un programa conservando su comportamiento observable. El objetivo no es cambiar qué problema resuelve el programa, sino reorganizar cómo está expresada su solución."
                    ),

                    callout(
                        "Idea fundamental",
                        [
                            "ANTES",
                            "",
                            "programa que funciona",
                            "",
                            "        →",
                            "",
                            "cambiar su estructura",
                            "",
                            "        →",
                            "",
                            "DESPUÉS",
                            "",
                            "programa reorganizado",
                            "",
                            "        →",
                            "",
                            "mismo comportamiento",
                            "observable"
                        ].join("\n")
                    ),

                    paragraph(
                        "En los ejemplos de esta ruta observaremos principalmente el comportamiento mediante las salidas producidas. Si el programa mostraba determinados resultados antes de la refactorización, debe continuar produciendo esos mismos resultados después."
                    ),

                    paragraph(
                        "Una técnica sencilla de refactorización consiste en reconocer una responsabilidad que aparece repetida, representarla mediante una función y sustituir las repeticiones originales por llamadas."
                    ),

                    callout(
                        "Extraer una función",
                        [
                            "responsabilidad repetida",
                            "",
                            "        →",
                            "",
                            "identificar qué trabajo",
                            "es común",
                            "",
                            "        →",
                            "",
                            "crear una función",
                            "",
                            "        →",
                            "",
                            "sustituir las repeticiones",
                            "por llamadas",
                            "",
                            "        →",
                            "",
                            "comprobar que",
                            "el comportamiento se conserva"
                        ].join("\n")
                    ),

                    paragraph(
                        "Consideremos primero una versión en la que la misma operación aparece directamente varias veces."
                    ),


                    paragraph(
                        "En las tres partes cambia el dato utilizado, pero la responsabilidad es la misma. Podemos representar esa diferencia mediante un parámetro y conservar una sola definición de la operación."
                    ),


                    callout(
                        "La estructura cambió",
                        [
                            "ANTES",
                            "",
                            "operación para Ana",
                            "operación para Luis",
                            "operación para Elena",
                            "",
                            "        → refactorizar",
                            "",
                            "DESPUÉS",
                            "",
                            "una función",
                            "+",
                            "tres llamadas",
                            "",
                            "La organización cambió.",
                            "La salida no."
                        ].join("\n")
                    ),

                    paragraph(
                        "Podemos comprobar la preservación del comportamiento comparando aquello que observa quien ejecuta el programa."
                    ),


                    paragraph(
                        "La misma técnica puede aplicarse a operaciones que producen valores. Si un cálculo aparece repetido con distintos datos, una función con parámetros y retorno puede representar la responsabilidad común."
                    ),



                    paragraph(
                        "Sin embargo, encontrar instrucciones repetidas no significa que siempre debamos crear una función. La repetición es una señal que podemos examinar, no una regla automática de diseño."
                    ),

                    callout(
                        "Repetición no significa automáticamente función",
                        [
                            "Preguntar:",
                            "",
                            "¿estas instrucciones realizan",
                            "la misma responsabilidad?",
                            "",
                            "¿puedo darle un nombre",
                            "que describa su propósito?",
                            "",
                            "¿la función representa",
                            "una parte comprensible",
                            "de la solución?",
                            "",
                            "Si la respuesta es sí,",
                            "la extracción puede",
                            "tener sentido."
                        ].join("\n")
                    ),

                    paragraph(
                        "Crear funciones arbitrariamente también puede dificultar la comprensión. La finalidad de la refactorización no es producir la mayor cantidad posible de funciones, sino expresar con mayor claridad las responsabilidades que ya existen en la solución."
                    ),

                    paragraph(
                        "Después de modificar la estructura debemos comprobar nuevamente el comportamiento. Una reorganización deja de ser una refactorización correcta si accidentalmente cambia los resultados que el programa debía producir."
                    ),

                    callout(
                        "Refactorizar requiere comprobar",
                        [
                            "1. programa original funciona",
                            "",
                            "2. modificar estructura",
                            "",
                            "3. ejecutar nuevamente",
                            "",
                            "4. comparar comportamiento",
                            "",
                            "5. confirmar que",
                            "   el resultado se conserva"
                        ].join("\n")
                    ),

                    paragraph(
                        "Las funciones son una herramienta especialmente útil para esta clase de reorganización porque permiten dar nombre a responsabilidades, proporcionarles diferentes datos mediante parámetros y reutilizar sus resultados mediante valores de retorno."
                    ),

                    paragraph(
                        "Con esta lección cerramos el estudio inicial de programación procedimental. Ya podemos organizar instrucciones no solo mediante estructuras de control, sino también mediante funciones que representan responsabilidades diferenciadas."
                    )
                ],

                examples: [
                    clrs(
                        "lesson-037-greeting-before",
                        [
                            "PRINCIPAL()",
                            '    escribir "Hola Ana"',
                            '    escribir "Hola Luis"'
                        ].join("\n"),
                        "Una responsabilidad repetida",
                        "Los dos mensajes realizan conceptualmente la misma operación con información diferente."
                    ),

                    clrs(
                        "lesson-037-greeting-after",
                        [
                            "MOSTRAR_SALUDO(nombre)",
                            '    escribir "Hola " + nombre',
                            "",
                            "PRINCIPAL()",
                            '    MOSTRAR_SALUDO("Ana")',
                            '    MOSTRAR_SALUDO("Luis")'
                        ].join("\n"),
                        "Extraer la responsabilidad",
                        "La operación común se expresa mediante una función y los datos variables se proporcionan como argumentos."
                    ),

                    text(
                        "lesson-037-same-behavior",
                        [
                            "ANTES",
                            "Hola Ana",
                            "Hola Luis",
                            "",
                            "DESPUÉS",
                            "Hola Ana",
                            "Hola Luis",
                            "",
                            "estructura diferente",
                            "↓",
                            "mismo comportamiento"
                        ].join("\n"),
                        "Preservar el comportamiento",
                        "Una refactorización reorganiza la implementación sin cambiar el resultado esperado."
                    ),

                    clrs(
                        "lesson-037-calculation",
                        [
                            "CALCULAR_TOTAL(precio)",
                            "    retornar precio * 1.16",
                            "",
                            "PRINCIPAL()",
                            "    total1 = CALCULAR_TOTAL(100)",
                            "    total2 = CALCULAR_TOTAL(250)",
                            "",
                            "    escribir total1",
                            "    escribir total2"
                        ].join("\n"),
                        "Generalizar un cálculo repetido",
                        "Los parámetros permiten representar las diferencias entre las repeticiones sin duplicar la operación común."
                    ),

                    clrs(
                        "lesson-037-before",
                        [
                            "PRINCIPAL()",
                            '    nombre = "Ana"',
                            '    escribir "Hola " + nombre',
                            "",
                            '    nombre = "Luis"',
                            '    escribir "Hola " + nombre',
                            "",
                            '    nombre = "Elena"',
                            '    escribir "Hola " + nombre'
                        ].join("\n"),
                        "Antes de refactorizar",
                        "El programa funciona, pero la responsabilidad de construir y mostrar un saludo aparece repetida con diferentes nombres."
                    ),

                    clrs(
                        "lesson-037-after",
                        [
                            "MOSTRAR_SALUDO(nombre)",
                            '    escribir "Hola " + nombre',
                            "",
                            "PRINCIPAL()",
                            '    MOSTRAR_SALUDO("Ana")',
                            '    MOSTRAR_SALUDO("Luis")',
                            '    MOSTRAR_SALUDO("Elena")'
                        ].join("\n"),
                        "Después de refactorizar",
                        "`MOSTRAR_SALUDO` representa una sola vez la responsabilidad común. Cada llamada proporciona el dato diferente mediante un argumento."
                    ),

                    text(
                        "lesson-037-behavior",
                        [
                            "ANTES",
                            "",
                            "Hola Ana",
                            "Hola Luis",
                            "Hola Elena",
                            "",
                            "----------------",
                            "",
                            "DESPUÉS",
                            "",
                            "Hola Ana",
                            "Hola Luis",
                            "Hola Elena",
                            "",
                            "Mismo comportamiento observable"
                        ].join("\n"),
                        "Conservar el resultado",
                        "El código está organizado de manera diferente, pero la secuencia de salida permanece igual."
                    ),

                    clrs(
                        "lesson-037-calculation-before",
                        [
                            "PRINCIPAL()",
                            "    precio1 = 100",
                            "    total1 = precio1 * 1.16",
                            "",
                            "    precio2 = 250",
                            "    total2 = precio2 * 1.16",
                            "",
                            "    escribir total1",
                            "    escribir total2"
                        ].join("\n"),
                        "Un cálculo repetido",
                        "El mismo cálculo se realiza con dos precios diferentes."
                    ),

                    clrs(
                        "lesson-037-calculation-after",
                        [
                            "CALCULAR_TOTAL(precio)",
                            "    retornar precio * 1.16",
                            "",
                            "PRINCIPAL()",
                            "    total1 = CALCULAR_TOTAL(100)",
                            "    total2 = CALCULAR_TOTAL(250)",
                            "",
                            "    escribir total1",
                            "    escribir total2"
                        ].join("\n"),
                        "Extraer una responsabilidad de cálculo",
                        "`CALCULAR_TOTAL` representa la operación común. Los argumentos proporcionan los distintos precios y el retorno entrega cada resultado."
                    ),
                ],

                knowledge: [
                    "comprender qué significa refactorizar un programa",
                    "comprender que una refactorización conserva el comportamiento observable",
                    "distinguir un cambio de estructura de un cambio de comportamiento",
                    "reconocer responsabilidades repetidas dentro del código",
                    "comprender la extracción de una función",
                    "utilizar parámetros para representar datos diferentes de una operación común",
                    "utilizar valores de retorno al extraer responsabilidades de cálculo",
                    "sustituir conceptualmente operaciones repetidas por llamadas",
                    "comprender que no toda repetición necesita convertirse en una función",
                    "comprobar que el comportamiento se conserva después de reorganizar el código"
                ],

                notes: [
                    callout(
                        "Refactorización no significa agregar funcionalidad",
                        "Agregar una nueva capacidad, cambiar una regla o producir resultados diferentes modifica el comportamiento del programa y no constituye únicamente una refactorización. La característica esencial de la refactorización es conservar el comportamiento esperado mientras cambia la estructura interna."
                    )
                ],

                recommendedTools: [
                    "code-diagram-navigation"
                ],

                category: "FND-FUNC"
            }),
            lesson({
                order: 38,
                section: 7,
                title: "Qué es un arreglo",

                objective:
                    "Comprender un arreglo como una colección ordenada de elementos relacionados, reconocer que cada elemento ocupa una posición y diferenciar una colección de un valor individual.",

                problemStatement:
                    "Un programa necesita conservar las temperaturas registradas durante varios días. Crear una variable independiente para cada temperatura separa datos que pertenecen al mismo conjunto. ¿Cómo podemos representar varios valores relacionados como una sola colección sin perder la posibilidad de distinguir cada elemento?",

                concepts: [
                    "colección",
                    "arreglo",
                    "elemento",
                    "posición",
                    "valor escalar"
                ],

                explanation: [
                    paragraph(
                        "Hasta ahora hemos trabajado principalmente con variables que conservan valores individuales: una edad, un precio, un nombre o un estado lógico. En este contexto podemos considerar esos valores individuales como escalares."
                    ),

                    callout(
                        "El problema cambia",
                        [
                            "Un solo dato:",
                            "",
                            "temperatura = 24",
                            "",
                            "        →",
                            "",
                            "Pero ahora tenemos:",
                            "",
                            "24",
                            "26",
                            "23",
                            "25",
                            "22",
                            "",
                            "Todos representan",
                            "temperaturas relacionadas.",
                            "",
                            "¿Debemos tratarlos",
                            "como datos independientes?"
                        ].join("\n")
                    ),

                    paragraph(
                        "Cuando varios valores pertenecen conceptualmente a un mismo conjunto, resulta útil representarlos mediante una colección. Una colección permite considerar varios elementos relacionados como parte de una misma estructura."
                    ),

                    paragraph(
                        "Un arreglo es una estructura de colección cuyos elementos se encuentran organizados en un orden. En lugar de utilizar un identificador diferente para cada dato, podemos representar todos los valores como elementos de un mismo arreglo."
                    ),

                    callout(
                        "De valores separados a una colección",
                        [
                            "VALORES SEPARADOS",
                            "",
                            "temperatura1 → 24",
                            "temperatura2 → 26",
                            "temperatura3 → 23",
                            "temperatura4 → 25",
                            "",
                            "        → organizar",
                            "",
                            "ARREGLO",
                            "",
                            "temperaturas",
                            "",
                            "┌────┬────┬────┬────┐",
                            "│ 24 │ 26 │ 23 │ 25 │",
                            "└────┴────┴────┴────┘"
                        ].join("\n")
                    ),

                    paragraph(
                        "Cada valor contenido dentro del arreglo recibe el nombre de elemento. En el ejemplo, `24`, `26`, `23` y `25` son elementos de la colección `temperaturas`."
                    ),

                    callout(
                        "Arreglo y elementos",
                        [
                            "temperaturas",
                            "",
                            "┌────┬────┬────┬────┐",
                            "│ 24 │ 26 │ 23 │ 25 │",
                            "└────┴────┴────┴────┘",
                            "  ↑    ↑    ↑    ↑",
                            "",
                            "cada uno es",
                            "un elemento"
                        ].join("\n")
                    ),

                    paragraph(
                        "Los elementos no forman únicamente un grupo: poseen un orden dentro del arreglo. Cada elemento ocupa una posición que permite distinguirlo de los demás."
                    ),

                    callout(
                        "Los elementos ocupan posiciones",
                        [
                            "temperaturas",
                            "",
                            "posición",
                            "   →    →    →    →",
                            "┌────┬────┬────┬────┐",
                            "│ 24 │ 26 │ 23 │ 25 │",
                            "└────┴────┴────┴────┘",
                            "",
                            "El orden forma parte",
                            "de la estructura."
                        ].join("\n")
                    ),

                    paragraph(
                        "En esta lección todavía no asignaremos números a esas posiciones. Primero nos interesa comprender que existen. En la siguiente aprenderemos cómo CLRS utiliza índices para identificar posiciones concretas."
                    ),

                    paragraph(
                        "Es importante distinguir la posición de un elemento de su valor. La posición responde dónde se encuentra un elemento dentro del arreglo; el valor responde qué información contiene ese elemento."
                    ),

                    callout(
                        "Posición ≠ valor",
                        [
                            "┌────┬────┬────┬────┐",
                            "│ 10 │ 20 │ 10 │ 30 │",
                            "└────┴────┴────┴────┘",
                            "",
                            "El valor 10 aparece",
                            "en dos posiciones diferentes.",
                            "",
                            "Por tanto:",
                            "",
                            "valor",
                            "≠",
                            "posición"
                        ].join("\n")
                    ),

                    paragraph(
                        "Esta diferencia resulta necesaria porque los valores pueden repetirse. Dos elementos pueden contener exactamente el mismo valor y seguir siendo elementos diferentes porque ocupan posiciones distintas dentro de la colección."
                    ),

                    paragraph(
                        "También conviene distinguir un valor escalar de un arreglo. Un valor escalar representa una información individual; un arreglo organiza múltiples elementos dentro de una misma estructura."
                    ),

                    callout(
                        "Escalar y arreglo",
                        [
                            "VALOR ESCALAR",
                            "",
                            "temperatura",
                            "┌────┐",
                            "│ 24 │",
                            "└────┘",
                            "",
                            "una información individual",
                            "",
                            "----------------",
                            "",
                            "ARREGLO",
                            "",
                            "temperaturas",
                            "┌────┬────┬────┬────┐",
                            "│ 24 │ 26 │ 23 │ 25 │",
                            "└────┴────┴────┴────┘",
                            "",
                            "varios elementos relacionados"
                        ].join("\n")
                    ),

                    paragraph(
                        "Representar varios datos mediante un arreglo no significa perder la individualidad de sus elementos. La colección permite tratarlos como un conjunto y, al mismo tiempo, posteriormente podremos acceder a posiciones concretas cuando necesitemos trabajar con un elemento particular."
                    ),

                    paragraph(
                        "Por ahora nuestro objetivo es únicamente reconocer la estructura: un arreglo representa una colección ordenada formada por elementos que ocupan posiciones. En las siguientes lecciones aprenderemos cómo referirnos a esas posiciones y cómo crear y modificar arreglos en CLRS."
                    )
                ],

                examples: [
                    text(
                        "lesson-038-array-model",
                        [
                            "temperaturas",
                            "",
                            "┌────┬────┬────┬────┐",
                            "│ 24 │ 26 │ 23 │ 25 │",
                            "└────┴────┴────┴────┘",
                            "",
                            "una colección",
                            "↓",
                            "cuatro elementos"
                        ].join("\n"),
                        "Varios datos dentro de una misma estructura",
                        "Las temperaturas pertenecen al mismo conjunto y pueden representarse conceptualmente como elementos de un arreglo."
                    ),

                    text(
                        "lesson-038-scalar-vs-array",
                        [
                            "ESCALAR",
                            "",
                            "edad",
                            "┌────┐",
                            "│ 20 │",
                            "└────┘",
                            "",
                            "un valor",
                            "",
                            "────────────────────────",
                            "",
                            "ARREGLO",
                            "",
                            "edades",
                            "┌────┬────┬────┬────┐",
                            "│ 20 │ 25 │ 19 │ 31 │",
                            "└────┴────┴────┴────┘",
                            "",
                            "varios elementos relacionados"
                        ].join("\n"),
                        "Un valor individual frente a una colección",
                        "El arreglo permite representar conjuntamente varios valores que pertenecen conceptualmente al mismo grupo."
                    ),

                    text(
                        "lesson-038-position-value",
                        [
                            "Colección",
                            "",
                            "┌────┬────┬────┬────┐",
                            "│ 10 │ 20 │ 10 │ 30 │",
                            "└────┴────┴────┴────┘",
                            "  ↑         ↑",
                            "",
                            "mismo valor:",
                            "10",
                            "",
                            "pero:",
                            "",
                            "posiciones diferentes"
                        ].join("\n"),
                        "El valor no identifica la posición",
                        "Un mismo valor puede aparecer más de una vez, por lo que debemos mantener separadas las ideas de elemento, valor y posición."
                    ),

                    text(
                        "lesson-038-related-data",
                        [
                            "ANTES",
                            "",
                            "precio1",
                            "precio2",
                            "precio3",
                            "precio4",
                            "",
                            "        ↓",
                            "",
                            "Misma clase de información",
                            "",
                            "        ↓",
                            "",
                            "COLECCIÓN",
                            "",
                            "precios",
                            "",
                            "┌────┬────┬────┬────┐",
                            "│100 │250 │175 │300 │",
                            "└────┴────┴────┴────┘"
                        ].join("\n"),
                        "Reconocer datos relacionados",
                        "El arreglo permite expresar que varios valores forman parte de una misma colección en lugar de tratarlos conceptualmente como datos aislados."
                    )
                ],

                knowledge: [
                    "comprender qué es una colección",
                    "comprender qué es un arreglo",
                    "comprender que un arreglo organiza elementos relacionados",
                    "comprender qué es un elemento de un arreglo",
                    "comprender que los elementos ocupan posiciones",
                    "comprender que el orden forma parte de la estructura de un arreglo",
                    "distinguir una posición del valor almacenado en ella",
                    "comprender que valores iguales pueden aparecer en posiciones diferentes",
                    "diferenciar un valor escalar de una colección",
                    "comprender que un arreglo permite tratar conjuntamente varios datos sin perder la posibilidad de trabajar con elementos individuales"
                ],

                notes: [
                    callout(
                        "Representación conceptual",
                        "Los diagramas de esta lección representan arreglos como casillas consecutivas únicamente para visualizar elementos, orden y posiciones. No deben interpretarse como una afirmación sobre la organización física de la memoria utilizada por CLRS."
                    ),

                    callout(
                        "Las colecciones pueden adoptar distintas formas",
                        "Los lenguajes ofrecen diferentes estructuras para organizar conjuntos de datos. El conocimiento transferible de esta lección es reconocer la necesidad de agrupar elementos relacionados y distinguir la colección, sus elementos y sus posiciones."
                    )
                ],

                category: "FND-COLLECTION"
            }),
            lesson({
                order: 39,
                section: 7,
                title: "Índices",

                objective:
                    "Comprender cómo CLRS utiliza índices basados en cero para identificar posiciones concretas de un arreglo, interpretar accesos mediante corchetes y distinguir posición, índice y valor.",

                problemStatement:
                    "Tenemos una colección ordenada de temperaturas y necesitamos trabajar específicamente con una de ellas. Sabemos que cada elemento ocupa una posición, pero ¿cómo podemos indicar al programa cuál de esas posiciones queremos consultar?",

                concepts: [
                    "índice",
                    "indexación",
                    "acceso a elemento",
                    "índice basado en cero"
                ],

                explanation: [
                    paragraph(
                        "En la lección anterior aprendimos que los elementos de un arreglo ocupan posiciones dentro de una colección ordenada. Ahora necesitamos una forma concreta de identificar una de esas posiciones cuando queremos trabajar con un elemento determinado."
                    ),

                    callout(
                        "Problema de esta lección",
                        [
                            "temperaturas",
                            "",
                            "┌────┬────┬────┬────┐",
                            "│ 24 │ 26 │ 23 │ 25 │",
                            "└────┴────┴────┴────┘",
                            "",
                            "Queremos consultar",
                            "una temperatura específica.",
                            "",
                            "¿Cómo indicamos",
                            "qué posición queremos?"
                        ].join("\n")
                    ),

                    paragraph(
                        "CLRS utiliza un índice para identificar una posición concreta dentro de un arreglo. El índice es el número que utilizamos al referirnos a uno de sus elementos."
                    ),

                    paragraph(
                        "Los índices de los arreglos de CLRS comienzan en `0`. Por ello, el primer elemento tiene índice `0`, el segundo tiene índice `1`, el tercero tiene índice `2` y así sucesivamente."
                    ),

                    callout(
                        "Índices basados en cero",
                        [
                            "Arreglo A",
                            "",
                            "orden       1.º   2.º   3.º   4.º",
                            "",
                            "          ┌────┬────┬────┬────┐",
                            "elemento  │ 12 │ 7  │ 20 │ 5  │",
                            "          └────┴────┴────┴────┘",
                            "",
                            "índice      0    1    2    3"
                        ].join("\n")
                    ),

                    paragraph(
                        "Esto significa que debemos distinguir el orden cotidiano de una posición de su índice. Podemos hablar del «primer elemento» de una colección, pero en CLRS ese elemento se identifica mediante el índice `0`."
                    ),

                    callout(
                        "Orden e índice",
                        [
                            "primer elemento",
                            "→ índice 0",
                            "",
                            "segundo elemento",
                            "→ índice 1",
                            "",
                            "tercer elemento",
                            "→ índice 2",
                            "",
                            "cuarto elemento",
                            "→ índice 3"
                        ].join("\n")
                    ),

                    paragraph(
                        "Para representar el acceso a un elemento, CLRS escribe el identificador del arreglo seguido del índice entre corchetes."
                    ),

                    callout(
                        "Representar un acceso",
                        [
                            "A[2]",
                            "",
                            "A",
                            "→ arreglo",
                            "",
                            "[2]",
                            "→ índice de la posición",
                            "  que queremos consultar"
                        ].join("\n")
                    ),

                    paragraph(
                        "Si conceptualmente tenemos el arreglo `A` formado por los valores `12`, `7`, `20` y `5`, entonces `A[0]` representa su primer elemento, `A[1]` el segundo y `A[2]` el tercero."
                    ),

                    callout(
                        "Interpretar accesos",
                        [
                            "A",
                            "",
                            "          ┌────┬────┬────┬────┐",
                            "elemento  │ 12 │ 7  │ 20 │ 5  │",
                            "          └────┴────┴────┴────┘",
                            "índice      0    1    2    3",
                            "",
                            "A[0] → 12",
                            "A[1] → 7",
                            "A[2] → 20",
                            "A[3] → 5"
                        ].join("\n")
                    ),

                    paragraph(
                        "Es especialmente importante no confundir el índice con el valor encontrado. En `A[2]`, el número `2` identifica la posición; si esa posición contiene `20`, entonces `20` es el valor del elemento."
                    ),

                    callout(
                        "Índice ≠ valor",
                        [
                            "A[2] → 20",
                            "",
                            "2",
                            "→ índice",
                            "→ identifica una posición",
                            "",
                            "20",
                            "→ valor",
                            "→ información contenida allí"
                        ].join("\n")
                    ),

                    paragraph(
                        "La diferencia continúa siendo importante cuando los valores se repiten. Dos elementos pueden contener el mismo valor y seguir siendo distinguibles mediante índices diferentes."
                    ),

                    callout(
                        "Un valor puede aparecer varias veces",
                        [
                            "A",
                            "",
                            "          ┌────┬────┬────┬────┐",
                            "elemento  │ 10 │ 20 │ 10 │ 30 │",
                            "          └────┴────┴────┴────┘",
                            "índice      0    1    2    3",
                            "",
                            "A[0] → 10",
                            "A[2] → 10",
                            "",
                            "mismo valor",
                            "pero índices diferentes"
                        ].join("\n")
                    ),

                    paragraph(
                        "La indexación basada en cero no es completamente nueva en esta ruta. Cuando examinamos cadenas aprendimos que sus caracteres también podían identificarse mediante posiciones que comenzaban en `0`. Ahora aplicamos el mismo modelo a los elementos de un arreglo."
                    ),

                    callout(
                        "Un modelo que ya conocemos",
                        [
                            "CADENA",
                            "",
                            "CAR_EN(texto, 0)",
                            "→ primer carácter",
                            "",
                            "ARREGLO",
                            "",
                            "A[0]",
                            "→ primer elemento",
                            "",
                            "En ambos casos:",
                            "",
                            "la primera posición",
                            "se identifica con 0."
                        ].join("\n")
                    ),

                    paragraph(
                        "Por ahora estamos aprendiendo a interpretar cómo se identifica y consulta conceptualmente una posición. En la siguiente lección aprenderemos cómo crear un arreglo en CLRS y cómo colocar o modificar valores mediante esta misma notación de índices."
                    )
                ],

                examples: [
                    text(
                        "lesson-039-index-model",
                        [
                            "A",
                            "",
                            "          ┌────┬────┬────┬────┐",
                            "elemento  │ 12 │ 7  │ 20 │ 5  │",
                            "          └────┴────┴────┴────┘",
                            "índice      0    1    2    3"
                        ].join("\n"),
                        "Elementos e índices",
                        "Cada índice identifica una posición concreta dentro del arreglo."
                    ),

                    text(
                        "lesson-039-access-model",
                        [
                            "Suponiendo:",
                            "",
                            "A",
                            "┌────┬────┬────┬────┐",
                            "│ 12 │ 7  │ 20 │ 5  │",
                            "└────┴────┴────┴────┘",
                            "",
                            "podemos interpretar:",
                            "",
                            "A[0] → 12",
                            "A[1] → 7",
                            "A[2] → 20",
                            "A[3] → 5"
                        ].join("\n"),
                        "Interpretar un acceso",
                        "La expresión entre corchetes identifica qué posición del arreglo se desea consultar."
                    ),

                    text(
                        "lesson-039-index-value",
                        [
                            "A[2] → 20",
                            "",
                            "A",
                            "→ arreglo",
                            "",
                            "2",
                            "→ índice",
                            "",
                            "20",
                            "→ valor"
                        ].join("\n"),
                        "Tres ideas diferentes",
                        "El arreglo identifica la colección, el índice selecciona una posición y el valor es la información encontrada."
                    ),

                    text(
                        "lesson-039-first-element",
                        [
                            "Orden cotidiano:",
                            "",
                            "1.º   2.º   3.º   4.º",
                            "",
                            "Índices de CLRS:",
                            "",
                            " 0     1     2     3"
                        ].join("\n"),
                        "El primer elemento tiene índice cero",
                        "La posición que llamamos primera corresponde al índice `0` en la indexación utilizada por CLRS."
                    )
                ],

                knowledge: [
                    "comprender qué es un índice",
                    "comprender que un índice identifica una posición concreta dentro de un arreglo",
                    "comprender la indexación basada en cero utilizada por CLRS",
                    "reconocer que el primer elemento tiene índice cero",
                    "interpretar la notación arreglo[indice]",
                    "relacionar un índice con el elemento correspondiente",
                    "distinguir posición, índice y valor",
                    "comprender que valores iguales pueden encontrarse en índices diferentes",
                    "relacionar la indexación de arreglos con el modelo previamente utilizado en cadenas"
                ],

                notes: [
                    callout(
                        "La base de indexación depende del lenguaje",
                        "La idea general de utilizar una referencia para identificar posiciones es transferible, pero no todos los lenguajes o estructuras utilizan necesariamente la misma convención. En los arreglos de CLRS, la indexación comienza en `0`."
                    )
                ],

                category: "FND-COLLECTION"
            }),
            lesson({
                order: 40,
                section: 7,
                title: "Crear y actualizar arreglos",

                objective:
                    "Comprender cómo inicializar un arreglo en CLRS mediante un literal entre corchetes, cómo construirlo incrementalmente y cómo actualizar posteriormente el valor de elementos existentes.",

                problemStatement:
                    "Un programa necesita conservar tres temperaturas relacionadas. Después de registrarlas descubrimos que la segunda era incorrecta y debe cambiarse sin modificar las demás. ¿Cómo podemos construir la colección y actualizar únicamente el elemento correspondiente?",

                concepts: [
                    "literal de arreglo",
                    "inicialización de arreglo",
                    "asignación de elemento",
                    "construcción incremental",
                    "actualización de elemento",
                    "estado de un arreglo",
                    "arreglo dinámico"
                ],

                explanation: [
                    paragraph(
                        "En las lecciones anteriores aprendimos qué es un arreglo y cómo un índice identifica una posición concreta. Ahora utilizaremos esa referencia como destino de una asignación para construir y modificar realmente una colección en CLRS."
                    ),

                    paragraph(
                        "Cuando conocemos los valores iniciales, podemos crear toda la colección con un literal de arreglo. Los elementos se escriben entre corchetes, separados por comas y en el orden que ocuparán: `temperaturas = [24, 26, 23]`. El literal vacío `[]` crea una colección sin elementos que podrá ampliarse después."
                    ),

                    callout(
                        "Inicialización directa",
                        [
                            "temperaturas = [24, 26, 23]",
                            "",
                            "              ↓",
                            "",
                            "índice          0    1    2",
                            "              ┌────┬────┬────┐",
                            "elemento       │ 24 │ 26 │ 23 │",
                            "              └────┴────┴────┘"
                        ].join("\n")
                    ),

                    callout(
                        "Problema de esta lección",
                        [
                            "Necesitamos conservar:",
                            "",
                            "24",
                            "26",
                            "23",
                            "",
                            "como una sola colección.",
                            "",
                            "Después descubrimos:",
                            "",
                            "26 debe cambiar a 25.",
                            "",
                            "Queremos modificar",
                            "únicamente esa posición."
                        ].join("\n")
                    ),

                    paragraph(
                        "En CLRS podemos asignar un valor a una posición indexada escribiendo el identificador del arreglo, el índice entre corchetes y una asignación."
                    ),

                    callout(
                        "Asignar un elemento",
                        [
                            "A[0] = 10",
                            "",
                            "A",
                            "→ arreglo",
                            "",
                            "0",
                            "→ índice",
                            "",
                            "10",
                            "→ valor asignado"
                        ].join("\n")
                    ),

                    paragraph(
                        "Los arreglos de CLRS son dinámicos. Además de la inicialización directa, pueden construirse incrementalmente mediante posiciones consecutivas comenzando desde el índice `0`."
                    ),


                    callout(
                        "Construcción incremental",
                        [
                            "A[0] = 10",
                            "",
                            "┌────┐",
                            "│ 10 │",
                            "└────┘",
                            "  0",
                            "",
                            "        →",
                            "",
                            "A[1] = 20",
                            "",
                            "┌────┬────┐",
                            "│ 10 │ 20 │",
                            "└────┴────┘",
                            "  0    1",
                            "",
                            "        →",
                            "",
                            "A[2] = 30",
                            "",
                            "┌────┬────┬────┐",
                            "│ 10 │ 20 │ 30 │",
                            "└────┴────┴────┘",
                            "  0    1    2"
                        ].join("\n")
                    ),

                    paragraph(
                        "Una vez que una posición contiene un valor, podemos utilizar una nueva asignación sobre ese mismo índice para actualizar el elemento."
                    ),


                    callout(
                        "Actualizar una posición",
                        [
                            "ANTES",
                            "",
                            "          0    1    2",
                            "        ┌────┬────┬────┐",
                            "        │ 24 │ 26 │ 23 │",
                            "        └────┴────┴────┘",
                            "",
                            "temperaturas[1] = 25",
                            "",
                            "        →",
                            "",
                            "DESPUÉS",
                            "",
                            "          0    1    2",
                            "        ┌────┬────┬────┐",
                            "        │ 24 │ 25 │ 23 │",
                            "        └────┴────┴────┘"
                        ].join("\n")
                    ),

                    paragraph(
                        "Actualizar un elemento conserva su índice. En `temperaturas[1] = 25`, la posición identificada por `1` sigue siendo la misma; únicamente cambia el valor almacenado allí."
                    ),

                    callout(
                        "El índice permanece, el valor cambia",
                        [
                            "temperaturas[1]",
                            "",
                            "ANTES",
                            "→ 26",
                            "",
                            "asignar 25",
                            "",
                            "DESPUÉS",
                            "→ 25",
                            "",
                            "índice",
                            "→ continúa siendo 1"
                        ].join("\n")
                    ),

                    paragraph(
                        "Este comportamiento recupera una idea que ya conocemos de las variables. Una asignación puede establecer un estado y otra asignación posterior puede modificarlo. La diferencia es que ahora utilizamos un índice para indicar qué parte de la colección queremos actualizar."
                    ),

                    callout(
                        "Variable y elemento de arreglo",
                        [
                            "VARIABLE",
                            "",
                            "edad = 20",
                            "edad = 21",
                            "",
                            "→ cambia el valor",
                            "  asociado a edad",
                            "",
                            "----------------",
                            "",
                            "ELEMENTO",
                            "",
                            "A[1] = 20",
                            "A[1] = 25",
                            "",
                            "→ cambia el valor",
                            "  almacenado en",
                            "  el índice 1"
                        ].join("\n")
                    ),

                    paragraph(
                        "La asignación a una posición existente reemplaza su valor. No crea una posición adicional ni desplaza los demás elementos."
                    ),

                    callout(
                        "Actualizar no significa agregar",
                        [
                            "ANTES",
                            "",
                            "[10] [20] [30]",
                            "",
                            "A[1] = 25",
                            "",
                            "DESPUÉS",
                            "",
                            "[10] [25] [30]",
                            "",
                            "Siguen existiendo",
                            "las mismas tres posiciones."
                        ].join("\n")
                    ),

                    paragraph(
                        "De esta forma podemos modificar una parte concreta del estado de una colección sin tener que reconstruir conceptualmente todos sus elementos."
                    ),

                    paragraph(
                        "En esta lección creamos arreglos de forma directa con un literal y también de manera incremental mediante posiciones. En la siguiente aprenderemos a conocer cuántos elementos contiene un arreglo y a utilizar ciclos para recorrer automáticamente todas sus posiciones."
                    )
                ],

                examples: [
                    clrs(
                        "lesson-040-array-assignment",
                        [
                            "A = [10, 20, 30]",
                            "",
                            "escribir A[0]",
                            "escribir A[1]",
                            "escribir A[2]"
                        ].join("\n"),
                        "Inicializar una colección",
                        "El literal crea los tres elementos en el orden escrito. La salida permite comprobar posteriormente los valores almacenados."
                    ),

                    clrs(
                        "lesson-040-array-update",
                        [
                            "A = [10, 20, 30]",
                            "",
                            "A[1] = 25",
                            "",
                            "escribir A[0]",
                            "escribir A[1]",
                            "escribir A[2]"
                        ].join("\n"),
                        "Actualizar una posición",
                        "La nueva asignación a `A[1]` reemplaza 20 por 25. Los valores correspondientes a `A[0]` y `A[2]` permanecen sin cambios."
                    ),

                    text(
                        "lesson-040-array-state",
                        [
                            "Estado inicial",
                            "",
                            "          0    1    2",
                            "        ┌────┬────┬────┐",
                            "        │ 10 │ 20 │ 30 │",
                            "        └────┴────┴────┘",
                            "",
                            "A[1] = 25",
                            "",
                            "        ↓",
                            "",
                            "Nuevo estado",
                            "",
                            "          0    1    2",
                            "        ┌────┬────┬────┐",
                            "        │ 10 │ 25 │ 30 │",
                            "        └────┴────┴────┘"
                        ].join("\n"),
                        "El estado del arreglo cambia",
                        "La actualización afecta al valor seleccionado mediante el índice y conserva las demás posiciones."
                    ),

                    clrs(
                        "lesson-040-several-updates",
                        [
                            "datos[0] = 5",
                            "datos[1] = 10",
                            "datos[2] = 15",
                            "",
                            "datos[0] = 6",
                            "datos[2] = 18",
                            "",
                            "escribir datos[0]",
                            "escribir datos[1]",
                            "escribir datos[2]"
                        ].join("\n"),
                        "Modificar elementos independientes",
                        "Cada asignación selecciona mediante su índice exactamente qué elemento debe cambiar. La salida final es 6, 10 y 18."
                    ),

                    clrs(
                        "lesson-040-build-array",
                        [
                            "A[0] = 10",
                            "A[1] = 20",
                            "A[2] = 30",
                            "",
                            "escribir A[0]",
                            "escribir A[1]",
                            "escribir A[2]"
                        ].join("\n"),
                        "Construir un arreglo incrementalmente",
                        "Las asignaciones establecen los valores de las posiciones con índices 0, 1 y 2. Después podemos consultar individualmente esos elementos."
                    ),

                    clrs(
                        "lesson-040-update-element",
                        [
                            "temperaturas[0] = 24",
                            "temperaturas[1] = 26",
                            "temperaturas[2] = 23",
                            "",
                            "temperaturas[1] = 25",
                            "",
                            "escribir temperaturas[0]",
                            "escribir temperaturas[1]",
                            "escribir temperaturas[2]"
                        ].join("\n"),
                        "Corregir un elemento",
                        "La segunda asignación a `temperaturas[1]` cambia su valor de 26 a 25 sin modificar los elementos situados en los índices 0 y 2."
                    ),
                ],

                knowledge: [
                    "crear un arreglo mediante un literal entre corchetes",
                    "inicializar un arreglo con elementos separados por comas",
                    "crear un arreglo vacío mediante []",
                    "comprender cómo una posición indexada puede utilizarse como destino de una asignación",
                    "asignar valores a elementos de un arreglo",
                    "construir incrementalmente un arreglo dinámico en CLRS",
                    "utilizar índices consecutivos para establecer varios elementos",
                    "actualizar el valor de un elemento existente",
                    "comprender que actualizar un elemento conserva su índice",
                    "comprender que una actualización reemplaza el valor de la posición seleccionada",
                    "comprender que actualizar un elemento no desplaza los demás elementos",
                    "relacionar la mutabilidad previamente aprendida con el estado de un arreglo"
                ],

                notes: [
                    callout(
                        "Arreglos dinámicos en CLRS",
                        "CLRS permite inicializar arreglos con literales y construirlos incrementalmente mediante posiciones indexadas. En esta etapa utilizaremos índices consecutivos desde `0` para mantener una colección claramente definida; no necesitamos introducir todavía casos con posiciones intermedias sin asignar."
                    ),

                    callout(
                        "Otros lenguajes",
                        "La creación de arreglos varía entre lenguajes. Algunos requieren declarar previamente un tamaño o utilizar una sintaxis de inicialización específica. Esas reglas no deben trasladarse automáticamente a los arreglos dinámicos de CLRS."
                    )
                ],

                recommendedTools: [
                    "execution-trace",
                    "debugger"
                ],

                category: "FND-COLLECTION"
            }),
            lesson({
                order: 41,
                section: 7,
                title: "Tamaño y recorrido",

                objective:
                    "Comprender cómo obtener la cantidad de elementos de un arreglo mediante LONG y recorrer sistemáticamente todas sus posiciones utilizando índices desde 0 hasta LONG(A) - 1.",

                problemStatement:
                    "Un arreglo contiene varios valores que deben mostrarse uno por uno. Podemos escribir A[0], A[1], A[2] y continuar manualmente, pero esa solución depende de conocer y escribir cada posición. ¿Cómo puede el programa determinar cuántos elementos existen y recorrer automáticamente todas sus posiciones?",

                concepts: [
                    "longitud de un arreglo",
                    "tamaño",
                    "recorrido",
                    "índice válido",
                    "último índice"
                ],

                explanation: [
                    paragraph(
                        "En las lecciones anteriores aprendimos a construir arreglos y a trabajar con elementos específicos mediante índices. Ese conocimiento resulta suficiente cuando queremos consultar una posición concreta, pero se vuelve poco práctico cuando necesitamos procesar todos los elementos de una colección."
                    ),

                    callout(
                        "Problema de esta lección",
                        [
                            "Tenemos:",
                            "",
                            "A[0]",
                            "A[1]",
                            "A[2]",
                            "A[3]",
                            "...",
                            "",
                            "Queremos procesar",
                            "todos los elementos.",
                            "",
                            "Pero no queremos escribir",
                            "manualmente una instrucción",
                            "para cada posición.",
                            "",
                            "Necesitamos saber:",
                            "",
                            "1. cuántos elementos existen",
                            "2. qué índices debemos recorrer"
                        ].join("\n")
                    ),

                    paragraph(
                        "En CLRS, `LONG(A)` produce la cantidad de elementos contenidos en el arreglo `A`. Esta cantidad recibe habitualmente el nombre de longitud o tamaño de la colección."
                    ),


                    callout(
                        "Longitud",
                        [
                            "A",
                            "",
                            "          ┌────┬────┬────┐",
                            "elemento  │ 10 │ 20 │ 30 │",
                            "          └────┴────┴────┘",
                            "",
                            "cantidad de elementos",
                            "",
                            "LONG(A) → 3"
                        ].join("\n")
                    ),

                    paragraph(
                        "La longitud no debe confundirse con un índice. Si un arreglo contiene tres elementos, su longitud es `3`, pero sus elementos se identifican mediante los índices `0`, `1` y `2`."
                    ),

                    callout(
                        "Longitud ≠ último índice",
                        [
                            "LONG(A) = 3",
                            "",
                            "cantidad de elementos:",
                            "3",
                            "",
                            "índices:",
                            "0, 1, 2",
                            "",
                            "último índice:",
                            "2",
                            "",
                            "2 = 3 - 1"
                        ].join("\n")
                    ),

                    paragraph(
                        "Como la indexación de CLRS comienza en cero, un arreglo con `n` elementos utiliza los índices desde `0` hasta `n - 1`. Por ello, cuando la colección contiene elementos, su último índice puede expresarse como `LONG(A) - 1`."
                    ),

                    callout(
                        "Relación fundamental",
                        [
                            "cantidad de elementos",
                            "n",
                            "",
                            "        →",
                            "",
                            "índices",
                            "",
                            "0 ... n - 1",
                            "",
                            "Por tanto:",
                            "",
                            "último índice",
                            "=",
                            "LONG(A) - 1"
                        ].join("\n")
                    ),

                    paragraph(
                        "Esta relación puede combinarse con el ciclo `para` que aprendimos anteriormente. La variable de iteración puede recorrer los índices válidos del arreglo y utilizarse al mismo tiempo para seleccionar el elemento correspondiente."
                    ),


                    callout(
                        "Variable de iteración como índice",
                        [
                            "i = 0",
                            "→",
                            "A[i]",
                            "→",
                            "A[0]",
                            "→",
                            "10",
                            "",
                            "i = 1",
                            "→",
                            "A[i]",
                            "→",
                            "A[1]",
                            "→",
                            "20",
                            "",
                            "i = 2",
                            "→",
                            "A[i]",
                            "→",
                            "A[2]",
                            "→",
                            "30"
                        ].join("\n")
                    ),

                    paragraph(
                        "Aquí `i` conserva su papel de variable de iteración del ciclo `para`, pero su valor también se utiliza como índice actual del arreglo. En cada iteración selecciona una posición diferente."
                    ),

                    paragraph(
                        "A este proceso de visitar sistemáticamente los elementos de una colección lo llamamos recorrido. Un recorrido completo alcanza cada posición que forma parte del arreglo siguiendo el orden establecido."
                    ),

                    callout(
                        "Recorrer una colección",
                        [
                            "inicio",
                            "",
                            "A[0]",
                            " →",
                            "A[1]",
                            " →",
                            "A[2]",
                            " →",
                            "...",
                            " →",
                            "A[LONG(A) - 1]",
                            "",
                            "fin del recorrido"
                        ].join("\n")
                    ),

                    paragraph(
                        "Podríamos escribir directamente un límite numérico cuando conocemos el tamaño exacto del arreglo, pero utilizar `LONG(A)` permite relacionar el recorrido con la colección que realmente estamos procesando."
                    ),

                    callout(
                        "Límite fijo y límite derivado",
                        [
                            "LÍMITE FIJO",
                            "",
                            "para i = 0 hasta 2",
                            "",
                            "depende de saber",
                            "que existen 3 elementos",
                            "",
                            "----------------",
                            "",
                            "LÍMITE DERIVADO",
                            "",
                            "para i = 0 hasta LONG(A) - 1",
                            "",
                            "obtiene el límite",
                            "a partir del arreglo"
                        ].join("\n")
                    ),

                    paragraph(
                        "Si la cantidad de elementos cambia, un recorrido basado en `LONG(A)` puede seguir utilizando la longitud de la colección en lugar de depender de un número escrito manualmente para un caso específico."
                    ),

                    paragraph(
                        "Recorrer un arreglo no determina todavía qué operación debemos realizar con sus elementos. El recorrido solamente establece cómo visitarlos. Dentro del ciclo podemos posteriormente mostrar, contar, acumular, comparar o transformar los valores según lo requiera el problema."
                    ),

                    callout(
                        "Recorrer y procesar son ideas relacionadas",
                        [
                            "RECORRER",
                            "",
                            "visitar cada elemento",
                            "",
                            "        →",
                            "",
                            "PROCESAR",
                            "",
                            "hacer algo con",
                            "el elemento actual",
                            "",
                            "mostrar",
                            "contar",
                            "sumar",
                            "comparar",
                            "modificar"
                        ].join("\n")
                    ),

                    paragraph(
                        "En la siguiente lección ampliaremos las operaciones disponibles sobre arreglos. Además de acceder o actualizar una posición directamente, aprenderemos operaciones para agregar, insertar, eliminar, localizar y consultar elementos."
                    )
                ],

                examples: [
                    clrs(
                        "lesson-041-length-example",
                        [
                            "datos[0] = 8",
                            "datos[1] = 4",
                            "datos[2] = 12",
                            "datos[3] = 6",
                            "",
                            "cantidad = LONG(datos)",
                            "escribir cantidad"
                        ].join("\n"),
                        "Conocer la longitud",
                        "El arreglo contiene cuatro elementos, por lo que `LONG(datos)` produce `4`."
                    ),

                    text(
                        "lesson-041-length-index",
                        [
                            "datos",
                            "",
                            "          ┌────┬────┬────┬────┐",
                            "elemento  │ 8  │ 4  │ 12 │ 6  │",
                            "          └────┴────┴────┴────┘",
                            "índice      0    1    2    3",
                            "",
                            "LONG(datos) = 4",
                            "",
                            "último índice = 3",
                            "",
                            "3 = 4 - 1"
                        ].join("\n"),
                        "Longitud e índice final",
                        "La cantidad de elementos y el último índice difieren en uno debido a la indexación basada en cero."
                    ),

                    clrs(
                        "lesson-041-traversal-example",
                        [
                            "datos[0] = 8",
                            "datos[1] = 4",
                            "datos[2] = 12",
                            "datos[3] = 6",
                            "",
                            "para i = 0 hasta LONG(datos) - 1",
                            "    escribir datos[i]"
                        ].join("\n"),
                        "Recorrido completo",
                        "La variable `i` recorre todos los índices válidos y permite visitar los cuatro elementos en orden."
                    ),

                    text(
                        "lesson-041-traversal-trace",
                        [
                            "LONG(datos) = 4",
                            "",
                            "i = 0 → datos[0] → 8",
                            "i = 1 → datos[1] → 4",
                            "i = 2 → datos[2] → 12",
                            "i = 3 → datos[3] → 6",
                            "",
                            "recorrido terminado"
                        ].join("\n"),
                        "Seguir índice y elemento",
                        "Cada valor de `i` identifica exactamente una posición del arreglo hasta alcanzar el último índice."
                    ),

                    clrs(
                        "lesson-041-traversal-accumulator",
                        [
                            "A[0] = 2",
                            "A[1] = 4",
                            "A[2] = 6",
                            "",
                            "total = 0",
                            "",
                            "para i = 0 hasta LONG(A) - 1",
                            "    total = total + A[i]",
                            "",
                            "escribir total"
                        ].join("\n"),
                        "Procesar durante el recorrido",
                        "El recorrido permite recuperar cada elemento y el acumulador aprendido anteriormente combina sus valores. El resultado final es 12."
                    ),

                    clrs(
                        "lesson-041-length",
                        [
                            "A[0] = 10",
                            "A[1] = 20",
                            "A[2] = 30",
                            "",
                            "n = LONG(A)",
                            "escribir n"
                        ].join("\n"),
                        "Obtener la cantidad de elementos",
                        "`A` contiene tres elementos, por lo que `LONG(A)` produce el valor `3`."
                    ),

                    clrs(
                        "lesson-041-traversal",
                        [
                            "A[0] = 10",
                            "A[1] = 20",
                            "A[2] = 30",
                            "",
                            "n = LONG(A)",
                            "",
                            "para i = 0 hasta n - 1",
                            "    escribir A[i]"
                        ].join("\n"),
                        "Recorrer todos los elementos",
                        "`i` toma sucesivamente los valores 0, 1 y 2. Cada valor se utiliza como índice para acceder al elemento correspondiente."
                    ),
                ],

                knowledge: [
                    "obtener la cantidad de elementos de un arreglo mediante LONG",
                    "comprender que la longitud representa la cantidad de elementos",
                    "distinguir la longitud de un arreglo de su último índice",
                    "comprender que los índices de un arreglo con n elementos van de 0 hasta n - 1",
                    "comprender que el último índice de un arreglo no vacío es LONG(A) - 1",
                    "utilizar una variable de iteración como índice",
                    "recorrer sistemáticamente todos los elementos de un arreglo",
                    "comprender qué significa recorrer una colección",
                    "utilizar LONG para derivar el límite de un recorrido",
                    "combinar un recorrido de arreglo con operaciones previamente aprendidas sobre sus elementos"
                ],

                notes: [
                    callout(
                        "Longitud e índice no son sinónimos",
                        "En una colección indexada desde cero, `LONG(A)` expresa cuántos elementos existen, no el índice del último elemento. Para un arreglo que contiene elementos, el último índice es `LONG(A) - 1`."
                    )
                ],

                recommendedTools: [
                    "execution-trace",
                    "debugger"
                ],

                category: "FND-COLLECTION"
            }),
            lesson({
                order: 42,
                section: 7,
                title: "Operaciones con arreglos",

                objective:
                    "Comprender y utilizar operaciones de biblioteca para modificar la estructura de un arreglo y consultar información sobre sus elementos, distinguiendo estas operaciones de la actualización directa mediante índices.",

                problemStatement:
                    "Un programa mantiene una colección de valores que puede cambiar durante la ejecución. Necesitamos agregar nuevos elementos, insertar uno en una posición concreta, eliminar otro y consultar si determinado valor está presente o dónde aparece. ¿Cómo podemos realizar estas operaciones sin reconstruir manualmente toda la colección?",

                concepts: [
                    "operación de colección",
                    "agregación",
                    "inserción",
                    "eliminación",
                    "consulta",
                    "búsqueda de posición",
                    "existencia"
                ],

                explanation: [
                    paragraph(
                        "Hasta ahora hemos trabajado con arreglos mediante posiciones concretas. Podemos consultar `A[i]`, asignar un nuevo valor a una posición y recorrer todos los elementos. Sin embargo, algunos problemas requieren modificar la propia estructura de la colección o formular preguntas sobre sus elementos."
                    ),

                    callout(
                        "Problema de esta lección",
                        [
                            "Tenemos una colección:",
                            "",
                            "10, 30, 40",
                            "",
                            "y necesitamos:",
                            "",
                            "→ agregar 50 al final",
                            "→ insertar 20 en una posición",
                            "→ eliminar un elemento",
                            "→ localizar un valor",
                            "→ comprobar si otro existe",
                            "",
                            "Son operaciones sobre",
                            "la colección como estructura."
                        ].join("\n")
                    ),

                    paragraph(
                        "CLRS proporciona funciones de biblioteca para representar operaciones comunes sobre arreglos. En lugar de memorizarlas como una lista, podemos organizarlas según la pregunta que resuelven."
                    ),

                    callout(
                        "Dos familias principales",
                        [
                            "MODIFICAR",
                            "",
                            "AGREGA",
                            "INSER",
                            "ELIM",
                            "",
                            "→ cambian la colección",
                            "",
                            "----------------",
                            "",
                            "CONSULTAR",
                            "",
                            "INDICE",
                            "CONT",
                            "",
                            "→ obtienen información",
                            "  sobre la colección"
                        ].join("\n")
                    ),

                    paragraph(
                        "`AGREGA(A, valor)` incorpora un nuevo elemento al final del arreglo. La operación permite ampliar la colección sin tener que calcular y escribir manualmente el siguiente índice."
                    ),


                    callout(
                        "Agregar",
                        [
                            "ANTES",
                            "",
                            "[10] [20]",
                            "",
                            "AGREGA(A, 30)",
                            "",
                            "        →",
                            "",
                            "DESPUÉS",
                            "",
                            "[10] [20] [30]"
                        ].join("\n")
                    ),

                    paragraph(
                        "`INSER(A, indice, valor)` incorpora un nuevo elemento en una posición determinada. Esta operación debe distinguirse cuidadosamente de una asignación directa."
                    ),

                    callout(
                        "Actualizar ≠ insertar",
                        [
                            "ACTUALIZAR",
                            "",
                            "A[1] = 25",
                            "",
                            "[10] [20] [30]",
                            "        →",
                            "[10] [25] [30]",
                            "",
                            "→ reemplaza un valor",
                            "",
                            "----------------",
                            "",
                            "INSERTAR",
                            "",
                            "INSER(A, 1, 25)",
                            "",
                            "→ incorpora un",
                            "  nuevo elemento",
                            "  en la colección"
                        ].join("\n")
                    ),

                    paragraph(
                        "La diferencia es conceptual: una asignación a `A[indice]` modifica el elemento que ya ocupa esa posición, mientras que `INSER` agrega un elemento a la estructura en la posición indicada."
                    ),


                    paragraph(
                        "`ELIM(A, indice)` elimina de la colección el elemento identificado por el índice proporcionado. Como se retira un elemento, la cantidad de elementos del arreglo cambia."
                    ),


                    callout(
                        "Operaciones estructurales",
                        [
                            "AGREGA",
                            "→ incorpora al final",
                            "",
                            "INSER",
                            "→ incorpora en una posición",
                            "",
                            "ELIM",
                            "→ retira un elemento",
                            "",
                            "Estas operaciones pueden",
                            "cambiar LONG(A)."
                        ].join("\n")
                    ),

                    paragraph(
                        "Otras operaciones no modifican la colección para resolver la pregunta planteada, sino que producen información sobre sus elementos."
                    ),

                    paragraph(
                        "`INDICE(A, valor)` permite obtener la posición asociada a un valor dentro del arreglo. Su resultado es un índice que posteriormente puede utilizarse como cualquier otro índice."
                    ),


                    paragraph(
                        "`CONT(A, valor)` responde una pregunta diferente: indica mediante un valor lógico si el elemento está presente en la colección."
                    ),


                    callout(
                        "INDICE y CONT responden preguntas distintas",
                        [
                            "INDICE(A, 20)",
                            "",
                            "→ ¿en qué posición",
                            "  aparece 20?",
                            "",
                            "----------------",
                            "",
                            "CONT(A, 20)",
                            "",
                            "→ ¿está presente",
                            "  20 en A?",
                            "",
                            "→ resultado lógico"
                        ].join("\n")
                    ),

                    paragraph(
                        "Es especialmente importante no interpretar `CONT` como un contador de ocurrencias. Su propósito es comprobar existencia. Si un problema necesita saber cuántas veces se cumple una condición, podemos utilizar el patrón de contador aprendido anteriormente."
                    ),

                    paragraph(
                        "CLRS dispone además de otras operaciones sobre arreglos, entre ellas `COPIA`, `ORDENA` e `INVER`. Estas permiten trabajar con una copia de una colección o modificar la organización de sus elementos."
                    ),

                    callout(
                        "Otras operaciones disponibles",
                        [
                            "COPIA",
                            "→ obtener una copia",
                            "",
                            "ORDENA",
                            "→ ordenar los elementos",
                            "",
                            "INVER",
                            "→ invertir su orden"
                        ].join("\n")
                    ),

                    paragraph(
                        "No es necesario memorizar todas las operaciones como vocabulario aislado. El criterio útil es partir del problema: primero identificar qué cambio o consulta necesitamos realizar y después elegir la operación que representa esa necesidad."
                    ),

                    callout(
                        "Elegir por intención",
                        [
                            "¿Agregar al final?",
                            "→ AGREGA",
                            "",
                            "¿Incorporar en una posición?",
                            "→ INSER",
                            "",
                            "¿Eliminar una posición?",
                            "→ ELIM",
                            "",
                            "¿Saber dónde aparece un valor?",
                            "→ INDICE",
                            "",
                            "¿Saber si existe?",
                            "→ CONT"
                        ].join("\n")
                    ),

                    paragraph(
                        "En la siguiente lección ampliaremos la estructura de los arreglos: hasta ahora cada elemento se identifica mediante un solo índice; veremos cómo organizar información que necesita más de una dimensión."
                    )
                ],

                examples: [
                    clrs(
                        "lesson-042-modify",
                        [
                            "A[0] = 10",
                            "A[1] = 30",
                            "",
                            "AGREGA(A, 40)",
                            "INSER(A, 1, 20)",
                            "",
                            "escribir LONG(A)",
                            "escribir A[0]",
                            "escribir A[1]",
                            "escribir A[2]",
                            "escribir A[3]"
                        ].join("\n"),
                        "Modificar la estructura de una colección",
                        "`AGREGA` e `INSER` incorporan nuevos elementos mediante dos tipos diferentes de operación."
                    ),

                    clrs(
                        "lesson-042-update-vs-insert",
                        [
                            "A[0] = 10",
                            "A[1] = 20",
                            "A[2] = 30",
                            "",
                            "A[1] = 25",
                            "",
                            "escribir LONG(A)",
                            "escribir A[1]"
                        ].join("\n"),
                        "Actualizar sin agregar",
                        "La asignación directa sustituye el valor del índice `1`, pero la longitud continúa siendo 3. Esto contrasta con `INSER`, que incorpora un elemento."
                    ),

                    clrs(
                        "lesson-042-query",
                        [
                            "A[0] = 10",
                            "A[1] = 20",
                            "A[2] = 30",
                            "",
                            "posicion = INDICE(A, 20)",
                            "existe = CONT(A, 30)",
                            "",
                            "escribir posicion",
                            "escribir existe"
                        ].join("\n"),
                        "Consultar la colección",
                        "`INDICE` produce información sobre una posición y `CONT` produce un valor lógico de existencia."
                    ),

                    text(
                        "lesson-042-operation-map",
                        [
                            "CAMBIAR LA COLECCIÓN",
                            "",
                            "AGREGA",
                            "INSER",
                            "ELIM",
                            "",
                            "        ↓",
                            "",
                            "puede cambiar LONG(A)",
                            "",
                            "────────────────────────",
                            "",
                            "CONSULTAR",
                            "",
                            "INDICE",
                            "CONT",
                            "",
                            "        ↓",
                            "",
                            "produce información",
                            "sobre sus elementos"
                        ].join("\n"),
                        "Clasificar las operaciones",
                        "Pensar en modificación y consulta resulta más útil que memorizar funciones como una lista sin relación."
                    ),

                    clrs(
                        "lesson-042-add",
                        [
                            "A[0] = 10",
                            "A[1] = 20",
                            "",
                            "AGREGA(A, 30)",
                            "",
                            "escribir LONG(A)",
                            "escribir A[0]",
                            "escribir A[1]",
                            "escribir A[2]"
                        ].join("\n"),
                        "Agregar al final",
                        "`AGREGA(A, 30)` incorpora un nuevo elemento después de los que ya pertenecían a la colección. La longitud pasa a ser 3."
                    ),

                    clrs(
                        "lesson-042-insert",
                        [
                            "A[0] = 10",
                            "A[1] = 30",
                            "",
                            "INSER(A, 1, 20)",
                            "",
                            "escribir LONG(A)",
                            "escribir A[0]",
                            "escribir A[1]",
                            "escribir A[2]"
                        ].join("\n"),
                        "Insertar un elemento",
                        "`INSER(A, 1, 20)` incorpora el valor `20` en la posición indicada. Después la colección contiene tres elementos."
                    ),

                    clrs(
                        "lesson-042-delete",
                        [
                            "A[0] = 10",
                            "A[1] = 20",
                            "A[2] = 30",
                            "",
                            "ELIM(A, 1)",
                            "",
                            "escribir LONG(A)"
                        ].join("\n"),
                        "Eliminar un elemento",
                        "`ELIM(A, 1)` retira de la colección el elemento identificado por ese índice. La longitud pasa de 3 a 2."
                    ),

                    clrs(
                        "lesson-042-index-query",
                        [
                            "A[0] = 10",
                            "A[1] = 20",
                            "A[2] = 30",
                            "",
                            "posicion = INDICE(A, 20)",
                            "escribir posicion"
                        ].join("\n"),
                        "Localizar un valor",
                        "`INDICE(A, 20)` permite obtener la posición correspondiente al valor buscado. En esta colección, el resultado es `1`."
                    ),

                    clrs(
                        "lesson-042-existence-query",
                        [
                            "A[0] = 10",
                            "A[1] = 20",
                            "A[2] = 30",
                            "",
                            "existe20 = CONT(A, 20)",
                            "existe50 = CONT(A, 50)",
                            "",
                            "escribir existe20",
                            "escribir existe50"
                        ].join("\n"),
                        "Comprobar existencia",
                        "`CONT` no cuenta cuántas veces aparece un valor. Produce una respuesta lógica sobre su presencia en el arreglo."
                    ),
                ],

                knowledge: [
                    "comprender que existen operaciones de biblioteca sobre arreglos",
                    "agregar elementos al final mediante AGREGA",
                    "insertar elementos mediante INSER",
                    "eliminar elementos mediante ELIM",
                    "distinguir actualización directa e inserción",
                    "comprender que agregar, insertar o eliminar puede modificar la longitud de la colección",
                    "buscar una posición mediante INDICE",
                    "comprobar la existencia de un valor mediante CONT",
                    "comprender que CONT produce una respuesta lógica y no cuenta ocurrencias",
                    "distinguir operaciones de modificación y operaciones de consulta",
                    "seleccionar una operación de arreglo según la necesidad del problema",
                    "reconocer COPIA, ORDENA e INVER como operaciones adicionales sobre arreglos"
                ],

                notes: [
                    callout(
                        "Bibliotecas diferentes, mismas necesidades",
                        "Otros lenguajes pueden utilizar nombres, métodos o estructuras diferentes para agregar, insertar, eliminar o consultar elementos. El conocimiento transferible consiste en reconocer la operación que necesita el problema y después aprender cómo la expresa cada lenguaje."
                    )
                ],

                recommendedTools: [
                    "execution-trace",
                    "debugger"
                ],

                category: "FND-COLLECTION"
            }),
            lesson({
                order: 43,
                section: 7,
                title: "Arreglos multidimensionales",

                objective:
                    "Comprender cómo un arreglo de dos dimensiones organiza elementos mediante filas y columnas, y cómo dos índices permiten identificar, establecer y consultar un elemento concreto.",

                problemStatement:
                    "Un programa necesita registrar las calificaciones de varios estudiantes en varios exámenes. Una sola secuencia ya no expresa completamente la organización de los datos: necesitamos distinguir tanto al estudiante como al examen. ¿Cómo podemos representar valores que poseen una posición de fila y otra de columna?",

                concepts: [
                    "dimensión",
                    "arreglo multidimensional",
                    "arreglo bidimensional",
                    "matriz",
                    "fila",
                    "columna",
                    "doble índice"
                ],

                explanation: [
                    paragraph(
                        "Hasta ahora hemos trabajado con arreglos de una dimensión. En ellos, los elementos forman una única secuencia y un solo índice basta para identificar una posición."
                    ),

                    callout(
                        "Una dimensión",
                        [
                            "A",
                            "",
                            "          ┌────┬────┬────┐",
                            "elemento  │ 10 │ 20 │ 30 │",
                            "          └────┴────┴────┘",
                            "índice      0    1    2",
                            "",
                            "A[1] → 20",
                            "",
                            "Una posición",
                            "es suficiente."
                        ].join("\n")
                    ),

                    paragraph(
                        "Sin embargo, algunos datos poseen naturalmente más de un nivel de organización. Por ejemplo, si registramos calificaciones de varios estudiantes en varios exámenes, cada valor pertenece tanto a un estudiante como a un examen."
                    ),

                    callout(
                        "Problema de esta lección",
                        [
                            "Calificaciones",
                            "",
                            "              examen",
                            "              1    2    3",
                            "",
                            "estudiante 1  90   85   95",
                            "estudiante 2  70   80   75",
                            "",
                            "Para localizar un valor",
                            "necesitamos saber:",
                            "",
                            "¿qué estudiante?",
                            "y",
                            "¿qué examen?"
                        ].join("\n")
                    ),

                    paragraph(
                        "Para representar este tipo de información podemos utilizar un arreglo de dos dimensiones. Sus elementos se organizan mediante filas y columnas."
                    ),

                    paragraph(
                        "También podemos inicializar esta estructura directamente con un literal anidado. Cada arreglo interior representa una fila: `M = [[10, 20, 30], [40, 50, 60]]`. Los corchetes pueden anidarse nuevamente cuando un problema necesita más dimensiones."
                    ),

                    callout(
                        "Literal de dos dimensiones",
                        [
                            "M = [",
                            "    [10, 20, 30],",
                            "    [40, 50, 60]",
                            "]",
                            "",
                            "cada arreglo interior",
                            "representa una fila"
                        ].join("\n")
                    ),

                    paragraph(
                        "Un arreglo multidimensional es una colección cuya organización requiere más de una dimensión para localizar sus elementos. En esta lección estudiaremos el caso bidimensional. Cuando esa organización se presenta mediante filas y columnas, utilizaremos el término matriz."
                    ),

                    callout(
                        "Dos dimensiones",
                        [
                            "M",
                            "",
                            "                columnas",
                            "              0     1     2",
                            "           ┌─────┬─────┬─────┐",
                            "fila 0  →  │  90 │  85 │  95 │",
                            "           ├─────┼─────┼─────┤",
                            "fila 1  →  │  70 │  80 │  75 │",
                            "           └─────┴─────┴─────┘"
                        ].join("\n")
                    ),

                    paragraph(
                        "Cada elemento se encuentra en la intersección de una fila y una columna. Por ello necesitamos identificar ambas posiciones para seleccionar un único elemento."
                    ),

                    paragraph(
                        "En CLRS representamos un acceso bidimensional mediante dos índices consecutivos. El primer índice corresponde a la fila y el segundo a la columna."
                    ),

                    callout(
                        "Fila primero, columna después",
                        [
                            "M[fila][columna]",
                            "",
                            "M[1][2]",
                            "  ↑  ↑",
                            "  │  └── índice de columna",
                            "  └───── índice de fila"
                        ].join("\n")
                    ),

                    paragraph(
                        "Al igual que en los arreglos de una dimensión, los índices comienzan en cero. La primera fila tiene índice `0` y la primera columna también tiene índice `0`."
                    ),

                    callout(
                        "Indexación desde cero",
                        [
                            "M",
                            "",
                            "              columna",
                            "              0     1     2",
                            "           ┌─────┬─────┬─────┐",
                            "fila 0  →  │  10 │  20 │  30 │",
                            "           ├─────┼─────┼─────┤",
                            "fila 1  →  │  40 │  50 │  60 │",
                            "           └─────┴─────┴─────┘",
                            "",
                            "M[0][0] → 10",
                            "M[0][1] → 20",
                            "M[1][0] → 40",
                            "M[1][2] → 60"
                        ].join("\n")
                    ),

                    paragraph(
                        "Es importante interpretar ambos índices por separado. En `M[1][2]`, `1` no representa el valor del elemento ni una posición completa por sí sola: identifica la fila. El índice `2` identifica la columna. Juntos seleccionan un único elemento."
                    ),

                    callout(
                        "Dos índices, un elemento",
                        [
                            "M[1][2]",
                            "",
                            "fila = 1",
                            "columna = 2",
                            "",
                            "        →",
                            "",
                            "intersección",
                            "",
                            "        →",
                            "",
                            "valor = 60"
                        ].join("\n")
                    ),

                    paragraph(
                        "La notación bidimensional puede utilizarse como destino de una asignación, igual que aprendimos con los arreglos de una dimensión."
                    ),


                    paragraph(
                        "También podemos consultar un elemento utilizando los mismos dos índices."
                    ),


                    paragraph(
                        "Una posición bidimensional también puede actualizarse mediante una nueva asignación. Al hacerlo, se modifica el valor de esa combinación concreta de fila y columna."
                    ),


                    paragraph(
                        "La idea de dimensión describe cuánta información posicional necesitamos para localizar un elemento. En un arreglo unidimensional utilizamos un índice. En el caso bidimensional estudiado aquí necesitamos dos."
                    ),

                    callout(
                        "Una dimensión frente a dos",
                        [
                            "ARREGLO UNIDIMENSIONAL",
                            "",
                            "A[indice]",
                            "",
                            "→ una posición",
                            "",
                            "----------------",
                            "",
                            "ARREGLO BIDIMENSIONAL",
                            "",
                            "M[fila][columna]",
                            "",
                            "→ dos posiciones",
                            "  relacionadas"
                        ].join("\n")
                    ),

                    paragraph(
                        "No necesitamos pensar en una matriz como un nuevo tipo de valor completamente separado de los arreglos. Podemos conservar la idea fundamental: seguimos trabajando con una colección de elementos, pero su organización requiere ahora dos índices."
                    ),

                    paragraph(
                        "En esta lección nos concentramos en localizar elementos individuales mediante fila y columna. En la siguiente recuperaremos los ciclos anidados para recorrer sistemáticamente todas las posiciones de una matriz."
                    )
                ],

                examples: [
                    text(
                        "lesson-043-matrix-model",
                        [
                            "M",
                            "",
                            "                columna",
                            "              0     1",
                            "           ┌─────┬─────┐",
                            "fila 0  →  │  10 │  20 │",
                            "           ├─────┼─────┤",
                            "fila 1  →  │  30 │  40 │",
                            "           └─────┴─────┘"
                        ].join("\n"),
                        "Filas y columnas",
                        "Cada elemento ocupa una combinación concreta de fila y columna."
                    ),

                    clrs(
                        "lesson-043-matrix",
                        [
                            "M = [[10, 20], [30, 40]]",
                            "",
                            "escribir M[0][0]",
                            "escribir M[1][1]"
                        ].join("\n"),
                        "Inicializar y consultar una matriz",
                        "Los arreglos interiores crean las filas. Cada consulta necesita dos índices y la salida corresponde a los valores 10 y 40."
                    ),

                    text(
                        "lesson-043-double-index",
                        [
                            "M[1][0]",
                            "",
                            "1",
                            "→ índice de fila",
                            "",
                            "0",
                            "→ índice de columna",
                            "",
                            "fila 1 + columna 0",
                            "→ una posición concreta"
                        ].join("\n"),
                        "Interpretar el doble índice",
                        "Los índices cumplen responsabilidades distintas y trabajan juntos para seleccionar un único elemento."
                    ),

                    clrs(
                        "lesson-043-specific-cell",
                        [
                            "calificaciones[0][0] = 90",
                            "calificaciones[0][1] = 85",
                            "calificaciones[1][0] = 70",
                            "calificaciones[1][1] = 80",
                            "",
                            "nota = calificaciones[0][1]",
                            "escribir nota"
                        ].join("\n"),
                        "Representar datos con dos coordenadas",
                        "`calificaciones[0][1]` permite seleccionar un valor mediante la combinación de una fila y una columna."
                    ),

                    clrs(
                        "lesson-043-create-matrix",
                        [
                            "M[0][0] = 10",
                            "M[0][1] = 20",
                            "M[0][2] = 30",
                            "",
                            "M[1][0] = 40",
                            "M[1][1] = 50",
                            "M[1][2] = 60"
                        ].join("\n"),
                        "Construir una estructura bidimensional",
                        "Cada asignación especifica primero la fila y después la columna del elemento cuyo valor se establece."
                    ),

                    clrs(
                        "lesson-043-access-matrix",
                        [
                            "M[0][0] = 10",
                            "M[0][1] = 20",
                            "M[1][0] = 30",
                            "M[1][1] = 40",
                            "",
                            "valor = M[1][0]",
                            "escribir valor"
                        ].join("\n"),
                        "Consultar una posición bidimensional",
                        "`M[1][0]` identifica el elemento situado en la fila de índice 1 y la columna de índice 0. El valor obtenido es 30."
                    ),

                    clrs(
                        "lesson-043-update-matrix",
                        [
                            "M[0][0] = 10",
                            "M[0][1] = 20",
                            "M[1][0] = 30",
                            "M[1][1] = 40",
                            "",
                            "M[1][0] = 35",
                            "",
                            "escribir M[1][0]"
                        ].join("\n"),
                        "Actualizar un elemento",
                        "La posición formada por la fila 1 y la columna 0 continúa siendo la misma; su valor cambia de 30 a 35."
                    ),
                ],

                knowledge: [
                    "inicializar un arreglo multidimensional mediante literales anidados",
                    "comprender qué significa dimensión en una colección indexada",
                    "comprender qué es un arreglo multidimensional",
                    "comprender el caso de un arreglo bidimensional",
                    "comprender una matriz como organización mediante filas y columnas",
                    "identificar filas y columnas",
                    "comprender que un elemento bidimensional necesita dos índices",
                    "interpretar la notación M[fila][columna]",
                    "comprender que el primer índice corresponde a la fila y el segundo a la columna",
                    "comprender que los índices de filas y columnas comienzan en cero",
                    "establecer valores mediante un doble índice",
                    "consultar elementos mediante fila y columna",
                    "actualizar una posición bidimensional",
                    "distinguir un arreglo unidimensional de una organización bidimensional"
                ],

                notes: [
                    callout(
                        "Representación conceptual",
                        "Las cuadrículas utilizadas para explicar filas y columnas son representaciones conceptuales de la organización de los datos. No describen cómo CLRS almacena físicamente esos elementos en memoria."
                    ),

                    callout(
                        "Más dimensiones",
                        "La idea de arreglo multidimensional puede extenderse más allá de dos dimensiones. En esta ruta nos concentraremos en el caso bidimensional porque permite aprender con claridad el modelo de varios índices sin añadir complejidad innecesaria."
                    )
                ],

                category: "FND-COLLECTION"
            }),
            lesson({
                order: 44,
                section: 7,
                title: "Recorrer matrices",

                objective:
                    "Comprender cómo recorrer sistemáticamente todos los elementos de una matriz combinando ciclos anidados con índices de fila y columna.",

                problemStatement:
                    "Una matriz contiene varias filas y columnas y necesitamos mostrar todos sus elementos. Ya sabemos acceder a una posición concreta mediante M[fila][columna], pero escribir manualmente cada combinación de índices no resulta práctico. ¿Cómo podemos visitar sistemáticamente todas las posiciones?",

                concepts: [
                    "recorrido de matriz",
                    "recorrido por filas",
                    "índice de fila",
                    "índice de columna",
                    "ciclo exterior",
                    "ciclo interior"
                ],

                explanation: [
                    paragraph(
                        "En la lección anterior aprendimos a identificar un elemento de una matriz mediante dos índices: uno para la fila y otro para la columna. Esto permite trabajar con posiciones concretas, pero todavía necesitamos una forma de procesar toda la estructura."
                    ),

                    callout(
                        "Problema de esta lección",
                        [
                            "M",
                            "",
                            "              columna",
                            "              0     1     2",
                            "           ┌─────┬─────┬─────┐",
                            "fila 0  →  │  10 │  20 │  30 │",
                            "           ├─────┼─────┼─────┤",
                            "fila 1  →  │  40 │  50 │  60 │",
                            "           └─────┴─────┴─────┘",
                            "",
                            "Podríamos escribir:",
                            "",
                            "M[0][0]",
                            "M[0][1]",
                            "M[0][2]",
                            "M[1][0]",
                            "M[1][1]",
                            "M[1][2]",
                            "",
                            "Pero queremos producir",
                            "esas posiciones mediante",
                            "un recorrido."
                        ].join("\n")
                    ),

                    paragraph(
                        "Este problema contiene dos niveles de repetición. Por cada fila necesitamos recorrer todas las columnas. Por ello podemos recuperar los ciclos anidados aprendidos anteriormente."
                    ),

                    callout(
                        "Dos niveles del problema",
                        [
                            "por cada FILA",
                            "",
                            "        →",
                            "",
                            "recorrer todas",
                            "las COLUMNAS",
                            "",
                            "        →",
                            "",
                            "procesar",
                            "M[fila][columna]"
                        ].join("\n")
                    ),

                    paragraph(
                        "En un recorrido por filas utilizamos el ciclo exterior para avanzar por las filas. Dentro de cada iteración exterior, el ciclo interior recorre todas las columnas de la fila actual."
                    ),


                    paragraph(
                        "Esta estructura aplica exactamente el modelo de los ciclos anidados: el ciclo exterior no avanza hasta que el recorrido interior se completa."
                    ),

                    callout(
                        "Recuperar ciclos anidados",
                        [
                            "fila = 0",
                            "",
                            "    columna = 0",
                            "    columna = 1",
                            "    columna = 2",
                            "",
                            "termina recorrido interior",
                            "",
                            "        →",
                            "",
                            "fila = 1",
                            "",
                            "    columna = 0",
                            "    columna = 1",
                            "    columna = 2"
                        ].join("\n")
                    ),

                    paragraph(
                        "En cada momento, los valores de `fila` y `columna` trabajan juntos para identificar la posición actual. Ninguno de los dos índices por separado identifica completamente la celda."
                    ),

                    callout(
                        "Dos índices forman la posición actual",
                        [
                            "fila = 1",
                            "columna = 2",
                            "",
                            "        →",
                            "",
                            "M[fila][columna]",
                            "",
                            "        →",
                            "",
                            "M[1][2]",
                            "",
                            "        →",
                            "",
                            "60"
                        ].join("\n")
                    ),

                    paragraph(
                        "Como los índices comienzan en cero y los límites del ciclo `para` de CLRS son inclusivos, una matriz con `filas` filas debe recorrer índices desde `0` hasta `filas - 1`. De forma análoga, las columnas se recorren desde `0` hasta `columnas - 1`."
                    ),

                    callout(
                        "Límites de cada dimensión",
                        [
                            "filas = 2",
                            "",
                            "índices de fila:",
                            "0, 1",
                            "",
                            "último índice:",
                            "filas - 1",
                            "",
                            "----------------",
                            "",
                            "columnas = 3",
                            "",
                            "índices de columna:",
                            "0, 1, 2",
                            "",
                            "último índice:",
                            "columnas - 1"
                        ].join("\n")
                    ),

                    paragraph(
                        "En los ejemplos de esta lección conocemos las cantidades de filas y columnas porque forman parte de la estructura del problema. No necesitamos asumir funciones adicionales de CLRS para obtener automáticamente las dimensiones de una matriz."
                    ),

                    paragraph(
                        "El orden de los ciclos determina el orden de visita. Si el ciclo exterior recorre filas y el interior columnas, se completan todas las columnas de una fila antes de comenzar la siguiente."
                    ),


                    paragraph(
                        "Recorrer una matriz tampoco determina qué debemos hacer con cada elemento. El doble recorrido se encarga de visitar las posiciones; dentro del ciclo interior realizamos el procesamiento que requiera el problema."
                    ),


                    callout(
                        "Recorrido y procesamiento",
                        [
                            "RECORRIDO",
                            "",
                            "fila + columna",
                            "→",
                            "seleccionar cada posición",
                            "",
                            "        +",
                            "",
                            "PROCESAMIENTO",
                            "",
                            "mostrar",
                            "sumar",
                            "contar",
                            "comparar",
                            "actualizar",
                            "",
                            "según el problema"
                        ].join("\n")
                    ),

                    paragraph(
                        "Esta lección no introduce una nueva estructura de control. Integra conocimientos ya adquiridos: ciclos anidados para producir combinaciones de índices y matrices para interpretar cada combinación como una posición bidimensional."
                    ),

                    paragraph(
                        "En la siguiente lección volveremos a conectar colecciones y programación procedimental: aprenderemos cómo una función puede recibir un arreglo para trabajar con sus elementos."
                    )
                ],

                examples: [
                    clrs(
                        "lesson-044-complete-example",
                        [
                            "M[0][0] = 10",
                            "M[0][1] = 20",
                            "M[0][2] = 30",
                            "M[1][0] = 40",
                            "M[1][1] = 50",
                            "M[1][2] = 60",
                            "",
                            "filas = 2",
                            "columnas = 3",
                            "",
                            "para fila = 0 hasta filas - 1",
                            "    para columna = 0 hasta columnas - 1",
                            "        escribir M[fila][columna]"
                        ].join("\n"),
                        "Recorrer una matriz completa",
                        "El ciclo exterior recorre dos filas y, dentro de cada una, el ciclo interior recorre sus tres columnas."
                    ),

                    text(
                        "lesson-044-traversal-trace",
                        [
                            "fila = 0",
                            "    columna = 0 → M[0][0] → 10",
                            "    columna = 1 → M[0][1] → 20",
                            "    columna = 2 → M[0][2] → 30",
                            "",
                            "fila = 1",
                            "    columna = 0 → M[1][0] → 40",
                            "    columna = 1 → M[1][1] → 50",
                            "    columna = 2 → M[1][2] → 60"
                        ].join("\n"),
                        "Seguir ambos índices",
                        "El índice de fila permanece fijo mientras el índice de columna completa su recorrido."
                    ),

                    clrs(
                        "lesson-044-process-elements",
                        [
                            "M[0][0] = 2",
                            "M[0][1] = 4",
                            "M[1][0] = 6",
                            "M[1][1] = 8",
                            "",
                            "filas = 2",
                            "columnas = 2",
                            "",
                            "para fila = 0 hasta filas - 1",
                            "    para columna = 0 hasta columnas - 1",
                            "        doble = M[fila][columna] * 2",
                            "        escribir doble"
                        ].join("\n"),
                        "Procesar cada celda",
                        "El recorrido selecciona sucesivamente cada posición y permite utilizar su valor en una operación."
                    ),

                    text(
                        "lesson-044-connection-nested-loops",
                        [
                            "LECCIÓN 30",
                            "",
                            "por cada grupo",
                            "    recorrer cada elemento",
                            "",
                            "        ↓ mismo patrón",
                            "",
                            "LECCIÓN 44",
                            "",
                            "por cada fila",
                            "    recorrer cada columna",
                            "",
                            "        ↓",
                            "",
                            "M[fila][columna]"
                        ].join("\n"),
                        "Una aplicación de los ciclos anidados",
                        "La estructura de repetición ya era conocida; ahora cada combinación de iteraciones posee un significado concreto dentro de una matriz."
                    ),

                    clrs(
                        "lesson-044-basic-traversal",
                        [
                            "filas = 2",
                            "columnas = 3",
                            "",
                            "para fila = 0 hasta filas - 1",
                            "    para columna = 0 hasta columnas - 1",
                            "        escribir M[fila][columna]"
                        ].join("\n"),
                        "Estructura de un recorrido por filas",
                        "El ciclo exterior selecciona una fila. Antes de avanzar a la siguiente, el ciclo interior visita todas las columnas correspondientes a la fila actual."
                    ),

                    text(
                        "lesson-044-row-order",
                        [
                            "M",
                            "",
                            "              0     1     2",
                            "           ┌─────┬─────┬─────┐",
                            "fila 0  →  │  10 │  20 │  30 │",
                            "           ├─────┼─────┼─────┤",
                            "fila 1  →  │  40 │  50 │  60 │",
                            "           └─────┴─────┴─────┘",
                            "",
                            "Orden de visita:",
                            "",
                            "M[0][0] → 10",
                            "M[0][1] → 20",
                            "M[0][2] → 30",
                            "M[1][0] → 40",
                            "M[1][1] → 50",
                            "M[1][2] → 60"
                        ].join("\n"),
                        "Recorrido por filas",
                        "Se completa una fila antes de comenzar la siguiente. Esto describe el orden de visita del programa, no una afirmación sobre cómo se almacena físicamente la matriz."
                    ),

                    clrs(
                        "lesson-044-sum-matrix",
                        [
                            "M[0][0] = 10",
                            "M[0][1] = 20",
                            "M[0][2] = 30",
                            "M[1][0] = 40",
                            "M[1][1] = 50",
                            "M[1][2] = 60",
                            "",
                            "filas = 2",
                            "columnas = 3",
                            "total = 0",
                            "",
                            "para fila = 0 hasta filas - 1",
                            "    para columna = 0 hasta columnas - 1",
                            "        total = total + M[fila][columna]",
                            "",
                            "escribir total"
                        ].join("\n"),
                        "Procesar todos los elementos",
                        "Los ciclos anidados visitan las seis posiciones y el acumulador combina sus valores. El resultado final es 210."
                    ),
                ],

                knowledge: [
                    "comprender qué significa recorrer una matriz",
                    "combinar ciclos anidados con una estructura bidimensional",
                    "utilizar una variable de iteración como índice de fila",
                    "utilizar una variable de iteración como índice de columna",
                    "comprender que el ciclo interior recorre todas las columnas de cada fila",
                    "comprender que el índice de fila permanece fijo mientras se completa el recorrido interior",
                    "relacionar conjuntamente fila y columna con el elemento actual",
                    "recorrer una matriz en orden por filas",
                    "utilizar límites desde 0 hasta filas - 1 y columnas - 1",
                    "procesar elementos durante un recorrido bidimensional",
                    "reconocer el recorrido de matrices como una aplicación de los ciclos anidados previamente aprendidos"
                ],

                notes: [
                    callout(
                        "Dimensiones conocidas",
                        "En los ejemplos de esta lección, `filas` y `columnas` son valores conocidos por la especificación de la matriz. No se utiliza ni se presupone una operación adicional de CLRS para obtener automáticamente ambas dimensiones."
                    ),

                    callout(
                        "Orden de visita, no almacenamiento",
                        "Decir que realizamos un recorrido por filas describe el orden en que el programa visita los elementos. No implica ninguna afirmación sobre la representación física o el orden de almacenamiento de la matriz en memoria."
                    )
                ],

                recommendedTools: [
                    "execution-trace",
                    "debugger"
                ],

                category: "FND-COLLECTION"
            }),
            lesson({
                order: 45,
                section: 7,
                title: "Arreglos y funciones",

                objective:
                    "Comprender cómo una función puede recibir un arreglo como argumento, procesar sus elementos mediante un parámetro de colección y devolver un resultado derivado de ese procesamiento.",

                problemStatement:
                    "Un programa tiene un arreglo de números y necesita calcular la suma de todos sus elementos. Ya sabemos recorrer la colección, pero queremos que PRINCIPAL se encargue de preparar los datos y que otra función asuma la responsabilidad de procesarlos. ¿Cómo podemos proporcionar un arreglo completo a una función?",

                concepts: [
                    "arreglo como argumento",
                    "parámetro de arreglo",
                    "procesamiento de colección",
                    "responsabilidad de procesamiento"
                ],

                explanation: [
                    paragraph(
                        "Hasta ahora hemos creado y procesado arreglos directamente en el flujo donde fueron construidos. Sin embargo, ahora también conocemos funciones y sabemos que una responsabilidad puede separarse en un subprograma."
                    ),

                    callout(
                        "Problema de esta lección",
                        [
                            "PRINCIPAL prepara:",
                            "",
                            "numeros",
                            "┌────┬────┬────┐",
                            "│ 5  │ 10 │ 15 │",
                            "└────┴────┴────┘",
                            "",
                            "Necesitamos:",
                            "",
                            "calcular la suma",
                            "de todos sus elementos.",
                            "",
                            "Pero queremos separar:",
                            "",
                            "preparar los datos",
                            "        →",
                            "procesar la colección"
                        ].join("\n")
                    ),

                    paragraph(
                        "Una función puede recibir una colección completa como información de entrada. En CLRS, cuando un parámetro espera un arreglo de una dimensión, escribimos corchetes junto al nombre del parámetro."
                    ),

                    callout(
                        "Parámetro de arreglo",
                        [
                            "SUMAR_ELEMENTOS(datos[])",
                            "                ↑",
                            "",
                            "datos[]",
                            "→ parámetro que espera",
                            "  recibir un arreglo"
                        ].join("\n")
                    ),

                    paragraph(
                        "La escritura `datos[]` pertenece a la definición del parámetro. Indica que `datos` representa el arreglo recibido por la función."
                    ),

                    paragraph(
                        "Cuando invocamos la función no escribimos nuevamente los corchetes del parámetro. Proporcionamos el arreglo mediante el identificador que lo representa en el lugar de la llamada."
                    ),

                    callout(
                        "Definición y llamada",
                        [
                            "DEFINICIÓN",
                            "",
                            "SUMAR_ELEMENTOS(datos[])",
                            "                ↑",
                            "        parámetro de arreglo",
                            "",
                            "----------------",
                            "",
                            "LLAMADA",
                            "",
                            "SUMAR_ELEMENTOS(numeros)",
                            "                ↑",
                            "              argumento"
                        ].join("\n")
                    ),

                    paragraph(
                        "La diferencia entre parámetro y argumento es la misma que aprendimos con valores individuales. `numeros` es el arreglo proporcionado por quien realiza la llamada; `datos` es el nombre con el que la función trabaja con esa colección."
                    ),

                    callout(
                        "El nombre puede cambiar",
                        [
                            "PRINCIPAL",
                            "",
                            "numeros",
                            "┌────┬────┬────┐",
                            "│ 5  │ 10 │ 15 │",
                            "└────┴────┴────┘",
                            "",
                            "        →",
                            "",
                            "SUMAR_ELEMENTOS(numeros)",
                            "",
                            "        →",
                            "",
                            "SUMAR_ELEMENTOS(datos[])",
                            "",
                            "Dentro de la función:",
                            "",
                            "datos[0] → 5",
                            "datos[1] → 10",
                            "datos[2] → 15"
                        ].join("\n")
                    ),

                    paragraph(
                        "Una vez recibido el arreglo, la función puede aplicar las mismas operaciones que ya conocemos: consultar `LONG(datos)`, recorrer sus índices y trabajar con cada elemento mediante `datos[i]`."
                    ),


                    paragraph(
                        "Es importante distinguir la sintaxis del parámetro de la sintaxis de acceso a un elemento. `datos[]` aparece en la definición para indicar que el parámetro representa un arreglo; `datos[i]` aparece dentro del cuerpo para seleccionar uno de sus elementos."
                    ),

                    callout(
                        "Dos usos diferentes de los corchetes",
                        [
                            "datos[]",
                            "",
                            "→ declaración de un",
                            "  parámetro de arreglo",
                            "",
                            "----------------",
                            "",
                            "datos[i]",
                            "",
                            "→ acceso al elemento",
                            "  identificado por i"
                        ].join("\n")
                    ),

                    paragraph(
                        "Una función no necesita limitarse a mostrar los elementos recibidos. También puede procesarlos y producir un resultado, utilizando contadores, acumuladores, decisiones u otras estructuras aprendidas anteriormente."
                    ),


                    callout(
                        "Separar responsabilidades",
                        [
                            "PRINCIPAL",
                            "",
                            "crear la colección",
                            "        →",
                            "solicitar su procesamiento",
                            "        →",
                            "utilizar el resultado",
                            "",
                            "----------------",
                            "",
                            "SUMAR_ELEMENTOS",
                            "",
                            "recibir la colección",
                            "        →",
                            "recorrer sus elementos",
                            "        →",
                            "calcular",
                            "        →",
                            "retornar resultado"
                        ].join("\n")
                    ),

                    paragraph(
                        "Esta separación permite que `PRINCIPAL` no necesite contener los detalles de cómo se realiza la suma. Su responsabilidad puede ser coordinar el programa, mientras `SUMAR_ELEMENTOS` se concentra en una operación concreta sobre la colección."
                    ),

                    paragraph(
                        "El mismo principio puede aplicarse a otros procesamientos. Una función podría mostrar todos los elementos, contar cuántos cumplen una condición o calcular algún resultado a partir de la colección utilizando las estructuras que ya conocemos."
                    ),

                    paragraph(
                        "En esta lección nos concentraremos en recibir y consultar arreglos dentro de funciones. No necesitamos establecer todavía reglas sobre cómo una modificación realizada dentro de una función podría afectar al arreglo utilizado por quien realizó la llamada."
                    ),

                    paragraph(
                        "Con esto completamos el estudio inicial de arreglos y colecciones. Ya podemos representar múltiples datos, acceder a sus posiciones, recorrerlos, realizar operaciones sobre ellos, trabajar con estructuras bidimensionales y enviar colecciones a funciones para separar su procesamiento."
                    )
                ],

                examples: [
                    clrs(
                        "lesson-045-array-parameter",
                        [
                            "MOSTRAR(datos[])",
                            "    para i = 0 hasta LONG(datos) - 1",
                            "        escribir datos[i]",
                            "",
                            "PRINCIPAL()",
                            "    A[0] = 10",
                            "    A[1] = 20",
                            "    A[2] = 30",
                            "",
                            "    MOSTRAR(A)"
                        ].join("\n"),
                        "Enviar un arreglo a una función",
                        "`A` es el argumento. `datos[]` declara el parámetro de arreglo y `datos[i]` permite acceder a sus elementos dentro de la función."
                    ),

                    text(
                        "lesson-045-parameter-argument",
                        [
                            "PRINCIPAL",
                            "",
                            "numeros",
                            "┌────┬────┬────┐",
                            "│ 5  │ 10 │ 15 │",
                            "└────┴────┴────┘",
                            "",
                            "        ↓ argumento",
                            "",
                            "SUMAR_ELEMENTOS(numeros)",
                            "",
                            "        ↓",
                            "",
                            "SUMAR_ELEMENTOS(datos[])",
                            "",
                            "        ↓",
                            "",
                            "dentro de la función:",
                            "",
                            "datos[0] → 5",
                            "datos[1] → 10",
                            "datos[2] → 15"
                        ].join("\n"),
                        "Argumento y parámetro pueden tener nombres distintos",
                        "El identificador utilizado por quien llama a la función no tiene que coincidir con el nombre del parámetro utilizado dentro del subprograma."
                    ),

                    clrs(
                        "lesson-045-array-return",
                        [
                            "SUMAR_ELEMENTOS(datos[])",
                            "    total = 0",
                            "",
                            "    para i = 0 hasta LONG(datos) - 1",
                            "        total = total + datos[i]",
                            "",
                            "    retornar total",
                            "",
                            "PRINCIPAL()",
                            "    numeros[0] = 5",
                            "    numeros[1] = 10",
                            "    numeros[2] = 15",
                            "",
                            "    total = SUMAR_ELEMENTOS(numeros)",
                            "    escribir total"
                        ].join("\n"),
                        "Recibir, recorrer y retornar",
                        "La función combina parámetros, recorrido, acumulación y retorno para encargarse completamente del procesamiento de la colección."
                    ),

                    clrs(
                        "lesson-045-count-array",
                        [
                            "CONTAR_POSITIVOS(datos[])",
                            "    cantidad = 0",
                            "",
                            "    para i = 0 hasta LONG(datos) - 1",
                            "        si datos[i] > 0",
                            "            cantidad = cantidad + 1",
                            "",
                            "    retornar cantidad",
                            "",
                            "PRINCIPAL()",
                            "    A[0] = -2",
                            "    A[1] = 5",
                            "    A[2] = 0",
                            "    A[3] = 8",
                            "",
                            "    positivos = CONTAR_POSITIVOS(A)",
                            "    escribir positivos"
                        ].join("\n"),
                        "Aplicar una responsabilidad a toda la colección",
                        "La función recibe el arreglo, combina recorrido, selección y contador, y retorna cuántos elementos son positivos."
                    ),

                    clrs(
                        "lesson-045-show-array",
                        [
                            "MOSTRAR(datos[])",
                            "    para i = 0 hasta LONG(datos) - 1",
                            "        escribir datos[i]",
                            "",
                            "PRINCIPAL()",
                            "    A[0] = 10",
                            "    A[1] = 20",
                            "    A[2] = 30",
                            "",
                            "    MOSTRAR(A)"
                        ].join("\n"),
                        "Recibir y recorrer una colección",
                        "`A` es el argumento proporcionado desde `PRINCIPAL`. Dentro de `MOSTRAR`, el parámetro `datos` permite recorrer los elementos recibidos."
                    ),

                    clrs(
                        "lesson-045-sum-array",
                        [
                            "SUMAR_ELEMENTOS(datos[])",
                            "    total = 0",
                            "",
                            "    para i = 0 hasta LONG(datos) - 1",
                            "        total = total + datos[i]",
                            "",
                            "    retornar total",
                            "",
                            "PRINCIPAL()",
                            "    numeros[0] = 5",
                            "    numeros[1] = 10",
                            "    numeros[2] = 15",
                            "",
                            "    resultado = SUMAR_ELEMENTOS(numeros)",
                            "    escribir resultado"
                        ].join("\n"),
                        "Procesar una colección y retornar un resultado",
                        "`SUMAR_ELEMENTOS` recibe el arreglo, recorre sus elementos mediante un acumulador y retorna la suma obtenida. `PRINCIPAL` recibe el resultado 30."
                    ),
                ],

                knowledge: [
                    "comprender que un arreglo puede proporcionarse como argumento a una función",
                    "declarar un parámetro de arreglo mediante la sintaxis nombre[]",
                    "distinguir la sintaxis de parámetro datos[] del acceso a un elemento datos[i]",
                    "distinguir el arreglo utilizado como argumento del parámetro que lo representa dentro de la función",
                    "comprender que el nombre del argumento y el nombre del parámetro pueden ser diferentes",
                    "obtener la longitud de un arreglo recibido mediante LONG",
                    "recorrer dentro de una función los elementos de un arreglo recibido",
                    "procesar una colección dentro de un subprograma",
                    "retornar un resultado derivado del procesamiento de un arreglo",
                    "separar la preparación de los datos de la responsabilidad de procesarlos"
                ],

                notes: [
                    callout(
                        "Semántica de modificación",
                        "En esta lección utilizamos arreglos recibidos para consultar y procesar sus elementos. No necesitamos asumir todavía qué efecto tendría modificar dentro de una función el arreglo proporcionado por quien realiza la llamada."
                    )
                ],

                recommendedTools: [
                    "call-stack",
                    "execution-trace"
                ],

                category: "FND-COLLECTION"
            }),
            lesson({
                order: 46,
                section: 8,
                title: "Entrada, procesamiento y salida",

                objective:
                    "Aplicar el modelo Entrada → Procesamiento → Salida para analizar un problema y construir una solución completa que reciba datos, los transforme y comunique correctamente el resultado.",

                problemStatement:
                    "Un programa debe recibir la base y la altura de un rectángulo, calcular su área y mostrar el resultado. Antes de escribir las instrucciones, ¿cómo podemos identificar con claridad qué información necesita el programa, qué debe hacer con ella y qué resultado debe producir?",

                concepts: [
                    "entrada",
                    "procesamiento",
                    "salida",
                    "transformación de datos",
                    "solución completa"
                ],

                explanation: [
                    paragraph(
                        "Al comenzar esta ruta estudiamos la entrada, el procesamiento y la salida como un modelo conceptual para comprender qué hace un programa. En aquel momento todavía no conocíamos todas las construcciones necesarias para implementar las tres etapas."
                    ),

                    callout(
                        "Volver al mismo modelo con nuevas herramientas",
                        [
                            "LECCIÓN 4",
                            "",
                            "comprender:",
                            "",
                            "ENTRADA",
                            "    →",
                            "PROCESAMIENTO",
                            "    →",
                            "SALIDA",
                            "",
                            "----------------",
                            "",
                            "LECCIÓN 46",
                            "",
                            "analizar el problema",
                            "        →",
                            "implementar la entrada",
                            "        →",
                            "realizar el procesamiento",
                            "        →",
                            "producir la salida"
                        ].join("\n")
                    ),

                    paragraph(
                        "Ahora sabemos trabajar con variables, entrada real mediante `leer`, expresiones, operadores, funciones, estructuras de control y colecciones. Por ello podemos utilizar el modelo Entrada → Procesamiento → Salida como guía para construir programas completos."
                    ),

                    callout(
                        "Problema de esta lección",
                        [
                            "Calcular el área",
                            "de un rectángulo",
                            "",
                            "        →",
                            "",
                            "¿Qué datos necesito?",
                            "",
                            "        →",
                            "",
                            "¿Qué transformación debo realizar?",
                            "",
                            "        →",
                            "",
                            "¿Qué resultado debo comunicar?"
                        ].join("\n")
                    ),

                    paragraph(
                        "La entrada representa la información que la solución necesita recibir para resolver el problema. La pregunta principal es: ¿qué datos deben estar disponibles antes de realizar el cálculo?"
                    ),

                    callout(
                        "1. Entrada",
                        [
                            "Problema:",
                            "calcular el área",
                            "",
                            "Datos necesarios:",
                            "",
                            "base",
                            "altura"
                        ].join("\n")
                    ),

                    paragraph(
                        "En CLRS podemos recibir esos valores mediante `leer`. Como `leer` asigna un valor a una variable ya existente, primero inicializamos las variables que recibirán los datos."
                    ),


                    paragraph(
                        "El procesamiento representa las operaciones que transforman los datos de entrada en la información que necesitamos obtener."
                    ),

                    callout(
                        "2. Procesamiento",
                        [
                            "Datos disponibles:",
                            "",
                            "base",
                            "altura",
                            "",
                            "        →",
                            "",
                            "Transformación:",
                            "",
                            "area = base * altura",
                            "",
                            "        →",
                            "",
                            "Resultado calculado:",
                            "",
                            "area"
                        ].join("\n")
                    ),

                    paragraph(
                        "El procesamiento puede ser tan sencillo como una operación aritmética o puede combinar varias construcciones aprendidas anteriormente. Lo importante es identificar qué trabajo transforma los datos de entrada en el resultado requerido."
                    ),

                    paragraph(
                        "La salida representa la información que el programa debe comunicar como resultado de la solución. No necesariamente debemos mostrar todos los valores intermedios; debemos producir aquello que solicita el problema."
                    ),

                    callout(
                        "3. Salida",
                        [
                            "Resultado obtenido:",
                            "",
                            "area",
                            "",
                            "        →",
                            "",
                            "Comunicar:",
                            "",
                            "escribir area"
                        ].join("\n")
                    ),

                    paragraph(
                        "Una vez identificadas las tres responsabilidades podemos representarlas conjuntamente mediante un programa ejecutable."
                    ),


                    callout(
                        "Relacionar modelo y código",
                        [
                            "ENTRADA",
                            "",
                            "leer base",
                            "leer altura",
                            "",
                            "        →",
                            "",
                            "PROCESAMIENTO",
                            "",
                            "area = base * altura",
                            "",
                            "        →",
                            "",
                            "SALIDA",
                            "",
                            "escribir area"
                        ].join("\n")
                    ),

                    paragraph(
                        "El modelo ayuda especialmente antes de programar. Podemos leer un enunciado y transformarlo primero en tres preguntas: qué información necesito, qué debo hacer con ella y qué resultado debe obtener quien utiliza el programa."
                    ),

                    callout(
                        "Tres preguntas antes del código",
                        [
                            "ENTRADA",
                            "",
                            "¿qué información",
                            "necesito recibir?",
                            "",
                            "----------------",
                            "",
                            "PROCESAMIENTO",
                            "",
                            "¿qué debo hacer",
                            "con esa información?",
                            "",
                            "----------------",
                            "",
                            "SALIDA",
                            "",
                            "¿qué resultado",
                            "debo comunicar?"
                        ].join("\n")
                    ),

                    paragraph(
                        "Por ejemplo, si el problema consiste en calcular el costo de varias unidades de un producto, podemos identificar primero el precio y la cantidad como entradas, la multiplicación como procesamiento y el costo total como salida."
                    ),


                    paragraph(
                        "Entrada, procesamiento y salida no deben entenderse como una obligación de dividir físicamente todo programa en tres bloques rígidos. Son categorías para razonar sobre las responsabilidades de la solución."
                    ),

                    callout(
                        "Modelo, no plantilla rígida",
                        [
                            "ENTRADA → PROCESAMIENTO → SALIDA",
                            "",
                            "sirve para:",
                            "",
                            "→ comprender el problema",
                            "→ identificar datos",
                            "→ identificar transformaciones",
                            "→ identificar resultados",
                            "",
                            "No significa:",
                            "",
                            "\"todo programa debe",
                            "tener exactamente",
                            "tres bloques de código\""
                        ].join("\n")
                    ),

                    paragraph(
                        "En problemas más complejos, una decisión puede formar parte del procesamiento, una repetición puede recibir o procesar varios datos y una función puede encargarse de una responsabilidad completa. El modelo continúa siendo útil aunque la implementación interna sea más elaborada."
                    ),

                    paragraph(
                        "En esta lección mantendremos los problemas pequeños para concentrarnos en la transformación completa de información. En la siguiente combinaremos explícitamente varias estructuras de control dentro de una misma solución."
                    )
                ],

                examples: [
                    clrs(
                        "lesson-046-complete-flow",
                        [
                            "PRINCIPAL()",
                            "    numero = 0",
                            "",
                            "    leer numero",
                            "",
                            "    doble = numero * 2",
                            "",
                            "    escribir doble"
                        ].join("\n"),
                        "Leer, transformar y mostrar",
                        "El programa recibe un número, obtiene un nuevo valor mediante procesamiento y muestra únicamente el resultado solicitado."
                    ),

                    text(
                        "lesson-046-complete-flow-analysis",
                        [
                            "ENTRADA",
                            "",
                            "numero = 0",
                            "leer numero",
                            "",
                            "        ↓",
                            "",
                            "PROCESAMIENTO",
                            "",
                            "doble = numero * 2",
                            "",
                            "        ↓",
                            "",
                            "SALIDA",
                            "",
                            "escribir doble"
                        ].join("\n"),
                        "Reconocer las responsabilidades",
                        "Las instrucciones forman una solución completa en la que los datos pasan desde la entrada hasta un resultado observable."
                    ),

                    clrs(
                        "lesson-046-rectangle",
                        [
                            "PRINCIPAL()",
                            "    base = 0",
                            "    altura = 0",
                            "",
                            "    leer base",
                            "    leer altura",
                            "",
                            "    area = base * altura",
                            "",
                            "    escribir area"
                        ].join("\n"),
                        "Calcular el área de un rectángulo",
                        "La entrada proporciona dos valores, el procesamiento obtiene el área y la salida comunica el valor calculado."
                    ),

                    text(
                        "lesson-046-rectangle-model",
                        [
                            "Entrada recibida:",
                            "",
                            "base = 5",
                            "altura = 3",
                            "",
                            "        ↓",
                            "",
                            "Procesamiento:",
                            "",
                            "area = 5 * 3",
                            "area = 15",
                            "",
                            "        ↓",
                            "",
                            "Salida:",
                            "",
                            "15"
                        ].join("\n"),
                        "Seguir la transformación de los datos",
                        "El resultado final puede entenderse como la consecuencia de transformar sistemáticamente la información recibida."
                    ),

                    clrs(
                        "lesson-046-input",
                        [
                            "base = 0",
                            "altura = 0",
                            "",
                            "leer base",
                            "leer altura"
                        ].join("\n"),
                        "Recibir los datos",
                        "`base` y `altura` se inicializan antes de utilizar `leer` y después contienen los valores proporcionados durante la ejecución."
                    ),

                    clrs(
                        "lesson-046-complete-rectangle",
                        [
                            "PRINCIPAL()",
                            "    base = 0",
                            "    altura = 0",
                            "",
                            "    leer base",
                            "    leer altura",
                            "",
                            "    area = base * altura",
                            "",
                            "    escribir area"
                        ].join("\n"),
                        "Una solución completa",
                        "El programa recibe dos datos, los transforma mediante una multiplicación y comunica el resultado obtenido."
                    ),

                    clrs(
                        "lesson-046-purchase",
                        [
                            "PRINCIPAL()",
                            "    precio = 0",
                            "    cantidad = 0",
                            "",
                            "    leer precio",
                            "    leer cantidad",
                            "",
                            "    total = precio * cantidad",
                            "",
                            "    escribir total"
                        ].join("\n"),
                        "Aplicar el mismo modelo a otro problema",
                        "Aunque cambia el contexto, continúa existiendo la misma estructura lógica: recibir información, transformarla y comunicar el resultado."
                    ),
                ],

                knowledge: [
                    "aplicar el modelo Entrada → Procesamiento → Salida a una solución ejecutable",
                    "identificar qué datos necesita recibir un programa",
                    "identificar qué transformación debe realizarse sobre los datos",
                    "identificar qué resultado debe comunicarse",
                    "relacionar leer con la recepción de información durante la ejecución",
                    "recordar que una variable debe existir antes de utilizar leer en CLRS",
                    "relacionar expresiones y asignaciones con el procesamiento de datos",
                    "relacionar escribir con la comunicación del resultado",
                    "transformar un enunciado sencillo en una solución completa",
                    "comprender que Entrada → Procesamiento → Salida es un modelo de razonamiento y no una plantilla rígida de código"
                ],

                notes: [
                    callout(
                        "El modelo reaparece con mayor profundidad",
                        "En la Lección 4, Entrada → Procesamiento → Salida se utilizó para comprender conceptualmente la estructura de una transformación. En esta lección el mismo modelo se aplica a programas ejecutables porque el estudiante ya domina las construcciones necesarias para implementar sus etapas."
                    )
                ],

                recommendedTools: [
                    "execution-trace"
                ],

                category: "FND-IO"
            }),
            lesson({
                order: 47,
                section: 8,
                title: "Combinar estructuras de control",

                objective:
                    "Integrar entrada, repetición, selección, contadores y acumuladores en una misma solución, asignando a cada construcción una responsabilidad y coordinando correctamente el estado durante el procesamiento.",

                problemStatement:
                    "Un programa debe recibir varios números, contar cuántos son positivos y calcular la suma de esos valores positivos. Ninguna construcción aislada resuelve todo el problema. ¿Cómo podemos combinar entrada, repetición, decisión, contador y acumulador para obtener ambos resultados?",

                concepts: [
                    "composición de estructuras",
                    "responsabilidad",
                    "estado de procesamiento",
                    "resultado parcial",
                    "resultado final"
                ],

                explanation: [
                    paragraph(
                        "En las lecciones anteriores aprendimos cada construcción de manera relativamente aislada. Ahora comenzaremos a utilizarlas conjuntamente cuando un problema contenga varias necesidades diferentes."
                    ),

                    callout(
                        "Problema de esta lección",
                        [
                            "Recibir varios números",
                            "",
                            "y obtener:",
                            "",
                            "1. cuántos son positivos",
                            "2. cuánto suman los positivos",
                            "",
                            "Para resolverlo necesitamos:",
                            "",
                            "recibir",
                            "repetir",
                            "decidir",
                            "contar",
                            "acumular"
                        ].join("\n")
                    ),

                    paragraph(
                        "Combinar estructuras no significa intentar utilizar todas las construcciones que conocemos. Primero analizamos qué responsabilidades aparecen en el problema y después elegimos las herramientas necesarias para representar cada una."
                    ),

                    callout(
                        "Responsabilidad y construcción",
                        [
                            "recibir cada valor",
                            "→ leer",
                            "",
                            "procesar varios valores",
                            "→ ciclo",
                            "",
                            "decidir si es positivo",
                            "→ si",
                            "",
                            "registrar cuántos son positivos",
                            "→ contador",
                            "",
                            "conservar su suma",
                            "→ acumulador",
                            "",
                            "comunicar resultados",
                            "→ escribir"
                        ].join("\n")
                    ),

                    paragraph(
                        "Supongamos que primero recibimos la cantidad de valores que serán procesados. Esa información permite establecer cuántas veces debemos repetir la lectura y el análisis."
                    ),

                    callout(
                        "Descomponer antes de programar",
                        [
                            "1. recibir la cantidad",
                            "",
                            "2. preparar el estado",
                            "",
                            "3. repetir para cada valor",
                            "",
                            "4. recibir el valor actual",
                            "",
                            "5. comprobar si es positivo",
                            "",
                            "6. actualizar contador y suma",
                            "",
                            "7. mostrar resultados finales"
                        ].join("\n")
                    ),

                    paragraph(
                        "Las variables que conservan información entre iteraciones deben prepararse antes de comenzar el recorrido. En nuestro problema utilizaremos un contador para la cantidad de positivos y un acumulador para su suma."
                    ),


                    paragraph(
                        "Durante cada iteración recibimos un nuevo dato. Como la decisión debe realizarse para cada valor, la estructura `si` se coloca dentro del ciclo."
                    ),

                    callout(
                        "La decisión pertenece al recorrido",
                        [
                            "repetir",
                            "",
                            "    recibir valor",
                            "",
                            "    ¿valor > 0?",
                            "",
                            "        sí",
                            "        →",
                            "        contar",
                            "        acumular",
                            "",
                            "        no",
                            "        →",
                            "        continuar"
                        ].join("\n")
                    ),

                    paragraph(
                        "El contador y el acumulador se actualizan únicamente cuando el valor satisface la condición. Su ubicación dentro del bloque condicionado representa precisamente esa regla."
                    ),


                    paragraph(
                        "En este ejemplo asumimos que `cantidad` es mayor que cero, de modo que el recorrido mediante `para` representa directamente la cantidad de valores especificada."
                    ),

                    paragraph(
                        "Aunque `positivos` y `sumaPositivos` se actualizan dentro del mismo bloque, conservan información diferente."
                    ),

                    callout(
                        "Dos estados, dos responsabilidades",
                        [
                            "positivos",
                            "",
                            "positivos = positivos + 1",
                            "",
                            "→ ¿cuántos valores positivos",
                            "  hemos encontrado?",
                            "",
                            "----------------",
                            "",
                            "sumaPositivos",
                            "",
                            "sumaPositivos = sumaPositivos + valor",
                            "",
                            "→ ¿cuánto suman los valores",
                            "  positivos encontrados?"
                        ].join("\n")
                    ),

                    paragraph(
                        "El orden temporal de estas operaciones también es importante. Primero debemos inicializar las variables de estado, después actualizarlas mientras procesamos los datos y finalmente utilizar sus valores cuando el recorrido haya terminado."
                    ),

                    callout(
                        "Ciclo de vida del estado",
                        [
                            "ANTES DEL CICLO",
                            "",
                            "positivos = 0",
                            "sumaPositivos = 0",
                            "",
                            "        →",
                            "",
                            "DURANTE EL CICLO",
                            "",
                            "examinar cada valor",
                            "actualizar cuando corresponda",
                            "",
                            "        →",
                            "",
                            "DESPUÉS DEL CICLO",
                            "",
                            "positivos",
                            "sumaPositivos",
                            "",
                            "→ resultados finales"
                        ].join("\n")
                    ),

                    paragraph(
                        "Si inicializáramos el contador o el acumulador dentro del ciclo, perderíamos el resultado construido por las iteraciones anteriores. La información que debe conservarse entre iteraciones necesita existir durante todo el recorrido."
                    ),


                    paragraph(
                        "La dificultad de este tipo de problema ya no consiste en recordar la sintaxis de una construcción. Consiste en decidir qué responsabilidad corresponde a cada estructura, dónde debe ubicarse y qué información necesita conservarse entre las diferentes etapas."
                    ),

                    callout(
                        "Pensar antes de combinar",
                        [
                            "No preguntar primero:",
                            "",
                            "\"¿qué estructuras puedo usar?\"",
                            "",
                            "Preguntar:",
                            "",
                            "\"¿qué necesita hacer",
                            "cada parte del problema?\"",
                            "",
                            "        →",
                            "",
                            "después elegir",
                            "la construcción adecuada"
                        ].join("\n")
                    ),

                    paragraph(
                        "Una solución tampoco tiene que incluir necesariamente una decisión, un contador y un acumulador al mismo tiempo. Si el problema no necesita una de esas responsabilidades, no hay razón para añadir su construcción correspondiente."
                    ),

                    paragraph(
                        "En la siguiente lección aumentaremos nuevamente el nivel de organización: en lugar de concentrarnos únicamente en qué estructuras combinar, aprenderemos a dividir un problema completo en subproblemas con responsabilidades que puedan resolverse por separado."
                    )
                ],

                examples: [
                    clrs(
                        "lesson-047-count-positives",
                        [
                            "cantidad = 0",
                            "valor = 0",
                            "",
                            "leer cantidad",
                            "",
                            "positivos = 0",
                            "",
                            "para i = 0 hasta cantidad - 1",
                            "    leer valor",
                            "",
                            "    si valor > 0",
                            "        positivos = positivos + 1",
                            "",
                            "escribir positivos"
                        ].join("\n"),
                        "Combinar repetición, decisión y contador",
                        "Cada construcción posee una responsabilidad concreta: repetir, clasificar el valor actual y conservar el número de casos positivos."
                    ),

                    text(
                        "lesson-047-positive-trace",
                        [
                            "cantidad = 4",
                            "",
                            "valores:",
                            "5, -2, 8, 0",
                            "",
                            "5",
                            "→ cumple valor > 0",
                            "→ positivos = 1",
                            "",
                            "-2",
                            "→ no cumple",
                            "→ positivos = 1",
                            "",
                            "8",
                            "→ cumple",
                            "→ positivos = 2",
                            "",
                            "0",
                            "→ no cumple",
                            "→ positivos = 2",
                            "",
                            "resultado final:",
                            "2"
                        ].join("\n"),
                        "Seguir el contador",
                        "El contador cambia únicamente cuando el evento definido por el problema ocurre."
                    ),

                    clrs(
                        "lesson-047-counter-accumulator",
                        [
                            "cantidad = 0",
                            "valor = 0",
                            "",
                            "leer cantidad",
                            "",
                            "positivos = 0",
                            "sumaPositivos = 0",
                            "",
                            "para i = 0 hasta cantidad - 1",
                            "    leer valor",
                            "",
                            "    si valor > 0",
                            "        positivos = positivos + 1",
                            "        sumaPositivos = sumaPositivos + valor",
                            "",
                            "escribir positivos",
                            "escribir sumaPositivos"
                        ].join("\n"),
                        "Conservar dos resultados parciales",
                        "`positivos` responde cuántos casos fueron encontrados y `sumaPositivos` responde cuánto suman esos casos."
                    ),

                    text(
                        "lesson-047-state-lifecycle",
                        [
                            "ANTES",
                            "",
                            "contador = 0",
                            "acumulador = 0",
                            "",
                            "        ↓",
                            "",
                            "DURANTE",
                            "",
                            "leer",
                            "decidir",
                            "actualizar",
                            "",
                            "        ↓",
                            "",
                            "DESPUÉS",
                            "",
                            "utilizar",
                            "resultado final"
                        ].join("\n"),
                        "Organizar el estado en el tiempo",
                        "Las variables que resumen el recorrido se inicializan antes, se modifican durante y se consultan después."
                    ),

                    clrs(
                        "lesson-047-initial-state",
                        [
                            "positivos = 0",
                            "sumaPositivos = 0"
                        ].join("\n"),
                        "Preparar el estado",
                        "`positivos` comienza representando cero casos encontrados y `sumaPositivos` representa una suma a la que todavía no se ha incorporado ningún valor."
                    ),

                    clrs(
                        "lesson-047-combined-control",
                        [
                            "cantidad = 0",
                            "valor = 0",
                            "",
                            "leer cantidad",
                            "",
                            "positivos = 0",
                            "sumaPositivos = 0",
                            "",
                            "para i = 0 hasta cantidad - 1",
                            "    leer valor",
                            "",
                            "    si valor > 0",
                            "        positivos = positivos + 1",
                            "        sumaPositivos = sumaPositivos + valor",
                            "",
                            "escribir positivos",
                            "escribir sumaPositivos"
                        ].join("\n"),
                        "Coordinar varias construcciones",
                        "El ciclo controla cuántos valores se procesan; `si` selecciona los positivos; el contador registra cuántos aparecen y el acumulador conserva su suma."
                    ),

                    text(
                        "lesson-047-trace",
                        [
                            "Valores:",
                            "5, -2, 8, 0",
                            "",
                            "Inicio:",
                            "positivos = 0",
                            "sumaPositivos = 0",
                            "",
                            "valor = 5",
                            "→ positivo",
                            "→ positivos = 1",
                            "→ sumaPositivos = 5",
                            "",
                            "valor = -2",
                            "→ no positivo",
                            "→ positivos = 1",
                            "→ sumaPositivos = 5",
                            "",
                            "valor = 8",
                            "→ positivo",
                            "→ positivos = 2",
                            "→ sumaPositivos = 13",
                            "",
                            "valor = 0",
                            "→ no positivo",
                            "→ positivos = 2",
                            "→ sumaPositivos = 13"
                        ].join("\n"),
                        "Seguir varios estados a la vez",
                        "La traza permite observar qué variables cambian en cada iteración y bajo qué condición."
                    ),
                ],

                knowledge: [
                    "combinar varias construcciones previamente aprendidas dentro de una misma solución",
                    "asignar una responsabilidad concreta a cada estructura utilizada",
                    "combinar entrada e iteración para procesar varios datos",
                    "utilizar una condición dentro de un ciclo cuando cada elemento debe evaluarse",
                    "actualizar un contador únicamente cuando ocurre el evento que representa",
                    "actualizar un acumulador únicamente con los valores que deben formar parte del resultado",
                    "conservar varios estados parciales durante un mismo recorrido",
                    "comprender el ciclo de vida de un estado: inicialización, actualización y uso final",
                    "organizar las operaciones en el orden necesario para resolver un problema",
                    "comprender que combinar estructuras no implica utilizar construcciones que el problema no necesita"
                ],

                notes: [
                    callout(
                        "Composición no significa complejidad innecesaria",
                        "Una solución integrada puede utilizar varias construcciones, pero cada una debe responder a una necesidad del problema. Agregar decisiones, ciclos o funciones que no aportan una responsabilidad real no hace que la solución sea más completa."
                    )
                ],

                recommendedTools: [
                    "execution-trace",
                    "debugger"
                ],

                category: "FND-CONTROL"
            }),
            lesson({
                order: 48,
                section: 8,
                title: "Dividir un problema en subproblemas",

                objective:
                    "Analizar un problema completo, identificar responsabilidades significativas y organizar su solución mediante funciones que colaboren y sean coordinadas desde PRINCIPAL.",

                problemStatement:
                    "Un programa debe recibir una cantidad, calcular un importe a partir de ella y comunicar el resultado. La solución puede escribirse como un único flujo, pero queremos organizarla de modo que cada parte tenga una responsabilidad clara. ¿Cómo decidimos qué subproblemas existen, qué información necesita cada uno y cómo coordinamos sus resultados?",

                concepts: [
                    "subproblema",
                    "descomposición",
                    "responsabilidad",
                    "coordinación",
                    "flujo de información"
                ],

                explanation: [
                    paragraph(
                        "Al comenzar la programación procedimental aprendimos que un problema puede contener varias responsabilidades. Ahora aplicaremos esa idea a una solución completa: ya conocemos funciones, parámetros, retornos, ámbito y estructuras de control, por lo que podemos decidir cómo dividir realmente el trabajo."
                    ),

                    callout(
                        "De la idea a la aplicación",
                        [
                            "LECCIÓN 31",
                            "",
                            "comprender que una solución",
                            "puede organizarse",
                            "por responsabilidades",
                            "",
                            "----------------",
                            "",
                            "LECCIÓN 48",
                            "",
                            "recibir un problema completo",
                            "        →",
                            "identificar responsabilidades",
                            "        →",
                            "decidir qué separar",
                            "        →",
                            "representarlo con funciones",
                            "        →",
                            "coordinar la solución"
                        ].join("\n")
                    ),

                    paragraph(
                        "Un subproblema es una parte del problema completo que puede razonarse como una responsabilidad diferenciada. Antes de crear funciones conviene identificar qué trabajo necesita realmente la solución."
                    ),

                    callout(
                        "Primero descomponer",
                        [
                            "PROBLEMA COMPLETO",
                            "",
                            "        →",
                            "",
                            "¿qué información necesito obtener?",
                            "",
                            "¿qué transformación debo realizar?",
                            "",
                            "¿qué resultado debo comunicar?",
                            "",
                            "¿qué partes tienen",
                            "responsabilidad propia?"
                        ].join("\n")
                    ),

                    paragraph(
                        "Después podemos decidir cuáles de esas responsabilidades conviene representar mediante funciones. No existe una obligación de convertir cada paso en un subprograma."
                    ),

                    paragraph(
                        "Una función resulta especialmente útil cuando podemos describir con claridad qué responsabilidad realiza, qué información necesita y, cuando corresponda, qué resultado produce."
                    ),

                    callout(
                        "Una responsabilidad bien delimitada",
                        [
                            "FUNCIÓN",
                            "",
                            "¿qué hace?",
                            "        →",
                            "responsabilidad",
                            "",
                            "¿qué necesita?",
                            "        →",
                            "parámetros o entrada",
                            "",
                            "¿qué produce?",
                            "        →",
                            "acción o retorno"
                        ].join("\n")
                    ),

                    paragraph(
                        "Consideremos un problema sencillo: recibir un número, calcular su doble y mostrar el resultado. Podemos reconocer tres responsabilidades posibles: obtener el dato, calcular el resultado y comunicarlo."
                    ),


                    paragraph(
                        "Una posible representación consiste en crear una función para cada una de esas responsabilidades y utilizar `PRINCIPAL` para coordinar el flujo entre ellas."
                    ),


                    paragraph(
                        "En una solución descompuesta, el resultado producido por una parte puede convertirse en la entrada necesaria para otra. Por ello también debemos comprender el flujo de información entre subproblemas."
                    ),

                    callout(
                        "Flujo entre responsabilidades",
                        [
                            "LEER_NUMERO()",
                            "",
                            "        → retorna",
                            "",
                            "numero",
                            "",
                            "        → argumento",
                            "",
                            "CALCULAR_DOBLE(numero)",
                            "",
                            "        → retorna",
                            "",
                            "resultado",
                            "",
                            "        → argumento",
                            "",
                            "MOSTRAR_RESULTADO(resultado)"
                        ].join("\n")
                    ),

                    paragraph(
                        "Este flujo muestra que las funciones no son piezas aisladas. Forman una solución cuando sus entradas, resultados y llamadas se coordinan correctamente."
                    ),

                    paragraph(
                        "`PRINCIPAL` puede cumplir precisamente ese papel de coordinación. En lugar de contener todos los detalles de cada responsabilidad, puede expresar el orden general de la solución."
                    ),

                    callout(
                        "PRINCIPAL como coordinador",
                        [
                            "PRINCIPAL",
                            "",
                            "obtener datos",
                            "        →",
                            "procesarlos",
                            "        →",
                            "comunicar resultado",
                            "",
                            "El detalle de cada tarea",
                            "puede encontrarse",
                            "en funciones separadas."
                        ].join("\n")
                    ),

                    paragraph(
                        "Sin embargo, esta no es la única descomposición válida. El mismo problema puede mantenerse más pequeño si únicamente la operación que posee una responsabilidad clara se representa mediante una función."
                    ),


                    paragraph(
                        "Las dos soluciones pueden ser razonables. El objetivo de descomponer no es alcanzar una cantidad determinada de funciones, sino obtener una organización que permita comprender qué hace cada parte y cómo contribuye al resultado completo."
                    ),

                    callout(
                        "No existe una cantidad mágica de funciones",
                        [
                            "MÁS FUNCIONES",
                            "≠",
                            "MEJOR SOLUCIÓN",
                            "",
                            "MENOS FUNCIONES",
                            "≠",
                            "PEOR SOLUCIÓN",
                            "",
                            "La pregunta útil es:",
                            "",
                            "¿las responsabilidades",
                            "están representadas",
                            "con claridad?"
                        ].join("\n")
                    ),

                    paragraph(
                        "También debemos evitar confundir las etapas Entrada → Procesamiento → Salida con una regla que exija crear exactamente tres funciones. Esas etapas ayudan a analizar el problema, pero la estructura de funciones depende de las responsabilidades concretas."
                    ),

                    paragraph(
                        "Por ejemplo, en un programa pequeño puede resultar perfectamente claro mantener la lectura y la salida dentro de `PRINCIPAL` y separar únicamente un cálculo significativo."
                    ),

                    paragraph(
                        "Una buena descomposición permite razonar localmente: podemos concentrarnos en una función y preguntar qué necesita y qué produce sin tener que seguir al mismo tiempo todos los detalles de la solución."
                    ),

                    callout(
                        "Razonar por partes",
                        [
                            "CALCULAR_DOBLE(valor)",
                            "",
                            "necesita:",
                            "valor",
                            "",
                            "hace:",
                            "valor * 2",
                            "",
                            "produce:",
                            "resultado",
                            "",
                            "No necesitamos resolver",
                            "al mismo tiempo",
                            "la entrada y la salida."
                        ].join("\n")
                    ),

                    paragraph(
                        "Descomponer tampoco significa cambiar el problema. Las funciones reorganizan la solución, pero juntas deben continuar cumpliendo exactamente los requisitos del programa completo."
                    ),

                    paragraph(
                        "En la siguiente lección utilizaremos todas estas herramientas con mayor libertad para construir un primer prototipo algorítmico: ya no se nos indicará qué estructura o función utilizar, sino que tendremos que elegir cómo resolver el problema completo."
                    )
                ],

                examples: [
                    text(
                        "lesson-048-identify",
                        [
                            "PROBLEMA",
                            "",
                            "recibir precio y cantidad",
                            "calcular subtotal",
                            "mostrar resultado",
                            "",
                            "        ↓",
                            "",
                            "POSIBLES RESPONSABILIDADES",
                            "",
                            "obtener datos",
                            "calcular subtotal",
                            "comunicar resultado"
                        ].join("\n"),
                        "Descomponer antes de programar",
                        "Primero se reconocen las partes significativas; después se decide cuáles conviene representar mediante funciones."
                    ),

                    clrs(
                        "lesson-048-coordination",
                        [
                            "CALCULAR_SUBTOTAL(precio, cantidad)",
                            "    retornar precio * cantidad",
                            "",
                            "PRINCIPAL()",
                            "    precio = 0",
                            "    cantidad = 0",
                            "",
                            "    leer precio",
                            "    leer cantidad",
                            "",
                            "    subtotal = CALCULAR_SUBTOTAL(precio, cantidad)",
                            "    escribir subtotal"
                        ].join("\n"),
                        "Separar una responsabilidad significativa",
                        "`PRINCIPAL` coordina la entrada y la salida, mientras `CALCULAR_SUBTOTAL` representa específicamente la transformación necesaria."
                    ),

                    clrs(
                        "lesson-048-three-functions",
                        [
                            "LEER_NUMERO()",
                            "    numero = 0",
                            "    leer numero",
                            "    retornar numero",
                            "",
                            "CALCULAR_DOBLE(valor)",
                            "    retornar valor * 2",
                            "",
                            "MOSTRAR_RESULTADO(valor)",
                            "    escribir valor",
                            "",
                            "PRINCIPAL()",
                            "    numero = LEER_NUMERO()",
                            "    resultado = CALCULAR_DOBLE(numero)",
                            "    MOSTRAR_RESULTADO(resultado)"
                        ].join("\n"),
                        "Una descomposición más explícita",
                        "Cada función representa una responsabilidad distinta y `PRINCIPAL` expresa cómo colaboran para producir la solución completa."
                    ),

                    text(
                        "lesson-048-data-flow",
                        [
                            "dato de entrada",
                            "",
                            "        ↓",
                            "",
                            "FUNCIÓN A",
                            "",
                            "        ↓ resultado",
                            "",
                            "FUNCIÓN B",
                            "",
                            "        ↓ resultado",
                            "",
                            "FUNCIÓN C",
                            "",
                            "        ↓",
                            "",
                            "salida final"
                        ].join("\n"),
                        "Coordinar subproblemas",
                        "La descomposición requiere también comprender cómo la información producida por una responsabilidad alimenta a las demás."
                    ),

                    text(
                        "lesson-048-responsibilities",
                        [
                            "PROBLEMA",
                            "",
                            "recibir un número",
                            "calcular su doble",
                            "mostrar el resultado",
                            "",
                            "        ↓",
                            "",
                            "POSIBLES RESPONSABILIDADES",
                            "",
                            "obtener el número",
                            "",
                            "calcular el doble",
                            "",
                            "mostrar el resultado"
                        ].join("\n"),
                        "Reconocer partes del problema",
                        "La descomposición comienza antes del código: primero se identifican responsabilidades que tienen sentido dentro de la solución."
                    ),

                    clrs(
                        "lesson-048-complete-subproblems",
                        [
                            "LEER_NUMERO()",
                            "    numero = 0",
                            "    leer numero",
                            "    retornar numero",
                            "",
                            "CALCULAR_DOBLE(valor)",
                            "    retornar valor * 2",
                            "",
                            "MOSTRAR_RESULTADO(valor)",
                            "    escribir valor",
                            "",
                            "PRINCIPAL()",
                            "    numero = LEER_NUMERO()",
                            "    resultado = CALCULAR_DOBLE(numero)",
                            "    MOSTRAR_RESULTADO(resultado)"
                        ].join("\n"),
                        "Coordinar varias responsabilidades",
                        "`PRINCIPAL` no realiza directamente todas las operaciones. Solicita cada responsabilidad y comunica los resultados necesarios entre ellas."
                    ),

                    clrs(
                        "lesson-048-smaller-decomposition",
                        [
                            "CALCULAR_DOBLE(valor)",
                            "    retornar valor * 2",
                            "",
                            "PRINCIPAL()",
                            "    numero = 0",
                            "    leer numero",
                            "",
                            "    resultado = CALCULAR_DOBLE(numero)",
                            "    escribir resultado"
                        ].join("\n"),
                        "Una descomposición más pequeña",
                        "Aquí solamente se separa el cálculo. La entrada y la salida continúan en `PRINCIPAL`. La solución sigue teniendo responsabilidades comprensibles sin crear funciones innecesarias."
                    ),
                ],

                knowledge: [
                    "analizar un problema completo para identificar responsabilidades",
                    "comprender un subproblema como una parte razonable del problema original",
                    "decidir qué responsabilidades conviene representar mediante funciones",
                    "representar subproblemas mediante funciones con propósitos claros",
                    "identificar qué información necesita cada responsabilidad",
                    "identificar qué resultado produce cada responsabilidad",
                    "coordinar varias funciones desde PRINCIPAL",
                    "comunicar información entre funciones mediante argumentos y retornos",
                    "comprender PRINCIPAL como coordinador de una solución procedimental",
                    "comprender que Entrada → Procesamiento → Salida no implica una función obligatoria por cada etapa",
                    "comprender que no existe una cantidad universalmente correcta de funciones",
                    "evitar dividir artificialmente una solución cuando la separación no aporta claridad"
                ],

                notes: [
                    callout(
                        "Descomposición como decisión de diseño",
                        "Dos soluciones correctas pueden dividir un mismo problema de manera diferente. En esta etapa no buscamos una única cantidad correcta de funciones, sino responsabilidades comprensibles que colaboren para satisfacer el mismo problema."
                    )
                ],

                recommendedTools: [
                    "code-diagram-navigation",
                    "call-stack"
                ],

                category: "FND-FUNC"
            }),
            lesson({
                order: 49,
                section: 8,
                title: "Primer prototipo algorítmico",

                objective:
                    "Diseñar e implementar una primera solución completa a partir de un problema, seleccionando y coordinando de manera autónoma las estructuras de programación previamente aprendidas.",

                problemStatement:
                    "Un programa debe analizar las calificaciones de un grupo y producir tres resultados: el promedio, la calificación más alta y cuántos estudiantes alcanzaron o superaron el promedio. El problema no indica qué ciclos, variables, funciones o estructuras deben utilizarse. ¿Cómo podemos pasar de los requisitos a una solución completa?",

                concepts: [
                    "prototipo algorítmico",
                    "solución integradora",
                    "selección de estructuras",
                    "coordinación de responsabilidades",
                    "comprobación de resultados"
                ],

                explanation: [
                    paragraph(
                        "Llegados a este punto ya conocemos las construcciones fundamentales necesarias para implementar soluciones de programación sencillas. En esta lección no aparecerá nueva sintaxis: el reto consiste en decidir qué conocimientos utilizar y cómo combinarlos a partir del problema."
                    ),

                    callout(
                        "El cambio de esta lección",
                        [
                            "ANTES",
                            "",
                            "la lección presentaba",
                            "una construcción nueva",
                            "",
                            "y aprendíamos",
                            "cómo utilizarla",
                            "",
                            "----------------",
                            "",
                            "AHORA",
                            "",
                            "recibimos un problema",
                            "",
                            "y debemos decidir:",
                            "",
                            "¿qué datos representar?",
                            "¿qué procesamiento realizar?",
                            "¿qué estructuras utilizar?",
                            "¿cómo organizar la solución?"
                        ].join("\n")
                    ),

                    paragraph(
                        "Podemos llamar prototipo algorítmico a una primera solución completa y ejecutable que representa los datos necesarios, realiza el procesamiento requerido y produce los resultados especificados."
                    ),

                    paragraph(
                        "En esta etapa no buscamos todavía estudiar formalmente propiedades, eficiencia o técnicas de diseño de algoritmos. Nos interesa construir correctamente una solución utilizando los fundamentos de programación adquiridos en la ruta."
                    ),

                    callout(
                        "Del problema a una primera solución",
                        [
                            "PROBLEMA",
                            "",
                            "        →",
                            "",
                            "identificar datos",
                            "",
                            "        →",
                            "",
                            "identificar resultados",
                            "",
                            "        →",
                            "",
                            "identificar responsabilidades",
                            "",
                            "        →",
                            "",
                            "seleccionar estructuras",
                            "",
                            "        →",
                            "",
                            "implementar",
                            "",
                            "        →",
                            "",
                            "comprobar resultados"
                        ].join("\n")
                    ),

                    paragraph(
                        "Consideremos un grupo de calificaciones. Necesitamos obtener tres resultados: el promedio del grupo, la calificación más alta y la cantidad de estudiantes cuya calificación es mayor o igual que el promedio."
                    ),

                    callout(
                        "Problema",
                        [
                            "DATOS",
                            "",
                            "varias calificaciones",
                            "",
                            "        →",
                            "",
                            "RESULTADOS",
                            "",
                            "promedio",
                            "",
                            "calificación mayor",
                            "",
                            "cantidad de notas",
                            "mayores o iguales",
                            "al promedio"
                        ].join("\n")
                    ),

                    paragraph(
                        "El primer paso no consiste en escribir inmediatamente un ciclo. Primero debemos reconocer qué información tenemos y qué resultados debemos producir."
                    ),

                    paragraph(
                        "Después podemos identificar responsabilidades dentro de la solución. En este problema necesitamos calcular el promedio, obtener el mayor valor y contar cuántas calificaciones satisfacen una condición."
                    ),

                    callout(
                        "Responsabilidades",
                        [
                            "CALIFICACIONES",
                            "       │",
                            "       ├── calcular promedio",
                            "       │",
                            "       ├── obtener mayor",
                            "       │",
                            "       └── contar notas",
                            "           >= promedio",
                            "",
                            "                →",
                            "",
                            "             RESULTADOS"
                        ].join("\n")
                    ),

                    paragraph(
                        "Ahora podemos preguntarnos qué conocimientos anteriores necesita cada responsabilidad. Esta vez las estructuras no aparecen porque la lección las exige, sino porque el problema les da un propósito."
                    ),

                    callout(
                        "Seleccionar estructuras por necesidad",
                        [
                            "CALCULAR PROMEDIO",
                            "",
                            "necesita:",
                            "recorrer valores",
                            "acumular una suma",
                            "obtener una cantidad",
                            "",
                            "        →",
                            "",
                            "arreglo + recorrido",
                            "+ acumulador + LONG",
                            "",
                            "----------------",
                            "",
                            "OBTENER MAYOR",
                            "",
                            "necesita:",
                            "recordar un candidato",
                            "comparar cada valor",
                            "",
                            "        →",
                            "",
                            "arreglo + recorrido",
                            "+ condición",
                            "",
                            "----------------",
                            "",
                            "CONTAR AL MENOS",
                            "",
                            "necesita:",
                            "examinar cada valor",
                            "evaluar una condición",
                            "conservar una cantidad",
                            "",
                            "        →",
                            "",
                            "arreglo + recorrido",
                            "+ condición + contador"
                        ].join("\n")
                    ),

                    paragraph(
                        "Las responsabilidades pueden representarse mediante funciones para que cada una reciba la información que necesita y produzca un resultado concreto."
                    ),

                    callout(
                        "Entradas y resultados de cada responsabilidad",
                        [
                            "CALCULAR_PROMEDIO",
                            "",
                            "recibe:",
                            "calificaciones",
                            "",
                            "retorna:",
                            "promedio",
                            "",
                            "----------------",
                            "",
                            "OBTENER_MAYOR",
                            "",
                            "recibe:",
                            "calificaciones",
                            "",
                            "retorna:",
                            "mayor",
                            "",
                            "----------------",
                            "",
                            "CONTAR_AL_MENOS",
                            "",
                            "recibe:",
                            "calificaciones",
                            "límite",
                            "",
                            "retorna:",
                            "cantidad"
                        ].join("\n")
                    ),

                    paragraph(
                        "`PRINCIPAL` puede preparar los datos, solicitar cada procesamiento y coordinar los resultados. De esta manera expresa la estructura general de la solución mientras las funciones contienen responsabilidades específicas."
                    ),


                    paragraph(
                        "En `OBTENER_MAYOR`, el primer elemento se utiliza inicialmente como candidato. Por eso el recorrido puede comenzar en el índice `1`: el elemento con índice `0` ya forma parte del estado inicial de la función."
                    ),

                    paragraph(
                        "Esta solución supone que el arreglo contiene al menos una calificación. Esa condición permite utilizar `A[0]` como valor inicial y calcular un promedio mediante `LONG(A)`."
                    ),

                    callout(
                        "Seguir los resultados",
                        [
                            "notas:",
                            "",
                            "80, 90, 70, 100",
                            "",
                            "----------------",
                            "",
                            "PROMEDIO",
                            "",
                            "80 + 90 + 70 + 100",
                            "= 340",
                            "",
                            "340 / 4",
                            "= 85",
                            "",
                            "----------------",
                            "",
                            "MAYOR",
                            "",
                            "100",
                            "",
                            "----------------",
                            "",
                            ">= 85",
                            "",
                            "80  → no",
                            "90  → sí",
                            "70  → no",
                            "100 → sí",
                            "",
                            "cantidad = 2"
                        ].join("\n")
                    ),

                    paragraph(
                        "La implementación no termina necesariamente cuando el código puede ejecutarse. También debemos comprobar si los resultados producidos corresponden con el problema que queríamos resolver."
                    ),

                    callout(
                        "Comprobar la solución",
                        [
                            "PROBLEMA",
                            "        →",
                            "SOLUCIÓN IMPLEMENTADA",
                            "        →",
                            "EJECUCIÓN",
                            "        →",
                            "RESULTADOS",
                            "        →",
                            "¿coinciden con",
                            "lo esperado?"
                        ].join("\n")
                    ),

                    paragraph(
                        "Podemos seguir valores intermedios, comparar resultados conocidos y utilizar casos pequeños cuyo resultado podamos determinar manualmente. En esta ruta nos interesa comprobar el comportamiento de la solución, no realizar todavía una demostración formal de corrección."
                    ),

                    paragraph(
                        "El aspecto más importante de esta lección es que las construcciones dejan de aparecer como temas independientes. Variables, expresiones, decisiones, iteraciones, funciones y colecciones colaboran porque el problema necesita distintos tipos de trabajo."
                    ),

                    paragraph(
                        "CLRS sirve para representar y ejecutar esa solución, pero el razonamiento aprendido es transferible: identificar datos, reconocer resultados, dividir responsabilidades, seleccionar herramientas y comprobar el comportamiento son capacidades que pueden aplicarse posteriormente en otros lenguajes."
                    ),

                    paragraph(
                        "La siguiente lección cerrará la ruta de Programación. Allí no aprenderemos otra construcción: revisaremos qué fundamentos hemos adquirido y cómo pueden transferirse a nuevos lenguajes, problemas y a la siguiente ruta de estudio."
                    )
                ],

                examples: [
                    text(
                        "lesson-049-problem",
                        [
                            "PROBLEMA",
                            "",
                            "Un grupo tiene",
                            "varias calificaciones.",
                            "",
                            "Obtener:",
                            "",
                            "• promedio",
                            "• calificación más alta",
                            "• cantidad de estudiantes",
                            "  con nota >= promedio"
                        ].join("\n"),
                        "Un problema sin estructuras prescritas",
                        "El enunciado especifica datos y resultados, pero la selección de estructuras forma parte de la construcción de la solución."
                    ),

                    text(
                        "lesson-049-decomposition",
                        [
                            "notas",
                            "  │",
                            "  ├── CALCULAR_PROMEDIO",
                            "  │          ↓",
                            "  │       promedio",
                            "  │",
                            "  ├── OBTENER_MAYOR",
                            "  │          ↓",
                            "  │        mayor",
                            "  │",
                            "  └── CONTAR_AL_MENOS",
                            "             │",
                            "             ├── notas",
                            "             ├── promedio",
                            "             ↓",
                            "         alcanzaron",
                            "",
                            "             ↓",
                            "",
                            "           SALIDA"
                        ].join("\n"),
                        "Coordinar responsabilidades",
                        "Las funciones reciben la información necesaria y sus resultados son coordinados para producir la salida final."
                    ),

                    clrs(
                        "lesson-049-complete-prototype",
                        [
                            "CALCULAR_PROMEDIO(A[])",
                            "    total = 0",
                            "",
                            "    para i = 0 hasta LONG(A) - 1",
                            "        total = total + A[i]",
                            "",
                            "    retornar total / LONG(A)",
                            "",
                            "OBTENER_MAYOR(A[])",
                            "    mayor = A[0]",
                            "",
                            "    para i = 1 hasta LONG(A) - 1",
                            "        si A[i] > mayor",
                            "            mayor = A[i]",
                            "",
                            "    retornar mayor",
                            "",
                            "CONTAR_AL_MENOS(A[], limite)",
                            "    cantidad = 0",
                            "",
                            "    para i = 0 hasta LONG(A) - 1",
                            "        si A[i] >= limite",
                            "            cantidad = cantidad + 1",
                            "",
                            "    retornar cantidad",
                            "",
                            "PRINCIPAL()",
                            "    notas[0] = 80",
                            "    notas[1] = 90",
                            "    notas[2] = 70",
                            "    notas[3] = 100",
                            "",
                            "    promedio = CALCULAR_PROMEDIO(notas)",
                            "    mayor = OBTENER_MAYOR(notas)",
                            "    alcanzaron = CONTAR_AL_MENOS(notas, promedio)",
                            "",
                            "    escribir promedio",
                            "    escribir mayor",
                            "    escribir alcanzaron"
                        ].join("\n"),
                        "Integrar los fundamentos",
                        "La salida es `85`, `100` y `2`. Cada resultado procede de una responsabilidad distinta coordinada dentro del mismo programa."
                    ),

                    text(
                        "lesson-049-trace",
                        [
                            "notas",
                            "80, 90, 70, 100",
                            "",
                            "CALCULAR_PROMEDIO",
                            "total = 340",
                            "promedio = 85",
                            "",
                            "OBTENER_MAYOR",
                            "mayor = 100",
                            "",
                            "CONTAR_AL_MENOS",
                            "",
                            "80 >= 85  → no",
                            "90 >= 85  → sí",
                            "70 >= 85  → no",
                            "100 >= 85 → sí",
                            "",
                            "alcanzaron = 2",
                            "",
                            "SALIDA",
                            "85",
                            "100",
                            "2"
                        ].join("\n"),
                        "Comprobar un caso conocido",
                        "Seguir los resultados parciales permite contrastar la ejecución con valores que podemos obtener manualmente."
                    ),

                    clrs(
                        "lesson-049-prototype",
                        [
                            "CALCULAR_PROMEDIO(A[])",
                            "    total = 0",
                            "",
                            "    para i = 0 hasta LONG(A) - 1",
                            "        total = total + A[i]",
                            "",
                            "    retornar total / LONG(A)",
                            "",
                            "OBTENER_MAYOR(A[])",
                            "    mayor = A[0]",
                            "",
                            "    para i = 1 hasta LONG(A) - 1",
                            "        si A[i] > mayor",
                            "            mayor = A[i]",
                            "",
                            "    retornar mayor",
                            "",
                            "CONTAR_AL_MENOS(A[], limite)",
                            "    cantidad = 0",
                            "",
                            "    para i = 0 hasta LONG(A) - 1",
                            "        si A[i] >= limite",
                            "            cantidad = cantidad + 1",
                            "",
                            "    retornar cantidad",
                            "",
                            "PRINCIPAL()",
                            "    notas[0] = 80",
                            "    notas[1] = 90",
                            "    notas[2] = 70",
                            "    notas[3] = 100",
                            "",
                            "    promedio = CALCULAR_PROMEDIO(notas)",
                            "    mayor = OBTENER_MAYOR(notas)",
                            "    alcanzaron = CONTAR_AL_MENOS(notas, promedio)",
                            "",
                            "    escribir promedio",
                            "    escribir mayor",
                            "    escribir alcanzaron"
                        ].join("\n"),
                        "Primer prototipo completo",
                        "La solución combina arreglos, recorridos, un acumulador, comparaciones, un contador, parámetros, retornos y coordinación mediante `PRINCIPAL`."
                    ),
                ],

                knowledge: [
                    "construir una primera solución completa sin recibir de antemano las estructuras que deben utilizarse",
                    "analizar un problema antes de comenzar su implementación",
                    "identificar los datos disponibles y los resultados requeridos",
                    "identificar responsabilidades dentro de una solución integradora",
                    "seleccionar estructuras previamente aprendidas según las necesidades del problema",
                    "combinar arreglos con recorridos",
                    "combinar recorridos con condiciones",
                    "utilizar acumuladores dentro de una solución completa",
                    "utilizar contadores dentro de una solución completa",
                    "procesar colecciones mediante funciones",
                    "coordinar varias responsabilidades desde PRINCIPAL",
                    "relacionar resultados de una función con entradas necesarias para otra",
                    "comprobar resultados intermedios y finales mediante casos conocidos",
                    "integrar los fundamentos de programación aprendidos durante la ruta"
                ],

                notes: [
                    callout(
                        "Prototipo no significa solución definitiva",
                        "En esta lección utilizamos «prototipo algorítmico» para describir una primera solución completa y ejecutable. El estudio formal de algoritmos, su análisis, corrección y técnicas de diseño pertenece a la ruta de Algoritmia."
                    ),

                    callout(
                        "Precondición del ejemplo",
                        "Las funciones del ejemplo reciben un arreglo con al menos una calificación. Esto permite utilizar el primer elemento como candidato inicial del mayor y dividir la suma entre una longitud mayor que cero."
                    )
                ],

                recommendedTools: [
                    "execution-trace",
                    "debugger",
                    "code-diagram-navigation"
                ],

                category: "FND-COLLECTION"
            }),
            lesson({
                order: 50,
                section: 8,
                title: "Tu siguiente paso como programador",

                objective:
                    "Reconocer los fundamentos de programación adquiridos, distinguir los conceptos transferibles de la sintaxis particular de CLRS y comprender cómo continuar el aprendizaje hacia otros lenguajes y hacia la ruta de Algoritmia.",

                problemStatement:
                    "Después de aprender programación mediante CLRS, queremos comenzar a trabajar con otros lenguajes y problemas. Si la sintaxis cambia, ¿qué parte de lo aprendido sigue siendo útil y cómo podemos reutilizar esos conocimientos en un nuevo contexto?",

                concepts: [
                    "transferencia de conocimientos",
                    "concepto",
                    "sintaxis",
                    "fundamentos de programación",
                    "continuidad del aprendizaje"
                ],

                explanation: [
                    paragraph(
                        "Has llegado al final de la ruta de Programación. Durante el recorrido pasaste de expresar instrucciones muy sencillas a construir soluciones completas mediante datos, expresiones, decisiones, iteraciones, funciones y colecciones."
                    ),

                    callout(
                        "Ruta de Programación completada",
                        [
                            "FUNDAMENTOS DE PROGRAMACIÓN",
                            "",
                            "✓ código fuente y ejecución",
                            "✓ datos, valores y variables",
                            "✓ estado y tipos de datos",
                            "✓ cadenas",
                            "✓ expresiones y operadores",
                            "✓ comparaciones y condiciones",
                            "✓ decisiones",
                            "✓ ciclos",
                            "✓ contadores y acumuladores",
                            "✓ funciones",
                            "✓ parámetros y retornos",
                            "✓ ámbito",
                            "✓ arreglos y recorridos",
                            "✓ matrices",
                            "✓ descomposición",
                            "✓ soluciones integradoras"
                        ].join("\n")
                    ),

                    paragraph(
                        "CLRS ha sido el lenguaje utilizado para representar y practicar estos conocimientos. Sin embargo, aprender programación no consiste únicamente en memorizar cómo se escribe una instrucción concreta."
                    ),

                    callout(
                        "El problema ahora es la transferencia",
                        [
                            "Sabes representar:",
                            "",
                            "variables",
                            "condiciones",
                            "ciclos",
                            "funciones",
                            "colecciones",
                            "",
                            "        →",
                            "",
                            "Cambias de lenguaje",
                            "",
                            "        →",
                            "",
                            "la sintaxis cambia",
                            "",
                            "pero muchas ideas",
                            "continúan existiendo"
                        ].join("\n")
                    ),

                    paragraph(
                        "Podemos distinguir entre el concepto que queremos representar y la sintaxis concreta utilizada por un lenguaje para expresarlo."
                    ),

                    callout(
                        "Concepto y sintaxis",
                        [
                            "CONCEPTO",
                            "",
                            "tomar una decisión",
                            "",
                            "        →",
                            "",
                            "CLRS",
                            "",
                            "si condicion",
                            "    instrucciones",
                            "",
                            "        →",
                            "",
                            "OTRO LENGUAJE",
                            "",
                            "la escritura puede cambiar",
                            "",
                            "pero continúa existiendo",
                            "la idea de selección"
                        ].join("\n")
                    ),

                    paragraph(
                        "Lo mismo ocurre con muchas otras construcciones. Un lenguaje puede utilizar reglas diferentes para declarar variables, representar tipos, escribir ciclos, definir funciones o trabajar con colecciones, pero reconocer primero el concepto facilita aprender su nueva representación."
                    ),

                    callout(
                        "Lo que se transfiere",
                        [
                            "variable",
                            "→ conservar información",
                            "",
                            "condición",
                            "→ decidir según una expresión lógica",
                            "",
                            "ciclo",
                            "→ repetir un procesamiento",
                            "",
                            "función",
                            "→ representar una responsabilidad",
                            "",
                            "colección",
                            "→ organizar varios datos",
                            "",
                            "descomposición",
                            "→ dividir un problema",
                            "  en partes manejables"
                        ].join("\n")
                    ),

                    paragraph(
                        "Por ello, aprender un nuevo lenguaje no significa comenzar nuevamente desde cero. Tendrás que aprender sus reglas particulares, su sintaxis, sus bibliotecas y sus herramientas, pero muchos de los problemas conceptuales ya te resultarán familiares."
                    ),

                    callout(
                        "Transferir un conocimiento",
                        [
                            "1. reconocer el concepto",
                            "",
                            "        →",
                            "",
                            "2. descubrir cómo lo representa",
                            "   el nuevo lenguaje",
                            "",
                            "        →",
                            "",
                            "3. practicar sus reglas",
                            "   particulares",
                            "",
                            "        →",
                            "",
                            "4. reutilizar el",
                            "   razonamiento aprendido"
                        ].join("\n")
                    ),

                    paragraph(
                        "Por ejemplo, si necesitas repetir una operación cinco veces en un nuevo lenguaje, la primera pregunta no tiene que ser qué palabra exacta debes escribir. Primero puedes reconocer que necesitas una estructura de repetición y después aprender cómo ese lenguaje la representa."
                    ),

                    callout(
                        "Una pregunta más útil",
                        [
                            "No solamente:",
                            "",
                            "«¿cómo escribo esto",
                            "en otro lenguaje?»",
                            "",
                            "sino:",
                            "",
                            "«¿qué concepto necesito",
                            "representar?»",
                            "",
                            "        →",
                            "",
                            "«¿cómo representa",
                            "este lenguaje",
                            "ese concepto?»"
                        ].join("\n")
                    ),

                    paragraph(
                        "También es importante reconocer qué conocimientos pertenecen específicamente a CLRS. Nombres como `escribir`, `leer`, `LONG`, `AGREGA` o la forma concreta de escribir una función son decisiones del lenguaje y no deben suponerse iguales en otros entornos."
                    ),

                    callout(
                        "Permanece y cambia",
                        [
                            "PERMANECE",
                            "",
                            "la necesidad de:",
                            "",
                            "recibir datos",
                            "representar estado",
                            "decidir",
                            "repetir",
                            "organizar datos",
                            "dividir responsabilidades",
                            "",
                            "----------------",
                            "",
                            "PUEDE CAMBIAR",
                            "",
                            "sintaxis",
                            "palabras reservadas",
                            "bibliotecas",
                            "sistema de tipos",
                            "herramientas",
                            "reglas particulares"
                        ].join("\n")
                    ),

                    paragraph(
                        "Terminar esta ruta tampoco significa haber terminado de aprender programación. Significa que ahora posees una base sobre la que pueden construirse conocimientos más especializados."
                    ),

                    paragraph(
                        "Dentro de BROKER, la ruta de Algoritmia continúa desde otro ángulo. Programación se concentró principalmente en cómo representar y ejecutar soluciones; Algoritmia profundizará en cómo formular problemas computacionales, construir algoritmos, analizarlos y justificar sus propiedades."
                    ),

                    callout(
                        "Programación y Algoritmia",
                        [
                            "PROGRAMACIÓN",
                            "",
                            "¿cómo represento",
                            "y ejecuto una solución?",
                            "",
                            "        →",
                            "",
                            "base adquirida",
                            "",
                            "        →",
                            "",
                            "ALGORITMIA",
                            "",
                            "¿cómo construyo, analizo",
                            "y justifico algoritmos?"
                        ].join("\n")
                    ),

                    paragraph(
                        "La ruta de Algoritmia será independiente en su numeración y progreso, aunque utilizará Programación como conocimiento previo. No continúa porque falte aprender a programar, sino porque ahora podemos estudiar con mayor profundidad el razonamiento algorítmico."
                    ),

                    paragraph(
                        "Aprender otro lenguaje constituye otra dirección posible de transferencia. Python, JavaScript, C#, Java, C y otros lenguajes permiten volver a encontrar muchos de los fundamentos estudiados aquí bajo reglas y sintaxis diferentes."
                    ),

                    paragraph(
                        "También existen otras áreas posteriores: estructuras de datos, archivos, desarrollo de aplicaciones y diferentes paradigmas de programación. Ninguna de estas menciones implica que exista una única secuencia universal que deba seguirse después de esta ruta."
                    ),

                    callout(
                        "Desde esta base pueden abrirse varias direcciones",
                        [
                            "FUNDAMENTOS DE PROGRAMACIÓN",
                            "",
                            "        ├── Algoritmia",
                            "        │",
                            "        ├── otro lenguaje",
                            "        │",
                            "        ├── estructuras de datos",
                            "        │",
                            "        ├── archivos y persistencia",
                            "        │",
                            "        ├── desarrollo de aplicaciones",
                            "        │",
                            "        └── otros paradigmas",
                            "",
                            "No existe una sola",
                            "continuación obligatoria."
                        ].join("\n")
                    ),

                    paragraph(
                        "Los paradigmas orientado a objetos, funcional, concurrente, orientado a eventos y otros enfoques reorganizan o amplían la manera de construir programas. No representan necesariamente niveles superiores entre sí ni sustituyen los fundamentos aprendidos; simplemente introducen otros modelos y herramientas."
                    ),

                    paragraph(
                        "La capacidad más importante que puedes llevarte de esta ruta no es recordar todas las instrucciones de CLRS. Es reconocer problemas de programación y disponer de un conjunto inicial de ideas para representar datos, transformar información, controlar la ejecución y organizar una solución."
                    ),

                    callout(
                        "De instrucciones aisladas a soluciones",
                        [
                            "al inicio",
                            "",
                            "escribir una instrucción",
                            "",
                            "        →",
                            "",
                            "representar datos",
                            "",
                            "        →",
                            "",
                            "transformarlos",
                            "",
                            "        →",
                            "",
                            "decidir y repetir",
                            "",
                            "        →",
                            "",
                            "organizar funciones",
                            "y colecciones",
                            "",
                            "        →",
                            "",
                            "combinar conocimientos",
                            "",
                            "        →",
                            "",
                            "resolver un problema completo"
                        ].join("\n")
                    ),

                    paragraph(
                        "Completar la ruta significa que ya puedes continuar aprendiendo desde una base conceptual más sólida. El lenguaje, las herramientas y los problemas cambiarán; los fundamentos adquiridos servirán para reconocer muchas de las ideas que encontrarás después."
                    )
                ],

                examples: [
                    text(
                        "lesson-050-transfer",
                        [
                            "LO QUE QUIERES HACER",
                            "",
                            "repetir una operación",
                            "",
                            "        ↓",
                            "",
                            "CONCEPTO",
                            "",
                            "iteración",
                            "",
                            "        ↓",
                            "",
                            "CLRS",
                            "",
                            "para / mientras",
                            "",
                            "        ↓",
                            "",
                            "NUEVO LENGUAJE",
                            "",
                            "buscar cómo representa",
                            "la iteración"
                        ].join("\n"),
                        "Transferir el concepto antes que la sintaxis",
                        "Reconocer primero la necesidad conceptual permite aprender después la representación particular utilizada por otro lenguaje."
                    ),

                    text(
                        "lesson-050-known-concepts",
                        [
                            "YA CONOCES",
                            "",
                            "datos",
                            "variables",
                            "estado",
                            "expresiones",
                            "condiciones",
                            "iteraciones",
                            "funciones",
                            "colecciones",
                            "descomposición",
                            "",
                            "        ↓",
                            "",
                            "NUEVO CONTEXTO",
                            "",
                            "nuevas reglas",
                            "nueva sintaxis",
                            "nuevas herramientas",
                            "",
                            "        ↓",
                            "",
                            "TRANSFERENCIA"
                        ].join("\n"),
                        "Cambiar de contexto sin empezar desde cero",
                        "La nueva tecnología requiere aprendizaje adicional, pero muchos de los modelos mentales fundamentales ya existen."
                    ),

                    text(
                        "lesson-050-programming-algorithms",
                        [
                            "PROGRAMACIÓN",
                            "",
                            "representar",
                            "ejecutar",
                            "combinar",
                            "organizar",
                            "",
                            "        ↓",
                            "",
                            "BASE",
                            "",
                            "        ↓",
                            "",
                            "ALGORITMIA",
                            "",
                            "formular problemas",
                            "construir algoritmos",
                            "seguirlos",
                            "analizarlos",
                            "justificarlos",
                            "diseñarlos"
                        ].join("\n"),
                        "El siguiente cambio de perspectiva",
                        "Algoritmia utiliza los fundamentos de programación como requisito previo, pero constituye una ruta independiente con sus propios objetivos y progresión."
                    ),

                    text(
                        "lesson-050-next-directions",
                        [
                            "FUNDAMENTOS DE PROGRAMACIÓN",
                            "",
                            "        ↓",
                            "",
                            "una base común",
                            "",
                            "        ↓",
                            "",
                            "┌─────────────────────────┐",
                            "│ Algoritmia              │",
                            "│ otros lenguajes         │",
                            "│ estructuras de datos    │",
                            "│ archivos                │",
                            "│ aplicaciones            │",
                            "│ nuevos paradigmas       │",
                            "└─────────────────────────┘"
                        ].join("\n"),
                        "El aprendizaje continúa en varias direcciones",
                        "La ruta completada no prescribe una única continuación; proporciona conocimientos que pueden reutilizarse en distintos caminos posteriores."
                    )
                ],

                knowledge: [
                    "reconocer los principales fundamentos de programación adquiridos durante la ruta",
                    "distinguir un concepto de programación de la sintaxis utilizada para representarlo",
                    "comprender que muchos fundamentos pueden transferirse entre lenguajes",
                    "comprender que aprender otro lenguaje no implica comenzar conceptualmente desde cero",
                    "identificar qué conocimientos pertenecen específicamente a la sintaxis y biblioteca de CLRS",
                    "utilizar conceptos conocidos como punto de partida para aprender nuevas representaciones",
                    "comprender que Programación constituye una base previa para la ruta independiente de Algoritmia",
                    "distinguir el objetivo general de Programación del objetivo posterior de Algoritmia",
                    "reconocer que existen múltiples direcciones posibles para continuar el aprendizaje",
                    "comprender que otros paradigmas no forman necesariamente una jerarquía de dificultad o superioridad",
                    "comprender que completar una ruta fundamental constituye un punto de partida para aprendizajes posteriores"
                ],

                notes: [
                    callout(
                        "Transferencia no significa equivalencia",
                        "Los lenguajes pueden diferir profundamente en sintaxis, tipos, bibliotecas, modelos de ejecución y reglas semánticas. Transferir conocimientos significa reconocer ideas comunes y aprender cómo las representa cada lenguaje, no asumir que todos funcionan de la misma manera."
                    ),

                    callout(
                        "Algoritmia es una ruta independiente",
                        "Programación funciona como requisito previo conceptual para Algoritmia, pero ambas rutas mantienen su propia numeración, secciones, progreso y objetivos de aprendizaje."
                    ),

                    callout(
                        "Otros paradigmas",
                        "La programación orientada a objetos, funcional, concurrente, orientada a eventos y otros paradigmas se mencionan únicamente como posibles líneas de aprendizaje posterior. Esta lección no los enseña ni establece una jerarquía entre ellos."
                    )
                ],

                category: "FND-COLLECTION"
            })
        ])
    });

function section(
    order,
    title,
    description,
    firstLesson,
    lastLesson
) {
    return Object.freeze({
        id: canonicalId("section", order),
        order,
        title,
        description,
        lessonIds: Object.freeze(
            Array.from(
                {
                    length:
                        lastLesson -
                        firstLesson +
                        1
                },
                (_, index) => canonicalId(
                    "lesson",
                    firstLesson + index
                )
            )
        )
    });
}

function lesson({
    order,
    section: sectionOrder,
    title,
    objective,
    problemStatement = null,
    concepts = [],
    explanation,
    examples,
    knowledge,
    notes = [],
    recommendedTools = [],
    category
}) {
    return Object.freeze({
        id: canonicalId("lesson", order),
        sectionId: canonicalId(
            "section",
            sectionOrder
        ),
        order,
        title,
        objective,
        problemStatement,
        concepts: Object.freeze(concepts),
        expectedContract:
            EXPECTED_CONTRACTS[order - 1],
        explanation: Object.freeze(explanation),
        examples: Object.freeze(examples),
        introducedKnowledge:
            Object.freeze(knowledge),
        comparativeNotes: Object.freeze(notes),
        recommendedTools:
            Object.freeze(recommendedTools),
        familyId: FND,
        categoryId: category,
        baseReward: REWARDS[order - 1]
    });
}

function paragraph(textValue) {
    return Object.freeze({
        kind:
            BrokerLearningContentBlockKind
                .PARAGRAPH,
        text: textValue
    });
}

function list(items) {
    return Object.freeze({
        kind:
            BrokerLearningContentBlockKind.LIST,
        items: Object.freeze(items)
    });
}

function callout(title, textValue) {
    return Object.freeze({
        kind:
            BrokerLearningContentBlockKind.CALLOUT,
        title,
        text: textValue
    });
}

function clrs(
    id,
    content,
    title = null,
    explanation = null
) {
    return example(
        id,
        BrokerLearningExampleLanguage.CLRS,
        content,
        title,
        explanation
    );
}

function text(
    id,
    content,
    title = null,
    explanation = null
) {
    return example(
        id,
        BrokerLearningExampleLanguage.TEXT,
        content,
        title,
        explanation
    );
}

function example(
    id,
    language,
    content,
    title,
    explanation
) {
    return Object.freeze({
        id,
        language,
        content,
        ...(title == null ? {} : { title }),
        ...(explanation == null
            ? {}
            : { explanation })
    });
}

function canonicalId(prefix, order) {
    return `${prefix}-${String(order).padStart(
        3,
        "0"
    )}`;
}
