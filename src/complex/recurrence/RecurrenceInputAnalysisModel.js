export class RecurrenceInputAnalysisModel {

    constructor({
        functions = [],
        calls = []
    } = {}) {
        this.functions =
            Object.freeze([
                ...functions
            ]);
        this.calls =
            Object.freeze([
                ...calls
            ]);
        this.functionByCostName =
            new Map(
                this.functions.map(
                    definition => [
                        definition.costName,
                        definition
                    ]
                )
            );
        this.callByNode =
            new WeakMap(
                this.calls.map(
                    record => [
                        record.node,
                        record
                    ]
                )
            );
    }

    getFunction(costName) {
        return (
            this.functionByCostName
                .get(costName) ??
            null
        );
    }

    getCall(node) {
        return (
            this.callByNode
                .get(node) ??
            null
        );
    }
}
