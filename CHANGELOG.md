# Change Log

All notable changes to the "clrs-kit-esp" extension will be documented in this file.

## [1.0.0] - 2026-07-02

### Added

- Initial release of the CLRS Kit Español extension.
- Complete lexer implemented with Chevrotain.
- Complete recursive-descent parser built with Chevrotain grammar rules.
- Automatic generation of an Abstract Syntax Tree (AST).
- JavaScript transpiler based on the generated AST.
- Runtime capable of executing transpiled JavaScript code.
- Command to transpile CLRS source code into JavaScript without executing it.
- Command to execute CLRS programs directly from Visual Studio Code.
- Integrated runtime with standard library.
- Built-in support for dynamic arrays and multidimensional arrays.
- Automatic indentation handling through INDENT/DEDENT token generation.
- Full expression parser with operator precedence.
- Support for arithmetic, relational and logical expressions.
- Support for function declarations.
- Support for function calls.
- Support for implicit variable declarations through assignment.
- Support for one-dimensional and multidimensional array access.
- Support for conditional statements (`si`, `sino`, `sino si`).
- Support for `mientras` loops.
- Support for `para ... hasta`.
- Support for `para ... bajando`.
- Support for `retornar`.
- Support for input (`leer`).
- Support for output (`escribir`).
- Built-in standard library for:
  - File manipulation.
  - Mathematical functions.
  - String manipulation.
  - Array manipulation.
- Custom syntax highlighting using TextMate grammar.
- Custom language configuration for Visual Studio Code.
- Automatic indentation rules.
- Code folding support.
- Auto-closing bracket and quote support.
- Comment support.
- CLRS snippets for:
  - Control flow.
  - Functions.
  - Input/output.
  - Assignments.
  - Arrays.
  - Standard library.
- VS Code commands integrated through `extension.js`.
- Syntax error reporting.
- Language error reporting.
- Transpiler error reporting.