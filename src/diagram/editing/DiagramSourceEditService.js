import {
    NodeTypes
} from "../../ast/core/NodeTypes.js";
import {
    parseSource
} from "../../language/LanguageFrontend.js";
import {
    EMPTY_FUNCTION_BODY_COMMENT
} from "../../language/EmptyFunctionBody.js";
import {
    DiagramEditingError
} from "../../errors/DiagramEditingError.js";
import {
    DIAGRAM_DELETE_IMPACTS,
    DIAGRAM_EDITABLE_FIGURES,
    DIAGRAM_NODE_EDIT_OPERATIONS,
    DIAGRAM_STRUCTURAL_FIGURES,
    getDiagramEditFields
} from "./DiagramEditSchema.js";

const MAX_FIELD_LENGTH = 4096;
const MAX_TOTAL_LENGTH = 8192;

/**
 * Convierte una intención visual en un plan neutral de offsets después de
 * volver a analizar la versión exacta del fragmento CLRS enlazado.
 */
export class DiagramSourceEditService {

    plan(request = {}) {
        const sourceCode = request.sourceCode;
        const intent = validateIntent(
            request.intent
        );

        if (typeof sourceCode !== "string") {
            throw DiagramEditingError
                .invalidIntent(
                    "La fuente debe ser una cadena."
                );
        }

        validateVersion(request);

        const sourceOrigin = normalizeOrigin(
            request.sourceOrigin
        );
        const ast = parseSafely(
            sourceCode,
            intent.source?.location
        );
        const structure =
            collectEditableStructure(
                ast,
                sourceOrigin
            );
        const lines = indexLines(sourceCode);
        const operation = intent.operation;
        const target = operation ===
            DIAGRAM_NODE_EDIT_OPERATIONS
                .CREATE_FUNCTION
            ? resolveFunctionCreation(
                ast,
                sourceOrigin,
                request,
                intent
            )
            : operation ===
                DIAGRAM_NODE_EDIT_OPERATIONS.INSERT
                ? resolveInsertionPoint(
                structure,
                sourceOrigin,
                intent
                )
                : resolveEntity(
                structure,
                intent
                );
        const edit = createSourceEdit(
            sourceCode,
            lines,
            target,
            intent
        );
        const nextSource = applyEdit(
            sourceCode,
            edit
        );
        const nextAst = parseSafely(
            nextSource,
            target.location ?? null
        );

        const validFunctionEnvelope =
            operation ===
                DIAGRAM_NODE_EDIT_OPERATIONS
                    .CREATE_FUNCTION
                ? hasCreatedFunctionEnvelope(
                    ast,
                    nextAst,
                    intent.values.identifier
                )
                : operation ===
                        DIAGRAM_NODE_EDIT_OPERATIONS
                            .DELETE &&
                    target.figure ===
                        DIAGRAM_STRUCTURAL_FIGURES
                            .FUNCTION_DECLARATION
                    ? hasDeletedFunctionEnvelope(
                        ast,
                        nextAst,
                        target
                    )
                : operation ===
                        DIAGRAM_NODE_EDIT_OPERATIONS
                            .UPDATE &&
                    target.figure ===
                        DIAGRAM_STRUCTURAL_FIGURES
                            .FUNCTION_DECLARATION
                    ? hasUpdatedFunctionEnvelope(
                        ast,
                        nextAst,
                        target,
                        intent.values
                    )
                : sameFunctionEnvelope(
                    ast,
                    nextAst
                );

        if (!validFunctionEnvelope) {
            throw DiagramEditingError
                .invalidResult(
                    [{
                        code:
                            "CLRS_DIAGRAM_EDIT_SCOPE_CHANGED",
                        publicMessage:
                            "La edición cambiaría la declaración o el ámbito de una función."
                    }],
                    target.location ?? null
                );
        }

        return deepFreeze({
            schemaVersion: 1,
            operation,
            identityId: intent.identityId,
            expectedDocumentVersion:
                request.expectedDocumentVersion,
            sourceOrigin,
            edits: [{
                ...edit,
                expectedText:
                    sourceCode.slice(
                        edit.startOffset,
                        edit.endOffset
                    )
            }]
        });
    }
}

function resolveFunctionCreation(
    ast,
    sourceOrigin,
    request,
    intent
) {
    if (
        request.wholeDocument !== true ||
        sourceOrigin.startLine !== 1 ||
        sourceOrigin.startColumn !== 1
    ) {
        throw DiagramEditingError
            .functionRequiresWholeDocument();
    }

    validateValues(
        intent.figure,
        intent.values,
        null
    );

    const identifier =
        intent.values.identifier.trim();
    const duplicate = (ast?.statements ?? [])
        .some(statement =>
            statement.type ===
                NodeTypes.FUNCTION_DECLARATION &&
            statement.identifier?.name ===
                identifier
        );

    if (duplicate) {
        throw DiagramEditingError
            .duplicateFunction(identifier);
    }

    const principal = (ast?.statements ?? [])
        .find(statement =>
            statement.type ===
                NodeTypes.FUNCTION_DECLARATION &&
            statement.identifier?.name ===
                "PRINCIPAL"
        ) ?? null;

    return {
        kind: "function-creation",
        principal,
        location: null
    };
}

function parseSafely(sourceCode, location) {
    try {
        return parseSource(sourceCode).ast;
    } catch (error) {
        throw DiagramEditingError
            .invalidResult(
                [error],
                location
            );
    }
}

function resolveEntity(structure, intent) {
    const entity = structure.entities.find(candidate =>
        candidate.identityId ===
            intent.identityId
    );

    if (
        !entity ||
        entity.figure !== intent.figure ||
        entity.sourceType !==
            intent.source?.type ||
        !sameLocation(
            entity.location,
            intent.source?.location
        ) ||
        !sameNodeContext(
            entity,
            intent.context
        ) ||
        !/^N\d+$/u.test(intent.nodeId)
    ) {
        throw DiagramEditingError
            .entityNotFound(
                intent.source?.location
            );
    }

    if (entity.declarationProxy === true) {
        throw DiagramEditingError
            .readOnlyProjection(
                entity.location
            );
    }

    if (
        intent.operation ===
            DIAGRAM_NODE_EDIT_OPERATIONS.UPDATE
    ) {
        validateValues(
            intent.figure,
            intent.values,
            entity.location
        );
    } else {
        validateDeletion(
            structure,
            entity,
            intent
        );
    }

    return entity;
}

