# Diagnóstico de problemas

## Diagnóstico de problemas

| Síntoma | Revisión recomendada |
|---|---|
| El cambio visual no aparece en el VSIX | Ejecutar `npm run build:webview` y comprobar que `frontend/dist` cambió. |
| Un Webview queda en blanco | Revisar consola del Webview, CSP, hashes de assets y `loadWebviewHtml`. |
| La extensión no activa | Ejecutar `npm run build:extension` y `npm run test:extension`; revisar la fuente `extension/extension.js` y la entrada publicada `extension-dist/extension.js`. |
| Un comando no aparece | Verificar `package.json`, activación, registro y `editor/title`. |
| Diagnósticos duplicados o lentos | Confirmar que el consumidor usa `DocumentAnalysisService`. |
| Un error de runtime señala JavaScript | Revisar instrumentación de ubicación y generación del artefacto. |
| Un análisis termina en `O(?)` | Consultar razón, condiciones, proveniencia y corpus antes de ampliar el clasificador. |
| BROKER.95 pierde estado | Revisar esquema 4, cuarentena y revisión monotónica de `BrokerGameSession`. |
| CIPHER aparece no disponible | Revisar proveedor/modelo, credencial, prueba de conexión y clasificación de disponibilidad. |
| Ollama no conecta | Confirmar proceso local, modelo instalado y endpoint loopback permitido. |
| Review/push no encuentran archivo | Confirmar editor CLRS activo o selector relativo válido al workspace. |
| La prueba DAP no inicia | Verificar VS Code estable, `VSCODE_EXECUTABLE_PATH` y configuración `clrs`. |
| Una suite no aparece en el Test Explorer | Verificar el sufijo `.clrs-tests.json`, el JSON Schema, la ruta relativa `program` y el error mostrado en la raíz de la suite. |
| Los casos de BROKER.95 no aparecen | Confirmar que exista un contrato activo y que la extensión ya esté activada; contratos pendientes o cerrados no se proyectan. |

---

