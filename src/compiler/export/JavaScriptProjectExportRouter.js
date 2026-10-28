import { CliJavaScriptProjectExporter } from "./CliJavaScriptProjectExporter.js";
import { JavaScriptExportError } from "./JavaScriptExportError.js";
import { JavaScriptExportProfiles } from "./JavaScriptExportProfile.js";
import { JavaScriptProjectExporter } from "./JavaScriptProjectExporter.js";

/**
 * Frontera única de exportación permanente con implementaciones transaccionales
 * separadas para CLI y GUI.
 */
export class JavaScriptProjectExportRouter {
    constructor(options = {}) {
        this.cliExporter = options.cliExporter ?? new CliJavaScriptProjectExporter(options);
        this.guiExporter = options.guiExporter ?? new JavaScriptProjectExporter(options);
    }

    async export(artifact, options = {}) {
        if (!artifact || artifact.temporary || !artifact.exportProfile) {
            throw new JavaScriptExportError("INVALID_PROFILE");
        }
        if (artifact.exportProfile === JavaScriptExportProfiles.CLI) {
            if (artifact.requiredCapabilities?.includes("gui") || artifact.guiBindingSpecifier
                || artifact.runtimeNodeCommand) {
                throw new JavaScriptExportError("PRIVATE_PATH_LEAK");
            }
            return this.cliExporter.export(artifact, options);
        }
        if (artifact.exportProfile === JavaScriptExportProfiles.GUI) {
            if (!artifact.requiredCapabilities?.includes("gui")) {
                throw new JavaScriptExportError("INVALID_PROFILE");
            }
            return this.guiExporter.export(artifact, options);
        }
        throw new JavaScriptExportError("INVALID_PROFILE");
    }
}
