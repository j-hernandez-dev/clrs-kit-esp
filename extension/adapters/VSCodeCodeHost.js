export class VSCodeCodeHost {

    constructor(vscodeApi, options) {
        this.vscode = vscodeApi;
        this.terminalName =
            options.terminalName;
        this.outputChannelName =
            options.outputChannelName;
        this.outputChannel = null;
    }

    getActiveDocument() {
        const editor =
            this.vscode.window
                .activeTextEditor;

        if (!editor) {
            return null;
        }

        return {
            filePath:
                editor.document.uri.fsPath ??
                editor.document.fileName,
            getText: () =>
                editor.document.getText(),
            save: () =>
                editor.document.save()
        };
    }

    getWorkspaceRoot() {
        return this.vscode.workspace
            .workspaceFolders?.[0]
            ?.uri.fsPath ?? null;
    }

    runCli(interpreterPath, sourcePath) {
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

        terminal.show();
        terminal.sendText(
            process.platform === "win32"
                ? "cls"
                : "clear"
        );
        terminal.sendText(
            `node "${interpreterPath}" "${sourcePath}"`
        );
    }

    async writeClipboard(text) {
        await this.vscode.env
            .clipboard.writeText(text);
    }

    showGeneratedPath(outputPath) {
        const channel =
            this.getOutputChannel();

        channel.clear();
        channel.show(true);
        channel.appendLine(
            `El código se generó en: ${outputPath}`
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
        this.outputChannel?.dispose?.();
        this.outputChannel = null;
    }
}
