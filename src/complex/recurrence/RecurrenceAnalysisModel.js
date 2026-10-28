export class RecurrenceAnalysisModel {

    constructor(records = []) {
        this.records =
            Object.freeze(
                records.map(record =>
                    Object.freeze({
                        node:
                            record.node,
                        name:
                            record.name,
                        analysis:
                            record.analysis
                    })
                )
            );
        this.analysisByNode =
            new WeakMap(
                this.records.map(record => [
                    record.node,
                    record.analysis
                ])
            );
        this.analysisByName =
            new Map(
                this.records.map(record => [
                    record.name,
                    record.analysis
                ])
            );
    }

    get(nodeOrName) {
        if (
            typeof nodeOrName ===
            "string"
        ) {
            return (
                this.analysisByName
                    .get(nodeOrName) ??
                null
            );
        }

        return (
            this.analysisByNode
                .get(nodeOrName) ??
            null
        );
    }

    all() {
        return this.records.map(
            record =>
                record.analysis
        );
    }
}
