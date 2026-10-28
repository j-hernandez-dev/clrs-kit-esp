---
name: "Lenguaje CLRS Español"
description: "Sintaxis, semántica y bibliotecas públicas de CLRS Kit Español."
applyTo: "**/*.clrs"
---

# Especificación de CLRS para asistentes de IA

## Identidad de CLRS

CLRS es el lenguaje educativo en español implementado por CLRS Kit Español.
Cuando trabajes con un archivo `.clrs`, conserva CLRS: no lo conviertas a
JavaScript, Python, C#, Java, Pascal ni a otro pseudocódigo, salvo que el
usuario lo solicite expresamente. La sintaxis descrita aquí es normativa para
la asistencia de IA y procede de la implementación y las pruebas de CLRS Kit.

## Reglas fundamentales

- Una instrucción se escribe sin punto y coma.
- Los bloques se delimitan mediante sangría, normalmente cuatro espacios. No
  se escriben palabras de cierre.
- Una línea puede contener un comentario iniciado por `//`.
- Los identificadores comienzan con una letra ASCII o `_` y continúan con
  letras ASCII, dígitos o `_`. Los nombres distinguen mayúsculas de minúsculas.
- Las palabras de control y E/S son minúsculas: `si`, `sino`, `mientras`,
  `para`, `hasta`, `bajando`, `retornar`, `leer`, `escribir`, `y`, `o`, `no`.
- Los literales lógicos y nulo son exactamente `VERDAD`, `FALSO` y `NULO`.
- Las funciones estándar y GUI usan sus nombres públicos en mayúsculas.
- No inventes declaraciones de tipos, llaves, dos puntos de bloque, palabras
  de inicio/fin ni terminadores de sentencia.

## Valores y literales

CLRS admite números enteros y decimales (`12`, `3.5`), notación científica
(`1e3`, `2.5E-2`), cadenas entre comillas dobles, lógicos (`VERDAD`, `FALSO`),
`NULO` y arreglos (`[]`, `[1, 2]`, `[[1, 2], [3, 4]]`). En cadenas están
definidos los escapes `\n`, `\t`, `\"`, `\r` y `\b`.

No uses `NULL`, `null`, `nil`, `NIL`, `verdadero` ni `falso` como sustitutos.

## Variables

La asignación usa `=` y crea o actualiza una variable; no existe una palabra
para declararla ni una anotación de tipo:

```clrs
nombre = NULO
contador = 0
activo = VERDAD
```

Una variable debe estar definida antes de leerse. También se puede asignar a
un elemento: `datos[i] = valor` o `matriz[fila][columna] = valor`.

## Entrada y salida

`escribir` recibe una o más expresiones separadas por comas. `leer` recibe uno
o más destinos existentes, también separados por comas.

```clrs
nombre = NULO
edad = NULO
escribir "Ingresa nombre y edad:"
leer nombre, edad
escribir "Hola ", nombre
```

No uses `WRITE`, `PRINT`, `READ`, `INPUT` ni paréntesis de llamada para estas
dos instrucciones.

## Operadores

- Aritméticos: `+`, `-`, `*`, `/`, `%`, `^`.
- Comparación: `==`, `!=`, `<`, `>`, `<=`, `>=`.
- Lógicos: `y`, `o`, `no`.
- Agrupación: `(expresión)`.

`=` asigna; `==` compara igualdad. No uses `&&`, `||`, `!`, `<>`, `:=` ni
`<-` en código CLRS.

## Condicionales

```clrs
si edad >= 18
    escribir "Mayor de edad"
sino si edad >= 13
    escribir "Adolescente"
sino
    escribir "Menor de edad"
```

No se escribe `entonces`, `endif`, `fin si`, llaves ni palabras equivalentes.

## Ciclos

```clrs
mientras contador < 3
    escribir contador
    contador = contador + 1

para i = 0 hasta 4
    escribir i

para i = 4 bajando 0
    escribir i
```

Los límites de `para` son inclusivos en la ejecución actual. No agregues
`paso`, `hacer`, `do`, `end while`, `fin para`, `break` ni `continue`.

## Arreglos

Los literales usan corchetes y comas. Se permiten arreglos vacíos, expresiones
como elementos y arreglos anidados; no se permite una coma final.

```clrs
datos = [10, 20, 30]
datos[1] = 25
matriz = [[1, 2], [3, 4]]
escribir matriz[1][0]
```

Los índices públicos de arreglos y de la GUI comienzan en cero. En parámetros
de función, `datos[]` declara una dimensión y `matriz[][]` dos dimensiones.

## Funciones y `PRINCIPAL`

