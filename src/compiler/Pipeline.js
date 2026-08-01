import "./utils/ProgramKey.js";

import {
  buildASTFromTokens,
  tokenizeSource,
  tryParseSource
} from "../language/LanguageFrontend.js";
import { formatLanguageError } from "../errors/ErrorFormatter.js";
import { Transpiler } from "./Transpiler.js";
import {
  CompilationService
} from "./services/CompilationService.js";
import {
  fileSystemEmitter
} from "./utils/FileOperations.js";
import {
  nodeProgramRunner
} from "./Launcher.js";

export const compilationService =
  new CompilationService({
    fileEmitter: fileSystemEmitter,
    programRunner: nodeProgramRunner
  });

/**
 * API histórica de tokenización. Devuelve null y reporta el error para
 * conservar el contrato que utilizan los consumidores existentes.
 *
 * @param {string} sourceCode
 * @returns {import("chevrotain").IToken[]|null}
 */
export function tokenizeCode(sourceCode) {
  try {
    return tokenizeSource(sourceCode);
  } catch (error) {
    reportError(error);
    return null;
  }
}

/**
 * API histórica de construcción del AST a partir de tokens.
 *
 * @param {import("chevrotain").IToken[]} tokens
 * @returns {any|null}
 */
export function parserCode(tokens) {
  try {
    return buildASTFromTokens(tokens).ast;
  } catch (error) {
    reportError(error);
    return null;
  }
}

/**
 * Transpila un AST y conserva la instancia para los adaptadores de archivos.
 *
 * @param {any} ast
 * @param {string} absolutePath
 * @param {boolean} runProgram
 * @returns {Promise<Transpiler|null>}
 */
export async function transpileCode(ast, absolutePath, runProgram) {
  const transpiler = new Transpiler(
    absolutePath,
    runProgram,
    {
      fileEmitter:
        compilationService.fileEmitter
    }
  );

  try {
    const artifact =
      await compilationService.compileAST(
        ast,
        absolutePath,
        {
          temporary: runProgram,
          generator: transpiler
        }
      );

    transpiler.lastArtifact = artifact;

    return transpiler;
  } catch (error) {
    reportError(error, "Error de compilación");
    return null;
  }
}

/**
 * Analiza el costo de un AST.
 *
 * @param {any} ast
 * @returns {any|null}
 */
export function costCode(ast) {
  try {
    return compilationService
      .analyzeAST(ast);
  } catch (error) {
    reportError(error, "Error de análisis");
    return null;
  }
}

/**
 * Transpila y ejecuta código CLRS.
 *
 * @param {string} sourceCode
 * @param {string} absolutePath
 */
export async function run(sourceCode, absolutePath) {
  const ast = parseCode(sourceCode);

  if (ast == null) {
    return;
  }

  const transpiler =
    await transpileCode(ast, absolutePath, true);

  if (transpiler == null) {
    return;
  }

  try {
    await compilationService
      .runArtifact(
        transpiler.lastArtifact
      );
  } catch (error) {
    reportError(error, "Error de ejecución");
  }
}

/**
 * Genera JavaScript sin ejecutar el programa.
 *
 * @param {string} sourceCode
 * @param {string} absolutePath
 */
export async function generate(sourceCode, absolutePath) {
  const ast = parseCode(sourceCode);

  if (ast != null) {
    await transpileCode(ast, absolutePath, false);
  }
}

/**
 * Genera el informe de costo del código fuente.
 *
 * @param {string} sourceCode
 * @returns {any|null}
 */
export function cost(sourceCode) {
  const ast = parseCode(sourceCode);

  return ast == null
    ? null
    : costCode(ast);
}

function parseCode(sourceCode) {
  const result = tryParseSource(sourceCode);

  if (!result.ok) {
    reportError(result.errors[0]);
    return null;
  }

  return result.value.ast;
}

function reportError(error, fallbackTitle = null) {
  console.error(
    formatLanguageError(error, fallbackTitle)
  );
}
