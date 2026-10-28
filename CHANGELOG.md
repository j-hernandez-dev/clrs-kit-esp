# Change Log

All notable changes to the "clrs-kit-esp" extension will be documented in this file.

## [Unreleased]

## [2.0.4] - 2026-09-17

- Preserved the canonical CLRS literals `VERDAD` and `FALSO` in flowchart labels and editable node values. Accepting an unchanged assignment, condition, loop or return no longer reintroduces the invalid presentation-only words `Verdadero` or `Falso` into source code.
- Added regressions for diagram rendering, normalized execution playback and the complete edit-and-accept round trip of both logical literals.
- Synchronized release metadata and generated the publicable 2.0.4 VSIX.

## [2.0.3] - 2026-09-16

- Added an explicit semantic CLI export profile for programs without GUI usage. **Generate JavaScript** now publishes a canonical three-file npm project under `app/<program>/`, while GUI exports retain their specialized five-file contract.
- Added a canonical CLI manifest for direct `npm start` and host-native `@yao-pkg/pkg` builds, plus strict npm v3 lock validation that rejects missing, orphaned, local, weak-integrity or GUI-only dependencies.
- Routed CLI and GUI exports through the shared transactional staging, locking, backup, cancellation and atomic-publication infrastructure without introducing GUI helpers, `node-gtk`, bootstrap or packable assets into CLI projects.
- Differentiated the native Output-channel guidance by profile while preserving the common `npm ci`, `npm start`, `build:win` and `build:unix` workflow and the warning about external resources.
- Added a deterministic CLI export corpus and opt-in native installation/build checks. The preserved Windows x64 / Node 24 evidence validates relocation, `npm ci`, normal execution and an isolated executable with stdin, stdout, stderr, arguments and exit codes intact.
- Updated the technical and user documentation with the final CLI/GUI project structures, manifests, lockfiles, platform requirements, build outputs and verified portability limits.
- Split project creation into explicit CLI and GUI commands. Both create only `programa.clrs` and `programa.clrs-tests.json`; the CLI and standalone program templates now start from a single `¡Hola mundo!` instruction with an exact-text test, while the GUI project uses the canonical introductory interface and its own suite.
- Synchronized release metadata and generated the publicable 2.0.3 VSIX.

## [2.0.2] - 2026-09-15

- Moved permanent JavaScript exports from `dist/<program>/` to `app/<program>/` through one immutable project identity shared by console and GUI exports, while preserving temporary and legacy compilation paths.
- Added a versioned canonical `node-gtk` loading region and a deterministic `pkg` adaptation that uses the bootstrap loader first while retaining the normal Node resolution, probe and import as fallback.
- Added a canonical generator for the self-contained `prepare-packable.cjs`, with dynamic project names, platform and path validation, source-preservation checks, deterministic regeneration and explicit failure codes.
- Added a canonical generator for the self-contained `bootstrap.cjs`, including dynamic ABI/platform binding discovery, validated runtime extraction beside the executable, GTK environment setup, narrow `node_gtk.node` redirection and ordered packable startup.
- Added a centralized portable npm contract for `@yao-pkg/pkg`, deterministic host build scripts, native binding assets, full runtime/development lock validation, and metadata-only lock generation with development dependencies included.
- Integrated the portable GUI project as one transactional five-file export, validating both generated helpers, the complete manifest and npm lock before atomically replacing any previous project.
- Added the versioned deterministic portable-export corpus, covering canonical identities, GUI/non-GUI boundaries, the five-file transaction, normal startup, idempotent packable preparation, cross-project isolation and failure atomicity without requiring network or native GTK.
- Strengthened the opt-in portable installation check to run a real `npm ci`, reject blocked `node-gtk` install scripts, verify the native binding and `@yao-pkg/pkg` CLI, preserve the lock and generated sources, and prove that `npm start` still runs only the normal entry without creating packable or build artifacts.
- Added opt-in host-native portable builds for Windows, Linux and macOS, fixed the `pkg` VM boundary with a marker-driven CommonJS packable header and asynchronous bootstrap evaluator, and validated first-run GTK extraction plus byte-identical second-run reuse on Windows x64.
- Consolidated the portable-export documentation around the final `app` source contract, five-file GUI project, normal and packaged execution paths, host-only platform matrix, native evidence and verified limitations.
- Synchronized release metadata and generated the publicable 2.0.2 VSIX.

## [2.0.1] - 2026-09-15

- Moved **Instalar soporte para Copilot CLI** from the Create menu to a separate group in the Start menu and documented the command in the public command table.
- Unified permanent JavaScript exports under `dist/<program>/` for console and GUI programs. Public folder and entry-file names are now portable, readable, and omit the internal program-key suffix; console exports still contain only JavaScript, while GUI exports retain their exact npm project contract.
- Added regressions for the new menu placement, separator, clean GUI names, common output layout, and unchanged private temporary-artifact behavior.
- Synchronized package metadata and release documentation and generated the publicable 2.0.1 VSIX.

## [2.0.0] - 2026-09-15

- Defined a single deterministic visual-execution contract for flowcharts. The Webview now derives an immutable normalized visual sequence from the real runtime trace and existing diagram model; the runtime, DAP, coverage, GUI callbacks, and CLRS semantics remain unchanged.
- Made global `Inicio`, every function entry, every reached loop control, natural function/global `Fin`, and explicit `Retornar` first-class playback steps. `para` distinguishes preparation from condition evaluation on every iteration, while `mientras` records each condition evaluation and follows only the taken entry, back-edge, or exit path.
- Resolved function completion by execution context and call frame. Nested, repeated, recursive, conditional, expression, and loop calls return directly to their caller continuation without replaying the call site or function declaration.
- Unified the counter, navigation, automatic playback, active node, visited nodes, and traversed edges over the same normalized sequence. Rewinding now reconstructs state from a sequence prefix, and animations consume resolved transitions without choosing control flow.
- Synchronized the pan-and-zoom viewport before centering the active node, so resized VS Code panels no longer require using **Fit visible flow** first.
- Corrected synthetic-terminal and branch convergence generation so `Fin` closes only a real execution scope. Branches and false loop exits retain their exterior continuation, explicit returns terminate their frame immediately, and untaken branches or loop edges are never marked.
- Added the versioned A–Q visual-execution corpus plus focused regressions for exact node and edge order, ascending and descending loops, zero iterations, natural and explicit returns, nested and repeated calls, recursion, truncation, cancellation, errors, manual/automatic playback, and deterministic rewind.
- Updated technical and release documentation for the 2.0.0 execution-visualization contract and synchronized package metadata, lockfile, and the README version.

## [1.9.9] - 2026-09-14

- Fixed flowchart branch analysis so a nested conditional whose paths all return no longer creates a disconnected merge point. Empty or genuinely continuing branches retain their normal convergence nodes.
- Added function-entry and function-return events to regular terminal execution traces, allowing implicit function completion after branches or loops to mark the existing edge into `Fin` and the terminal itself without inventing a CLRS return statement.
- Added regressions for the calculator-style nested `sino si` chain, valid edge endpoints, bounded runtime flow events, and implicit `PRINCIPAL` completion after a loop.

## [1.9.8] - 2026-09-14

- Renamed the Copilot CLI action to **Instalar soporte para Copilot CLI** in the Command Palette and Create menu.
- Removed the explicit secondary cancellation action from the native modal so VS Code renders only its single built-in Cancel button.
- Added a native visual separator between **Depurar código CLRS** and **Generar código JavaScript** in the Execute menu.

## [1.9.7] - 2026-09-14

- Added a canonical CLRS specification for AI assistants, derived from the language implementation, public libraries, examples, and tests. It covers valid syntax, minimal diagnostic correction, standard functions, GUI API, and prevents unrelated pseudocode constructs from being suggested as CLRS.
- Registered that specification through VS Code `contributes.chatInstructions`, scoped to the actual `clrs-es` language identifier so Copilot Chat receives it only while a CLRS editor is active.
- Added the optional **CLRS: Instalar soporte para Copilot CLI** command to the Command Palette and Create menu. It uses native VS Code confirmation and idempotently copies the same specification to the Copilot personal instructions directory, respecting `COPILOT_HOME` and preserving a differing user file unless an update is accepted.
- Restricted Copilot CLI instructions with `applyTo: "**/*.clrs"`; no Copilot installation, authentication, package download, or configuration of other instruction files is performed.
- Added deterministic coverage for canonical instructions, VS Code registration, VSIX inclusion, Windows/POSIX path resolution, fresh/current/different CLI installation states, cancellation, accepted update, and write failure.

## [1.9.6] - 2026-09-14

- Centralized the integrated CLI terminal presentation: consistent symbols, discreet ANSI colors, clean redirected output, and `NO_COLOR` support. Student output and interactive input retain their existing channels.
- Added monotonic elapsed time for the generated JavaScript process, from successful process spawn to closure, excluding compilation, GUI provisioning, and temporary-file cleanup. Startup and compilation failures do not report a fictitious execution time.
- Added lazy GUI preparation milestones and a delayed, single-line spinner with cleanup on completion, failure, and cancellation. Existing valid runtimes remain silent. The byte-based progress bar is tested as an internal primitive; npm exposes no reliable download total and uses indeterminate progress.
- Added integrated terminal regressions to the release gate for execution, input, diagnostics, cancellation, timing, TTY/color policy, GUI preparation, and animation cleanup.
- Corrected presentation of readline Ctrl+C cancellation while preserving exit codes, kept fatal signals classified as errors, released spinner resources on disposal, and deferred the node-gtk success milestone until the native probe succeeds.

## [1.9.5] - 2026-09-14

- Added the structural global `Inicio` as the first diagram playback step without modifying the runtime trace: the counter, active focus, playback order, and executed projection now agree before the first CLRS instruction.
- Restored explicit return labels to the single-line form `Retornar expresión` in the editable diagram and standalone SVG export.

## [1.9.4] - 2026-09-14

- Centró las etiquetas de retorno del diagramador en líneas independientes, manteniendo `Retornar` y la expresión devuelta alineados dentro de la figura y en la exportación SVG.
- Ajustó la secuencia visual de reproducción a 250 ms para la velocidad `2×`, conservando la misma política para el avance automático y manual.

## [1.9.3] - 2026-09-14

- Replaced the diagram export glyph with `⤒` while preserving the existing SVG export action.
- Adapted the playback pulse and arrival flash to the selected speed: 650 ms at 0.5×, 450 ms at 1×, and 350 ms at 2×. Manual stepping and automatic playback share the same timing policy without affecting program execution.
- Completed implicit function and global `Fin` nodes from real return and successful trace completion. Their existing terminal borders and incoming structural edges now receive the normal executed state without adding artificial trace steps or marking untaken paths.
- Added regressions for linear completion, implicit and explicit function returns, caller resumption, branches, loops, all playback speeds, cancellation, and the export glyph.

## [1.9.2] - 2026-09-13

- Reordered the editor actions to Run, Analysis, Diagram, BROKER.95, Create, and Start. Added an export button after Save in the diagram toolbar, followed by a separator, using the existing SVG export pipeline.
- Made node and arrow glows fade in and out from the first frame, including errors and source navigation. Arrow hover preserves the themed or executed color and widens visited connections as well. Selected figures retain their glow, and selected connections use marching ants while their editor is open.
- Highlighted the implicit global `PRINCIPAL()` call during execution without changing source navigation. Playback now projects observed connections onto existing paths and adds a 650 ms traveling pulse with a brief arrival flash; live execution timing and trace data remain unchanged. Transient effects respect reduced motion and are excluded from the minimap and exported SVG.
- Added regression coverage for execution projection, branch/context separation, animation duration, cancellation, reduced motion, selection styles, and action order.

## [1.9.1] - 2026-09-12

- Fixed GUI JavaScript exports so their generated `package.json` explicitly authorizes only `node-gtk@4.1.1` through npm's pinned `allowScripts` policy. The manifest is written before lockfile generation, allowing a clean `npm ci` to run the native install script without manual approvals or global npm configuration.
- Added export regressions for the exact approval, the real lockfile dependency pin, and the unchanged no-GUI single-file path. Documented the npm policy and the deterministic `npm ci` → `npm start` workflow.

## [1.9.0] - 2026-09-11

- Added the CLRS GUI standard library: 24 components and 61 functions for windows, controls, images, lists, tables, containment, themes, events, and asynchronous alert/file dialogs. Components use session-local string IDs, validated properties and callbacks, and the canonical `NULO` literal.
- Added private, transactional provisioning of `node-gtk@4.1.1`, isolated Node/GTK/GSettings validation, one bounded repair, cancellation and rollback. GUI requires GTK 4.10 or newer; CLRS does not install native system packages, load the addon in the Extension Host, or introduce multimedia requirements.
- Integrated GUI semantics, JavaScript generation, completion, signatures, hover, highlighting, snippets, formatting, DAP callbacks and waits, and flowchart trace playback while preserving the original program structure.
- Added GUI cost models with explicit limits for native state, external resources and human waits. Functional tests and BROKER.95 share the execution pipeline, retain observed coverage, and distinguish infrastructure failures from incorrect student solutions.
- Made **Generate JavaScript** export either one JavaScript file for console programs or a standalone three-file npm project for GUI programs, with a real lockfile, transactional replacement, local binding resolution and no dependency on VS Code.
- Added the integral GUI acceptance corpus, reproducible native checks, and a Windows/Linux/macOS CI matrix for Node 22/24/26. Native evidence identifies its exact platform and versions; other native combinations remain unverified until those checks run there.
- Modularized technical documentation under `docs/`, incorporated the four normative GUI sources into the repository, added the public GUI reference, and excluded technical documentation and private/native test artifacts from the VSIX.

## [1.8.1] - 2026-09-09

- Made BROKER.95 learning-route statistics respond to their own card width. Progress counts, earned amounts, and bars now reorganize into additional rows when space is constrained instead of crossing the card boundary.
- Made the **PROBAR SEÑAL** audio action move to a full-width row in narrow settings panels, with the remaining audio controls reorganizing again at smaller widths to preserve spacing and readability.
- Added Webview regressions for both responsive layouts and updated the package metadata and only the version reference in the public README for 1.8.1.

## [1.8.0] - 2026-09-09

- Made the BROKER.95 lesson detail respond to the actual learning-panel width. Constrained split views now stack the lesson body before the auxiliary cards, arrange the sidebar as two columns when possible, and collapse it to one column at narrower widths without overlap or horizontal displacement.
- Replaced Groq's catalog-only connection check with a minimal Chat Completions request that verifies the configured credential, namespaced model identifier, and account access together. Added precise authentication, quota, and unavailable-model classification, including a bounded Qwen 3 probe that does not spend its response budget on reasoning.
- Hardened remote-provider checks where their official protocols required it: Together AI now proves chat capability through inference, Gemini validates `generateContent` support and HTTP 400 invalid-key details, OpenRouter rejects errors embedded in partial choices, and Z.AI recognizes its business codes and abnormal finish reasons. OpenAI, DeepSeek, xAI, and Hugging Face retained their existing request paths after verification.
- Updated package metadata, technical documentation, and only the version reference in the public README for 1.8.0.

## [1.7.9] - 2026-09-08

- Fixed ambiguous function parsing so a declaration is identified from its header and following indentation without speculatively parsing its complete body. Syntax errors inside a function now retain their actual message, location, and parser rule path instead of being replaced by a misleading unexpected `<INDENT>` diagnostic.
- Added regressions for malformed function bodies and verified that valid declarations, nested calls, and ambiguous call syntax preserve their existing behavior.
- Updated package metadata and the README version for 1.7.9.

## [1.7.8] - 2026-09-05

- Fixed Groq connection checks for namespaced model IDs such as `qwen/qwen3.6-27b`. BROKER.95 now validates the configured model against Groq's active model catalog rather than constructing an individual model URL whose path handling can reject IDs containing `/`.
- Updated xAI connection checks to use its language-model catalog, which exposes model aliases, instead of the simplified OpenAI-compatible list that can omit them. Regression coverage now exercises real catalog shapes, unavailable or inactive Groq models, malformed catalogs, model IDs with namespaces, and all supported remote-provider transport paths.
- Reviewed OpenAI, Gemini, DeepSeek, Groq, xAI, and OpenRouter request formats, authentication boundaries, model verification, error classification, retries, streaming, cancellation, and timeouts. Updated package metadata and the README version for 1.7.8.

## [1.7.7] - 2026-09-05

