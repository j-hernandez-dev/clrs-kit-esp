import {
    requireObject,
    requirePort
} from "../../src/application/ports/ApplicationPorts.js";

/**
 * Registra las capacidades nativas de símbolos y navegación del lenguaje.
 */
export function registerLanguageNavigation(
    options = {}
) {
    const vscode =
        requireObject(
            options.vscodeApi,
            "vscodeApi"
        );
    const provider =
        requirePort(
            options.provider,
            "symbolNavigationProvider",
            [
                "provideDocumentSymbols",
                "provideDefinition",
                "provideReferences"
            ]
        );
    const callHierarchyProvider =
        requirePort(
            options.callHierarchyProvider,
            "callHierarchyProvider",
            [
                "prepareCallHierarchy",
                "provideCallHierarchyIncomingCalls",
                "provideCallHierarchyOutgoingCalls"
            ]
        );
    const lifecycle =
        requirePort(
            options.lifecycle,
            "extensionLifecycle",
            ["add"]
        );
    const selector = {
        language: options.languageId
    };
    const registrations =
        Object.freeze({
            documentSymbols:
                vscode.languages
                    .registerDocumentSymbolProvider(
                        selector,
                        provider
                    ),
            definition:
                vscode.languages
                    .registerDefinitionProvider(
                        selector,
                        provider
                    ),
            references:
                vscode.languages
                    .registerReferenceProvider(
                        selector,
                        provider
                    ),
            callHierarchy:
                vscode.languages
                    .registerCallHierarchyProvider(
                        selector,
                        callHierarchyProvider
                    )
        });

    lifecycle.add(
        registrations.documentSymbols,
        registrations.definition,
        registrations.references,
        registrations.callHierarchy
    );

    return registrations;
}
