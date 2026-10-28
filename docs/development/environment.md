# Entorno y dependencias

La ejecución GUI utiliza Node 22, 24 o 26, node-gtk 4.1.1 y GTK >= 4.10.
La dependencia npm se administra de forma privada y no se añade al manifest
raíz. Los requisitos nativos y la política por plataforma se detallan en
[runtime GUI](../gui/runtime-pipeline.md); los límites de validación están en
[aceptación GUI](../gui/acceptance.md).

Los proyectos exportados declaran sus propias herramientas y no dependen del
`node_modules` de la extensión. Tanto CLI como GUI requieren un Node compatible
para `npm ci`, `npm start` y el build. CLI instala `@yao-pkg/pkg` sólo como
dependencia de desarrollo y no requiere GTK. GUI declara además
`node-gtk@4.1.1`; en Linux y macOS siguen siendo necesarias las bibliotecas GTK
del sistema. El ejecutable CLI ya construido incorpora Node y no requiere que
el usuario final lo instale.

### Raíz

| Tipo | Paquete | Propósito |
|---|---|---|
| Producción | `chevrotain` | Lexer y parser. |
| Desarrollo | `@vscode/test-cli`, `@vscode/test-electron` | Integración real con VS Code. |
| Desarrollo | `@vscode/vsce` | Inspección y empaquetado VSIX. |
| Desarrollo | `esbuild` | Bundling reproducible del Extension Host y del CLI de producción. |
| Desarrollo | `eslint` | Análisis estático del repositorio. |
| Tipos | `@types/vscode`, `@types/node`, `@types/mocha` | Contratos de APIs usados desde JavaScript/JSDoc. |

### Frontend

El frontend posee `package.json` y lockfile independientes. Sus dependencias no deben moverse a la raíz salvo que también sean requeridas por el Extension Host.

No se utiliza SDK oficial para los proveedores LLM: los adaptadores traducen el puerto neutral a HTTP/fetch, SSE o NDJSON.

---

## Preparación del entorno

### Requisitos

- Visual Studio Code compatible con `^1.125.0`.
- Node.js moderno; Node.js 22 LTS es la referencia recomendada por los tipos del proyecto.
- npm.

### Instalación limpia

```powershell
npm ci
npm --prefix frontend ci
```

### Ejecutar la extensión en desarrollo

1. Abre la raíz del repositorio en VS Code.
2. Construye el Extension Host, el CLI y el frontend:

   ```powershell
   npm run build
   ```

3. Inicia una ventana **Extension Development Host** mediante `F5`.
4. Abre un archivo `.clrs` del workspace de prueba o crea uno nuevo.

El build no es un servidor externo: genera `extension-dist/extension.js`, `extension-dist/clrs-cli.js` y los archivos estáticos de `frontend/dist/`.

---

