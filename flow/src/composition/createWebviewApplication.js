import {
    GenerateDiagramUseCase
} from "../../../src/application/usecases/GenerateDiagramUseCase.js";
import {
    requirePort
} from "../../../src/application/ports/ApplicationPorts.js";
import {
    createDefaultDiagram
} from "../config/DefaultDiagram.js";
import {
    createWebviewConfiguration
} from "../config/WebviewConfiguration.js";
import {
    WebviewBridge
} from "../extension/Bridge.js";
import {
    DiagramService
} from "../services/DiagramService.js";
import {
    DiagramModelStore
} from "../state/DiagramModelStore.js";

/**
 * Raíz de composición de la aplicación React/webview.
 */
export function createWebviewApplication(
    options = {}
) {
    const config =
        createWebviewConfiguration(
            options.config
        );
    const defaultDiagramFactory =
        options.defaultDiagramFactory ??
        createDefaultDiagram;
    const diagramService =
        options.diagramService ??
        new DiagramService({
            defaultDiagramFactory
        });
    const generateDiagramUseCase =
        options.generateDiagramUseCase ??
        new GenerateDiagramUseCase({
            diagramService
        });
    const store =
        options.store ??
        new DiagramModelStore({
            generateDiagramUseCase,
            defaultDiagramFactory
        });
    const bridge =
        options.bridge ??
        new WebviewBridge(
            options.bridgeOptions
        );

    requirePort(
        store,
        "diagramModelStore",
        [
            "getState",
            "subscribe",
            "setSource"
        ]
    );
    requirePort(
        bridge,
        "webviewBridge",
        ["connect", "disconnect"]
    );

    let disposed = false;

    return Object.freeze({
        config,
        diagramService,
        generateDiagramUseCase,
        store,
        bridge,
        dispose() {
            if (disposed) {
                return;
            }

            disposed = true;
            bridge.disconnect();
        }
    });
}
