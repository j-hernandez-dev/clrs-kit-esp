import * as Tokens from "../lexer/tokens/Index.js";

export const dependencies =
`
// @ts-nocheck
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { readFile, stat, writeFile, appendFile, unlink } from 'fs/promises';

`

export const endProgram =
`
process.exit(0);
} catch (error) {
printError_1029347226("Runtime Error", error);
process.exit(1);
}

function printError_1029347226(type, error) {
    const width = 60;
    const title = \` \${type} \`;
    const filling = "═".repeat(width - title.length - 1);

    console.error(
        \`╔═\${title}\${filling}╗\\n\` +
        \`\\n\` +
        // @ts-ignore
        \`\${error.stack}\\n\` +
        \`\\n\` +
        \`╚\${"═".repeat(width)}╝\`
    );
}
`

export const standartLibrary =
`
try {

    function cre_array_1029347226(array, dimensions, size = 1) {
        try {
            array[0];
            if(typeof array === "string"
                || typeof array === "number" 
                || typeof array === "boolean") {throw new Error("");}
            return array;
        } catch (error) {
            if (dimensions <= 0) {
                return undefined;
            }

            const arr = new Array();

            return new Proxy(arr, {

                get(target, prop) {

                    if (isIndex_1029347226(prop)) {

                        const index = Number(prop);

                        if (target[index] === undefined) {
                            target[index] = cre_array_1029347226(dimensions - 1, size);
                        }

                        return target[index];
                    }

                    return target[prop];
                },

                set(target, prop, value) {

                    if (isIndex_1029347226(prop)) {
                        const index = Number(prop);

                        if (target[index] === undefined) {
                            target[index] = cre_array_1029347226(dimensions - 1, size);
                        }

                        target[index] = value;
                        return true;
                    }

                    target[prop] = value;
                    return true;
                }
            });
        }
    }

function isIndex_1029347226(prop) {
    return typeof prop === "string" && /^[0-9]+$/.test(prop);
}

// INPUT

async function inputData_1029347226() {
    const rl = createInterface({ input, output });
    const answer = await rl.question("> ");
    rl.close();
    return answer;
}


// FILES

async function LEER_ARCHIVO(ruta) {
    try {
        return await readFile(ruta, 'utf8');
    } catch (err) {
        if (err.code === 'ENOENT') {
            return "";
        }
        throw err;
    }
}

async function EXISTE_ARCHIVO(ruta) {
    try {
        return (await stat(ruta)).isFile();
    } catch {
        return false;
    }
}

async function PESO_ARCHIVO(ruta) {
    try {
        return (await stat(ruta)).size;
    } catch (err) {
        if (err.code === 'ENOENT') {
            return 0;
        }
        throw err;
    }
}

async function CREAR_ARCHIVO(ruta) {
    await writeFile(ruta, "");
}

async function ESCRIBIR_ARCHIVO(ruta, contenido) {
    await appendFile(ruta, contenido, "utf8");
}

async function ELIMINAR_ARCHIVO(ruta) {
    try {
        await unlink(ruta);
    } catch (err) {
        if (err.code !== "ENOENT") {
            throw err;
        }
    }
}

// MATH

async function ABS(x) {
    return Math.abs(x);
}

async function MIN(a, b) {
    return Math.min(a, b);
}

async function MAX(a, b) {
    return Math.max(a, b);
}

async function REDONDEA(decimal) {
    return Math.round(decimal);
}

async function PISO(decimal) {
    return Math.floor(decimal);
}

async function RAIZ(x) {
    return Math.sqrt(x);
}

async function RAIZCUB(x) {
    return Math.cbrt(x);
}

async function EXP(x) {
    return Math.exp(x);
}

async function LOGN(x) {
    return Math.log(x);
}

async function LOG10(x) {
    return Math.log10(x);
}

async function LOG2(x) {
    return Math.log2(x);
}

async function SEN(x) {
    return Math.sin(x);
}

async function COS(x) {
    return Math.cos(x);
}

async function TAN(x) {
    return Math.tan(x);
}

async function ARC(x) {
    return Math.asin(x);
}

async function ARCOCOS(x) {
    return Math.acos(x);
}

async function RAD(x) {
    return x * (Math.PI / 180);
}

async function GRAD(x) {
    return x * (180 / Math.PI);
}

async function PI() {
    return Math.PI;
}

async function E() {
    return Math.E;
}

async function ALEAT(min, max) {
    if (min === undefined || max === undefined) {
        return Math.random();
    }
    return Math.random() * (max - min) + min;
}

async function PROM(x) {
    const suma = await SUMATORIA(x);
    return suma / x.length;
}

async function SUM(x) {
    return x.reduce((acc, val) => acc + val, 0);
}

async function MED(x) {
    const sorted = [...x].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
        return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
}

async function VAR(x) {
    const prom = await PROM(x);
    return PROM(x.map(v => (v - prom) ** 2));
}

// STRINGS

async function LONG(estructura) {
    return estructura.length;
}

async function CAR_EN(cadena, posicion) {
    return cadena.charAt(posicion);
}

async function SUBCAD(cadena, inicio, fin) {
    return cadena.slice(inicio, fin);
}

async function MAYUS(cadena) {
    return cadena.toUpperCase();
}

async function MINUS(cadena) {
    return cadena.toLowerCase();
}

async function RECORTA(cadena) {
    return cadena.trim();
}

async function REEMP(cadena, viejo, nuevo) {
    return cadena.replaceAll(viejo, nuevo);
}

async function DIV(cadena, separador) {
    return cadena.split(separador);
}

async function ES_CAD_NUM(cadena) {
    return !isNaN(cadena) && String(cadena).trim() !== "";
}

async function ES_VAC(cadena) {
    return cadena.length === 0;
}

async function EMP_CON(cadena, texto) {
    return cadena.startsWith(texto);
}

async function TERM_CON(cadena, texto) {
    return cadena.endsWith(texto);
}

// ARRAY

async function AGREGA(arreglo, valor) {
    arreglo.push(valor);
    return arreglo;
}

function ELIM(arreglo, indice) {
    arreglo.splice(indice, 1);
    return arreglo;
}

function INSER(arreglo, indice, valor) {
    arreglo.splice(indice, 0, valor);
    return arreglo;
}

function INDICE(arreglo, valor) {
    return arreglo.indexOf(valor);
}

function CONT(arreglo, valor) {
    return arreglo.includes(valor);
}

function ORDENA(arreglo) {
    arreglo.sort((a, b) => {
        if (typeof a === "number" && typeof b === "number") {
            return a - b;
        }

        return String(a).localeCompare(String(b));
    });

    return arreglo;
}

async function INVER(arreglo) {
    return arreglo.reverse();
}

async function COPIA(arreglo) {
    return arreglo.slice();
}

async function UNE(arreglo, separador) {
    return arreglo.join(separador);
}

// TYPES

async function ES_NUM(valor) {
    return typeof valor === "number";
}

async function ES_CAD(valor) {
    return typeof valor === "string";
}

async function ES_LOG(valor) {
    return typeof valor === "boolean";
}

async function A_CAD(valor) {
    return valor.toString();
}

async function A_NUM(valor) {
    return Number(valor);
}

async function A_LOG(valor) {
    return Boolean(valor);
}

// ERROR

async function LANZAR_ERROR(mensaje) {
    throw new Error (mensaje);
}
`