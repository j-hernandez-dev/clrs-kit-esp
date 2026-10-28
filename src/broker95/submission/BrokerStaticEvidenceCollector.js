import {
    NodeTypes
} from "../../ast/core/NodeTypes.js";
import {
    ASTVisitor
} from "../../ast/visitors/ASTVisitor.js";
import {
    SemanticSymbolKind
} from "../../semantic/SemanticSymbol.js";

export const BROKER_STATIC_EVIDENCE_LIMITS =
    Object.freeze({
        maximumSymbolRecords: 512,
        maximumFindings: 256,
        maximumCallEdges: 256,
        maximumLocationsPerRecord: 64,
        maximumOperationSites: 256,
        maximumScopes: 129,
        maximumParametersPerScope: 64,
        maximumRecursiveComponents: 128,
        maximumPredicateCalls: 64
    });

/**
 * Extrae hechos estructurales del AST y del modelo semántico compartido.
 * El resultado sólo contiene JSON: nunca conserva nodos, scopes o símbolos.
 */
export function collectBrokerStaticAstEvidence(
    ast,
    semanticModel
) {
    return new BrokerStaticEvidenceCollector(
        semanticModel
    ).collect(ast);
}

class BrokerStaticEvidenceCollector extends ASTVisitor {

    constructor(semanticModel) {
        super();

        this.semanticModel = semanticModel;
        this.scopes = [];
        this.scopeStack = [];
        this.scopeBySemanticScope = new Map();
        this.reachableNodes = new WeakSet();
        this.inputTargetNodes = new WeakSet();
        this.meaningfulWriteSymbols = new Set();
        this.callSites = [];
        this.callbackRegistrations = [];
        this.accessSites = [];
        this.divisionSites = [];
        this.loopSites = [];
        this.inputSites = [];
        this.conditions = [];
        this.unreachableStatements = [];

        this.registerHandlers({
            [NodeTypes.PROGRAM]: this.visitProgram,
            [NodeTypes.BLOCK]: this.visitBlock,
            [NodeTypes.ASSIGNMENT]: this.visitAssignment,
            [NodeTypes.IF_STATEMENT]: this.visitIf,
            [NodeTypes.WHILE_STATEMENT]: this.visitWhile,
            [NodeTypes.FOR_STATEMENT]: this.visitFor,
            [NodeTypes.RETURN_STATEMENT]: this.visitReturn,
            [NodeTypes.READ_STATEMENT]: this.visitRead,
            [NodeTypes.WRITE_STATEMENT]: this.visitWrite,
            [NodeTypes.FUNCTION_DECLARATION]:
                this.visitFunctionDeclaration,
            [NodeTypes.PARAMETER]: this.visitParameter,
            [NodeTypes.ARRAY_DECLARATION]:
                this.visitArrayDeclaration,
            [NodeTypes.DECLARATION_ITEM]:
                this.visitArrayDeclaration,
            [NodeTypes.FUNCTION_CALL]: this.visitFunctionCall,
            [NodeTypes.ARRAY_EXPRESSION]:
                this.visitArrayExpression,
            [NodeTypes.ACCESS]: this.visitAccess,
            [NodeTypes.BINARY_EXPRESSION]: this.visitBinary,
            [NodeTypes.LOGICAL_EXPRESSION]: this.visitLogical,
            [NodeTypes.LOGICAL_NOT]: this.visitUnary,
            [NodeTypes.UNARY]: this.visitUnary,
            [NodeTypes.GROUP_EXPRESSION]: this.visitGroup,
            [NodeTypes.IDENTIFIER]: this.visitLeaf,
            [NodeTypes.NUMBER_LITERAL]: this.visitLeaf,
            [NodeTypes.SCIENTIFIC_LITERAL]: this.visitLeaf,
            [NodeTypes.STRING_LITERAL]: this.visitLeaf,
            [NodeTypes.BOOLEAN_LITERAL]: this.visitLeaf,
            [NodeTypes.NULL_LITERAL]: this.visitLeaf
        });
    }

