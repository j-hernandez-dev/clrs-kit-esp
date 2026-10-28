import test from "node:test";
import assert from "node:assert/strict";

import {
    Broker95AudioEngine,
    Broker95SoundEffect,
    deriveBroker95StateSoundEffects,
    getBroker95SoundRecipe,
    listBroker95SoundEffects
} from "../frontend/src/broker95/audio/index.js";

test("el catálogo contiene ocho señales procedurales acotadas", () => {
    const effects = listBroker95SoundEffects();

    assert.equal(effects.length, 8);
    assert.deepEqual(
        new Set(effects),
        new Set(Object.values(Broker95SoundEffect))
    );

    for (const effect of effects) {
        const recipe = getBroker95SoundRecipe(effect);

        assert.equal(Object.isFrozen(recipe), true);
        assert.ok(recipe.durationMs > 0);
        assert.ok(recipe.durationMs <= 1_000);
        assert.ok(recipe.voices.length >= 2);
        assert.ok(recipe.voices.length <= 6);
        assert.equal(
            recipe.voices.every(voice =>
                Object.isFrozen(voice) &&
                voice.gain > 0 &&
                voice.gain <= 1
            ),
            true
        );
    }
});

test("deriva señales semánticas sin duplicar eventos visuales", () => {
    const previous = audioState();
    const contract = audioState({
        gameState: {
            ...previous.gameState,
            contracts: [{
                id: "contract:1",
                state: "pending"
            }]
        }
    });
    const paid = audioState({
        gameState: {
            ...contract.gameState,
            money: 500,
            alertLevel: 1
        }
    });

    assert.deepEqual(
        deriveBroker95StateSoundEffects(
            previous,
            contract
        ),
        [Broker95SoundEffect.CONTRACT_RECEIVED]
    );
    assert.deepEqual(
        deriveBroker95StateSoundEffects(
            contract,
            paid
        ),
        [
            Broker95SoundEffect.PAYMENT,
            Broker95SoundEffect.ALERT
        ]
    );
    assert.deepEqual(
        deriveBroker95StateSoundEffects(
            previous,
            audioState({
                cipherSignal: { sequence: 2 }
            })
        ),
        [Broker95SoundEffect.CIPHER_SIGNAL]
    );
    assert.deepEqual(
        deriveBroker95StateSoundEffects(
            audioState({
                operation: { status: "busy" }
            }),
            previous
        ),
        [
            Broker95SoundEffect
                .DIGITAL_CONFIRMATION
        ]
    );
});

test("error y game over tienen prioridad sonora", () => {
    const previous = audioState();
    const failed = audioState({
        gameState: {
            ...previous.gameState,
            money: 700,
            alertLevel: 11,
            gameOver: true
        },
        lastError: {
            code: "BROKER95_TEST_ERROR",
            message: "Fallo controlado."
        }
    });

    assert.deepEqual(
        deriveBroker95StateSoundEffects(
            previous,
            failed
        ),
        [Broker95SoundEffect.ERROR]
    );
});

test("el motor exige gesto, respeta silencio, volumen y cooldown", async () => {
    const fixture = createAudioFixture();
    const engine = new Broker95AudioEngine({
        contextFactory: fixture.contextFactory,
        renderRecipe: fixture.renderRecipe,
        logger: { error() {} }
    });

    assert.equal(
        engine.play(
            Broker95SoundEffect.CRT_CLICK
        ),
        false
    );
    assert.equal(fixture.contextCreations(), 0);

    assert.equal(await engine.unlock(), true);
    assert.equal(fixture.contextCreations(), 1);
    assert.equal(
        engine.play(
            Broker95SoundEffect.CRT_CLICK
        ),
        true
    );
    assert.equal(
        engine.play(
            Broker95SoundEffect.CRT_CLICK
        ),
        false
    );
    assert.equal(
        engine.play(
            Broker95SoundEffect.CRT_CLICK,
            { force: true }
        ),
        true
    );
    assert.equal(fixture.renders.length, 2);

    engine.configure({
        muted: false,
        volume: 80
    });
    assert.ok(fixture.gainValues.at(-1) > 0);
    engine.configure({
        muted: true,
        volume: 80
    });
    assert.equal(fixture.gainValues.at(-1), 0);
    assert.equal(
        engine.play(
            Broker95SoundEffect.PAYMENT,
            { force: true }
        ),
        false
    );

    engine.dispose();
    engine.dispose();
    assert.equal(fixture.context.state, "closed");
});

test("aplica el volumen elegido antes de reproducir el primer sonido", async () => {
    const fixture = createAudioFixture();
    const engine = new Broker95AudioEngine({
        contextFactory: fixture.contextFactory,
        renderRecipe: fixture.renderRecipe,
        logger: { error() {} }
    });

    engine.configure({
        muted: false,
        volume: 25
    });

    assert.equal(await engine.unlock(), true);
    assert.ok(
        Math.abs(
            fixture.gainValues.at(-1) -
            .2 * Math.pow(.25, 1.35)
        ) < Number.EPSILON
    );

    engine.dispose();
});

function audioState(overrides = {}) {
    return {
        gameState: {
            contracts: [],
            money: 0,
            alertLevel: 0,
            gameOver: false
        },
        operation: { status: "idle" },
        cipherSignal: null,
        lastError: null,
        ...overrides
    };
}

function createAudioFixture() {
    let creations = 0;
    const gainValues = [];
    const renders = [];
    const context = {
        state: "suspended",
        currentTime: 1,
        destination: {},
        createGain() {
            return {
                gain: {
                    value: 1,
                    setValueAtTime(value) {
                        this.value = value;
                        gainValues.push(value);
                    },
                    setTargetAtTime(value) {
                        this.value = value;
                        gainValues.push(value);
                    }
                },
                connect() {}
            };
        },
        async resume() {
            this.state = "running";
        },
        close() {
            this.state = "closed";
        }
    };

    return {
        context,
        gainValues,
        renders,
        contextCreations: () => creations,
        contextFactory() {
            creations += 1;
            return context;
        },
        renderRecipe(options) {
            renders.push(options.recipe);
            options.registerSource({
                onended: null,
                stop() {},
                disconnect() {}
            });
        }
    };
}
