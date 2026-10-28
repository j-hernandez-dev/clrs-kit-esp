import test from "node:test";
import assert from "node:assert/strict";

import {
    RuntimePerformanceMonitor
} from "../src/performance/RuntimePerformanceMonitor.js";

test("agrega tiempos sin conservar contenido del usuario", async () => {
    let now = 10;
    const monitor =
        new RuntimePerformanceMonitor({
            clock: () => now
        });

    const value = monitor.measure(
        "analysis.document",
        () => {
            now = 14.25;
            return "resultado";
        }
    );
    const promised = monitor.measure(
        "webview.diagram",
        async () => {
            now = 21;
            return 7;
        }
    );

    now = 25;

    assert.equal(value, "resultado");
    assert.equal(await promised, 7);
    assert.deepEqual(
        monitor.getSnapshot().stages,
        {
            "analysis.document": {
                count: 1,
                totalMs: 4.25,
                averageMs: 4.25,
                minimumMs: 4.25,
                maximumMs: 4.25,
                lastMs: 4.25
            },
            "webview.diagram": {
                count: 1,
                totalMs: 10.75,
                averageMs: 10.75,
                minimumMs: 10.75,
                maximumMs: 10.75,
                lastMs: 10.75
            }
        }
    );
    assert.equal(
        JSON.stringify(
            monitor.getSnapshot()
        ).includes("resultado"),
        false
    );
});

test("limita la cantidad de etapas y se libera de forma idempotente", () => {
    const monitor =
        new RuntimePerformanceMonitor({
            maximumStages: 2,
            clock: () => 0
        });

    monitor.record("extension.activation", 1);
    monitor.record("analysis.document", 2);
    monitor.record("analysis.cost", 3);

    assert.deepEqual(
        Object.keys(
            monitor.getSnapshot().stages
        ),
        [
            "analysis.document",
            "analysis.cost"
        ]
    );

    monitor.dispose();
    monitor.dispose();

    assert.deepEqual(
        monitor.getSnapshot().stages,
        {}
    );
    assert.equal(
        monitor.record(
            "analysis.document",
            4
        ),
        false
    );
});
