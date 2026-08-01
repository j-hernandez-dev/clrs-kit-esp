import path from "node:path";

import {
    FileSystemEmitter
} from "../adapters/FileSystemEmitter.js";

export const fileSystemEmitter =
    new FileSystemEmitter();

/**
 * @param {any} content
 */
export async function createFile(content, file, dir) {
    return fileSystemEmitter.write(
        content,
        path.join(dir, file)
    );
}

/**
 * @param {any} content
 */
export async function writeFile(content, file, dir) {
    return fileSystemEmitter.append(
        content,
        path.join(dir, file)
    );
}

export async function deleteFile(file, dir) {
    return fileSystemEmitter.remove(
        path.join(dir, file),
        { ignoreMissing: true }
    );
}
