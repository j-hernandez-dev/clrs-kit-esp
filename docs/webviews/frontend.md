# Frontend y webviews

## Frontend y Webviews

`frontend/src/main.jsx` selecciona una de tres aplicaciones mediante la meta `clrs-webview-mode`:

| Modo | Componente raíz | Vista |
|---|---|---|
| `diagram` | `DiagramRoot` | Diagrama de flujo |
| `complexity-report` | `ComplexityReportApp` | Informe de complejidad |
| `broker95` | `Broker95App` | Videojuego y aprendizaje |

Las aplicaciones se cargan de forma diferida. Vite produce un único `frontend/dist/index.html` y chunks separados para `DiagramRoot`, `ComplexityReportApp` y `Broker95App`. Mermaid sólo entra al solicitar el diagramador; Kaplay sólo al abrir la escena de BROKER.95; KaTeX y su CSS se importan mediante `useKaTeXHtml` cuando una fórmula necesita renderizado. `loadWebviewHtml`:

1. lee el build;
2. convierte assets a `webview.asWebviewUri`;
3. inyecta CSP;
4. añade el modo solicitado.