function validateDeletion(
    structure,
    entity,
    intent
) {
    const confirmation = intent.confirmation;
    const expectedImpact =
        deletionImpact(entity);

    if (
        intent.values !== null ||
        confirmation == null ||
        typeof confirmation !== "object" ||
        Array.isArray(confirmation) ||
        Object.keys(confirmation).length !== 2 ||
        confirmation.acknowledged !== true ||
        confirmation.impact !==
            expectedImpact
    ) {
        throw DiagramEditingError
            .invalidIntent(
                "La eliminación requiere confirmar su impacto estructural exacto."
            );
    }

    if (
        expectedImpact ===
            DIAGRAM_DELETE_IMPACTS.BRANCH ||
        expectedImpact ===
            DIAGRAM_DELETE_IMPACTS.FUNCTION
    ) {
        return;
    }

    const block = structure.blocks.get(
        entity.containerId
    );
    const rootContainer =
        entity.containerId ===
            "__main__/body" ||
        entity.containerId ===
            "top_level/body";
    const replaceableSoleReturn =
        isOnlyRootFunctionStatement(
            entity
        );

    if (
        !block ||
        (
            !rootContainer &&
            block.statements.length <= 1 &&
            !replaceableSoleReturn
        )
    ) {
        throw DiagramEditingError
            .emptyRequiredBlock(
                entity.location
            );
    }
}

function deletionImpact(entity) {
    if (
        entity.figure ===
            DIAGRAM_STRUCTURAL_FIGURES
                .FUNCTION_DECLARATION
    ) {
        return DIAGRAM_DELETE_IMPACTS.FUNCTION;
    }

    if (isSoleElseBranchStatement(entity)) {
        return DIAGRAM_DELETE_IMPACTS.BRANCH;
    }

    if (
        entity.figure ===
            DIAGRAM_EDITABLE_FIGURES.IF &&
        entity.partOrdinal > 0
    ) {
        return DIAGRAM_DELETE_IMPACTS.BRANCH;
    }

    if (
        [
            DIAGRAM_EDITABLE_FIGURES.IF,
            DIAGRAM_EDITABLE_FIGURES.WHILE,
            DIAGRAM_EDITABLE_FIGURES.FOR_TO,
            DIAGRAM_EDITABLE_FIGURES.FOR_DOWNTO
        ].includes(entity.figure)
    ) {
        return DIAGRAM_DELETE_IMPACTS
            .CONTROL_BLOCK;
    }

    return DIAGRAM_DELETE_IMPACTS.STATEMENT;
}

function resolveInsertionPoint(
    structure,
    sourceOrigin,
    intent
) {
    if (sourceOrigin.startColumn !== 1) {
        throw DiagramEditingError
            .unsafeScope();
    }

    const insertion = intent.insertion;
    const block = structure.blocks.get(
        insertion?.containerId
    );
    const validKeys = [
        "scopeId",
        "containerId",
        "branch",
        "index",
        "position"
    ];
    const receivedKeys = Object.keys(
        insertion ?? {}
    );

    if (
        !block ||
        receivedKeys.length !==
            validKeys.length ||
        receivedKeys.some(key =>
            !validKeys.includes(key)
        ) ||
        insertion.scopeId !== block.scopeId ||
        insertion.branch !== block.branch ||
        !Number.isInteger(insertion.index) ||
        insertion.index < 0 ||
        insertion.index >
            block.statements.length ||
        insertion.position !==
            insertionPosition(
                insertion.index,
                block.statements.length
            ) ||
        typeof intent.relation !== "string" ||
        !/^[a-z-]{1,32}$/u.test(
            intent.relation
        )
    ) {
        throw DiagramEditingError
            .insertionNotFound();
    }

    if (
        intent.figure ===
            DIAGRAM_EDITABLE_FIGURES.RETURN &&
        !String(block.scopeId)
            .startsWith("function_")
    ) {
        throw DiagramEditingError
            .invalidIntent(
                "Retornar sólo puede insertarse dentro de una función."
            );
    }

    validateValues(
        intent.figure,
        intent.values,
        null
    );

    return {
        kind: "insertion",
        ...block,
        index: insertion.index,
        position: insertion.position,
        location: null
    };
}

function registerBlock(
    blocks,
    containerId,
    scopeId,
    branch,
    statements,
    options = {}
) {
    blocks.set(
        containerId,
        Object.freeze({
            containerId,
            scopeId,
            branch,
            statements:
                Object.freeze([
                    ...(statements ?? [])
                ]),
            emptyInsertionAnchor:
                options.emptyInsertionAnchor ??
                null,
            missingElseOwner:
                options.missingElseOwner ??
                null,
            branchHeaderLocation:
                options.branchHeaderLocation ??
                null
        })
    );
}

function insertionPosition(index, length) {
    if (length === 0) {
        return "end";
    }

    if (index === 0) {
        return "start";
    }

    if (index === length) {
        return "end";
    }

    return "between";
}

function sameNodeContext(entity, context) {
    return (
        context != null &&
        entity.scopeId === context.scopeId &&
        entity.containerId ===
            context.containerId &&
        entity.branch === context.branch &&
        entity.statementIndex ===
            context.statementIndex
    );
}

function statementIndexFromPath(path) {
    const match = path.match(
        /\/statement:(\d+)$/u
    );

    return match
        ? Number(match[1])
        : null;
}

