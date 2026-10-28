# Persistencia y versiones de datos

## Persistencia y versiones de datos

La partida es global al perfil de VS Code, no al workspace.

| Dato | Almacenamiento | Clave o esquema |
|---|---|---|
| Partida, contratos, economía, estadísticas y aprendizaje | `ExtensionContext.globalState` | `broker95.gameState` |
| Snapshot inválido en cuarentena | `globalState` | `broker95.gameState.corrupt` |
| Configuración de proveedor, perfiles de modelos/URL local y audio | `globalState` | `broker95.settings` |
| Configuración inválida | `globalState` | `broker95.settings.corrupt` |
| API keys por proveedor | `ExtensionContext.secrets` | `broker95.llm.credentials.<provider>.apiKey` |
| Historial conversacional interno acotado | `globalState` | Repositorio de conversación |

| Contrato versionado | Versión actual |
|---|---:|
| Esquema del dominio de partida | 4 |
| Formato del snapshot | 4 |
| Configuración y snapshot de ajustes | 5 |
| Protocolo Host/Webview | 8 |
| Protocolo neutral LLM | 1 |

### Política vigente

- La partida conserva su política de rechazo de snapshots históricos incompatibles; no se migran reglas, contratos ni credenciales.
- La configuración admite exclusivamente la migración validada de ajustes v4 a v5, conserva los perfiles anteriores e incorpora los nuevos perfiles vacíos sin trasladar API keys al snapshot público.
- Un snapshot incompatible o corrupto se rechaza y se pone en cuarentena antes de crear estado limpio; la cuarentena de ajustes no copia posibles secretos del contenido inválido.
- Una versión futura se rechaza sin sobrescribirla.
- La reconciliación actual sí recalcula campos derivados y enlaces de contratos; no es una migración de versión.
- Cada transacción debe avanzar `revision` exactamente una vez y persistirse antes de publicarse.

---

Las restricciones de acceso están en [Seguridad](security.md).

