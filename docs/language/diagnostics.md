# Errores y diagnósticos

## Errores y diagnósticos

La jerarquía de `src/errors/` separa fase, código, ubicación, audiencia y mensaje público.

| Familia | Uso |
|---|---|
| `FrontendErrors` / `SyntaxError` | Lexer, parser y construcción del AST. |
| `SemanticError` | Bindings, referencias y reglas semánticas. |
| `TranspilerError` | Generación JavaScript. |
| `RuntimeExecutionError` | Ejecución e instrumentación. |
| `ComplexAnalysisError` | Costo y clasificación asintótica. |
| `DiagramGenerationError` | Modelo o render del diagrama. |
| `ApplicationError` | Configuración, puertos y orquestación. |

Los proveedores `SpanishLexerErrorMessageProvider` y `SpanishParserErrorMessageProvider` traducen errores causados por código del usuario. Los fallos internos se registran con información técnica sin exponer detalles sensibles en la UI.

La presentación de consola utiliza `TerminalUI` a través de `ErrorFormatter`
y `ConsolePresenter`; mensajes, códigos y ubicaciones mantienen su autoridad
en los errores originales. La política de color y tiempo se describe en
[compilación y ejecución](compilation.md#presentación-de-terminal-y-tiempo-de-ejecución).
Un fallo anterior al lanzamiento conserva el estado `No ejecutado` y no
muestra tiempo. Los fallos del proceso generado muestran `Error` y el tiempo
transcurrido, sin duplicar el diagnóstico que ya presentó el runner.

La cancelación de `LEER` mediante Ctrl+C reconoce el `AbortError` específico
de readline y libera la interfaz de entrada en `finally`. Se presenta como
`Cancelado` y conserva los códigos de salida anteriores. Otros errores de
entrada y señales fatales conservan su clasificación de error.

`StaticDiagnosticsProvider` combina los errores autoritativos del snapshot con diagnósticos derivados que implementan el puerto neutral `diagnose(snapshot)`. La combinación ocurre únicamente en el adaptador del editor, por lo que compilación, runtime, diagramas y BROKER.95 siguen dependiendo sólo de la validez sintáctica y semántica del documento.

---

