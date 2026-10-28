import os from "node:os";
import path from "node:path";
import {
    rmSync,
    writeFileSync
} from "node:fs";
import {
    randomUUID
} from "node:crypto";

import {
    ExecutionControlFileSession
} from "./ExecutionControlFileSession.js";
import {
    ExecutionTraceFileSession
} from "./ExecutionTraceFileSession.js";
import { createJavaScriptProjectOutputLines } from "../presentation/JavaScriptProjectOutput.js";

export class VSCodeCodeHost {

    constructor(
        vscodeApi,
        options,
        dependencies = {}
    ) {
        this.vscode = vscodeApi;
        this.terminalName =
            options.terminalName;
        this.outputChannelName =
            options.outputChannelName;
        this.outputChannel = null;
        this.documentResolver =
            dependencies.documentResolver ??
            null;
        this.executionTraceService =
            dependencies
                .executionTraceService ??
            null;
        this.traceSessionFactory =
            dependencies
                .traceSessionFactory ??
            (traceOptions =>
                new ExecutionTraceFileSession(
                    traceOptions
                ));
        this.controlSessionFactory =
            dependencies
                .controlSessionFactory ??
            (controlOptions =>
                new ExecutionControlFileSession(
                    controlOptions
                ));
        this.logger =
            dependencies.logger ?? console;
        this.writeTemporaryFile =
            dependencies.writeFileSync ??
            writeFileSync;
        this.removeTemporaryFile =
            dependencies.rmSync ?? rmSync;
        this.createTemporaryId =
            dependencies.randomUUID ??
            randomUUID;
        this.traceSession = null;
    }

    getActiveDocument() {
        const initialDocument =
            this.documentResolver
                ?.getDocument?.() ??
            this.vscode.window
                .activeTextEditor?.document;

        if (!initialDocument) {
            return null;
        }

        const resolveDocument = () =>
            this.documentResolver
                ?.getDocument?.() ??
            initialDocument;

        return {
            get filePath() {
                const document =
                    resolveDocument();

                return document.uri.fsPath ??
                    document.fileName;
            },
            get version() {
                return resolveDocument()
                    .version;
            },
            getText: () =>
                resolveDocument().getText(),
            save: async () => {
                if (initialDocument.isUntitled) {
                    await this.vscode.window
                        .showTextDocument(
                            initialDocument,
                            {
                                preview: false,
                                preserveFocus: false
                            }
                        );
                }

                return initialDocument.save();
            }
        };
    }

    getWorkspaceRoot(filePath) {
        if (typeof filePath === "string" && this.vscode.Uri?.file &&
            typeof this.vscode.workspace.getWorkspaceFolder === "function") {
            return this.vscode.workspace
                .getWorkspaceFolder(this.vscode.Uri.file(filePath))
                ?.uri.fsPath ?? null;
        }
        return this.vscode.workspace
            .workspaceFolders?.[0]
            ?.uri.fsPath ?? null;
    }

    runCli(
        interpreterPath,
        sourcePath,
        options = {}
    ) {
        if (options.debug === true) {
            return this.runDebugCli(
                interpreterPath,
                sourcePath,
                options
            );
        }

        let terminal =
            this.vscode.window.terminals
                .find(item =>
                    item.name ===
                    this.terminalName
                );

        if (!terminal) {
            terminal =
                this.vscode.window
                    .createTerminal(
                        this.terminalName
                    );
        }

        const execution =
            this.startExecutionTrace(
                sourcePath,
                options.documentVersion,
                {
                    ...options,
                    terminal
                }
            );

        terminal.show();
        terminal.sendText(
            process.platform === "win32"
                ? "cls"
                : "clear"
        );
        terminal.sendText(
            `node "${interpreterPath}" "${sourcePath}"` +
            execution.arguments
        );

        const trace =
            this.executionTraceService
            ?.getSnapshot?.() ?? null;

        return trace;
    }

    runDebugCli(
        interpreterPath,
        sourcePath,
        options
    ) {
        const execution =
            this.startExecutionTrace(
                sourcePath,
                options.documentVersion,
                {
                    ...options,
                    terminal: null
                }
            );
        const test = normalizeDebugTest(
            options.test
        );
        let inputPath = null;
        let terminal;

        try {
            if (test != null) {
                inputPath = path.join(
                    os.tmpdir(),
                    `clrs-test-input-${this.createTemporaryId()}.txt`
                );
                this.writeTemporaryFile(
                    inputPath,
                    test.stdin,
                    "utf8"
                );
                execution.addCleanupPath(
                    inputPath
                );
            }

            terminal = this.vscode.window
                .createTerminal({
                    name: this.terminalName,
                    shellPath: "node",
                    shellArgs: [
                        interpreterPath,
                        sourcePath,
                        ...execution.argumentList
                    ],
                    ...(test == null
                        ? {}
                        : {
                            env: {
                                CLRS_TEST_MODE: "1",
                                CLRS_TEST_DEBUG: "1",
                                CLRS_TEST_SEED:
                                    String(test.seed),
                                CLRS_TEST_INPUT_FILE:
                                    inputPath
                            }
                        })
                });
        } catch (error) {
            this.closeTraceSession({
                terminate: true
            });
            throw error;
        }

        execution.attachTerminal(
            terminal
        );
        terminal.show();

        return {
            trace:
                this.executionTraceService
                    ?.getSnapshot?.() ?? null,
            controlSession:
                execution.controlSession
        };
    }

    async writeClipboard(text) {
        await this.vscode.env
            .clipboard.writeText(text);
    }

