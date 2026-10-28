import {
    createCliApplication
} from "../application/composition/createCliApplication.js";
import { resolveCliExtensionRoot } from "../infrastructure/gui/resolveCliExtensionRoot.js";
import {
    completeRuntimeTrace,
    configureRuntimeTrace
} from "./runtime/CliTraceConfiguration.js";

const {
    sourceArgs,
    traceFile
} = configureRuntimeTrace(
    process.argv.slice(2)
);
const controller = new AbortController();
const cancel = () => controller.abort();
process.on("SIGINT", cancel);
process.on("SIGTERM", cancel);
const application = createCliApplication({ extensionRoot: resolveCliExtensionRoot(import.meta.url),
    nodeCommand: process.execPath, signal: controller.signal });
let exitCode;
try { ({ exitCode } = await application.execute(sourceArgs)); }
finally {
    process.off("SIGINT", cancel);
    process.off("SIGTERM", cancel);
    application.dispose();
}

completeRuntimeTrace(
    traceFile,
    exitCode === 0
        ? "correct"
        : "error"
);

process.exitCode = exitCode;
