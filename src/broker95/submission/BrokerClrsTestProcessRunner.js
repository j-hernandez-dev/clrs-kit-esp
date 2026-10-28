import {
    CLRSNodeTestProcessRunner
} from "../../testing/execution/index.js";
import {
    BrokerGameError
} from "../core/BrokerGameError.js";

export const BROKER_TEST_PROCESS_LIMITS =
    Object.freeze({
        maximumProgramCharacters: 1_048_576,
        maximumInputCharacters: 16_384,
        maximumOutputCharacters: 65_536,
        maximumErrorCharacters: 16_384
    });

/**
 * Adaptador compatible con la superficie histórica de BROKER.95. La
 * ejecución aislada y determinista pertenece al módulo compartido de
 * pruebas; BROKER conserva aquí sus límites y códigos de validación.
 */
export class BrokerClrsTestProcessRunner {

    constructor(options = {}) {
        this.runner = options.runner ??
            new CLRSNodeTestProcessRunner({
                ...options,
                temporaryPrefix: "clrs-broker95-",
                limits:
                    BROKER_TEST_PROCESS_LIMITS
            });
    }

    async run(request = {}) {
        const normalized = normalizeRequest(request);
        const result = await this.runner.run({
            ...normalized,
            seed: 0
        });

        return Object.freeze({
            status: result.status,
            exitCode: result.exitCode,
            signal: result.signal,
            stdout: result.stdout,
            stderr: result.stderr,
            elapsedMs: result.elapsedMs,
            technicalMessage:
                result.technicalMessage ?? null
        });
    }
}

function normalizeRequest(value) {
    if (!isRecord(value) ||
        Object.keys(value).some(key => ![
            "programCode",
            "stdin",
            "timeoutMs",
            "nodeExecutable",
            "gui",
            "signal"
        ].includes(key))) {
        invalid("BROKER95_TEST_PROCESS_REQUEST_INVALID");
    }

    const programCode = requireText(
        value.programCode,
        BROKER_TEST_PROCESS_LIMITS
            .maximumProgramCharacters,
        "BROKER95_TEST_PROCESS_PROGRAM_INVALID"
    );
    const stdin = requireText(
        value.stdin,
        BROKER_TEST_PROCESS_LIMITS
            .maximumInputCharacters,
        "BROKER95_TEST_PROCESS_INPUT_INVALID",
        true
    );

    if (!Number.isSafeInteger(value.timeoutMs) ||
        value.timeoutMs <= 0) {
        invalid("BROKER95_TEST_PROCESS_TIMEOUT_INVALID");
    }

    return Object.freeze({
        programCode,
        stdin,
        timeoutMs: value.timeoutMs,
        ...(value.nodeExecutable != null ? { nodeExecutable: value.nodeExecutable } : {}),
        ...(value.gui != null ? { gui: value.gui } : {}),
        ...(value.signal != null ? { signal: value.signal } : {})
    });
}

function requireText(value, maximum, code, allowEmpty = false) {
    if (
        typeof value !== "string" ||
        (!allowEmpty && value.length === 0) ||
        value.length > maximum ||
        value.includes("\u0000")
    ) {
        invalid(code);
    }

    return value;
}

function isRecord(value) {
    return value != null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        (
            Object.getPrototypeOf(value) === Object.prototype ||
            Object.getPrototypeOf(value) === null
        );
}

function invalid(code) {
    throw BrokerGameError.invalidRule(
        code,
        "No fue posible preparar la ejecución de una prueba.",
        []
    );
}
