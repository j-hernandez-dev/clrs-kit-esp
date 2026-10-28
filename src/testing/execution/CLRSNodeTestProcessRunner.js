import {
    spawn
} from "node:child_process";
import {
    mkdtemp,
    readFile,
    rm,
    writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
    CLRS_TEST_LIMITS
} from "../domain/index.js";
import {
    CLRSTestExecutionError
} from "./CLRSTestExecutionError.js";
import {
    normalizeExecutionCoverageEvent
} from "../../runtime/ExecutionCoverageEvent.js";

export const CLRSTestProcessStatus = Object.freeze({
    COMPLETED: "completed",
    TIMED_OUT: "timed-out",
    OUTPUT_LIMIT: "output-limit",
    START_FAILED: "start-failed",
    CANCELLED: "cancelled"
});

export const CLRS_TEST_PROCESS_LIMITS =
    Object.freeze({
        maximumProgramCharacters: 4_194_304,
        maximumInputCharacters:
            CLRS_TEST_LIMITS.maximumInputCharacters,
        maximumOutputCharacters: 65_536,
        maximumErrorCharacters: 16_384,
        maximumCoverageEvents: 10_000,
        maximumTraceCharacters: 8_388_608
    });

const RUNNER_FILE_NAME = "runner.mjs";
const PROGRAM_FILE_NAME = "program.mjs";
const TRACE_FILE_NAME = "coverage.jsonl";
const DETERMINISTIC_BOOTSTRAP = String.raw`
const rawSeed = Number.parseInt(
    process.env.CLRS_TEST_SEED ?? "0",
    10
);
let randomState = Number.isFinite(rawSeed)
    ? rawSeed >>> 0
    : 0;

Math.random = () => {
    randomState = (randomState + 0x6D2B79F5) >>> 0;
    let value = randomState;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
};

await import("./program.mjs");
`;

/**
 * Ejecuta un único caso en un proceso y directorio temporales. No usa shell,
 * limita la salida, filtra el entorno y fija Math.random mediante una semilla.
 * No constituye una sandbox de seguridad para código no confiable.
 */
export class CLRSNodeTestProcessRunner {

    constructor(options = {}) {
        this.spawn = options.spawn ?? spawn;
        this.mkdtemp = options.mkdtemp ?? mkdtemp;
        this.writeFile = options.writeFile ?? writeFile;
        this.readFile = options.readFile ?? readFile;
        this.remove = options.remove ?? rm;
        this.tmpdir = options.tmpdir ?? os.tmpdir;
        this.path = options.path ?? path;
        this.command = options.command ?? "node";
        this.now = options.now ?? Date.now;
        this.environment = options.environment ?? process.env;
        this.temporaryPrefix =
            options.temporaryPrefix ?? "clrs-tests-";
        this.limits = Object.freeze({
            ...CLRS_TEST_PROCESS_LIMITS,
            ...(options.limits ?? {})
        });
    }

