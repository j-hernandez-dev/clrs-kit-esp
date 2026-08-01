import { ASTVisitorError } from "./ASTVisitorError.js";

/**
 * Visitor base para consumidores del AST.
 *
 * Los handlers se ejecutan con la instancia concreta como `this`, por lo que
 * los visitors derivados pueden registrar directamente sus métodos.
 */
export class ASTVisitor {

    constructor() {
        this.handlers = Object.create(null);
    }

    /**
     * Registra handlers indexados por NodeTypes.
     *
     * @param {Record<string, Function>} handlers
     * @returns {this}
     */
    registerHandlers(handlers) {
        for (const [nodeType, handler] of Object.entries(handlers)) {
            if (typeof handler !== "function") {
                throw ASTVisitorError.invalidHandler(nodeType);
            }

            this.handlers[nodeType] = handler;
        }

        return this;
    }

    /**
     * Indica si existe un handler para el tipo recibido.
     *
     * @param {string|{type?: string}} nodeOrType
     * @returns {boolean}
     */
    supports(nodeOrType) {
        const nodeType =
            typeof nodeOrType === "string"
                ? nodeOrType
                : nodeOrType?.type;

        return (
            typeof nodeType === "string" &&
            typeof this.handlers[nodeType] === "function"
        );
    }

    /**
     * Despacha un nodo hacia su handler.
     *
     * @param {import("../core/ASTTypes.js").ASTNode} node
     * @param {any} [context]
     * @returns {any}
     */
    visit(node, context = undefined) {
        if (
            !node ||
            typeof node !== "object" ||
            Array.isArray(node) ||
            typeof node.type !== "string" ||
            node.type.length === 0
        ) {
            throw ASTVisitorError.invalidNode(node);
        }

        const handler = this.handlers[node.type];

        if (!handler) {
            return this.visitUnsupported(node, context);
        }

        return handler.call(this, node, context);
    }

    /**
     * Visita una secuencia conservando orden y cardinalidad.
     *
     * @param {import("../core/ASTTypes.js").ASTNode[]} nodes
     * @param {any} [context]
     * @returns {any[]}
     */
    visitMany(nodes, context = undefined) {
        if (!Array.isArray(nodes)) {
            throw ASTVisitorError.invalidNodeList();
        }

        return nodes.map(node =>
            this.visit(node, context)
        );
    }

    /**
     * Punto de extensión para visitors que permitan nodos desconocidos.
     *
     * @param {import("../core/ASTTypes.js").ASTNode} node
     * @returns {never}
     */
    visitUnsupported(node) {
        throw ASTVisitorError.unsupportedNode(node);
    }
}
