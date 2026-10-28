import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { CompilationArtifact } from "../src/compiler/CompilationArtifact.js";
import { parseSource } from "../src/language/LanguageFrontend.js";
import { SemanticAnalyzer } from "../src/semantic/SemanticAnalyzer.js";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const contract = await json("test/fixtures/cli-export-architecture.v1.json");

test("exportación CLI/GUI: el contrato arquitectónico versionado fija perfiles y fronteras", async () => {
    assert.equal(contract.schemaVersion, 1);
    assert.equal(contract.targetVersion, "2.0.3");
    assert.equal(contract.phase, "release-closure");
    assert.equal(contract.decision.authority, "semanticModel.gui.usage.requiresGui");
    assert.deepEqual(contract.decision.forbiddenHeuristics,
        ["source-text-search", "generated-code-search", "symbol-name-search"]);
    assert.deepEqual(Object.keys(contract.profiles), ["cli", "gui"]);
    assert.deepEqual(contract.profiles.cli.initialFiles,
        ["<program>.js", "package.json", "package-lock.json"]);
    assert.deepEqual(contract.profiles.gui.initialFiles,
        ["<program>.js", "prepare-packable.cjs", "bootstrap.cjs", "package.json", "package-lock.json"]);
    assert.ok(contract.profiles.cli.forbidden.includes("node-gtk"));
    assert.ok(contract.profiles.cli.forbidden.includes("bootstrap.cjs"));
    assert.ok(contract.sharedInfrastructure.includes("atomic-publication"));
    assert.ok(contract.unchangedBoundaries.includes("NodeProgramRunner"));
    assert.equal(contract.currentState.nextBlock, "none");
    assert.equal(contract.routing.cliCurrentDelegate, "CliJavaScriptProjectExporter");
    assert.equal(contract.routing.sharedTransaction, "JavaScriptProjectTransaction");
    assert.equal(contract.manifestAuthority.cliFactory, "createCliJavaScriptProjectManifest");
    assert.equal(contract.manifestAuthority.cliValidator, "validCliJavaScriptProjectManifest");
    assert.deepEqual(contract.manifestAuthority.nodeSupportedMajors, [22, 24, 26]);
    assert.deepEqual(contract.manifestAuthority.cliOmittedFields, ["dependencies", "allowScripts", "pkg"]);
    assert.equal(contract.lockAuthority.cliValidator, "validCliJavaScriptProjectLock");
    assert.equal(contract.lockAuthority.projectValidator, "validCliJavaScriptProjectSnapshot");
    assert.equal(contract.lockAuthority.lockfileVersion, 3);
    assert.equal(contract.lockAuthority.mustHaveClosedReachableGraph, true);
    assert.equal(contract.lockAuthority.nativeCheck, "test:cli:lock:native");
    assert.equal(contract.outputPresentation.authority, "createJavaScriptProjectOutputLines");
    assert.deepEqual(contract.outputPresentation.commonCommands,
        ["npm ci", "npm start", "npm run build:win", "npm run build:unix"]);
    assert.equal(contract.outputPresentation.unknownProfileFallbackMentionsGui, false);
    assert.equal(contract.deterministicCorpus.authority, "test/fixtures/cli/export-corpus.v1.json");
    assert.equal(contract.deterministicCorpus.test, "test/cli.export.corpus.test.js");
    assert.equal(contract.deterministicCorpus.cliInitialFileCount, 3);
    assert.equal(contract.deterministicCorpus.guiInitialFileCount, 5);
    assert.equal(contract.deterministicCorpus.requiresNetwork, false);
    assert.equal(contract.deterministicCorpus.requiresNativeBuild, false);
    assert.equal(contract.normalInstallation.authority, "scripts/cli/validate-export.mjs");
    assert.equal(contract.normalInstallation.command, "test:cli:install:native");
    assert.equal(contract.normalInstallation.start, "npm start");
    assert.deepEqual(contract.normalInstallation.workflowPlatforms,
        ["windows-latest", "ubuntu-latest", "macos-latest"]);
    assert.equal(contract.normalInstallation.localEvidence,
        "test/fixtures/cli/install.win32-x64.node24.json");
    assert.equal(contract.normalInstallation.optIn, true);
    assert.equal(contract.normalInstallation.includedInReleaseCheck, false);
    assert.equal(contract.nativeBuild.authority, "scripts/cli/validate-portable-build.mjs");
    assert.equal(contract.nativeBuild.command, "test:cli:build:native");
    assert.equal(contract.nativeBuild.target, "host");
    assert.equal(contract.nativeBuild.windowsOutput, "dist/<program>.exe");
    assert.equal(contract.nativeBuild.unixOutput, "dist/<program>");
    assert.deepEqual(contract.nativeBuild.workflowPlatforms,
        ["windows-latest", "ubuntu-latest", "macos-latest"]);
    assert.equal(contract.nativeBuild.localEvidence,
        "test/fixtures/cli/build.win32-x64.node24.json");
    assert.equal(contract.nativeBuild.crossCompilation, false);
    assert.equal(contract.nativeBuild.optIn, true);
    assert.equal(contract.nativeBuild.includedInReleaseCheck, false);
    assert.equal(contract.userExperienceDocumentation.authority,
        "docs/gui/javascript-export.md");
    assert.deepEqual(contract.userExperienceDocumentation.commonFlow,
        ["Generate JavaScript", "open app/<program>", "npm ci", "npm start"]);
    assert.equal(contract.userExperienceDocumentation.cli.initialFileCount, 3);
    assert.equal(contract.userExperienceDocumentation.cli.requiresGtk, false);
    assert.equal(contract.userExperienceDocumentation.gui.initialFileCount, 5);
    assert.equal(contract.userExperienceDocumentation.gui.requiresGtk, true);
    assert.equal(contract.userExperienceDocumentation.externalResourcesEmbeddedAutomatically, false);
    assert.equal(contract.userExperienceDocumentation.versionChanged, true);
    assert.equal(contract.userExperienceDocumentation.vsixGenerated, true);
    assert.equal(contract.release.version, "2.0.3");
    assert.equal(contract.release.artifact, "dist/clrs-kit-esp-2.0.3.vsix");
    assert.equal(contract.release.marketplacePublished, false);
    assert.equal(contract.currentState.nextBlock, "none");

    const documentation = await source("docs/language/cli-executable-export.md");
    for (const heading of ["Estado actual auditado", "Contrato arquitectónico objetivo",
        "Fronteras que deben permanecer intactas", "Brechas localizadas", "Implementación del Bloque 2",
        "Implementación del Bloque 3", "Implementación del Bloque 4", "Implementación del Bloque 5",
        "Implementación del Bloque 6", "Implementación del Bloque 7", "Implementación del Bloque 8",
        "Implementación del Bloque 9", "Implementación del Bloque 10",
        "Implementación del Bloque 11",
        "Criterio histórico de cierre del Bloque 1"]) {
        assert.match(documentation, new RegExp(`^## ${escapeRegExp(heading)}$`, "mu"));
    }
});

