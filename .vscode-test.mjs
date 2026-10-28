import {
    existsSync
} from "node:fs";
import path from "node:path";
import {
    fileURLToPath
} from "node:url";

import {
    defineConfig
} from "@vscode/test-cli";

const projectRoot =
    fileURLToPath(
        new URL(".", import.meta.url)
    );
const configuredExecutable =
    process.env
        .VSCODE_EXECUTABLE_PATH;
const localWindowsExecutable =
    process.platform === "win32" &&
    process.env.LOCALAPPDATA
        ? path.join(
            process.env.LOCALAPPDATA,
            "Programs",
            "Microsoft VS Code",
            "Code.exe"
        )
        : null;
const vscodeExecutable =
    [
        configuredExecutable,
        localWindowsExecutable
    ].find(
        candidate =>
            candidate &&
            existsSync(candidate)
    );

export default defineConfig({
    label: "extension-host",
    files:
        "test/extension/**/*.test.js",
    extensionDevelopmentPath:
        projectRoot,
    workspaceFolder: path.join(
        projectRoot,
        "test",
        "fixtures",
        "extension-workspace"
    ),
    version: "stable",
    useInstallation:
        vscodeExecutable
            ? {
                fromPath:
                    vscodeExecutable
            }
            : undefined,
    launchArgs: [
        "--disable-workspace-trust"
    ],
    mocha: {
        timeout: 30000
    },
    env: {
        CLRS_EXTENSION_TEST: "1"
    }
});
