import assert from "node:assert/strict";
import {
    readFile
} from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
    fileURLToPath
} from "node:url";

import {
    createExtensionConfiguration
} from "../extension/config/ExtensionConfiguration.js";

const projectRoot = path.resolve(
    fileURLToPath(
        new URL("..", import.meta.url)
    )
);

test("las entradas publicadas se resuelven con rutas Windows y POSIX", async () => {
    const manifest = JSON.parse(
        await source("package.json")
    );
    const configuration =
        createExtensionConfiguration();
    const cliSegments =
        configuration.cliEntryRelativePath
            .split("/");

    assert.equal(
        manifest.main,
        "./extension-dist/extension.js"
    );
    assert.equal(
        path.win32.join(
            "C:\\clrs-kit",
            ...cliSegments
        ),
        "C:\\clrs-kit\\extension-dist\\clrs-cli.js"
    );
    assert.equal(
        path.posix.join(
            "/opt/clrs-kit",
            ...cliSegments
        ),
        "/opt/clrs-kit/extension-dist/clrs-cli.js"
    );
});

test("la frontera del VSIX publica bundles y excluye fuentes y dependencias", async () => {
    const ignore = await source(
        ".vscodeignore"
    );

    assert.match(
        ignore,
        /^extension\/\*\*\/\*\.js$/mu
    );
    assert.match(
        ignore,
        /^src\/\*\*\/\*\.js$/mu
    );
    assert.match(
        ignore,
        /^node_modules\/\*\*$/mu
    );
    assert.match(
        ignore,
        /^\.github\/\*\*$/mu
    );
    assert.match(ignore, /^docs\/\*\*$/mu);
    assert.match(ignore, /^\.runtime\/\*\*$/mu);
    assert.doesNotMatch(
        ignore,
        /^extension-dist\/\*\*$/mu
    );
    assert.doesNotMatch(
        ignore,
        /^frontend\/dist\/\*\*$/mu
    );
    assert.doesNotMatch(
        ignore,
        /^copilot\/\*\*$/mu
    );
    const manifest = JSON.parse(await source("package.json"));
    assert.equal(manifest.dependencies?.["node-gtk"], undefined);
    assert.equal(manifest.devDependencies?.["node-gtk"], undefined);
    assert.ok(manifest.contributes.snippets.some(item => item.path === "./extension/snippets/clrs-gui.code-snippets"));
});

test("el inicio guiado usa recursos remotos independientes del separador local", async () => {
    const media = await Promise.all(
        [
            "create-program.md",
            "run-program.md",
            "open-diagram.md",
            "debug-program.md",
            "create-tests.md",
            "open-learning.md"
        ].map(file =>
            source(
                `extension/getting-started/media/${file}`
            )
        )
    );

    for (const markdown of media) {
        assert.match(
            markdown,
            /https:\/\/raw\.githubusercontent\.com\//u
        );
        assert.doesNotMatch(
            markdown,
            /\\/u
        );
    }
});

function source(relativePath) {
    return readFile(
        path.join(
            projectRoot,
            ...relativePath.split("/")
        ),
        "utf8"
    );
}
