/**
 * Vista inmutable del contexto relacional que acompaña a un punto del CFG.
 * Es el contrato compartido entre ciclos, recurrencias y clasificación.
 */
export class RelationalContext {

    constructor(
        ssaState = null,
        resolverOptions = {}
    ) {
        this.kind = "relational-context";
        this.ssaState = ssaState;
        this.constraints = Object.freeze([
            ...(ssaState?.getConstraints() ?? [])
        ]);
        this.reachable =
            ssaState?.reachable ?? false;
        this.resolverOptions =
            Object.freeze({
                ...resolverOptions
            });

        Object.freeze(this);
    }

    getBinding(name) {
        return this.ssaState?.get(name) ??
            null;
    }

    getConstraints() {
        return this.constraints;
    }

    createResolver(options = {}) {
        return this.ssaState
            ?.createResolver({
                ...this.resolverOptions,
                ...options
            }) ??
            null;
    }

    resolve(node, options = {}) {
        return this.createResolver(options)
            ?.resolve(node) ?? null;
    }

    resolveAbstract(node, options = {}) {
        return this.createResolver(options)
            ?.resolveAbstract(node) ?? null;
    }
}
