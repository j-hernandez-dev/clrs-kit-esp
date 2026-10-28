import { GUI_FUNCTION_DEFINITIONS } from "./GuiFunctionCatalog.js";
import { GUI_COMPONENTS } from "./GuiComponentCatalog.js";
import { freezeGuiContract } from "./GuiContract.js";

// Proyección de datos: sin cargar el runtime ni duplicar firmas, propiedades o eventos.
export function describeGuiDomain(domain) {
    if (domain.oneOf) { return [...new Set(domain.oneOf.map(describeGuiDomain))].join(" o "); }
    if (domain.enum) { return domain.enum.map(value => JSON.stringify(value)).join(", "); }
    if (domain.type === "array") { return "Arreglo" + (domain.items ? " de " + describeGuiDomain(domain.items) : ""); }
    return { string: "Cadena", number: "Número", boolean: "Lógico", null: "NULO", void: "sin valor",
        "function-reference": "identificador de función CLRS", "property-dependent": "tipo de la propiedad" }[domain.type] ?? "valor CLRS";
}

function componentDocumentation(component) {
    if (!component) { return ""; }
    const properties = Object.entries(component.properties).map(([name, property]) =>
        `- **${name}**: ${describeGuiDomain(property.domain)} (${property.access}).`);
    const events = Object.entries(component.events).map(([name, event]) =>
        `- **${name}(${event.parameters.map(p => p.name).join(", ")})**: ` +
        (event.allowsAsyncCallback ? "admite espera asincrónica." : "respuesta inmediata: Lógico o NULO; no admite espera asincrónica."));
    return "\n\nIdentificador de cadena único dentro de esta ejecución." +
        (properties.length ? "\n\nPropiedades (R: lectura; W: escritura):\n" + properties.join("\n") : "") +
        (events.length ? "\n\nEventos (el primer argumento es el identificador del componente):\n" + events.join("\n") : "");
}

export const GUI_EDITOR_HELP = freezeGuiContract(Object.fromEntries(Object.entries(GUI_FUNCTION_DEFINITIONS).map(([name, definition]) => [name, {
    name, signature: definition.signature, parameters: definition.parameters.map(parameter => parameter.name),
    parameterDocumentation: definition.parameters.map(parameter => describeGuiDomain(parameter.domain) + ". " + parameter.description),
    documentation: definition.documentation + componentDocumentation(GUI_COMPONENTS[definition.componentType]),
    returnType: definition.returnType, returnLabel: describeGuiDomain(definition.returns), cost: definition.cost,
    capability: "gui"
}])));

export function createGuiSnippets() {
    return Object.fromEntries(Object.entries(GUI_FUNCTION_DEFINITIONS).map(([name, definition]) => {
        const words = name.toLowerCase().split("_");
        const prefix = "gui" + words.map(word => word[0].toUpperCase() + word.slice(1)).join("");
        return [name, { prefix, body: [name + "(" + definition.parameters.map((parameter, index) =>
            "${" + (index + 1) + ":" + parameter.name + "}").join(", ") + ")"],
        description: definition.documentation + " " + (definition.returns.type === "void" ? "No devuelve nada." : "Devuelve " + describeGuiDomain(definition.returns) + ".") +
            (definition.parameters.length ? " Recibe " + definition.parameters.map(p => p.name + ": " + describeGuiDomain(p.domain)).join("; ") + "." : "") }];
    }));
}

export const GUI_TEXTMATE_PATTERN = "\\b(" + Object.keys(GUI_FUNCTION_DEFINITIONS).join("|") + ")\\b(?=\\s*\\()";