    async run(request = {}) {
        const normalized = normalizeRequest(
            request,
            this.limits
        );

        if (normalized.signal?.aborted === true) {
            return cancelledResult(normalized.seed);
        }

        const directory = await this.mkdtemp(
            this.path.join(
                this.tmpdir(),
                this.temporaryPrefix
            )
        );
        const programPath = this.path.join(
            directory,
            PROGRAM_FILE_NAME
        );
        const runnerPath = this.path.join(
            directory,
            RUNNER_FILE_NAME
        );
        const tracePath = this.path.join(
            directory,
            TRACE_FILE_NAME
        );

        try {
            await Promise.all([
                this.writeFile(
                    programPath,
                    normalized.programCode,
                    "utf8"
                ),
                this.writeFile(
                    runnerPath,
                    DETERMINISTIC_BOOTSTRAP,
                    "utf8"
                )
            ]);

            return await this.#runProcess({
                ...normalized,
                directory,
                runnerPath,
                tracePath
            });
        } finally {
            await this.remove(directory, {
                recursive: true,
                force: true
            });
        }
    }

    #runProcess(request) {
        return new Promise(resolve => {
            const startedAt = this.now();
            let child;

            try {
                child = this.spawn(
                    request.nodeExecutable ?? this.command,
                    [request.runnerPath],
                    {
                        cwd: request.directory,
                        env: createTestEnvironment(
                            this.environment,
                            request.seed,
                            request.tracePath,
                            request.gui
                        ),
                        stdio: ["pipe", "pipe", "pipe"],
                        shell: false,
                        windowsHide: true,
                        // Aísla también los probes hijos del programa GUI para poder cancelarlos.
                        detached: request.gui === true && process.platform !== "win32"
                    }
                );
            } catch (error) {
                resolve(startFailure(
                    error,
                    startedAt,
                    this.now,
                    request.seed
                ));
                return;
            }

            let stdout = "";
            let stderr = "";
            let outcome = null;
            let settled = false;
            let timer = null;
            const onAbort = () => {
                if (outcome == null) {
                    outcome =
                        CLRSTestProcessStatus.CANCELLED;
                    terminate(child, request.gui);
                }
            };
            const finish = async result => {
                if (settled) {
                    return;
                }

                settled = true;
                if (timer != null) {
                    clearTimeout(timer);
                }
                request.signal?.removeEventListener(
                    "abort",
                    onAbort
                );

                const coverage =
                    await readCoverageEvidence({
                        tracePath:
                            request.tracePath,
                        readFile: this.readFile,
                        limits: this.limits
                    });

                resolve(Object.freeze({
                    ...result,
                    stdout,
                    stderr,
                    elapsedMs: elapsed(
                        startedAt,
                        this.now
                    ),
                    seed: request.seed,
                    coverage
                }));
            };
            const limitOutput = () => {
                if (outcome == null) {
                    outcome =
                        CLRSTestProcessStatus
                            .OUTPUT_LIMIT;
                    terminate(child, request.gui);
                }
            };

            child.stdout?.on("data", chunk => {
                stdout = appendBounded(
                    stdout,
                    chunk,
                    this.limits
                        .maximumOutputCharacters,
                    limitOutput
                );
            });
            child.stderr?.on("data", chunk => {
                stderr = appendBounded(
                    stderr,
                    chunk,
                    this.limits
                        .maximumErrorCharacters,
                    () => {}
                );
            });
            child.once("error", error => {
                finish({
                    status:
                        CLRSTestProcessStatus
                            .START_FAILED,
                    exitCode: null,
                    signal: null,
                    technicalMessage:
                        technicalMessage(error)
                });
            });
            child.once("close", (exitCode, signal) => {
                finish({
                    status: outcome ??
                        CLRSTestProcessStatus.COMPLETED,
                    exitCode:
                        normalizeExitCode(exitCode),
                    signal:
                        normalizeSignal(signal),
                    technicalMessage: null
                });
            });

            request.signal?.addEventListener(
                "abort",
                onAbort,
                { once: true }
            );
            if (request.signal?.aborted === true) {
                onAbort();
            }

            timer = setTimeout(() => {
                if (outcome == null) {
                    outcome =
                        CLRSTestProcessStatus.TIMED_OUT;
                    terminate(child, request.gui);
                }
            }, request.timeoutMs);

            child.stdin?.on?.("error", () => {
                // El proceso puede cerrar antes de consumir toda la entrada.
            });
            child.stdin?.end(request.stdin, "utf8");
        });
    }
}

