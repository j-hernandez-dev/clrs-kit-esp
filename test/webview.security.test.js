import test from "node:test";
import assert from "node:assert/strict";

import {
    createWebviewContentSecurityPolicy
} from "../extension/commands/webview/WebViewContent.js";

const webview = Object.freeze({
    cspSource: "vscode-webview://security-test"
});

test("BROKER.95 usa una CSP local, sin red, frames, objetos ni formularios externos", () => {
    const policy =
        createWebviewContentSecurityPolicy(
            webview,
            { mode: "broker95" }
        );

    for (const directive of [
        "default-src 'none'",
        "base-uri 'none'",
        "object-src 'none'",
        "frame-src 'none'",
        "worker-src 'none'",
        "form-action 'none'",
        "connect-src 'none'",
        "script-src-attr 'none'",
        "style-src-attr 'unsafe-inline'"
    ]) {
        assert.match(
            policy,
            new RegExp(
                escapeRegExp(directive),
                "u"
            )
        );
    }

    assert.match(
        policy,
        /script-src vscode-webview:\/\/security-test/u
    );
    assert.match(
        policy,
        /style-src vscode-webview:\/\/security-test;/u
    );
    assert.doesNotMatch(
        policy,
        /style-src [^;]*'unsafe-inline'/u
    );
    assert.doesNotMatch(
        policy,
        /img-src [^;]*(?:data:|blob:)/u
    );
});

test("los otros visores conservan imágenes locales generadas sin abrir red externa", () => {
    const policy =
        createWebviewContentSecurityPolicy(
            webview
        );

    assert.match(
        policy,
        /img-src vscode-webview:\/\/security-test data: blob:/u
    );
    assert.match(
        policy,
        /connect-src vscode-webview:\/\/security-test/u
    );
    assert.doesNotMatch(
        policy,
        /https?:/u
    );
});

function escapeRegExp(value) {
    return value.replace(
        /[.*+?^${}()|[\]\\]/gu,
        "\\$&"
    );
}
