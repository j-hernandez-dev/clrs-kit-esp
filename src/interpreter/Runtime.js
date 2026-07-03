// run.js

import { tokenize } from "../lexer/Lexer.js";
import { parser } from "../parser/Parser.js";
import { ASTBuilder } from "../ast/builders/ASTBuilder.js"
import { Transpiler } from "./Transpiler.js";
import { executeCodeInteractive } from "./Excecute.js";
import { addIndentationTokens } from "../lexer/Indentation.js";

/**
 * Tokenización
 * @param {string} sourceCode
 * @returns {import("chevrotain").IToken[]}
 */
function tokenizeCode(sourceCode) {
  try {
    let tokens = tokenize(sourceCode);

    tokens = addIndentationTokens(tokens);

    //console.log(tokens);

    return tokens;
  } catch (error) {
    console.error("╔═ Lexicographic Error ══════════════════════════════════════════\n"
      + "\n"
      // @ts-ignore
      + error.stack
      + "\n"
      + "\n═════════════════════════════════════════════════════════════════");
  }

  return null;
}

/**
 * Análisis gramatical (CST) y Construcción (AST)
 * @param {import("chevrotain").IToken[]} tokens
 * @returns {any}
 */
function parserCode(tokens) {
  parser.input = tokens;

  const cst = (/** @type {any} */ (parser)).program();

  if (parser.errors.length > 0) {

    console.error(
      "╔═ Syntactic Error ══════════════════════════════════════════\n"
    );
    for (const error of parser.errors) {
      console.error(error.message);

      if (error.token) {
        console.error(
          `→ Line ${error.token.startLine}, Column ${error.token.startColumn}`
        );
      }

      console.error("");
    }

    console.error(
      "══════════════════════════════════════════════════════════════"
    );

    return null;
  }

  //console.log(JSON.stringify(cst, null, 1));

  const builder = new ASTBuilder(parser);

  const ast = builder.build(cst);

  //console.log(JSON.stringify(ast, null, 4));

  return ast;
}

/**
 * Transpilación
 * @param {any} ast
 * @param {any} build
 */
function transpileCode(ast, build) {
  const transpiler = new Transpiler(build);

  try {

    transpiler.transpile(ast);

    return transpiler;

  } catch (error) {
    console.error("╔═ Transpilation Error ══════════════════════════════════════════\n"
      + "\n"
      // @ts-ignore
      + error.stack
      + "\n"
      + "\n═════════════════════════════════════════════════════════════════");
  }

  return null;
}

/**
 * @param {string} sourceCode
 */
export function run(sourceCode) {

  const tokens = tokenizeCode(sourceCode);

  if (tokens != null) {
    const ast = parserCode(tokens);

    if (ast != null) {
      const transpiler = transpileCode(ast, null);

      if (transpiler != null) {
        executeCodeInteractive(transpiler);
      }
    }
  }
}

/**
 * @param {string} sourceCode
 * @param {any} absolutePath
 */
export function build(sourceCode, absolutePath) {
  const tokens = tokenizeCode(sourceCode);

  const ast = parserCode(tokens);

  if (ast != null) {
    transpileCode(ast, absolutePath);
  }
}