- Hardened remote OpenAI-compatible connection checks by accepting Together AI's direct model catalog as well as the standard `data` envelope, and by giving bounded inference probes enough output budget for models that emit preliminary reasoning instead of reporting a false connection failure.
- Refined BROKER.95 at constrained panel widths so recent-contract payouts retain comfortable right and bottom spacing, while **CONFIGURAR CIPHER** now provides the same visible hover and keyboard-focus feedback as the settings actions.
- Applied the persisted audio level immediately when the Web Audio master gain is created, preventing the first interaction sound from briefly playing at the browser's default full gain while retaining smooth transitions for later volume changes.
- Updated package metadata, release documentation, and the README version for 1.7.7.

## [1.7.6] - 2026-09-04

- Made the CIPHER configuration steps respond to the actual width of the BROKER.95 settings panel instead of the outer window. The actions now use a consistent two-column layout in constrained panels, a one-column layout in very narrow spaces, and aligned status and label cells to avoid cramped or visually uneven wrapping.
- Replaced the "Aprender con CIPHER" guidance with the shorter educational explanation of CIPHER's role, the need to verify results through execution, testing, debugging, analysis and visualization, and the extension's authority over game rules and progress.
- Updated package metadata and the README version for 1.7.6.

## [1.7.5] - 2026-09-04

- Expanded CIPHER in BROKER.95 with local LM Studio and remote xAI, Together AI, Z.AI, Hugging Face, and OpenRouter, alongside Groq, Gemini, DeepSeek, Ollama, and OpenAI. Added a reusable OpenAI-compatible transport with fixed remote origins, provider-specific connection checks, structured JSON and text responses, bounded SSE streaming, and normalized usage and failures.
- Added versioned provider capabilities and isolated configuration profiles, including per-provider models, validated loopback URLs, optional LM Studio authentication, and local model discovery. Settings migrate safely from version 4 to 5; credentials remain isolated in secure system storage and are excluded from public snapshots, logs, and messages back to the Webview.
- Redesigned the provider setup experience with local/remote groups, guided setup steps, actionable connection errors, explicit configured-versus-verified states, privacy and resource-use guidance, and direct access to CIPHER configuration from tutoring and lessons. Connection checks can be retried after a failure without displaying stale results or retaining another provider's credential draft.
- Added a versioned integral provider corpus and cross-layer registry/transport regressions for all six new providers: all six neutral operations, transient recovery, bounded retries, terminal HTTP failures, fragmented UTF-8 streams, interrupted streams, cancellation, and response-body timeouts. The release gate verifies that every provider and security, persistence, educational, and domain-authority evidence is actually executed.
- Updated package metadata and technical documentation for release 1.7.5. The README changes are limited to the version and the requested AI-provider list and plain-language credential/privacy explanation.

## [1.7.4] - 2026-09-02

- Tightened array-literal syntax so adjacent bracketed expressions such as `A = [1, 2] [3]` and `A = [[1], [2]][0]` are rejected by the parser. Multidimensional literals must separate their nested arrays with commas, for example `A = [[1, 2], [3]]`; array indexing remains available only on array identifiers.
- Required the root parser to report residual tokens after a complete program, preventing malformed expressions from being mistaken for accepted syntax; added parser regressions and updated package metadata and technical documentation for release 1.7.4.

## [1.7.3] - 2026-09-02

- Added first-class CLRS array literals with empty, heterogeneous, nested, and multidimensional forms such as `datos = [1, "dos", VERDAD]` and `matriz = [[1, 2], [3, 4]]`. The versioned AST contract rejects missing elements and trailing commas while preserving complete source locations.
- Integrated array expressions throughout semantic binding and reference resolution, JavaScript generation, execution, runtime tracing, DAP evaluation and expandable state, diagnostics, completion, hover, signature help, semantic tokens, navigation, call hierarchy, and safe rename.
- Extended the document formatter and flowchart editor with recursive array rendering, stable multidimensional indentation, idempotent formatting, and complete multiline-assignment replacement without residual source lines.
- Preserved conservative cost analysis for fixed literals while retaining the cost and provenance of nested function calls. BROKER.95 static evidence and contract execution now accept array literals, and its existing array lessons teach direct, empty, nested, incremental, and indexed construction without adding new lessons.
- Added a versioned integral array-literal corpus covering parser/AST, semantics, transpilation/execution, debugging/editor intelligence, formatter/diagram, complexity, and BROKER.95; updated release documentation and package metadata for version 1.7.3.

## [1.7.2] - 2026-09-01

- Normalized native CLRS test-result output so input, expected output, actual output, failure details, and stderr use exactly one empty line between sections. The presenter removes only the evidence's final line terminator, preserving meaningful internal blank lines and retaining CRLF output expected by VS Code.
- Added presentation regressions for passed, failed, errored, run, and debug paths with LF and CRLF evidence; updated package metadata and developer documentation and packaged release 1.7.2.

## [1.7.1] - 2026-09-01

- Reorganized the CLRS editor-title actions into consistent Execute, Start, Create, Analyze, and Diagram groups, retained BROKER.95 as a direct action, and added an explicit **Stop CLRS Code Execution** command. Normal execution and the linked diagram can now stop the active process and remove its temporary generated artifacts through the same controlled lifecycle used by debugging.
- Hardened the native walkthrough workflow so run, debug, and diagram actions resolve the CLRS document created or selected from the walkthrough after it is saved under its final name. Walkthrough illustrations now load from the repository-hosted SVG assets, while the BROKER.95 cover remains PNG, keeping those media files outside the VSIX.
- Refined the complexity report layout and added adaptive asymptotic-growth charts for best and worst cases. Charts use complexity-aware green-to-orange lines, start at the origin, label their axes **Tamaño de entrada** and **Tiempo de ejecución**, and preserve an empty plot when the growth order is undetermined.
- Added bounded runtime performance metrics for activation, document analysis, cost analysis, and Webview readiness without retaining user code, paths, or document contents. Document snapshots now use a 16-entry least-recently-used limit so inactive documents cannot grow the Extension Host cache indefinitely.
- Added deferred Webview loading for the diagram, complexity report, BROKER.95, Mermaid, KaTeX, and Kaplay paths, and delayed native Testing API construction until declarative CLRS tests or public BROKER.95 cases exist.
- Bundled the Extension Host and production CLI with esbuild, excluded source JavaScript and development dependencies from publication, and retained only the two runtime bundles plus the split frontend build and declarative extension resources in the VSIX.
- Added a versioned integral-corpus matrix covering parser and semantics, execution, testing, comparison, debugging, coverage, quick actions, call hierarchy, BROKER.95, the diagrammer, and multiplatform regressions. Release checks now run this corpus, and CI declares Windows, Linux, and macOS jobs before packaging release 1.7.1.

## [1.7.0] - 2026-08-31

- Renamed the user-facing starter actions to the generic **Create CLRS Program**, **Create CLRS Test Suite**, and **Create CLRS Project** commands while preserving their established internal command identifiers.
- Added a native six-step VS Code walkthrough for creating, running, diagramming, debugging, testing, and continuing with BROKER.95 or Learning. Starter commands create unsaved CLRS and declarative-test documents so the user retains control over their location.
- Added a safe example-project generator with a valid CLRS program, three deterministic test cases, and a local guide. It requires an explicitly selected empty folder, never overwrites existing content, and can open either the program or the complete project.
- Added a contextual native start command that distinguishes empty workspaces, available or active programs, active suites, and tested projects, then offers only relevant actions through a Quick Pick without automatic prompts or background mutations.
- Expanded the native testing guide with suite and case fields, input/output mapping, a from-scratch workflow, case-design guidance, all thirteen comparison modes, execution, debugging, coverage, results, and troubleshooting. Added stable README index anchors and updated technical onboarding architecture.
- Added walkthrough, example-project, contextual-start, manifest, composition, deterministic execution, and Extension Host regressions; updated package metadata and developer documentation for release 1.7.0.

## [1.6.9] - 2026-08-31

- Added structured CLRS test comparisons with exact, line, numeric, tolerance, JSON, array, boolean, containment, and safe-regex modes, together with a deterministic first-divergence model for scalar and nested values.
- Added native visual failure presentation and deterministic pedagogical explanations. Failed cases now separate technical evidence from a concise learning-oriented cause while preserving input, expected output, actual output, duration, source navigation, and VS Code differences.
- Added conservative native quick fixes for unequivocal source transformations and explanatory Code Actions for ambiguous errors, all backed by the existing diagnostic and semantic model instead of a parallel parser.
- Added versioned execution instrumentation and per-case or accumulated test coverage for statements, declarations, and branch outcomes. Coverage is available through VS Code's native Testing API and projects the same immutable evidence onto linked flowcharts.
- Added a shared semantic call graph and native Call Hierarchy for resolved incoming and outgoing calls. The same graph now derives non-blocking hints for functions unreachable from the global flow or `PRINCIPAL`, plus informational diagnostics for direct and indirect recursion.
- Added comparison, divergence, explanation, correction, coverage, call-graph, provider, composition, flowchart, and Extension Host regressions; updated user and developer documentation and packaged release 1.6.9.

## [1.6.8] - 2026-08-30

- Added a native **CLRS Test Explorer** based on the VS Code Testing API. Versioned `*.clrs-tests.json` suites now discover individual cases automatically and support per-case, per-suite, and workspace execution from the standard Testing view.
- Added an immutable testing domain and a shared deterministic executor for CLRS source analysis, JavaScript generation, seeded runtime input, cancellation, per-case timeouts, bounded output, and normalized syntax, semantic, runtime, infrastructure, and assertion results.
- Added native result presentation with duration, input, expected output, actual output, stderr, source-linked diagnostics, and VS Code output differences. A public JSON Schema validates declarative suites while they are edited.
- Added the native **Depurar** test profile. A selected case launches the existing CLRS DAP with its deterministic input and seed, preserves breakpoints and stepping, returns the final result to the Test Explorer, and cancels only its own debug session.
- Integrated the active BROKER.95 contract into the same Test Explorer. Its declared public cases appear and disappear with the authoritative contract state, execute through the shared runner, retain every validated BROKER.95 comparison mode, and can be debugged without creating a parallel test file or exposing mutation authority to a Webview.
- Added discovery, execution, result, DAP, BROKER.95 integration, composition, runtime-trace, and Extension Host regressions; packaged release 1.6.8.

## [1.6.7] - 2026-08-25

- Exposed **Formatear documento CLRS** explicitly in the editor context menu and Command Palette for `clrs-es` documents. The public command delegates to VS Code's native format action, so contextual formatting, `Shift+Alt+F`, and format-on-save all use the same AST-backed provider.
- Added manifest, composition, and Extension Host coverage for formatter discovery; packaged release 1.6.7.

## [1.6.6] - 2026-08-25

- Added a native VS Code document formatter for CLRS and selected `j-hernandez-dev.clrs-kit-esp` as the default formatter for `clrs-es` documents. Format Document and format-on-save share the same extension-owned pipeline.
- Implemented AST-backed structural indentation and token-aware whitespace normalization. Formatting respects editor indentation options while preserving strings, escape sequences, comments, blank lines, terminal newlines, and the source document's `LF` or `CRLF` convention; syntactically incomplete documents are left untouched instead of receiving unsafe edits.
- Added **Curvo**, **Lineal**, and **Ortogonal** connection styles to the flowchart toolbar. Orthogonal routing now selects the directional Mermaid step curve appropriate to vertical or horizontal layouts, and standalone SVG export preserves the selected connection geometry.
- Added formatter unit, composition, and VS Code Extension Host coverage; rebuilt the shared frontend and packaged release 1.6.6.

## [1.6.5] - 2026-08-23

- Renamed the flowchart function-creation confirmation to **Crear subproceso**, aligning the action with the diagram terminology already used by the editor.
- Protected only the structurally final terminal of each subprogram against destructive deletion. Earlier explicit `retornar` terminals can now be removed like ordinary statements, while the last `Retornar` or synthetic `Fin` always remains as the function closure; clearing the final return expression still replaces the complete statement with an editable `Fin`.
- Kept synthetic `Fin` terminals interactive even though they have no source location yet, while preserving source navigation for nodes that originate in the AST.
- Simplified function-start terminals to display only their signature (`IDENTIFICADOR(parámetros)`) instead of stacking it beneath `Inicio`. Return expressions remain optional in the editor: accepting an empty synthetic `Fin` preserves the function without validation noise or an invalid source edit.
- Normalized the remaining multiline return labels against their widest line and reinforced descendant centering after Mermaid rendering, keeping return expressions and `Fin` visually aligned across themes.
- Added direct CLRS execution to the flowchart playback toolbar. An outlined execution icon beside the live status asks the Extension Host to save and run the exact document linked to the panel, even when the Webview has focus or lives in another VS Code window; the existing runtime terminal and execution-trace pipeline remain authoritative.
- Replaced the square backgrounds of Mermaid connection labels with compact, fully opaque capsules. SVG and HTML label variants receive the same theme-derived solid fill and maximum corner radius, and standalone SVG export serializes native rounded backgrounds instead of reverting to rectangles.
- Preserved CLRS logical operators in lowercase throughout the diagram projection and condition editor. Expressions now display `no`, `y`, and `o` instead of introducing the presentation-only variants `No`, `Y`, and `O`; the AST and source remain unchanged.
- Made the generated global `PRINCIPAL` figure open **Subproceso · llamada** as an explicit read-only projection. Its identifier and arguments remain visible and copyable, while the fields and confirmation action are locked; the frontend model and authoritative Host both reject forged edits so this implicit runtime call can never rename or alter the real declaration.
- Extended hover, selection, execution, runtime-error, and diagnostic styling to the nested geometry Mermaid uses for terminal figures. Function starts, explicit returns, and synthetic `Fin` nodes now receive the same exterior state glow as the other flowchart shapes.
- Added regressions for return-to-`Fin` transitions, final-terminal protection, intermediate-return deletion, the read-only derived `PRINCIPAL` call, nested terminal highlights, no-location editing, subprogram wording, terminal labels, direct execution bridging, linked-document execution, lowercase logical expressions, rounded connection labels, and theme-safe SVG styling; rebuilt the shared frontend and packaged release 1.6.5.

## [1.6.4] - 2026-08-22

- Made explicit return nodes safely deletable while keeping `retornar` syntactically strict. Removing a return now deletes the complete statement and exposes a non-deletable, editable `Fin` terminal; an internal non-executable marker preserves a function whose body becomes empty, and editing `Fin` materializes a new return expression.
- Made newly created functions start with the valid neutral statement `retornar 0`, while keeping the creation form focused on identifier and parameters. Function-start and return terminals now center their heading and detail lines independently.
- Made final `No`-branch cleanup structural: deleting the branch's last direct node removes its `sino` header and complete remaining subtree, while branches with sibling statements retain `sino` and delete only the selected instruction.
- Made every function-start terminal an AST-backed declaration editor for identifier and parameters. Its destructive action now removes the complete declaration and body atomically; deleting `PRINCIPAL` also removes its synthetic global-flow call on the next diagram projection.
- Added source-diagnostic projection to the flowchart. Syntactic and semantic errors with a safe AST location now mark every corresponding Mermaid figure with the same red outline and exterior glow used for runtime failures; semantic diagnostics remain non-blocking, stale highlights clear immediately after correction, and unrepresentable syntax errors stay available in the textual report without inventing a node.
- Extended the authoritative deletion-impact protocol with complete-function operations, strengthened exact function-envelope validation, expanded the flowchart regression coverage, rebuilt the shared frontend, and packaged release 1.6.4.

## [1.6.3] - 2026-08-21

- Added subtle enter and exit transitions to the floating node, insertion, and function editors. The presence layer retains the closing form just long enough to finish a short opacity, translation, and scale animation, while reduced-motion environments dismiss it immediately without animation.
- Made editable arrowheads follow their connection's hover, keyboard focus, and selected states. Each editable edge receives an isolated Mermaid marker clone so its tip can adopt the focus color and grow subtly without changing unrelated arrows that share the original marker; disposal restores the original reference cleanly.
- Added regressions for editor presence, reduced motion, marker isolation, pointer activation, selection, and cleanup; rebuilt the shared frontend and packaged release 1.6.3.

## [1.6.2] - 2026-08-21

