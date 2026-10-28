// Doble sin GTK: sólo para las pruebas de ensamblado, nunca para ejecución de usuario.
export const fixture = true;
export default { require(name) {
    if (name === "Gio") { return { SettingsSchemaSource: { getDefault: () => ({ lookup: () => ({}) }) } }; }
    if (name !== "Gtk") { throw new Error(`Unexpected namespace: ${name}`); }
    return { getMajorVersion: () => 4, getMinorVersion: () => 10, getMicroVersion: () => 0 };
} };
