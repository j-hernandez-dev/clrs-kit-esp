import path from "node:path";

import {
    CompilationService
} from "../../compiler/services/CompilationService.js";
import {
    NodeSourceFileReader
} from "../adapters/NodeSourceFileReader.js";
import {
    createCliConfiguration
} from "../config/CliConfiguration.js";
import {
    CliController
} from "../controllers/CliController.js";
import {
    ConsolePresenter
} from "../presenters/ConsolePresenter.js";
import {
    RunProgramUseCase
} from "../usecases/RunProgramUseCase.js";

/**
 * Raíz de composición del ejecutable de consola.
 */
export function createCliApplication(
    options = {}
) {
    const config =
        createCliConfiguration(
            options.config
        );
    const compilationService =
        options.compilationService ??
        new CompilationService();
    const sourceFileReader =
        options.sourceFileReader ??
        new NodeSourceFileReader();
    const presenter =
        options.presenter ??
        new ConsolePresenter({
            logger:
                options.logger ?? console,
            developerLogger:
                options.developerLogger ??
                options.logger ??
                console,
            debug:
                options.debug,
            successExitCode:
                config.successExitCode,
            failureExitCode:
                config.failureExitCode
        });
    const runProgramUseCase =
        options.runProgramUseCase ??
        new RunProgramUseCase({
            compilationService
        });
    const controller =
        options.controller ??
        new CliController({
            sourceFileReader,
            runProgramUseCase,
            presenter,
            resolvePath:
                options.resolvePath ??
                path.resolve,
            getDisplayName:
                options.getDisplayName ??
                path.basename
        });

    return Object.freeze({
        config,
        compilationService,
        sourceFileReader,
        presenter,
        runProgramUseCase,
        controller,
        execute:
            args => controller.execute(args),
        dispose() {}
    });
}