- Unified Webview reopening for the algorithmic-complexity report and BROKER.95: running either command again now reveals the existing panel in its current editor group instead of creating or repositioning a duplicate. The complexity report also retains its linked document while the Webview itself owns focus.
- Added the initially active CLRS filename to the BROKER.95 tab title (`BROKER.95 - archivo.clrs`) without changing submission semantics: review, ask, and push still use the active document or an explicit terminal selector.
- Reworked flowchart SVG export to preserve the exact post-layout geometry shown in the editor instead of asking Mermaid to recalculate the diagram with its structurally different native-label renderer. Terminals, processes, input/output figures, decision diamonds, merge points, connectors, and branch labels now retain the editor's proportions and placement.
- Converted the preserved Webview labels to native SVG text and concrete theme colors during export. The resulting document remains transparent, standalone, compatible with ordinary image viewers, and free of `foreignObject`, XHTML, pan/zoom transforms, minimap elements, selection effects, and editor-only CSS variables. Native labels explicitly suppress the node stroke inherited from Mermaid classes and retain the preferred editor font while adding portable monospaced fallbacks, preventing outlined or malformed lettering in external viewers.
- Fixed the export command stopping before VS Code could open the save dialog when Mermaid omitted the live `viewBox`: the exporter now captures the real pre-zoom bounding box, adds a stable margin, and serializes a valid autonomous coordinate system.
- Added export regressions for geometry preservation, theme-aware branch-label backgrounds, multiline labels, native-text conversion, portable font fallbacks, missing live `viewBox`, and native-render fallback; updated package and developer documentation for release 1.6.2.

## [1.6.1] - 2026-08-21

- Standardized process, subprocess, input, output, preparation, start, and return figures on the same 36-pixel minimum height by compensating for Mermaid's shape-specific padding before layout. Decision diamonds now use a smaller internal padding without being forced into the rectangular height, merge points retain their own geometry, connectors remain correctly anchored, and the synthetic `Fin` terminal keeps a clean pill silhouette instead of collapsing into an almost circular shape with a small flat protrusion.
- Made DAP startup deterministic by launching the CLRS interpreter as the integrated terminal's root process instead of sending a command to a shell that might not be ready. Interactive input/output is preserved while entry stops, breakpoints, stepping, logpoints, and termination now receive runtime trace events reliably.
- Isolated each DAP adapter's breakpoint state to its configured source file, preventing VS Code's persisted breakpoints from unrelated documents from clearing the active program's breakpoints.
- Hardened Extension Host DAP regressions with exact launch/termination correlation and richer timeout evidence; the complete 19-test integration suite now passes consistently across repeated clean VS Code sessions.
- Integrated the shared document-analysis session with the flowchart Webview. Semantic diagnostics are now reported in Spanish without blocking a syntactically valid diagram, while partial-document diagrams avoid context-free semantic false positives.
- Made the implicit `No` connection of an `if` without `sino` editable. Inserting a figure on that edge securely creates the missing `sino` branch, preserves native indentation and line endings, reparses the candidate, and rejects stale or forged insertion contexts.
- Reduced Mermaid flowchart padding from 28 to 8 pixels so terminals, processes, input/output nodes, preparations, and decisions use a more compact and consistent visual proportion while retaining native label growth and connector geometry.
- Made the initial `Inicio → Fin` connection of an empty CLRS document editable, allowing the first statement to be inserted through the existing versioned AST-backed editing pipeline.
- Added regressions for semantic diagnostic transport, missing-`sino` insertion, and first-figure insertion in an empty document; rebuilt the shared frontend and packaged release 1.6.1.

## [1.6.0] - 2026-08-21

- Replaced the native rectangular SVG focus outline and soft selection glow with a shape-bound Mermaid stroke, preserving keyboard focus, hover feedback, and accessibility without drawing an unrelated white box around editable figures.
- Made the synthetic `PRINCIPAL()` node in the global flow an update-only proxy for its real function declaration, allowing its identifier and parameters to be edited safely while preventing deletion of a non-existent call statement.
- Added a save action to the flowchart toolbar. The Webview requests the operation through the typed bridge, while the Extension Host validates the active panel and saves the exact linked CLRS `TextDocument`, independently of editor focus or window placement.
- Fixed insertion into an entirely empty global flow by recognizing its canonical end connection and anchoring new statements before the first function declaration. Function calls such as `prueba(10)` can now be inserted even when the document initially contains only declarations.
- Refined the flowchart toolbar icons to `ƒ` for creating a subprogram/function and `⭳` for saving the linked document, with a clearer creation tooltip.
- Removed the extra bold weight from the function and save toolbar glyphs, made the minimap background fully opaque, and sanitized its snapshots so underlying diagram content, reduced Mermaid labels, and interaction hit targets cannot appear as detached visual artifacts.
- Restored the exact `svg-pan-zoom` view box in every minimap snapshot so the reduced diagram and its visible-area indicator share one coordinate system and remain positionally aligned after panning, zooming, fitting, and centering.
- Removed the residual inline CSS transform that `svg-pan-zoom` leaves on its viewport group when producing the minimap snapshot. The reduced graph is no longer scaled or translated a second time, so its contents, viewport indicator, and click-to-pan navigation now coincide visually.
- Expanded the versioned flowchart corpus to 27 traceable requirements, updated the developer documentation and package metadata, rebuilt the shared frontend, and packaged release 1.6.0.

## [1.5.9] - 2026-08-21

- Expanded every editable flowchart connection with a transparent 18-pixel pointer target, increased to 24 pixels for coarse pointers, while preserving Mermaid's visible geometry, arrowheads, keyboard interaction, hover feedback, and SVG output.
- Verified and protected function-call insertion at both the beginning and end of the top-level global flow through an executable source-editing regression and the versioned diagram corpus.
- Standardized BROKER.95 user-facing Spanish on the ISO-aligned term **requisito** across contracts, test explanations, validation feedback, learning content, Webview labels, terminal output, documentation, and tests, while retaining the stable internal `requirements` schema.
- Updated the developer documentation, package manifests, built Webview, and release metadata for version 1.5.9.

## [1.5.8] - 2026-08-21

- Added safe top-level function creation to the flowchart editor. A dedicated `ƒ+` toolbar action opens a responsive form for the identifier and optional parameters, previews the initial CLRS declaration, and uses snippet-aligned defaults. The Host accepts the operation only for a whole-document diagram, rejects duplicate declarations and malformed signatures, inserts the new function before `PRINCIPAL` with native indentation and line endings, supplies a valid starter return body, reparses the complete candidate, and applies it as one undoable document edit.
- Added two-stage safe deletion to the flowchart editor. `Eliminar` now presents the AST-derived impact as one instruction, one `sino si` branch, or an entire control block before enabling the destructive action; the confirmation remains keyboard accessible and explains native VS Code undo. The Host independently recomputes and validates that impact, rejects forged acknowledgements, removes complete `si`/`mientras`/`para` structures atomically, preserves unrelated branches and siblings, and refuses deletions that would leave a required function or nested body empty.
- Added structural flowchart insertion through safe control-flow arrows. Selecting an insertion connection now opens a responsive figure palette for return, assignment, input, output, condition, while, ascending/descending for, and function call nodes, populated with the same snippet-like defaults as node editing. The editor identifies whether the selected arrow targets the block sequence or a Sí/No branch and whether it inserts at the start, middle or end; pending edits lock that exact visual target until the correlated Host result arrives. The Host resolves the requested scope, container, branch and statement index against a fresh AST; inserts with native indentation and line endings; creates an immediately valid starter body for control structures; validates the candidate program; and rejects forged destinations, returns outside functions, stale documents, and unsafe partial-line scopes.
- Added the authoritative flowchart source-editing service. Node updates and deletions now cross a correlated typed Webview protocol, then the Extension Host re-parses the exact document version, reconstructs the deterministic AST identity, validates the figure, structural context and bounded single-line fields, verifies the untouched source text at the application boundary, parses the candidate result, and applies one atomic `WorkspaceEdit`. Control-node deletion removes its complete AST block while ordinary edits preserve bodies and indentation; stale or malformed intentions return structured Spanish errors without mutating the document.
- Added the floating node editor shell for all nine editable CLRS flowchart figures. Selecting a node now opens a theme-aware, responsive and keyboard-accessible form with AST-derived values, explicit `Ir`, `Eliminar`, `Cancelar` and `Aceptar` actions, required-field feedback, initial focus and Escape dismissal. Update/delete payloads are represented as immutable typed intentions so the subsequent document-transformation layer can consume them without parsing Mermaid labels.
- Added the visual interaction layer for the upcoming flowchart editor. Editable CLRS figures and safe insertion arrows now expose pointer and keyboard affordances, accessible labels, hover emphasis, persistent selection, Escape/background dismissal, and pan-safe pointer handling. Clicking an editable figure selects it instead of immediately navigating; structural nodes retain the existing source-navigation behavior until the editor supplies its explicit `Ir` action.
- Added deterministic in-memory identities for every generated flowchart node and edge. Editable nodes now preserve their CLRS figure kind, source range, scope, containing block, branch, and statement index; editable arrows preserve a classified control-flow relation and an exact insertion point. Mermaid receives explicit edge IDs for the upcoming visual editing interactions, while the historical serializable diagram shape remains unchanged.
- Kept flowchart panels bound to their originating CLRS `TextDocument` and source scope when hidden, moved between editor groups or windows, or reconstructed by VS Code. Reopening the command now reveals and refreshes the existing linked panel instead of replacing it, and navigation follows whichever visible editor currently owns the document.
- Refined learning callout arrows in both Programación and Algoritmia: standalone flow separators render downward while inline actions and relationships retain their right-facing arrows, without mutating curricular source data.
- Added a versioned flowchart-editing regression corpus with 22 traceable requirements across identity, interaction, update, deletion, insertion, function creation, safety, Host integration, and end-to-end regression. Its executable journey updates a node, inserts from an edge, deletes a control block, creates a function, and verifies the resulting CLRS program, while the release suite now runs the corpus automatically.
- Updated the user and developer documentation, package manifests, built Webview, and release metadata for version 1.5.8.

## [1.5.7] - 2026-08-20

- Added semantic, scope-aware lowering for every user-defined CLRS binding. JavaScript reserved words such as `var`, `function`, `class`, and `await`, as well as runtime-facing names such as `console`, can now be used safely as CLRS identifiers without producing invalid JavaScript or shadowing compiler internals.
- Preserved original CLRS names across the AST, diagnostics, navigation, diagrams, algorithmic analysis, runtime frames, breakpoint evaluation, and DAP variables. Only emitted JavaScript receives deterministic collision-free internal names; standard-library and external symbols retain their runtime bindings.
- Reused the shared `SemanticModel` during compilation and BROKER.95 test execution, added executable regressions for reserved identifiers, standard-library calls, runtime visibility, scope isolation, and `console` collisions, and updated the technical developer documentation.

## [1.5.6] - 2026-08-16

- Lesson correction

## [1.5.5] - 2026-08-15

- README.md correction

## [1.5.4] - 2026-08-15

- CHANGELOG.md correction

## [1.5.3] - 2026-08-15

- New README.md file

## [1.5.2] - 2026-08-14

- Added `ai -ask [pregunta]` as a lightweight contextual CIPHER tutor between review and push. The Host supplies the active contract, exact CLRS source, compact observed test evidence, static evidence, and route-aware pedagogy without exposing private test oracles; the operation returns natural Spanish text instead of strict review/evaluation JSON and never mutates score, payout, alert, contract, or progress. Invoking it without a question produces a warm, non-judgmental offer of help tied to the current contract.
- Extended the provider-neutral LLM protocol and Groq, Gemini, DeepSeek, OpenAI, and Ollama adapters with explicit plain-text responses for contextual tutoring, while preserving structured JSON and repair behavior for contract generation, review, and push.
- Split terminal onboarding from live state: `ai -info` now reports only the current run, while the new `ai -gameinfo` welcomes the player, introduces BROKER.95, CIPHER, clients, alert/game-over rules, risk weights, the complete criteria catalog, and two guided starting paths. `ai -?` now explains command syntax and points first-time players to the guide.
- Polished narrow learning maps with an on-demand horizontal viewport, a minimum readable route width, and a shortened terminal axis that ends beneath the FIN node instead of continuing toward empty space.
- Refined the BROKER.95 responsive presentation without changing curricular content: the Learning route selector now keeps safe edge spacing, multiroute tab counters remain contained at narrow widths, technical-profile samples use a compact non-overflowing layout, and every in-game scrollbar shares the terminal's green visual treatment.
- Completed the two-route BROKER.95 learning experience with the authoritative 50-lesson Programación curriculum and 57-lesson Algoritmia curriculum, a shared vertical route selector, deterministic inter-route unlocking, route-specific lesson views, and immediate synchronized notifications.
- Materialized the complete Algoritmia catalog as 57 explicit `lesson({...})` definitions. Every generated problem statement, concept, explanation, example, formula, knowledge item, optional tool, category, contract, ID, section relation, and reward was preserved while removing the former definition and fallback generators.
- Aligned both curricula on the same structured editorial model: explanations accept only paragraphs, lists, and callouts; examples accept only text or CLRS blocks; formulas retain unique stable identifiers and render through the existing KaTeX-capable lesson view.
- Added and updated the executable multiroute learning corpus covering the complete catalogs, sequential locking, route transition, CIPHER context, contracts, review, push, settlement, statistics, persistence, reset, Webview synchronization, accessibility, and normal client-contract regressions.

