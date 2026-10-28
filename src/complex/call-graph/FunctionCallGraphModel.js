export class FunctionCallGraphModel {

    constructor(
        graph,
        resolutions = []
    ) {
        this.vertices = graph.vertices;
        this.edges = graph.edges;
        this.components =
            graph.components;
        this.evaluationOrder =
            graph.evaluationOrder;
        this.graph = graph;
        this.resolutions =
            Object.freeze(
                resolutions.map(record =>
                    Object.freeze({
                        ...record
                    })
                )
            );
        this.resolutionByComponent =
            new Map(
                this.resolutions.map(
                    record => [
                        record.componentId,
                        record
                    ]
                )
            );
    }

    getVertex(nameOrNode) {
        return this.graph.getVertex(
            nameOrNode
        );
    }

    getComponent(nameOrNode) {
        return this.graph.getComponent(
            nameOrNode
        );
    }

    getResolution(
        componentOrName
    ) {
        const component =
            typeof componentOrName ===
                "object" &&
            componentOrName?.id != null
                ? componentOrName
                : this.getComponent(
                    componentOrName
                );

        return component == null
            ? null
            : this.resolutionByComponent
                .get(component.id) ??
                null;
    }

    outgoing(nameOrNode) {
        return this.graph.outgoing(
            nameOrNode
        );
    }

    incoming(nameOrNode) {
        return this.graph.incoming(
            nameOrNode
        );
    }

    recursiveComponents() {
        return this.graph
            .recursiveComponents();
    }
}
