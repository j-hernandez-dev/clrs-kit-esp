import {
    ApplicationError
} from "../../errors/ApplicationError.js";
import {
    applicationFailure,
    tryApplicationOperationSync
} from "../ApplicationResult.js";
import {
    requirePort
} from "../ports/ApplicationPorts.js";

export class AnalyzeCostUseCase {

    constructor(options = {}) {
        this.compilationService =
            requirePort(
                options.compilationService,
                "compilationService",
                ["analyzeSource"]
            );
    }

    execute(request = {}) {
        const { sourceCode } = request;

        if (typeof sourceCode !== "string") {
            return applicationFailure(
                ApplicationError.invalidRequest(
                    "AnalyzeCostUseCase requiere código fuente."
                )
            );
        }

        return tryApplicationOperationSync(
            () =>
                this.compilationService
                    .analyzeSource(sourceCode),
            { useCase: "analyze-cost" }
        );
    }
}
