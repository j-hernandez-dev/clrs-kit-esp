# Change Log

All notable changes to the "clrs-kit-esp" extension will be documented in this file.

## [Unreleased]

## [1.3.1] - 2026-07-31

- Read statement fixed

## [1.3.0] - 2026-07-31

- Added Spanish lexer and parser diagnostics with deduplicated expected-token alternatives.
- Added localized semantic, compilation, and runtime presentation.
- Added a minimal CLRS Runtime error layout with Spanish execution states.
- Separated user-facing diagnostics from English implementation details and development logs.
- Added `CLRS_DEBUG=1` support for native runtime stacks and causes.
- Added live lexer, indentation, parser, and semantic diagnostics for CLRS documents in VS Code.
- Added Spanish inline error messages, source ranges, stable error codes, and automatic cleanup after corrections.
- Added debounce and document-version guards so stale analyses cannot overwrite current diagnostics.
- Fixed indentation analysis so tabs use four-column tab stops and can align with spaces.
- Treated indentation inside parentheses and brackets as expression continuation instead of nested blocks.
- Improved inconsistent-indentation diagnostics with actual and expected indentation levels.
- Added an immutable algebraic model for cost expressions, including sums, products, powers, logarithms, calls, maxima, equations, recurrences, and unknown costs.
- Migrated cost analysis and standard-library substitutions to the structured model while preserving the existing editor output.
- Added a conservative algebraic simplifier and non-enumerable structured metadata to cost report nodes.
- Added characterization tests for conditionals, loops, library costs, formatting, simplification, and legacy JSON compatibility.
- Added ordered symbolic-value tracking for loop bounds and initial values.
- Added semantic iteration analysis for ascending and descending `para` loops.
- Added additive and multiplicative progression recognition for `mientras`, including logarithmic division and multiplication patterns.
- Added conservative unknown iteration results when control updates, bounds, steps, or termination cannot be demonstrated.
- Integrated inferred iteration expressions and non-enumerable iteration metadata into cost reports.
- Added a conservative asymptotic classifier for constants, logarithms, polynomials, exponentials, factorials, sums, products, quotients, and maxima.
- Added dominant-term reduction with support for incomparable multivariable growth terms.
- Added non-recursive inter-function cost resolution and explicit `O(?)` results for unresolved recurrences.
- Added non-enumerable Big O metadata to cost nodes and reports.
- Displayed cost expressions in CodeLens and Big O classifications in editor decorators.
- Added symbolic recursive-call argument tracking and exposed real parameters and arguments in cost expressions.
- Added recurrence size inference for single parameters and interval measures such as `r - p + 1`.
- Added recurrence solving by substitution, the Master theorem, Akra–Bazzi, characteristic roots, and factorial products.
- Added structured, non-enumerable recurrence results and conservative `O(?)` reasons for unsupported reductions and mutual recursion.
- Moved Big O from CodeLens to end-of-line decorators, reusing the `⟶ O(...)` style of individual costs.
- Preserved source parameter names in cost-function signatures, such as `TBURBUJA(A)`.
- Normalized structural measures such as `LONG(A)` to `n`, `m`, and subsequent aliases only in Big O output.
- Added a shared declarative standard-library catalog for costs, return types, and symbolic effects.
- Migrated semantic built-ins, library cost substitutions, recurrence rounding rules, size normalization, and asymptotic calls to the shared catalog.
- Recognized `PISO` and `REDONDEA` around additive or multiplicative loop updates, including `PISO(i / 2)` as logarithmic.
- Added domain-guarded symbolic handling for `ABS` and preserved `O(?)` for functions without a declared safe transformation.
- Fixed flowchart label sizing after web-font loading and preserved complete compound loop bounds such as `n - 1`.
- Replaced PNG flowchart export with standalone SVG export using native SVG text instead of browser-only HTML labels.
- Removed the theme-colored seam around the flowchart webview by applying the selected canvas background to every root layer.
- Made Mermaid measure long labels with the same wrapping constraints used by their symbols.
- Normalized double-encoded label entities in standalone SVG exports.
- Added a theme-independent dotted workspace grid to the flowchart preview.
- Added an adaptive flowchart theme that resolves the active VS Code palette and is selected by default.
- Added live light, dark, and high-contrast theme synchronization using portable hexadecimal colors.
- Integrated VS Code dropdown colors into the flowchart toolbar.
- Updated the extension metadata, README, package manifests, and license declaration for version 1.3.0.

## [1.2.9] - 2026-07-22

- Visual correction for conditional structure edge labels.

## [1.2.8] - 2026-07-22

- Fixed "Not" expression bug.
- Sentence !, &&, || denormalized from the AST, now they look Not, Y, O.
- Eliminated question marks from the decision symbol.
- The global flow is now generated as a subgraph when there is at least one function.

## [1.2.7] - 2026-07-21

## Added

- Mermaid-based flowchart generation directly from the compiler AST.
- Interactive flowchart preview integrated into the VS Code editor.
- Live diagram synchronization with active document and text selection changes.
- Automatic function grouping using Mermaid subgraphs.
- Support for custom Mermaid themes and node styling.
- Configurable flow direction (Top-to-Bottom / Left-to-Right).
- Interactive pan, zoom, automatic fit, and centering controls.
- High-resolution PNG export for generated flowcharts.

## [1.2.6] - 2026-07-16

### Added

- Mainly structural changes in the overall project architecture to improve overall cohesion.  
- The compiler pipelining now supports files with any extension, as long as the language grammar is maintained.  
- A global variable "ProgramKey" was added, which allows generating the user's program and runtime structures with a random identifier. This is to avoid runtime identifier collisions.  
- The terminal output was visually modified; it now shows the running file and the program's status with a single word.  
- Menu items were added to the top bar in VS Code. Cost expressions no longer overlap with previous buttons.  
- Standard file paths are now used with support for different file systems.  
- In the command to run code, it now clears the previous execution before running.

## [1.2.5] - 2026-07-09

- Remove directory screenshots.

## [1.2.4] - 2026-07-09

- Language configuration fix.
- Screenshots added to README.
- Improved TextMate scope configuration.
- Minor change to the main function definition.

### Added

- Fix in a standard library function.

## [1.2.3] - 2026-07-08

### Added

- Fix in a standard library function.

## [1.2.2] - 2026-07-08

### Added

- Fix in a standard library function.

## [1.2.1] - 2026-07-08

### Added

- Change in error message generation.
- Visual fix of cost expressions in line instructions.
- Expansion in the TextMate grammar scope (textMate now looks better in certain visual themes).
- Removal of two redundant functions and change of function names to shorter versions.
- Slight adjustment in the language configuration.

## [1.2.0] - 2026-07-07

### Added

- Lexer fix on numberLiterals. 

## [1.1.9] - 2026-07-07

### Added

- Fix error on library function.

## [1.1.8] - 2026-07-07

### Added

- Fix error on library function.
- 
## [1.1.7] - 2026-07-07

### Added

- Fix error on library function.

## [1.1.6] - 2026-07-07

### Added

- Errors throwing now have a snippet file.

## [1.1.5] - 2026-07-06

### Added

- Added validation for type values, type conversion and manual error throwing.

## [1.1.4] - 2026-07-06

### Added

- README updated with information on the cost functionality, its limitations, and the scope of the tool

## [1.1.3] - 2026-07-06

### Added

- The complete expressions for each block are shown.

## [1.1.2] - 2026-07-05

### Added

- Visual error in the 'else' block when displaying its block.

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