- Completed multiroute learning synchronization and notifications. A generated-contract event now carries and validates its canonical route title, lesson order, lesson title, section, attempt, link, and committed public state; both the in-game notice and hacker-style terminal output identify the exact route and lesson before showing the normal `ai -set`/`ai -read` workflow.
- Hardened the Webview against out-of-order state delivery with monotonic revision selection. Contract creation, `ai -push`, delete, purge, and progress reset immediately refresh the route selector, active map, lesson detail, linked-contract action, and notice without allowing a delayed event to restore stale progress.
- Integrated Algoritmia with the existing cumulative statistics, balance, technical profile, risk buckets, FND family/category history, and evaluated Functionality samples; no parallel educational economy or statistics store was introduced.
- Added per-route learning summaries to the general statistics projection, including completed lessons, total progress, and cumulative route payout for Programación and Algoritmia.
- Made every authoritative game-session transition receive the configured route catalogs. Explicit progress reset now clears both educational routes atomically, restores Programación as the only available route, locks Algoritmia again, and retains the independently managed adaptive category history.
- Preserved completed Algoritmia lessons, attempts, cumulative statistics, and technical profile across game over and a subsequent run, while releasing open educational contract links. Economy, delete, and purge transitions now retain the same multiroute context.
- Generalized definitive `ai -push` evaluation and settlement across learning routes. The Host now resolves the active route catalog for CIPHER context, payout improvement, atomic lesson resolution, next-lesson projection, and route totals instead of assuming Programación.
- Added complete Algoritmia settlement regressions: first approval pays by score and unlocks only the next algorithm lesson; rejection releases the lesson without payout or progress; repetition pays only a positive best-score improvement; and the final approval closes Algoritmia without inventing a third route.
- Kept every learning contract at the authoritative low-risk/Functionality-only policy even when an advanced curricular category has a higher client-facing base difficulty. Category risk compatibility remains enforced for normal client contracts.
- Hardened definitive evaluation around optional CLRS tools. CIPHER may suggest only tools declared by the lesson and only inside optional recommendations; using a tool, or its absence, as evidence, rationale, problem, summary, score, approval, or payout input triggers the bounded repair attempt.
- Generalized the pedagogical `ai -review` boundary by learning route. Algorithms reviews now receive the canonical algorithmic objective, prior-route prerequisites, accumulated route knowledge, relevant preconditions and postconditions, studied paradigms, and explicitly blocked future concepts; Programming continues through the same review pipeline without invented algorithmic context.
- Limited review-time CLRS tool suggestions to the exact recommendations declared by the current lesson. CIPHER must phrase them as optional formative support and cannot require, test, score, or penalize their use; mandatory or unlisted tool advice triggers the existing single bounded repair attempt.
- Generalized learning-contract acquisition across route catalogs. The Host now resolves `learningRouteId` before the lesson, checks inter-route availability before calling CIPHER, preserves the route through bounded repair and idempotency, and atomically creates and links the resulting contract only inside its source route.
- Extended the typed Webview request with the exact route-and-lesson identity. Programación remains the backward-compatible frontend default, while Algoritmia requests can target their own catalog without introducing a second repository, command, contract cycle, or generation service.
- Added Host-side curricular validation for educational contracts. Accepted drafts must describe an observable CLRS programming task aligned with the canonical lesson, stay within the lesson-stage requirement/test budget, avoid theoretical-only questionnaires and out-of-scope formal proofs, and preserve the exact route/category context.
- Tool references are now recognized semantically: only tools recommended by the lesson may appear, only as optional guidance in the description, and never in requirements or test explanations. Invalid curricular drafts remain eligible for the existing single bounded repair attempt.
- Replaced permanent bans on recursion, sorting, files, complexity, and advanced data structures with knowledge-gated checks. They remain unavailable in early Programación lessons but become valid when an authoritative route catalog has introduced the exact concept, allowing Algoritmia to reuse the same validator safely.
- Generalized the provider-neutral curricular request used by CIPHER across both learning routes. The Host now derives the route, lesson objective, expected practical exercise, prior-route knowledge, accumulated current-route knowledge, explicitly forbidden future concepts, full category context, pedagogical position, and optional CLRS tools without exposing progress, rewards, or exercise history.
- Added a typed catalog of CLRS learning-tool recommendations covering the flowchart, execution trace, debugger, call stack, algorithmic cost, complexity report, and code/diagram navigation. Tool context is explicitly recommendation-only and cannot become a contract requirement, test condition, evaluation signal, score, or payment input.
- Extended the shared lesson model with optional `expectedContract` and `recommendedTools` data. The current Programación source defines no per-lesson tool recommendation, so it uses the same route-neutral boundary with an empty optional-tool list rather than inventing curricular guidance.
- Partitioned the authoritative learning state by stable route identifiers: `programming` now owns the existing 50-lesson progress, while `algorithms` has an independent dormant progress record ready for its complete curriculum. Each route has its own current lesson, attempts, contract links, best scores, completion markers, and deterministically derived cumulative payout.
- Added the deterministic inter-route prerequisite: `algorithms` is available if and only if every lesson in the authoritative ProgramaciÃ³n catalog is completed. The final passing settlement exposes the route immediately in the same game transition without starting Algoritmia, creating a contract, or changing Webview navigation; all completed ProgramaciÃ³n lessons remain open for review.
- Route availability is recalculated from canonical ProgramaciÃ³n completion during every normalization and load. Persisted availability flags cannot unlock Algoritmia early or keep it locked after the prerequisite has been satisfied.
- Added a route-aware atomic transition boundary for educational attempts. Link, release, batch release, approval, rejection, repetition, delete, purge, game over, and settlement now validate the complete `routeId + sectionId + lessonId + contractId` identity before replacing any route progress.
- Batch operations validate every affected route and contract before producing a new immutable state, preventing partial cross-route releases.
- Extended every educational contract with an immutable `learningRouteId`. Creation, lifecycle updates, reconciliation, review/push pedagogy, settlement projections, public state, and the Host/Webview result protocol now retain the exact route together with section, lesson, attempt, and contract identity.
- Educational contracts without `learningRouteId`, unknown routes, client contracts carrying educational route fields, and contracts targeting a route without a canonical catalog are rejected. No compatibility fallback or contract migration was introduced.
- Added multiroute transition regressions for section/lesson mismatches, locked Algoritmia, resolution isolation, and all-or-nothing operations spanning two route catalogs.
- Added an immutable route-progress root with explicit availability, monotonic revisions, per-route access/replacement/reset operations, strict dormant-route validation, and load-time reconciliation scoped to ProgramaciÃ³n. Current educational contracts, review, push, delete, purge, game over, reset, terminal, and Webview projections now select ProgramaciÃ³n explicitly instead of assuming a flat global route.
- Advanced the game, snapshot, public-state, and Host/Webview protocol schemas to version 4 for route-bound contracts. Obsolete contracts and snapshots are intentionally rejected under the current no-migration persistence policy.
- Added route-domain regressions proving isolation between ProgramaciÃ³n and Algoritmia, current availability, cumulative payout derivation, invalid route rejection, immutable state, and joint reset behavior.
- Removed the BROKER.95 game, settings, conversation, and legacy credential migration layers. Persistence now accepts only the current schema, quarantines obsolete or invalid local data before creating a clean state, and preserves future-version snapshots without overwriting them.
- Kept current-state learning reconciliation and bounded conversation retention as explicit invariants rather than version migrations, and removed migration metadata from session load results.
- Removed acceptance of the obsolete half-reward learning-contract representation; current educational contracts must persist their authoritative full potential reward.
- Added regressions proving that obsolete snapshots and the former global Groq secret are never silently transformed, while corrupt recovery, future-version safety, reconciliation, and provider credential isolation remain intact.
- Replaced the BROKER.95 category catalog with the representative algorithmic taxonomy: 39 families and 151 stable categories, including 38 client families with 139 categories and 12 learning-only FND categories.
- Bound each category to its canonical technical scope, representative examples, and base difficulty; normal contract generation now sends this precise context to CIPHER and retains cumulative risk compatibility for persisted contracts.
- Reserved family FND exclusively for learning. The normal `ai -new` selector cannot choose any FND category, while statistics still report educational outcomes in the same unified family view.
- Updated category selection, statistics, acceptance corpus, contract fixtures, and learning taxonomy regressions to the new identifiers and counts. Legacy category IDs are intentionally not aliased; old test progress may be reset through BROKER.95.
- Removed the unpublished Algoritmia section definitions from the active curriculum while preserving their learning-only categories for a later complete route.

## [1.5.1] - 2026-08-12

- Restored the Programación learning map to one permanently vertical, top-to-bottom route at every Webview width and orientation; the landscape-only horizontal projection and its independent horizontal scrolling were removed.
- Made the route responsive to the actual width of the Aprendizaje panel: it retains alternating left/right lesson cards when space permits and safely folds into a left-axis, single-column composition when the panel narrows.
- Adapted section checkpoints, progress controls, lesson cards, typography, margins, and long labels without changing curriculum order, keyboard navigation, current-lesson centering, or reduced-motion behavior.
- Updated the README, package manifests, built Webview, and release metadata for version 1.5.1.

## [1.5.0] - 2026-08-12

- Added native VS Code parameter-name Inlay Hints for user-defined functions and the standard library. Hints are projected without modifying CLRS source, remain available in nested, multiline, and incomplete calls, and ignore declarations, comments, and string contents.
- Reused the shared document-analysis session and canonical signature catalogs for the new provider, with a tolerant call scanner and range-bounded results so editor viewport requests do not create a second semantic subsystem.
- Made the 48-lesson map genuinely responsive in both dimensions. Tall and portrait Webviews retain the established vertical path, while wide landscape Webviews project the same accessible sequence onto a horizontally scrollable axis with lessons alternating above and below it.
- Kept one canonical curriculum DOM and keyboard order across both orientations, added per-section intrinsic sizing and isolated horizontal overflow, and preserved current-lesson centering, reduced motion, locked/completed states, and mobile single-column behavior.

## [1.4.9] - 2026-08-12

- Updated the README, package manifests, built Webview, and release metadata for version 1.4.9.
- Completed the accessibility and performance pass for Aprendizaje. The vertical route now uses one roving tab stop across open lessons, supports Arrow keys, Home, and End, announces lesson/section position and status, focuses lesson content on entry, and restores focus to the originating route node on return.
- Added explicit progress text, named scrollable code examples and practice controls, high-contrast/forced-colors/coarse-pointer adaptations, and complete reduced-motion behavior without changing the normal BROKER.95 visual identity.
- Memoized the 48-lesson route and immutable curricular content, and enabled safe off-screen rendering containment for its eight sections so unrelated Webview state changes and distant nodes no longer incur unnecessary rendering work.
- Advanced the typed Host/Webview boundary to protocol version 3 so a successful learning-contract response carries the exact public game projection committed by the same transaction. Contract, lesson link, route action, badges, and notification now synchronize atomically without a reload or reliance on event timing.
- Learning notifications are now correlated with their originating request, dismissible, preserved only while their exact educational contract remains linked, and automatically removed after delete, purge, settlement, reset, or reconciliation. Delayed notifications cannot roll the Webview back to an older game revision.
- Added protocol invariants that reject a created-contract event when its embedded state does not contain the matching learning contract, lesson, section, attempt, and repetition link.
- Completed the in-Webview lesson view with structured conceptual explanations, CLRS examples, comparative notes, newly introduced concepts, derived accumulated knowledge, section and lesson identity, and potential reward without rendering raw Markdown or creating another editor.
- Lesson practice now uses the existing typed Host boundary to request a contract by canonical `lessonId` only. The action distinguishes first attempts, repetitions, linked contracts, and generation in progress; successful generation shows the contract ID and normal `ai -read`/`ai -set` workflow with direct navigation to Terminal.
- Completed lessons now display their best score and cumulative payout derived from the shared deterministic payout rule. Repetitions remain available without inventing stars, XP, or a second reward system, while stale contract notices disappear when their lesson link no longer exists.
- Completed the vertical Aprendizaje route with its canonical 8 section checkpoints and 48 sequential lesson nodes, from **INICIO** to **FIN**, alternating sides around one continuous progression axis.
- The route now renders authoritative `locked`, `available`, and `completed` states, highlights the single current lesson, keeps completed lessons available for review, and shows per-section as well as global progress without duplicating curriculum data in the Webview.
- **Ir a mi lección** now centers the current node with smooth scrolling, respects reduced-motion preferences, and targets the completed-route marker once all lessons have been passed.
- Added the **Aprendizaje** tab immediately after Contracts, including keyboard tab traversal, an accessible `completed/total` badge, responsive layout, and the existing BROKER.95 visual language.
- Added Webview-local learning navigation between the 8-section route and an accessible lesson shell with `← Atrás` and **Go to current lesson** actions. Locked lessons cannot be opened, and no navigation action mutates or sends curriculum/progress authority to the Host.
- Learning navigation now reconciles against every authoritative state update: it remains stable while switching panels, resets for a new Webview session, and safely returns to the route if the selected lesson becomes locked or disappears after reset or migration.
- Formalized the learning/game integration policy: every educational contract is low risk, adds zero alert, and evaluates only Functionality. A runtime invariant now prevents future changes to the general low-risk table from silently adding alert or academic dimensions to learning.
- Completed general-statistics integration for learning outcomes and repetitions. Approved attempts increment completed contracts, low-risk and FND totals, earned money, and Functionality samples; failed attempts increment the corresponding failure totals while Robustness and Design remain untouched.
- Hardened educational lifecycle boundaries around game over and explicit reset. Game over discards only open lesson-contract links while preserving completed lessons, attempts, statistics, and technical profile for the next run; **Delete game progress** resets the full 48-lesson route to `lesson-001` while continuing to preserve the independently managed adaptive category history and CIPHER configuration.
- Completed the learning-aware definitive `ai -push` flow over the existing evaluation and settlement pipeline. CIPHER receives the canonical lesson objective and accumulated knowledge, may score only `F-CUM`, `F-COR`, and `F-LIM`, and is explicitly forbidden from penalizing Robustness, Design, style, architecture, optimization, or future techniques.
- Learning evaluation recommendations now share the curricular concept gate and bounded repair behavior. The Host remains the sole authority for aggregate scores, the 60-point passing threshold, payout, balance, statistics, technical profile, lesson completion, and sequential unlocking.
- Extended the immutable push result and hacker-style terminal report with the educational attempt outcome, first-completion/repetition distinction, route progress, previous and current best scores, accumulated lesson reward, improvement-only payout, and next lesson. Failed attempts release the lesson without payment or progress; repetitions never unlock twice and only pay a positive best-score improvement.
- Added lesson-aware pedagogical reviews to the existing `ai -review` pipeline. Learning contracts now bind CIPHER to the canonical lesson objective, accumulated knowledge, beginner-level Spanish, short diagnostic hints, Functionality-only criteria, and the current CLRS `=`/`==` syntax without creating a second review command.
- Learning-review recommendations and next steps now reuse the local curricular concept gate: explicit future concepts trigger the existing single bounded repair attempt, while normal client reviews retain their previous request and validation behavior.
- Integrated learning contracts with the existing simulated terminal without adding educational commands or a parallel contract cycle. `ai -get`, `ai -read`, `ai -set`, `ai -delete`, `ai -purge`, and `ai -info` now have explicit regression coverage for educational contracts, including Functionality-only active rubric, zero low-risk alert, normal presentation, and atomic release of lesson links.
- Obtaining a lesson contract now appends a persistent CIPHER notice in the established hacker-style terminal format with its normal `ai -read` and `ai -set` next steps, in addition to the correlated Webview event.
- Added version 2 of the typed Host/Webview learning boundary. The handshake now publishes one immutable, revalidated 8-section/48-lesson curriculum while live progress remains in the public game snapshot; the Webview can request a contract only by canonical `lessonId`, and cannot submit curriculum, rewards, attempts, completion, or unlock state.
- Composed learning-contract acquisition into the existing BROKER.95 controller and provider-neutral Extension Host. Requests are correlated, serialized with the existing operation queue, and answered with a validated `learning/contract-created` event; the frontend bridge and store consume only public projections and never mutate authoritative learning state.
- Added the Host-side **Obtain learning contract** service over the existing game session, neutral LLM port, availability gate, and operation coordinator. It derives the unlocked lesson, requests and validates CIPHER content, performs one bounded repair, and persists the contract plus lesson link in one authoritative transaction.
- Learning-contract acquisition is single-flight and idempotent by request ID, serializes its mutation lane, derives category and full potential reward again at commit time, and leaves the lesson immediately retryable after provider, validation, or repair failure. Repetitions retain their canonical potential reward and advance their learning-attempt number without altering completed progress.
- Added a dedicated learning-contract validator layered over the existing narrative and declarative-test validators. It binds every response to the canonical lesson objective, FND category, easy difficulty, very-high simplicity, and Functionality-only policy, while assigning CIPHER as the Host-owned client identity.
- Learning drafts now reject provider-supplied identity, category, difficulty, evaluation, payment, state, or contract-type fields. A conservative curricular gate also detects explicit requirements for locked concepts such as input, arithmetic, conditionals, loops, functions, arrays, and matrices, as well as out-of-route classes, recursion, files, advanced structures, sorting, and efficiency constraints.
- Added a compact, provider-neutral CIPHER request for learning contracts. The Host now derives the lesson objective, canonical FND category, and accumulated knowledge directly from the unlocked route; fixes difficulty to easy, simplicity to very high, and evaluation to Functionality; explicitly forbids future concepts; and omits rewards, attempts, game state, and previous-exercise history.
- Added shared learning-specific generation instructions and structured-output coverage across the existing LLM port. Equivalent exercises are intentionally allowed, current CLRS `=`/`==` syntax is enforced, locked or already-linked lessons are rejected before transport, and the regular client-contract prompt remains unchanged.
- Added atomic learning transitions across the authoritative game state. Creating a learning contract now derives and links its lesson, category, attempt, and potential reward in the same revision; delete, purge, game over, and settlement release links without intermediate states. Learning submissions use the same score-based payout table as low-risk client contracts, and scores below 60 neither pay nor unlock progression.
- Integrated learning settlement with the existing balance, contract history, general statistics, FND specialty, Functionality-only technical profile, sequential unlocking, repetitions, and `ai -push` result projection. Retries retain the full potential reward; after the first approval, repetitions pay only the positive difference over the previous best score, so each lesson has a lifetime payout ceiling equal to its curricular reward. New regression coverage verifies approval, rejection, retry, zero-pay repetition, improvement payout, forged-context rejection, and client compatibility.
- Embedded learning progress in the existing profile-global BROKER.95 game snapshot, advanced the persisted game and snapshot schemas to version 2, and added a tolerant `1->2` migration that preserves legacy economy, contracts, history, statistics, and technical profile while initializing the educational route.
- Added canonical load-time reconciliation between learning progress and open `learning` contracts. Missing links are rebuilt, orphaned or closed links are removed, derived route fields are recalculated from the 48-lesson catalog, reconciled snapshots are immediately rewritten, and completed learning remains independent from normal game over.
- Extended the existing game-progress reset and public Host projection to include the educational route without touching provider settings, credentials, or adaptive category history.
- Extended the canonical BROKER.95 contract model into an immutable `client`/`learning` discriminated union. Legacy contracts default safely to `client`, while learning contracts carry validated lesson, section, attempt, base reward, and effective reward identities in the existing game-state collection.
- Added origin-aware category and reward validation: client contracts cannot consume learning-only categories or educational fields, while learning contracts are restricted to low risk, the lesson's canonical FND category, Functionality-only weights, and deterministic curricular rewards below the normal client pay range.
- Added the authoritative BROKER.95 learning curriculum as immutable structured data with all 8 sections and 48 complete lessons, current `=`/`==` CLRS examples, comparative notes, explicit rewards, and dynamically derived accumulated knowledge.
- Extended the canonical FND taxonomy with six learning-only beginner categories for input/output, data, text, control flow, functions, and basic collections; arithmetic is explicitly shared, while the normal contract selector remains restricted to the original 115 client categories.
- Added typed category audiences, stable learning-category IDs, validation that every lesson category supports low-risk learning contracts, and corpus coverage for all 48 lesson mappings without weakening existing client-category selection.
- Added the immutable, deterministic learning-progress domain: sequential lesson and section unlocking, derived route state, attempt and score history, active contract links, first completion, reduced-reward repetition context, delete/purge release, full-route completion, and isolated reset behavior.
- Added strict progress invariants and characterization for initial state, rejected and approved submissions, 48-lesson completion, repetitions, stale visual-state recalculation, structured errors, and deeply immutable Host projections.
- Migrated the CLRS language syntax to the current textbook convention throughout the lexer, parser, AST consumers, semantic and complexity analyses, debugger, flowchart, BROKER.95 integration, TextMate grammar, snippets, documentation, fixtures, and tests: assignments now use `=` and equality comparisons use `==`.
- Added characterization coverage that distinguishes both operators and rejects the legacy assignment arrow and a single equals sign used as a comparison.

