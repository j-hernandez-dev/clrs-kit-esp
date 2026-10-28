import {
    spawn
} from "node:child_process";
import {
    mkdir,
    readFile
} from "node:fs/promises";
import path from "node:path";
import {
    fileURLToPath
} from "node:url";

const projectRoot =
    path.resolve(
        fileURLToPath(
            new URL("..", import.meta.url)
        )
    );
const manifest =
    JSON.parse(
        await readFile(
            path.join(
                projectRoot,
                "package.json"
            ),
            "utf8"
        )
    );
const outputDirectory =
    path.join(projectRoot, "dist");
const outputPath =
    path.join(
        outputDirectory,
        `${manifest.name}-${manifest.version}.vsix`
    );
const vsceEntry =
    path.join(
        projectRoot,
        "node_modules",
        "@vscode",
        "vsce",
        "vsce"
    );

await mkdir(
    outputDirectory,
    { recursive: true }
);

const exitCode =
    await runProcess(
        process.execPath,
        [
            vsceEntry,
            "package",
            "--out",
            outputPath
        ]
    );

if (exitCode !== 0) {
    process.exitCode = exitCode;
} else {
    console.log(
        `VSIX_OUTPUT=${outputPath}`
    );
}

function runProcess(
    executable,
    args
) {
    return new Promise(
        (resolve, reject) => {
            const child = spawn(
                executable,
                args,
                {
                    cwd: projectRoot,
                    stdio: "inherit"
                }
            );

            child.once("error", reject);
            child.once(
                "exit",
                code =>
                    resolve(code ?? 1)
            );
        }
    );
}
