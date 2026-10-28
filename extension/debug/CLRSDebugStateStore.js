import path from "node:path";

export class CLRSDebugStateStore {

    constructor() {
        this.reset();
    }

    update(
        state,
        program,
        fallbackLocation
    ) {
        this.reset();

        const globals =
            normalizeVariables(
                state?.globals
            );
        const globalReference =
            this.registerVariables(globals);
        const runtimeFrames =
            Array.isArray(state?.frames)
                ? state.frames
                : [];

        for (
            let index =
                runtimeFrames.length - 1;
            index >= 0;
            index -= 1
        ) {
            const frame =
                runtimeFrames[index];
            const scopes = [];
            const parameters =
                normalizeVariables(
                    frame.parameters
                );
            const locals =
                normalizeVariables(
                    frame.locals
                );

            if (parameters.length > 0) {
                scopes.push({
                    name: "Parámetros",
                    presentationHint:
                        "arguments",
                    variablesReference:
                        this.registerVariables(
                            parameters
                        ),
                    expensive: false
                });
            }

            scopes.push({
                name: "Variables locales",
                presentationHint: "locals",
                variablesReference:
                    this.registerVariables(
                        locals
                    ),
                expensive: false
            });
            scopes.push({
                name: "Variables globales",
                variablesReference:
                    globalReference,
                expensive: false
            });
            this.addFrame({
                name:
                    frame.name ??
                    "Función CLRS",
                location:
                    frame.location ??
                    fallbackLocation,
                program,
                scopes
            });
        }

        this.addFrame({
            name: "Programa CLRS",
            location:
                state?.globalLocation ??
                fallbackLocation,
            program,
            scopes: [{
                name: "Variables globales",
                variablesReference:
                    globalReference,
                expensive: false
            }]
        });

        return this;
    }

    addFrame(options) {
        const id = this.nextFrameId++;
        const location =
            normalizeLocation(
                options.location
            );
        const program =
            String(options.program ?? "");
        const frame = {
            id,
            name: String(options.name),
            source: {
                name:
                    path.basename(program),
                path: program,
                sourceReference: 0
            },
            line: location.startLine,
            column: location.startColumn,
            endLine: location.endLine,
            endColumn: location.endColumn
        };

        this.frames.push(frame);
        this.scopesByFrame.set(
            id,
            options.scopes
        );
    }

    registerVariables(variables) {
        const reference =
            this.nextVariableReference++;
        const converted =
            variables.map(variable => {
                const children =
                    normalizeVariables(
                        variable.children
                    );
                const childReference =
                    children.length > 0
                        ? this.registerVariables(
                            children
                        )
                        : 0;

                return {
                    name: String(
                        variable.name ?? ""
                    ),
                    value: String(
                        variable.value ??
                        "indefinido"
                    ),
                    type: String(
                        variable.type ??
                        "indefinido"
                    ),
                    variablesReference:
                        childReference,
                    ...(
                        variable.indexed === true
                            ? {
                                indexedVariables:
                                    children.length
                            }
                            : children.length > 0
                                ? {
                                    namedVariables:
                                        children.length
                                }
                                : {}
                    )
                };
            });

        this.variablesByReference.set(
            reference,
            converted
        );

        return reference;
    }

    getStackFrames() {
        return [...this.frames];
    }

    getScopes(frameId) {
        return [
            ...(this.scopesByFrame
                .get(frameId) ?? [])
        ];
    }

    getVariables(reference) {
        return [
            ...(this.variablesByReference
                .get(reference) ?? [])
        ];
    }

    reset() {
        this.frames = [];
        this.scopesByFrame = new Map();
        this.variablesByReference =
            new Map();
        this.nextFrameId = 1;
        this.nextVariableReference = 1;
    }
}

function normalizeVariables(variables) {
    return Array.isArray(variables)
        ? variables.filter(variable =>
            variable &&
            typeof variable === "object"
        )
        : [];
}

function normalizeLocation(location) {
    const startLine =
        positiveInteger(
            location?.startLine
        ) ?? 1;
    const startColumn =
        positiveInteger(
            location?.startColumn
        ) ?? 1;

    return {
        startLine,
        startColumn,
        endLine:
            positiveInteger(
                location?.endLine
            ) ?? startLine,
        endColumn:
            positiveInteger(
                location?.endColumn
            ) ?? startColumn
    };
}

function positiveInteger(value) {
    return Number.isInteger(value) && value > 0
        ? value
        : null;
}