## [1.4.8] - 2026-08-11

- Replaced BROKER.95's update-only Kaplay pause with a safe low-power render lifecycle: when its Webview loses focus, leaves the viewport, becomes hidden, or remains inactive for one minute, the existing canvas freezes its last valid frame and lowers its effective WebGL render rate without destroying Kaplay. Focus or interaction resumes the same scene immediately, avoiding both continuous compositor work and the invalid WebGL context caused by rebuilding Kaplay's global singleton. The active scene cap was also reduced from 30 to 20 FPS.

## [1.4.7] - 2026-08-11

- Added the active contract's acceptance cases directly below its requirements in the BROKER.95 Contracts panel, including purpose, input, expected output, comparator, covered requirements, timeout, responsive layout, and bounded code-value scrolling.
- Limited the new Webview projection to the active contract: pending and historical contracts continue to omit their test data, while metadata and detailed evaluations remain Host-only.
- Improved flowchart edge-label readability by giving Sí, No, and other connection labels the active subgraph background in both SVG and HTML Mermaid renderings, without applying fill to connector paths.
- Updated the README, package manifests, built Webview, and release metadata for version 1.4.7.

## [1.4.6] - 2026-08-11

- Restored a readable initial flowchart scale for large multi-function diagrams: automatic framing no longer shrinks nodes and labels into thumbnails, while the explicit full-diagram fit action and minimap remain available for panoramic navigation.
- Restored the established flowchart appearance by making VS Code subgraphs share the canvas background, explicitly retaining Mermaid's classic look, and applying the resolved theme color directly to connector lines and arrowheads.
- Fixed theme changes leaving every Mermaid subgraph black: initialization now occurs at the actual render boundary, and preview SVG clusters receive their selected theme fill, border, and label colors directly instead of relying on stale singleton state.
- Prevented curved flowchart connectors from falling back to SVG's black fill and appearing as large closed ribbons; every rendered edge now receives an explicit `fill: none` alongside its theme stroke.

## [1.4.5] - 2026-08-11

- Made the CIPHER thumbnail fluid at compact Webview widths and prevented its mobile panel from shrinking below the scene, so the animated monitor no longer overlaps the navigation tabs while preserving the enlarged view and Kaplay animation.

## [1.4.4] - 2026-08-11

- Added a concise, Host-validated Spanish explanation to every newly generated contract test case and persisted it with the declarative input, expected output, comparator, timeout, and covered requirements while retaining compatibility with existing saved contracts.
- Expanded `ai -read <id>` into a structured acceptance dossier that reveals every required test and its purpose, and expanded `ai -info` with the deterministic risk-weight matrix and the complete active evaluation rubric down to its subcriteria.
- Restyled the BROKER.95 output as a delimited retro Linux-like terminal with role-specific prompts, clearer response blocks, and accessible wrapping without changing the typed Host/Webview boundary.
- Added DeepSeek as an independent selectable CIPHER provider through its official Chat Completions API, with provider-scoped API keys, JSON Object responses, bounded SSE streaming, model-list connection checks, normalized usage and response provenance, and safe classification of authentication, balance, capacity, model, network, timeout, HTTP, and malformed-response failures.
- Added DeepSeek adapter, provider-catalog, credential-isolation, composition, JSON, streaming, model-validation, secret-redaction, and failure regressions to the mandatory test suite without adding an SDK dependency.
- Replaced BROKER.95's data-directory reveal action with a confirmed **Delete game progress** action. It resets contracts, active contract, money, alert, statistics, and technical profile while preserving the independently managed adaptive category history and CIPHER configuration.

## [1.4.3] - 2026-08-10

- Fixed BROKER.95 automated reviews and deliveries with more than one `leer`: test input is now consumed from one deterministic line queue instead of recreating and closing a readline interface for every read. This prevents Node's unfinished top-level await exit code 13 from being reported as a runtime error for every contract case.

## [1.4.2] - 2026-08-09

- Rebalanced BROKER.95's 115-category catalog around the exercise's actual reasoning and implementation burden: 3 base categories are easy, 21 intermediate, 34 hard, and 57 extreme.
- Restricted new contract selection to the requested base difficulty while preserving upward risk compatibility for contracts already persisted by earlier versions.
- Added deterministic, immutable pedagogical profiles for every risk. Easy contracts now explicitly exclude collections, search, sorting, recursion, dynamic structures, trees, graphs, numerical methods, and optimization.
- Sent the authoritative difficulty boundary to every contract-generation and repair request, instructing CIPHER to treat representative category examples as a family rather than permission to select a harder algorithm.
- Clarified the progression from scalar formulas and simple control flow, through elementary collection algorithms, to divide-and-conquer, dynamic structures, graphs, dynamic programming, and specialized optimization.
- Made the window rain visibly animated at thumbnail size with deterministic falling streaks confined to both panes, while retaining ambient texture movement, hidden-Webview pausing, and reduced-motion behavior.
- Added catalog distribution, pedagogical-boundary, prompt-context, rain-motion, pause, acceptance-corpus, and production-rendering regressions for the 1.4.2 release.

## [1.4.1] - 2026-08-09

- Title bar corrected.

## [1.4.0] - 2026-08-09

- Completed the provider-resilience block with one provider-neutral retry for recoverable network, timeout, invalid-response, and selected 5xx failures, including abort-aware backoff and safe metadata-only developer logs.
- Explicitly excluded authentication, quota/rate-limit, unavailable-model, cancelled, and already-streaming requests from automatic retries so recovery cannot multiply token usage or duplicate visible output.
- Added an accessible **Test connection** action to BROKER.95 Settings. The typed Webview/Host boundary now verifies the selected provider and model without exposing credentials, reports the confirmed model inline, and cancels the check when the panel closes.
- Expanded the deterministic acceptance corpus to 102 traceable cases and added resilience, protocol, controller, Webview-store, cancellation, secret-redaction, and connection-result regressions to the mandatory release suite.
- Added OpenAI as a selectable CIPHER provider through the Responses API, with provider-scoped API keys, user-selected model identifiers, strict Structured Outputs, disabled remote response storage, and model availability checks.
- Added bounded OpenAI Responses SSE handling for typed text deltas and terminal events, normalized response IDs and token usage, explicit refusal and incomplete-response handling, and safe cancellation/timeout behavior.
- Added OpenAI-specific failure classification for authentication, quota, unavailable models, HTTP, network, timeout, malformed payloads, and invalid streams without exposing API keys or provider response bodies to the Webview.
- Added focused OpenAI adapter and provider-catalog regressions and integrated them into the mandatory unit and release suites without adding an SDK dependency.
- Added Ollama (local) as a selectable CIPHER provider. It requires no credential, communicates only with the loopback API at `127.0.0.1:11434`, validates the configured model through `/api/tags`, sends structured requests to `/api/chat`, and consumes its bounded NDJSON streaming responses.
- Added a reusable bounded NDJSON reader for local provider streams, with fragment handling, cancellation, oversize-line protection, and safe reader cleanup.
- Restricted the Ollama adapter to HTTP(S) loopback endpoints (`127.0.0.1`, `localhost`, or `::1`) so the local-provider setting cannot route CIPHER traffic to a remote host.
- Added local-provider regressions for credential-free configuration, model presence, normalized token usage, streamed deltas, endpoint restrictions, missing models, malformed NDJSON, and provider descriptors.
- Added Gemini as a selectable CIPHER provider through Google AI Studio API keys, per-provider model selection, `generateContent`, `streamGenerateContent`, model connection checks, SSE deltas, normalized Gemini usage metadata, and safe provider-specific error classification for authentication, quota, model availability, network, timeout, and malformed responses.
- Extracted CIPHER's logical instructions, JSON-shape guidance, examples, and operation token budgets into one provider-independent prompt module now used by Groq and Gemini, so provider adapters only translate the same domain request to their remote protocol.
- Added Gemini adapter and composition regressions for private credential use, endpoint construction, safe model identifiers, text extraction, streaming, model checks, normalized result provenance, and secret redaction.
- Added a shared provider-normalization layer for CIPHER adapters: finish reasons, model identity, response IDs, token usage, canonical transport results, JSON decoding, and provider failures now converge before reaching the neutral LLM port.
- Normalized token accounting from canonical, OpenAI-compatible, Gemini, and Ollama response shapes, deriving totals only when the provider omits them and discarding inconsistent usage instead of publishing false metrics.
- Added provider-neutral failure kinds for network, timeout, HTTP, authentication, quota, unavailable model, invalid response, and streaming failures. Availability classification now consumes these kinds while retaining Groq's established public codes and behavior.
- Migrated the Groq adapter to the shared result normalizers without changing its request schemas, streaming order, validation, timeout handling, public messages, or backward-compatible error class.
- Added focused regressions for cross-provider finish aliases, usage shapes, safe transport construction, response identifiers, JSON failures, neutral availability mapping, and unchanged Groq behavior.
- Replaced BROKER.95's single global CIPHER secret with provider-scoped API-key slots in VS Code `SecretStorage`, using stable keys that keep Groq, Gemini, and future remote-provider credentials isolated.
- Added separate private credential objects and public credential states; the Webview receives only credential kind, requirement, and configured presence, while credential values remain inside the Extension Host.
- Migrated the legacy global API key lazily and losslessly into Groq's provider slot, preferring an existing provider-specific value and removing obsolete secret entries on successful migration or deletion.
- Updated the Groq adapter to request its own provider credential explicitly and reject mismatched credential/provider pairs before performing network work.
- Added focused regressions for secret isolation, legacy migration, precedence, deletion, public redaction, malformed credentials, and protocol consistency without adding dependencies.
- Added a provider-neutral CIPHER model with stable provider identities, immutable capability descriptors, credential and endpoint kinds, and provider provenance on every normalized LLM result.
- Added an Extension Host provider registry that exposes only operational adapters, routes every CIPHER operation through the currently selected adapter, and rejects duplicate, mismatched, or unavailable registrations before network work.
- Added the provider selector to BROKER.95 Settings through the typed Host/Webview protocol. Groq remains the sole selectable production provider until each additional adapter is implemented and registered.
- Upgraded BROKER.95 settings and snapshots to schema v4: the selected provider is explicit and each provider retains its own model identifier while existing v1, v2, and v3 profiles migrate automatically without exposing or moving API keys.
- Extended the public settings projection with safe provider descriptors and credential requirements only; adapter objects, endpoints, secrets, and provider-private configuration remain inside the Extension Host.
- Added focused regressions for provider registration and routing, selection persistence, provider-specific models and credentials, unavailable selections, public protocol safety, result provenance, and settings migrations through v4.
- Decoupled the window rain from CIPHER availability so its tiled Kaplay layers keep falling while CIPHER is offline or connecting, while still pausing for reduced-motion preferences and hidden Webviews.
- Added a local procedural-audio system for BROKER.95 with eight bounded retro signals: CRT click, mechanical key, digital confirmation, alert, error, contract reception, payment, and CIPHER feedback. The Webview synthesizes them through Web Audio without packaged or downloaded audio files.
- Added accessible mute, global volume, and signal-preview controls to the BROKER.95 Settings panel, with typed Host/Webview updates, profile-global persistence, safe settings-v1 migration, cooldowns, source limits, and failure isolation so audio can never interrupt game state.

- Hardened `ai -review` and `ai -push` with exact response schemas, concise valid examples, larger operation-specific completion budgets, non-streaming review JSON, and one bounded repair attempt when CIPHER returns an invalid review or criterion score payload.
- Prevented transient CIPHER failures—invalid output, timeout, exhausted quota, provider errors, or network loss—from poisoning the configured model for every later command; only persistent credential and unavailable-model failures remain latched until configuration changes.
- Added an accessible two-state CIPHER display: clicking its monitor opens a centered enlarged scene, clicking it again returns to the thumbnail, and Escape closes the enlarged view.
- Renamed the root Webview project from `flow` to `frontend`, updating Extension Host asset resolution, build scripts, package metadata, publish boundaries, and tests without renaming flowchart-domain concepts.
- Removed free-form `ai <message>` conversation from the public BROKER.95 terminal so arbitrary text is rejected before availability checks, operation queues, streaming, or provider calls and cannot consume CIPHER quota accidentally.
- Allowed `ai -review` and `ai -push` to use either the active CLRS editor or an optional workspace-relative `.clrs` selector, including paths with spaces and explicit root-folder prefixes in multi-root workspaces.
- Preserved the last active CLRS document while focus moves into the BROKER.95 Webview, validated explicit selectors within the open workspace, and recaptured the same document identity before a definitive settlement.
- Corrected CIPHER's sprite-atlas coordinates so its eyes, mouth, expressions, and idle blink render inside the monitor again.
- Fixed narrow BROKER.95 layouts so panel tabs wrap without horizontal jumps and the terminal content remains before the footer instead of being covered by it.
- Added terminal and acceptance-corpus regressions for disabled free messages, zero accidental conversation calls, optional document selectors, quoted and unquoted paths, malformed quotes, empty selectors, and bounded selector length.
- Strengthened BROKER.95 contract generation with one shared, closed contract schema, an exact Spanish-content shape, a valid example, explicit client anonymity rules, declarative test-case fields, allowed comparison modes, and a prohibition on Host-authoritative fields.
- Enabled Groq strict Structured Outputs for compatible GPT-OSS 20B and 120B models; other models retain JSON Object Mode with the same detailed schema guidance and Host-side validation.
- Added one bounded automatic repair attempt after a domain validation failure. CIPHER receives the failed validation code and bounded previous draft, while the Host persists nothing until a fully valid contract is returned.
- Recorded generation attempt/recovery metadata and added regressions for named versus anonymous contracts, strict and fallback provider modes, successful repair, exhausted repair, immutability, and atomic persistence.

- Added the versioned BROKER.95 acceptance corpus with 96 uniquely identified scenarios and explicit coverage mapping for academic policy, the 115-category catalog, terminal commands, economy, output comparison, Host/Webview protocol, game lifecycle, local CLRS execution, and concurrency.
- Made the corpus executable through ten cross-module regressions that validate every documented terminal command and negative form, all risk weights and payout thresholds, both outcomes of every deterministic comparator, every Webview request type, six complete game transitions, persistence round trips, and idempotency behavior.
- Added real local CLRS programs to the corpus, including normal and boundary input cases, unordered output, and invalid-source handling; these cases use the production parser, document session, transpiler, process runner, and private test evaluator.
- Integrated the corpus as an isolated mandatory stage of `test:all`, exposed `test:broker95:corpus` for focused verification, and kept test fixtures out of the published VSIX through the existing package boundary. Its real CLRS child processes run separately from the parallel unit suite to avoid resource-contention flakes.
- Released BROKER.95 as an integrated CLRS Kit Español Webview with deterministic game state, its 115-category catalog, simulated `ai` terminal, persistent global profile, provider-neutral CIPHER integration with an initial Groq adapter, contract generation and lifecycle, local CLRS review/evaluation/push, economy, alert, statistics, accessibility, Kaplay presentation, hardened messaging, and idempotent concurrency.
- Preserved the current academic model exactly: Functionality, Robustness, and Design only; BROKER.95 neither evaluates Efficiency nor uses Big O as a scoring dimension, and it never embeds a second source-code editor.

