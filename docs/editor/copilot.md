# Integración con GitHub Copilot

CLRS Kit Español aporta contexto normativo del lenguaje a GitHub Copilot sin
convertir Copilot en una dependencia de la extensión. La especificación
canónica para modelos está en
[`copilot/clrs.instructions.md`](../../copilot/clrs.instructions.md): se
deriva de la implementación, las pruebas y los catálogos públicos de CLRS, no
de convenciones externas de pseudocódigo.

## Copilot Chat en VS Code

`package.json` registra ese recurso en `contributes.chatInstructions` con la
condición `editorLangId == clrs-es`. Por ello, cuando el editor activo es un
archivo `.clrs` reconocido por CLRS Kit, Copilot Chat recibe las reglas de
sintaxis, corrección mínima, biblioteca estándar y GUI. No se activa para
otros lenguajes ni modifica el análisis, diagnósticos o Code Actions de CLRS.

Copilot es opcional y sus sugerencias deben revisarse como cualquier otra
propuesta de código. La extensión no promete que un modelo produzca siempre un
programa correcto.

## Copilot CLI opcional

El comando de paleta **Instalar soporte para Copilot CLI** también está
en el grupo separado del menú **Inicio**. Sólo instala instrucciones: no
instala Copilot CLI, no descarga paquetes, no inicia sesión ni ejecuta comandos
de GitHub.

La misma especificación canónica se copia sin duplicarla a:

1. `<COPILOT_HOME>/instructions/clrs.instructions.md`, si `COPILOT_HOME` está
   definido y no está vacío.
2. `<directorio personal>/.copilot/instructions/clrs.instructions.md`, en caso
   contrario.

Las rutas se resuelven con las APIs portables de Node.js, por lo que el mismo
contrato funciona en Windows, Linux y macOS. El frontmatter de la especificación
incluye `applyTo: "**/*.clrs"`; así Copilot CLI sólo la aplica al trabajar con
archivos CLRS, nunca a `.js`, `.ts`, `.py`, `.cs`, `.java` u otros archivos.

Antes de escribir fuera del directorio de la extensión, VS Code muestra una
confirmación nativa. Si el archivo no existe, ofrece instalarlo; si es idéntico,
informa que ya está actualizado; y si contiene cambios distintos, permite
actualizarlo o conservarlo. Sólo administra el archivo
`clrs.instructions.md` de CLRS y no modifica instrucciones de Copilot ajenas.

## Mantenimiento

Al cambiar la sintaxis o las APIs públicas de CLRS se actualiza únicamente
`copilot/clrs.instructions.md`. Las pruebas verifican su alcance, la
contribución declarativa, los ejemplos analizados por el frontend, la inclusión
en el paquete y los flujos de instalación de CLI.
