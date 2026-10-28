import {
    DirectedCallGraph
} from "../../call-graph/index.js";

export class FunctionCallGraph {

    constructor(
        definitions,
        recurrenceInput = null
    ) {
        const definitionList =
            [...definitions.values()];
        this.vertices =
            Object.freeze(
                definitionList.map(
                    definition =>
                        Object.freeze({
                            name:
                                definition.summary
                                    .name,
                            sourceName:
                                sourceFunctionName(
                                    definition.summary
                                        .name
                                ),
                            parameters:
                                definition.summary
                                    .parameters,
                            node:
                                definition.node
                        })
                )
            );
        this.vertexByName =
            new Map(
                this.vertices.map(vertex => [
                    vertex.name,
                    vertex
                ])
            );
        this.vertexByNode =
            new WeakMap(
                this.vertices.map(vertex => [
                    vertex.node,
                    vertex
                ])
            );
        this.edges =
            Object.freeze(
                collectEdges(
                    recurrenceInput,
                    this.vertexByName
                )
            );
        const topology = new DirectedCallGraph({
            vertices: this.vertices,
            edges: this.edges,
            getVertexId: vertex => vertex.name,
            getEdgeSource: edge => edge.caller,
            getEdgeTarget: edge => edge.callee
        });

        this.outgoingByName =
            new Map(this.vertices.map(vertex => [
                vertex.name,
                topology.outgoing(vertex.name)
            ]));
        this.incomingByName =
            new Map(this.vertices.map(vertex => [
                vertex.name,
                topology.incoming(vertex.name)
            ]));

        this.components =
            Object.freeze(
                topology.components.map(
                    component => {
                        return Object.freeze({
                            id: component.id,
                            names:
                                component.vertexIds,
                            recursive:
                                component.recursive,
                            mutual: component.mutual,
                            internalEdges:
                                component.internalEdges,
                            dependencies:
                                component.dependencies
                        });
                    }
                )
            );
        this.componentById =
            new Map(
                this.components.map(component => [
                    component.id,
                    component
                ])
            );
        this.componentByName =
            new Map(
                this.components.flatMap(
                    component =>
                        component.names.map(name => [
                            name,
                            component
                        ])
                )
            );
        this.evaluationOrder =
            Object.freeze(
                topology.evaluationOrder.map(
                    component =>
                        this.componentById.get(
                            component.id
                        )
                )
            );
    }

    getVertex(nameOrNode) {
        if (
            typeof nameOrNode !==
            "string"
        ) {
            return this.vertexByNode.get(
                nameOrNode
            ) ?? null;
        }

        return (
            this.vertexByName.get(
                nameOrNode
            ) ??
            this.vertexByName.get(
                toCostName(nameOrNode)
            ) ??
            null
        );
    }

    getComponent(nameOrNode) {
        const vertex =
            this.getVertex(nameOrNode);

        return vertex == null
            ? null
            : this.componentByName.get(
                vertex.name
            ) ?? null;
    }

    outgoing(nameOrNode) {
        const vertex =
            this.getVertex(nameOrNode);

        return vertex == null
            ? []
            : [
                ...this.outgoingByName.get(
                    vertex.name
                ) ?? []
            ];
    }

    incoming(nameOrNode) {
        const vertex =
            this.getVertex(nameOrNode);

        return vertex == null
            ? []
            : [
                ...this.incomingByName.get(
                    vertex.name
                ) ?? []
            ];
    }

    recursiveComponents() {
        return this.components.filter(
            component =>
                component.recursive
        );
    }
}

function collectEdges(
    recurrenceInput,
    vertexByName
) {
    const records =
        recurrenceInput?.calls ?? [];
    const edges = [];

    for (const record of records) {
        const caller =
            toCostName(
                record.caller
            );
        const callee =
            toCostName(
                record.callee
            );

        if (
            !vertexByName.has(caller) ||
            !vertexByName.has(callee)
        ) {
            continue;
        }

        const variants = expandCallArguments(
            record
        );

        for (const argumentsList of variants) {
            edges.push(
                Object.freeze({
                    id: `call:${edges.length}`,
                    caller,
                    callee,
                    arguments:
                        Object.freeze([
                            ...argumentsList
                        ]),
                    relationalContext:
                        record.relationalContext ??
                        null,
                    node: record.node,
                    location:
                        record.node?.location ??
                        null
                })
            );
        }
    }

    return edges;
}

function expandCallArguments(record) {
    const alternatives =
        record.argumentAlternatives;

    if (
        !Array.isArray(alternatives) ||
        alternatives.length !==
            record.arguments.length
    ) {
        return [record.arguments];
    }

    let variants = [[]];

    for (const values of alternatives) {
        variants = variants.flatMap(prefix =>
            values.map(value => [
                ...prefix,
                value
            ])
        );

        if (variants.length > 32) {
            return [record.arguments];
        }
    }

    return variants;
}

function toCostName(name) {
    return "T" + name;
}

function sourceFunctionName(costName) {
    return costName.startsWith("T")
        ? costName.slice(1)
        : costName;
}
