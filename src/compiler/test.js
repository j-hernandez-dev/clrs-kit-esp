import { build } from "../../flow/src/visitor/DiagramVisitor.js";
import { parserCode, tokenizeCode } from "./Pipeline.js";

const code = `
hola <- "holaa"
escribir hola

ES_APROBADO(calificacion)
    si calificacion >= 70
        retornar VERDAD
    sino
        retornar FALSO

PROMEDIO(a, b, c)
    retornar (a + b + c) / 3

MOSTRAR_CALIFICACIONES(calificaciones[])
    escribir "Calificaciones capturadas:"

    para i <- 0 hasta 2
        escribir "Materia ", i + 1, ": ", calificaciones[i]

PRINCIPAL()
    escribir "=== Sistema de calificaciones ==="

    escribir "Nombre del alumno:"
    leer nombre

    escribir "Calificación 1:"
    leer calificaciones[0]

    escribir "Calificación 2:"
    leer calificaciones[1]

    escribir "Calificación 3:"
    leer calificaciones[2]

    promedio <- PROMEDIO(calificaciones[0], calificaciones[1], calificaciones[2])

    escribir "Alumno: ", nombre

    MOSTRAR_CALIFICACIONES(calificaciones)

    escribir "Promedio: ", promedio

    si ES_APROBADO(promedio)
        escribir "Resultado: APROBADO"
    sino
        escribir "Resultado: REPROBADO"

    escribir "Buscando la primera calificación menor a 70..."

    indice <- 0

    mientras indice < 3
        si calificaciones[indice] < 70
            escribir "Encontrada en la posición ", indice
            escribir "Valor: ", calificaciones[indice]
            indice <- 3
        sino
            indice <- indice + 1

    escribir "Resumen de materias:"

    para i <- 0 hasta 2
        escribir "Materia ", i + 1

    escribir "Cuenta regresiva para finalizar:"

    para i <- 3 bajando 1
        escribir i

    escribir "Fin del programa."
`;

const tokens = tokenizeCode(code);

const ast = parserCode(tokens);

const diagram = build(ast);