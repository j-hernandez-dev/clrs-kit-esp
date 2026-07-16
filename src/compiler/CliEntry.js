import { run } from "./Pipeline.js";
import * as fs from 'node:fs';
import * as path from 'node:path';

const fileToRead = process.argv[2];

if (fileToRead) {
    try {
        // Convertimos la ruta en una ruta absoluta y limpia
        const absolutePath = path.resolve(fileToRead);
        
        // Validamos si el archivo realmente existe en el disco antes de leerlo
        if (!fs.existsSync(absolutePath)) {
            console.error(`The file does not exist at the path: ${absolutePath}`);
            process.exit(1);
        }

        // Leer el contenido del archivo de forma síncrona como texto (utf8)
        const sourceCode = fs.readFileSync(absolutePath, 'utf8');

        // Enviamos el contenido de texto a tu función run
        run(sourceCode, absolutePath);

    } catch (error) {
        // @ts-ignore
        console.error("Critical error reading the file at Runtime:", error.stack);
        process.exit(1);
    }
}