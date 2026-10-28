import test from "node:test";
import assert from "node:assert/strict";

import {
    BrokerOperationCoordinator,
    createBrokerOperationFingerprint
} from "../src/broker95/index.js";

test("comparte una operación en curso y reutiliza su resultado exitoso", async () => {
    const coordinator =
        new BrokerOperationCoordinator();
    const gate = deferred();
    const result = Object.freeze({ ok: true });
    const descriptor = operationDescriptor(
        "request:single-flight",
        { value: 1 }
    );
    let executions = 0;
    const execute = () => coordinator.execute(
        descriptor,
        async () => {
            executions += 1;
            await gate.promise;
            return result;
        }
    );
    const first = execute();
    const duplicate = execute();

    assert.equal(first, duplicate);

    await Promise.resolve();
    assert.equal(executions, 1);

    gate.resolve();

    assert.equal(await first, result);
    assert.equal(await duplicate, result);

    const replay = coordinator.execute(
        descriptor,
        () => {
            executions += 1;
            return Object.freeze({ ok: false });
        }
    );

    assert.equal(replay, first);
    assert.equal(await replay, result);
    assert.equal(executions, 1);
    assert.deepEqual(
        coordinator.getSnapshot(),
        {
            inFlightCount: 0,
            completedCount: 1,
            laneCount: 0
        }
    );
});

test("rechaza una clave reutilizada con otra intención sin ejecutar efectos", async () => {
    const coordinator =
        new BrokerOperationCoordinator();
    let executions = 0;

    await coordinator.execute(
        operationDescriptor(
            "request:collision",
            { countermeasureId: "scrub" }
        ),
        () => {
            executions += 1;
            return "aplicado";
        }
    );

    assert.throws(
        () => coordinator.execute(
            operationDescriptor(
                "request:collision",
                {
                    countermeasureId:
                        "infrastructure"
                }
            ),
            () => {
                executions += 1;
            }
        ),
        error =>
            error.code ===
                "BROKER95_OPERATION_IDEMPOTENCY_CONFLICT" &&
            typeof error.publicMessage === "string"
    );
    assert.equal(executions, 1);
});

test("serializa cada carril sin bloquear recursos independientes", async () => {
    const coordinator =
        new BrokerOperationCoordinator();
    const gate = deferred();
    const started = [];
    const first = coordinator.execute(
        operationDescriptor(
            "lane:1",
            { order: 1 },
            "game"
        ),
        async () => {
            started.push("game:1");
            await gate.promise;
            return 1;
        }
    );
    const second = coordinator.execute(
        operationDescriptor(
            "lane:2",
            { order: 2 },
            "game"
        ),
        () => {
            started.push("game:2");
            return 2;
        }
    );
    const independent = coordinator.execute(
        operationDescriptor(
            "lane:3",
            { order: 3 },
            "conversation"
        ),
        () => {
            started.push("conversation:1");
            return 3;
        }
    );

    await Promise.resolve();
    await Promise.resolve();

    assert.deepEqual(
        started,
        ["game:1", "conversation:1"]
    );

    gate.resolve();

    assert.deepEqual(
        await Promise.all([
            first,
            second,
            independent
        ]),
        [1, 2, 3]
    );
    assert.deepEqual(
        started,
        [
            "game:1",
            "conversation:1",
            "game:2"
        ]
    );
});

test("no memoriza fallos y mantiene acotada la caché exitosa", async () => {
    const coordinator =
        new BrokerOperationCoordinator({
            maxCompleted: 1
        });
    const failed = operationDescriptor(
        "request:failed",
        { attempt: "retryable" }
    );
    let attempts = 0;

    await assert.rejects(
        coordinator.execute(
            failed,
            () => {
                attempts += 1;
                throw new Error("transient");
            }
        )
    );

    assert.equal(
        await coordinator.execute(
            failed,
            () => {
                attempts += 1;
                return "recovered";
            }
        ),
        "recovered"
    );
    assert.equal(attempts, 2);

    await coordinator.execute(
        operationDescriptor(
            "request:newer",
            { attempt: "newer" }
        ),
        () => "newer"
    );

    let reruns = 0;

    await coordinator.execute(
        failed,
        () => {
            reruns += 1;
            return "after-eviction";
        }
    );

    assert.equal(reruns, 1);
    assert.equal(
        coordinator.getSnapshot()
            .completedCount,
        1
    );
});

test("la huella es canónica, opaca y sensible al contenido", () => {
    const left =
        createBrokerOperationFingerprint({
            message: "dato privado",
            nested: { b: 2, a: 1 }
        });
    const reordered =
        createBrokerOperationFingerprint({
            nested: { a: 1, b: 2 },
            message: "dato privado"
        });
    const changed =
        createBrokerOperationFingerprint({
            nested: { a: 1, b: 3 },
            message: "dato privado"
        });

    assert.equal(left, reordered);
    assert.notEqual(left, changed);
    assert.match(left, /^[a-f0-9]{64}$/u);
    assert.equal(
        left.includes("dato privado"),
        false
    );
});

function operationDescriptor(
    requestId,
    input,
    lane = "test"
) {
    return {
        operation: "test/operation",
        requestId,
        fingerprint:
            createBrokerOperationFingerprint(
                input
            ),
        lane
    };
}

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise(
        (accept, decline) => {
            resolve = accept;
            reject = decline;
        }
    );

    return { promise, resolve, reject };
}
