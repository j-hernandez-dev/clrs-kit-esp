# Convenciones e invariantes

## Convenciones e invariantes

### Código

- JavaScript ESM con `import`/`export`.
- JSDoc donde ayuda a describir fronteras públicas.
- Objetos de dominio congelados con `Object.freeze`.
- Errores con códigos estables y mensajes públicos en español.
- Composición e infraestructura pueden registrar detalles técnicos en inglés.
- Las dependencias requeridas se validan al construir el servicio.
- Los `index.js` definen superficies públicas de cada dominio.

### Arquitectura

- No importar `vscode` desde `src/`.
- No acceder a filesystem, red, secretos o procesos desde un Webview.
- No duplicar el parser ni la sesión documental.
- No usar el LLM como fuente de verdad.
- No persistir estado derivable cuando puede recalcularse de forma segura.
- No transformar silenciosamente snapshots antiguos: la política actual es esquema vigente o cuarentena.
- No presentar una cota asintótica como `Θ` sin una demostración suficiente.
- No acoplar el diagrama al ciclo de vida DAP.
- No crear ejecutores separados para suites declarativas y contratos BROKER.95; ambos pasan por `CLRSTestExecutor`.
- No almacenar entrada, expectativa ni autoridad contractual en los `TestItem`; las fuentes se resuelven nuevamente en el Host al ejecutar.
- No reintroducir `<-`; asignación es `=` e igualdad es `==`.

### Invariantes de BROKER.95

- Sólo existen Funcionalidad, Robustez y Diseño.
- FND sólo pertenece a Aprendizaje.
- Los contratos learning reutilizan el sistema general de contratos.
- Programación precede a Algoritmia.
- La UI es una proyección; las transiciones ocurren en el Host.
- `ai -ask` es consultivo; `ai -review` es tutoría estructurada; `ai -push` es definitivo.

---

