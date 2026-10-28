import {
    LanguageRefactoringError
} from "../../errors/LanguageRefactoringError.js";
import {
    getSemanticNavigationIndex
} from "../../semantic/SemanticNavigationIndex.js";

const IDENTIFIER_PATTERN =
    /^[A-Za-z_][A-Za-z0-9_]*$/;
const RESERVED_NAMES = new Set([
    "si",
    "sino",
    "mientras",
    "para",
    "hasta",
    "bajando",
    "retornar",
    "leer",
    "escribir",
    "y",
    "o",
    "no",
    "VERDAD",
    "FALSO",
    "NULO"
]);

/**
 * Valida y planifica un renombrado sin depender de la API del editor.
 */
export class RenameService {

    prepareRename(request = {}) {
        const context =
            resolveRenameContext(
                request
            );

        return Object.freeze({
            name:
                context.occurrence.name,
            location:
                context.occurrence
                    .location
        });
    }

    planRename(request = {}) {
        const context =
            resolveRenameContext(
                request
            );
        const newName =
            request.newName;

        validateNewName(
            newName,
            context.occurrence.location
        );

        if (
            newName ===
            context.symbol.name
        ) {
            return createPlan(
                context.symbol.name,
                newName,
                []
            );
        }

        const occurrences =
            context.index.getReferences(
                context.symbol,
                {
                    includeDefinition: true
                }
            );

        validateCollisions(
            context,
            occurrences,
            newName
        );

        return createPlan(
            context.symbol.name,
            newName,
            occurrences.map(
                occurrence =>
                    Object.freeze({
                        location:
                            occurrence
                                .location,
                        newText: newName
                    })
            )
        );
    }
}

function resolveRenameContext(request) {
    const snapshot =
        request.snapshot;

    if (
        !snapshot?.ok ||
        snapshot.semanticModel == null
    ) {
        throw LanguageRefactoringError
            .invalidDocument();
    }

    const index =
        getSemanticNavigationIndex(
            snapshot
        );
    const occurrence =
        index.findOccurrence(
            normalizePosition(
                request.position
            )
        );

    if (occurrence == null) {
        throw LanguageRefactoringError
            .symbolRequired();
    }

    const symbol = occurrence.symbol;
    const definition =
        index.getDefinition(symbol);

    if (definition == null) {
        throw LanguageRefactoringError
            .builtin(
                occurrence.name,
                occurrence.location
            );
    }

    return {
        snapshot,
        index,
        occurrence,
        symbol,
        definition
    };
}

function validateNewName(
    newName,
    location
) {
    if (
        typeof newName !== "string" ||
        !IDENTIFIER_PATTERN.test(
            newName
        )
    ) {
        throw LanguageRefactoringError
            .invalidIdentifier(
                String(newName ?? ""),
                location
            );
    }

    if (RESERVED_NAMES.has(newName)) {
        throw LanguageRefactoringError
            .reservedIdentifier(
                newName,
                location
            );
    }
}

function validateCollisions(
    context,
    occurrences,
    newName
) {
    const scopes = new Set([
        context.symbol.scope
    ]);

    for (const occurrence of occurrences) {
        const scope =
            context.snapshot
                .semanticModel
                .getScope(
                    occurrence.node
                );

        if (scope != null) {
            scopes.add(scope);
        }
    }

    for (const scope of scopes) {
        const resolved =
            scope.resolve(newName);

        if (
            resolved != null &&
            resolved !== context.symbol
        ) {
            throw LanguageRefactoringError
                .collision(
                    newName,
                    context.occurrence
                        .location
                );
        }
    }
}

function createPlan(
    oldName,
    newName,
    edits
) {
    return Object.freeze({
        oldName,
        newName,
        edits:
            Object.freeze([
                ...edits
            ])
    });
}

function normalizePosition(position) {
    return {
        line: Number.isFinite(
            position?.line
        )
            ? position.line
            : -1,
        column: Number.isFinite(
            position?.column
        )
            ? position.column
            : -1
    };
}
