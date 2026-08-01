import test from "node:test";
import assert from "node:assert/strict";

import {
    DEFAULT_THEME_ID,
    getAvailableThemes,
    getTheme
} from "../flow/src/themes/ThemeManager.js";
import {
    createDocumentColorResolver,
    createVSCodeTheme,
    getColorAppearance
} from "../flow/src/themes/presets/VSCodeTheme.js";

test("el tema de VS Code es el predeterminado y aparece primero", () => {
    const available =
        getAvailableThemes();
    const configuration =
        getTheme();

    assert.equal(
        DEFAULT_THEME_ID,
        "vscode"
    );
    assert.equal(
        available[0].id,
        DEFAULT_THEME_ID
    );
    assert.equal(
        configuration.theme.id,
        DEFAULT_THEME_ID
    );
});

test("resuelve colores de VS Code a literales Mermaid portátiles", () => {
    const colors = {
        "--vscode-editor-background":
            "rgb(250, 250, 250)",
        "--vscode-editor-foreground":
            "#202020",
        "--vscode-contrastBorder":
            "rgba(1, 2, 3, 0.5)",
        "--vscode-contrastActiveBorder":
            "#123",
        "--vscode-symbolIcon-variableForeground":
            "rgb(10, 20, 30)",
        "--vscode-symbolIcon-functionForeground":
            "#456789",
        "--vscode-editorWarning-foreground":
            "#AA5500",
        "--vscode-textLink-foreground":
            "#0066CC"
    };
    const theme =
        createVSCodeTheme(
            (name, fallback) =>
                colors[name] ??
                fallback
        );

    assert.equal(
        theme.canvas.background,
        "#FAFAFA"
    );
    assert.equal(
        theme.appearance,
        "light"
    );
    assert.equal(
        theme.subgraph.stroke,
        "#01020380"
    );
    assert.equal(
        theme.nodes.process.stroke,
        "#0A141E"
    );
    assert.equal(
        theme.nodes.call.stroke,
        "#456789"
    );
    assert.equal(
        theme.nodes.decision.stroke,
        "#AA5500"
    );
    assert.equal(
        theme.nodes.write.stroke,
        "#0066CC"
    );
    assert.equal(
        containsCssVariable(theme),
        false
    );
    assert.equal(
        containsColorWithComma(theme),
        false
    );
});

test("el resolvedor documental usa variables efectivas y fallbacks", () => {
    const resolver =
        createDocumentColorResolver({
            documentElement: {},
            defaultView: {
                getComputedStyle() {
                    return {
                        getPropertyValue(name) {
                            return (
                                name ===
                                "--vscode-editor-background"
                                    ? " #F0F0F0 "
                                    : ""
                            );
                        }
                    };
                }
            }
        });

    assert.equal(
        resolver(
            "--vscode-editor-background",
            "#000000"
        ),
        "#F0F0F0"
    );
    assert.equal(
        resolver(
            "--vscode-missing",
            "#ABCDEF"
        ),
        "#ABCDEF"
    );
});

test("clasifica fondos claros y oscuros", () => {
    assert.equal(
        getColorAppearance("#1E1E1E"),
        "dark"
    );
    assert.equal(
        getColorAppearance(
            "rgb(245, 245, 245)"
        ),
        "light"
    );
});

function containsCssVariable(value) {
    return allStrings(value)
        .some(text =>
            text.includes("var(") ||
            text.includes("--vscode-")
        );
}

function containsColorWithComma(value) {
    return allStrings(value)
        .some(text =>
            /^(?:rgb|hsl)a?\(/i
                .test(text)
        );
}

function allStrings(value) {
    if (typeof value === "string") {
        return [value];
    }

    if (
        !value ||
        typeof value !== "object"
    ) {
        return [];
    }

    return Object.values(value)
        .flatMap(allStrings);
}