    async withExportProgress(operation) {
        return this.vscode.window.withProgress({ location: this.vscode.ProgressLocation.Notification,
            title: "Generando proyecto JavaScript y resolviendo su lockfile npm", cancellable: true }, async (_progress, token) => {
            const controller = new AbortController();
            const subscription = token.onCancellationRequested(() => controller.abort());
            if (token.isCancellationRequested) { controller.abort(); }
            try { return await operation(controller.signal); }
            finally { subscription.dispose(); }
        });
    }

    showGeneratedPath(outputPath, project) {
        const channel =
            this.getOutputChannel();

        channel.clear();
        channel.show(true);
        for (const line of createJavaScriptProjectOutputLines(outputPath, project)) {
            channel.appendLine(line);
        }
    }

    stopExecution() {
        return this.forceTerminateExecution(
            this.traceSession,
            this.traceSession?.terminal
        );
    }

    getOutputChannel() {
        if (!this.outputChannel) {
            this.outputChannel =
                this.vscode.window
                    .createOutputChannel(
                        this.outputChannelName
                    );
        }

        return this.outputChannel;
    }

    dispose() {
        this.closeTraceSession({
            terminate: true
        });

        this.outputChannel?.dispose?.();
        this.outputChannel = null;
    }

    startExecutionTrace(
        sourcePath,
        documentVersion,
        options = {}
    ) {
        if (!this.executionTraceService) {
            return {
                arguments: "",
                argumentList: [],
                controlSession: null,
                attachTerminal() {}
            };
        }

        this.closeTraceSession({
            terminate: true
        });

        const trace =
            this.executionTraceService.start({
                sourcePath,
                documentVersion,
                debug:
                    options.debug === true
            });
        const tracePath = path.join(
            os.tmpdir(),
            `clrs-${process.pid}-${trace.traceId}.jsonl`
        );
        const controlPath =
            options.debug === true
                ? path.join(
                    os.tmpdir(),
                    `clrs-${process.pid}-${trace.traceId}.control.json`
                )
                : null;
        let record = null;
        const controlSession =
            controlPath == null
                ? null
                : this.controlSessionFactory({
                    controlPath,
                    logger: this.logger,
                    onTerminateTimeout: () =>
                        this.forceTerminateExecution(
                            record,
                            record?.terminal
                        )
                }).start({
                    breakpoints:
                        options.breakpoints,
                    stopOnEntry:
                        options.stopOnEntry
                });
        const session =
            this.traceSessionFactory({
                tracePath,
                logger: this.logger,
                onEvent: event => {
                    this.executionTraceService
                        .accept(
                            trace.traceId,
                            event
                        );
                },
                onFinish: () => {
                    if (!record?.closing) {
                        record?.controlSession
                            ?.dispose();
                    }

                    this.cleanupTraceArtifacts(
                        record
                    );

                    if (
                        this.traceSession ===
                            record
                    ) {
                        this.traceSession = null;
                    }
                }
            });

        record = {
            traceId: trace.traceId,
            tracePath,
            session,
            controlPath,
            controlSession,
            terminal:
                options.terminal ?? null,
            cleanupPaths: new Set(),
            closing: false
        };
        this.traceSession = record;
        session.start();

        return {
            arguments:
                ` --trace-file "${tracePath}"` +
                (
                    controlPath == null
                        ? ""
                        : ` --control-file "${controlPath}"`
                ),
            argumentList: [
                "--trace-file",
                tracePath,
                ...(
                    controlPath == null
                        ? []
                        : [
                            "--control-file",
                            controlPath
                        ]
                )
            ],
            controlSession,
            traceId: trace.traceId,
            attachTerminal(terminal) {
                record.terminal = terminal;
            },
            addCleanupPath(cleanupPath) {
                record.cleanupPaths.add(
                    cleanupPath
                );
            }
        };
    }

    forceTerminateExecution(
        record,
        terminal
    ) {
        if (!record || record.closing) {
            return false;
        }

        record.closing = true;

        try {
            terminal?.sendText?.(
                "\u0003",
                false
            );
        } catch (error) {
            this.logger.error?.(
                "Error interrupting the CLRS terminal process:",
                error
            );
        }

        this.executionTraceService
            ?.cancel?.(record.traceId);
        record.session.dispose({
            cleanupDelayMs: 1000
        });
        record.controlSession?.dispose({
            cleanupDelayMs: 1000
        });
        this.cleanupTraceArtifacts(record);

        if (this.traceSession === record) {
            this.traceSession = null;
        }

        return true;
    }

    closeTraceSession(options = {}) {
        const record = this.traceSession;

        if (!record) {
            return;
        }

        record.closing = true;

        if (options.terminate === true) {
            record.controlSession
                ?.terminate();
        }

        this.executionTraceService
            ?.cancel?.(record.traceId);
        record.session.dispose({
            cleanupDelayMs:
                options.terminate === true
                    ? 1000
                    : 0
        });
        record.controlSession?.dispose({
            cleanupDelayMs:
                options.terminate === true
                    ? 1000
                    : 0
        });
        this.cleanupTraceArtifacts(record);

        if (this.traceSession === record) {
            this.traceSession = null;
        }
    }

    cleanupTraceArtifacts(record) {
        if (record?.cleanupPaths == null) {
            return;
        }

        for (const cleanupPath of record.cleanupPaths) {
            try {
                this.removeTemporaryFile(
                    cleanupPath,
                    { force: true }
                );
            } catch (error) {
                this.logger.error?.(
                    "Error removing CLRS debug test input:",
                    error
                );
            }
        }

        record.cleanupPaths.clear();
    }
}

function normalizeDebugTest(value) {
    if (value == null) {
        return null;
    }

    if (
        typeof value.stdin !== "string" ||
        !Number.isSafeInteger(value.seed) ||
        value.seed < 0
    ) {
        throw new TypeError(
            "The CLRS debug test configuration is invalid."
        );
    }

    return {
        stdin: value.stdin,
        seed: value.seed
    };
}
