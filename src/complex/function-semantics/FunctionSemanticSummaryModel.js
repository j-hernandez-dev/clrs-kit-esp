import {
    applyAbstractFunctionEffect,
    evaluateAbstractCostExpression,
    joinAbstractValues,
    requireAbstractValue
} from "../abstract-domain/index.js";
import {
    CostExpressionFactory as Cost
} from "../algebra/CostExpressionFactory.js";
import {
    getStandardLibraryDefinition
} from "../../standard-library/StandardLibraryCatalog.js";

/**
 * Instancia resúmenes semánticos con los valores abstractos reales de cada
 * llamada. El conjunto `active` impide que una recursión, directa o mutua,
 * se convierta erróneamente en un resumen no recursivo.
 */
export class FunctionSemanticSummaryModel {

    constructor(records = []) {
        this.records = Object.freeze(
            records.map(record =>
                Object.freeze({
                    node: record.node,
                    summary: record.summary
                })
            )
        );
        this.summaryByNode = new WeakMap(
            this.records.map(record => [
                record.node,
                record.summary
            ])
        );
        this.summaryByName = new Map(
            this.records.map(record => [
                record.summary.name,
                record.summary
            ])
        );
    }

    get(nodeOrName) {
        return typeof nodeOrName === "string"
            ? this.summaryByName.get(nodeOrName) ?? null
            : this.summaryByNode.get(nodeOrName) ?? null;
    }

    all() {
        return this.records.map(record =>
            record.summary
        );
    }

    resolveCall(name, args) {
        return this.resolve(name, args, new Set());
    }

    resolve(name, args, active) {
        const summary = this.get(name);

        if (
            summary == null ||
            !this.isUsable(summary, active)
        ) {
            return null;
        }

        if (args.length < summary.parameters.length) {
            return null;
        }

        args.forEach(requireAbstractValue);
        const nextActive = new Set(active);
        nextActive.add(name);
        const symbols = new Map(
            summary.parameters.map((parameter, index) => [
                parameter,
                args[index]
            ])
        );
        const returned = summary.returns.map(item =>
            evaluateAbstractCostExpression(
                item.expression,
                {
                    symbols,
                    resolveCall: (
                        callee,
                        callArgs,
                        callExpression
                    ) => this.resolveNestedCall(
                        callee,
                        callArgs,
                        callExpression,
                        nextActive
                    )
                }
            )
        );

        return joinAbstractValues(
            returned,
            Cost.call(
                name,
                args.map(argument =>
                    argument.expression
                )
            )
        );
    }

    resolveNestedCall(
        name,
        args,
        expression,
        active
    ) {
        const definition =
            getStandardLibraryDefinition(name);

        if (definition != null) {
            return applyAbstractFunctionEffect(
                definition.symbolicEffect,
                args,
                expression
            );
        }

        return this.resolve(name, args, active);
    }

    isUsable(summary, active = new Set()) {
        if (
            !summary.transparent ||
            active.has(summary.name)
        ) {
            return false;
        }

        const nextActive = new Set(active);
        nextActive.add(summary.name);

        return summary.dependencies.every(name => {
            if (getStandardLibraryDefinition(name) != null) {
                return true;
            }

            const dependency = this.get(name);

            return dependency != null &&
                this.isUsable(
                    dependency,
                    nextActive
                );
        });
    }
}