    collect(ast) {
        const globalScope = createScope({
            id: "global",
            kind: "global",
            name: "<global>",
            node: ast,
            semanticScope:
                this.semanticModel.globalScope
        });

        this.scopes.push(globalScope);
        this.scopeBySemanticScope.set(
            this.semanticModel.globalScope,
            globalScope
        );
        this.withScope(globalScope, () => this.visit(ast));

        const calls = this.createCallEvidence();
        const symbolEvidence = this.createSymbolEvidence(
            calls.reachableFunctions
        );
        const inputs = this.createInputEvidence();
        const findings = this.createFindings(
            symbolEvidence.rawUnused
        );
        const scopes = this.createScopeEvidence();

        return {
            metrics: summarizeMetrics(
                scopes,
                symbolEvidence.publicValue,
                calls,
                this
            ),
            scopes: limitedCopy(
                scopes,
                BROKER_STATIC_EVIDENCE_LIMITS.maximumScopes
            ),
            symbols: symbolEvidence.publicValue,
            calls: calls.publicValue,
            inputs,
            operations: {
                divisions: limitedCopy(
                    this.divisionSites,
                    BROKER_STATIC_EVIDENCE_LIMITS
                        .maximumOperationSites
                ),
                indexedAccesses: limitedCopy(
                    this.accessSites,
                    BROKER_STATIC_EVIDENCE_LIMITS
                        .maximumOperationSites
                ),
                loops: limitedCopy(
                    this.loopSites,
                    BROKER_STATIC_EVIDENCE_LIMITS
                        .maximumOperationSites
                )
            },
            findings: limitedCopy(
                findings,
                BROKER_STATIC_EVIDENCE_LIMITS
                    .maximumFindings
            )
        };
    }

    get currentScope() {
        return this.scopeStack.at(-1);
    }

    withScope(scope, operation) {
        this.scopeStack.push(scope);

        try {
            return operation();
        } finally {
            this.scopeStack.pop();
        }
    }

    mark(node) {
        if (node != null && typeof node === "object") {
            this.reachableNodes.add(node);
        }
    }

    visitProgram(node) {
        this.mark(node);
        this.visitSequence(node.statements ?? []);
    }

    visitBlock(node) {
        this.mark(node);
        this.visitSequence(node.statements ?? []);
    }

    visitSequence(statements) {
        let terminated = false;

        for (const statement of statements) {
            if (terminated) {
                this.unreachableStatements.push({
                    scope: this.currentScope.name,
                    type: statement.type,
                    location: normalizeLocation(
                        statement.location
                    )
                });
                continue;
            }

            this.visit(statement, {
                asStatement: true
            });
            terminated = statementAlwaysReturns(
                statement
            );
        }
    }

    visitFunctionDeclaration(node) {
        this.mark(node);
        this.mark(node.identifier);

        const semanticScope = this.semanticModel
            .getFunctionScope(node);
        const scope = createScope({
            id: `function:${this.scopes.length}`,
            kind: "function",
            name: node.identifier.name,
            node,
            semanticScope,
            parameters: (node.parameters ?? [])
                .map(parameter =>
                    parameter.identifier.name
                )
        });

        this.scopes.push(scope);
        this.scopeBySemanticScope.set(
            semanticScope,
            scope
        );
        this.withScope(scope, () => {
            for (const parameter of node.parameters ?? []) {
                this.visit(parameter);
            }
            this.visit(node.body);
        });
    }

    visitParameter(node) {
        this.mark(node);
        this.mark(node.identifier);
        this.visitOptionalMany(node.dimensions ?? []);
    }

    visitAssignment(node, context = {}) {
        this.mark(node);

        if (context.asStatement) {
            this.recordStatement("assignmentCount");
        }

        this.visitAssignmentTarget(node.left);
        this.visit(node.right);
    }

    visitAssignmentTarget(target) {
        this.mark(target);

        if (target.type !== NodeTypes.ACCESS) {
            this.mark(target);
            return;
        }

        this.recordAccess(target, "write");
        const symbol = this.getSymbol(target);

        if (symbol != null) {
            this.meaningfulWriteSymbols.add(symbol);
        }

        this.mark(target.identifier);
        this.visitMany(target.indexes ?? []);
    }

    visitIf(node, context = {}) {
        this.mark(node);

        if (context.asStatement) {
            this.recordStatement();
        }

        const branches = [
            {
                condition: node.condition,
                block: node.thenBlock,
                kind: "if"
            },
            ...(node.elseIfBranches ?? []).map(
                branch => ({
                    condition: branch.condition,
                    block: branch.block,
                    kind: "else-if"
                })
            )
        ];

        this.currentScope.decisionPointCount +=
            branches.length;
        this.currentScope.conditionCount +=
            branches.length;

        for (const branch of branches) {
            this.recordCondition(
                branch.condition,
                branch.kind
            );
            this.withCondition(() =>
                this.visit(branch.condition)
            );
            this.withControlNesting(
                false,
                () => this.visit(branch.block)
            );
        }

        if (node.elseBlock != null) {
            this.withControlNesting(
                false,
                () => this.visit(node.elseBlock)
            );
        }
    }

    visitWhile(node, context = {}) {
        this.visitLoop(node, context, {
            kind: "while",
            body: node.body
        });
    }

