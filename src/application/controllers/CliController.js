import {
    ApplicationError
} from "../../errors/ApplicationError.js";
import {
    applicationFailure
} from "../ApplicationResult.js";
import {
    requireFunction,
    requirePort
} from "../ports/ApplicationPorts.js";

export class CliController {

    constructor(options = {}) {
        this.sourceFileReader =
            requirePort(
                options.sourceFileReader,
                "sourceFileReader",
                ["read"]
            );
        this.runProgramUseCase =
            requirePort(
                options.runProgramUseCase,
                "runProgramUseCase",
                ["execute"]
            );
        this.presenter =
            requirePort(
                options.presenter,
                "presenter",
                ["present"]
            );
        this.resolvePath =
            requireFunction(
                options.resolvePath,
                "resolvePath"
            );
        this.getDisplayName =
            options.getDisplayName ??
            (sourcePath => sourcePath);
    }

    async execute(args = []) {
        const fileArgument = args[0];

        if (!fileArgument) {
            const result =
                applicationFailure(
                    ApplicationError
                        .invalidRequest(
                            "Debe indicar un archivo CLRS."
                        )
                );

            return {
                result,
                exitCode:
                    this.presenter
                        .present(result)
            };
        }

        const sourcePath =
            this.resolvePath(fileArgument);
        let sourceCode;

        try {
            sourceCode =
                await this.sourceFileReader
                    .read(sourcePath);
        } catch (error) {
            const result =
                applicationFailure(error);

            return {
                result,
                exitCode:
                    this.presenter
                        .present(
                            result,
                            {
                                displayName:
                                    this.getDisplayName(
                                        sourcePath
                                    )
                            }
                        )
            };
        }

        const result =
            await this.runProgramUseCase
                .execute({
                    sourceCode,
                    sourcePath
                });
        const exitCode =
            this.presenter.present(
                result,
                {
                    displayName:
                        this.getDisplayName(
                            sourcePath
                        )
                }
            );

        return {
            result,
            exitCode
        };
    }
}