Una declaración es un encabezado `NOMBRE(parámetros)` seguido de un bloque
sangrado. No usa las palabras `funcion` o `procedimiento`. Una llamada usa el
mismo nombre con argumentos, sin `CALL`.

```clrs
SUMAR(a, b)
    retornar a + b

TOTAL(datos[])
    retornar SUM(datos)

resultado = SUMAR(2, 3)
```

`retornar` sólo es válido dentro de una función y siempre lleva una expresión.
Los nombres de función no se pueden declarar dos veces y los parámetros de una
misma función no pueden repetirse. Las llamadas deben referirse a una función
de usuario o estándar existente.

La función de entrada reconocida es exactamente `PRINCIPAL`. CLRS Kit la
invoca automáticamente; no escribas una segunda llamada manual sólo para
iniciar el programa.

```clrs
PRINCIPAL()
    escribir "Hola"
```

CLRS también permite instrucciones globales. Conserva la organización elegida
por el programa existente y no introduzcas `PRINCIPAL` si no hace falta para
la corrección solicitada.

## Biblioteca estándar

Usa solamente nombres y cantidades de argumentos documentados. Funciones
principales disponibles, agrupadas por dominio:

- Archivos: `LEER_ARCHIVO(ruta)`, `EXISTE_ARCHIVO(ruta)`,
  `PESO_ARCHIVO(ruta)`, `CREAR_ARCHIVO(ruta)`,
  `ESCRIBIR_ARCHIVO(ruta, contenido)`, `ELIMINAR_ARCHIVO(ruta)`.
- Matemáticas: `ABS(numero)`, `MIN(a, b)`, `MAX(a, b)`,
  `REDONDEA(numero)`, `PISO(numero)`, `RAIZ(numero)`, `RAIZCUB(numero)`,
  `EXP(numero)`, `LOGN(numero)`, `LOG10(numero)`, `LOG2(numero)`,
  `SEN(radianes)`, `COS(radianes)`, `TAN(radianes)`, `ARC(numero)`,
  `ARCOCOS(numero)`, `RAD(grados)`, `GRAD(radianes)`, `PI()`, `E()`,
  `ALEAT(minimo, maximo)`, `PROM(arreglo)`, `SUM(arreglo)`,
  `MED(arreglo)`, `VAR(arreglo)`.
- Cadenas: `LONG(estructura)`, `CAR_EN(cadena, posicion)`,
  `SUBCAD(cadena, inicio, fin)`, `MAYUS(cadena)`, `MINUS(cadena)`,
  `RECORTA(cadena)`, `REEMP(cadena, viejo, nuevo)`,
  `DIV(cadena, separador)`, `ES_CAD_NUM(cadena)`, `ES_VAC(cadena)`,
  `EMP_CON(cadena, texto)`, `TERM_CON(cadena, texto)`.
- Arreglos: `AGREGA(arreglo, valor)`, `ELIM(arreglo, indice)`,
  `INSER(arreglo, indice, valor)`, `INDICE(arreglo, valor)`,
  `CONT(arreglo, valor)`, `ORDENA(arreglo)`, `INVER(arreglo)`,
  `COPIA(arreglo)`, `UNE(arreglo, separador)`.
- Tipos: `ES_NUM(valor)`, `ES_CAD(valor)`, `ES_LOG(valor)`,
  `A_NUM(valor)`, `A_CAD(valor)`, `A_LOG(valor)`.
- Error explícito: `LANZAR_ERROR(mensaje)`.

No inventes variantes traducidas como `LENGTH`, `RANDOM`, `PUSH` o `THROW`.

## Biblioteca gráfica pública

La GUI es procedural. Cada factory registra un componente bajo un identificador
de cadena único y no expone objetos GTK. Existen exactamente estas 24 factories:

- Ventanas y texto: `VENTANA(id, titulo)`,
  `VENTANA_APLICACION(id, titulo)`, `ETIQUETA(id, texto)`, `ENTRADA(id)`,
  `ENTRADA_CONTRASENA(id)`, `AREA_TEXTO(id)`.
- Controles: `BOTON(id, texto)`, `CASILLA(id, texto)`,
  `BOTON_ALTERNABLE(id, texto)`, `BOTON_ENLACE(id, uri, texto)`,
  `ENTRADA_NUMERICA(id, minimo, maximo, paso)`,
  `DESLIZADOR(id, orientacion, minimo, maximo, paso)`,
  `BARRA_PROGRESO(id)`, `INDICADOR_CARGA(id)`,
  `LISTA_DESPLEGABLE(id, opciones)`, `CALENDARIO(id)`, `IMAGEN(id, archivo)`.