function collectEditableStructure(
    ast,
    sourceOrigin
) {
    const entities = [];
    const blocks = new Map();
    const statements = ast?.statements ?? [];

    let functionIndex = 0;

    for (const statement of statements) {
        if (
            statement.type !==
                NodeTypes.FUNCTION_DECLARATION
        ) {
            continue;
        }

        const scopeId =
            `function_${statement.identifier?.name ?? "anonymous"}`;

        collectFunctionDeclaration(
            statement,
            functionIndex,
            scopeId,
            sourceOrigin,
            entities
        );
        functionIndex += 1;

        collectBlock(
            statement.body?.statements,
            `${scopeId}/body`,
            scopeId,
            "body",
            sourceOrigin,
            entities,
            blocks,
            {
                emptyInsertionAnchor:
                    statement
            }
        );
    }

    const hasFunctions = statements.some(
        statement =>
            statement.type ===
                NodeTypes.FUNCTION_DECLARATION
    );
    const scopeId = hasFunctions
        ? "top_level"
        : "__main__";
    const topLevelStatements = [];
    let insertedMainCall = false;

    for (const statement of statements) {
        if (
            statement.type ===
                NodeTypes.FUNCTION_DECLARATION
        ) {
            if (
                statement.identifier?.name ===
                    "PRINCIPAL" &&
                !insertedMainCall
            ) {
                insertedMainCall = true;
                topLevelStatements.push({
                    statement,
                    synthetic: true
                });
            }

            continue;
        }

        topLevelStatements.push({
            statement,
            synthetic: false
        });
    }

    registerBlock(
        blocks,
        `${scopeId}/body`,
        scopeId,
        "body",
        topLevelStatements.map(
            item => item.statement
        ),
        {
            emptyInsertionAnchor:
                statements.find(statement =>
                    statement.type ===
                        NodeTypes
                            .FUNCTION_DECLARATION
                ) ?? null
        }
    );

    for (
        const [index, item]
        of topLevelStatements.entries()
    ) {
        if (item.synthetic) {
            collectPrincipalDeclarationProxy(
                item.statement,
                `${scopeId}/body/statement:${index}`,
                scopeId,
                sourceOrigin,
                entities,
                blocks,
                statements
            );
            continue;
        }

        collectStatement(
            item.statement,
            `${scopeId}/body/statement:${index}`,
            scopeId,
            sourceOrigin,
            entities,
            blocks
        );
    }

    return { entities, blocks };
}

function collectFunctionDeclaration(
    statement,
    functionIndex,
    scopeId,
    sourceOrigin,
    entities
) {
    const location =
        statement.identifier?.location ??
        statement.location;

    entities.push({
        identityId:
            `node:${scopeId}/declaration`,
        figure:
            DIAGRAM_STRUCTURAL_FIGURES
                .FUNCTION_DECLARATION,
        sourceType:
            NodeTypes.FUNCTION_DECLARATION,
        statement,
        functionIndex,
        partOrdinal: 0,
        scopeId,
        containerId: `${scopeId}/body`,
        branch: "body",
        blockStatementCount:
            statement.body?.statements
                ?.length ?? 0,
        statementIndex: null,
        localLocation: location,
        location: shiftLocation(
            location,
            sourceOrigin
        )
    });
}

function collectPrincipalDeclarationProxy(
    statement,
    path,
    scopeId,
    sourceOrigin,
    entities,
    blocks,
    programStatements
) {
    const location =
        statement.identifier?.location ??
        statement.location;
    const containerId = path.replace(
        /\/statement:\d+$/u,
        ""
    );
    const functionIndex = (programStatements ?? [])
        .filter(candidate =>
            candidate.type ===
                NodeTypes.FUNCTION_DECLARATION
        )
        .findIndex(candidate =>
            candidate === statement
        );

    entities.push({
        identityId: `node:${path}`,
        figure:
            DIAGRAM_EDITABLE_FIGURES
                .FUNCTION_CALL,
        sourceType:
            NodeTypes.FUNCTION_DECLARATION,
        statement,
        declarationProxy: true,
        functionIndex,
        partOrdinal: 0,
        scopeId,
        containerId,
        branch:
            blocks.get(containerId)?.branch ??
            "body",
        statementIndex:
            statementIndexFromPath(path),
        localLocation: location,
        location: shiftLocation(
            location,
            sourceOrigin
        )
    });
}

function collectBlock(
    statements,
    containerId,
    scopeId,
    branch,
    sourceOrigin,
    entities,
    blocks,
    options = {}
) {
    registerBlock(
        blocks,
        containerId,
        scopeId,
        branch,
        statements ?? [],
        options
    );

    for (
        const [index, statement]
        of (statements ?? []).entries()
    ) {
        collectStatement(
            statement,
            `${containerId}/statement:${index}`,
            scopeId,
            sourceOrigin,
            entities,
            blocks
        );
    }
}

