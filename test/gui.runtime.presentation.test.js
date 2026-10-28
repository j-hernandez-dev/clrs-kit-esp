import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
    pathToFileURL
} from "node:url";

import {
    GuiRuntimeProgressPresenter
} from "../src/application/presenters/GuiRuntimeProgressPresenter.js";
import {
    GuiRuntimePreparation
} from "../src/compiler/gui/GuiRuntimePreparation.js";
import {
    GuiDependencyError
} from "../src/infrastructure/gui/GuiDependencyError.js";
import {
    NodeGtkDependencyManager
} from "../src/infrastructure/gui/NodeGtkDependencyManager.js";

test("GUI presentación: un programa sin GUI no consulta ni presenta preparación", async () => {
    const output = [];
    let ensureCalls = 0;
    const progress = presenter(output);
    const preparation =
        new GuiRuntimePreparation({
            dependencyManager: {
                async ensure() {
                    ensureCalls += 1;
                    progress.present(
                        "INSTALLING"
                    );
                    return dependency();
                }
            }
        });

    const result = await preparation.prepare({
        semanticModel: {}
    });

    assert.deepEqual(result, {});
    assert.equal(ensureCalls, 0);
    assert.deepEqual(output, []);
});

test("GUI presentación: un runtime READY tras comprobarse permanece silencioso", () => {
    const output = [];
    const progress = presenter(output);

    presentStates(progress, [
        "CHECKING",
        "PLATFORM_READY",
        "NODE_GTK_READY",
        "GTK_READY",
        "READY"
    ]);

    assert.deepEqual(output, []);
});

for (const recoveryState of [
    "MISSING",
    "BROKEN"
]) {
    test(`GUI presentación: ${recoveryState} muestra sólo hitos completados`, () => {
        const output = [];
        const progress = presenter(output);

        presentStates(progress, [
            "CHECKING",
            "PLATFORM_READY",
            recoveryState,
            "INSTALLING",
            "DEPENDENCIES_READY",
            "CHECKING",
            "NODE_GTK_READY",
            "GTK_READY",
            "NODE_GTK_READY",
            "GTK_READY",
            "READY"
        ]);

        const text = output.join("\n");

        assert.match(
            text,
            /Preparando entorno gráfico/u
        );
        assert.equal(
            occurrences(
                text,
                "✓ Plataforma compatible"
            ),
            1
        );
        assert.equal(
            occurrences(
                text,
                "✓ Dependencias preparadas"
            ),
            1
        );
        assert.equal(
            occurrences(
                text,
                "✓ node-gtk preparado"
            ),
            1
        );
        assert.equal(
            occurrences(
                text,
                "✓ GTK disponible"
            ),
            1
        );
        assert.match(
            text,
            /✓ Entorno gráfico preparado/u
        );
        assert.doesNotMatch(
            text,
            /%|⠋|⠙|⠹|⠸/u
        );
    });
}

test("GUI presentación: un fallo conserva hitos y añade resumen sin alterar diagnóstico", () => {
    const output = [];
    const progress = presenter(output);
    const diagnostic = Object.freeze({
        code:
            "CLRS_GUI_DEP_NATIVE_LOAD_FAILED",
        publicMessage:
            "Mensaje estructurado existente."
    });

    presentStates(progress, [
        "PLATFORM_READY",
        "BROKEN",
        "INSTALLING",
        "DEPENDENCIES_READY",
        "NODE_GTK_READY",
        "FAILED"
    ]);

    const text = output.join("\n");

    assert.match(
        text,
        /✓ Dependencias preparadas/u
    );
    assert.match(
        text,
        /✓ node-gtk preparado/u
    );
    assert.match(
        text,
        /✕ No se pudo preparar el entorno gráfico/u
    );
    assert.doesNotMatch(
        text,
        /✓ GTK disponible|✓ Entorno gráfico preparado/u
    );
    assert.equal(
        diagnostic.code,
        "CLRS_GUI_DEP_NATIVE_LOAD_FAILED"
    );
    assert.equal(
        diagnostic.publicMessage,
        "Mensaje estructurado existente."
    );
});

