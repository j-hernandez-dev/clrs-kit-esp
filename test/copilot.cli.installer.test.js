import assert from "node:assert/strict";
import {
    mkdtemp,
    readFile,
    rm,
    writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
    fileURLToPath
} from "node:url";

import {
    COPILOT_CLRS_APPLY_TO,
    CopilotCliInstructionsInstaller,
    resolveCopilotCliInstructionsPath
} from "../src/copilot/CopilotCliInstructionsInstaller.js";
import {
    CLRS_INSTALL_COPILOT_CLI_COMMAND,
    installCopilotCliSupport,
    registerCopilotCommands
} from "../extension/commands/CopilotCommands.js";

const projectRoot = path.resolve(
    fileURLToPath(
        new URL("..", import.meta.url)
    )
);
const canonicalPath = path.join(
    projectRoot,
    "copilot",
    "clrs.instructions.md"
);

test("resuelve COPILOT_HOME y el directorio personal en Windows y POSIX", () => {
    assert.equal(
        resolveCopilotCliInstructionsPath({
            environment: {
                COPILOT_HOME:
                    "C:\\perfil\\copilot"
            },
            homeDirectory:
                "C:\\Users\\Ada",
            pathApi: path.win32
        }),
        "C:\\perfil\\copilot\\instructions\\clrs.instructions.md"
    );
    assert.equal(
        resolveCopilotCliInstructionsPath({
            environment: {},
            homeDirectory:
                "C:\\Users\\Ada",
            pathApi: path.win32
        }),
        "C:\\Users\\Ada\\.copilot\\instructions\\clrs.instructions.md"
    );
    assert.equal(
        resolveCopilotCliInstructionsPath({
            environment: {
                COPILOT_HOME:
                    "/opt/copilot"
            },
            homeDirectory: "/home/ada",
            pathApi: path.posix
        }),
        "/opt/copilot/instructions/clrs.instructions.md"
    );
    assert.equal(
        resolveCopilotCliInstructionsPath({
            environment: {},
            homeDirectory: "/home/ada",
            pathApi: path.posix
        }),
        "/home/ada/.copilot/instructions/clrs.instructions.md"
    );
});

test("instala, reconoce y actualiza sólo el archivo personal de CLRS", async t => {
    const fixture = await createTempFixture(t);
    const installer = fixture.installer();
    const confirmations = [];
    const installed = await installer.install({
        confirm(plan) {
            confirmations.push(plan);
            return true;
        }
    });

    assert.equal(installed.status, "installed");
    assert.equal(confirmations[0].status, "missing");
    assert.equal(
        await readFile(
            fixture.targetPath,
            "utf8"
        ),
        fixture.canonicalContent
    );
    assert.match(
        fixture.canonicalContent,
        new RegExp(
            `applyTo:\\s*["']${escapeRegExp(
                COPILOT_CLRS_APPLY_TO
            )}["']`,
            "u"
        )
    );

    let currentConfirmationCalled = false;
    const current = await installer.install({
        confirm() {
            currentConfirmationCalled = true;
            return true;
        }
    });

    assert.equal(current.status, "current");
    assert.equal(currentConfirmationCalled, false);

    await writeFile(
        fixture.targetPath,
        "contenido personalizado\n",
        "utf8"
    );
    const cancelled = await installer.install({
        confirm(plan) {
            assert.equal(plan.status, "different");
            return false;
        }
    });

    assert.equal(cancelled.status, "cancelled");
    assert.equal(
        await readFile(
            fixture.targetPath,
            "utf8"
        ),
        "contenido personalizado\n"
    );

    const updated = await installer.install({
        confirm(plan) {
            assert.equal(plan.status, "different");
            return true;
        }
    });

    assert.equal(updated.status, "updated");
    assert.equal(
        await readFile(
            fixture.targetPath,
            "utf8"
        ),
        fixture.canonicalContent
    );
});

test("propaga un fallo de escritura sin modificar otras instrucciones", async () => {
    const expectedContent = [
        "---",
        `applyTo: \"${COPILOT_CLRS_APPLY_TO}\"`,
        "---",
        "Reglas CLRS",
        ""
    ].join("\n");
    const writes = [];
    const installer =
        new CopilotCliInstructionsInstaller({
            canonicalPath:
                "/extension/copilot/clrs.instructions.md",
            targetPath:
                "/home/ada/.copilot/instructions/clrs.instructions.md",
            pathApi: path.posix,
            fileSystem: {
                async readFile(filePath) {
                    if (filePath.startsWith(
                        "/extension/"
                    )) {
                        return expectedContent;
                    }

                    const error = new Error(
                        "no existe"
                    );
                    error.code = "ENOENT";
                    throw error;
                },
                async mkdir() {},
                async writeFile(...args) {
                    writes.push(args);
                    const error = new Error(
                        "acceso denegado"
                    );
                    error.code = "EACCES";
                    throw error;
                }
            }
        });

    await assert.rejects(
        installer.install({
            confirm: () => true
        }),
        /acceso denegado/u
    );
    assert.equal(writes.length, 1);
});

