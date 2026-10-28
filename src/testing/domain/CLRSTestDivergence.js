import {
    CLRSTestDivergenceKind,
    CLRSTestDivergenceReason
} from "./CLRSTestTypes.js";
import {
    freezeData,
    invalid,
    requireEnum,
    requireRecord
} from "./CLRSTestValidation.js";

/**
 * Evidencia neutral de la primera diferencia demostrable. Los valores pueden
 * ser escalares o estructuras JSON; `expectedPresent` y `actualPresent`
 * distinguen un valor ausente de un valor JSON null legítimo.
 */
export class CLRSTestDivergence {

    constructor(source = {}) {
        const input = requireRecord(
            source,
            "CLRS_TEST_DIVERGENCE_INVALID",
            "divergence"
        );

        this.kind = requireEnum(
            input.kind,
            CLRSTestDivergenceKind,
            "CLRS_TEST_DIVERGENCE_KIND_INVALID",
            "divergence.kind"
        );
        this.reason = requireEnum(
            input.reason,
            CLRSTestDivergenceReason,
            "CLRS_TEST_DIVERGENCE_REASON_INVALID",
            "divergence.reason"
        );
        this.path = requirePath(input.path ?? []);
        this.index = optionalNonNegativeInteger(
            input.index,
            "divergence.index"
        );
        this.line = optionalPositiveInteger(
            input.line,
            "divergence.line"
        );
        this.column = optionalPositiveInteger(
            input.column,
            "divergence.column"
        );
        this.expectedPresent = requireBoolean(
            input.expectedPresent ?? true,
            "divergence.expectedPresent"
        );
        this.actualPresent = requireBoolean(
            input.actualPresent ?? true,
            "divergence.actualPresent"
        );
        this.expected = freezeData(
            input.expected ?? null,
            "CLRS_TEST_DIVERGENCE_VALUE_INVALID",
            "divergence.expected"
        );
        this.actual = freezeData(
            input.actual ?? null,
            "CLRS_TEST_DIVERGENCE_VALUE_INVALID",
            "divergence.actual"
        );
        this.difference = optionalFiniteNumber(
            input.difference,
            "divergence.difference",
            { nonNegative: true }
        );
        this.tolerance = optionalFiniteNumber(
            input.tolerance,
            "divergence.tolerance",
            { nonNegative: true }
        );

        Object.freeze(this);
    }
}

export function createCLRSTestDivergence(source) {
    return source instanceof CLRSTestDivergence
        ? source
        : new CLRSTestDivergence(source);
}

function requirePath(source) {
    if (
        !Array.isArray(source) ||
        source.some(item =>
            !(
                typeof item === "string" ||
                (
                    Number.isSafeInteger(item) &&
                    item >= 0
                )
            )
        )
    ) {
        invalid(
            "CLRS_TEST_DIVERGENCE_PATH_INVALID",
            "divergence.path"
        );
    }

    return Object.freeze([...source]);
}

function requireBoolean(value, field) {
    if (typeof value !== "boolean") {
        invalid(
            "CLRS_TEST_DIVERGENCE_BOOLEAN_INVALID",
            field
        );
    }

    return value;
}

function optionalNonNegativeInteger(value, field) {
    if (value == null) {
        return null;
    }

    if (!Number.isSafeInteger(value) || value < 0) {
        invalid(
            "CLRS_TEST_DIVERGENCE_INDEX_INVALID",
            field
        );
    }

    return value;
}

function optionalPositiveInteger(value, field) {
    if (value == null) {
        return null;
    }

    if (!Number.isSafeInteger(value) || value < 1) {
        invalid(
            "CLRS_TEST_DIVERGENCE_POSITION_INVALID",
            field
        );
    }

    return value;
}

function optionalFiniteNumber(
    value,
    field,
    { nonNegative = false } = {}
) {
    if (value == null) {
        return null;
    }

    if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        (nonNegative && value < 0)
    ) {
        invalid(
            "CLRS_TEST_DIVERGENCE_NUMBER_INVALID",
            field
        );
    }

    return value;
}
