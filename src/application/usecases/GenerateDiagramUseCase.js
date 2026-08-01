import {
    ApplicationError
} from "../../errors/ApplicationError.js";
import {
    applicationFailure
} from "../ApplicationResult.js";
import {
    requirePort
} from "../ports/ApplicationPorts.js";

export class GenerateDiagramUseCase {

    constructor(options = {}) {
        this.diagramService =
            requirePort(
                options.diagramService,
                "diagramService",
                ["buildFromSource"]
            );
    }

    execute(request = {}) {
        if (
            typeof request.sourceCode !==
            "string"
        ) {
            return applicationFailure(
                ApplicationError.invalidRequest(
                    "GenerateDiagramUseCase requiere código fuente."
                )
            );
        }

        return this.diagramService
            .buildFromSource(
                request.sourceCode
            );
    }
}
