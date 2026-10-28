# Biblioteca GUI — documentación normativa

Estos documentos forman la fuente canónica de la integración GUI de CLRS Kit
Español. Se mantienen dentro del repositorio para que el código, las pruebas y
la documentación no dependan de rutas externas.

| Documento | Responsabilidad |
|---|---|
| [architecture.md](architecture.md) | Arquitectura, fronteras, catálogo público y criterios de aceptación. |
| [runtime-pipeline.md](runtime-pipeline.md) | Semántica, generación, runtime, callbacks, diálogos y sesiones. |
| [api-catalog.md](api-catalog.md) | Factories, propiedades, acciones, eventos, dominios y diagnósticos. |
| [javascript-export.md](javascript-export.md) | Contrato operativo de `app/`, proyecto de cinco archivos, `npm start` y builds host. |
| [portable-executable-export.md](portable-executable-export.md) | Arquitectura, implementación, pruebas y evidencias del ejecutable portable. |

La [aceptación y publicación](acceptance.md) describe el corpus de cierre,
los comandos reproducibles y el alcance exacto de las evidencias nativas.

Las evidencias ejecutables y los experimentos históricos permanecen en
[`test/fixtures/gui/`](../../test/fixtures/gui/) y
[`test/internal/gui-media/`](../../test/internal/gui-media/). No amplían el
contrato público por sí mismos.