- Contenedores y datos: `CAJA(id, orientacion, separacion)`,
  `CUADRICULA(id)`, `CONTENEDOR_DESPLAZABLE(id)`, `LISTA_VISUAL(id)`,
  `VISTA_COLUMNAS(id, columnas)`.
- Diálogos: `DIALOGO_ALERTA(id, mensaje)`, `DIALOGO_ARCHIVO(id)`.

Funciones generales: `ESTABLECER(componente, propiedad, dato)`,
`OBTENER(componente, propiedad)` y `CONECTAR(componente, evento, FUNCION)`.
El tercer argumento de `CONECTAR` es el identificador de una función CLRS, no
una cadena. El callback recibe primero el id público del componente.

Acciones públicas: `MOSTRAR`, `OCULTAR`, `ENFOCAR`, `CONTENER`, `QUITAR`,
`ANEXAR`, `PREPONER`, `COLOCAR`, `CERRAR`, `MAXIMIZAR`, `MINIMIZAR`,
`PANTALLA_COMPLETA`, `RESTAURAR`, `PULSAR_PROGRESO`, `INICIAR`, `PARAR`,
`MARCAR_DIA`, `DESMARCAR_DIA`, `LIMPIAR_MARCAS`, `LIMPIAR_IMAGEN`,
`ANEXAR_FILA`, `QUITAR_FILA`, `LIMPIAR_FILAS`, `MOSTRAR_ALERTA`,
`ELEGIR_ALERTA`, `ABRIR_ARCHIVO`, `ABRIR_ARCHIVOS`, `GUARDAR_ARCHIVO`,
`ELEGIR_CARPETA` y `ELEGIR_CARPETAS`. Cada acción comienza con el id del
componente; las acciones de diálogo reciben después la ventana padre o `NULO`.

Temas: `ESTABLECER_TEMA(nombre)`, `OBTENER_TEMA()`,
`ESTABLECER_MODO_TEMA(modo)` y `OBTENER_MODO_TEMA()`. Los modos son
`"sistema"`, `"claro"` y `"oscuro"`.

Eventos catalogados incluyen `clic`, `activar`, `cambio`, `alternado`,
`cerrar`, `valor_cambiado`, `seleccion_cambiada`, `fecha_cambiada`,
`fila_activada`, eventos de puntero y teclado. No inventes señales GTK ni
accedas a propiedades nativas: usa sólo nombres públicos de CLRS mediante
`ESTABLECER`, `OBTENER` y `CONECTAR`.

Ejemplo GUI válido:

```clrs
AL_PULSAR(componente)
    ESTABLECER("mensaje", "texto", "¡Hola desde CLRS!")

PRINCIPAL()
    VENTANA("ventana", "Ejemplo")
    CAJA("contenido", "vertical", 8)
    ETIQUETA("mensaje", "Pulsa el botón")
    BOTON("saludar", "Saludar")
    ANEXAR("contenido", "mensaje")
    ANEXAR("contenido", "saludar")
    CONTENER("ventana", "contenido")
    CONECTAR("saludar", "clic", AL_PULSAR)
    MOSTRAR("ventana")
```

`VIDEO` no forma parte de la API pública de CLRS.

## Corrección de errores

Cuando se solicite corregir un archivo CLRS:

1. Atiende primero el diagnóstico concreto y su ubicación.
2. Realiza el cambio mínimo que lo resuelva y conserva la intención original.
3. No reestructures código válido no relacionado.
4. Conserva nombres, comentarios, orden y estilo que no causen el problema.
5. Usa exclusivamente construcciones válidas de esta especificación.
6. No ocultes un error eliminando funcionalidad solicitada.
7. Si falta contexto para decidir entre correcciones distintas, pregunta.

Ejemplo: ante `nombre = NUL`, corrige sólo el literal:

```clrs
nombre = NULO
```

No cambies por ello la E/S, las funciones ni la estructura del programa.

## Sintaxis que no pertenece a CLRS

No generes ni recomiendes como CLRS:

```text
PROCEDURE        END PROCEDURE
FUNCTION         END FUNCTION
CALL             WRITE             READ
NIL              NULL              BEGIN             END
THEN             ENDIF             WEND
var              let               const
{ }              ;                 :=                <-
```

Tampoco uses imports, clases, tipos, promesas, `async`/`await`, APIs de Node.js
ni nombres `Gtk.*` dentro del código CLRS.

## Ejemplo completo válido

```clrs
PROMEDIO(datos[])
    retornar SUM(datos) / LONG(datos)

PRINCIPAL()
    valores = [8, 9, 10]
    resultado = PROMEDIO(valores)
    si resultado >= 9
        escribir "Promedio alto: ", resultado
    sino
        escribir "Promedio: ", resultado
```
