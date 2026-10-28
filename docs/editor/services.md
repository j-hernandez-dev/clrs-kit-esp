# Servicios del editor

La inteligencia GUI consume los mismos contratos de la biblioteca para firmas,
descripciones y propiedades/eventos. La gramática y
`extension/snippets/clrs-gui.code-snippets` cubren sus funciones y `NULO`.
El formateador conserva llamadas y callbacks como sintaxis ordinaria.
Referencia: [catálogo GUI](../gui/api-catalog.md).

## Servicios del editor

La extensión registra proveedores nativos de VS Code; actualmente no existe un proceso Language Server separado.

| Capacidad | Servicio de dominio | Adaptador VS Code |
|---|---|---|
| Diagnósticos | `LanguageDiagnosticsService` | `StaticDiagnosticsProvider` |
| Outline/Breadcrumbs | `SemanticNavigationIndex` | `SymbolNavigationProvider` |
| Definiciones y referencias | `SemanticNavigationIndex` | `SymbolNavigationProvider` |
| Jerarquía de llamadas | `SemanticCallGraph` | `CallHierarchyProvider` |
| Completion, hover y firmas | `LanguageIntelligenceService` | `LanguageIntelligenceProvider` |
| Inlay Hints | `LanguageIntelligenceService` | `LanguageIntelligenceProvider` |
| Tokens semánticos | `SemanticTokenService` | `SemanticTokensProvider` |
| Rename | `RenameService` | `RenameProvider` |
| Formato documental | `CLRSFormatter` | `CLRSDocumentFormattingProvider` |
| CodeLens de complejidad | análisis documental | `CodeLensProvider` |
| Costos inline | análisis de costo | `DecoratorProvider` |

### Formateador documental

`src/language/formatting/CLRSFormatter.js` implementa el formato como una transformación pura y neutral respecto de VS Code. Recibe el texto, el `Program` ya construido y las opciones de sangría; utiliza la estructura del AST para determinar la profundidad de bloques y los tokens del frontend para normalizar espacios sin reinterpretar el programa.

El adaptador `extension/providers/FormattingProvider.js` consume el snapshot exacto de `DocumentAnalysisService` y publica una única edición documental mediante la API nativa de VS Code. `extension/commands/LanguageFormatting.js` registra el proveedor y el comando público `CLRS.formatDocument` durante la composición de la extensión. El manifiesto expone **Formatear documento CLRS** tanto en la paleta de comandos como en el menú contextual de un editor `clrs-es`, sin duplicar la transformación: el comando delega en `editor.action.formatDocument` y vuelve al mismo proveedor. Si el documento no posee un AST sintácticamente completo, el proveedor no propone cambios: el formateador nunca intenta corregir una estructura ambigua mediante heurísticas destructivas.

El contrato del formateador conserva cadenas, secuencias de escape, comentarios, líneas vacías, salto final y estilo `LF` o `CRLF`. Respeta `tabSize` e `insertSpaces`, distingue la continuación de expresiones entre paréntesis o corchetes de los bloques estructurales y es idempotente. En arreglos multilínea registra la profundidad exacta de cada corchete y descuenta los cierres iniciales para alinear correctamente filas, dimensiones anidadas y el `]` exterior. La contribución `[clrs-es].editor.defaultFormatter` de `package.json` selecciona `j-hernandez-dev.clrs-kit-esp`, por lo que **Formato del documento** y el formato al guardar utilizan este mismo pipeline.

### Sesión documental compartida

`DocumentAnalysisService` conserva un único snapshot por documento y versión dentro de una caché LRU global de 16 entradas. El snapshot contiene:

- código fuente;
- resultado del frontend;
- AST;
- modelo semántico;
- diagnósticos;
- análisis de costo perezoso.

Esto evita que diagnósticos, navegación, inteligencia, CodeLens e informe vuelvan a analizar la misma versión y, al mismo tiempo, impide que una sesión extensa conserve documentos inactivos sin límite. Cualquier nueva capacidad documental debe intentar consumir esta sesión antes de crear un pipeline paralelo.

`RuntimePerformanceMonitor` registra únicamente tiempos agregados y acotados para activación, análisis documental, costo y preparación de Webviews. No recibe código, rutas ni contenido del usuario; sus métricas se liberan junto con la aplicación.

### Grafo semántico de llamadas

`src/call-graph/DirectedCallGraph.js` aporta la topología dirigida neutral, componentes fuertemente conexos, orden de evaluación y detección de ciclos. `src/semantic/SemanticCallGraph.js` la proyecta sobre las funciones y referencias ya resueltas por `SemanticModel`, conserva los rangos CLRS y almacena exactamente una instancia por snapshot documental.

`extension/providers/CallHierarchyProvider.js` adapta esa proyección a la Call Hierarchy API para consultas entrantes y salientes. `SemanticCallDiagnosticsService` consume el mismo grafo para detectar funciones inalcanzables desde el flujo global o `PRINCIPAL`, recursión directa y recursión indirecta. Estos diagnósticos se publican como sugerencias o información: no se agregan a `DocumentAnalysisSnapshot.diagnostics`, no invalidan el programa y no fuerzan el análisis de costo perezoso.

### Integración declarativa

| Recurso | Ruta |
|---|---|
| Gramática TextMate | `extension/syntaxes/clrs.tmLanguage.json` |
| Configuración de lenguaje | `extension/language-config/language-configuration.json` |
| Snippets | `extension/snippets/*.code-snippets` |
| Contribuciones | `package.json` |

---