    visitFor(node, context = {}) {
        this.mark(node);

        if (context.asStatement) {
            this.recordStatement();
        }

        this.currentScope.decisionPointCount += 1;
        this.currentScope.conditionCount += 1;
        this.currentScope.loopCount += 1;
        this.loopSites.push({
            scope: this.currentScope.name,
            kind: "for",
            location: normalizeLocation(node.location),
            terminationProof: "not-analyzed"
        });
        this.visit(node.initializer, {
            asStatement: false
        });
        this.recordCondition(node.condition, "for");
        this.withCondition(() =>
            this.visit(node.condition)
        );
        this.withControlNesting(true, () => {
            this.visit(node.body);
        });
        this.visit(node.increment, {
            asStatement: false
        });
    }

    visitLoop(node, context, options) {
        this.mark(node);

        if (context.asStatement) {
            this.recordStatement();
        }

        this.currentScope.decisionPointCount += 1;
        this.currentScope.conditionCount += 1;
        this.currentScope.loopCount += 1;
        this.loopSites.push({
            scope: this.currentScope.name,
            kind: options.kind,
            location: normalizeLocation(node.location),
            terminationProof: "not-analyzed"
        });
        this.recordCondition(node.condition, options.kind);
        this.withCondition(() =>
            this.visit(node.condition)
        );
        this.withControlNesting(true, () => {
            this.visit(options.body);
        });
    }

    withControlNesting(loop, operation) {
        const scope = this.currentScope;

        scope.currentNestingDepth += 1;
        scope.maximumNestingDepth = Math.max(
            scope.maximumNestingDepth,
            scope.currentNestingDepth
        );

        if (loop) {
            scope.currentLoopDepth += 1;
        }

        try {
            return operation();
        } finally {
            if (loop) {
                scope.currentLoopDepth -= 1;
            }
            scope.currentNestingDepth -= 1;
        }
    }

    visitReturn(node, context = {}) {
        this.mark(node);

        if (context.asStatement) {
            this.recordStatement("returnCount");
        }

        if (node.expression != null) {
            this.visit(node.expression);
        }
    }

    visitRead(node, context = {}) {
        this.mark(node);

        if (context.asStatement) {
            this.recordStatement("readStatementCount");
        }

        this.currentScope.inputValueCount +=
            (node.identifiers ?? []).length;

        for (const target of node.identifiers ?? []) {
            const identifier = target.type === NodeTypes.ACCESS
                ? target.identifier
                : target;
            const symbol = this.getSymbol(target) ??
                this.getSymbol(identifier);

            this.mark(target);
            this.mark(identifier);
            this.inputTargetNodes.add(identifier);
            this.inputSites.push({
                scope: this.currentScope.name,
                name: identifier.name,
                symbol,
                location: normalizeLocation(
                    target.location ?? node.location
                ),
                insideLoop:
                    this.currentScope.currentLoopDepth > 0
            });

            if (target.type === NodeTypes.ACCESS) {
                this.recordAccess(target, "input");
                this.visitMany(target.indexes ?? []);
            }
        }
    }

    visitWrite(node, context = {}) {
        this.mark(node);

        if (context.asStatement) {
            this.recordStatement("writeStatementCount");
        }

        this.currentScope.outputExpressionCount +=
            (node.expressions ?? []).length;
        this.visitMany(node.expressions ?? []);
    }

    visitArrayDeclaration(node, context = {}) {
        this.mark(node);
        this.mark(node.identifier);

        if (context.asStatement) {
            this.recordStatement("assignmentCount");
        }

        this.visitOptionalMany(node.dimensions ?? []);
    }

    visitFunctionCall(node, context = {}) {
        this.mark(node);
        this.mark(node.identifier);

        if (context.asStatement) {
            this.recordStatement();
        }

        const symbol = this.getSymbol(node.identifier);

        this.currentScope.callCount += 1;
        this.callSites.push({
            caller: this.currentScope.name,
            callee: node.identifier.name,
            kind: symbol?.hasKind(
                SemanticSymbolKind.FUNCTION
            )
                ? "user"
                : symbol?.hasKind(
                    SemanticSymbolKind.BUILTIN
                )
                    ? "builtin"
                    : "unknown",
            argumentCount: (node.arguments ?? []).length,
            location: normalizeLocation(node.location)
        });
        this.visitMany(node.arguments ?? []);
        const callback = this.semanticModel.gui?.callbacks.get(node);
        if (callback) {
            this.callbackRegistrations.push({ caller: this.currentScope.name, callee: callback.symbol.name,
                location: normalizeLocation(node.location), activation: "event-dependent", observedExecution: false });
        }
    }

    visitArrayExpression(node) {
        this.mark(node);
        this.visitMany(node.elements ?? []);
    }

    visitAccess(node) {
        this.mark(node);
        this.mark(node.identifier);
        this.recordAccess(node, "read");
        this.visitMany(node.indexes ?? []);
    }

    recordAccess(node, mode) {
        this.currentScope.accessCount += 1;
        this.accessSites.push({
            scope: this.currentScope.name,
            target: node.identifier?.name ?? "",
            mode,
            indexCount: (node.indexes ?? []).length,
            location: normalizeLocation(node.location),
            boundsProof: "not-analyzed"
        });
    }