function collectStatement(
    statement,
    path,
    scopeId,
    sourceOrigin,
    entities,
    blocks
) {
    const add = (
        figure,
        location = statement.location,
        ordinal = 0
    ) => {
        const containerId = path.replace(
            /\/statement:\d+(?:\/part:\d+)?$/u,
            ""
        );

        entities.push({
            identityId:
                `node:${path}` +
                (ordinal === 0
                    ? ""
                    : `/part:${ordinal}`),
            figure,
            sourceType:
                statement.type,
            statement,
            partOrdinal: ordinal,
            scopeId,
            containerId,
            branch:
                blocks.get(
                    containerId
                )?.branch ?? null,
            blockStatementCount:
                blocks.get(containerId)
                    ?.statements.length ?? null,
            branchHeaderLocation:
                blocks.get(containerId)
                    ?.branchHeaderLocation ??
                null,
            statementIndex:
                statementIndexFromPath(path),
            localLocation: location,
            location: shiftLocation(
                location,
                sourceOrigin
            )
        });
    };

    switch (statement.type) {
        case NodeTypes.ASSIGNMENT:
            add(
                DIAGRAM_EDITABLE_FIGURES
                    .ASSIGNMENT
            );
            return;

        case NodeTypes.FUNCTION_CALL:
            add(
                DIAGRAM_EDITABLE_FIGURES
                    .FUNCTION_CALL
            );
            return;

        case NodeTypes.READ_STATEMENT:
            add(
                DIAGRAM_EDITABLE_FIGURES.READ
            );
            return;

        case NodeTypes.WRITE_STATEMENT:
            add(
                DIAGRAM_EDITABLE_FIGURES.WRITE
            );
            return;

        case NodeTypes.RETURN_STATEMENT:
            add(
                DIAGRAM_EDITABLE_FIGURES.RETURN
            );
            return;

        case NodeTypes.IF_STATEMENT:
            add(DIAGRAM_EDITABLE_FIGURES.IF);
            collectBlock(
                statement.thenBlock?.statements,
                `${path}/then`,
                scopeId,
                "then",
                sourceOrigin,
                entities,
                blocks
            );

            for (
                const [index, branch]
                of (statement.elseIfBranches ?? [])
                    .entries()
            ) {
                add(
                    DIAGRAM_EDITABLE_FIGURES.IF,
                    branch.location ??
                        branch.condition?.location ??
                        statement.location,
                    index + 1
                );
                collectBlock(
                    branch.block?.statements,
                    `${path}/else-if:${index + 1}`,
                    scopeId,
                    "else-if",
                    sourceOrigin,
                    entities,
                    blocks
                );
            }

            collectBlock(
                statement.elseBlock?.statements,
                `${path}/else`,
                scopeId,
                "else",
                sourceOrigin,
                entities,
                blocks,
                {
                    missingElseOwner:
                        statement.elseBlock == null
                            ? statement
                            : null,
                    branchHeaderLocation:
                        statement.elseBlock
                            ?.location ?? null
                }
            );
            return;

        case NodeTypes.WHILE_STATEMENT:
            add(
                DIAGRAM_EDITABLE_FIGURES.WHILE
            );
            collectBlock(
                statement.body?.statements,
                `${path}/body:while`,
                scopeId,
                "body",
                sourceOrigin,
                entities,
                blocks
            );
            return;

        case NodeTypes.FOR_STATEMENT: {
            const figure =
                statement.increment?.right
                    ?.operator === "+"
                    ? DIAGRAM_EDITABLE_FIGURES
                        .FOR_TO
                    : DIAGRAM_EDITABLE_FIGURES
                        .FOR_DOWNTO;

            add(figure);
            collectBlock(
                statement.body?.statements,
                `${path}/body:for`,
                scopeId,
                "body",
                sourceOrigin,
                entities,
                blocks
            );
            return;
        }

        default:
            return;
    }
}

function validateVersion(request) {
    if (
        !Number.isInteger(
            request.expectedDocumentVersion
        ) ||
        !Number.isInteger(
            request.documentVersion
        )
    ) {
        throw DiagramEditingError
            .invalidIntent(
                "La versión del documento es obligatoria."
            );
    }

    if (
        request.expectedDocumentVersion !==
        request.documentVersion
    ) {
        throw DiagramEditingError
            .staleDocument();
    }
}

function validateIntent(intent) {
    if (
        intent == null ||
        typeof intent !== "object" ||
        intent.schemaVersion !== 1 ||
        typeof intent.identityId !== "string" ||
        intent.identityId === "" ||
        typeof intent.figure !== "string" ||
        !Object.values(
            DIAGRAM_NODE_EDIT_OPERATIONS
        ).includes(intent.operation)
    ) {
        throw DiagramEditingError
            .invalidIntent();
    }

    const inserting = intent.operation ===
        DIAGRAM_NODE_EDIT_OPERATIONS.INSERT;
    const insertingFromEdge =
        inserting &&
        /^E\d+$/u.test(intent.edgeId ?? "") &&
        intent.identityId ===
            `edge:${intent.edgeId}`;
    const materializingImplicitReturn =
        inserting &&
        intent.materialization ===
            "implicit-return" &&
        intent.figure ===
            DIAGRAM_EDITABLE_FIGURES.RETURN &&
        /^N\d+$/u.test(intent.nodeId ?? "") &&
        intent.identityId.startsWith("node:");
    const creatingFunction =
        intent.operation ===
            DIAGRAM_NODE_EDIT_OPERATIONS
                .CREATE_FUNCTION;

    if (
        (
            inserting &&
            (
                (
                    !insertingFromEdge &&
                    !materializingImplicitReturn
                ) ||
                intent.insertion == null
            )
        ) ||
        (
            creatingFunction &&
            (
                intent.identityId !==
                    "document:functions" ||
                intent.figure !==
                    DIAGRAM_STRUCTURAL_FIGURES
                        .FUNCTION_DECLARATION
            )
        ) ||
        (
            !inserting &&
            !creatingFunction &&
            !/^N\d+$/u.test(
                intent.nodeId ?? ""
            )
        )
    ) {
        throw DiagramEditingError
            .invalidIntent();
    }

    return intent;
}

function validateValues(
    figure,
    values,
    location
) {
    if (
        values == null ||
        typeof values !== "object" ||
        Array.isArray(values)
    ) {
        throw DiagramEditingError
            .invalidIntent(
                "La actualización requiere valores."
            );
    }

    const fields = getDiagramEditFields(
        figure
    );
    const expectedNames = fields.map(
        field => field.name
    );
    const receivedNames = Object.keys(values);

    if (
        receivedNames.length !==
            expectedNames.length ||
        receivedNames.some(name =>
            !expectedNames.includes(name)
        )
    ) {
        throw DiagramEditingError
            .invalidIntent(
                "Los campos no corresponden con la figura."
            );
    }

    let totalLength = 0;

    for (const field of fields) {
        const value = values[field.name];

        if (
            typeof value !== "string" ||
            (field.required &&
                value.trim() === "") ||
            value.length > MAX_FIELD_LENGTH ||
            /[\0\r\n]/u.test(value)
        ) {
            throw DiagramEditingError
                .invalidValue(
                    field.name,
                    location
                );
        }

        totalLength += value.length;
    }

    if (totalLength > MAX_TOTAL_LENGTH) {
        throw DiagramEditingError
            .invalidIntent(
                "La edición excede el tamaño permitido."
            );
    }
}

