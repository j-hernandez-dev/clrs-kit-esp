import {
    requireObject,
    requirePort
} from "../../src/application/ports/ApplicationPorts.js";
import {
    formatDeveloperError
} from "../../src/errors/ErrorFormatter.js";
import {
    LanguageCompletionKind
} from "../../src/language/intelligence/LanguageIntelligenceService.js";
import {
    createVSCodeRange
} from "./StaticDiagnosticsProvider.js";

/**
 * Adapta completado, hover y ayuda de parámetros a la API de VS Code.
 */
export class CLRSLanguageIntelligenceProvider {

    constructor(options = {}) {
        this.vscode =
            requireObject(
                options.vscodeApi,
                "vscodeApi"
            );
        this.documentAnalysisService =
            requirePort(
                options
                    .documentAnalysisService,
                "documentAnalysisService",
                ["analyzeDocument"]
            );
        this.intelligenceService =
            requirePort(
                options.intelligenceService,
                "languageIntelligenceService",
                [
                    "getCompletions",
                    "getHover",
                    "getSignatureHelp",
                    "getInlayHints"
                ]
            );
        this.languageId =
            options.languageId;
        this.developerLogger =
            options.developerLogger ??
            console;
        this.disposed = false;
    }

    provideCompletionItems(
        document,
        position
    ) {
        if (!this.isSupported(document)) {
            return [];
        }

        return this.tryProvide(
            [],
            document,
            snapshot =>
                this.intelligenceService
                    .getCompletions({
                        sourceCode:
                            document.getText(),
                        snapshot,
                        position:
                            toLanguagePosition(
                                position
                            )
                    })
                    .map(item =>
                        this.createCompletionItem(
                            item
                        )
                    )
        );
    }

    provideHover(document, position) {
        if (!this.isSupported(document)) {
            return null;
        }

        return this.tryProvide(
            null,
            document,
            snapshot => {
                const hover =
                    this.intelligenceService
                        .getHover({
                            sourceCode:
                                document
                                    .getText(),
                            snapshot,
                            position:
                                toLanguagePosition(
                                    position
                                )
                        });

                if (hover == null) {
                    return null;
                }

                const contents =
                    new this.vscode
                        .MarkdownString();

                contents.appendCodeblock(
                    hover.signature,
                    this.languageId
                );
                contents.appendMarkdown(
                    "\n" +
                    hover.documentation
                );

                return new this.vscode.Hover(
                    contents,
                    createVSCodeRange(
                        this.vscode,
                        document,
                        hover.location
                    )
                );
            }
        );
    }

    provideSignatureHelp(
        document,
        position
    ) {
        if (!this.isSupported(document)) {
            return null;
        }

        return this.tryProvide(
            null,
            document,
            snapshot => {
                const help =
                    this.intelligenceService
                        .getSignatureHelp({
                            sourceCode:
                                document
                                    .getText(),
                            snapshot,
                            position:
                                toLanguagePosition(
                                    position
                                )
                        });

                return help == null
                    ? null
                    : this.createSignatureHelp(
                        help
                    );
            }
        );
    }

    provideInlayHints(
        document,
        range
    ) {
        if (!this.isSupported(document)) {
            return [];
        }

        return this.tryProvide(
            [],
            document,
            snapshot =>
                this.intelligenceService
                    .getInlayHints({
                        sourceCode:
                            document.getText(),
                        snapshot,
                        range:
                            toLanguageRange(
                                range
                            )
                    })
                    .map(hint =>
                        this.createInlayHint(
                            hint
                        )
                    )
        );
    }

    createCompletionItem(completion) {
        const item =
            new this.vscode.CompletionItem(
                completion.label,
                getCompletionItemKind(
                    this.vscode,
                    completion.kind
                )
            );

        item.detail = completion.detail;
        item.documentation =
            new this.vscode.MarkdownString(
                completion.documentation
            );
        item.sortText =
            String(completion.priority) +
            "-" +
            completion.label;

        if (
            completion.kind ===
            LanguageCompletionKind.FUNCTION && !completion.insertAsReference
        ) {
            item.insertText =
                new this.vscode.SnippetString(
                    createFunctionSnippet(
                        completion
                    )
                );
            item.command = {
                command:
                    "editor.action.triggerParameterHints",
                title:
                    "Mostrar ayuda de parámetros"
            };
        }

        return item;
    }

    createSignatureHelp(help) {
        const result =
            new this.vscode.SignatureHelp();
        const information =
            new this.vscode
                .SignatureInformation(
                    help.label,
                    new this.vscode
                        .MarkdownString(
                            help.documentation
                        )
                );

        information.parameters =
            help.parameters.map(
                parameter =>
                    new this.vscode
                        .ParameterInformation(
                            parameter.label,
                            new this.vscode
                                .MarkdownString(
                                    parameter
                                        .documentation
                                )
                        )
            );
        result.signatures = [information];
        result.activeSignature = 0;
        result.activeParameter =
            help.activeParameter;

        return result;
    }

    createInlayHint(hint) {
        const item =
            new this.vscode.InlayHint(
                new this.vscode.Position(
                    hint.position.line - 1,
                    hint.position.column - 1
                ),
                hint.label,
                this.vscode.InlayHintKind
                    .Parameter
            );

        item.paddingRight = true;
        item.tooltip =
            "Parámetro «" +
            hint.parameterName +
            "» de " +
            hint.functionName +
            ".";

        return item;
    }

    tryProvide(
        fallback,
        document,
        provide
    ) {
        try {
            const snapshot =
                this
                    .documentAnalysisService
                    .analyzeDocument(
                        document
                    );

            return provide(snapshot);
        } catch (error) {
            this.developerLogger.error(
                formatDeveloperError(
                    error
                )
            );

            return fallback;
        }
    }

    isSupported(document) {
        return (
            !this.disposed &&
            document != null &&
            document.languageId ===
                this.languageId
        );
    }

    dispose() {
        this.disposed = true;
    }
}

function toLanguagePosition(position) {
    return {
        line: (position?.line ?? -1) + 1,
        column:
            (position?.character ?? -1) +
            1
    };
}

function toLanguageRange(range) {
    if (
        range?.start == null ||
        range?.end == null
    ) {
        return null;
    }

    return {
        start:
            toLanguagePosition(
                range.start
            ),
        end:
            toLanguagePosition(
                range.end
            )
    };
}

function getCompletionItemKind(
    vscode,
    kind
) {
    switch (kind) {
        case LanguageCompletionKind.FUNCTION:
            return vscode.CompletionItemKind
                .Function;
        case LanguageCompletionKind.PARAMETER:
            return vscode.CompletionItemKind
                .TypeParameter;
        case LanguageCompletionKind.KEYWORD:
            return vscode.CompletionItemKind
                .Keyword;
        default:
            return vscode.CompletionItemKind
                .Variable;
    }
}

function createFunctionSnippet(completion) {
    const parameters =
        completion.parameters.map(
            (parameter, index) =>
                "${" +
                (index + 1) +
                ":" +
                parameter.replace(
                    /\[\]/g,
                    ""
                ) +
                "}"
        );

    return (
        completion.label +
        "(" +
        parameters.join(", ") +
        ")"
    );
}
