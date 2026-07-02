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
console.error("╔═ Runtime Error ══════════════════════════════════════════\\n"
      + "\\n"
      + error.name + ":"
      + "\\n"
      + error.message
      + "\\n"
      + "\\n══════════════════════════════════════════════════════════");
process.exit(1);
}
`

export const standartLibrary =
`
try {

function cre_array_1029347226(dimensions, size = 1) {

    if (dimensions <= 0) {
        return undefined;
    }

    const arr = new Array();

    return new Proxy(arr, {

        get(target, prop) {

            if (isIndex_1029347226(prop)) {

                const index = Number(prop);

                if (!target[index]) {
                    target[index] = cre_array_1029347226(dimensions - 1, size);
                }

                return target[index];
            }

            return target[prop];
        },

        set(target, prop, value) {

            if (isIndex_1029347226(prop)) {
                const index = Number(prop);

                if (!target[index]) {
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

function isIndex_1029347226(prop) {
    return String(prop) === String(Number(prop));
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

async function ABSOLUTO(x) {
    return Math.abs(x);
}

async function MINIMO(a, b) {
    return Math.min(a, b);
}

async function MAXIMO(a, b) {
    return Math.max(a, b);
}

async function REDONDEO(decimal) {
    return Math.round(decimal);
}

async function PISO(decimal) {
    return Math.floor(decimal);
}

async function RAIZ2(x) {
    return Math.sqrt(x);
}

async function RAIZ3(x) {
    return Math.cbrt(x);
}

async function EXPONENCIAL(x) {
    return Math.exp(x);
}

async function LOG(x) {
    return Math.log(x);
}

async function LOG10(x) {
    return Math.log10(x);
}

async function LOG2(x) {
    return Math.log2(x);
}

async function SENO(x) {
    return Math.sin(x);
}

async function COSENO(x) {
    return Math.cos(x);
}

async function TANGENTE(x) {
    return Math.tan(x);
}

async function ARCOSENO(x) {
    return Math.asin(x);
}

async function ARCOCOSENO(x) {
    return Math.acos(x);
}

async function A_RADIANES(x) {
    return x * (Math.PI / 180);
}

async function A_GRADOS(x) {
    return x * (180 / Math.PI);
}

async function PI() {
    return Math.PI;
}

async function EULER() {
    return Math.E;
}

async function ALEATORIO(min, max) {
    if (min === undefined || max === undefined) {
        return Math.random();
    }
    return Math.random() * (max - min) + min;
}

async function PROMEDIO(x) {
    return Suma(x) / x.length;
}

async function SUMATORIA(x) {
    return x.reduce((acc, val) => acc + val, 0);
}

async function MEDIANA(x) {
    const sorted = [...x].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
        return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
}

async function VARIANZA(x) {
    const prom = Promedio(x);
    return Promedio(x.map(v => (v - prom) ** 2));
}

// STRINGS

async function LONGITUD(estructura) {
    return estructura.length;
}

async function CARACTER_EN(cadena, posicion) {
    return cadena[posicion];
}

async function SUB_CADENA(cadena, inicio, fin) {
    return cadena.slice(inicio, fin);
}

async function BUSCAR(cadena, cadenaBuscar) {
    return cadena.indexOf(cadenaBuscar);
}

async function CONTIENE(cadena, texto) {
    return cadena.includes(texto);
}

async function MAYUSCULAS(cadena) {
    return cadena.toUpperCase();
}

async function MINUSCULAS(cadena) {
    return cadena.toLowerCase();
}

async function RECORTAR(cadena) {
    return cadena.trim();
}

async function REEMPLAZAR(cadena, viejo, nuevo) {
    return cadena.replaceAll(viejo, nuevo);
}

async function DIVIDIR(cadena, separador) {
    return cadena.split(separador);
}

async function ES_NUMERO(cadena) {
    return !isNaN(cadena) && cadena.trim() !== "";
}

async function ES_VACIA(cadena) {
    return cadena.length === 0;
}

async function EMPIEZA_CON(cadena, texto) {
    return cadena.startsWith(texto);
}

async function TERMINA_CON(cadena, texto) {
    return cadena.endsWith(texto);
}

// ARRAY

async function AGREGAR(arreglo, valor) {
    return arreglo.push(valor);
}

function ELIMINAR(arreglo, indice) {
    arreglo.splice(indice, 1);
}

function INSERTAR(arreglo, indice, valor) {
    arreglo.splice(indice, 0, valor);
}

function BUSCAR_INDICE(arreglo, valor) {
    return arreglo.indexOf(valor);
}

function CONTIENE_VALOR(arreglo, valor) {
    return arreglo.includes(valor);
}

function ORDENAR(arreglo) {
    arreglo.sort((a, b) => {
        if (typeof a === "number" && typeof b === "number") {
            return a - b;
        }

        return String(a).localeCompare(String(b));
    });
}

async function INVERTIR(arreglo) {
    return arreglo.reverse();
}

async function COPIAR(arreglo) {
    return arreglo.slice();
}

async function UNIR(arreglo, separador) {
    return arreglo.join(separador);
}
`