export class UnknownComplexityModel {

    constructor(records = []) {
        this.records =
            Object.freeze(
                records.map(record =>
                    Object.freeze({
                        node: record.node,
                        reason:
                            record.reason
                    })
                )
            );
        const grouped = new Map();

        for (const record of this.records) {
            const reasons =
                grouped.get(record.node) ?? [];

            reasons.push(record.reason);
            grouped.set(record.node, reasons);
        }

        this.reasonsByNode =
            new WeakMap(
                [...grouped.entries()]
                    .map(([node, reasons]) => [
                        node,
                        Object.freeze(reasons)
                    ])
            );
    }

    get(node) {
        return (
            this.reasonsByNode
                .get(node) ??
            Object.freeze([])
        );
    }

    all() {
        return this.records.map(
            record =>
                record.reason
        );
    }

    byCode(code) {
        return this.all().filter(
            reason =>
                reason.code === code
        );
    }

    byCategory(category) {
        return this.all().filter(
            reason =>
                reason.category ===
                    category
        );
    }

    byScenario(scenario) {
        return this.all().filter(
            reason =>
                reason.scenario === scenario ||
                reason.scenario === "both"
        );
    }
}
