# Seguridad

La GUI carga y valida el addon nativo únicamente en procesos Node hijos.
El aprovisionamiento modifica npm privado, nunca paquetes nativos del SO.
Las fronteras de entorno, reparación y aislamiento se mantienen en el
[pipeline GUI](../gui/runtime-pipeline.md). Los callbacks sólo reciben
valores CLRS; no se expone reflexión libre sobre objetos GTK.

### Webviews

`loadWebviewHtml` aplica una CSP de denegación por defecto. En BROKER.95:

- `connect-src 'none'`;
- `enableCommandUris: false`;
- sin port mapping;
- `localResourceRoots` limitado a `frontend/dist`;
- sin frames, workers, objetos, formularios, media ni navegación base;
- scripts, fuentes, estilos e imágenes sólo desde el origen del Webview.

### Protocolo

`BrokerProtocolCodec` valida envelopes y payloads exactos. `BrokerWebviewRequestGuard` añade:

- protección contra replay;
- máximo de 8 solicitudes simultáneas;
- memoria acotada de 512 IDs;
- límite de 120 solicitudes por ventana de 10 segundos.

`BrokerOperationCoordinator` agrega single-flight, exclusión por recurso e idempotencia acotada mediante fingerprints SHA-256 que no retienen el contenido original.

### Secretos y logs

- Las credenciales guardadas no regresan al Webview: el Host sólo proyecta su presencia. El formulario envía el nuevo valor al Host únicamente para guardarlo o eliminarlo y limpia su borrador cuando cambia el proveedor.
- Las claves se aíslan por proveedor.
- Los adaptadores no deben registrar bodies remotos ni credenciales.
- Los mensajes públicos se normalizan; los metadatos técnicos seguros van al logger de desarrollo.
- Las claves se envían exclusivamente al endpoint del proveedor seleccionado para autenticar la petición. Con un proveedor remoto, las consultas y el contexto CLRS necesario también abandonan el equipo; el almacenamiento seguro local de la credencial no implica procesamiento local de la consulta ni controla la retención del servicio remoto.

---

Las dependencias se documentan en [Entorno y dependencias](../development/environment.md).

