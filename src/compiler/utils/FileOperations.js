import path from "node:path";
import { appendFile, mkdir, unlink, writeFile as fsWriteFile } from 'node:fs/promises';

/**
 * @param {any} content
 */
export async function createFile(content, file, dir) {
    try {
        await mkdir(dir, { recursive: true });
        await fsWriteFile(path.join(dir, file), content, 'utf8');
    } catch (error) {
        console.error('Error to write file', error);
    }
}

/**
 * @param {any} content
 */
export async function writeFile(content, file, dir) {
    try {
        await mkdir(dir, { recursive: true });
        const linea = `${content}`;
        await appendFile(path.join(dir, file), linea, 'utf8');
    } catch (error) {
        console.error('Error to write file', error);
    }
}

export async function deleteFile(file, dir) {
    try {
        await mkdir(dir, { recursive: true });
        await unlink(path.join(dir, file));
    } catch (error) {
        // @ts-ignore
        if (error.code === 'ENOENT') {
        } else {
            // @ts-ignore
            console.error('Error trying to delete the file', error.message);
        }
    }
}