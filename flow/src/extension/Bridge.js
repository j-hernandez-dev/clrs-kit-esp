import {
    exportSvg as exportRenderedDiagram
} from "../renderer/SvgExporter.js";
import {
    requirePort
} from "../../../src/application/ports/ApplicationPorts.js";

/**
 * Adaptador entre la aplicación web y el webview de VS Code.
 */
export class WebviewBridge {

    constructor(options = {}) {
        this.eventTarget =
            options.eventTarget === undefined
                ? globalThis.window ?? null
                : options.eventTarget;
        this.acquireApi =
            options.acquireVsCodeApi ===
            undefined
                ? globalThis
                    .acquireVsCodeApi
                : options.acquireVsCodeApi;
        this.exportSvg =
            options.exportSvg ??
            exportRenderedDiagram;
        this.logger =
            options.logger ?? console;
        this.vscodeApi = null;
        this.apiResolved = false;
        this.connected = false;
        this.warnedOutsideVsCode = false;
        this.onSource = null;
        this.onError = null;
        this.messageListener = event => {
            void this.handleMessage(event)
                .catch(error => {
                    this.reportError(error);
                });
        };
    }

    connect(options = {}) {
        this.onSource =
            options.onSource ??
            this.onSource;
        this.onError =
            options.onError ??
            this.onError;

        if (this.connected) {
            return () => this.disconnect();
        }

        this.resolveVsCodeApi();

        if (
            this.eventTarget &&
            typeof this.eventTarget
                .addEventListener ===
                "function"
        ) {
            this.eventTarget.addEventListener(
                "message",
                this.messageListener
            );
            this.connected = true;
        }

        return () => this.disconnect();
    }

    disconnect() {
        if (
            this.connected &&
            this.eventTarget &&
            typeof this.eventTarget
                .removeEventListener ===
                "function"
        ) {
            this.eventTarget
                .removeEventListener(
                    "message",
                    this.messageListener
                );
        }

        this.connected = false;
    }

    async handleMessage(event) {
        const message = event?.data;

        switch (message?.type) {
            case "source":
                this.onSource?.(
                    message.source
                );

                return {
                    handled: true,
                    type: "source"
                };

            case "export-svg":
                if (!this.vscodeApi) {
                    return {
                        handled: false,
                        type: "export-svg"
                    };
                }

                return this.exportDiagram();

            default:
                return {
                    handled: false,
                    type:
                        message?.type ?? null
                };
        }
    }

    async exportDiagram() {
        const svg = await this.exportSvg();

        this.vscodeApi.postMessage({
            type: "svg",
            svg
        });

        return {
            handled: true,
            type: "export-svg",
            svg
        };
    }

    resolveVsCodeApi() {
        if (this.apiResolved) {
            return this.vscodeApi;
        }

        this.apiResolved = true;

        if (
            typeof this.acquireApi ===
            "function"
        ) {
            try {
                this.vscodeApi =
                    this.acquireApi();
            } catch (error) {
                this.reportError(error);
            }
        }

        if (
            !this.vscodeApi &&
            !this.warnedOutsideVsCode
        ) {
            this.warnedOutsideVsCode = true;
            this.logger.warn(
                "Running outside VS Code."
            );
        }

        return this.vscodeApi;
    }

    reportError(error) {
        if (this.onError) {
            this.onError(error);
            return;
        }

        this.logger.error(
            "Webview bridge error:",
            error
        );
    }
}

/**
 * Fachada histórica. Devuelve ahora una función de limpieza.
 */
export function initializeBridge(options = {}) {
    const bridge =
        requirePort(
            options.bridge,
            "webviewBridge",
            ["connect"]
        );

    return bridge.connect(options);
}