test("GUI presentación: la cancelación conserva hitos y usa el estado cancelado", () => {
    const output = [];
    const progress = presenter(output);

    presentStates(progress, [
        "PLATFORM_READY",
        "MISSING",
        "INSTALLING",
        "CANCELLED"
    ]);

    const text = output.join("\n");

    assert.match(
        text,
        /✓ Plataforma compatible/u
    );
    assert.match(
        text,
        /■ Preparación del entorno gráfico cancelada/u
    );
    assert.doesNotMatch(
        text,
        /✓ Entorno gráfico preparado/u
    );
});

test("GUI presentación: manager real integra instalación, READY silencioso y reparación fallida", async t => {
    const root = await fs.mkdtemp(
        path.join(
            os.tmpdir(),
            "clrs-gui-presentation-"
        )
    );
    t.after(() => fs.rm(
        root,
        { recursive: true, force: true }
    ));
    const output = [];
    const progress = presenter(output);
    let failProbe = false;
    const runtime = {
        executable: process.execPath,
        version: process.versions.node,
        abi: process.versions.modules,
        platform: process.platform,
        arch: process.arch
    };
    const lock = {
        lockfileVersion: 3,
        packages: {
            "": {
                dependencies: {
                    "node-gtk": "4.1.1"
                }
            },
            "node_modules/node-gtk": {
                version: "4.1.1",
                integrity: "sha512-fixture"
            }
        }
    };
    const manager =
        new NodeGtkDependencyManager({
            extensionRoot: root,
            inspector: {
                async inspect() {
                    return runtime;
                }
            },
            npm: {
                async install({ packages }) {
                    await fs.writeFile(
                        path.join(
                            packages,
                            "package-lock.json"
                        ),
                        JSON.stringify(lock)
                    );
                }
            },
            resolver: {
                async resolve(packages) {
                    return {
                        entryUrl:
                            pathToFileURL(
                                path.join(
                                    packages,
                                    "entry.mjs"
                                )
                            ).href
                    };
                }
            },
            probe: {
                async check() {
                    if (failProbe) {
                        throw new GuiDependencyError(
                            "CLRS_GUI_DEP_NATIVE_LOAD_FAILED"
                        );
                    }

                    return [4, 22, 4];
                }
            },
            onState: state =>
                progress.present(state)
        });

    await manager.ensure();
    const afterInstall = output.length;
    const installation = output.join("\n");

    assert.match(
        installation,
        /Preparando entorno gráfico/u
    );
    assert.match(
        installation,
        /✓ Entorno gráfico preparado/u
    );

    await manager.ensure();
    assert.equal(output.length, afterInstall);

    failProbe = true;
    await assert.rejects(
        manager.ensure(),
        error =>
            error.code ===
            "CLRS_GUI_DEP_NATIVE_LOAD_FAILED"
    );

    const failure = output
        .slice(afterInstall)
        .join("\n");

    assert.match(
        failure,
        /Preparando entorno gráfico/u
    );
    assert.match(
        failure,
        /✕ No se pudo preparar el entorno gráfico/u
    );
    assert.doesNotMatch(
        failure,
        /✓ node-gtk preparado|✓ GTK disponible/u
    );
});

function presenter(output) {
    return new GuiRuntimeProgressPresenter({
        logger: {
            log(message) {
                output.push(message);
            }
        },
        stream: {
            isTTY: false
        },
        environment: {}
    });
}

function presentStates(progress, states) {
    for (const state of states) {
        progress.present(state);
    }
}

function dependency() {
    return {
        entryUrl: "file:///gtk.mjs",
        nodeExecutable: process.execPath,
        version: "4.1.1"
    };
}

function occurrences(text, search) {
    return text.split(search).length - 1;
}
