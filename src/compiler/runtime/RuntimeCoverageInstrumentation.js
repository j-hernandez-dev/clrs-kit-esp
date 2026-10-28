import {
    createExecutionCoveragePoint,
    ExecutionCoverageKind
} from "../../runtime/ExecutionCoverageEvent.js";

/**
 * Emite evidencia de cobertura sin conservar estado en el código generado.
 * El runtime sólo escribe los eventos cuando existe una traza activa.
 */
export class RuntimeCoverageInstrumentation {

    constructor(options = {}) {
        const programKey =
            options.programKey ??
            globalThis.ProgramKey;

        this.markerName =
            options.markerName ??
            `recordRuntimeCoverage_${programKey}`;
        this.conditionMarkerName =
            options.conditionMarkerName ??
            `recordRuntimeCoverageCondition_${programKey}`;
    }

    markStatement(location) {
        return this.mark(
            ExecutionCoverageKind.STATEMENT,
            location
        );
    }

    markFunction(declaration) {
        return this.mark(
            ExecutionCoverageKind.FUNCTION,
            declaration?.location,
            {
                name:
                    declaration?.identifier?.name
            }
        );
    }

    wrapBranch(expression, location) {
        return this.wrapCondition(
            expression,
            ExecutionCoverageKind.BRANCH,
            location
        );
    }

    wrapLoop(expression, location) {
        return this.wrapCondition(
            expression,
            ExecutionCoverageKind.LOOP,
            location
        );
    }

    mark(kind, location, options = {}) {
        const point = createExecutionCoveragePoint(
            kind,
            location,
            options
        );

        return point == null
            ? ""
            : `${this.markerName}(${JSON.stringify(point)});\n`;
    }

    wrapCondition(expression, kind, location) {
        const point = createExecutionCoveragePoint(
            kind,
            location
        );

        return point == null
            ? expression
            : (
                `${this.conditionMarkerName}(` +
                `${JSON.stringify(point)}, ` +
                `${expression})`
            );
    }
}
