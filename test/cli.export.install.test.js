import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

test("instalación CLI nativa: el ensayo opt-in traslada, instala y ejecuta el entry normal", async () => {
    const [script, manifest] = await Promise.all([
        source("scripts/cli/validate-export.mjs"), json("package.json")
    ]);
    assert.equal(manifest.scripts["test:cli:install:native"], "node scripts/cli/validate-export.mjs");
    assert.match(script, /new CliJavaScriptProjectExporter\(\{ lockGenerator \}\)/u);
    assert.match(script, /await cp\(artifact\.projectDirectory, destination, \{ recursive: true \}\)/u);
    assert.match(script, /await rm\(origin, \{ recursive: true, force: true \}\)/u);
    assert.match(script, /\[npm, "ci", "--no-audit", "--no-fund"\]/u);
    assert.doesNotMatch(script, /\[npm, "ci"[^\n]+--ignore-scripts/u);
    assert.match(script, /assert\.equal\(await readFile\(lockPath, "utf8"\), original\.lock\)/u);
    assert.match(script, /\[npm, "start"\]/u);
    assert.match(script, /\[entry\], \{ cwd: os\.tmpdir\(\) \}/u);
    for (const evidence of ["three-file-cli-export-with-real-npm-lock",
        "relocated-project-after-origin-removal", "npm-ci-lock-unchanged-without-gui-dependencies",
        "yao-pkg-cli-available", "npm-start-normal-entry-without-build-side-effects",
        "direct-node-entry-independent-of-cwd"]) {
        assert.match(script, new RegExp(evidence, "u"));
    }
    assert.doesNotMatch(manifest.scripts["test:corpus:integrity"], /scripts\/cli\/validate-export\.mjs/u);
});

test("instalación CLI nativa: el workflow la mantiene opt-in y separada del build", async () => {
    const [workflow, evidence] = await Promise.all([
        source(".github/workflows/integral-corpus.yml"),
        json("test/fixtures/cli/install.win32-x64.node24.json")
    ]);
    assert.match(workflow, /cli_native:/u);
    assert.match(workflow, /cli-install-native:/u);
    assert.match(workflow, /npm run test:cli:install:native/u);
    assert.doesNotMatch(workflow,
        /name: CLI install[^]*?npm run test:cli:install:native[^]*?npm run build:(?:win|unix)/u);
    assert.equal(evidence.ok, true);
    assert.deepEqual([evidence.platform, evidence.arch], ["win32", "x64"]);
    assert.match(evidence.node, /^24\./u);
    assert.equal(evidence.resolved.pkg, "6.22.0");
    assert.equal(evidence.cleaned, true);
    assert.ok(evidence.notValidated.includes("build real con pkg"));
});

function source(relativePath) {
    return readFile(path.join(projectRoot, ...relativePath.split("/")), "utf8");
}

async function json(relativePath) {
    return JSON.parse(await source(relativePath));
}
