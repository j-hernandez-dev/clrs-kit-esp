export class ScenarioCostModel {

    constructor(records = []) {
        this.records =
            Object.freeze(
                records.map(record =>
                    Object.freeze({
                        node: record.node,
                        cost:
                            record.cost
                    })
                )
            );
        this.costByNode =
            new WeakMap(
                this.records.map(record => [
                    record.node,
                    record.cost
                ])
            );
    }

    get(node) {
        return (
            this.costByNode.get(node) ??
            null
        );
    }

    all() {
        return this.records.map(
            record =>
                record.cost
        );
    }
}
