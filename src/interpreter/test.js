import { run } from "./Runtime.js"

let source = `
resultado <- 10

arreglo[resultado] <- "10"

matriz[0][1] <- VERDAD

escribir LONGITUD(matriz)

suma (a, b)
    escribir resultado

suma2 (a, b)
    retornar a + b

i <- 0
para i <- 2 bajando 0
    escribir resultado + "para1"

para i <- 0 hasta 2
    escribir resultado + "para2"

mientras matriz[0][1] y FALSO
    matriz[0][1] <- FALSO
    escribir resultado + "mientras"

si resultado > 5
    escribir resultado + "si"


si resultado = 5
    escribir resultado + "si"
sino si resultado > 5
    escribir resultado + "sino si"


si resultado = 5
    escribir resultado + "si"
sino
    escribir resultado + "sino"

suma()

resultado <- suma2(20, 30)

escribir suma2(20, 30)
`

run(source);