    visitBinary(node) {
        this.mark(node);

        if (node.operator === "/") {
            this.currentScope.divisionCount += 1;
            this.divisionSites.push({
                scope: this.currentScope.name,
                location: normalizeLocation(node.location),
                denominatorIdentifiers:
                    collectIdentifierNames(node.right),
                nonZeroProof: "not-analyzed"
            });
        }

        this.visit(node.left);
        this.visit(node.right);
    }

    visitLogical(node) {
        this.mark(node);

        if (this.currentScope.currentConditionDepth > 0) {
            this.currentScope.logicalConnectorCount += 1;
        }

        this.visit(node.left);
        this.visit(node.right);
    }

    withCondition(operation) {
        this.currentScope.currentConditionDepth += 1;

        try {
            return operation();
        } finally {
            this.currentScope.currentConditionDepth -= 1;
        }
    }

    visitUnary(node) {
        this.mark(node);
        this.visit(node.operand);
    }

    visitGroup(node) {
        this.mark(node);
        this.visit(node.expression);
    }

    visitLeaf(node) {
        this.mark(node);
    }

    visitOptionalMany(nodes) {
        for (const node of nodes) {
            if (node != null) {
                this.visit(node);
            }
        }
    }

    recordStatement(counter = null) {
        this.currentScope.statementCount += 1;

        if (counter != null) {
            this.currentScope[counter] += 1;
        }
    }

    recordCondition(node, kind) {
        const details = collectConditionDetails(
            node,
            this.semanticModel
        );

        this.conditions.push({
            scope: this.currentScope.name,
            kind,
            location: normalizeLocation(node.location),
            symbols: details.symbols,
            predicateCalls: details.predicateCalls
        });
    }

    getSymbol(node) {
        return this.semanticModel.getSymbol(node);
    }

    createCallEvidence() {
        const grouped = new Map();

        for (const call of this.callSites) {
            const key = [
                call.caller,
                call.callee,
                call.kind
            ].join("\u0000");
            const record = grouped.get(key) ?? {
                caller: call.caller,
                callee: call.callee,
                kind: call.kind,
                count: 0,
                argumentCounts: new Set(),
                locations: []
            };

            record.count += 1;
            record.argumentCounts.add(call.argumentCount);
            pushLimited(
                record.locations,
                call.location,
                BROKER_STATIC_EVIDENCE_LIMITS
                    .maximumLocationsPerRecord
            );
            grouped.set(key, record);
        }

        const records = [...grouped.values()].map(record => ({
            caller: record.caller,
            callee: record.callee,
            kind: record.kind,
            count: record.count,
            argumentCounts: [...record.argumentCounts].sort(
                (left, right) => left - right
            ),
            locations: record.locations
        }));
        const userEdges = records.filter(
            record => record.kind === "user"
        );
        const reachableFunctions = findReachableFunctions(
            this.scopes,
            [...userEdges, ...this.callbackRegistrations]
        );
        const recursiveComponents = findRecursiveComponents(
            this.scopes,
            userEdges
        );

        return {
            reachableFunctions,
            publicValue: {
                ...(this.callbackRegistrations.length ? { callbackRegistrations: limitedCopy(
                    this.callbackRegistrations, BROKER_STATIC_EVIDENCE_LIMITS.maximumCallEdges) } : {}),
                edgeCount: records.length,
                userEdgeCount: userEdges.length,
                callSiteCount: this.callSites.length,
                edges: limitedCopy(
                    records,
                    BROKER_STATIC_EVIDENCE_LIMITS
                        .maximumCallEdges
                ),
                recursiveComponents: limitedCopy(
                    recursiveComponents,
                    BROKER_STATIC_EVIDENCE_LIMITS
                        .maximumRecursiveComponents
                )
            }
        };
    }

