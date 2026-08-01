import {
    readFile
} from "node:fs/promises";

import {
    ApplicationError
} from "../../errors/ApplicationError.js";

export class NodeSourceFileReader {

    constructor(options = {}) {
        this.readFile =
            options.readFile ?? readFile;
    }

    async read(sourcePath) {
        try {
            return await this.readFile(
                sourcePath,
                "utf8"
            );
        } catch (error) {
            if (error?.code === "ENOENT") {
                throw ApplicationError
                    .sourceNotFound(
                        sourcePath,
                        error
                    );
            }

            throw ApplicationError
                .sourceReadFailure(
                    sourcePath,
                    error
                );
        }
    }
}
