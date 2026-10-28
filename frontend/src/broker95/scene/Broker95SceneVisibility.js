export function observeBroker95SceneVisibility(
    element,
    listener,
    options = {}
) {
    if (typeof listener !== "function") {
        throw new TypeError(
            "BROKER.95 visibility listener must be a function."
        );
    }

    const documentTarget =
        options.documentTarget ??
        globalThis.document ?? null;
    const IntersectionObserverClass =
        options.IntersectionObserverClass ??
        globalThis.IntersectionObserver ?? null;
    const focusTarget =
        options.focusTarget ??
        documentTarget?.defaultView ??
        null;
    const activityTarget =
        options.activityTarget ??
        documentTarget;
    const setTimer =
        options.setTimeout ??
        globalThis.setTimeout;
    const clearTimer =
        options.clearTimeout ??
        globalThis.clearTimeout;
    const idleTimeoutMs =
        options.idleTimeoutMs ??
        60_000;
    let documentVisible =
        documentTarget?.visibilityState !==
        "hidden";
    let intersecting = true;
    let focused = true;
    let active = true;
    let idleTimer = null;
    let disposed = false;
    let lastPublished = null;
    const publish = () => {
        const visible =
            documentVisible &&
            intersecting &&
            focused &&
            active;

        if (
            disposed ||
            visible === lastPublished
        ) {
            return;
        }

        lastPublished = visible;
        listener(visible);
    };
    const scheduleIdle = () => {
        if (idleTimer != null) {
            clearTimer(idleTimer);
        }

        if (
            !Number.isFinite(idleTimeoutMs) ||
            idleTimeoutMs <= 0
        ) {
            idleTimer = null;
            return;
        }

        idleTimer = setTimer(() => {
            idleTimer = null;
            active = false;
            publish();
        }, idleTimeoutMs);
        idleTimer?.unref?.();
    };
    const reactivate = () => {
        active = true;
        scheduleIdle();
        publish();
    };
    const onDocumentVisibility = () => {
        documentVisible =
            documentTarget?.visibilityState !==
            "hidden";

        if (documentVisible) {
            reactivate();
            return;
        }

        publish();
    };
    const onFocus = () => {
        focused = true;
        reactivate();
    };
    const onBlur = () => {
        focused = false;
        publish();
    };
    const activityEvents = [
        "pointerdown",
        "pointermove",
        "keydown",
        "wheel",
        "touchstart"
    ];

    documentTarget?.addEventListener?.(
        "visibilitychange",
        onDocumentVisibility
    );
    focusTarget?.addEventListener?.(
        "focus",
        onFocus
    );
    focusTarget?.addEventListener?.(
        "blur",
        onBlur
    );
    activityEvents.forEach(type =>
        activityTarget?.addEventListener?.(
            type,
            reactivate,
            { passive: true }
        )
    );

    let observer = null;

    if (
        element &&
        typeof IntersectionObserverClass ===
            "function"
    ) {
        observer = new IntersectionObserverClass(
            entries => {
                const entry = entries.find(
                    candidate =>
                        candidate.target === element
                ) ?? entries[0];

                if (!entry) {
                    return;
                }

                intersecting =
                    entry.isIntersecting === true &&
                    (
                        entry.intersectionRatio == null ||
                        entry.intersectionRatio > 0
                    );

                if (intersecting) {
                    reactivate();
                    return;
                }

                publish();
            },
            { threshold: 0.01 }
        );
        observer.observe(element);
    }

    scheduleIdle();
    publish();

    return () => {
        if (disposed) {
            return;
        }

        disposed = true;
        if (idleTimer != null) {
            clearTimer(idleTimer);
            idleTimer = null;
        }
        observer?.disconnect();
        documentTarget?.removeEventListener?.(
            "visibilitychange",
            onDocumentVisibility
        );
        focusTarget?.removeEventListener?.(
            "focus",
            onFocus
        );
        focusTarget?.removeEventListener?.(
            "blur",
            onBlur
        );
        activityEvents.forEach(type =>
            activityTarget?.removeEventListener?.(
                type,
                reactivate
            )
        );
    };
}