- Completed the BROKER.95 concurrency and idempotency block with a reusable operation coordinator that deduplicates equivalent in-flight work, replays bounded successful results, removes failed attempts so they can be retried, and rejects reuse of one idempotency key with a different intent.
- Added independent exclusive lanes for contract selection/cycle commands, economy mutations, conversation, review, evaluation, and definitive push; operations sharing a resource now execute in invocation order while unrelated resources remain concurrent.
- Propagated the typed Webview request ID through the controller into contract and economy services, and extended contract generation, free conversation, review, evaluation, and push to coordinate the complete expensive operation before LLM calls, deterministic tests, or persistence rather than only serializing the final write.
- Made repeated successful intents state-idempotent: one contract is generated, one countermeasure is charged, one conversation turn is stored, one review/evaluation is computed, and one push is settled and paid even when equivalent calls arrive simultaneously or retry after completion during the Extension Host lifetime.
- Added canonical SHA-256 request fingerprints so collision checks retain no raw conversation or intent content, plus bounded result retention and structured Spanish conflict errors; persistent game and conversation revisions remain the final atomicity barrier.
- Added focused single-flight, lane isolation, retry, eviction, fingerprint privacy, key-collision, controller-correlation, contract, economy, conversation, review, evaluation, and no-double-payment regressions without adding dependencies.

- Completed the BROKER.95 Webview hardening block with a mode-specific deny-by-default CSP that disables Webview network connections, base URLs, frames, workers, objects, media, manifests, form navigation, and inline script attributes while preserving only packaged scripts, fonts, styles, images, and the narrowly required dynamic style attributes.
- Explicitly disabled command URIs and port mappings for the BROKER.95 panel, retained a single packaged-assets resource root, and added a no-referrer policy without moving LLM, persistence, filesystem, execution, or game authority out of the Extension Host.
- Added a Host-side request firewall after strict protocol decoding: request IDs are replay-protected with bounded memory, concurrent work is capped before it can grow the serialized operation queue, request frequency is limited in a sliding window, and every guard is reset with its panel lifecycle.
- Gave each Webview runtime a cryptographically generated client namespace for correlated request IDs, preventing valid identifiers from colliding across reloads while keeping every payload subject to the existing typed codec.
- Added focused CSP, Webview-capability, replay, backpressure, rate-limit, bounded-memory, lifecycle-reset, and client-correlation regressions; all rejections remain structured, recoverable, user-facing in Spanish, and developer-logged without exposing credentials.

- Completed the BROKER.95 accessibility and performance block with a keyboard-visible skip link, semantic tab/panel relationships, polite operation announcements, assertive failure/game-over announcements, an accessible alert progress value, and text alternatives independent from Kaplay or color.
- Added semantic progress values to risk distribution, technical profile, and specialty coverage; clarified repeated countermeasure controls with unique names and descriptions; disabled every submission path while its Host operation is busy; and added high-contrast, forced-colors, coarse-pointer, and comprehensive reduced-motion styles.
- Made the terminal preserve a reader's manual scroll position during streamed responses, exposed an explicit jump-to-latest control, kept its command and output busy states synchronized, and memoized immutable historical entries rather than rendering the entire bounded log for every CIPHER delta.
- Preserved frozen terminal-entry and CIPHER-signal identities across unrelated view updates and suppressed no-op panel selections, reducing React work without weakening the Webview store's immutability or making it authoritative.
- Paused the Kaplay loop when its scene leaves the viewport as well as when the Webview is hidden, removed repeated visual writes while reduced motion is active, added an accessible lazy-loading fallback, and removed the blocked Google Fonts request so all Webview typography uses local VS Code/system fonts.
- Added focused accessibility, visibility-lifecycle, immutable-identity, reduced-motion, and production-build regressions without adding dependencies.

- Completed the BROKER.95 panels block with an accessible tab model, visible selection state, contextual badges, and cyclic Arrow Left/Right plus Home/End keyboard navigation while keeping every panel as a projection of Host-owned state.
- Expanded the Contracts panel into an operational dossier that separates the active contract, pending inbox, and bounded recent outcomes, including risk, category, client, requirements, potential payment, and actual payout without exposing private test cases or evaluation details.
- Completed the local-data section in Settings with a deliberate two-step category-history cleanup and an Extension Host action that reveals the profile-level BROKER.95 data directory; the Webview still has no direct filesystem or persistence access.
- Added a deterministic category-history cleanup transition that preserves money, alert, contracts, statistics, and technical profile while retaining only the minimum lifecycle anchors required by pending and active contracts.
- Added focused domain, controller, bridge, panel-navigation, and production-build regressions for panel actions, protocol correlation, keyboard order, configuration indicators, and safe contract continuation after history cleanup.

- Completed the BROKER.95 CIPHER scene block with reactive expressions for offline, idle, attentive, working, successful, warning, and critical states, derived exclusively from the non-authoritative Webview projection.
- Added bounded transient CIPHER signals for accepted contracts, completed responses, successful deliveries, failed deliveries, Host errors, and game over; signals expire inside the visual adapter and never mutate contracts, alert, money, persistence, or LLM state.
- Expanded the local Kaplay composition with state-aware monitor color, discrete expression cycles, a CRT sweep, a status LED, alert-sensitive rain, and stable visual priority so urgent or critical states cannot be hidden by a positive cue.
- Preserved reduced-motion behavior, hidden-Webview pausing, late-load cancellation, structured asset failures, idempotent teardown, local-only assets, and accessible status outside the decorative canvas; added focused scene and Webview-signal regressions.
- Made the versioned public game-state projection idempotently decodable, so completed and failed contracts can cross the typed Host/Webview boundary repeatedly without exposing their private evaluation or being rejected during the Webview's defensive validation pass.

- Completed the BROKER.95 free-conversation block: `ai <message>` now reaches CIPHER through the neutral LLM port, streams its Spanish diegetic response, and remains independent from review and push of the active CLRS document.
- Added a compact, immutable Host-built conversation context with current game progress, alert, active contract, latest outcome, adaptive CIPHER tone, and explicit Host authority boundaries; source code, private test cases, metadata, credentials, and mutation capabilities never cross into the chat request.
- Connected the existing bounded profile history to free conversation transactionally: only validated user/CIPHER pairs are persisted, provider failures leave no orphan messages, and old turns continue to be evicted as complete pairs.
- Added a JSON-aware stream decoder so the terminal displays only CIPHER's `message` text instead of provider protocol fragments, including escaped quotes, newlines, and split Unicode escapes.
- Closing the BROKER.95 Webview now aborts an active free-conversation request, while request IDs, stream IDs, and busy/idle status remain correlated through the typed Host/Webview protocol.

- Completed the BROKER.95 statistics block with a versioned, deeply immutable Host-derived view for accumulated outcomes, success rate, earnings, current balance, alert, risk distribution, specialties, and technical profile.
- Added all 12 canonical algorithmic families to the statistics view from the beginning, including zero-valued specialties and a verifiable coverage percentage based on categories completed at least once rather than an arbitrary contract multiplier.
- Expanded the independent Statistics panel with six summary metrics, completed/failed risk bars, the three unweighted academic profile dimensions with sample counts, and a responsive specialty dashboard; Efficiency remains absent from the model and interface.
- Added final-statistics behavior for game over: entering or restoring a terminated run now opens the accumulated dossier automatically while preserving historical statistics and showing the lost current balance separately from total earnings.

- Completed the deterministic BROKER.95 economy and alert flow with the four specified countermeasures: trace scrubbing, infrastructure change, identity burn, and investigator bribery.
- Added an authoritative Host economy service that serializes and persists purchases, charges their full price immediately, clamps alert reduction at zero, and rejects insufficient funds, zero-alert purchases, invalid rules, and purchases after game over without mutating the game.
- Added a public derived economy snapshot with canonical prices, effects, affordability, availability, and safe blocking reasons; the Webview can submit only a countermeasure ID and cannot authoritatively set money, alert, discounts, or game status.
- Added a responsive Economy panel with balance and alert summaries, purchase controls, unavailable-state explanations, game-over presentation, correlated terminal receipts, and focused domain, protocol, controller, Webview, and composition regressions.

- Implemented `ai -push` as the definitive BROKER.95 submission flow over one fixed CLRS snapshot: deterministic tests, static evidence, validated CIPHER scoring, Host aggregation, and settlement now execute through the existing Extension Host boundaries.
- Added an atomic push service that rechecks the active document inside the settlement transaction and requires the exact game revision observed by the evaluation; changed documents, stale sessions, provider failures, and invalid results leave the contract, balance, profile, and statistics untouched.
- Reused the deterministic settlement rules to calculate payout, close the contract as `completed` or `failed`, update balance, technical profile, category history, and statistics exactly once, preventing a repeated push from paying twice.
- Added a definitive terminal report with test totals, active dimension weights, all scored subcriteria, final score, payout percentage, received payment, current balance, CIPHER summary, and bounded findings without exposing private inputs, expected outputs, local document identity, or source hashes.
- Added a capture-aware evaluation entry point so `ai -push` evaluates the document version already fixed by the Host without reading the editor a second time before analysis.
- Added regressions for successful and rejected settlements, exact payout bands, duplicate delivery, document changes, revision conflicts, provider failures, private-oracle isolation, command correlation, immutable failure paths, and Extension Host composition.

- Added the BROKER.95 scoring rubric for all 12 academic subcriteria with their official base points, internal dimension proportions, risk-selected dimensions, and Host-calculated aggregate/final scores.
- Added deterministic scoring anchors for requirement coverage plus normal, boundary, and invalid test outcomes, with explicit confidence; structural and control-flow metrics remain `signals-only` and cannot become automatic penalties.
- Added a strict CIPHER evaluation response containing only a summary, every active criterion exactly once, an integer score from 0 to 100 with evidence and rationale, and bounded actionable findings.
- Kept scoring authority split deliberately: CIPHER chooses justified subcriterion scores, while the Host rejects missing, duplicate, inactive, injected, or malformed scores and independently calculates dimension and final scores.
- Added a Host-only final-evaluation service over one exact CLRS snapshot, deterministic tests, static evidence, compact private-safe context, and the provider-neutral LLM port; this block does not calculate payout, settle the contract, or mutate persistent state.
- Added regressions for the official weighting arithmetic, anchor confidence, response completeness, inactive dimensions, aggregate-field injection, privacy, unavailable CIPHER, shared-snapshot integrity, immutable state, and Extension Host composition.

- Implemented `ai -review` as a repeatable, non-definitive BROKER.95 tutoring flow over the active CLRS document: one exact snapshot now feeds parser diagnostics, deterministic contract tests, static evidence, and CIPHER without editing the source or mutating the game.
- Added a strict versioned review response with readiness, bounded actionable findings, active risk criteria, and next steps; unknown fields, scores, inactive criteria, and malformed findings are rejected before presentation.
- Added compact LLM review context that omits local document identity, test inputs, expected answers, payment authority, alert authority, Efficiency, and Big O while preserving actual test outcomes and objective structural evidence needed for feedback.
- Presented validated reviews through the existing CIPHER terminal stream with Spanish tutor-oriented formatting, busy/idle serialization, exact request correlation, and no review data added to persistent game state or the public Webview snapshot.
- Added regressions for shared-snapshot integrity, privacy, unavailable CIPHER, missing active contracts, strict response validation, deterministic-state immutability, controller routing, and Extension Host composition.

- Added versioned, immutable BROKER.95 static evidence derived from the exact shared CLRS document snapshot, without re-parsing the same document version or exposing its URI, source code, AST, or semantic objects.
- Added per-function and global structural metrics for cyclomatic complexity, control nesting, statements, decisions, logical condition connectors, loops, assignments, calls, input/output, indexed accesses, divisions, symbols, and unused declarations.
- Added a deterministic user/builtin call graph with call-site counts, arity observations, entry-point reachability, unused-function detection, and direct or mutual recursive components.
- Added objective findings for unused variables, parameters, functions, and unreachable statements while keeping metric thresholds and criterion hints as contextual evidence rather than automatic penalties or scores.
- Added input-validation candidates plus division, bounds, and loop sites with explicit `candidate-only` or `not-analyzed` proof states, preventing absent proof from being misreported as a defect.
- Added static-evidence composition and regressions for snapshot reuse, malformed source, call reachability, recursion, privacy, immutability, and the complete separation from game state and scoring.

- Added a shared BROKER.95 comparison domain for exact and normalized text, ordered or unordered lines, finite numbers, absolute tolerances, structural JSON, ordered or multiset arrays, booleans, containment, and restricted safe regular expressions.
- Moved expected-output validation to contract ingestion, so incompatible numeric, tolerance, JSON, array, boolean, containment, or regex oracles from CIPHER are rejected before persistence or local execution.
- Added explicit expected-value formats to CIPHER's deterministic contract-generation schema while keeping the Host authoritative over accepted comparison modes and limits.
- Corrected structural edge cases including valid JSON `null`, object-key order, duplicate preservation in unordered collections, CRLF normalization, inclusive tolerance boundaries, and numeric equivalence between `-0` and `0`.
- Added positive, negative, malformed-oracle, regex-safety, and pre-persistence regression coverage for the complete comparison catalog.

- Added the deterministic BROKER.95 CLRS test executor: the Host runs each declarative contract case against one exact active-document capture in a temporary local Node process with bounded stdin, output, per-case timeout, and total execution budget.
- Added deterministic comparators for exact text, whitespace, lines, numbers, numeric tolerances, JSON, ordered/unordered arrays, booleans, containment, and restricted linear-safe regular expressions; result data remains Host-only and excludes test inputs and expected answers.
- Added a non-interactive CLRS runtime mode used only by the executor, so automated `leer` cases consume stdin without emitting the interactive prompt; normal editor/runtime execution is unchanged.
- Kept test execution independent from contract settlement, persistence, the Webview, and CIPHER: it neither mutates the game nor exposes source, private cases, expected outputs, or results through the public protocol.

- Added a Host-only immutable capture of the active CLRS document for future BROKER.95 reviews and final pushes, preserving the exact editor version, source hash, source, language diagnostics, and deterministic static facts through the shared document-analysis service.
- Added a CIPHER-safe document projection that deliberately omits the VS Code URI, local document identity, and Host capture timestamp; the Webview still receives no source code or Host-only capture data.
- Kept document capture independent from contracts and editor writes: it neither saves nor changes the source and allows incomplete CLRS syntax so a future review can explain how to correct it.
- Added capture regressions for active-language validation, source limits, shared analysis reuse, immutable snapshots, sanitized LLM context, and VS Code editor adaptation.

- Added the deterministic BROKER.95 contract cycle to the simulated `ai` terminal: request, list, inspect, accept, delete, purge, and status commands now operate through the persisted game session.
- Added serialized terminal operations, busy/idle feedback, bounded Host-generated terminal entries, and public Spanish responses for the contract lifecycle while preserving English implementation diagnostics.
- Kept proposed test cases, internal metadata, detailed evaluations, and provider data out of terminal output and the Webview; `ai -review`, `ai -push`, and free CIPHER chat remain explicitly reserved for later blocks.
- Added contract-cycle regressions for generation, risk acceptance, alert changes, deletion, purge, unsupported future operations, and Host-only test-case secrecy.

- Added declarative BROKER.95 test cases proposed by CIPHER, with a strict bounded schema for ID, kind, linked requirements, standard input, expected output, comparison, and timeout.
- Added Host validation for test-count and data-size limits, unique case and requirement IDs, known requirement references, whitelisted comparisons, bounded timeouts, and rejection of executable fields or an Efficiency dimension.
- Persisted validated test cases only in the Host contract model and added a public-game-state projection that removes test cases, internal metadata, and detailed evaluation data before a state reaches the BROKER.95 Webview.
- Added regressions for normal, boundary, and invalid-input cases; malformed fields; comparison and timeout limits; requirement references; immutable persistence; and protocol secrecy.

- Added deterministic BROKER.95 contract generation: the Host selects risk, category, family, client policy, final ID, and exact payment potential before asking CIPHER only for narrative content.
- Added strict contract-draft validation with bounded title, description, client, and requirement fields; LLM attempts to inject identity, risk, payment, state, evaluation, or an Efficiency dimension are rejected before persistence.
- Added a transactional contract-generation service that persists only a validated draft through the existing game session and leaves the game unchanged when CIPHER is unavailable or returns an invalid response.
- Added focused contract-generation regressions for Host authority, anonymous high-risk clients, prompt boundaries, deterministic payment selection, invalid proposals, and unavailable CIPHER.