function normalizeRequest(value, limits) {
    if (
        !isRecord(value) ||
        Object.keys(value).some(key => ![
            "programCode",
            "stdin",
            "timeoutMs",
            "seed",
            "signal",
            "nodeExecutable",
            "gui"
        ].includes(key))
    ) {
        invalid(
            "CLRS_TEST_PROCESS_REQUEST_INVALID",
            "request"
        );
    }

    const programCode = requireText(
        value.programCode,
        limits.maximumProgramCharacters,
        "CLRS_TEST_PROCESS_PROGRAM_INVALID",
        "programCode"
    );
    const stdin = requireText(
        value.stdin,
        limits.maximumInputCharacters,
        "CLRS_TEST_PROCESS_INPUT_INVALID",
        "stdin",
        true
    );

    if (
        !Number.isSafeInteger(value.timeoutMs) ||
        value.timeoutMs <
            CLRS_TEST_LIMITS.minimumTimeoutMs ||
        value.timeoutMs >
            CLRS_TEST_LIMITS.maximumTimeoutMs
    ) {
        invalid(
            "CLRS_TEST_PROCESS_TIMEOUT_INVALID",
            "timeoutMs"
        );
    }

    const seed = value.seed ?? 0;

    if (
        !Number.isSafeInteger(seed) ||
        seed < 0 ||
        seed > CLRS_TEST_LIMITS.maximumSeed
    ) {
        invalid(
            "CLRS_TEST_PROCESS_SEED_INVALID",
            "seed"
        );
    }

    const signal = value.signal ?? null;
    if (value.gui != null && typeof value.gui !== "boolean") { invalid("CLRS_TEST_PROCESS_REQUEST_INVALID", "gui"); }
    if (value.nodeExecutable != null && (typeof value.nodeExecutable !== "string"
        || !path.isAbsolute(value.nodeExecutable) || value.nodeExecutable.includes("\u0000"))) {
        invalid("CLRS_TEST_PROCESS_REQUEST_INVALID", "nodeExecutable");
    }

    if (
        signal != null &&
        (
            typeof signal.aborted !== "boolean" ||
            typeof signal.addEventListener !== "function" ||
            typeof signal.removeEventListener !== "function"
        )
    ) {
        invalid(
            "CLRS_TEST_PROCESS_SIGNAL_INVALID",
            "signal"
        );
    }

    return Object.freeze({
        programCode,
        stdin,
        timeoutMs: value.timeoutMs,
        seed,
        signal,
        ...(value.nodeExecutable ? { nodeExecutable: value.nodeExecutable } : {}),
        ...(value.gui === true ? { gui: true } : {})
    });
}

function requireText(
    value,
    maximum,
    code,
    field,
    allowEmpty = false
) {
    if (
        typeof value !== "string" ||
        (!allowEmpty && value.length === 0) ||
        value.length > maximum ||
        value.includes("\u0000")
    ) {
        invalid(code, field);
    }

    return value;
}

function appendBounded(current, chunk, maximum, onLimit) {
    const appended = current + String(chunk);

    if (appended.length <= maximum) {
        return appended;
    }

    onLimit();

    return appended.slice(0, maximum);
}

function createTestEnvironment(
    source,
    seed,
    tracePath,
    gui = false
) {
    const environment = {};

    for (const key of [
        "SystemRoot",
        "ComSpec",
        "PATHEXT",
        "PATH",
        "Path",
        "TEMP",
        "TMP",
        "TMPDIR",
        "HOME",
        "USERPROFILE"
    ]) {
        if (typeof source?.[key] === "string") {
            environment[key] = source[key];
        }
    }

    environment.LANG = "C";
    // Sólo transporte gráfico de la sesión; nunca copiar credenciales,
    // NODE_OPTIONS, NODE_PATH ni rutas de plugins/esquemas externas. El runtime
    // configura sus recursos GTK privados en el proceso de ejecución.
    if (gui) {
        for (const key of ["DISPLAY", "WAYLAND_DISPLAY", "XAUTHORITY", "XDG_RUNTIME_DIR", "DBUS_SESSION_BUS_ADDRESS", "XDG_DATA_DIRS"]) {
            if (typeof source?.[key] === "string") { environment[key] = source[key]; }
        }
    }
    environment.LC_ALL = "C";
    environment.CLRS_TEST_MODE = "1";
    environment.CLRS_TEST_SEED = String(seed);
    environment.CLRS_TRACE_FILE = tracePath;

    return environment;
}

