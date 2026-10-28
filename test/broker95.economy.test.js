import test from "node:test";
import assert from "node:assert/strict";

import {
    BROKER_ALERT_LIMIT,
    BROKER_GAME_OVER_ALERT_LEVEL,
    BrokerEconomyOperation,
    BrokerEconomyService,
    BrokerGameStatus,
    createBrokerGameState,
    createBrokerPublicGameState,
    getBrokerCountermeasures
} from "../src/broker95/index.js";

test("publica el catálogo económico canónico sin autoridad mutable", () => {
    assert.deepEqual(
        getBrokerCountermeasures(),
        [
            {
                id: "scrub",
                name: "Borrar rastros",
                price: 250,
                reset: false,
                reduction: 1
            },
            {
                id: "infrastructure",
                name: "Cambiar infraestructura",
                price: 650,
                reset: false,
                reduction: 2
            },
            {
                id: "identity",
                name: "Quemar identidad",
                price: 1200,
                reset: false,
                reduction: 3
            },
            {
                id: "bribe",
                name: "Sobornar investigador",
                price: 3500,
                reset: true,
                reduction: 0
            }
        ]
    );
    assert.equal(
        Object.isFrozen(
            getBrokerCountermeasures()
        ),
        true
    );
    assert.equal(BROKER_ALERT_LIMIT, 10);
    assert.equal(
        BROKER_GAME_OVER_ALERT_LEVEL,
        11
    );
});

test("compra y persiste una contramedida mediante una transición autoritativa", async () => {
    const session = createMemorySession(
        createBrokerGameState({
            money: 1000,
            alertLevel: 3
        })
    );
    const service = new BrokerEconomyService({
        gameSession: session
    });
    const result = await service.purchase(
        "infrastructure"
    );

    assert.equal(
        result.operation,
        BrokerEconomyOperation
            .PURCHASE_COUNTERMEASURE
    );
    assert.equal(result.previousMoney, 1000);
    assert.equal(result.money, 350);
    assert.equal(result.previousAlert, 3);
    assert.equal(result.alertLevel, 1);
    assert.equal(result.stateRevision, 1);
    assert.match(
        result.messages[0].text,
        /Cambiar infraestructura/
    );
    assert.equal(session.writes, 1);
    assert.equal(session.getState().money, 350);
    assert.equal(
        session.getState().alertLevel,
        1
    );
});

test("una compra correlacionada es idempotente en curso y después de completarse", async () => {
    const session = createMemorySession(
        createBrokerGameState({
            money: 1000,
            alertLevel: 3
        })
    );
    const service = new BrokerEconomyService({
        gameSession: session
    });
    const options = {
        requestId: "economy:idempotent:1"
    };
    const [first, duplicate] =
        await Promise.all([
            service.purchase(
                "infrastructure",
                options
            ),
            service.purchase(
                "infrastructure",
                options
            )
        ]);

    assert.equal(first, duplicate);
    assert.equal(session.writes, 1);
    assert.equal(session.getState().money, 350);
    assert.equal(
        session.getState().alertLevel,
        1
    );

    const replay = await service.purchase(
        "infrastructure",
        options
    );

    assert.equal(replay, first);
    assert.equal(session.writes, 1);

    await assert.rejects(
        service.purchase("scrub", options),
        error => error.code ===
            "BROKER95_OPERATION_IDEMPOTENCY_CONFLICT"
    );
    assert.equal(session.writes, 1);
});

test("rechaza compras inválidas sin modificar saldo, alerta ni revisión", async () => {
    for (const [state, id, code] of [
        [
            createBrokerGameState({
                money: 249,
                alertLevel: 1
            }),
            "scrub",
            "BROKER95_MONEY_INSUFFICIENT"
        ],
        [
            createBrokerGameState({
                money: 4000,
                alertLevel: 0
            }),
            "bribe",
            "BROKER95_ALERT_ALREADY_ZERO"
        ],
        [
            createBrokerGameState({
                status:
                    BrokerGameStatus.GAME_OVER,
                alertLevel: 11,
                money: 0
            }),
            "scrub",
            "BROKER95_GAME_OVER"
        ]
    ]) {
        const session = createMemorySession(state);
        const service = new BrokerEconomyService({
            gameSession: session
        });

        await assert.rejects(
            service.purchase(id),
            error => error.code === code
        );
        assert.equal(session.getState(), state);
        assert.equal(session.writes, 0);
    }
});

test("deriva disponibilidad pública de saldo, alerta y game over", () => {
    const playable = createBrokerPublicGameState(
        createBrokerGameState({
            money: 700,
            alertLevel: 2
        })
    );

    assert.equal(playable.gameOver, false);
    assert.equal(
        playable.economy.alertLimit,
        10
    );
    assert.deepEqual(
        playable.economy.countermeasures
            .map(item => [
                item.id,
                item.available,
                item.unavailableReason
            ]),
        [
            ["scrub", true, null],
            ["infrastructure", true, null],
            [
                "identity",
                false,
                "insufficient_funds"
            ],
            [
                "bribe",
                false,
                "insufficient_funds"
            ]
        ]
    );

    const gameOver = createBrokerPublicGameState(
        createBrokerGameState({
            status: BrokerGameStatus.GAME_OVER,
            alertLevel: 11,
            money: 0
        })
    );

    assert.equal(gameOver.gameOver, true);
    assert.ok(
        gameOver.economy.countermeasures
            .every(item =>
                item.unavailableReason ===
                    "game_over"
            )
    );
});

function createMemorySession(initialState) {
    let state = initialState;
    const session = {
        writes: 0,
        async initialize() {},
        getState() {
            return state;
        },
        async transact(transition) {
            const next = transition(state);

            if (next !== state) {
                state = next;
                session.writes += 1;
            }

            return state;
        }
    };

    return session;
}
