// BrowserPipeline.js

import "./utils/ProgramKey.js";

import { tokenize } from "../lexer/Lexer.js";
import { addIndentationTokens } from "../lexer/Indentation.js";
import { parser } from "../parser/Parser.js";
import { ASTBuilder } from "../ast/builders/ASTBuilder.js";

function printError(type, error) {
    const width = 60;
    const title = ` ${type} `;
    const filling = "═".repeat(width - title.length - 1);

    console.error(
        `╔═${title}${filling}╗\n` +
        `\n` +
        // @ts-ignore
        `${error.stack}\n` +
        `\n` +
        `╚${"═".repeat(width)}╝`
    );
}

function printParserError(type, errors) {
    const width = 60;
    const title = ` ${type} `;
    const filling = "═".repeat(width - title.length - 1);

    console.error(`╔═${title}${filling}╗\n`);

    for (const error of errors) {
        console.error(error.message);

        if (error.token) {
            console.error(
                `→ Line ${error.token.startLine}, Column ${error.token.startColumn}`
            );
        }

        console.error("");
    }

    console.error(`╚${"═".repeat(width)}╝`);
}

/**
 * Tokenización
 * @param {string} sourceCode
 * @returns {import("chevrotain").IToken[]}
 */
export function tokenizeCode(sourceCode) {
  try {
    let tokens = tokenize(sourceCode);

    tokens = addIndentationTokens(tokens);

    //console.log(tokens);

    return tokens;
  } catch (error) {
    printError("Lexicographic Error", error);
  }

  return null;
}

/**
 * Análisis gramatical (CST) y Construcción (AST)
 * @param {import("chevrotain").IToken[]} tokens
 * @returns {any}
 */
export function parserCode(tokens) {
  parser.input = tokens;

  const cst = (/** @type {any} */ (parser)).program();

  if (parser.errors.length > 0) {

    printParserError("Syntactic Error", parser.errors);

    return null;
  }

  //console.log(JSON.stringify(cst, null, 1));

  const builder = new ASTBuilder(parser);

  const ast = builder.build(cst);

  //console.log(JSON.stringify(ast, null, 4));

  return ast;
}

/**
 * @param {string} sourceCode
 */
export function getAST(sourceCode) {
  const tokens = tokenizeCode(sourceCode);

  if (tokens != null) {
    const ast = parserCode(tokens);

    return ast;
  }

  return null;
}