- Began the modular BROKER.95 foundation with an immutable deterministic game state, contract lifecycle, risk, alert, payment, statistics, technical-profile, and category-history rules based exclusively on Functionality, Robustness, and Design.
- Added the canonical catalog of 115 algorithmic categories and 12 families, with deterministic difficulty filtering and history-aware category selection.
- Added a strict parser for the simulated `ai` terminal command set, including canonical risks and IDs, arity validation, source locations, and explicit LLM/document requirements.
- Added a versioned and direction-specific Host/Webview protocol whose strict envelopes prevent the Webview from authoritatively supplying game state or public configuration from carrying API credentials.
- Added one persistent BROKER.95 game per VS Code profile through `ExtensionContext.globalState`, with versioned snapshots, explicit legacy migration, optimistic revisions, serialized durable transactions, bounded corrupt-state quarantine, and non-destructive handling of future versions.
- Added regression coverage for persistence restoration, migration, recovery, storage failures, concurrent transitions, stale revisions, and Extension Host composition.
- Added versioned, profile-global BROKER.95 settings with an intentionally empty default model, explicit legacy migration, non-destructive future-version handling, and safe recovery metadata that never copies values from a corrupt snapshot.
- Stored the BROKER.95 API key exclusively through VS Code `SecretStorage`; public settings, protocol events, initialization results, logs, global storage, and the exported extension surface expose only `hasApiKey`.
- Added deterministic local CIPHER availability for missing-model, missing-key, and ready states, plus an internal-only resolver for the future LLM adapter.
- Added regression coverage for model persistence, secure credential creation/deletion, secret-storage failures, public event safety, corrupt legacy credentials, configuration migration, and Extension Host composition.
- Added a versioned, profile-global BROKER.95 conversation history bounded to 48 complete player/CIPHER turns, 131,072 total characters, and 65,536 characters per message.
- Made retention deterministic and pair-atomic: the oldest complete turns are removed first, failed answers never leave orphan player messages, and clearing history preserves monotonic turn IDs.
- Kept system/developer prompts outside persistent history and exposed only a content-free summary through the public extension surface; full turns remain private to the future Host/LLM coordinator.
- Added strict history serialization, legacy migration, bounded-retention rewrites, non-destructive future-version handling, metadata-only corrupt-state quarantine, serialized concurrent writes, and regression coverage for every persistence boundary.
- Added the contributed `Jugar BROKER.95` command and CLRS editor-title button with the VS Code `game` icon, opening one reusable global game panel beside the editor.
- Composed a dedicated BROKER.95 Host adapter, command controller, and lifecycle registration without coupling the panel to an active CLRS document or reusing the flow-diagram Webview.
- Added a minimal CSP-protected bootstrap shell that performs the canonical typed protocol handshake and receives only the persisted deterministic game snapshot, public settings, and local CIPHER availability after every Host service is ready.
- Added safe live forwarding for deterministic game/configuration changes, correlated recoverable protocol errors, idempotent panel disposal, and regression coverage for singleton reuse and Extension Host composition.
- Replaced the provisional BROKER.95 bootstrap with a dedicated React Webview mode in the shared Vite build, preserving the reusable singleton panel and the canonical typed Host/Webview protocol.
- Added a non-authoritative Webview bridge and immutable view store with strict message decoding, correlated requests, bounded terminal rendering, stream assembly, reconnection-safe snapshots, and no access to VS Code capabilities outside the Extension Host.
- Added the first responsive BROKER.95 interface: game header, money and alert indicators, CIPHER connection state, simulated `ai` terminal, active-contract view, deterministic statistics, and minimum model/API-key settings without an embedded source editor.
- Connected public model updates and secure API-key creation/deletion to the existing Host configuration service; credentials remain ephemeral in the form and are never echoed into protocol state, logs, persistence, or rendered settings.
- Hardened the shared Webview document with an explicit content-security policy and declarative mode metadata, and added keyboard, screen-reader, small-screen, and reduced-motion behavior to the BROKER.95 shell.
- Isolated the diagram composition behind its own lazy Webview root, so opening BROKER.95 does not initialize or eagerly load Mermaid and the flow-diagram services.
- Added focused bridge, store, terminal-retention, settings-secrecy, and Webview composition regressions.
- Added locally bundled Kaplay 3001.0.19 and the supplied BROKER.95 room, rain, and nine-expression CIPHER artwork; no visual resource is fetched from the network at runtime.
- Added an isolated Kaplay scene adapter that owns only visual state: room composition, cropped window rain, monitor glow, discrete CIPHER expressions, hidden-panel pausing, reduced-motion behavior, and idempotent teardown.
- Derived CIPHER expressions from the existing non-authoritative Webview state while keeping contracts, money, alert, commands, persistence, and all game decisions outside Kaplay.
- Added a React canvas boundary with an accessible adjacent status, a safe Spanish fallback when the visual engine fails, English implementation-only logging, and a CSP allowance limited to local Webview asset loading.
- Added Kaplay regressions for visual-state priority, local asset inclusion, nine-frame loading, animation control, late-mount cancellation, visibility pausing, and singleton cleanup.
- Added a provider-neutral, versioned BROKER.95 LLM port for contract generation, submission review, final evaluation, conversation, and connection testing without coupling the domain to Groq, HTTP, or SSE.
- Added immutable request/result models that keep API credentials outside the port boundary, carry only bounded JSON-safe context and conversation history, and normalize provider-independent response metadata and token usage.
- Added strict response validation for critical JSON, chat, and connection outputs, including size/depth limits, exact chat and connection schemas, unsafe-key rejection, and structured Spanish-facing/English-technical errors.
- Added shared cancellation and ordered streaming deltas for review and chat while preserving a single validated final result, plus focused regressions for all five operations and malformed or aborted exchanges.
- Added the initial Groq adapter inside the Extension Host, using the configured model and API key only through the existing private configuration service; neither the Webview nor persistent game state receives provider credentials.
- Added JSON-object chat completions for contracts, reviews, evaluations, and CIPHER conversation, a lightweight model retrieval connection check, bounded request timeouts, external cancellation, sanitized English technical logging, and Spanish public error surfaces.
- Added a standalone SSE reader that safely handles fragmented and multiline events, bounded payloads, `[DONE]`, and cancellation; review and conversation can now stream ordered deltas while the final structured result remains validated by the neutral port.
- Added canonical CIPHER availability states for missing model/API key, offline connection, exhausted quota, authentication failure, unavailable model, timeout, provider failure, and invalid provider responses.
- Added a non-persistent availability service that resets after a configuration change, publishes only safe status data to the Webview, and turns provider failures into distinct Spanish recovery messages while retaining their technical cause for Host diagnostics.
- Blocked `ai -new`, `ai -review`, `ai -push`, and free CIPHER chat before any future LLM/game action when CIPHER is unavailable; in particular, a blocked push cannot mutate the active contract or persistent game state.

## [1.3.9] - 2026-08-08

- Added a soundness firewall for complexity results: dead code after `retornar` no longer contributes recursive calls, recurrence solutions require a reachable base case and a well-founded guarded measure, and fixed-size best-case analysis no longer confuses the base case with an asymptotic scenario.
- Added a shared control-flow graph, SSA states, phi alternatives, path constraints, relational contexts, and loop back-edges for complexity, iteration, and recurrence analysis.
- Added normalized affine algebra and a shared complexity domain that preserve cancellation, eventual sign, multivariate differences, conservative bound kinds, and the correct growth hierarchy between iterated logarithms, logarithms, and polynomials.
- Added trajectory-based loop transitions, symbolic poststates, and symbolic summation of per-iteration work, allowing later phases to consume the real final state of additive and geometric progressions.
- Added scenario-aware recurrence termination proofs, fixed-size best/worst recurrence solving, reachable-boundary validation, and size-change reasoning for mutually recursive SCCs whose composed cycle decreases even when an individual edge is neutral.
- Added parametric interprocedural summaries that classify a user function once over its formal measures and instantiate only the free variables used by the resulting asymptotic order.
- Prevented missing, extra, or unclassifiable arguments from poisoning a caller when the corresponding parameter is irrelevant to the propagated order; relevant missing arguments still produce `CLRS_ASYMPTOTIC_CALL_ARGUMENT_MISSING`.
- Added semantic summary caching independent from ephemeral caller IDs while retaining independent formal-to-actual bindings and source provenance for every call site.
- Extended asymptotic composition through direct recursion and mutual SCC results, including nested iterated logarithms such as `O(log log n)` applied to `LOG2(m)`, which now becomes `O(log log log m)`.
- Preserved upper/lower-bound metadata, asymptotic conditions, and proof evidence across interprocedural composition instead of accidentally strengthening a conservative result into a tight one.
- Extended interprocedural provenance with required parameters, ignored parameters, irrelevant missing arguments, free order variables, and the concrete asymptotic replacements used by each transfer.
- Added executable complexity coverage per selected function and per best/worst scenario. `PRINCIPAL` is selected by default when present, while every function remains independently queryable.
- Replaced metadata-only coverage accounting with verified observations from the CLRS corpus. Expected causes, unexpected causes, declared resolutions, notation, and outcomes are checked for every executable case.
- Corrected the catalog metrics so a cause declared resolved remains pending when it is still observed in another scenario; the current matrix contains 26 executable cases, 17 characterized catalog causes, 4 verified resolutions, 13 unresolved characterized causes, and 30 pending causes.
- Added explicit lower-bound coverage results and prevented unknown or unqualified proof scopes from being presented as exact complexity.
- Added a proof-verification section to the complexity webview with confidence, bound scope, conditions, and supporting evidence for each best/worst conclusion.
- Improved interprocedural report rendering so irrelevant missing parameters are informational rather than errors and propagated order replacements are visible in the nested trace.
- Fixed KaTeX generation for iterated logarithms: `log log n` is now emitted as correctly nested logarithms instead of `log(log) n`.
- Expanded regression coverage for dead recursion, recurrence soundness, CFG/SSA propagation, relational loops, trajectory summation, parameter-selective interprocedural calls, semantic-cache reuse, nested logarithm composition, executable coverage verification, and honest result presentation.
- Updated the README, package manifests, built webview, and release metadata for version 1.3.9.

## [1.3.8] - 2026-08-07

- Added immutable interprocedural provenance for user-function cost resolution, preserving each caller/callee link, formal-to-actual parameter binding, instantiated cost expression, reuse from cache, and the resulting asymptotic order or structured cause.
- Exposed queryable provenance traces without changing the historical serialized cost-report contract, including unresolved calls with their missing arguments and recursive resolution strategy.
- Added a collapsible complexity-report section that visualizes nested user-function propagation, symbolic substitutions, and source navigation only when a function actually delegates cost to another user function.
- Added generalized power-reduction recurrences for direct parameter measures of the form `T(n^r)`, with `0 < r < 1`, including standard roots and explicit constant powers.
- Solved verified constant-branch power recurrences through the `m = log n` transformation: `T(√n)` now produces `O(log log n)`, while repeated `T(√n)` branches produce the corresponding logarithmic power.
- Preserved immutable power-reduction characteristics and proof evidence, and made iterated-logarithmic orders compose safely through user-function arguments such as `RAIZ_RECURSIVA(m)`.
- Marked the executable square-root recurrence as resolved while retaining unsupported interval measures, variable coefficients, mixed reductions, and non-equivalent arguments as structured unknowns.
- Added conservative asymptotic summation families for unit-step, constant-lower-bound ranges with a linear upper measure. Harmonic, polynomial, logarithmic, and explicit geometric summands now retain a demonstrated order without expanding the visible symbolic sum.
- Resolved the executable harmonic corpus scenario as `O(n log n)` and made its bound index an internal asymptotic fact, so the report no longer exposes the local `i != 0` condition as a caller assumption.
- Kept singular zero-start sums, self-dependent bounds, non-unit steps, and unsupported special factors unresolved rather than extrapolating an asymptotic closure.
- Added a conservative nonlinear-loop recognizer for monotonic polynomial guards such as `i ^ k < n` and `i * i < n`. With a known non-negative initial value and a direct positive additive update, it derives the corresponding root bound.
- Added a verified power-progression recognizer for `i = i ^ k` with exponent `k > 1`, an initial value greater than one, and a fixed upper guard. These loops now retain their iterated-logarithmic `O(log log n)` order.
- Preserved nonlinear assumptions, transition evidence, progression metadata, and loop invariants in the existing non-enumerable iteration model; unproven starts, altered control variables, or unsupported nonlinear forms remain deliberately unresolved.
- Updated the executable coverage corpus and regressions for square-root guards, repeated multiplication spelling, and power updates, without widening unsupported `O(?)` results.
- Added a bounded relational loop domain for interval-halving loops. It recognizes the canonical binary-search shape `p <= r`, `q = PISO((p + r) / 2)`, and opposite endpoint updates that discard the midpoint.
- Preserved the relational measure, midpoint, branch offsets, invariant proof, assumptions, and termination evidence on the iteration model; valid binary-search intervals now produce `O(log n)`.
- Kept the recognition deliberately conservative: a branch that can retain its midpoint or an unsupported control-flow shape remains unresolved instead of being classified as logarithmic.
- Marked the binary-search corpus case as resolved; the coverage matrix now reports 3 resolved causes and 9 characterized-but-unresolved causes.
- Preserved the lexical binding of non-zero loop indices when a dependent nested cost cannot yet be closed algebraically, preventing an unsafe global substitution from understating the complexity.
- Extended degree-two symbolic summations to constant lower bounds by translating their bound index, while retaining unclosed expressions as explicit bound summations.
- Expanded the executable complexity corpus from 15 to 22 scenarios, adding harmonic sums, nonlinear guards and updates, binary-search intervals, Euclidean reduction, nonlinear recurrences, and mixed variable recurrences with their current structured causes and intended resolution blocks.
- Updated the README, package manifests, built webview, and release metadata for version 1.3.8.

## [1.3.7] - 2026-08-07

- Added an immutable result-presentation model that preserves the historical Big O fields while communicating tight orders as `Θ`, upper bounds as `O`, lower bounds as `Ω`, and unsupported results as `No determinado`.
- Replaced ambiguous confidence text in the complexity webview with explicit conclusion cards for tight, conditional, conservative structural, upper-bound, lower-bound, unqualified, and unknown results.
- Kept every conditioned conclusion visibly qualified and retained its required assumptions, while unknown results continue to expose their structured causes instead of presenting `O(?)` as a valid formula.
- Added an advanced recurrence solver for variable branching over constant decrements, including generalized factorial products such as `n T(n - 2) = O(n^0.25 (n!)^0.5)`.
- Added quasi-polynomial recurrence orders for divisive variable branching such as `n T(n / 2) = O(n^(0.5 log_2 n + 0.5))`, including safe composition through polynomial arguments of user-function calls and KaTeX report formatting.
- Added conservative upper bounds for mixed additive and divisive reductions; `T(n) = T(n - 1) + T(n / 2)` is now reported as a demonstrated `O(2^n)` upper bound instead of `O(?)`.
- Preserved recurrence method, characteristic, tightness, and proof evidence in the analysis model and complexity report; the webview now distinguishes tight solutions from conservative recurrence bounds.
- Updated the executable complexity matrix to mark mixed recurrence reduction as resolved and added regression coverage that rejects unsound factorial closure when the branching factor depends on a different input measure.
- Added conditional asymptotic algebra: logarithms, quotients, inverse powers, roots, and factorials now retain a demonstrated order together with the eventual domain conditions it needs, instead of collapsing a supported result into `O(?)`.
- Added immutable, canonical asymptotic-condition models with explicit discharge through constants, standard-library structural facts, symbolic substitutions, and caller-provided assumptions.
- Extended the complexity report and its webview with a distinct conditional status and an in-place list of asymptotic conditions, while keeping unresolved causes exclusive to genuinely unknown analyses.
- Added support for inverse polynomial and logarithmic powers when no special factor must be inverted, preserving their non-zero-base condition in the result.
- Added characterization coverage for conditional orders, explicit condition discharge, quotient and inverse-power algebra, and report presentation.
- Added symbolic summations to the cost algebra, including immutable bounds, a bound index, formatting, KaTeX rendering, canonical substitution without index capture, and safe polynomial closures up to degree two.
- Applied symbolic summation to tight, unit-step ascending loops beginning at zero; triangular nested loops now retain a closed polynomial cost instead of multiplying an outer count by a free inner index.
- Preserved the former product-based loop cost whenever a summation cannot be safely closed, preventing a loss of existing asymptotic results.
- Added immutable loop-transition and invariant models that preserve the control variable, guard, initial value, bound, update, path coverage, and proof evidence used by termination analysis.
- Attached loop transitions and invariant proofs to iteration and termination models without changing the historical serialized cost report.
- Proved terminating equality loops such as `mientras i != LONG(A)` when a unit integral transition advances toward the target; non-integral or potentially overshooting cases remain conservative.
- Added conservative semantic summaries for user functions: complete, side-effect-free return paths now instantiate with real abstract arguments across direct and nested calls.
- Propagated safe user-function return summaries into iteration and recurrence extraction, resolving supported updates such as `i = MITAD(i)` to their symbolic form without treating recursive, mutable, incomplete, or effectful functions as transparent.
- Extended the complexity coverage matrix to distinguish a catalog cause that has been resolved from causes still reproduced by unresolved scenarios.
- Added regression coverage for direct and nested summaries, parameter mutation, and dependencies whose observable effects keep an outer summary opaque.
- Added a shared abstract domain for complexity analysis: immutable symbolic values now carry safe intervals, sign, integrality, structural-size facts, and path constraints.
- Propagated abstract path facts through conditional branches, loop bodies, and recurrence-input extraction; impossible branches are skipped without changing the historical cost-report contract.
- Recognized standard-library symbolic effects such as `LONG`, rounding, absolute value, extrema, roots, logarithms, exponentials, and bounded functions in the shared domain.
- Added characterization tests for structural measures, branch refinement, conservative range joins, impossible loops, and unreachable recursive calls.
- Added a verified complexity-coverage matrix that distinguishes exact results, conservative upper bounds, conditional termination, proven non-termination, semantic errors, and unresolved analyses.
- Added a baseline of 15 executable CLRS scenarios and catalog metrics that now report 10 characterized causes, 2 resolved causes, and 29 pending `O(?)` causes, so future analyzer blocks can demonstrate measurable coverage gains.
- Updated the README, package manifests, built webview, and release metadata for version 1.3.7.