test("exportación CLI/GUI: la clasificación semántica no confunde texto con uso GUI", () => {
    const analyzer = new SemanticAnalyzer();
    const cli = analyzer.analyze(parseSource([
        "PRINCIPAL()",
        "    escribir \"VENTANA BOTON node-gtk Gtk\""
    ].join("\n")).ast);
    const gui = analyzer.analyze(parseSource([
        "ventana = \"principal\"",
        "PRINCIPAL()",
        "    VENTANA(ventana, \"Auditoría\")",
        "    MOSTRAR(ventana)"
    ].join("\n")).ast);

    assert.equal(cli.gui.usage.requiresGui, false);
    assert.deepEqual(cli.gui.usage.capabilities, []);
    assert.equal(gui.gui.usage.requiresGui, true);
    assert.deepEqual(gui.gui.usage.capabilities, ["gui"]);
    assert.deepEqual(gui.gui.usage.functionNames, ["VENTANA", "MOSTRAR"]);
});

test("exportación CLI/GUI: la identidad app no invade los artefactos temporales", () => {
    const sourcePath = path.join("proyecto", "Punto Venta.clrs");
    const permanent = new CompilationArtifact({ ast: null, sourcePath, temporary: false,
        exportProject: true, userCode: "", generatedCode: "", requiredCapabilities: [] });
    const temporary = new CompilationArtifact({ ast: null, sourcePath, temporary: true,
        exportProject: true, programKey: "private-key", userCode: "", generatedCode: "",
        requiredCapabilities: ["gui"] });

    assert.equal(permanent.outputDirectory, path.resolve("proyecto", "app", "punto-venta"));
    assert.equal(permanent.outputFileName, "punto-venta.js");
    assert.equal(temporary.outputDirectory, ".");
    assert.equal(temporary.outputFileName, "private-key_Punto Venta.mjs");
    assert.doesNotMatch(temporary.outputPath, /[\\/]app[\\/]/u);
});

