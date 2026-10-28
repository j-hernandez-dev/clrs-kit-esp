export class IterationAnalysisModel {

    constructor(records = []) {
        this.records =
            Object.freeze(
                records.map(record =>
                    Object.freeze({
                        node:
                            record.node,
                        analysis:
                            record.analysis,
                        environment:
                            record.environment ??
                            null
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
        this.environmentByNode =
            new WeakMap(
                this.records
                    .filter(record =>
                        record.environment != null
                    )
                    .map(record => [
                        record.node,
                        record.environment
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

    has(node) {
        return this.analysisByNode
            .has(node);
    }

    getEnvironment(node) {
        return this.environmentByNode
            .get(node) ?? null;
    }

    getPathAnalysis(node) {
        return this.get(node)
            ?.pathAnalysis ?? null;
    }

    getTermination(node) {
        return this.get(node)
            ?.termination ?? null;
    }

    getTransition(node) {
        return this.get(node)
            ?.transition ?? null;
    }

    getTrajectory(node) {
        return this.get(node)
            ?.trajectory ?? null;
    }

    getInvariants(node) {
        return this.get(node)
            ?.invariants ?? null;
    }

    all() {
        return this.records.map(
            record =>
                record.analysis
        );
    }
}