test("registra una sola implementación para menú y paleta", async () => {
    const fixture = createCommandFixture();
    const registration = registerCopilotCommands({
        vscodeApi: fixture.vscode,
        lifecycle: fixture.lifecycle,
        installerFactory: () => ({
            async install({ confirm }) {
                const approved = await confirm({
                    status: "missing",
                    targetPath:
                        "/home/ada/.copilot/instructions/clrs.instructions.md"
                });

                return {
                    status: approved
                        ? "installed"
                        : "cancelled"
                };
            }
        })
    });

    assert.equal(
        registration.commandId,
        CLRS_INSTALL_COPILOT_CLI_COMMAND
    );
    assert.equal(fixture.handlers.size, 1);
    assert.equal(
        fixture.lifecycle.resources.length,
        1
    );

    fixture.selections.push("Instalar");
    const outcome = await fixture.handlers.get(
        CLRS_INSTALL_COPILOT_CLI_COMMAND
    )();

    assert.equal(outcome.status, "installed");
    assert.equal(
        fixture.prompts[0].options.modal,
        true
    );
    assert.deepEqual(
        fixture.prompts[0].actions,
        ["Instalar"]
    );
    assert.match(
        fixture.prompts[0].options.detail,
        /clrs\.instructions\.md/u
    );
    assert.equal(
        fixture.messages.at(-1),
        "Soporte de CLRS para Copilot CLI instalado."
    );
});

test("la UI nativa conserva un archivo distinto y presenta fallos", async () => {
    const fixture = createCommandFixture();
    fixture.selections.push(undefined);
    const cancelled = await installCopilotCliSupport({
        vscode: fixture.vscode,
        installer: {
            async install({ confirm }) {
                const approved = await confirm({
                    status: "different",
                    targetPath:
                        "/home/ada/.copilot/instructions/clrs.instructions.md"
                });

                return {
                    status: approved
                        ? "updated"
                        : "cancelled"
                };
            }
        }
    });

    assert.equal(cancelled.status, "cancelled");
    assert.deepEqual(
        fixture.prompts[0].actions,
        ["Actualizar"]
    );
    assert.equal(
        fixture.messages.at(-1),
        "No se modificaron las instrucciones de Copilot CLI."
    );

    const failed = await installCopilotCliSupport({
        vscode: fixture.vscode,
        installer: {
            async install() {
                throw new Error(
                    "acceso denegado"
                );
            }
        }
    });

    assert.equal(failed.status, "error");
    assert.match(
        fixture.errors.at(-1),
        /acceso denegado/u
    );
});

async function createTempFixture(t) {
    const temporaryRoot = await mkdtemp(
        path.join(
            os.tmpdir(),
            "clrs-copilot-"
        )
    );
    const targetPath = path.join(
        temporaryRoot,
        "profile",
        "instructions",
        "clrs.instructions.md"
    );
    const canonicalContent = await readFile(
        canonicalPath,
        "utf8"
    );

    t.after(() => rm(
        temporaryRoot,
        {
            recursive: true,
            force: true
        }
    ));

    return {
        canonicalContent,
        targetPath,
        installer() {
            return new CopilotCliInstructionsInstaller({
                canonicalPath,
                targetPath
            });
        }
    };
}

function createCommandFixture() {
    const handlers = new Map();
    const prompts = [];
    const messages = [];
    const errors = [];
    const selections = [];
    const lifecycle = {
        resources: [],
        add(...resources) {
            this.resources.push(...resources);
        }
    };
    const vscode = {
        commands: {
            registerCommand(command, handler) {
                handlers.set(command, handler);

                return {
                    dispose() {}
                };
            }
        },
        window: {
            async showInformationMessage(
                message,
                optionsOrAction,
                ...actions
            ) {
                if (
                    optionsOrAction != null &&
                    typeof optionsOrAction ===
                        "object"
                ) {
                    prompts.push({
                        message,
                        options: optionsOrAction,
                        actions
                    });

                    return selections.shift();
                }

                messages.push(message);
                return undefined;
            },
            async showErrorMessage(message) {
                errors.push(message);
            }
        }
    };

    return {
        vscode,
        lifecycle,
        handlers,
        prompts,
        messages,
        errors,
        selections
    };
}

function escapeRegExp(value) {
    return value.replace(
        /[.*+?^${}()|[\]\\]/gu,
        "\\$&"
    );
}
