import {
    TerminalUI
} from "./TerminalUI.js";
import {
    TerminalSpinner
} from "./TerminalSpinner.js";

const FAILURE_STATES = new Set([
    "FAILED",
    "INCOMPATIBLE_NODE",
    "MISSING_NATIVE_GTK",
    "INCOMPATIBLE_GTK"
]);

/**
 * Proyecta únicamente los hitos confirmados del aprovisionamiento GUI.
 */
export class GuiRuntimeProgressPresenter {

    constructor(options = {}) {
        this.logger =
            options.logger ?? console;
        this.terminalUI =
            options.terminalUI ??
            new TerminalUI({
                stream:
                    options.stream ??
                    process.stdout,
                environment:
                    options.environment ??
                    process.env
            });
        this.active = false;
        this.platformReady = false;
        this.completed = new Set();
        this.spinner =
            options.spinner ??
            new TerminalSpinner({
                terminalUI:
                    this.terminalUI,
                writeLine: message =>
                    this.write(message),
                scheduler:
                    options.scheduler,
                delayMs:
                    options.spinnerDelayMs,
                intervalMs:
                    options.spinnerIntervalMs
            });
    }

    present(state) {
        if (state === "PLATFORM_READY") {
            this.platformReady = true;

            if (this.active) {
                this.complete(
                    state,
                    "Plataforma compatible"
                );
            }

            return;
        }

        if (state === "INSTALLING") {
            this.start();
            return;
        }

        if (!this.active) {
            return;
        }

        const milestones = {
            DEPENDENCIES_READY:
                "Dependencias preparadas",
            NODE_GTK_READY:
                "node-gtk preparado",
            GTK_READY:
                "GTK disponible"
        };

        if (state === "DEPENDENCIES_READY") {
            this.spinner.stop();
            this.complete(
                state,
                milestones[state]
            );
            return;
        }

        if (
            state === "CHECKING" &&
            this.completed.has(
                "DEPENDENCIES_READY"
            )
        ) {
            this.spinner.start(
                "Comprobando entorno gráfico"
            );
            return;
        }

        if (state === "NODE_GTK_READY") {
            const firstCompletion =
                !this.completed.has(state);

            if (firstCompletion) {
                this.spinner.stop();
                this.complete(
                    state,
                    milestones[state]
                );
                this.spinner.start(
                    "Comprobando GTK"
                );
            }
            return;
        }

        if (state === "GTK_READY") {
            this.spinner.stop();
            this.complete(
                state,
                milestones[state]
            );
            return;
        }

        if (state === "READY") {
            this.spinner.stop();
            this.write(
                this.terminalUI.success(
                    "Entorno gráfico preparado"
                )
            );
            this.reset();
            return;
        }

        if (state === "CANCELLED") {
            this.spinner.stop();
            this.write(
                this.terminalUI.cancellation(
                    "Preparación del entorno gráfico cancelada"
                )
            );
            this.reset();
            return;
        }

        if (FAILURE_STATES.has(state)) {
            this.spinner.stop();
            this.write(
                this.terminalUI.error(
                    "No se pudo preparar el entorno gráfico"
                )
            );
            this.reset();
        }
    }

    start() {
        if (this.active) {
            return;
        }

        this.active = true;
        this.completed.clear();
        this.write([
            this.terminalUI.header(),
            "",
            this.terminalUI.section(
                "Preparando entorno gráfico"
            ),
            this.terminalUI.secondary(
                "Puedes cancelar con Ctrl+C."
            ),
            ""
        ].join("\n"));

        if (this.platformReady) {
            this.complete(
                "PLATFORM_READY",
                "Plataforma compatible"
            );
        }

        this.spinner.start(
            "Preparando dependencias"
        );
    }

    complete(state, message) {
        if (this.completed.has(state)) {
            return false;
        }

        this.completed.add(state);
        this.write(
            this.terminalUI.success(message)
        );
        return true;
    }

    reset() {
        this.spinner.stop();
        this.active = false;
        this.platformReady = false;
        this.completed.clear();
    }

    dispose() {
        this.spinner.dispose?.();
        this.active = false;
        this.platformReady = false;
        this.completed.clear();
    }

    write(message) {
        this.logger.log(message);
    }
}
