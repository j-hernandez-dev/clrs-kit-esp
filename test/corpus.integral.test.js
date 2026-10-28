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
const requiredCategories = [
    "parser-semantics",
    "execution",
    "testing",
    "comparison",
    "debugging",
    "coverage",
    "quick-actions",
    "call-hierarchy",
    "broker95",
    "diagram",
    "array-literals",
    "gui",
    "cli-export-architecture",
    "portable-export",
    "multiplatform"
];

test("el manifiesto del corpus integral cubre todas las áreas obligatorias", async () => {
    const corpus = await json(
        "test/fixtures/integral-corpus.v1.json"
    );

    assert.equal(corpus.version, 1);
    assert.deepEqual(
        corpus.categories.map(
            category => category.id
        ),
        requiredCategories
    );

    const referencedTests = new Set();

    for (const category of corpus.categories) {
        assert.match(
            category.name,
            /\S/u
        );
        assert.ok(
            category.tests.length > 0,
            `${category.id} debe declarar al menos una prueba.`
        );

        for (const relativePath of category.tests) {
            assert.match(
                relativePath,
                /^test\/[a-z0-9.-]+\.test\.js$/u
            );
            assert.equal(
                referencedTests.has(relativePath),
                false,
                `${relativePath} no debe duplicarse en la matriz.`
            );
            referencedTests.add(relativePath);
            await access(
                path.join(
                    projectRoot,
                    ...relativePath.split("/")
                )
            );
        }
    }
});

test("el cierre de release ejecuta el corpus integral y conserva versiones alineadas", async () => {
    const [
        manifest,
        lockfile,
        readme,
        technicalIndex,
        changelog
    ] = await Promise.all([
        json("package.json"),
        json("package-lock.json"),
        source("README.md"),
        source("docs/README.md"),
        source("CHANGELOG.md")
    ]);

    assert.equal(
        manifest.scripts["test:corpus:integrity"],
        "node --test test/corpus.integral.test.js test/array.literal.corpus.test.js test/platform.regression.test.js test/gui.corpus.test.js test/cli.export.architecture.test.js test/cli.export.profile.test.js test/cli.manifest.test.js test/cli.export.transaction.test.js test/cli.lock.validation.test.js test/javascript.export.presentation.test.js test/cli.export.corpus.test.js test/cli.export.install.test.js test/cli.export.build.test.js test/cli.export.documentation.test.js test/portable.export.corpus.test.js"
    );
    assert.equal(
        manifest.scripts["test:corpus"],
        "npm run test:corpus:integrity && npm run test:broker95:learning && npm run test:all"
    );
    assert.equal(
        manifest.scripts["release:check"],
        "npm run test:corpus"
    );
    assert.equal(
        lockfile.version,
        manifest.version
    );
    assert.equal(
        lockfile.packages[""].version,
        manifest.version
    );
    assert.match(
        readme,
        new RegExp(
            `Estado actual \\(versión ${escapeRegExp(manifest.version)}\\)`,
            "u"
        )
    );
    assert.match(
        technicalIndex,
        new RegExp(
            `\\| Versión \\| \\*\\*${escapeRegExp(manifest.version)}\\*\\* \\|`,
            "u"
        )
    );
    assert.match(
        changelog,
        new RegExp(
            `^## \\[${escapeRegExp(manifest.version)}\\] - `,
            "mu"
        )
    );
});

test("la automatización declara la matriz Windows, Linux y macOS", async () => {
    const workflow = await source(
        ".github/workflows/integral-corpus.yml"
    );

    for (
        const operatingSystem
        of [
            "windows-latest",
            "ubuntu-latest",
            "macos-latest"
        ]
    ) {
        assert.match(
            workflow,
            new RegExp(
                `- ${escapeRegExp(operatingSystem)}`,
                "u"
            )
        );
    }

    assert.match(
        workflow,
        /npm run test:corpus/u
    );
});

async function json(relativePath) {
    return JSON.parse(
        await source(relativePath)
    );
}

function source(relativePath) {
    return readFile(
        path.join(
            projectRoot,
            ...relativePath.split("/")
        ),
        "utf8"
    );
}

function escapeRegExp(value) {
    return String(value).replace(
        /[.*+?^${}()|[\]\\]/gu,
        "\\$&"
    );
}
