const DARK_FALLBACK_COLORS =
    Object.freeze({
        editorBackground: "#1E1E1E",
        editorForeground: "#D4D4D4",
        widgetBackground: "#252526",
        inputBackground: "#313131",
        sideBarBackground: "#181818",
        hoverBackground: "#252526",
        border: "#454545",
        focusBorder: "#007ACC",
        buttonBackground: "#0E639C",
        buttonForeground: "#FFFFFF",
        inputForeground: "#CCCCCC"
    });

const LIGHT_FALLBACK_COLORS =
    Object.freeze({
        editorBackground: "#FFFFFF",
        editorForeground: "#202020",
        widgetBackground: "#F3F3F3",
        inputBackground: "#FFFFFF",
        sideBarBackground: "#F8F8F8",
        hoverBackground: "#F3F3F3",
        border: "#B8B8B8",
        focusBorder: "#0066B8",
        buttonBackground: "#007ACC",
        buttonForeground: "#FFFFFF",
        inputForeground: "#202020"
    });

/**
 * Construye un tema con colores concretos obtenidos del webview.
 *
 * Nunca conserva referencias `var(--vscode-...)`, de modo que el mismo
 * objeto puede utilizarse al exportar un SVG autónomo.
 */
export function createVSCodeTheme(
    resolveColor = fallbackColor
) {

    const editorBackground =
        readColor(
            resolveColor,
            "--vscode-editor-background",
            DARK_FALLBACK_COLORS
                .editorBackground
        );
    const fallbackColors =
        getColorAppearance(
            editorBackground
        ) === "dark"
            ? DARK_FALLBACK_COLORS
            : LIGHT_FALLBACK_COLORS;
    const editorForeground =
        readColor(
            resolveColor,
            "--vscode-editor-foreground",
            fallbackColors.editorForeground
        );
    const border =
        readColor(
            resolveColor,
            "--vscode-contrastBorder",
            readColor(
                resolveColor,
                "--vscode-editorWidget-border",
                readColor(
                    resolveColor,
                    "--vscode-panel-border",
                    fallbackColors.border
                )
            )
        );
    const focusBorder =
        readColor(
            resolveColor,
            "--vscode-contrastActiveBorder",
            readColor(
                resolveColor,
                "--vscode-focusBorder",
                fallbackColors.focusBorder
            )
        );
    const widgetBackground =
        readColor(
            resolveColor,
            "--vscode-editorWidget-background",
            fallbackColors.widgetBackground
        );
    const sideBarBackground =
        readColor(
            resolveColor,
            "--vscode-sideBar-background",
            fallbackColors.sideBarBackground
        );
    const inputBackground =
        readColor(
            resolveColor,
            "--vscode-input-background",
            fallbackColors.inputBackground
        );
    const inputForeground =
        readColor(
            resolveColor,
            "--vscode-input-foreground",
            fallbackColors.inputForeground
        );
    const hoverBackground =
        readColor(
            resolveColor,
            "--vscode-editorHoverWidget-background",
            fallbackColors.hoverBackground
        );
    const buttonBackground =
        readColor(
            resolveColor,
            "--vscode-button-background",
            fallbackColors.buttonBackground
        );
    const buttonForeground =
        readColor(
            resolveColor,
            "--vscode-button-foreground",
            fallbackColors.buttonForeground
        );
    const variableAccent =
        readColor(
            resolveColor,
            "--vscode-symbolIcon-variableForeground",
            border
        );
    const functionAccent =
        readColor(
            resolveColor,
            "--vscode-symbolIcon-functionForeground",
            focusBorder
        );
    const warningAccent =
        readColor(
            resolveColor,
            "--vscode-editorWarning-foreground",
            focusBorder
        );
    const linkAccent =
        readColor(
            resolveColor,
            "--vscode-textLink-foreground",
            focusBorder
        );

    const standardNode =
        nodeStyle(
            widgetBackground,
            variableAccent,
            editorForeground
        );
    const inputNode =
        nodeStyle(
            inputBackground,
            warningAccent,
            inputForeground
        );
    const hoverNode =
        nodeStyle(
            hoverBackground,
            linkAccent,
            editorForeground
        );
    const terminalNode =
        nodeStyle(
            buttonBackground,
            focusBorder,
            buttonForeground
        );

    return {
        id: "vscode",
        name: "VS Code",
        appearance:
            getColorAppearance(
                editorBackground
            ),
        canvas: {
            background:
                editorBackground
        },
        arrow: {
            color:
                editorForeground,
            colorLabel:
                editorBackground
        },
        subgraph: {
            fill:
                sideBarBackground,
            stroke:
                border,
            text:
                editorForeground
        },
        nodes: {
            merge:
                standardNode,
            process:
                standardNode,
            call:
                nodeStyle(
                    sideBarBackground,
                    functionAccent,
                    editorForeground
                ),
            start:
                terminalNode,
            return:
                terminalNode,
            decision:
                inputNode,
            preparation:
                inputNode,
            read:
                hoverNode,
            write:
                hoverNode
        }
    };

}

