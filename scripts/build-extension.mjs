import {
    build
} from "esbuild";
import {
    mkdir,
    rm
} from "node:fs/promises";
import path from "node:path";
import {
    fileURLToPath
} from "node:url";

const projectRoot = path.resolve(
    fileURLToPath(
        new URL("..", import.meta.url)
    )
);
const outputDirectory = path.join(
    projectRoot,
    "extension-dist"
);

if (
    path.dirname(outputDirectory) !==
        projectRoot ||
    path.basename(outputDirectory) !==
        "extension-dist"
) {
    throw new Error(
        "Unsafe extension bundle output path."
    );
}

await rm(outputDirectory, {
    recursive: true,
    force: true
});
await mkdir(outputDirectory, {
    recursive: true
});

const sharedOptions = {
    absWorkingDir: projectRoot,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    sourcemap: false,
    minifySyntax: true,
    treeShaking: true,
    legalComments: "none",
    external: ["vscode"],
    metafile: true,
    logLevel: "warning"
};

const [extensionResult, cliResult] =
    await Promise.all([
        build({
            ...sharedOptions,
            entryPoints: [
                path.join(
                    projectRoot,
                    "extension",
                    "extension.js"
                )
            ],
            outfile: path.join(
                outputDirectory,
                "extension.js"
            )
        }),
        build({
            ...sharedOptions,
            entryPoints: [
                path.join(
                    projectRoot,
                    "src",
                    "compiler",
                    "CliEntry.js"
                )
            ],
            outfile: path.join(
                outputDirectory,
                "clrs-cli.js"
            )
        })
    ]);

const extensionStats = summarize(
    extensionResult.metafile
);
const cliStats = summarize(
    cliResult.metafile
);

console.log(
    [
        "Extension Host bundle:",
        `${formatBytes(extensionStats.bytes)},`,
        `${extensionStats.modules} modules`
    ].join(" ")
);
console.log(
    [
        "CLRS CLI bundle:",
        `${formatBytes(cliStats.bytes)},`,
        `${cliStats.modules} modules`
    ].join(" ")
);

function summarize(metafile) {
    return {
        modules:
            Object.keys(
                metafile.inputs
            ).length,
        bytes:
            Object.values(
                metafile.outputs
            ).reduce(
                (total, output) =>
                    total + output.bytes,
                0
            )
    };
}

function formatBytes(bytes) {
    return `${(
        bytes / 1024 / 1024
    ).toFixed(2)} MB`;
}
