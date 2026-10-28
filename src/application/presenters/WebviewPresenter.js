export class WebviewPresenter {

    constructor(messageTarget) {
        this.messageTarget = messageTarget;
    }

    present(result, type = "result") {
        const message =
            result.ok
                ? {
                    type,
                    ok: true,
                    value: result.value
                }
                : {
                    type,
                    ok: false,
                    errors:
                        result.errors.map(
                            error =>
                                typeof error.toJSON ===
                                "function"
                                    ? error.toJSON()
                                    : error
                        )
                };

        return this.messageTarget
            .postMessage(message);
    }
}
