import { getGuiRuntimeFactorySource } from "../../standard-library/gui/runtime/GuiRuntimeSource.js";

/** Puerto del pipeline: infraestructura prepara dependencia; la biblioteca aporta su fuente. */
export class GuiRuntimePreparation {
    constructor({ dependencyManager, getFactorySource = getGuiRuntimeFactorySource }) {
        this.dependencyManager = dependencyManager;
        this.getFactorySource = getFactorySource;
    }

    async prepare({ semanticModel, signal }) {
        if (!semanticModel.gui?.usage.requiresGui) { return {}; }
        const dependency = await this.dependencyManager.ensure({ signal });
        return { gui: { moduleUrl: dependency.entryUrl, factorySource: await this.getFactorySource(),
            nodeExecutable: dependency.nodeExecutable, gtkVersion: dependency.gtkVersion,
            nodeGtkVersion: dependency.version } };
    }
}