async function readCoverageEvidence({
    tracePath,
    readFile: read,
    limits
}) {
    let source;

    try {
        source = String(
            await read(tracePath, "utf8")
        );
    } catch {
        return null;
    }

    let truncated = source.length >
        limits.maximumTraceCharacters;

    if (truncated) {
        source = source.slice(
            0,
            limits.maximumTraceCharacters
        );
    }

    const events = [];
    let started = false;
    let complete = false;

    for (const line of source.split("\n")) {
        if (line.trim() === "") {
            continue;
        }

        let event;

        try {
            event = JSON.parse(line);
        } catch {
            truncated = true;
            continue;
        }

        if (event?.type === "start") {
            started = true;
            continue;
        }

        if (event?.type === "end") {
            complete = true;
            continue;
        }

        if (event?.type === "coverage-truncated") {
            truncated = true;
            continue;
        }

        if (event?.type !== "coverage") {
            continue;
        }

        const normalized =
            normalizeExecutionCoverageEvent(
                event
            );

        if (normalized == null) {
            truncated = true;
            continue;
        }

        if (
            events.length >=
                limits.maximumCoverageEvents
        ) {
            truncated = true;
            continue;
        }

        events.push(normalized);
    }

    return started
        ? Object.freeze({
            events: Object.freeze(events),
            complete,
            truncated
        })
        : null;
}

function cancelledResult(seed) {
    return Object.freeze({
        status: CLRSTestProcessStatus.CANCELLED,
        exitCode: null,
        signal: null,
        stdout: "",
        stderr: "",
        elapsedMs: 0,
        seed,
        technicalMessage: null,
        coverage: null
    });
}

function startFailure(
    error,
    startedAt,
    now,
    seed
) {
    return Object.freeze({
        status: CLRSTestProcessStatus.START_FAILED,
        exitCode: null,
        signal: null,
        stdout: "",
        stderr: "",
        elapsedMs: elapsed(startedAt, now),
        seed,
        technicalMessage: technicalMessage(error),
        coverage: null
    });
}

function elapsed(startedAt, now) {
    const duration = Number(now()) - Number(startedAt);

    return Number.isFinite(duration) && duration >= 0
        ? Math.floor(duration)
        : 0;
}

function normalizeExitCode(value) {
    return Number.isInteger(value) ? value : null;
}

function normalizeSignal(value) {
    return typeof value === "string" ? value : null;
}

function terminate(child, gui = false) {
    // Un programa GUI puede estar esperando su probe Node aislado. Matar sólo
    // al coordinador dejaría ese hijo vivo tras cancelar o agotar el tiempo.
    if (gui && child.pid) {
        if (process.platform === "win32") {
            try {
                const killer = spawn(path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "taskkill.exe"),
                    ["/PID", String(child.pid), "/T", "/F"], { shell: false, windowsHide: true, stdio: "ignore" });
                killer.once("error", () => terminate(child));
                killer.once("close", code => { if (code !== 0) { terminate(child); } });
                return;
            } catch { /* Conserva el cierre directo si no puede iniciarse taskkill. */ }
        } else {
            try { process.kill(-child.pid, "SIGKILL"); return; } catch { /* El grupo puede haber terminado. */ }
        }
    }
    try {
        child.kill();
    } catch {
        // El cierre del proceso determinará el resultado final.
    }
}

function technicalMessage(error) {
    return error instanceof Error
        ? error.message
        : String(error);
}

function isRecord(value) {
    return value != null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        (
            Object.getPrototypeOf(value) ===
                Object.prototype ||
            Object.getPrototypeOf(value) === null
        );
}

function invalid(code, field) {
    throw CLRSTestExecutionError
        .invalidRequest(code, field);
}
