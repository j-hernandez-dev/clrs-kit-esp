import {
    NodeTypes
} from "../../ast/core/NodeTypes.js";
import {
    normalizeJavaScriptIdentifierResolver
} from "../JavaScriptIdentifierResolver.js";

export class RuntimeStateInstrumentation {

    constructor(options = {}) {
        const programKey =
            options.programKey ??
            globalThis.ProgramKey;

        this.registerGlobalsName =
            options.registerGlobalsName ??
            `registerRuntimeGlobals_${programKey}`;
        this.enterFrameName =
            options.enterFrameName ??
            `enterRuntimeFrame_${programKey}`;
        this.leaveFrameName =
            options.leaveFrameName ??
            `leaveRuntimeFrame_${programKey}`;
        this.identifierResolver =
            normalizeJavaScriptIdentifierResolver(
                options.identifierResolver
            );
    }

    registerGlobals(statements) {
        const bindings =
            collectBindingEntries(statements);

        if (bindings.length === 0) {
            return "";
        }

        return (
            `${this.registerGlobalsName}(` +
            `${bindingsProvider(
                bindings,
                this.identifierResolver
            )}` +
            ");\n"
        );
    }

    enterFrame(declaration) {
        const parameterBindings =
            (declaration.parameters ?? [])
                .map(parameter =>
                    bindingEntry(
                        parameter.identifier
                    )
                );
        const parameters =
            parameterBindings.map(
                binding => binding.name
            );
        const parameterSet =
            new Set(parameters);
        const localBindings =
            collectBindingEntries(
                declaration.body
                    ?.statements ?? []
            ).filter(binding =>
                !parameterSet.has(
                    binding.name
                )
            );
        const locals =
            localBindings.map(
                binding => binding.name
            );
        const bindings = [
            ...parameterBindings,
            ...localBindings
        ];

        return (
            `${this.enterFrameName}(` +
            `${JSON.stringify(
                declaration.identifier.name
            )}, ` +
            `${JSON.stringify(
                normalizeLocation(
                    declaration.location
                )
            )}, ` +
            `${JSON.stringify(parameters)}, ` +
            `${JSON.stringify(locals)}, ` +
            `${bindingsProvider(
                bindings,
                this.identifierResolver
            )}` +
            ");\n"
        );
    }

    leaveFrame() {
        return `${this.leaveFrameName}();\n`;
    }

    setIdentifierResolver(resolver) {
        const previous =
            this.identifierResolver;

        this.identifierResolver =
            normalizeJavaScriptIdentifierResolver(
                resolver
            );

        return previous;
    }
}

export function collectBindings(statements) {
    return collectBindingEntries(statements)
        .map(binding => binding.name);
}

function collectBindingEntries(statements) {
    const bindings = new Map();

    collectStatements(
        statements ?? [],
        bindings
    );

    return [...bindings.values()];
}

function collectStatements(statements, bindings) {
    for (const statement of statements ?? []) {
        if (!statement) {
            continue;
        }

        switch (statement.type) {
            case NodeTypes.ASSIGNMENT:
                addTarget(statement.left, bindings);
                break;

            case NodeTypes.ARRAY_DECLARATION:
            case NodeTypes.DECLARATION_ITEM:
                addIdentifier(
                    statement.identifier,
                    bindings
                );
                break;

            case NodeTypes.IF_STATEMENT:
                collectStatements(
                    statement.thenBlock
                        ?.statements,
                    bindings
                );

                for (
                    const branch
                    of statement
                        .elseIfBranches ?? []
                ) {
                    collectStatements(
                        branch.block
                            ?.statements,
                        bindings
                    );
                }

                collectStatements(
                    statement.elseBlock
                        ?.statements,
                    bindings
                );
                break;

            case NodeTypes.WHILE_STATEMENT:
                collectStatements(
                    statement.body?.statements,
                    bindings
                );
                break;

            case NodeTypes.FOR_STATEMENT:
                addTarget(
                    statement.initializer?.left,
                    bindings
                );
                collectStatements(
                    statement.body?.statements,
                    bindings
                );
                break;

            case NodeTypes.FUNCTION_DECLARATION:
                // Sus bindings pertenecen a otra activación.
                break;
        }
    }
}

function addTarget(target, bindings) {
    addIdentifier(
        target?.type === NodeTypes.ACCESS
            ? target.identifier
            : target,
        bindings
    );
}

function addIdentifier(identifier, bindings) {
    if (
        typeof identifier?.name === "string" &&
        identifier.name.length > 0
    ) {
        bindings.set(
            identifier.name,
            bindingEntry(identifier)
        );
    }
}

function bindingEntry(identifier) {
    return {
        name: identifier.name,
        identifier
    };
}

function bindingsProvider(bindings, resolver) {
    const entries = bindings.map(
        binding => {
            const emittedName =
                resolver.resolve(
                    binding.identifier
                );

            return (
                `${JSON.stringify(binding.name)}: ` +
                `typeof ${emittedName} === "undefined" ` +
                `? undefined : ${emittedName}`
            );
        }
    );

    return `() => ({${entries.join(", ")}})`;
}

function normalizeLocation(location) {
    const startLine =
        positiveInteger(
            location?.startLine
        );

    if (startLine == null) {
        return null;
    }

    return {
        startLine,
        startColumn:
            positiveInteger(
                location?.startColumn
            ) ?? 1,
        endLine:
            positiveInteger(
                location?.endLine
            ) ?? startLine,
        endColumn:
            positiveInteger(
                location?.endColumn
            ) ?? 1
    };
}

function positiveInteger(value) {
    return Number.isInteger(value) && value > 0
        ? value
        : null;
}
