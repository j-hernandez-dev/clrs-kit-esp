import assert from "node:assert/strict";
import {
    access,
    readFile
} from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
    fileURLToPath
} from "node:url";

const projectRoot = path.resolve(
    fileURLToPath(
        new URL("..", import.meta.url)
    )
);
const requiredAreas = [
    "contract-parser-ast",
    "semantics",
    "transpilation-execution",
    "debugging-editor",
    "formatter-diagram",
    "complexity",
    "broker95"
];

test("el corpus integral de arreglos cubre todas las capas públicas", async () => {
    const corpus = await json(
        "test/fixtures/array-literals-corpus.v1.json"
    );

    assert.equal(corpus.schemaVersion, 1);
    assert.equal(
        corpus.suite,
        "CLRS array literals integral acceptance corpus"
    );
    assert.deepEqual(
        corpus.areas.map(area => area.id),
        requiredAreas
    );

    const evidenceKeys = new Set();

    for (const area of corpus.areas) {
        assert.match(area.name, /\S/u);
        assert.equal(area.evidence.length > 0, true);

        for (const evidence of area.evidence) {
            const key = [
                evidence.file,
                evidence.testNeedle
            ].join("\u0000");

            assert.equal(
                evidenceKeys.has(key),
                false,
                `Evidencia duplicada: ${evidence.file}`
            );
            evidenceKeys.add(key);

            const absolutePath = path.join(
                projectRoot,
                ...evidence.file.split("/")
            );

            await access(absolutePath);
            assert.match(
                await readFile(absolutePath, "utf8"),
                new RegExp(
                    escapeRegExp(evidence.testNeedle),
                    "u"
                ),
                `${area.id}:${evidence.testNeedle}`
            );
        }
    }
});

test("cada evidencia de arreglos forma parte del cierre de publicación", async () => {
    const [corpus, manifest] = await Promise.all([
        json("test/fixtures/array-literals-corpus.v1.json"),
        json("package.json")
    ]);
    const releaseScripts = [
        "test:corpus:integrity",
        "pretest:unit",
        "test:unit",
        "test:broker95:learning"
    ].map(name => manifest.scripts[name]).join(" ");

    for (const area of corpus.areas) {
        for (const evidence of area.evidence) {
            assert.equal(
                releaseScripts.includes(
                    evidence.file.split("/").at(-1)
                ),
                true,
                `${evidence.file} debe ejecutarse durante el release.`
            );
        }
    }
});

async function json(relativePath) {
    return JSON.parse(
        await readFile(
            path.join(
                projectRoot,
                ...relativePath.split("/")
            ),
            "utf8"
        )
    );
}

function escapeRegExp(value) {
    return String(value).replace(
        /[.*+?^${}()|[\]\\]/gu,
        "\\$&"
    );
}
