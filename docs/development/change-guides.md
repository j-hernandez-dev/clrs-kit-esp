# Guías de modificación

## Guías de modificación

### Cambiar la sintaxis del lenguaje

Revisar, como mínimo:

1. `src/lexer/tokens/`;
2. reglas de `src/parser/`;
3. nodos y builders del AST;
4. semántica;
5. visitantes JavaScript, costo y diagrama;
6. TextMate, configuración y snippets;
7. runtime y DAP si la construcción es ejecutable;
8. catálogos curriculares y fixtures CLRS;
9. pruebas de caracterización e integración.

### Añadir una capacidad del editor

1. Implementar lógica independiente de VS Code en `src/language/` o el dominio correspondiente.
2. Reutilizar `DocumentAnalysisService`.
3. Crear un adaptador en `extension/providers/`.
4. Registrar en `extension/commands/`.
5. Componer en `createExtensionApplication`.
6. Agregar pruebas unitarias y de Extension Host.

### Añadir un proveedor LLM

1. Agregar descriptor estable en `BrokerLLMProvider.js`.
2. Implementar el puerto en `extension/adapters/`.
3. Reutilizar prompts y normalización compartidos.
4. Clasificar errores sin filtrar respuestas o secretos.
5. Registrar el adaptador en la raíz de composición.
6. Probar credenciales, modelo, JSON, streaming, timeout, abort y conexión.

### Editar una lección

Usar los catálogos canónicos, no JSX ni HTML:

- Programación: `src/broker95/learning/BrokerLearningCatalogData.js`.
- Algoritmia: `src/broker95/learning/BrokerAlgorithmsLearningCatalogData.js`.

Reglas editoriales:

| Campo | Constructores admitidos |
|---|---|
| `explanation` | `paragraph`, `list`, `callout` |
| `examples` | `text`, `clrs` |
| `formulas` | `formula` |

No deben colocarse ejemplos dentro de `explanation`. El conocimiento acumulado se deriva; no se duplica manualmente. Las fórmulas usan identificadores estables. Tras un cambio curricular debe ejecutarse la suite completa de Aprendizaje.

### Cambiar un Webview

1. Modificar `frontend/src/`.
2. Mantener el bridge tipado y la autoridad en el Host.
3. Verificar accesibilidad, narrow layouts, reduced motion y forced colors.
4. Ejecutar pruebas relevantes.
5. Ejecutar `npm run build:webview`.

---

