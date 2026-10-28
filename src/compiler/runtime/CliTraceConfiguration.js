import {
    appendFileSync,
    existsSync,
    readFileSync
} from "node:fs";

export function configureRuntimeTrace(
    args,
    environment = process.env
) {
    const sourceArgs = [];
    let traceFile = null;
    let controlFile = null;

    for (let index = 0; index < args.length; index += 1) {
        if (
            args[index] === "--trace-file" &&
            typeof args[index + 1] === "string"
        ) {
            traceFile = args[index + 1];
            index += 1;
            continue;
        }

        if (
            args[index] === "--control-file" &&
            typeof args[index + 1] === "string"
        ) {
            controlFile = args[index + 1];
            index += 1;
            continue;
        }

        sourceArgs.push(args[index]);
    }

    if (traceFile) {
        environment.CLRS_TRACE_FILE =
            traceFile;
    }

    if (controlFile) {
        environment.CLRS_CONTROL_FILE =
            controlFile;
    }

    return {
        sourceArgs,
        traceFile,
        controlFile
    };
}

export function completeRuntimeTrace(
    traceFile,
    status,
    fileSystem = {
        appendFileSync,
        existsSync,
        readFileSync
    },
    environment = process.env
) {
    if (!traceFile) {
        return false;
    }

    let hasStart = false;
    let hasEnd = false;
    let hasTestResult = false;

    try {
        if (fileSystem.existsSync(traceFile)) {
            const lines = String(
                fileSystem.readFileSync(
                    traceFile,
                    "utf8"
                )
            ).trim().split("\n");

            for (const line of lines) {
                if (line.trim() === "") {
                    continue;
                }

                const event = JSON.parse(line);

                hasStart ||= event.type === "start";
                hasEnd ||= event.type === "end";
                hasTestResult ||=
                    event.type === "test-result";
            }
        }
    } catch {
        return false;
    }

    const isDebugTest =
        environment.CLRS_TEST_DEBUG === "1";

    if (
        hasEnd &&
        (!isDebugTest || hasTestResult)
    ) {
        return false;
    }

    const events = [];

    if (!hasStart) {
        events.push({ type: "start" });
    }

    if (!hasEnd) {
        events.push({
            type: "end",
            status: status === "correct"
                ? "correct"
                : "error",
            ...(isDebugTest
                ? { awaitProcess: true }
                : {})
        });
    }

    if (isDebugTest && !hasTestResult) {
        const correct = status === "correct";

        events.push({
            type: "test-result",
            status: correct
                ? "correct"
                : "error",
            stdout: "",
            stderr: "",
            exitCode: correct ? 0 : 1,
            signal: null,
            outputTruncated: false
        });
    }

    try {
        fileSystem.appendFileSync(
            traceFile,
            events
                .map(event =>
                    JSON.stringify(event)
                )
                .join("\n") + "\n",
            "utf8"
        );
        return true;
    } catch {
        return false;
    }
}
