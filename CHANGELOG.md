# Change Log

All notable changes to the "clrs-kit-esp" extension will be documented in this file.

## [1.1.1] - 2026-07-05

### Added

- Visual error in the 'else' block when displaying its block.

## [1.1.0] - 2026-07-05

### Added

- Visual bug with the decorator prior to the fix. Working with the costs is still awkward, but it is now correctly visible.

## [1.0.9] - 2026-07-05

### Added

- Time complexity analysis for algorithms.
- CodeLens integration to display cost expressions above functions and control structures.
- Inline cost visualization using editor decorations.
- Toggle button to enable or disable complexity analysis directly from the editor.
- Command to copy generated cost expressions to the clipboard.

## [1.0.8] - 2026-07-02

### Added

- Added README documentation.
- Modified TextMate to highlight logical operations differently.

## [1.0.7] - 2026-07-02

### Added

- Array parameter bug fixed.
- README with complete documentation.

## [1.0.6] - 2026-07-02

### Added

- Bug fix when calling a function within another function.

## [1.0.5] - 2026-07-02

### Added

- Change in README

## [1.0.4] - 2026-07-02

### Added

- VS Code Window added for run code.

## [1.0.3] - 2026-07-02

### Added

- Correction in variable initialization for 'for' loops. It is no longer necessary to define it before.

## [1.0.2] - 2026-07-02

### Added

- Correction in the version.

## [1.0.1] - 2026-07-02

### Added

- Support for CodeLens in using button to run and build.
- Correction in the use of arrays, they are no longer emptied with each access.

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