    createSymbolEvidence(reachableFunctions) {
        const records = [];
        const unused = [];
        const globals = [];
        const referencesBySymbol = new Map();

        for (const reference of this.semanticModel.references) {
            if (
                !this.reachableNodes.has(reference.node) ||
                this.inputTargetNodes.has(reference.node) ||
                !referenceScopeIsReachable(
                    reference.scope,
                    reachableFunctions
                )
            ) {
                continue;
            }

            const values = referencesBySymbol.get(
                reference.symbol
            ) ?? [];

            values.push(reference);
            referencesBySymbol.set(reference.symbol, values);
        }

        for (const semanticScope of this.semanticModel.scopes) {
            const scope = this.scopeBySemanticScope.get(
                semanticScope
            );

            if (scope == null) {
                continue;
            }

            for (const symbol of semanticScope.symbols.values()) {
                const kind = effectiveSymbolKind(symbol);

                if (kind === SemanticSymbolKind.BUILTIN) {
                    continue;
                }

                const scopeReachable = scope.kind !== "function" ||
                    reachableFunctions.has(scope.name);
                const references = referencesBySymbol.get(symbol) ?? [];
                const isParameter = kind ===
                    SemanticSymbolKind.PARAMETER;
                const usedByWrite = isParameter &&
                    this.meaningfulWriteSymbols.has(symbol);
                const reachable = kind ===
                    SemanticSymbolKind.FUNCTION
                    ? reachableFunctions.has(symbol.name)
                    : scopeReachable;
                const used = kind === SemanticSymbolKind.FUNCTION
                    ? reachable
                    : scopeReachable
                        ? references.length > 0 || usedByWrite
                        : null;
                const record = {
                    name: symbol.name,
                    kind,
                    scope: scope.name,
                    declarationCount:
                        symbol.declarations.length,
                    referenceCount: references.length,
                    referenceScopes: [...new Set(
                        references.map(reference =>
                            reference.scope?.name ?? "<global>"
                        )
                    )].sort(),
                    used,
                    reachable,
                    usageStatus: used == null
                        ? "scope-unreachable"
                        : used
                            ? "used"
                            : "unused",
                    location: firstDeclarationLocation(symbol)
                };

                records.push(record);
                scope.symbolCount += 1;

                if (kind === SemanticSymbolKind.VARIABLE) {
                    scope.variableCount += 1;
                } else if (isParameter) {
                    scope.parameterCount += 1;
                }

                if (
                    semanticScope ===
                        this.semanticModel.globalScope &&
                    kind === SemanticSymbolKind.VARIABLE
                ) {
                    globals.push(record);
                }

                if (used === false) {
                    const unusedRecord = {
                        name: record.name,
                        kind: record.kind,
                        scope: record.scope,
                        location: record.location
                    };

                    unused.push(unusedRecord);

                    if (kind === SemanticSymbolKind.VARIABLE) {
                        scope.unusedVariableCount += 1;
                    } else if (isParameter) {
                        scope.unusedParameterCount += 1;
                    } else if (
                        kind === SemanticSymbolKind.FUNCTION
                    ) {
                        scope.unusedFunctionCount += 1;
                    }
                }
            }
        }

        return {
            rawUnused: unused,
            publicValue: {
                totalCount: records.length,
                records: limitedCopy(
                    records,
                    BROKER_STATIC_EVIDENCE_LIMITS
                        .maximumSymbolRecords
                ),
                globalVariableCount: globals.length,
                globalVariables: limitedCopy(
                    globals,
                    BROKER_STATIC_EVIDENCE_LIMITS
                        .maximumSymbolRecords
                ),
                unusedCount: unused.length,
                unusedVariableCount: unused.filter(
                    symbol => symbol.kind ===
                        SemanticSymbolKind.VARIABLE
                ).length,
                unusedParameterCount: unused.filter(
                    symbol => symbol.kind ===
                        SemanticSymbolKind.PARAMETER
                ).length,
                unusedFunctionCount: unused.filter(
                    symbol => symbol.kind ===
                        SemanticSymbolKind.FUNCTION
                ).length,
                unused: limitedCopy(
                    unused,
                    BROKER_STATIC_EVIDENCE_LIMITS
                        .maximumFindings
                )
            }
        };
    }

    createInputEvidence() {
        const grouped = new Map();
        const conditionsBySymbol = new Map();

        for (const condition of this.conditions) {
            for (const symbol of condition.symbols) {
                const values = conditionsBySymbol.get(symbol) ?? [];

                values.push(condition);
                conditionsBySymbol.set(symbol, values);
            }
        }

        for (const input of this.inputSites) {
            const key = input.symbol ??
                `${input.scope}\u0000${input.name}`;
            const record = grouped.get(key) ?? {
                name: input.name,
                scope: input.scope,
                symbol: input.symbol,
                readCount: 0,
                locations: [],
                insideLoop: false
            };

            record.readCount += 1;
            record.insideLoop ||= input.insideLoop;
            pushLimited(
                record.locations,
                input.location,
                BROKER_STATIC_EVIDENCE_LIMITS
                    .maximumLocationsPerRecord
            );
            grouped.set(key, record);
        }

        const records = [...grouped.values()].map(input => {
            const candidates = (
                conditionsBySymbol.get(input.symbol) ?? []
            ).filter(
                condition =>
                    condition.scope === input.scope
            );

            return {
                name: input.name,
                scope: input.scope,
                readCount: input.readCount,
                readLocations: input.locations,
                repeatedRead:
                    input.readCount > 1 || input.insideLoop,
                candidateGuardCount: candidates.length,
                candidateGuardLocations: candidates.map(
                    candidate => candidate.location
                ).slice(
                    0,
                    BROKER_STATIC_EVIDENCE_LIMITS
                        .maximumLocationsPerRecord
                ),
                predicateCalls: [...new Set(
                    candidates.flatMap(candidate =>
                        [...candidate.predicateCalls]
                    )
                )].sort().slice(
                    0,
                    BROKER_STATIC_EVIDENCE_LIMITS
                        .maximumPredicateCalls
                ),
                validationProof: "candidate-only"
            };
        });

        return {
            valueCount: this.inputSites.length,
            bindingCount: records.length,
            records: limitedCopy(
                records,
                BROKER_STATIC_EVIDENCE_LIMITS
                    .maximumSymbolRecords
            )
        };
    }

