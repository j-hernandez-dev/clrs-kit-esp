import path from "node:path";
import { NodeGtkDependencyManager } from "../../infrastructure/gui/NodeGtkDependencyManager.js";
import { GuiRuntimePreparation } from "../../compiler/gui/GuiRuntimePreparation.js";
import { NodeProgramRunner } from "../../compiler/adapters/NodeProgramRunner.js";

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
    GuiRuntimeProgressPresenter
} from "../presenters/GuiRuntimeProgressPresenter.js";
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
    const guiRuntimeProgressPresenter =
        options.guiRuntimeProgressPresenter ??
        new GuiRuntimeProgressPresenter({
            logger:
                options.logger ?? console,
            stream:
                options.standardOutput ??
                process.stdout,
            environment:
                options.environment ??
                process.env
        });
    const compilationService =
        options.compilationService ??
        new CompilationService({
            runtimeSignal: options.signal,
            ...(options.nodeCommand ? { programRunner: new NodeProgramRunner({ command: options.nodeCommand }) } : {}),
            runtimePreparation: options.runtimePreparation ?? (options.extensionRoot ? new GuiRuntimePreparation({
                dependencyManager: new NodeGtkDependencyManager({ extensionRoot: options.extensionRoot,
                    nodeCommand: options.nodeCommand,
                    onState: state =>
                        guiRuntimeProgressPresenter
                            .present(state) }),
                getFactorySource: options.getGuiFactorySource
            }) : null)
        });
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
        dispose: () =>
            guiRuntimeProgressPresenter
                .dispose?.()
    });
}
