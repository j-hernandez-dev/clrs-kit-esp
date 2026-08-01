import {
    ApplicationError
} from "../errors/ApplicationError.js";
import {
    LanguageError
} from "../errors/LanguageError.js";

export function applicationSuccess(
    value,
    metadata = {}
) {
    return {
        ok: true,
        value,
        errors: [],
        metadata
    };
}

export function applicationFailure(
    errors,
    metadata = {}
) {
    const errorList =
        Array.isArray(errors)
            ? errors
            : [errors];

    return {
        ok: false,
        value: null,
        errors: errorList.map(
            normalizeApplicationError
        ),
        metadata
    };
}

export function normalizeApplicationError(
    error
) {
    if (error instanceof LanguageError) {
        return error;
    }

    return new ApplicationError(
        error instanceof Error
            ? error.message
            : "Unknown application error.",
        {
            cause: error,
            audience: "developer",
            publicMessage:
                "Ocurrió un error interno en la aplicación."
        }
    );
}

export async function tryApplicationOperation(
    operation,
    metadata = {}
) {
    try {
        return applicationSuccess(
            await operation(),
            metadata
        );
    } catch (error) {
        return applicationFailure(
            error,
            metadata
        );
    }
}

export function tryApplicationOperationSync(
    operation,
    metadata = {}
) {
    try {
        return applicationSuccess(
            operation(),
            metadata
        );
    } catch (error) {
        return applicationFailure(
            error,
            metadata
        );
    }
}
