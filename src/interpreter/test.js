import { run } from "./Runtime.js"

let source = `
// Comentario simple

variable1 <- 10
variable2 <- "texto"
variable3 <- VERDAD

arreglo[0] <- 10
matriz[2][2] <- 10

variable1 <- arreglo
matriz <- variable2

escribir variable1
escribir variable1, variable2, variable3
escribir variable1 + variable2 + variable3

leer variable1
leer variable1, variable2, variable3


si variable3 o VERDAD
    escribir "a"
sino si variable1 > 3
    escribir "b"
sino si variable2 = "texto"
    escribir "c"
sino
    escribir "d"

para i <- 0 hasta 5
    escribir i

para j <- 5 bajando 0
    escribir j

mientras variable3 y FALSO
    escribir "no entra"

holaMundo()
    escribir "hola mundo"

holaMundo()

suma(a, b)
    retornar a + b

suma2(a, b[])
    retornar a + b[0]

variable1 <- suma(1, 2)
escribir suma(1, 2)
variable1 <- suma2(1, arreglo)
escribir suma2(1, arreglo)
`

run(source);