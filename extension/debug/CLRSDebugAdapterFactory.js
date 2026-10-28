import {
    CLRSDebugAdapter
} from "./CLRSDebugAdapter.js";

export class CLRSDebugAdapterFactory {

    constructor(options) {
        this.vscode = options.vscodeApi;
        this.executionTraceService =
            options.executionTraceService;
        this.launchProgram =
            options.launchProgram;
        this.logger =
            options.logger ?? console;
        this.adapters = new Set();
    }

    createDebugAdapterDescriptor() {
        const adapter =
            new CLRSDebugAdapter({
                messageEmitter:
                    new this.vscode
                        .EventEmitter(),
                executionTraceService:
                    this.executionTraceService,
                launchProgram:
                    this.launchProgram,
                logger: this.logger,
                onDispose: disposed => {
                    this.adapters.delete(
                        disposed
                    );
                }
            });

        this.adapters.add(adapter);

        return new this.vscode
            .DebugAdapterInlineImplementation(
                adapter
            );
    }

    dispose() {
        for (const adapter of this.adapters) {
            adapter.dispose();
        }

        this.adapters.clear();
    }
}
