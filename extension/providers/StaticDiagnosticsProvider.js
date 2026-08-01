import {
    requireObject,
    requirePort
} from "../../src/application/ports/ApplicationPorts.js";
import {
    formatDeveloperError
} from "../../src/errors/ErrorFormatter.js";

const DIAGNOSTIC_SOURCE = "CLRS";

/**
 * Adapta los diagnósticos neutrales del lenguaje a la API nativa de VS Code.
 */
export class CLRSStaticDiagnosticsProvider {

    constructor(options = {}) {
        this.vscode =
            requireObject(
                options.vscodeApi,
                "vscodeApi"
            );
        this.diagnosticsService =
            requirePort(
                options.diagnosticsService,
                "languageDiagnosticsService",
                ["diagnose"]
            );
        this.languageId =
            options.languageId;
        this.debounceMs =
            options.debounceMs ?? 300;
        this.developerLogger =
            options.developerLogger ??
            console;
        this.collection =
            this.vscode.languages
                .createDiagnosticCollection(
                    "clrs"
                );
        this.disposables = [];
        this.timers = new Map();
        this.requests = new Map();
        this.started = false;
        this.disposed = false;
    }

    start() {
        if (
            this.started ||
            this.disposed
        ) {
            return this;
        }

        const workspace =
            this.vscode.workspace;

        this.disposables.push(
            workspace
                .onDidOpenTextDocument(
                    document => {
                        void this.refresh(
                            document
                        );
                    }
                ),
            workspace
                .onDidChangeTextDocument(
                    event => {
                        this.schedule(
                            event.document
                        );
                    }
                ),
            workspace
                .onDidSaveTextDocument(
                    document => {
                        void this.refresh(
                            document
                        );
                    }
                ),
            workspace
                .onDidCloseTextDocument(
                    document => {
                        this.clear(document);
                    }
                )
        );

        this.started = true;

        for (
            const document
            of workspace.textDocuments ?? []
        ) {
            void this.refresh(document);
        }

        return this;
    }

    schedule(document) {
        if (
            !this.isSupported(document) ||
            this.disposed
        ) {
            return;
        }

        const key =
            document.uri.toString();
        const request =
            this.nextRequest(key);

        this.cancelTimer(key);

        const timer = setTimeout(
            () => {
                this.timers.delete(key);
                void this.analyze(
                    document,
                    request
                );
            },
            this.debounceMs
        );

        this.timers.set(key, timer);
    }

    async refresh(document) {
        if (
            !this.isSupported(document) ||
            this.disposed
        ) {
            return false;
        }

        const key =
            document.uri.toString();
        const request =
            this.nextRequest(key);

        this.cancelTimer(key);

        return this.analyze(
            document,
            request
        );
    }

    async analyze(document, request) {
        const key =
            document.uri.toString();
        const version =
            document.version;

        try {
            const languageDiagnostics =
                await Promise.resolve(
                    this.diagnosticsService
                        .diagnose(
                            document.getText()
                        )
                );

            if (
                this.isStale(
                    document,
                    key,
                    request,
                    version
                )
            ) {
                return false;
            }

            const diagnostics =
                languageDiagnostics.map(
                    diagnostic =>
                        createVSCodeDiagnostic(
                            this.vscode,
                            document,
                            diagnostic
                        )
                );

            this.collection.set(
                document.uri,
                diagnostics
            );

            return true;
        } catch (error) {
            if (
                !this.isStale(
                    document,
                    key,
                    request,
                    version
                )
            ) {
                this.collection.delete(
                    document.uri
                );
                this.developerLogger.error(
                    formatDeveloperError(
                        error
                    )
                );
            }

            return false;
        }
    }

    clear(document) {
        const key =
            document.uri.toString();

        this.nextRequest(key);
        this.cancelTimer(key);
        this.collection.delete(
            document.uri
        );
    }

    isSupported(document) {
        return (
            document != null &&
            document.languageId ===
                this.languageId
        );
    }

    isStale(
        document,
        key,
        request,
        version
    ) {
        return (
            this.disposed ||
            document.isClosed === true ||
            this.requests.get(key) !==
                request ||
            document.version !== version
        );
    }

    nextRequest(key) {
        const request =
            (this.requests.get(key) ?? 0) +
            1;

        this.requests.set(key, request);

        return request;
    }

    cancelTimer(key) {
        const timer =
            this.timers.get(key);

        if (timer != null) {
            clearTimeout(timer);
            this.timers.delete(key);
        }
    }

    dispose() {
        if (this.disposed) {
            return;
        }

        this.disposed = true;

        for (const timer of this.timers.values()) {
            clearTimeout(timer);
        }

        this.timers.clear();
        this.requests.clear();

        for (
            const disposable
            of this.disposables.reverse()
        ) {
            disposable.dispose();
        }

        this.disposables = [];
        this.collection.clear();
        this.collection.dispose();
    }
}

export function createVSCodeDiagnostic(
    vscode,
    document,
    diagnostic
) {
    const item =
        new vscode.Diagnostic(
            createVSCodeRange(
                vscode,
                document,
                diagnostic.location
            ),
            diagnostic.message,
            getVSCodeSeverity(
                vscode,
                diagnostic.severity
            )
        );

    item.code = diagnostic.code;
    item.source = DIAGNOSTIC_SOURCE;

    return item;
}

export function createVSCodeRange(
    vscode,
    document,
    location
) {
    const lastLine =
        Math.max(
            (document.lineCount ?? 1) - 1,
            0
        );
    const startLine =
        clamp(
            (location?.startLine ?? 1) - 1,
            0,
            lastLine
        );
    const endLine =
        clamp(
            (location?.endLine ??
                location?.startLine ??
                1) - 1,
            startLine,
            lastLine
        );
    let startColumn =
        clamp(
            (location?.startColumn ?? 1) - 1,
            0,
            lineLength(document, startLine)
        );
    let endColumn =
        clamp(
            location?.endColumn ??
                location?.startColumn ??
                1,
            endLine === startLine
                ? startColumn
                : 0,
            lineLength(document, endLine)
        );

    if (
        startLine === endLine &&
        startColumn === endColumn
    ) {
        const length =
            lineLength(
                document,
                startLine
            );

        if (endColumn < length) {
            endColumn += 1;
        } else if (startColumn > 0) {
            startColumn -= 1;
        }
    }

    return new vscode.Range(
        startLine,
        startColumn,
        endLine,
        endColumn
    );
}

function getVSCodeSeverity(
    vscode,
    severity
) {
    switch (severity) {
        case "warning":
            return vscode
                .DiagnosticSeverity
                .Warning;
        case "information":
            return vscode
                .DiagnosticSeverity
                .Information;
        case "hint":
            return vscode
                .DiagnosticSeverity
                .Hint;
        default:
            return vscode
                .DiagnosticSeverity
                .Error;
    }
}

function lineLength(document, line) {
    return document.lineAt(line)
        .text.length;
}

function clamp(value, minimum, maximum) {
    const finiteValue =
        Number.isFinite(value)
            ? value
            : minimum;

    return Math.min(
        Math.max(
            finiteValue,
            minimum
        ),
        maximum
    );
}
