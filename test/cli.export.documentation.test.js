import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

test("exportación CLI/GUI: la guía operativa describe los perfiles y el flujo público", async () => {
    const guide = await source("docs/gui/javascript-export.md");

    assert.match(guide, /^# Exportación JavaScript y proyectos ejecutables CLI\/GUI$/mu);
    assert.match(guide, /app\/<programa>\/\n├── <programa>\.js\n├── package\.json\n└── package-lock\.json/u);
    assert.match(guide,
        /app\/<programa>\/\n├── <programa>\.js\n├── prepare-packable\.cjs\n├── bootstrap\.cjs\n├── package\.json\n└── package-lock\.json/u);
    assert.match(guide, /\| CLI \| JavaScript \+ `package\.json` \+ `package-lock\.json`/u);
    assert.match(guide, /\| GUI \| JavaScript \+ manifest \+ lock \+ dos helpers/u);
    assert.match(guide,
        /Generar código JavaScript\n→ abrir app\/<programa>\/\n→ npm ci\n→ npm start/u);
    assert.match(guide, /Windows → npm run build:win/u);
    assert.match(guide, /Linux\s+→ npm run build:unix/u);
    assert.match(guide, /macOS\s+→ npm run build:unix/u);
    assert.match(guide, /app\/<programa>\/dist\/<programa>\.exe/u);
    assert.match(guide, /El ejecutable CLI integra su runtime Node/u);
    assert.match(guide, /CLI\s+no necesita GTK/u);
    assert.match(guide, /Los recursos externos del programa[\s\S]+no se incluyen automáticamente/u);
    assert.doesNotMatch(guide, /Un programa no GUI sigue siendo un único archivo/u);
});

test("exportación CLI/GUI: las referencias técnicas coinciden con el contrato operativo", async () => {
    const [compilation, environment, index, contract] = await Promise.all([
        source("docs/language/compilation.md"),
        source("docs/development/environment.md"),
        source("docs/README.md"),
        json("test/fixtures/cli-export-architecture.v1.json")
    ]);

    assert.match(compilation, /proyecto npm CLI de tres archivos o un proyecto GUI de cinco/u);
    assert.match(compilation, /dist\/<programa>\.exe.*Windows.*dist\/<programa>.*Linux\/macOS/su);
    assert.match(environment, /CLI instala `@yao-pkg\/pkg` sólo como[\s\S]+no requiere GTK/u);
    assert.match(environment, /El ejecutable CLI ya construido incorpora Node/u);
    assert.match(index, /Uso de la exportación JavaScript y builds CLI\/GUI/u);
    assert.equal(contract.phase, "release-closure");
    assert.equal(contract.userExperienceDocumentation.authority,
        "docs/gui/javascript-export.md");
    assert.equal(contract.userExperienceDocumentation.cli.initialFileCount, 3);
    assert.equal(contract.userExperienceDocumentation.gui.initialFileCount, 5);
    assert.equal(contract.userExperienceDocumentation.cli.requiresGtk, false);
    assert.equal(contract.userExperienceDocumentation.gui.requiresGtk, true);
    assert.equal(contract.userExperienceDocumentation.externalResourcesEmbeddedAutomatically, false);
    assert.equal(contract.userExperienceDocumentation.versionChanged, true);
    assert.equal(contract.userExperienceDocumentation.vsixGenerated, true);
    assert.equal(contract.release.version, "2.0.3");
    assert.equal(contract.release.artifact, "dist/clrs-kit-esp-2.0.3.vsix");
});

test("exportación CLI/GUI: README y Salida ofrecen una experiencia concisa y coherente", async () => {
    const [readme, presenter, manifest] = await Promise.all([
        source("README.md"),
        source("extension/presentation/JavaScriptProjectOutput.js"),
        json("package.json")
    ]);

    assert.match(readme,
        /\| Generar código JavaScript \| Genera un proyecto JavaScript ejecutable y compilable, con perfil CLI o GUI/u);
    assert.match(readme,
        /(?:Un proyecto CLI contiene|Los proyectos CLI incluyen) `<programa>\.js`, `package\.json` y `package-lock\.json`; (?:un proyecto GUI añade|los proyectos GUI añaden) `prepare-packable\.cjs` y `bootstrap\.cjs`/u);
    assert.match(readme, /npm ci\r?\nnpm start/u);
    assert.match(readme, /npm run build:win/u);
    assert.match(readme, /npm run build:unix/u);
    assert.match(readme, /ejecutables? CLI ya construidos? no requieren? Node\.js/u);
    assert.doesNotMatch(readme,
        /Para programas sin GUI contiene únicamente el JavaScript generado/u);
    assert.match(presenter, /"  npm ci"/u);
    assert.match(presenter, /"  npm start"/u);
    assert.match(presenter, /"  Windows:\s+npm run build:win"/u);
    assert.match(presenter, /"  Linux\/macOS:\s+npm run build:unix"/u);
    assert.equal(manifest.version, "2.0.4");
    assert.match(readme, /Estado actual \(versión 2\.0\.4\)/u);
});

test("exportación CLI/GUI: la prueba documental pertenece al corpus determinista", async () => {
    const [manifest, integral] = await Promise.all([
        json("package.json"),
        json("test/fixtures/integral-corpus.v1.json")
    ]);
    const category = integral.categories.find(item => item.id === "cli-export-architecture");

    assert.equal(manifest.scripts["test:cli:export-docs"],
        "node --test test/cli.export.documentation.test.js");
    assert.match(manifest.scripts["test:cli:export-architecture"],
        /test\/cli\.export\.documentation\.test\.js/u);
    assert.match(manifest.scripts["test:corpus:integrity"],
        /test\/cli\.export\.documentation\.test\.js/u);
    assert.ok(category?.tests.includes("test/cli.export.documentation.test.js"));
});

async function json(relativePath) {
    return JSON.parse(await source(relativePath));
}

function source(relativePath) {
    return readFile(path.join(projectRoot, ...relativePath.split("/")), "utf8");
}
