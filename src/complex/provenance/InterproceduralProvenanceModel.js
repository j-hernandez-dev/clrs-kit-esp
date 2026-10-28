import {
    formatOrder
} from "../asymptotic/AsymptoticOrder.js";
import {
    composeAsymptoticOrder
} from "../asymptotic/AsymptoticOrderComposer.js";
import {
    substituteCostExpression
} from "../algebra/CostExpressionSubstitution.js";

export const InterproceduralResolutionKind =
    Object.freeze({
        SUMMARY: "summary",
        DIRECT_RECURSION: "direct-recursion",
        MUTUAL_RECURSION: "mutual-recursion",
        CACHE: "cache",
        MISSING_FUNCTION: "missing-function",
        INVALID_ARGUMENTS: "invalid-arguments",
        ACTIVE_CYCLE: "active-cycle"
    });

/**
 * Acumula, durante una pasada de anÃ¡lisis, la evidencia necesaria para
 * explicar cÃ³mo una llamada entre funciones conserva y transforma su
 * medida. Las entradas son mutables sÃ³lo durante esa pasada; el modelo que
 * se publica al informe es completamente inmutable.
 */
export class InterproceduralProvenanceBuilder {

    constructor() {
        this.nextId = 0;
        this.records = [];
    }

    begin({
        callee,
        caller = null,
        parentId = null,
        scenario,
        arguments: args = [],
        call = null,
        root = false,
        location = null
    }) {
        const record = {
            id: `interprocedural:${this.nextId++}`,
            callee: String(callee),
            caller:
                caller == null
                    ? null
                    : String(caller),
            parentId,
            scenario,
            root: Boolean(root),
            location,
            arguments: [...args],
            call,
            parameters: [],
            bindings: [],
            extraArguments: [],
            missing: [],
            requiredParameters: [],
            ignoredParameters: [],
            ignoredMissing: [],
            orderVariables: [],
            transferReplacements: [],
            instantiatedExpression: null,
            kind: null,
            method: null,
            reusedFrom: null,
            order: null,
            code: null,
            message: null
        };

        this.records.push(record);

        return record;
    }

    instantiate(record, {
        parameters = [],
        bindings = [],
        extraArguments = [],
        missing = [],
        expression = null,
        location = null
    } = {}) {
        record.parameters = [...parameters];
        record.bindings = bindings.map(binding => ({
            name: binding.name,
            expression: binding.expression
        }));
        record.extraArguments = [...extraArguments];
        record.missing = [...missing];
        record.instantiatedExpression = expression;
        record.location = location ?? record.location;

        return record;
    }

    complete(record, {
        kind,
        order,
        method = null,
        reusedFrom = null,
        code = null,
        message = null
    } = {}) {
        record.kind = kind;
        record.order = order ?? null;
        record.method = method;
        record.reusedFrom = reusedFrom;
        record.code =
            code ??
            order?.code ??
            null;
        record.message =
            message ??
            order?.message ??
            null;

        return record;
    }

    transfer(record, {
        requiredParameters = [],
        ignoredParameters = [],
        ignoredMissing = [],
        orderVariables = [],
        replacements = new Map()
    } = {}) {
        if (record == null) {
            return null;
        }

        record.requiredParameters = [
            ...requiredParameters
        ];
        record.ignoredParameters = [
            ...ignoredParameters
        ];
        record.ignoredMissing = [
            ...ignoredMissing
        ];
        record.orderVariables = [
            ...orderVariables
        ];
        record.transferReplacements = [
            ...replacements
        ].map(([name, order]) => ({
            name,
            order
        }));

        return record;
    }

    build() {
        return new InterproceduralProvenanceModel(
            this.records
        );
    }
}

/**
 * Consulta inmutable de las instanciaciones de costos de funciones. Una
 * traza conserva el Ã¡rbol de llamadas evaluado, las sustituciones formales
 * -> reales y el resultado o causa obtenida en cada paso.
 */
export class InterproceduralProvenanceModel {

    constructor(records = []) {
        this.records = Object.freeze(
            records.map(freezeRecord)
        );
        this.recordById = new Map(
            this.records.map(record => [
                record.id,
                record
            ])
        );
        this.recordsByCallee = groupBy(
            this.records,
            record => record.callee
        );
        this.childrenByParent = groupBy(
            this.records.filter(record =>
                record.parentId != null
            ),
            record => record.parentId
        );
    }

    get(id) {
        return this.recordById.get(id) ?? null;
    }

    all() {
        return [...this.records];
    }

    forFunction(name, scenario = null) {
        const costName = toCostName(name);

        return [
            ...this.recordsByCallee
                .get(costName) ?? []
        ].filter(record =>
            scenario == null ||
            record.scenario === scenario
        );
    }

    rootsFor(name, scenario = null) {
        return this.forFunction(name, scenario)
            .filter(record => record.root);
    }

    traceFor(name, scenario = null) {
        return this.rootsFor(name, scenario)
            .map(record =>
                this.buildTrace(record, new Set())
            );
    }