function createSourceEdit(
    sourceCode,
    lines,
    target,
    intent
) {
    if (
        intent.operation ===
            DIAGRAM_NODE_EDIT_OPERATIONS
                .CREATE_FUNCTION
    ) {
        return createFunctionEdit(
            sourceCode,
            lines,
            target,
            intent
        );
    }

    if (
        intent.operation ===
            DIAGRAM_NODE_EDIT_OPERATIONS.INSERT
    ) {
        return createInsertEdit(
            sourceCode,
            lines,
            target,
            intent
        );
    }

    const lineIndex =
        target.localLocation.startLine - 1;
    const line = lines[lineIndex];

    if (!line) {
        throw DiagramEditingError
            .entityNotFound(target.location);
    }

    return intent.operation ===
        DIAGRAM_NODE_EDIT_OPERATIONS.UPDATE
        ? createUpdateEdit(
            sourceCode,
            lines,
            lineIndex,
            target,
            intent
        )
        : createDeleteEdit(
            sourceCode,
            lines,
            lineIndex,
            target
        );
}

function createFunctionEdit(
    sourceCode,
    lines,
    target,
    intent
) {
    const eol = sourceCode.includes("\r\n")
        ? "\r\n"
        : "\n";
    const identifier =
        intent.values.identifier.trim();
    const parameters =
        intent.values.parameters.trim();
    const indentationUnit =
        inferIndentationUnit(
            sourceCode,
            ""
        );
    const rendered = [
        `${identifier}(${parameters})`,
        `${indentationUnit}retornar 0`
    ].join(eol);
    const offset = target.principal
        ? lineStartOffset(
            lines,
            target.principal
        )
        : sourceCode.length;
    const prefix = sourceCode.slice(0, offset);
    const needsLeadingSeparator =
        prefix.length > 0 &&
        !prefix.endsWith(eol + eol);
    const leading = needsLeadingSeparator
        ? prefix.endsWith(eol)
            ? eol
            : eol + eol
        : "";
    const trailing = target.principal
        ? eol + eol
        : sourceCode.length === 0
            ? eol
            : "";

    return {
        startOffset: offset,
        endOffset: offset,
        newText:
            leading + rendered + trailing
    };
}

function createInsertEdit(
    sourceCode,
    lines,
    block,
    intent
) {
    if (block.missingElseOwner != null) {
        return createMissingElseInsertEdit(
            sourceCode,
            lines,
            block,
            intent
        );
    }

    if (block.statements.length === 0) {
        return createEmptyBlockInsertEdit(
            sourceCode,
            lines,
            block,
            intent
        );
    }

    const offset = block.index <
        block.statements.length
        ? lineStartOffset(
            lines,
            block.statements[
                block.index
            ]
        )
        : statementSubtreeEndOffset(
            sourceCode,
            lines,
            block.statements.at(-1)
        );
    const indentation = blockIndentation(
        sourceCode,
        lines,
        block.statements
    );
    const indentationUnit =
        inferIndentationUnit(
            sourceCode,
            indentation
        );
    const eol = sourceCode.includes("\r\n")
        ? "\r\n"
        : "\n";
    const statementLines =
        buildInsertedStatementLines(
            intent.figure,
            intent.values,
            indentationUnit
        );
    const rendered = statementLines
        .map(line => indentation + line)
        .join(eol);
    const atEnd = offset === sourceCode.length;
    let newText;

    if (!atEnd) {
        newText = rendered + eol;
    } else if (
        sourceCode.endsWith("\n") ||
        sourceCode === ""
    ) {
        newText = rendered + eol;
    } else {
        newText = eol + rendered;
    }

    return {
        startOffset: offset,
        endOffset: offset,
        newText
    };
}

function createMissingElseInsertEdit(
    sourceCode,
    lines,
    block,
    intent
) {
    const owner = block.missingElseOwner;
    const headerLine = lines[
        owner?.location?.startLine - 1
    ];

    if (!headerLine) {
        throw DiagramEditingError
            .insertionNotFound();
    }

    const header = sourceCode.slice(
        headerLine.startOffset,
        headerLine.contentEndOffset
    );
    const indentation =
        header.match(/^[\t ]*/u)?.[0] ?? "";
    const indentationUnit =
        inferIndentationUnit(
            sourceCode,
            indentation
        );
    const eol = sourceCode.includes("\r\n")
        ? "\r\n"
        : "\n";
    const statementLines =
        buildInsertedStatementLines(
            intent.figure,
            intent.values,
            indentationUnit
        );
    const rendered = [
        `${indentation}sino`,
        ...statementLines.map(line =>
            indentation + indentationUnit + line
        )
    ].join(eol);
    const offset = statementSubtreeEndOffset(
        sourceCode,
        lines,
        owner
    );
    const atEnd = offset === sourceCode.length;
    let newText;

    if (!atEnd) {
        newText = rendered + eol;
    } else if (
        sourceCode.endsWith("\n") ||
        sourceCode === ""
    ) {
        newText = rendered + eol;
    } else {
        newText = eol + rendered;
    }

    return {
        startOffset: offset,
        endOffset: offset,
        newText
    };
}

function createEmptyBlockInsertEdit(
    sourceCode,
    lines,
    block,
    intent
) {
    if (
        String(block.scopeId)
            .startsWith("function_") &&
        block.containerId ===
            `${block.scopeId}/body`
    ) {
        return createEmptyFunctionInsertEdit(
            sourceCode,
            lines,
            block,
            intent
        );
    }

    const rootContainer =
        block.containerId ===
            "top_level/body" ||
        block.containerId ===
            "__main__/body";

    if (!rootContainer) {
        throw DiagramEditingError
            .insertionNotFound();
    }

    const eol = sourceCode.includes("\r\n")
        ? "\r\n"
        : "\n";
    const rendered = buildInsertedStatementLines(
        intent.figure,
        intent.values,
        inferIndentationUnit(sourceCode, "")
    ).join(eol);
    const offset = block.emptyInsertionAnchor
        ? lineStartOffset(
            lines,
            block.emptyInsertionAnchor
        )
        : sourceCode.length;
    const prefix = sourceCode.slice(0, offset);
    const suffix = sourceCode.slice(offset);
    const leading =
        prefix.length > 0 &&
        !prefix.endsWith("\n")
            ? eol
            : "";
    const trailing = suffix.length > 0
        ? eol + eol
        : eol;

    return {
        startOffset: offset,
        endOffset: offset,
        newText:
            leading + rendered + trailing
    };
}

