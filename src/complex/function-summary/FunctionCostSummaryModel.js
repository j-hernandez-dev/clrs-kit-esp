export class FunctionCostSummaryModel {

    constructor(records = []) {
        this.records =
            Object.freeze(
                records.map(record =>
                    Object.freeze({
                        node: record.node,
                        summary:
                            record.summary
                    })
                )
            );
        this.summaryByNode =
            new WeakMap(
                this.records.map(record => [
                    record.node,
                    record.summary
                ])
            );
        this.summaryByName =
            new Map(
                this.records.map(record => [
                    record.summary.name,
                    record.summary
                ])
            );
    }

    get(nodeOrName) {
        if (
            typeof nodeOrName ===
            "string"
        ) {
            return (
                this.summaryByName
                    .get(nodeOrName) ??
                null
            );
        }

        return (
            this.summaryByNode
                .get(nodeOrName) ??
            null
        );
    }

    all() {
        return this.records.map(
            record =>
                record.summary
        );
    }
}
