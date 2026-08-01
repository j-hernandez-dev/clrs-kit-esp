import {
    requireFunction,
    requirePort
} from "../../../src/application/ports/ApplicationPorts.js";

export const DiagramModelStatus =
    Object.freeze({
        IDLE: "idle",
        LOADING: "loading",
        READY: "ready",
        ERROR: "error"
    });

/**
 * Estado de aplicación independiente de React.
 */
export class DiagramModelStore {

    constructor(options = {}) {
        this.generateDiagramUseCase =
            requirePort(
                options
                    .generateDiagramUseCase,
                "generateDiagramUseCase",
                ["execute"]
            );
        this.defaultDiagramFactory =
            requireFunction(
                options
                    .defaultDiagramFactory,
                "defaultDiagramFactory"
            );
        this.listeners = new Set();
        this.lastValidModel =
            this.defaultDiagramFactory();
        this.state = this.createState({
            status:
                DiagramModelStatus.IDLE,
            sourceCode: "",
            model: this.lastValidModel,
            ast: null,
            errors: []
        });
    }

    getState = () => this.state;

    subscribe = listener => {
        this.listeners.add(listener);

        return () => {
            this.listeners.delete(listener);
        };
    };

    setSource(sourceCode) {
        this.updateState({
            ...this.state,
            status:
                DiagramModelStatus.LOADING,
            sourceCode,
            errors: []
        });

        const result =
            this.generateDiagramUseCase
                .execute({ sourceCode });

        if (!result.ok) {
            this.updateState({
                status:
                    DiagramModelStatus.ERROR,
                sourceCode,
                model: this.lastValidModel,
                ast: null,
                errors: result.errors
            });

            return this.state;
        }

        const {
            ast,
            diagram,
            empty
        } = result.value;

        this.lastValidModel = diagram;
        this.updateState({
            status:
                empty
                    ? DiagramModelStatus.IDLE
                    : DiagramModelStatus.READY,
            sourceCode,
            model: diagram,
            ast,
            errors: []
        });

        return this.state;
    }

    updateState(nextState) {
        this.state =
            this.createState(nextState);

        for (const listener of this.listeners) {
            listener(this.state);
        }
    }

    createState(state) {
        return Object.freeze({
            ...state,
            errors: Object.freeze([
                ...(state.errors ?? [])
            ])
        });
    }
}
