import {
    ApplicationError
} from "../../errors/ApplicationError.js";
import {
    applicationFailure
} from "../ApplicationResult.js";
import {
    requirePort
} from "../ports/ApplicationPorts.js";

export class RunProgramUseCase {

    constructor(options = {}) {
        this.compilationService =
            requirePort(
                options.compilationService,
                "compilationService",
                ["tryRunSource"]
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
                    "RunProgramUseCase requiere código y ruta de origen."
                )
            );
        }

        return this.compilationService
            .tryRunSource(
                sourceCode,
                sourcePath
            );
    }
}