function createEmptyFunctionInsertEdit(
    sourceCode,
    lines,
    block,
    intent
) {
    const headerLineIndex =
        block.emptyInsertionAnchor
            ?.location?.startLine - 1;
    const markerLine =
        lines[headerLineIndex + 1];

    if (!markerLine) {
        throw DiagramEditingError
            .insertionNotFound();
    }

    const markerText = sourceCode.slice(
        markerLine.startOffset,
        markerLine.contentEndOffset
    );
    const indentation =
        markerText.match(/^[\t ]*/u)?.[0] ??
        "";

    if (
        markerText.trim() !==
            EMPTY_FUNCTION_BODY_COMMENT ||
        indentation === ""
    ) {
        throw DiagramEditingError
            .insertionNotFound();
    }

    const eol = sourceCode.includes("\r\n")
        ? "\r\n"
        : "\n";
    const indentationUnit =
        inferIndentationUnit(
            sourceCode,
            indentation
        );
    const rendered = buildInsertedStatementLines(
        intent.figure,
        intent.values,
        indentationUnit
    )
        .map(line => indentation + line)
        .join(eol);

    return {
        startOffset: markerLine.startOffset,
        endOffset: markerLine.contentEndOffset,
        newText: rendered
    };
}

function buildInsertedStatementLines(
    figure,
    values,
    indentationUnit
) {
    const header = buildStatement(
        figure,
        values,
        ""
    );

    switch (figure) {
        case DIAGRAM_EDITABLE_FIGURES.IF:
        case DIAGRAM_EDITABLE_FIGURES.WHILE:
            return [
                header,
                `${indentationUnit}escribir resultado`
            ];

        case DIAGRAM_EDITABLE_FIGURES.FOR_TO:
        case DIAGRAM_EDITABLE_FIGURES.FOR_DOWNTO:
            return [
                header,
                `${indentationUnit}escribir ${values.variable.trim()}`
            ];

        default:
            return [header];
    }
}

function lineStartOffset(lines, statement) {
    const line = lines[
        statement?.location?.startLine - 1
    ];

    if (!line) {
        throw DiagramEditingError
            .insertionNotFound();
    }

    return line.startOffset;
}

function statementSubtreeEndOffset(
    sourceCode,
    lines,
    statement
) {
    const lineIndex =
        statement?.location?.startLine - 1;
    const line = lines[lineIndex];

    if (!line) {
        throw DiagramEditingError
            .insertionNotFound();
    }

    const header = sourceCode.slice(
        line.startOffset,
        line.contentEndOffset
    );
    const baseIndent = indentationWidth(
        header
    );

    for (
        let index = lineIndex + 1;
        index < lines.length;
        index += 1
    ) {
        const candidate = lines[index];
        const text = sourceCode.slice(
            candidate.startOffset,
            candidate.contentEndOffset
        );

        if (text.trim() === "") {
            continue;
        }

        const indent = indentationWidth(text);
        const continuation =
            statement.type ===
                NodeTypes.IF_STATEMENT &&
            indent === baseIndent &&
            /^\s*sino(?:\s+si\b)?/iu.test(text);

        if (indent <= baseIndent && !continuation) {
            return candidate.startOffset;
        }
    }

    return sourceCode.length;
}

function blockIndentation(
    sourceCode,
    lines,
    statements
) {
    const line = lines[
        statements[0]?.location
            ?.startLine - 1
    ];

    if (!line) {
        throw DiagramEditingError
            .insertionNotFound();
    }

    return sourceCode.slice(
        line.startOffset,
        line.contentEndOffset
    ).match(/^[\t ]*/u)?.[0] ?? "";
}

function inferIndentationUnit(
    sourceCode,
    baseIndentation
) {
    const candidates = sourceCode
        .split(/\r?\n/u)
        .filter(line => line.trim() !== "")
        .map(line =>
            line.match(/^[\t ]*/u)?.[0] ?? ""
        )
        .filter(indentation =>
            indentation.startsWith(
                baseIndentation
            ) &&
            indentation.length >
                baseIndentation.length
        )
        .map(indentation =>
            indentation.slice(
                baseIndentation.length
            )
        )
        .sort(
            (left, right) =>
                indentationWidth(left) -
                indentationWidth(right)
        );

    return candidates[0] ?? "    ";
}

function createUpdateEdit(
    sourceCode,
    lines,
    lineIndex,
    entity,
    intent
) {
    const line = lines[lineIndex];
    const endLine = lines[
        updateEndLine(entity) - 1
    ];

    if (!line || !endLine) {
        throw DiagramEditingError
            .entityNotFound(
                entity.location
            );
    }

    const content = sourceCode.slice(
        line.startOffset,
        endLine.contentEndOffset
    );
    const indentation =
        content.match(/^[\t ]*/u)?.[0] ?? "";

    return {
        startOffset:
            line.startOffset +
            indentation.length,
        endOffset:
            endLine.contentEndOffset,
        newText: buildStatement(
            entity.figure,
            intent.values,
            content.slice(
                indentation.length
            )
        )
    };
}

function updateEndLine(entity) {
    const multilineFigures = [
        DIAGRAM_EDITABLE_FIGURES.RETURN,
        DIAGRAM_EDITABLE_FIGURES.ASSIGNMENT,
        DIAGRAM_EDITABLE_FIGURES.READ,
        DIAGRAM_EDITABLE_FIGURES.WRITE,
        DIAGRAM_EDITABLE_FIGURES.FUNCTION_CALL
    ];
    const startLine =
        entity.localLocation.startLine;

    return multilineFigures.includes(
        entity.figure
    )
        ? entity.statement?.location
            ?.endLine ?? startLine
        : startLine;
}

