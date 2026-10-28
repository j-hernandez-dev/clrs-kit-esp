import {
    requirePort
} from "../../application/ports/ApplicationPorts.js";
import {
    BrokerOperationCoordinator,
    createBrokerOperationFingerprint
} from "../application/BrokerOperationCoordinator.js";
import {
    BrokerGameError
} from "../core/BrokerGameError.js";
import {
    getBrokerCountermeasure
} from "../core/BrokerGameRules.js";
import {
    purchaseBrokerCountermeasure
} from "../core/BrokerStateTransition.js";

export const BrokerEconomyOperation =
    Object.freeze({
        PURCHASE_COUNTERMEASURE:
            "economy/purchase-countermeasure"
    });

/**
 * Caso de uso autoritativo para la economía local. El Webview sólo solicita
 * una intención; esta clase valida y persiste la transición en el Host.
 */
export class BrokerEconomyService {

    constructor(options = {}) {
        this.gameSession = requirePort(
            options.gameSession,
            "brokerGameSession",
            ["initialize", "transact"]
        );
        this.operations = requirePort(
            options.operationCoordinator ??
                new BrokerOperationCoordinator(),
            "brokerEconomyOperations",
            ["execute"]
        );
    }

    async purchase(countermeasureId, options = {}) {
        const execution =
            normalizeExecutionOptions(options);

        return this.operations.execute(
            {
                operation:
                    BrokerEconomyOperation
                        .PURCHASE_COUNTERMEASURE,
                requestId:
                    execution.requestId,
                fingerprint:
                    execution.requestId == null
                        ? null
                        : createBrokerOperationFingerprint({
                            countermeasureId
                        }),
                lane: "game-economy"
            },
            () => this.#purchase(
                countermeasureId
            )
        );
    }

    async #purchase(countermeasureId) {
        const countermeasure =
            getBrokerCountermeasure(
                countermeasureId
            );

        await this.gameSession.initialize();

        let previous = null;
        const state = await this.gameSession
            .transact((
                current,
                transitionOptions
            ) => {
                previous = current;

                return purchaseBrokerCountermeasure(
                    current,
                    countermeasureId,
                    transitionOptions
                );
            });

        return Object.freeze({
            operation:
                BrokerEconomyOperation
                    .PURCHASE_COUNTERMEASURE,
            countermeasure: Object.freeze({
                id: countermeasureId,
                name: countermeasure.name,
                price: countermeasure.price,
                reduction:
                    countermeasure.reduction,
                reset: countermeasure.reset
            }),
            previousMoney: previous.money,
            money: state.money,
            previousAlert:
                previous.alertLevel,
            alertLevel: state.alertLevel,
            stateRevision: state.revision,
            messages: Object.freeze([
                Object.freeze({
                    kind: "system",
                    text: formatPurchaseMessage(
                        countermeasure,
                        previous,
                        state
                    )
                })
            ])
        });
    }
}

function normalizeExecutionOptions(value) {
    if (
        value == null ||
        typeof value !== "object" ||
        Array.isArray(value) ||
        Object.keys(value).some(
            key => key !== "requestId"
        ) ||
        (
            value.requestId != null &&
            (
                typeof value.requestId !== "string" ||
                !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u
                    .test(value.requestId)
            )
        )
    ) {
        throw BrokerGameError.invalidRule(
            "BROKER95_ECONOMY_OPTIONS_INVALID",
            "No fue posible coordinar la compra.",
            []
        );
    }

    return Object.freeze({
        requestId: value.requestId ?? null
    });
}

function formatPurchaseMessage(
    countermeasure,
    previous,
    state
) {
    return [
        `Contramedida aplicada: ${countermeasure.name}.`,
        `Costo: ${formatMoney(countermeasure.price)}.`,
        `Alerta: ${previous.alertLevel}/10 → ${state.alertLevel}/10.`,
        `Saldo actual: ${formatMoney(state.money)}.`
    ].join("\n");
}

function formatMoney(value) {
    return new Intl.NumberFormat(
        "es-MX",
        {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 0
        }
    ).format(value);
}
