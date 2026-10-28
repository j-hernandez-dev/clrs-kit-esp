import {
    CLRSTestDomainError
} from "./CLRSTestDomainError.js";

export function requireRecord(value, code, field) {
    if (
        value == null ||
        typeof value !== "object" ||
        Array.isArray(value) ||
        (
            Object.getPrototypeOf(value) !==
                Object.prototype &&
            Object.getPrototypeOf(value) !== null
        )
    ) {
        invalid(code, field);
    }

    return value;
}

export function requireIdentifier(
    value,
    maximum,
    code,
    field
) {
    if (
        typeof value !== "string" ||
        value.length > maximum ||
        !/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/u
            .test(value)
    ) {
        invalid(code, field);
    }

    return value;
}

export function requireInlineText(
    value,
    maximum,
    code,
    field
) {
    if (
        typeof value !== "string" ||
        value.trim().length === 0 ||
        value.length > maximum ||
        containsUnsafeControl(value) ||
        /[\r\n]/u.test(value)
    ) {
        invalid(code, field);
    }

    return value.trim();
}

export function requireDataText(
    value,
    maximum,
    code,
    field
) {
    if (
        typeof value !== "string" ||
        value.length > maximum ||
        containsUnsafeControl(value)
    ) {
        invalid(code, field);
    }

    return value;
}

export function requireEnum(
    value,
    enumeration,
    code,
    field
) {
    if (!Object.values(enumeration).includes(value)) {
        invalid(code, field);
    }

    return value;
}

export function requireNonNegativeInteger(
    value,
    code,
    field,
    { nullable = false } = {}
) {
    if (nullable && value == null) {
        return null;
    }

    if (!Number.isSafeInteger(value) || value < 0) {
        invalid(code, field);
    }

    return value;
}

export function requireNullableInteger(
    value,
    code,
    field
) {
    if (value == null) {
        return null;
    }

    if (!Number.isSafeInteger(value)) {
        invalid(code, field);
    }

    return value;
}

export function requireNullableInlineText(
    value,
    maximum,
    code,
    field
) {
    return value == null
        ? null
        : requireInlineText(
            value,
            maximum,
            code,
            field
        );
}

export function freezeData(value, code, field) {
    try {
        return cloneAndFreeze(value, new Set());
    } catch {
        invalid(code, field);
    }
}

export function invalid(code, field = null) {
    throw CLRSTestDomainError.invalid(
        code,
        field
    );
}

function cloneAndFreeze(value, ancestors) {
    if (
        value == null ||
        typeof value === "string" ||
        typeof value === "boolean"
    ) {
        return value;
    }

    if (
        typeof value === "number" &&
        Number.isFinite(value)
    ) {
        return value;
    }

    if (typeof value !== "object") {
        throw new TypeError("Non-serializable value.");
    }

    if (ancestors.has(value)) {
        throw new TypeError("Cyclic value.");
    }

    ancestors.add(value);

    let result;

    if (Array.isArray(value)) {
        result = Object.freeze(
            value.map(item =>
                cloneAndFreeze(item, ancestors)
            )
        );
    } else {
        requireRecord(
            value,
            "CLRS_TEST_DATA_INVALID",
            "data"
        );
        result = Object.freeze(
            Object.fromEntries(
                Object.entries(value).map(
                    ([key, item]) => [
                        key,
                        cloneAndFreeze(
                            item,
                            ancestors
                        )
                    ]
                )
            )
        );
    }

    ancestors.delete(value);

    return result;
}

function containsUnsafeControl(value) {
    return [...value].some(character => {
        const code = character.codePointAt(0);

        return code < 32 &&
            character !== "\t" &&
            character !== "\n" &&
            character !== "\r";
    });
}