    createFindings(unusedSymbols) {
        const findings = unusedSymbols.map(symbol => ({
            code: unusedFindingCode(symbol.kind),
            kind: "objective",
            criterionHints: unusedCriterionHints(
                symbol.kind
            ),
            scope: symbol.scope,
            subject: symbol.name,
            location: symbol.location
        }));

        for (const statement of this.unreachableStatements) {
            findings.push({
                code: "BROKER95_STATIC_UNREACHABLE_STATEMENT",
                kind: "objective",
                criterionHints: ["D-SIM"],
                scope: statement.scope,
                subject: statement.type,
                location: statement.location
            });
        }

        return findings;
    }

    createScopeEvidence() {
        return this.scopes.map(scope => {
            const hasFlow = scope.kind === "function" ||
                scope.statementCount > 0;
            const cyclomaticComplexity = hasFlow
                ? 1 + scope.decisionPointCount +
                    scope.logicalConnectorCount
                : 0;

            return {
                id: scope.id,
                kind: scope.kind,
                name: scope.name,
                location: scope.location,
                parameters: scope.parameters.slice(
                    0,
                    BROKER_STATIC_EVIDENCE_LIMITS
                        .maximumParametersPerScope
                ),
                parametersTruncated:
                    scope.parameters.length >
                    BROKER_STATIC_EVIDENCE_LIMITS
                        .maximumParametersPerScope,
                statementCount: scope.statementCount,
                assignmentCount: scope.assignmentCount,
                decisionPointCount: scope.decisionPointCount,
                logicalConnectorCount:
                    scope.logicalConnectorCount,
                conditionCount: scope.conditionCount,
                loopCount: scope.loopCount,
                returnCount: scope.returnCount,
                callCount: scope.callCount,
                readStatementCount: scope.readStatementCount,
                inputValueCount: scope.inputValueCount,
                writeStatementCount: scope.writeStatementCount,
                outputExpressionCount:
                    scope.outputExpressionCount,
                accessCount: scope.accessCount,
                divisionCount: scope.divisionCount,
                symbolCount: scope.symbolCount,
                variableCount: scope.variableCount,
                parameterCount: scope.parameterCount,
                unusedVariableCount: scope.unusedVariableCount,
                unusedParameterCount: scope.unusedParameterCount,
                unusedFunctionCount: scope.unusedFunctionCount,
                cyclomaticComplexity,
                cyclomaticInterpretation:
                    interpretCyclomatic(cyclomaticComplexity),
                maximumNestingDepth:
                    scope.maximumNestingDepth,
                nestingInterpretation: interpretNesting(
                    scope.maximumNestingDepth
                )
            };
        });
    }
}

function createScope({
    id,
    kind,
    name,
    node,
    semanticScope,
    parameters = []
}) {
    return {
        id,
        kind,
        name,
        semanticScope,
        parameters: [...parameters],
        location: fullFunctionLocation(node),
        statementCount: 0,
        assignmentCount: 0,
        decisionPointCount: 0,
        logicalConnectorCount: 0,
        conditionCount: 0,
        loopCount: 0,
        returnCount: 0,
        callCount: 0,
        readStatementCount: 0,
        inputValueCount: 0,
        writeStatementCount: 0,
        outputExpressionCount: 0,
        accessCount: 0,
        divisionCount: 0,
        symbolCount: 0,
        variableCount: 0,
        parameterCount: 0,
        unusedVariableCount: 0,
        unusedParameterCount: 0,
        unusedFunctionCount: 0,
        currentNestingDepth: 0,
        maximumNestingDepth: 0,
        currentLoopDepth: 0,
        currentConditionDepth: 0
    };
}