function buildStatement(
    figure,
    values,
    oldStatement
) {
    const value = name =>
        values[name].trim();

    switch (figure) {
        case DIAGRAM_EDITABLE_FIGURES.RETURN:
            return `retornar ${value("expression")}`;
        case DIAGRAM_EDITABLE_FIGURES.ASSIGNMENT:
            return `${value("target")} = ${value("expression")}`;
        case DIAGRAM_EDITABLE_FIGURES.READ:
            return `leer ${value("variables")}`;
        case DIAGRAM_EDITABLE_FIGURES.WRITE:
            return `escribir ${value("expressions")}`;
        case DIAGRAM_EDITABLE_FIGURES.IF:
            return (
                /^sino\s+si\b/iu.test(
                    oldStatement.trim()
                )
                    ? "sino si "
                    : "si "
            ) + value("condition");
        case DIAGRAM_EDITABLE_FIGURES.WHILE:
            return `mientras ${value("condition")}`;
        case DIAGRAM_EDITABLE_FIGURES.FOR_TO:
            return buildFor(values, "hasta");
        case DIAGRAM_EDITABLE_FIGURES.FOR_DOWNTO:
            return buildFor(values, "bajando");
        case DIAGRAM_EDITABLE_FIGURES.FUNCTION_CALL:
            return `${value("identifier")}(${value("arguments")})`;
        case DIAGRAM_STRUCTURAL_FIGURES.FUNCTION_DECLARATION:
            return `${value("identifier")}(${value("parameters")})`;
        default:
            throw DiagramEditingError
                .invalidIntent(
                    "La figura no admite edición."
                );
    }
}

function buildFor(values, direction) {
    return (
        `para ${values.variable.trim()} = ` +
        `${values.initialValue.trim()} ` +
        `${direction} ` +
        values.finalValue.trim()
    );
}

function createDeleteEdit(
    sourceCode,
    lines,
    lineIndex,
    entity
) {
    const line = lines[lineIndex];
    const lineText = sourceCode.slice(
        line.startOffset,
        line.contentEndOffset
    );

    if (
        entity.figure ===
            DIAGRAM_STRUCTURAL_FIGURES
                .FUNCTION_DECLARATION
    ) {
        return createFunctionDeclarationDeleteEdit(
            sourceCode,
            lines,
            entity
        );
    }

    if (isOnlyRootFunctionStatement(entity)) {
        const indentation =
            lineText.match(/^[\t ]*/u)?.[0] ??
            "";

        return {
            startOffset: line.startOffset,
            endOffset: line.contentEndOffset,
            newText:
                `${indentation}` +
                EMPTY_FUNCTION_BODY_COMMENT
        };
    }

    if (isSoleElseBranchStatement(entity)) {
        return createSoleElseBranchDeleteEdit(
            sourceCode,
            lines,
            entity
        );
    }

    const isControl = [
        DIAGRAM_EDITABLE_FIGURES.IF,
        DIAGRAM_EDITABLE_FIGURES.WHILE,
        DIAGRAM_EDITABLE_FIGURES.FOR_TO,
        DIAGRAM_EDITABLE_FIGURES.FOR_DOWNTO
    ].includes(entity.figure);

    if (!isControl) {
        return {
            startOffset: line.startOffset,
            endOffset: line.endOffset,
            newText: ""
        };
    }

    const header = sourceCode.slice(
        line.startOffset,
        line.contentEndOffset
    );
    const baseIndent = indentationWidth(
        header
    );
    const deletingElseIf =
        /^\s*sino\s+si\b/iu.test(header);
    let endOffset = line.endOffset;

    for (
        let index = lineIndex + 1;
        index < lines.length;
        index += 1
    ) {
        const candidate = lines[index];
        const text = sourceCode.slice(
            candidate.startOffset,
            candidate.contentEndOffset
        );

        if (text.trim() === "") {
            continue;
        }

        const indent = indentationWidth(text);
        const isIfContinuation =
            entity.figure ===
                DIAGRAM_EDITABLE_FIGURES.IF &&
            !deletingElseIf &&
            indent === baseIndent &&
            /^\s*sino(?:\s+si\b)?/iu.test(text);

        if (indent > baseIndent || isIfContinuation) {
            endOffset = candidate.endOffset;
            continue;
        }

        break;
    }

    return {
        startOffset: line.startOffset,
        endOffset,
        newText: ""
    };
}

function isOnlyRootFunctionStatement(entity) {
    return (
        entity.figure ===
            DIAGRAM_EDITABLE_FIGURES.RETURN &&
        String(entity.scopeId)
            .startsWith("function_") &&
        entity.containerId ===
            `${entity.scopeId}/body` &&
        entity.blockStatementCount === 1
    );
}

function createFunctionDeclarationDeleteEdit(
    sourceCode,
    lines,
    entity
) {
    const startLineIndex =
        entity.statement?.location
            ?.startLine - 1;
    const startLine = lines[startLineIndex];

    if (!startLine) {
        throw DiagramEditingError
            .entityNotFound(entity.location);
    }

    return {
        startOffset: startLine.startOffset,
        endOffset: statementSubtreeEndOffset(
            sourceCode,
            lines,
            entity.statement
        ),
        newText: ""
    };
}

function isSoleElseBranchStatement(entity) {
    return (
        entity.branch === "else" &&
        entity.blockStatementCount === 1 &&
        entity.branchHeaderLocation
            ?.startLine != null
    );
}

