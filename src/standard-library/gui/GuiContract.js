/** Contratos de datos puros: importar este módulo no carga GTK ni instala paquetes. */
export function freezeGuiContract(value) {
    if (value !== null && typeof value === "object") {
        for (const child of Object.values(value)) {
            freezeGuiContract(child);
        }
        Object.freeze(value);
    }
    return value;
}

export const GUI_CONTRACT = freezeGuiContract({
    schemaVersion: 1,
    sourceRevision: "2026-09-09",
    capability: "gui",
    availability: "semantic-and-codegen",
    identity: {
        publicType: "string",
        scope: "programKey",
        nonEmpty: true,
        uniqueAcrossTypes: true,
        inferTypeFromId: false,
        exposeNativeObjects: false
    },
    detection: "resolved-standard-library-call",
    session: {
        registry: "component-id-to-record",
        recordFields: ["id", "type", "gtk", "programKey"],
        nativeObjectsPrivate: true,
        applicationCount: 1,
        retainWhile: ["live-windows", "pending-operations"],
        cleanup: "all-resources-of-programKey",
        themeStoredOnComponents: false
    },
    callback: {
        functionArgumentIndex: 2,
        firstParameter: "component-id",
        referenceKind: "resolved-clrs-function",
        firstClassFunctions: false
    },
    theme: {
        scope: "session",
        initialMode: "sistema",
        overrideGtkByDefault: false,
        systemMode: "restore-initial-preference",
        preserveExplicitThemeName: true,
        publicCss: false,
        backend: "Gtk.Settings",
        unavailableErrorRequiresReliableDetection: true
    }
});

export const NODE_GTK_RUNTIME_DEPENDENCY = freezeGuiContract({
    name: "node-gtk",
    version: "4.1.1",
    supportedNodeMajors: [22, 24, 26],
    referenceNodeMajor: 22,
    namespace: "Gtk",
    namespaceVersion: "4.0",
    minimumGtkVersion: "4.10",
    loading: "lazy-esm-public-exports",
    installation: "private-on-demand",
    runtimeDirectory: ".runtime",
    packagesDirectory: "packages",
    cacheDirectory: "npm-cache",
    installSystemPackages: false
});

export const GUI_ENUMS = freezeGuiContract({
    orientation: ["horizontal", "vertical"],
    alignment: ["inicio", "centro", "fin", "rellenar"],
    justification: ["izquierda", "derecha", "centro", "rellenar"],
    wrap: ["ninguno", "caracter", "palabra", "palabra_caracter"],
    ellipsis: ["ninguno", "inicio", "medio", "fin"],
    position: ["izquierda", "derecha", "arriba", "abajo"],
    selection: ["ninguno", "unica", "explorar", "multiple"],
    scrollPolicy: ["automatico", "siempre", "nunca"],
    themeMode: ["sistema", "claro", "oscuro"]
});

// Los dominios refinan valores CLRS existentes; no agregan tipos al lenguaje.
const string = { type: "string" };
const number = { type: "number", finite: true };
const integer = { ...number, integer: true };
const boolean = { type: "boolean" };
const nil = { type: "null" };
const scalar = { oneOf: [string, number, boolean, nil] };
const strings = { type: "array", items: string };
const selection = { oneOf: [
    { ...integer, minimum: -1 },
    { type: "array", items: { ...integer, minimum: 0 } }
] };

export const GUI_DOMAINS = freezeGuiContract({
    string, number, integer, boolean, null: nil, scalar, strings,
    void: { type: "void" },
    value: { type: "clrs-value" },
    id: { ...string, minLength: 1, role: "component-id" },
    themeName: { ...string, minLength: 1, role: "theme-name" },
    nullableString: { oneOf: [string, nil] },
    nonNegative: { ...number, minimum: 0 },
    positive: { ...number, exclusiveMinimum: 0 },
    unit: { ...number, minimum: 0, maximum: 1 },
    natural: { ...integer, minimum: 0 },
    positiveInteger: { ...integer, minimum: 1 },
    naturalOrUnset: { ...integer, minimum: -1 },
    day: { ...integer, minimum: 1, maximum: 31 },
    date: { type: "array", tuple: [integer,
        { ...integer, minimum: 1, maximum: 12 },
        { ...integer, minimum: 1, maximum: 31 }], format: "calendar-date" },
    row: { type: "array", items: scalar },
    rows: { type: "array", items: { type: "array", items: scalar } },
    filters: { type: "array", items: { type: "array", tuple: [string, strings] } },
    selectionValue: selection,
    selectionResult: { oneOf: [...selection.oneOf, nil] },
    functionReference: { type: "function-reference", languageType: null,
        role: "resolved-clrs-function", specialArgumentOnly: true },
    ...Object.fromEntries(Object.entries(GUI_ENUMS).map(([name, values]) => [
        name, { type: "string", enum: values }
    ]))
});

export function guiReference(componentTypes, nullable = false) {
    const reference = { ...GUI_DOMAINS.id,
        ...(componentTypes === "widget" ? { componentCapability: "widget" } : { componentTypes }),
        sameSession: true };
    return nullable ? { oneOf: [reference, GUI_DOMAINS.null] } : reference;
}

export function guiParameter(name, domain, description) {
    return { name, domain, description };
}

export function getGuiOwnEntry(catalog, name) {
    return typeof name === "string" && Object.hasOwn(catalog, name)
        ? catalog[name] : null;
}
