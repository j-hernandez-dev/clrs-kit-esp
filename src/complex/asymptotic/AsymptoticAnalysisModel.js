export class AsymptoticAnalysisModel {

    constructor(records = []) {
        this.records =
            Object.freeze(
                records.map(record =>
                    Object.freeze({
                        node:
                            record.node,
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
    }

    get(node) {
        return (
            this.analysisByNode
                .get(node) ??
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