/**
 * Captura los valores efectivos del conjunto de variables de VS Code.
 */
export function createDocumentColorResolver(
    ownerDocument
) {

    const root =
        ownerDocument?.documentElement;
    const view =
        ownerDocument?.defaultView;
    const computedStyle =
        root && view
            ? view.getComputedStyle(root)
            : null;

    return (variableName, fallback) => {

        const value =
            computedStyle
                ?.getPropertyValue(
                    variableName
                )
                .trim();

        return value || fallback;

    };

}

export function getColorAppearance(color) {

    const rgb = parseColor(color);

    if (!rgb) {
        return "dark";
    }

    const luminance =
        (
            0.2126 * rgb.red +
            0.7152 * rgb.green +
            0.0722 * rgb.blue
        ) / 255;

    return luminance < 0.5
        ? "dark"
        : "light";

}

function nodeStyle(fill, stroke, text) {

    return {
        fill,
        stroke,
        text
    };

}

function readColor(
    resolveColor,
    variableName,
    fallback
) {

    try {
        const value =
            resolveColor(
                variableName,
                fallback
            );

        const selected =
            typeof value === "string" &&
            value.trim()
                ? value.trim()
                : fallback;

        return normalizeColor(
            selected
        ) ??
            normalizeColor(fallback) ??
            DARK_FALLBACK_COLORS
                .editorForeground;
    } catch {
        return (
            normalizeColor(fallback) ??
            DARK_FALLBACK_COLORS
                .editorForeground
        );
    }

}

function fallbackColor(
    _variableName,
    fallback
) {

    return fallback;

}

function parseColor(color) {

    const value =
        String(color ?? "")
            .trim();
    const hex =
        value.match(
            /^#([\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i
        );

    if (hex) {
        let digits = hex[1];

        if (
            digits.length === 3 ||
            digits.length === 4
        ) {
            digits =
                [...digits]
                    .map(character =>
                        character + character
                    )
                    .join("");
        }

        return {
            red:
                Number.parseInt(
                    digits.slice(0, 2),
                    16
                ),
            green:
                Number.parseInt(
                    digits.slice(2, 4),
                    16
                ),
            blue:
                Number.parseInt(
                    digits.slice(4, 6),
                    16
                ),
            alpha:
                digits.length === 8
                    ? Number.parseInt(
                        digits.slice(6, 8),
                        16
                    )
                    : 255
        };
    }

    const rgb =
        value.match(
            /^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*(\d+(?:\.\d+)?))?\s*\)$/i
        );

    if (!rgb) {
        return null;
    }

    return {
        red: Number(rgb[1]),
        green: Number(rgb[2]),
        blue: Number(rgb[3]),
        alpha:
            rgb[4] === undefined
                ? 255
                : Math.round(
                    Number(rgb[4]) * 255
                )
    };

}

function normalizeColor(color) {

    const parsed =
        parseColor(color);

    if (!parsed) {
        return null;
    }

    const channels = [
        parsed.red,
        parsed.green,
        parsed.blue
    ];
    let result =
        "#" +
        channels
            .map(channel =>
                toHex(channel)
            )
            .join("");

    if (parsed.alpha < 255) {
        result += toHex(parsed.alpha);
    }

    return result.toUpperCase();

}

function toHex(channel) {

    return Math.max(
        0,
        Math.min(
            255,
            Math.round(channel)
        )
    )
        .toString(16)
        .padStart(2, "0");

}