test("exportación CLI/GUI: la clasificación explícita está localizada fuera del AST", async () => {
    const [service, router, cliExporter, cliValidator, exporter, transaction, descriptor, lockAdapter,
        output, host] = await Promise.all([
        source("src/compiler/services/CompilationService.js"),
        source("src/compiler/export/JavaScriptProjectExportRouter.js"),
        source("src/compiler/export/CliJavaScriptProjectExporter.js"),
        source("src/compiler/export/CliJavaScriptProjectValidator.js"),
        source("src/compiler/export/JavaScriptProjectExporter.js"),
        source("src/compiler/export/JavaScriptProjectTransaction.js"),
        source("src/compiler/export/JavaScriptProjectDescriptor.js"),
        source("src/compiler/export/NpmPackageLockAdapter.js"),
        source("extension/presentation/JavaScriptProjectOutput.js"),
        source("extension/adapters/VSCodeCodeHost.js")
    ]);

    assert.match(service, /classifyJavaScriptExportProfile\(semanticModel\)/u);
    assert.match(service, /if \(exportProfile\) \{ return this\.projectExporter\.export/u);
    assert.match(router, /artifact\.exportProfile === JavaScriptExportProfiles\.CLI/u);
    assert.match(router, /this\.cliExporter\.export\(artifact, options\)/u);
    assert.match(router, /artifact\.exportProfile === JavaScriptExportProfiles\.GUI/u);
    assert.match(exporter, /artifact\.exportProfile !== JavaScriptExportProfiles\.GUI/u);
    assert.match(cliExporter, /createCliJavaScriptProjectDescriptor/u);
    assert.match(cliExporter, /validCliJavaScriptProjectSnapshot/u);
    assert.match(cliValidator, /validCliJavaScriptProjectLock/u);
    assert.match(cliValidator, /validReachableGraph/u);
    assert.match(cliValidator, /validStrongIntegrity/u);
    assert.match(transaction, /class JavaScriptProjectTransaction/u);
    assert.match(transaction, /\.backup-/u);
    assert.match(descriptor, /JAVASCRIPT_EXPORT_ROOT_DIRECTORY = "app"/u);
    assert.match(descriptor, /createCliJavaScriptProjectManifest/u);
    assert.match(descriptor, /validCliJavaScriptProjectManifest/u);
    assert.match(descriptor, /dependencies: \{ \[dependency\.name\]: dependency\.version \}/u);
    assert.match(lockAdapter, /"--package-lock-only"[\s\S]+"--ignore-scripts"[\s\S]+"--include=dev"/u);
    assert.match(lockAdapter, /"--install-strategy=hoisted"/u);
    assert.match(output, /JavaScriptExportProfiles\.CLI/u);
    assert.match(output, /JavaScriptExportProfiles\.GUI/u);
    assert.match(output, /GTK 4\.10/u);
    assert.match(host, /createJavaScriptProjectOutputLines\(outputPath, project\)/u);
    assert.equal(contract.currentState.gap,
        "No implementation gap remains in the 2.0.3 CLI executable-export contract; native evidence remains platform-specific");
});

test("exportación CLI/GUI: la auditoría forma parte del corpus de publicación", async () => {
    const manifest = await json("package.json");
    const integral = await json("test/fixtures/integral-corpus.v1.json");
    assert.equal(manifest.scripts["test:cli:export-architecture"],
        "node --test test/cli.export.architecture.test.js test/cli.export.profile.test.js test/cli.manifest.test.js test/cli.export.transaction.test.js test/cli.lock.validation.test.js test/javascript.export.presentation.test.js test/cli.export.corpus.test.js test/cli.export.install.test.js test/cli.export.build.test.js test/cli.export.documentation.test.js");
    assert.match(manifest.scripts["test:corpus:integrity"], /test\/cli\.export\.architecture\.test\.js/u);
    assert.match(manifest.scripts["test:corpus:integrity"], /test\/cli\.export\.profile\.test\.js/u);
    assert.match(manifest.scripts["test:corpus:integrity"], /test\/cli\.manifest\.test\.js/u);
    assert.match(manifest.scripts["test:corpus:integrity"], /test\/cli\.export\.transaction\.test\.js/u);
    assert.match(manifest.scripts["test:corpus:integrity"], /test\/cli\.lock\.validation\.test\.js/u);
    assert.match(manifest.scripts["test:corpus:integrity"], /test\/javascript\.export\.presentation\.test\.js/u);
    assert.match(manifest.scripts["test:corpus:integrity"], /test\/cli\.export\.corpus\.test\.js/u);
    assert.match(manifest.scripts["test:corpus:integrity"], /test\/cli\.export\.install\.test\.js/u);
    assert.match(manifest.scripts["test:corpus:integrity"], /test\/cli\.export\.build\.test\.js/u);
    assert.match(manifest.scripts["test:corpus:integrity"], /test\/cli\.export\.documentation\.test\.js/u);
    const category = integral.categories.find(item => item.id === "cli-export-architecture");
    assert.deepEqual(category?.tests,
        ["test/cli.export.architecture.test.js", "test/cli.export.profile.test.js", "test/cli.manifest.test.js",
            "test/cli.export.transaction.test.js", "test/cli.lock.validation.test.js",
            "test/javascript.export.presentation.test.js", "test/cli.export.corpus.test.js",
            "test/cli.export.install.test.js", "test/cli.export.build.test.js",
            "test/cli.export.documentation.test.js"]);
    assert.equal(manifest.scripts["test:cli:lock:native"], "node scripts/cli/validate-lock.mjs");
    assert.doesNotMatch(manifest.scripts["test:corpus:integrity"], /validate-lock\.mjs|lock:native/u);
});

async function json(relativePath) {
    return JSON.parse(await source(relativePath));
}

function source(relativePath) {
    return readFile(path.join(projectRoot, ...relativePath.split("/")), "utf8");
}

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
