import {
    ApplicationError
} from "../../errors/ApplicationError.js";
import {
    applicationFailure
} from "../ApplicationResult.js";
import {
    requirePort
} from "../ports/ApplicationPorts.js";

export class GenerateJavaScriptUseCase {

    constructor(options = {}) {
        this.compilationService =
            requirePort(
                options.compilationService,
                "compilationService",
                ["tryCompileSource"]
            );
    }

    async execute(request = {}) {
        const {
            sourceCode,
            sourcePath
        } = request;

        if (
            typeof sourceCode !== "string" ||
            typeof sourcePath !== "string" ||
            sourcePath.length === 0
        ) {
            return applicationFailure(
                ApplicationError.invalidRequest(
                    "GenerateJavaScriptUseCase requiere código y ruta de origen."
                )
            );
        }

        return this.compilationService
            .tryCompileSource(
                sourceCode,
                sourcePath,
                { temporary: false }
            );
    }
}
