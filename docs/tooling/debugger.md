# Depurador DAP

Las sesiones GUI conservan la ubicación CLRS al entrar o salir de callbacks,
esperar diálogos y suspenderse mientras hay ventanas activas. Step Over espera
la operación; pausa y terminación alcanzan el mismo proceso Node/GTK. Las
variables publicadas no exponen objetos nativos.
Contrato: [runtime GUI, control y callbacks](../gui/runtime-pipeline.md).
Validación: [aceptación GUI](../gui/acceptance.md).

## Depurador DAP

El tipo de depuración contribuido es `clrs`. La configuración inicial equivale a:

```json
{
  "type": "clrs",
  "request": "launch",
  "name": "Depurar programa CLRS",
  "program": "${file}",
  "stopOnEntry": true
}
```

| Componente | Responsabilidad |
|---|---|
| `CLRSDebugAdapter` | Implementa las solicitudes DAP. |
| `CLRSDebugAdapterFactory` | Crea una sesión por lanzamiento. |
| `CLRSDebugConfigurationProvider` | Completa y valida configuración. |
| `CLRSDebugStateStore` | Pila, ámbitos, variables y referencias expandibles. |
| `BreakpointExpressionCompiler` | Condiciones, hit counts, triggers y logpoints. |
| `ExecutionControlFileSession` | Canal de control con el proceso instrumentado. |
| `VSCodeCodeHost` | Inicia el intérprete depurado como proceso raíz de una terminal integrada y enlaza sus archivos de traza y control. |

Se admiten pausa inicial, continue, Step Into, Step Over, Step Out, cancelación, breakpoints básicos, condicionales, por impacto, disparados y logpoints. Las ubicaciones visibles siempre deben volver a líneas CLRS.

El lanzamiento DAP no escribe un comando sobre un shell recién creado. La terminal de depuración inicia directamente `node`, `CliEntry.js` y el documento CLRS con sus argumentos privados de traza/control; así conserva entrada y salida interactivas, pero elimina la carrera entre la creación del terminal, la aparición del prompt y el primer evento `stopped`.

Cada adaptador acepta breakpoints únicamente para el archivo `program` de su configuración. Las solicitudes que VS Code reenvía para otros documentos se responden como no verificadas sin reemplazar los breakpoints ya compilados del programa activo. Las pruebas de Extension Host correlacionan inicio y terminación por identidad de sesión, evitando que un cierre anterior satisfaga por error la espera de un lanzamiento posterior.

Las expresiones DAP comparten el mismo frontend y visitante JavaScript, por lo que condiciones de breakpoint, logpoints y evaluaciones admiten literales de arreglo. `CLRSDebugStateStore` conserva referencias expandibles para arreglos anidados y publica sus índices como hijos, mientras la traza mantiene las ubicaciones CLRS de llamadas y sentencias contenidas en la inicialización.

---