function summarizeMetrics(
    scopes,
    symbols,
    calls,
    collector
) {
    const flowScopes = scopes.filter(scope =>
        scope.cyclomaticComplexity > 0
    );

    return {
        functionCount: scopes.filter(
            scope => scope.kind === "function"
        ).length,
        globalVariableCount: symbols.globalVariableCount,
        symbolCount: symbols.totalCount,
        unusedSymbolCount: symbols.unusedCount,
        unusedVariableCount: symbols.unusedVariableCount,
        unusedParameterCount: symbols.unusedParameterCount,
        unusedFunctionCount: symbols.unusedFunctionCount,
        statementCount: sum(scopes, "statementCount"),
        assignmentCount: sum(scopes, "assignmentCount"),
        decisionPointCount: sum(scopes, "decisionPointCount"),
        logicalConnectorCount:
            sum(scopes, "logicalConnectorCount"),
        loopCount: sum(scopes, "loopCount"),
        returnCount: sum(scopes, "returnCount"),
        readStatementCount: sum(scopes, "readStatementCount"),
        inputValueCount: sum(scopes, "inputValueCount"),
        writeStatementCount: sum(scopes, "writeStatementCount"),
        callSiteCount: calls.publicValue.callSiteCount,
        userCallEdgeCount: calls.publicValue.userEdgeCount,
        cyclomaticComplexityTotal:
            sum(flowScopes, "cyclomaticComplexity"),
        cyclomaticComplexityMaximum:
            maximum(flowScopes, "cyclomaticComplexity"),
        nestingDepthMaximum:
            maximum(scopes, "maximumNestingDepth"),
        indexedAccessCount: collector.accessSites.length,
        divisionCount: collector.divisionSites.length,
        unreachableStatementCount:
            collector.unreachableStatements.length
    };
}

function collectConditionDetails(node, semanticModel) {
    const symbols = new Set();
    const predicateCalls = new Set();

    walkAst(node, current => {
        if (current.type === NodeTypes.IDENTIFIER) {
            const symbol = semanticModel.getSymbol(current);

            if (symbol != null) {
                symbols.add(symbol);
            }
        } else if (
            current.type === NodeTypes.FUNCTION_CALL
        ) {
            predicateCalls.add(current.identifier.name);
        }
    });

    return { symbols, predicateCalls };
}

function collectIdentifierNames(node) {
    const names = new Set();

    walkAst(node, current => {
        if (current.type === NodeTypes.IDENTIFIER) {
            names.add(current.name);
        }
    });

    return [...names].sort();
}

function walkAst(value, operation) {
    if (Array.isArray(value)) {
        for (const item of value) {
            walkAst(item, operation);
        }
        return;
    }

    if (value == null || typeof value !== "object") {
        return;
    }

    if (typeof value.type === "string") {
        operation(value);
    }

    for (const [key, child] of Object.entries(value)) {
        if (key !== "location") {
            walkAst(child, operation);
        }
    }
}

function statementAlwaysReturns(statement) {
    if (statement.type === NodeTypes.RETURN_STATEMENT) {
        return true;
    }

    if (statement.type !== NodeTypes.IF_STATEMENT ||
        statement.elseBlock == null) {
        return false;
    }

    return blockAlwaysReturns(statement.thenBlock) &&
        (statement.elseIfBranches ?? []).every(
            branch => blockAlwaysReturns(branch.block)
        ) &&
        blockAlwaysReturns(statement.elseBlock);
}

function blockAlwaysReturns(block) {
    for (const statement of block?.statements ?? []) {
        if (statementAlwaysReturns(statement)) {
            return true;
        }
    }

    return false;
}

function effectiveSymbolKind(symbol) {
    if (symbol.hasKind(SemanticSymbolKind.FUNCTION)) {
        return SemanticSymbolKind.FUNCTION;
    }

    if (symbol.hasKind(SemanticSymbolKind.PARAMETER)) {
        return SemanticSymbolKind.PARAMETER;
    }

    if (symbol.hasKind(SemanticSymbolKind.VARIABLE)) {
        return SemanticSymbolKind.VARIABLE;
    }

    return symbol.kind;
}

function referenceScopeIsReachable(
    semanticScope,
    reachableFunctions
) {
    return semanticScope?.type === "global" ||
        reachableFunctions.has(semanticScope?.name);
}

function firstDeclarationLocation(symbol) {
    const declaration = symbol.declarations.find(
        item => item.node?.location != null
    );

    return normalizeLocation(declaration?.node?.location);
}

function findReachableFunctions(scopes, edges) {
    const functionNames = new Set(
        scopes.filter(scope => scope.kind === "function")
            .map(scope => scope.name)
    );
    const reachable = new Set();
    const queue = [];

    if (functionNames.has("PRINCIPAL")) {
        reachable.add("PRINCIPAL");
        queue.push("PRINCIPAL");
    }

    for (const edge of edges) {
        if (edge.caller === "<global>" &&
            !reachable.has(edge.callee)) {
            reachable.add(edge.callee);
            queue.push(edge.callee);
        }
    }

    for (let index = 0; index < queue.length; index += 1) {
        const caller = queue[index];

        for (const edge of edges) {
            if (edge.caller === caller &&
                !reachable.has(edge.callee)) {
                reachable.add(edge.callee);
                queue.push(edge.callee);
            }
        }
    }

    return reachable;
}

