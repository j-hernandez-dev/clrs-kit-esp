import { cost, run } from "./Runtime.js"
let source =
`
si VERDAD
    escribir ""
sino
    escribir ""

`

cost(source);