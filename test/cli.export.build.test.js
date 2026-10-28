import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

test("build CLI nativo: el smoke test cubre el binario host y su interfaz de proceso", async () => {
    const [script, manifest] = await Promise.all([
        source("scripts/cli/validate-portable-build.mjs"), json("package.json")
    ]);
    assert.equal(manifest.scripts["test:cli:build:native"], "node scripts/cli/validate-portable-build.mjs");
    assert.match(script, /process\.platform === "win32" \? "build:win" : "build:unix"/u);
    assert.match(script, /process\.platform === "win32" \? "\.exe" : ""/u);
    assert.match(script, /path\.join\(artifact\.projectDirectory, "dist", `\$\{name\}\$\{extension\}`\)/u);
    assert.match(script, /process\.argv\.slice\(2\)/u);
    assert.match(script, /process\.stderr\.write/u);
    assert.match(script, /process\.exitCode/u);
    assert.match(script, /stdin: "entrada smoke\\n"/u);
    assert.match(script, /PATH: "", CLRS_TEST_MODE: "1"/u);
    for (const evidence of ["host-build-created-single-executable-without-gui-residue",
        "host-executable-copied-outside-project",
        "isolated-executable-preserves-stdin-stdout-stderr-argv-and-exit-code",
        "runtime-created-no-bootstrap-packable-or-gtk-files"]) {
        assert.match(script, new RegExp(evidence, "u"));
    }
    assert.doesNotMatch(manifest.scripts["test:corpus:integrity"],
        /scripts\/cli\/validate-portable-build\.mjs/u);
});

test("build CLI nativo: la matriz host es opt-in y no realiza cross-compilation", async () => {
    const [workflow, evidence] = await Promise.all([
        source(".github/workflows/integral-corpus.yml"),
        json("test/fixtures/cli/build.win32-x64.node24.json")
    ]);
    assert.match(workflow, /cli_build_native:/u);
    assert.match(workflow, /cli-build-native:/u);
    assert.match(workflow, /npm run test:cli:build:native/u);
    for (const operatingSystem of ["windows-latest", "ubuntu-latest", "macos-latest"]) {
        assert.match(workflow, new RegExp(`- ${operatingSystem}`, "u"));
    }
    assert.doesNotMatch(workflow, /test:cli:build:native[^]*?--targets (?!host)/u);
    assert.equal(evidence.ok, true);
    assert.deepEqual([evidence.platform, evidence.arch], ["win32", "x64"]);
    assert.match(evidence.node, /^24\./u);
    assert.equal(evidence.executable.name, "prueba-cli-portatil.exe");
    assert.ok(evidence.executable.size > 0);
    assert.match(evidence.executable.sha256, /^[a-f0-9]{64}$/u);
    assert.equal(evidence.executable.buildScript, "build:win");
    assert.equal(evidence.cleaned, true);
    assert.ok(evidence.notValidated.includes("cross-compilation"));
});

function source(relativePath) {
    return readFile(path.join(projectRoot, ...relativePath.split("/")), "utf8");
}

async function json(relativePath) {
    return JSON.parse(await source(relativePath));
}
