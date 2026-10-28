import {
    useEffect,
    useRef,
    useState
} from "react";

import {
    Broker95KaplayScene
} from "./Broker95KaplayScene.js";
import {
    observeBroker95SceneVisibility
} from "./Broker95SceneVisibility.js";

const DEFAULT_SCENE_FACTORY = options =>
    new Broker95KaplayScene(options);

export default function Broker95CipherScene({
    visualState,
    signal = null,
    sceneFactory = DEFAULT_SCENE_FACTORY
}) {
    const stageRef = useRef(null);
    const canvasRef = useRef(null);
    const sceneRef = useRef(null);
    const sceneReadyRef = useRef(false);
    const renderingEnabledRef = useRef(
        globalThis.document
            ?.visibilityState !== "hidden"
    );
    const [status, setStatus] =
        useState("loading");
    const [renderingEnabled, setRenderingEnabled] =
        useState(
            globalThis.document
                ?.visibilityState !== "hidden"
        );

    useEffect(
        () => {
            const stopObservingVisibility =
                observeBroker95SceneVisibility(
                    stageRef.current,
                    enabled => {
                        renderingEnabledRef.current =
                            enabled;
                        setRenderingEnabled(enabled);
                    }
                );

            return stopObservingVisibility;
        },
        []
    );

    useEffect(
        () => {
            setStatus("loading");
            sceneReadyRef.current = false;
            const abortController =
                new AbortController();
            const motionPreference =
                globalThis.matchMedia?.(
                    "(prefers-reduced-motion: reduce)"
                ) ?? null;
            const scene = sceneFactory({
                visualState,
                motionEnabled:
                    motionPreference?.matches !== true,
                visible:
                    renderingEnabledRef.current,
                onReady: () => {
                    sceneReadyRef.current = true;
                    setStatus(
                        renderingEnabledRef.current
                            ? "ready"
                            : "paused"
                    );
                },
                onError: error => {
                    console.error(
                        "[BROKER.95] Kaplay scene failed.",
                        {
                            name: error?.name,
                            code: error?.code
                        }
                    );
                    setStatus("error");
                }
            });

            sceneRef.current = scene;

            const applyMotionPreference = event =>
                scene.setMotionEnabled(
                    event.matches !== true
                );
            motionPreference?.addEventListener(
                "change",
                applyMotionPreference
            );
            scene.mount(
                canvasRef.current,
                { signal: abortController.signal }
            ).catch(() => {
                if (!abortController.signal.aborted) {
                    setStatus("error");
                }
            });

            return () => {
                abortController.abort();
                motionPreference?.removeEventListener(
                    "change",
                    applyMotionPreference
                );
                scene.dispose();
                sceneReadyRef.current = false;

                if (sceneRef.current === scene) {
                    sceneRef.current = null;
                }
            };
        },
        [sceneFactory]
    );

    useEffect(
        () => {
            sceneRef.current?.setVisible(
                renderingEnabled
            );

            if (!renderingEnabled) {
                setStatus("paused");
            } else if (sceneReadyRef.current) {
                setStatus("ready");
            } else {
                setStatus("loading");
            }
        },
        [renderingEnabled]
    );

    useEffect(
        () => {
            sceneRef.current?.setVisualState(
                visualState
            );
        },
        [visualState]
    );

    useEffect(
        () => {
            if (signal != null) {
                sceneRef.current?.playSignal(
                    signal
                );
            }
        },
        [signal]
    );

    return (
        <div
            ref={stageRef}
            className="broker95-kaplay-stage"
            data-status={status}
            aria-hidden="true"
        >
            <canvas ref={canvasRef} />
            {status === "loading" && (
                <span className="broker95-scene-message">
                    CARGANDO ESCENA…
                </span>
            )}
            {status === "error" && (
                <span className="broker95-scene-message error">
                    VISUAL NO DISPONIBLE
                </span>
            )}
            {status === "paused" && (
                <span className="broker95-scene-message paused">
                    VISUAL EN PAUSA
                </span>
            )}
        </div>
    );
}