function createSoleElseBranchDeleteEdit(
    sourceCode,
    lines,
    entity
) {
    const headerLineIndex =
        entity.branchHeaderLocation.startLine - 1;
    const headerLine = lines[headerLineIndex];

    if (!headerLine) {
        throw DiagramEditingError
            .entityNotFound(entity.location);
    }

    const header = sourceCode.slice(
        headerLine.startOffset,
        headerLine.contentEndOffset
    );

    if (!/^\s*sino\s*$/iu.test(header)) {
        throw DiagramEditingError
            .invalidResult(
                [],
                entity.location
            );
    }

    const baseIndent = indentationWidth(header);
    let endOffset = headerLine.endOffset;

    for (
        let index = headerLineIndex + 1;
        index < lines.length;
        index += 1
    ) {
        const candidate = lines[index];
        const text = sourceCode.slice(
            candidate.startOffset,
            candidate.contentEndOffset
        );

        if (text.trim() === "") {
            endOffset = candidate.endOffset;
            continue;
        }

        if (indentationWidth(text) <= baseIndent) {
            break;
        }

        endOffset = candidate.endOffset;
    }

    return {
        startOffset: headerLine.startOffset,
        endOffset,
        newText: ""
    };
}

function indexLines(sourceCode) {
    const lines = [];
    let startOffset = 0;

    for (
        let index = 0;
        index <= sourceCode.length;
        index += 1
    ) {
        if (
            index < sourceCode.length &&
            sourceCode[index] !== "\n"
        ) {
            continue;
        }

        let contentEndOffset = index;

        if (
            contentEndOffset > startOffset &&
            sourceCode[contentEndOffset - 1] ===
                "\r"
        ) {
            contentEndOffset -= 1;
        }

        lines.push({
            startOffset,
            contentEndOffset,
            endOffset:
                index < sourceCode.length
                    ? index + 1
                    : index
        });
        startOffset = index + 1;
    }

    return lines;
}

function applyEdit(sourceCode, edit) {
    return (
        sourceCode.slice(0, edit.startOffset) +
        edit.newText +
        sourceCode.slice(edit.endOffset)
    );
}

function indentationWidth(text) {
    const indentation =
        text.match(/^[\t ]*/u)?.[0] ?? "";

    return [...indentation].reduce(
        (width, character) =>
            width +
            (character === "\t" ? 4 : 1),
        0
    );
}

function shiftLocation(location, origin) {
    if (location?.startLine == null) {
        return null;
    }

    const endLine =
        location.endLine ??
        location.startLine;

    return {
        startLine:
            location.startLine +
            origin.startLine - 1,
        startColumn:
            location.startLine === 1
                ? location.startColumn +
                    origin.startColumn - 1
                : location.startColumn,
        endLine:
            endLine + origin.startLine - 1,
        endColumn:
            endLine === 1
                ? (location.endColumn ??
                    location.startColumn) +
                    origin.startColumn - 1
                : location.endColumn ??
                    location.startColumn
    };
}

function normalizeOrigin(origin) {
    return {
        startLine:
            positiveInteger(
                origin?.startLine
            ) ?? 1,
        startColumn:
            positiveInteger(
                origin?.startColumn
            ) ?? 1
    };
}

function sameLocation(left, right) {
    return (
        left != null &&
        right != null &&
        left.startLine === right.startLine &&
        left.startColumn === right.startColumn &&
        left.endLine === right.endLine &&
        left.endColumn === right.endColumn
    );
}

function sameFunctionEnvelope(left, right) {
    return JSON.stringify(
        functionEnvelope(left)
    ) === JSON.stringify(
        functionEnvelope(right)
    );
}

function hasCreatedFunctionEnvelope(
    beforeAst,
    afterAst,
    identifier
) {
    const before = functionEnvelope(beforeAst);
    const after = functionEnvelope(afterAst);

    if (after.length !== before.length + 1) {
        return false;
    }

    const createdIndex = after.findIndex(
        item => item.name === identifier.trim()
    );

    if (createdIndex < 0) {
        return false;
    }

    after.splice(createdIndex, 1);

    return JSON.stringify(before) ===
        JSON.stringify(after);
}

function hasUpdatedFunctionEnvelope(
    beforeAst,
    afterAst,
    target,
    values
) {
    const before = functionEnvelope(beforeAst);
    const after = functionEnvelope(afterAst);
    const index = target.functionIndex;

    if (
        before.length !== after.length ||
        !Number.isInteger(index) ||
        index < 0 ||
        index >= before.length
    ) {
        return false;
    }

    const rawParameters = values.parameters;
    const expectedParameters =
        rawParameters.trim() === ""
            ? []
            : rawParameters
                .split(",")
                .map(parameter =>
                    parameter
                        .trim()
                        .replace(
                            /(?:\[\])+$/u,
                            ""
                        )
                );
    const expected = before.map(
        (item, itemIndex) =>
            itemIndex === index
                ? {
                    name:
                        values.identifier.trim(),
                    parameters:
                        expectedParameters
                }
                : item
    );
    const uniqueNames = new Set(
        after.map(item => item.name)
    );

    return (
        uniqueNames.size === after.length &&
        JSON.stringify(expected) ===
            JSON.stringify(after)
    );
}

function hasDeletedFunctionEnvelope(
    beforeAst,
    afterAst,
    target
) {
    const before = functionEnvelope(beforeAst);
    const after = functionEnvelope(afterAst);
    const index = target.functionIndex;

    if (
        before.length !== after.length + 1 ||
        !Number.isInteger(index) ||
        index < 0 ||
        index >= before.length
    ) {
        return false;
    }

    before.splice(index, 1);

    return JSON.stringify(before) ===
        JSON.stringify(after);
}

function functionEnvelope(ast) {
    return (ast?.statements ?? [])
        .filter(statement =>
            statement?.type ===
                NodeTypes.FUNCTION_DECLARATION
        )
        .map(statement => ({
            name:
                statement.identifier?.name ??
                null,
            parameters:
                (statement.parameters ?? [])
                    .map(parameter =>
                        parameter.identifier
                            ?.name ?? null
                    )
        }));
}

function positiveInteger(value) {
    return Number.isInteger(value) && value > 0
        ? value
        : null;
}

function deepFreeze(value) {
    if (
        value == null ||
        typeof value !== "object" ||
        Object.isFrozen(value)
    ) {
        return value;
    }

    for (const item of Object.values(value)) {
        deepFreeze(item);
    }

    return Object.freeze(value);
}