## [1.3.6] - 2026-08-07

- Rejected duplicate user-function declarations through the semantic analyzer, with a Spanish diagnostic and the precise location of the repeated identifier.
- Replaced the flowchart webview's timing-dependent initial source delivery with a readiness handshake, so the first opening renders the current document without requiring an edit or save.
- Restored inline local-cost decorations for `si`, `sino si`, `sino`, `mientras`, and ascending or descending `para` blocks, while keeping function-level Big O decorations disabled.
- Updated the README and package manifests for version 1.3.6.

## [1.3.5] - 2026-08-04

- Made the `Ver análisis de complejidad` CodeLens follow the same show/hide state as the algorithmic-cost decorations.
- Added a version-aware algorithmic-complexity report webview backed by the shared document-analysis snapshot, without duplicating frontend, semantic, or cost analysis.
- Added per-function selection, source navigation, collapsible best/worst-case sections, known/partial/unknown status, confidence, assumptions, evidence, and structured unresolved causes.
- Added a dedicated cost-expression LaTeX formatter and KaTeX rendering for original, algebraically simplified, and asymptotic formulas.
- Added an explanatory three-stage simplification trail and a compact, source-navigable local call graph when direct calls provide useful context.
- Added an editor-title action for the complexity report immediately after the local-cost toggle.
- Replaced expression-bearing CodeLens entries with `Ver análisis de complejidad` links on function declarations.
- Removed inline Big O decorations from functions and control blocks while preserving optional per-instruction local costs.
- Added structured loop-termination analysis with guaranteed, possible, non-terminating, and unknown states, including source-linked evidence and ranking functions.
- Added immutable path summaries for continuing, returning, and unknown paths, exposed through the existing non-enumerable iteration-analysis model.
- Evaluated constant Boolean, logical, and numeric comparison conditions to remove infeasible branches before composing loop updates.
- Recognized initially false loops as zero iterations, always-true loops without exits as non-terminating, and loops whose every path returns as constant upper bounds.
- Combined early-return paths with continuing paths that decrease a ranking function, preserving a finite worst-case bound when termination remains guaranteed.
- Applied early-exit analysis to both `mientras` and `para` loops and added a structured cause for conditionally terminating infinite loops.
- Added a canonical symbolic environment with immutable bindings, transitive dependency metadata, branch joins, and queryable snapshots captured before every analyzed loop.
- Preserved bindings after conditionals when every path produces an algebraically equivalent value, while invalidating genuinely ambiguous branch state.
- Added path-sensitive symbolic execution for loop bodies, including sequential assignments, recalculated temporaries, and correlated conditional alternatives.
- Composed multiple additive, multiplicative, and affine updates within one iteration, classifying affine growth as logarithmic when its fixed-point domain is safe.
- Analyzed loops whose two condition endpoints move by reducing their combined updates to a relative-distance progression.
- Added explicit upper-bound metadata when branch-dependent progress rates differ, plus structured causes for incomplete, conflicting, or excessively numerous update paths.
- Added an executable catalog for every current `O(?)` cause, classified by analysis phase, limitation category, and recovery strategy.
- Added a characterization corpus for unresolved iteration, symbolic-value, call-graph, and recurrence cases, including the analysis block expected to resolve each case later.
- Added non-enumerable unknown-complexity models with source locations, affected scenario, and causal links between primary analysis failures and derived `O(?)` results.
- Added immutable `ScenarioCost` values carrying best- and worst-case expressions, simplified forms, assumptions, evidence, and confidence levels.
- Added minimum expressions to the cost algebra, conservative simplification, formatting, and asymptotic classification, including an explicit result for incomparable size measures.
- Propagated scenario costs through instructions, sequences, functions, conditional branches, implicit fallthrough paths, and analyzed loops.
- Added queryable best/worst asymptotic models and non-enumerable `bestBigO` and `worstBigO` node metadata while preserving the historical `bigO` field as worst-case output.
- Added immutable, queryable cost summaries for user functions, with formal parameters and independent best- and worst-case expressions.
- Added simultaneous parameter substitution that prevents binding capture, preserves recurrence metadata, accepts JavaScript-style extra arguments, and reports missing or invalid parameters as structured `O(?)` causes.
- Propagated actual cost arguments through nested user-function calls, including structural measures such as `LONG(A)` and algebraic inputs such as `m^2`.
- Composed solved recursive orders with their actual call measures, including polynomial, logarithmic, exponential, factorial, and interval-based recurrence results.
- Enabled best-case propagation through user functions without reusing worst-case summaries.
- Added conservative fallbacks for unsupported special-order composition and unresolved recursive summaries while retaining the detailed recurrence cause.
- Added an immutable user-function call graph with source-linked edges, Tarjan strongly connected components, dependency-first evaluation order, and query APIs for incoming and outgoing calls.
- Added non-enumerable SCC metadata to function cost nodes and a queryable call-graph model without changing historical JSON reports.
- Added compatible-measure inference across mutually recursive functions, including different parameter names and interval candidates.
- Resolved uniform mutual recursion over additive and divisive reductions, including cycles of more than two functions and propagation through actual caller arguments.
- Added explicit base-case evidence checks based on best-case scenario expressions before accepting a mutually recursive component as terminating.
- Added an immutable normalized recurrence-system model that preserves equations, tolls, coefficients, reductions, branch envelopes, and the SCC source component.
- Added spectral matrix solving for additive systems, including characteristic exponential roots for mutually recursive branching.
- Added spectral exponent solving for divide-and-conquer systems and polynomial-toll comparison across mutually recursive functions.
- Solved mutually exclusive recurrence branches as independent system variants before computing their asymptotic envelope, avoiding false coefficient inflation; oversized variant spaces retain an explicit conservative upper bound.
- Added exact reduction composition for deterministic mixed cycles and explicitly labeled conservative upper bounds for general mixed systems.
- Exposed the recurrence system, characteristic value, bound kind, and tightness through the non-enumerable recurrence and call-graph analysis models.
- Added structured `O(?)` causes for missing SCC measures, variable system coefficients, absent base cases, numeric limits, and unresolved recurrence systems.
- Added a deterministic canonical cost-expression layer that flattens associative operations, orders commutative operands, combines coefficients and powers, and deduplicates nested minima and maxima.
- Added canonical expression keys and equivalence checks as the stable symbolic identity required by future parametrized user-function summaries.
- Attached canonical expressions and keys as non-enumerable node metadata and added canonical best/worst forms to `ScenarioCost` without changing historical cost strings or JSON output.
- Used canonical identity when comparing symbolic loop bounds and structural size measures, so reordered but equivalent expressions no longer create false conflicts or duplicate size variables.
- Kept canonicalization structural and non-distributive to prevent exponential term expansion; the existing simplified expression and visible Big O ordering remain unchanged.
- Updated the README and package manifests for version 1.3.5.

## [1.3.4] - 2026-08-02

- Added distinct Step Into, Step Over, and Step Out semantics based on the active CLRS call-frame depth.
- Added conditional breakpoints with safe, scope-aware CLRS expression evaluation and side-effect-free standard-library calls.
- Added hit-count breakpoints supporting exact, relational, and modulo filters while preserving counters across triggered-breakpoint activation.
- Added logpoints with CLRS expression interpolation, escaped literal braces, source-linked Debug Console output, and no execution pause.
- Added stable breakpoint identifiers and reported `hitBreakpointIds` so VS Code triggered breakpoints activate through the standard client workflow.
- Added validation in Spanish for unsupported or malformed breakpoint expressions while retaining English internal adapter logs.
- Enabled editor-gutter breakpoints for CLRS documents and made debugger sessions stop on the first executable location by default.
- Made DAP disconnect and terminate requests cancel the real runtime, with a short cooperative grace period followed by a terminal-process interruption when required.
- Fixed active-node and search-result centering for Mermaid nodes positioned through nested SVG transforms.
- Separated normal execution traces from private DAP traces so debugging no longer replaces or invalidates flowchart playback state.
- Removed automatic flowchart opening, paused-node state, variable summaries, and DAP controls from debugger sessions.
- Made flowchart opening, regeneration, editing, and disposal independent from the active debugger lifecycle.
- Updated the README and package manifests for version 1.3.4.

## [1.3.3] - 2026-08-02

- Added CLRS string escape semantics for `\n`, `\t`, `\"`, `\r`, and `\b` while preserving unsupported escape sequences as literal text.
- Restricted string escape highlighting to the escape sequences supported by the CLRS language.
- Added automatic `// ` continuation when pressing Enter inside line comments.
- Made standalone flowchart SVG exports transparent while preserving subgraph and node backgrounds.
- Added a shared, versioned document-analysis session for diagnostics, CodeLens, and cost decorators.
- Cached frontend and semantic snapshots per document and computed cost analysis lazily, with invalidation when documents close.
- Added hierarchical document symbols for functions, parameters, and implicitly declared variables in Outline and Breadcrumbs.
- Added same-document Go to Definition and Find All References using a shared semantic navigation index.
- Classified later implicit assignments as navigable writes while preserving the first effective assignment as the source definition.
- Added scope-aware completion for local bindings, document functions, standard-library calls, and CLRS language words.
- Added Spanish hover information for variables, parameters, local functions, and all standard-library functions.
- Added parameter hints for local and standard functions, including nested and syntactically incomplete calls.
- Added a shared standard-library help catalog with signatures, parameter names, return types, documentation, and declared costs.
- Added semantic highlighting for functions, parameters, variables, declarations, later writes, and standard-library symbols.
- Added tolerant semantic-token recovery for incomplete documents while excluding identifiers inside strings and comments.
- Cached semantic-token results per shared document snapshot and enabled semantic highlighting by default for CLRS files.
- Added safe same-document renaming for functions, parameters, implicit declarations, later writes, and references.
- Rejected reserved words, invalid identifiers, standard-library symbols, JavaScript globals, and binding collisions before producing a WorkspaceEdit.
- Added scope-aware capture detection so renaming a global cannot silently redirect one of its references to an existing local binding.
- Added Spanish user-facing rename validation while preserving English technical logging for internal failures.
- Added AST-based runtime location tracking for assignments, calls, input/output, returns, branches, and loops.
- Reported the original CLRS line and column for dynamic runtime errors, including failures propagated through function calls and standard-library operations.
- Refreshed loop condition and increment locations on every evaluation so repeated execution cannot retain a stale statement location.
- Preserved native JavaScript stacks in debug mode while adding an English `CLRS location` entry for implementation logs.
- Attached recovered source locations to structured `RuntimeExecutionError` instances.
- Added bidirectional synchronization between CLRS editor selections and flowchart nodes.
- Added mouse and keyboard navigation from interactive diagram nodes to their original source locations.
- Highlighted the most specific diagram node for the active editor line using VS Code theme colors.
- Preserved selected-fragment diagrams as a fixed panel scope and remapped their local AST coordinates to the complete document.
- Added non-enumerable source metadata to diagram nodes so navigation does not alter Mermaid output, SVG exports, or the existing serialized model contract.
- Added focused flowchart views for the complete diagram, main flow, global flow, and individual functions.
- Added accent-insensitive node search with highlighted matches, wrapped previous/next navigation, and automatic result centering.
- Added explicit controls to fit the visible flow or focus the active search/editor node.
- Added an interactive minimap synchronized with pan and zoom, including click-to-center navigation and a visibility toggle.
- Centralized Mermaid pan/zoom lifecycle behind a disposable viewport controller shared by preview navigation and minimap rendering.
- Exported the currently focused flow when a large diagram is isolated, while preserving full-diagram export as the default.
- Added real runtime execution traces linked to CLRS source locations without replacing the interactive integrated terminal.
- Streamed execution events to open flowcharts through a bounded temporary JSONL side channel that is removed automatically.
- Batched high-frequency runtime steps before crossing the webview boundary and deduplicated them by sequence index.
- Added live current-node and visited-node highlighting, automatic viewport following, and error-state emphasis.
- Added execution playback controls for first, previous, play or pause, next, latest, and three playback speeds.
- Invalidated traces after document edits and limited each trace to 10,000 steps without interrupting the running program.
- Closed trace sessions for frontend, semantic, unexpected runtime, and successful execution outcomes.
- Added a minimal in-memory Debug Adapter Protocol session registered as the `clrs` debugger type.
- Added a final editor-title bug action that saves and debugs the active CLRS document without requiring `launch.json`.
- Added automatic CLRS launch configurations for the Run and Debug view and optional `launch.json` completion.
- Linked DAP session lifetime to the real terminal execution trace and reported session outcomes in Spanish while retaining English internal logs.
- Added a bidirectional runtime control channel independent from the existing execution trace.
- Added verified source-line breakpoints, cooperative pause and continue, next-location stepping, and controlled termination.
- Added optional `stopOnEntry` support to generated and manual CLRS launch configurations.
- Added DAP stopped and continued events with a minimal CLRS source stack frame so VS Code reveals the active line.
- Preserved interactive terminal input and output while a synchronously paused runtime waits for debugger commands.
- Reported debugger termination as `Estado: Cancelado` instead of a runtime error or successful completion.
- Added end-to-end runtime and Extension Host coverage for breakpoints, stepping, continuation, pause, and termination.
- Added lexical runtime-state providers for global bindings and each active function invocation without using `eval`.
- Added real call-stack reconstruction with independent parameter and local-variable values for recursive activations.
- Added DAP scopes for parameters, local variables, and global variables at every stopped frame.
- Added expandable array and object values with CLRS-oriented display names for booleans, undefined values, strings, and numbers.
- Bounded stopped-state snapshots to four levels and 100 children per value, with safe circular-reference and inaccessible-property presentation.
- Added Extension Host coverage proving that VS Code observes variables before and after a stepped assignment.
- Added automatic full-document flowchart opening when debugging from the CLRS editor action.
- Persisted paused debugger location, stop reason, and bounded runtime state in execution-trace snapshots so a newly opened flowchart can recover the current stop.
- Added a distinct paused-node highlight with automatic viewport centering and an active-frame summary for parameters and local variables.
- Added live pause, continue, next, and stop controls to the flowchart, routed through the active CLRS DAP session.
- Kept live debugging controls separate from historical trace playback and restored playback when the debug session ends.

## [1.3.2] - 2026-07-1

- A link to the manual was added in the form of a programming guide based on CLRS.

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
