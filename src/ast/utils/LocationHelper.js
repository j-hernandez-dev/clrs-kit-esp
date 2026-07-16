
export class LocationHelper {
    /**
     * @param {any} ctx
     */
    static from(ctx) {
        return this.getLocationFromNode(ctx);
    }

    /**
     * @param {any} node
     */
    static getLocationFromNode(node) {
        const tokens = this.collectTokens(node);

        if (!tokens.length) {
            return null;
        }

        const start = tokens[0];
        const end = tokens[tokens.length - 1];

        return {
            startLine: start.startLine,
            startColumn: start.startColumn,
            endLine: end.endLine,
            endColumn: end.endColumn
        };
    }

    /**
     * @param {any} node
     * @param {any} tokens
     */
    static collectTokens(node, tokens = []) {
        if (!node) return tokens;

        // Caso base: token real de Chevrotain/CST
        if (node.image !== undefined) {
            tokens.push(node);
        }

        // recorrer hijos
        if (node.children) {
            for (const key of Object.keys(node.children)) {
                const arr = node.children[key];

                if (Array.isArray(arr)) {
                    for (const child of arr) {
                        this.collectTokens(child, tokens);
                    }
                }
            }
        }

        return tokens;
    }

    /**
     * @param {any} token
     */
    static fromTokens(token) {

        if (!token) {
            return null;
        }

        return {
            startLine: token.startLine,
            startColumn: token.startColumn,
            endLine: token.endLine,
            endColumn: token.endColumn
        };
    }

    /**
     * @param {any} start
     * @param {any} end
     */
    static fromMerge(start, end) {

        if (!start || !end) {
            return null;
        }

        return {
            startLine: start.startLine,
            startColumn: start.startColumn,

            endLine: end.endLine,
            endColumn: end.endColumn
        };

    }

}