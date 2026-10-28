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
    listFiles,
    PackageManager
} from "@vscode/vsce";

import {
    parseSource
} from "../src/language/LanguageFrontend.js";
import {
    CLRS_INSTALL_COPILOT_CLI_COMMAND
} from "../extension/commands/CopilotCommands.js";

const projectRoot = path.resolve(
    fileURLToPath(
        new URL("..", import.meta.url)
    )
);
const canonicalRelativePath =
    "copilot/clrs.instructions.md";

test("publica instrucciones canónicas limitadas a archivos CLRS", async () => {
    const instructions = await source(
        canonicalRelativePath
    );

    assert.match(
        instructions,
        /^applyTo:\s*["']\*\*\/\*\.clrs["']\s*$/mu
    );
    assert.match(
        instructions,
        /\bVERDAD\b.*\bFALSO\b.*\bNULO\b/su
    );
    assert.match(
        instructions,
        /PRINCIPAL\(\)/u
    );
    assert.match(
        instructions,
        /nombre = NUL.*nombre = NULO/su
    );
    assert.match(
        instructions,
        /no lo conviertas a\s+JavaScript, Python, C#, Java, Pascal/u
    );

    for (const foreignWord of [
        "PROCEDURE",
        "WRITE",
        "READ",
        "NIL"
    ]) {
        assert.match(
            instructions,
            new RegExp(
                `No generes[\\s\\S]*\\b${foreignWord}\\b`,
                "u"
            )
        );
    }

    const clrsExamples = [
        ...instructions.matchAll(
            /```clrs\r?\n([\s\S]*?)\r?\n```/gu
        )
    ].map(match => match[1]);

    assert.ok(clrsExamples.length >= 8);

    for (const example of clrsExamples) {
        assert.doesNotThrow(
            () => parseSource(example),
            `Ejemplo CLRS inválido:\n${example}`
        );
    }
});

test("registra Copilot Chat para el languageId real y el mismo recurso canónico", async () => {
    const manifest = JSON.parse(
        await source("package.json")
    );
    const clrsLanguage =
        manifest.contributes.languages.find(
            language =>
                language.extensions
                    ?.includes(".clrs")
        );

    assert.equal(clrsLanguage.id, "clrs-es");
    assert.deepEqual(
        manifest.contributes.chatInstructions,
        [{
            path:
                `./${canonicalRelativePath}`,
            when:
                `editorLangId == ${clrsLanguage.id}`
        }]
    );
    assert.ok(
        manifest.activationEvents.includes(
            `onCommand:${CLRS_INSTALL_COPILOT_CLI_COMMAND}`
        )
    );
    assert.ok(
        manifest.contributes.commands.some(
            item =>
                item.command ===
                    CLRS_INSTALL_COPILOT_CLI_COMMAND
        )
    );
    assert.equal(
        manifest.contributes.commands.find(
            item =>
                item.command ===
                    CLRS_INSTALL_COPILOT_CLI_COMMAND
        ).title,
        "Instalar soporte para Copilot CLI"
    );

    const startMenu =
        manifest.contributes.menus[
            "clrs.editor.start"
        ];
    const supportEntry = startMenu.find(
        item =>
            item.command ===
                CLRS_INSTALL_COPILOT_CLI_COMMAND
    );

    assert.equal(supportEntry.group, "copilot@1");
    assert.equal(
        manifest.contributes.menus["clrs.editor.create"].some(
            item => item.command === CLRS_INSTALL_COPILOT_CLI_COMMAND
        ),
        false
    );
});

test("incluye la especificación canónica en la frontera real del paquete", async () => {
    const packagedFiles = await listFiles({
        cwd: projectRoot,
        packageManager: PackageManager.None
    });

    assert.ok(
        packagedFiles.includes(
            canonicalRelativePath
        )
    );
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
