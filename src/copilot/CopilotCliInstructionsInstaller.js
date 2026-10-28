import {
    mkdir,
    readFile,
    writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const COPILOT_INSTRUCTIONS_FILE =
    "clrs.instructions.md";
export const COPILOT_CLRS_APPLY_TO =
    "**/*.clrs";

export function resolveCopilotCliInstructionsPath(
    options = {}
) {
    const environment =
        options.environment ?? process.env;
    const pathApi = options.pathApi ?? path;
    const homeDirectory =
        options.homeDirectory ?? os.homedir();
    const configuredHome =
        typeof environment?.COPILOT_HOME ===
            "string" &&
        environment.COPILOT_HOME.trim().length > 0
            ? environment.COPILOT_HOME.trim()
            : null;
    const copilotHome = configuredHome == null
        ? pathApi.join(
            homeDirectory,
            ".copilot"
        )
        : pathApi.resolve(configuredHome);

    return pathApi.join(
        copilotHome,
        "instructions",
        COPILOT_INSTRUCTIONS_FILE
    );
}

export class CopilotCliInstructionsInstaller {

    constructor(options = {}) {
        if (
            typeof options.canonicalPath !==
                "string" ||
            options.canonicalPath.length === 0
        ) {
            throw new TypeError(
                "canonicalPath is required."
            );
        }

        this.fileSystem =
            options.fileSystem ?? {
                mkdir,
                readFile,
                writeFile
            };
        this.pathApi = options.pathApi ?? path;
        this.canonicalPath =
            options.canonicalPath;
        this.targetPath =
            options.targetPath ??
            resolveCopilotCliInstructionsPath({
                environment:
                    options.environment,
                homeDirectory:
                    options.homeDirectory,
                pathApi: this.pathApi
            });
    }

    async inspect() {
        const expectedContent =
            await this.fileSystem.readFile(
                this.canonicalPath,
                "utf8"
            );
        assertClrsScope(expectedContent);
        const existingContent =
            await readOptionalFile(
                this.fileSystem,
                this.targetPath
            );
        const status = existingContent == null
            ? "missing"
            : existingContent === expectedContent
                ? "current"
                : "different";

        return Object.freeze({
            status,
            targetPath: this.targetPath,
            expectedContent,
            existingContent
        });
    }

    async install(options = {}) {
        const plan = await this.inspect();

        if (plan.status === "current") {
            return result(
                "current",
                plan.targetPath
            );
        }

        const confirm = options.confirm;
        const approved =
            typeof confirm === "function" &&
            await confirm(plan) === true;

        if (!approved) {
            return result(
                "cancelled",
                plan.targetPath
            );
        }

        await this.fileSystem.mkdir(
            this.pathApi.dirname(
                plan.targetPath
            ),
            { recursive: true }
        );
        await this.fileSystem.writeFile(
            plan.targetPath,
            plan.expectedContent,
            "utf8"
        );

        return result(
            plan.status === "missing"
                ? "installed"
                : "updated",
            plan.targetPath
        );
    }
}

function assertClrsScope(content) {
    const frontmatter =
        /^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u
            .exec(content)?.[1] ?? "";
    const applyTo =
        /^applyTo:\s*["']([^"']+)["']\s*$/mu
            .exec(frontmatter)?.[1] ?? null;

    if (applyTo !== COPILOT_CLRS_APPLY_TO) {
        throw new Error(
            "Las instrucciones canónicas de CLRS no limitan applyTo a **/*.clrs."
        );
    }
}

async function readOptionalFile(
    fileSystem,
    filePath
) {
    try {
        return await fileSystem.readFile(
            filePath,
            "utf8"
        );
    } catch (error) {
        if (error?.code === "ENOENT") {
            return null;
        }

        throw error;
    }
}

function result(status, targetPath) {
    return Object.freeze({
        status,
        targetPath
    });
}
