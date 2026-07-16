/**
 *
 * CSTAdapter.js
 *
 * ==================================
 * CST ADAPTER
 * ==================================
 *
 * Acceso normalizado al CST generado
 * por Chevrotain.
 *
 * Regla principal:
 *
 * Todo está dentro de ctx.children
 *
 * ==================================
 */


export class CSTAdapter {


    /**
     * Obtiene hijos CST por nombre
     *
     * Ejemplo:
     *
     * ctx.children.expression
     *
     * @param {any} ctx
     * @param {string} key
     */
    static get(ctx, key) {

        if (!ctx) {
            return [];
        }


        return ctx.children?.[key] ?? [];

    }



    /**
     * Primer hijo CST
     *
     * @param {any} ctx
     * @param {string} key
     */
    static first(ctx, key) {

        const items = this.get(ctx, key);

        return items.length
            ? items[0]
            : null;

    }



    /**
     * Verifica existencia
     *
     * @param {any} ctx
     * @param {string} key
     */
    static has(ctx, key) {

        return this.get(ctx, key).length > 0;

    }



    /**
     * Obtiene token image
     * 
     * Ejemplo:
     * 
     * "Seleccionar"
     * @param {any} ctx
     * @param {any} name
     */
    static token(ctx, name) {

        const tokens = ctx.children?.[name];

        if (!tokens || tokens.length === 0) {
            return null;
        }

        return tokens[0];
    }

    /**
     * Convierte tokens a texto
     * @param {any} ctx
     * @param {any} key
     */
    static mapTokens(ctx, key) {

        return this.get(ctx, key)
            .map(
                (/** @type {{ image: any; }} */ token) =>
                    token.image
            );

    }

    /**
     * Obtiene children completos
     * @param {any} ctx
     */
    static children(ctx) {

        return ctx?.children ?? {};

    }

    /**
     * Debug del CST
     * @param {any} ctx
     */
    static debug(ctx) {

        console.log(
            "===== CST DEBUG ====="
        );


        console.log({

            name: ctx?.name,

            children:
                Object.keys(
                    ctx?.children ?? {}
                )
        });
    }

    /**
     * Debug profundo
     * @param {any} ctx
     */
    static inspect(ctx) {

        console.log(
            JSON.stringify(
                ctx?.children,
                null,
                2
            )
        );

    }

    /**
     * @param {any} ctx
     */
    visitType(ctx) {

        if (!ctx)
            return null;


        const children =
            CSTAdapter.children(ctx);


        return Object.keys(children)[0] ?? null;

    }
}