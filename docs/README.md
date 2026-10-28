# CLRS Kit Español — documentación técnica

Esta carpeta reúne la referencia para mantenimiento, desarrollo y validación
interna. El manual orientado a usuarios permanece en
[`../README.md`](../README.md) y el historial de versiones en
[`../CHANGELOG.md`](../CHANGELOG.md).

| Dato | Valor actual |
|---|---|
| Paquete | `clrs-kit-esp` |
| Versión | **2.0.4** |
| Lenguaje de VS Code | `clrs-es` |
| Entrada publicada | `extension-dist/extension.js` |
| Frontend compartido | React + Vite, en `frontend/` |

## Mapa de documentación

| Ámbito | Documento |
|---|---|
| Arquitectura, repositorio, activación y composición | [architecture/overview.md](architecture/overview.md) |
| Lexer, parser, AST, semántica y sintaxis | [language/frontend.md](language/frontend.md) |
| Compilación, transpilación, artefactos y ejecución | [language/compilation.md](language/compilation.md) |
| Exportación CLI compilable (auditoría y contrato 2.0.3) | [language/cli-executable-export.md](language/cli-executable-export.md) |
| Uso de la exportación JavaScript y builds CLI/GUI | [gui/javascript-export.md](gui/javascript-export.md) |
| Exportación GUI a ejecutable portable (contrato arquitectónico) | [gui/portable-executable-export.md](gui/portable-executable-export.md) |
| Códigos, fases y presentación de diagnósticos | [language/diagnostics.md](language/diagnostics.md) |
| Proveedores de VS Code, formato y sesión documental | [editor/services.md](editor/services.md) |
| Contexto de lenguaje para Copilot Chat y Copilot CLI | [editor/copilot.md](editor/copilot.md) |
| Modelo de costos y análisis asintótico | [analysis/complexity.md](analysis/complexity.md) |
| Diagramas de flujo y sincronización con el editor | [visualization/flow-diagrams.md](visualization/flow-diagrams.md) |
| Sesiones de depuración DAP | [tooling/debugger.md](tooling/debugger.md) |
| Testing API, suites CLRS y resultados | [testing/framework.md](testing/framework.md) |
| Integración técnica del inicio guiado y contextual | [extension/getting-started.md](extension/getting-started.md) |
| Frontend React, Webviews y bridge | [webviews/frontend.md](webviews/frontend.md) |
| Dominio, economía, CIPHER y aprendizaje de BROKER.95 | [broker95/overview.md](broker95/overview.md) |
| Persistencia, versiones y cuarentena | [platform/persistence.md](platform/persistence.md) |
| CSP, protocolo, secretos y logs | [platform/security.md](platform/security.md) |
| Dependencias y entorno de desarrollo | [development/environment.md](development/environment.md) |
| Estrategia y comandos de pruebas | [development/testing.md](development/testing.md) |
| Build, release y VSIX | [development/release.md](development/release.md) |
| Guías para cambios frecuentes | [development/change-guides.md](development/change-guides.md) |
| Convenciones e invariantes | [development/conventions.md](development/conventions.md) |
| Diagnóstico operativo | [development/troubleshooting.md](development/troubleshooting.md) |
| Licencia y contribución | [community/license-and-contributing.md](community/license-and-contributing.md) |

## Biblioteca GUI

Los contratos normativos de la biblioteca de interfaces gráficas viven en
[gui/](gui/README.md). Son la autoridad de arquitectura, catálogo, runtime y
exportación; los documentos de otros ámbitos deben enlazarlos en lugar de
duplicar sus reglas.

Las evidencias técnicas asociadas continúan junto a sus pruebas para mantener
la trazabilidad ejecutable:

- [cost-model.md](../test/fixtures/gui/cost-model.md)
- [testing-evidence.md](../test/fixtures/gui/testing-evidence.md)
- [export-evidence.md](../test/fixtures/gui/export-evidence.md)
- [validación histórica multimedia](../test/internal/gui-media/validation-history.md)

## Criterio editorial

Cada cambio debe actualizar el documento responsable de su contrato, ruta,
esquema o proceso. No se crean resúmenes paralelos cuando una fuente canónica
ya existe; se enlaza la autoridad correspondiente.
