# Archivo técnico interno — multimedia

Este directorio conserva trabajo previo de investigación y validación. No es una
biblioteca CLRS, una API disponible ni una dependencia del producto. No debe
importarse desde `src/`, `extension/` ni scripts de aceptación GUI.

- `GuiMediaAdapter.js`: adaptador desacoplado, conservado sin modificaciones.
- `GuiEnvironmentProbe.js`: probe histórico, diagnóstico y clasificación multimedia.
- `GuiMediaFixture.mjs` y `FakeModelsMedia.js`: utilidades y dobles históricos.
- `*.js.txt` y `*.mjs.txt`: instantáneas de contratos, integración y pruebas previas;
  no se ejecutan ni se importan. Sus rutas y expectativas corresponden al estado
  anterior, no al contrato vigente. Se conservan para no destruir la investigación.
- `validation-history.md`: informe anterior con las limitaciones Windows observadas.

Los informes JSON históricos en `test/fixtures/gui/` conservan sus fechas y alcance.
No certifican ni definen funciones públicas actuales. El contrato vigente contiene
24 componentes, sólo la capacidad `gui` y ninguna dependencia multimedia de CLRS.

Las comprobaciones autocontenidas de este archivo se ejecutan sólo a petición:

```text
node --test test/internal/gui-media/media-checks.mjs
```

No pertenecen a `test:unit` ni a `test:gui:controls`, no cargan bibliotecas nativas
y no condicionan la aceptación GUI. Todo `test/` ya queda excluido del VSIX.
