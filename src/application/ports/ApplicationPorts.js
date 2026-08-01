import {
    ApplicationError
} from "../../errors/ApplicationError.js";

/**
 * @typedef {{
 *   tryRunSource(sourceCode: string, sourcePath: string): Promise<object>,
 *   tryCompileSource(sourceCode: string, sourcePath: string, options?: object): Promise<object>,
 *   analyzeSource(sourceCode: string): object
 * }} CompilationPort
 */

/**
 * @typedef {{
 *   buildFromSource(sourceCode: string): object
 * }} DiagramGenerationPort
 */

/**
 * @typedef {{
 *   read(sourcePath: string): Promise<string>
 * }} SourceFileReaderPort
 */

/**
 * @typedef {{
 *   present(result: object, options?: object): *
 * }} ResultPresenterPort
 */

/**
 * Valida un puerto al construir la aplicación. De este modo, una dependencia
 * incompleta falla en la raíz de composición y no durante una acción.
 *
 * @template T
 * @param {T} dependency
 * @param {string} name
 * @param {string[]} methods
 * @returns {T}
 */
export function requirePort(
    dependency,
    name,
    methods
) {
    const missingMethods =
        methods.filter(
            method =>
                typeof dependency?.[method] !==
                "function"
        );

    if (missingMethods.length > 0) {
        throw ApplicationError.configuration(
            name,
            missingMethods
                .map(method => `${method}()`)
                .join(", ")
        );
    }

    return dependency;
}

/**
 * @template T
 * @param {T} dependency
 * @param {string} name
 * @returns {T}
 */
export function requireFunction(
    dependency,
    name
) {
    if (typeof dependency !== "function") {
        throw ApplicationError.configuration(
            name,
            "a function"
        );
    }

    return dependency;
}

/**
 * @template T
 * @param {T} dependency
 * @param {string} name
 * @returns {T}
 */
export function requireObject(
    dependency,
    name
) {
    if (
        dependency === null ||
        typeof dependency !== "object"
    ) {
        throw ApplicationError.configuration(
            name,
            "an object"
        );
    }

    return dependency;
}
