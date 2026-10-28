export class ComplexityReportBridge {

    constructor(options = {}) {
        this.eventTarget =
            options.eventTarget ??
            globalThis.window;
        this.acquireApi =
            options.acquireVsCodeApi ??
            globalThis.acquireVsCodeApi;
        this.vscodeApi = null;
        this.apiResolved = false;
        this.listener = null;
    }

    connect(listener) {
        if (!this.apiResolved) {
            this.apiResolved = true;
            this.vscodeApi =
                typeof this.acquireApi ===
                "function"
                    ? this.acquireApi()
                    : null;
        }
        this.listener = event =>
            listener(event.data);
        this.eventTarget?.addEventListener(
            "message",
            this.listener
        );
        this.post({ type: "ready" });

        return () => {
            this.eventTarget
                ?.removeEventListener(
                    "message",
                    this.listener
                );
            this.listener = null;
        };
    }

    selectFunction(functionId) {
        return this.post({
            type: "select-function",
            functionId
        });
    }

    navigate(location) {
        return this.post({
            type: "navigate",
            location
        });
    }

    post(message) {
        if (!this.vscodeApi) {
            return false;
        }

        this.vscodeApi.postMessage(message);
        return true;
    }
}

export const complexityReportBridge =
    new ComplexityReportBridge();
