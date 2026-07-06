import { cost, run } from "./Runtime.js"
let source =
`
si VERDAD
    escribir ""
sino
    escribir ""

para i <- 0 hasta 10
    escribir ""

mientras VERDAD
    escribir ""
`

cost(source);