import { describeExecutionStep } from "../execution/ExecutionTraceState.js";
import { getDiagramPlaybackNavigation } from "../execution/DiagramPlaybackNavigation.js";

const STATUS_LABELS = Object.freeze({
    idle: "Sin ejecución",
    running: "Ejecutando",
    correct: "Correcto",
    error: "Error",
    cancelled: "Interrumpido"
});

export default function ExecutionToolbar({
    trace,
    onRunCode,
    onStopCode,
    stepIndex,
    isPlaying,
    speed,
    onSpeedChange,
    onFirst,
    onPrevious,
    onTogglePlay,
    onNext,
    onLatest
}) {
    const navigation = getDiagramPlaybackNavigation(
        trace.steps.length,
        stepIndex
    );
    const {
        stepCount,
        displayedStep,
        hasSteps,
        canGoBackward,
        canGoForward
    } = navigation;
    const statusLabel =
        STATUS_LABELS[trace.status] ??
        trace.status;
    const isRunning =
        trace.status === "running";
    const showsLatestStep =
        stepIndex === trace.steps.length - 1;
    const stepDescription = describeExecutionStep(
        showsLatestStep &&
        trace.presentationState
            ? trace.presentationState
            : trace.steps[stepIndex]
    );
    const executionAction =
        isRunning ? onStopCode : onRunCode;
    const executionLabel =
        isRunning
            ? "Detener ejecución de código CLRS"
            : "Ejecutar código CLRS";

    return (
        <div
            className={
                "diagram-execution-toolbar " +
                `execution-status-${trace.status}`
            }
            aria-label="Controles de la ejecución"
        >
            <div className="execution-toolbar-controls">
                <span className="execution-status">
                    <span
                        className="execution-status-dot"
                        aria-hidden="true"
                    />
                    {statusLabel}
                </span>

                <button
                    className={
                        "execution-button " +
                        "execution-run-code-button"
                    }
                    type="button"
                    disabled={
                        !executionAction
                    }
                    aria-label={executionLabel}
                    title={executionLabel}
                    onClick={executionAction}
                >
                    {isRunning ? "■" : "▷"}
                </button>

                <span
                    className="execution-counter"
                    aria-live="polite"
                    title={
                        trace.truncated
                            ? `Traza limitada a ${trace.maxSteps} pasos`
                            : undefined
                    }
                >
                    Paso {displayedStep}/{stepCount}
                    {trace.truncated ? " · limitada" : ""}
                </span>

                <PlaybackActions
                    hasSteps={hasSteps}
                    canGoBackward={canGoBackward}
                    canGoForward={canGoForward}
                    isPlaying={isPlaying}
                    onFirst={onFirst}
                    onPrevious={onPrevious}
                    onTogglePlay={onTogglePlay}
                    onNext={onNext}
                    onLatest={onLatest}
                />

                <select
                    className="execution-speed"
                    value={speed}
                    aria-label="Velocidad de reproducción"
                    title="Velocidad de reproducción"
                    onChange={event =>
                        onSpeedChange(
                            Number(
                                event.target.value
                            )
                        )
                    }
                >
                    <option value={900}>0.5×</option>
                    <option value={500}>1×</option>
                    <option value={250}>2×</option>
                </select>
            </div>

            {stepDescription && <span className="execution-flow-description" role="status">{stepDescription}</span>}
        </div>
    );
}

function PlaybackActions({
    hasSteps,
    canGoBackward,
    canGoForward,
    isPlaying,
    onFirst,
    onPrevious,
    onTogglePlay,
    onNext,
    onLatest
}) {
    return (
        <div className="execution-actions">
            <button
                className="execution-button"
                type="button"
                disabled={!canGoBackward}
                aria-label="Primer paso"
                title="Ir al inicio"
                onClick={onFirst}
            >
                |←
            </button>
            <button
                className="execution-button"
                type="button"
                disabled={!canGoBackward}
                aria-label="Paso anterior"
                title="Paso anterior"
                onClick={onPrevious}
            >
                ←
            </button>
            <button
                className="execution-button execution-play-button"
                type="button"
                disabled={!hasSteps}
                aria-label={
                    isPlaying
                        ? "Pausar ejecución"
                        : "Reproducir ejecución"
                }
                title={
                    isPlaying
                        ? "Pausar"
                        : "Reproducir"
                }
                onClick={onTogglePlay}
            >
                {isPlaying ? "Ⅱ" : "▶"}
            </button>
            <button
                className="execution-button"
                type="button"
                disabled={!canGoForward}
                aria-label="Paso siguiente"
                title="Paso siguiente"
                onClick={onNext}
            >
                →
            </button>
            <button
                className="execution-button"
                type="button"
                disabled={!canGoForward}
                aria-label="Último paso"
                title="Seguir la ejecución en vivo"
                onClick={onLatest}
            >
                →|
            </button>
        </div>
    );
}