    buildTrace(
        record,
        ancestors,
        expressionBindings = [],
        orderReplacements = new Map()
    ) {
        const nextAncestors = new Set(ancestors);
        nextAncestors.add(record.id);
        const displayed = rebindRecord(
            record,
            expressionBindings,
            orderReplacements
        );
        let childRecords = [
            ...this.childrenByParent
                .get(record.id) ?? []
        ];

        if (
            childRecords.length === 0 &&
            record.reusedFrom != null &&
            !nextAncestors.has(
                record.reusedFrom
            )
        ) {
            childRecords = [
                ...this.childrenByParent
                    .get(record.reusedFrom) ?? []
            ];
        }

        const children = childRecords
            .filter(child =>
                !nextAncestors.has(child.id)
            )
            .map(child =>
                this.buildTrace(
                    child,
                    nextAncestors,
                    displayed.bindings,
                    new Map(
                        displayed
                            .transferReplacements
                            .map(replacement => [
                                replacement.name,
                                replacement.order
                            ])
                    )
                )
            );

        return Object.freeze({
            ...displayed,
            children: Object.freeze(children)
        });
    }
}

function freezeRecord(record) {
    const order = record.order ?? null;

    return Object.freeze({
        id: record.id,
        callee: record.callee,
        caller: record.caller,
        parentId: record.parentId ?? null,
        scenario: record.scenario,
        root: Boolean(record.root),
        location: freezeLocation(record.location),
        arguments: Object.freeze([
            ...record.arguments
        ]),
        call:
            record.call ??
            null,
        parameters: Object.freeze([
            ...record.parameters
        ]),
        bindings: Object.freeze(
            record.bindings.map(binding =>
                Object.freeze({
                    name: binding.name,
                    expression:
                        binding.expression
                })
            )
        ),
        extraArguments: Object.freeze([
            ...record.extraArguments
        ]),
        missing: Object.freeze([
            ...record.missing
        ]),
        requiredParameters: Object.freeze([
            ...record.requiredParameters
        ]),
        ignoredParameters: Object.freeze([
            ...record.ignoredParameters
        ]),
        ignoredMissing: Object.freeze([
            ...record.ignoredMissing
        ]),
        orderVariables: Object.freeze([
            ...record.orderVariables
        ]),
        transferReplacements:
            Object.freeze(
                record.transferReplacements
                    .map(replacement =>
                        Object.freeze({
                            name:
                                replacement.name,
                            order:
                                replacement.order
                        })
                    )
            ),
        instantiatedExpression:
            record.instantiatedExpression ??
            null,
        kind: record.kind,
        method: record.method,
        reusedFrom:
            record.reusedFrom ??
            null,
        status:
            order == null
                ? "unknown"
                : order.known
                    ? "resolved"
                    : "unknown",
        notation:
            order == null
                ? "O(?)"
                : formatOrder(order),
        order,
        code:
            record.code ??
            null,
        message:
            record.message ??
            null
    });
}

function rebindRecord(
    record,
    expressionBindings,
    orderReplacements
) {
    const bindings = expressionBindings.length === 0
        ? record.bindings
        : record.bindings.map(binding =>
            Object.freeze({
                ...binding,
                expression:
                    substituteCostExpression(
                        binding.expression,
                        expressionBindings
                    )
            })
        );
    const args = expressionBindings.length === 0
        ? record.arguments
        : record.arguments.map(argument =>
            substituteCostExpression(
                argument,
                expressionBindings
            )
        );
    const order =
        record.order?.known === true &&
        orderReplacements.size > 0
            ? composeAsymptoticOrder(
                record.order,
                orderReplacements
            )
            : record.order;
    const transferReplacements =
        record.transferReplacements.map(
            replacement =>
                Object.freeze({
                    name:
                        replacement.name,
                    order:
                        replacement.order
                            ?.known === true &&
                        orderReplacements.size > 0
                            ? composeAsymptoticOrder(
                                replacement.order,
                                orderReplacements
                            )
                            : replacement.order
                })
        );

    return Object.freeze({
        ...record,
        arguments: Object.freeze([...args]),
        bindings: Object.freeze([...bindings]),
        order,
        notation:
            order == null
                ? "O(?)"
                : formatOrder(order),
        transferReplacements:
            Object.freeze(
                transferReplacements
            )
    });
}

function groupBy(records, keyOf) {
    const groups = new Map();

    for (const record of records) {
        const key = keyOf(record);
        const entries = groups.get(key) ?? [];

        entries.push(record);
        groups.set(key, entries);
    }

    for (const [key, entries] of groups) {
        groups.set(
            key,
            Object.freeze(entries)
        );
    }

    return groups;
}

function toCostName(name) {
    const value = String(name);

    return value.startsWith("T")
        ? value
        : "T" + value;
}

function freezeLocation(location) {
    return location == null
        ? null
        : Object.freeze({
            ...location
        });
}
