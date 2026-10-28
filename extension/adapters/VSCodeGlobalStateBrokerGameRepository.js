import {
    requirePort
} from "../../src/application/ports/ApplicationPorts.js";

export const BROKER95_GLOBAL_STATE_KEY =
    "broker95.gameState";
export const BROKER95_CORRUPT_STATE_KEY =
    "broker95.gameState.corrupt";

export class VSCodeGlobalStateBrokerGameRepository {

    constructor(globalState, options = {}) {
        this.globalState = requirePort(
            globalState,
            "extensionContext.globalState",
            ["get", "update"]
        );
        this.stateKey =
            options.stateKey ??
            BROKER95_GLOBAL_STATE_KEY;
        this.corruptStateKey =
            options.corruptStateKey ??
            BROKER95_CORRUPT_STATE_KEY;
    }

    async read() {
        return this.globalState.get(
            this.stateKey
        );
    }

    async write(snapshot) {
        await this.globalState.update(
            this.stateKey,
            snapshot
        );
    }

    async quarantine(
        snapshot,
        errorCode
    ) {
        await this.globalState.update(
            this.corruptStateKey,
            Object.freeze({
                format:
                    "broker95-corrupt-state",
                formatVersion: 1,
                errorCode,
                snapshot
            })
        );
    }
}