function findRecursiveComponents(scopes, edges) {
    const names = scopes.filter(
        scope => scope.kind === "function"
    ).map(scope => scope.name);
    const outgoing = new Map(
        names.map(name => [name, []])
    );

    for (const edge of edges) {
        outgoing.get(edge.caller)?.push(edge.callee);
    }

    const components = stronglyConnectedComponents(
        names,
        outgoing
    );

    return components.filter(component =>
        component.length > 1 ||
        (outgoing.get(component[0]) ?? [])
            .includes(component[0])
    ).map(component => ({
        functions: [...component].sort(),
        mutual: component.length > 1
    }));
}

function stronglyConnectedComponents(names, outgoing) {
    const visited = new Set();
    const order = [];

    for (const root of names) {
        if (visited.has(root)) {
            continue;
        }

        const stack = [{ name: root, expanded: false }];

        while (stack.length > 0) {
            const current = stack.pop();

            if (current.expanded) {
                order.push(current.name);
                continue;
            }

            if (visited.has(current.name)) {
                continue;
            }

            visited.add(current.name);
            stack.push({
                name: current.name,
                expanded: true
            });

            const targets = outgoing.get(current.name) ?? [];

            for (
                let index = targets.length - 1;
                index >= 0;
                index -= 1
            ) {
                if (!visited.has(targets[index])) {
                    stack.push({
                        name: targets[index],
                        expanded: false
                    });
                }
            }
        }
    }

    const incoming = new Map(
        names.map(name => [name, []])
    );

    for (const [caller, targets] of outgoing) {
        for (const callee of targets) {
            incoming.get(callee)?.push(caller);
        }
    }

    const assigned = new Set();
    const components = [];

    for (let index = order.length - 1; index >= 0; index -= 1) {
        const root = order[index];

        if (assigned.has(root)) {
            continue;
        }

        const component = [];
        const stack = [root];

        assigned.add(root);

        while (stack.length > 0) {
            const current = stack.pop();

            component.push(current);

            for (const source of incoming.get(current) ?? []) {
                if (!assigned.has(source)) {
                    assigned.add(source);
                    stack.push(source);
                }
            }
        }

        components.push(component);
    }

    return components;
}

function fullFunctionLocation(node) {
    const start = normalizeLocation(
        node?.identifier?.location ?? node?.location
    );
    const statements = node?.body?.statements ??
        node?.statements ?? [];
    const end = normalizeLocation(
        statements.at(-1)?.location ?? node?.location
    );

    if (start == null) {
        return end;
    }

    if (end == null) {
        return start;
    }

    return {
        startLine: start.startLine,
        startColumn: start.startColumn,
        endLine: end.endLine,
        endColumn: end.endColumn
    };
}

function normalizeLocation(value) {
    if (value == null) {
        return null;
    }

    const location = {
        startLine: value.startLine,
        startColumn: value.startColumn,
        endLine: value.endLine,
        endColumn: value.endColumn
    };

    return Object.values(location).every(item =>
        Number.isSafeInteger(item) && item >= 1
    )
        ? location
        : null;
}

function interpretCyclomatic(value) {
    if (value === 0) {
        return "not-applicable";
    }
    if (value <= 4) {
        return "simple";
    }
    if (value <= 7) {
        return "moderate";
    }
    if (value <= 10) {
        return "complex";
    }

    return "very-complex";
}

function interpretNesting(value) {
    if (value <= 2) {
        return "simple";
    }
    if (value === 3) {
        return "moderate";
    }
    if (value === 4) {
        return "complex";
    }

    return "very-complex";
}

function unusedFindingCode(kind) {
    switch (kind) {
        case SemanticSymbolKind.FUNCTION:
            return "BROKER95_STATIC_UNUSED_FUNCTION";
        case SemanticSymbolKind.PARAMETER:
            return "BROKER95_STATIC_UNUSED_PARAMETER";
        default:
            return "BROKER95_STATIC_UNUSED_VARIABLE";
    }
}

function unusedCriterionHints(kind) {
    switch (kind) {
        case SemanticSymbolKind.FUNCTION:
            return ["D-SIM", "D-MOD"];
        case SemanticSymbolKind.PARAMETER:
            return ["D-SIM", "D-ACO"];
        default:
            return ["D-SIM"];
    }
}

function limitedCopy(values, maximumLength) {
    const items = values.slice(0, maximumLength);

    return {
        totalCount: values.length,
        truncated: items.length !== values.length,
        items
    };
}

function pushLimited(values, value, maximumLength) {
    if (value != null && values.length < maximumLength) {
        values.push(value);
    }
}

function sum(values, property) {
    return values.reduce(
        (total, value) => total + value[property],
        0
    );
}

function maximum(values, property) {
    return values.reduce(
        (result, value) => Math.max(
            result,
            value[property]
        ),
        0
    );
}
