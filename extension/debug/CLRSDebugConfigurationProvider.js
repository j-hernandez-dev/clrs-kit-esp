import path from "node:path";

export class CLRSDebugConfigurationProvider {

    constructor(options) {
        this.host = options.host;
        this.presenter = options.presenter;
        this.debugType = options.debugType;
        this.debugName = options.debugName;
    }

    provideDebugConfigurations() {
        const document =
            this.host.getActiveDocument();

        return document
            ? [this.createConfiguration(document)]
            : [];
    }

    resolveDebugConfiguration(
        folder,
        configuration
    ) {
        return this.resolve(configuration);
    }

    resolveDebugConfigurationWithSubstitutedVariables(
        folder,
        configuration
    ) {
        return this.resolve(configuration);
    }

    createConfiguration(document) {
        return {
            type: this.debugType,
            request: "launch",
            name: this.debugName,
            program: document.filePath,
            stopOnEntry: true,
            __clrsDocumentVersion:
                document.version
        };
    }

    resolve(configuration = {}) {
        const activeDocument =
            this.host.getActiveDocument();
        const program =
            !configuration.program ||
            configuration.program === "${file}"
                ? activeDocument?.filePath
                : configuration.program;

        if (
            typeof program !== "string" ||
            path.extname(program)
                .toLocaleLowerCase("en") !==
                ".clrs"
        ) {
            this.presenter.error(
                "Selecciona un archivo CLRS válido antes de iniciar la depuración."
            );
            return undefined;
        }

        return {
            ...configuration,
            type: this.debugType,
            request:
                configuration.request ??
                "launch",
            name:
                configuration.name ??
                this.debugName,
            program,
            stopOnEntry:
                configuration
                    .stopOnEntry ?? true,
            __clrsDocumentVersion:
                configuration
                    .__clrsDocumentVersion ??
                (
                    activeDocument
                        ?.filePath === program
                        ? activeDocument.version
                        : null
                )
        };
    }
}
