import { GUI_DOMAINS, getGuiOwnEntry } from "./GuiContract.js";
import { getGuiComponentDefinition } from "./GuiComponentCatalog.js";
import { GUI_FUNCTION_DEFINITIONS } from "./GuiFunctionCatalog.js";
import { GuiContractError } from "./GuiErrors.js";

/** Validación pura del dominio, sin GTK, coerciones ni consultas al registro. */
export function isGuiValueInDomain(value, domain, { isFunctionReference = () => false } = {}) {
    return matches(value, domain, isFunctionReference, new Set());
}

function matches(value, domain, isFunctionReference, ancestors) {
    if (domain.oneOf) {
        return domain.oneOf.some(alternative => matches(value, alternative, isFunctionReference, ancestors));
    }
    switch (domain.type) {
        case "null": return value === null;
        case "void": return value === undefined;
        case "function-reference": return isFunctionReference(value) === true;
        case "boolean": return typeof value === "boolean";
        case "string": return typeof value === "string"
            && (domain.minLength === undefined || value.length >= domain.minLength)
            && (!domain.enum || domain.enum.includes(value));
        case "number": return typeof value === "number" && Number.isFinite(value)
            && (!domain.integer || Number.isInteger(value))
            && (domain.minimum === undefined || value >= domain.minimum)
            && (domain.maximum === undefined || value <= domain.maximum)
            && (domain.exclusiveMinimum === undefined || value > domain.exclusiveMinimum);
        case "clrs-value":
            if (!Array.isArray(value)) {
                return matches(value, GUI_DOMAINS.scalar, isFunctionReference, ancestors);
            }
            return matches(value, { type: "array", items: domain }, isFunctionReference, ancestors);
        case "array": {
            if (!Array.isArray(value) || ancestors.has(value)) { return false; }
            if (domain.tuple && value.length !== domain.tuple.length) { return false; }
            ancestors.add(value);
            // Array#every ignora huecos; los arreglos del contrato deben ser densos.
            let valid = true;
            for (let index = 0; index < value.length; index += 1) {
                const itemDomain = domain.tuple ? domain.tuple[index] : domain.items;
                if (!Object.hasOwn(value, index) || !itemDomain
                    || !matches(value[index], itemDomain, isFunctionReference, ancestors)) {
                    valid = false;
                    break;
                }
            }
            ancestors.delete(value);
            return valid && (domain.format !== "calendar-date" || isCalendarDate(value));
        }
        default: return false;
    }
}

function isCalendarDate([year, month, day]) {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return day <= days[month - 1];
}

export function assertGuiIdentifier(id) {
    if (!isGuiValueInDomain(id, GUI_DOMAINS.id)) {
        throw new GuiContractError("CLRS_GUI_INVALID_ID");
    }
    return id;
}

/** El llamador suministra sólo los identificadores de su propia programKey. */
export function assertGuiNewIdentifier(id, sessionIds) {
    assertGuiIdentifier(id);
    if (sessionIds.has(id)) {
        throw new GuiContractError("CLRS_GUI_DUPLICATE_ID");
    }
    return id;
}

export function requireGuiComponentDefinition(type) {
    const component = getGuiComponentDefinition(type);
    if (!component) {
        throw new GuiContractError("CLRS_GUI_WRONG_COMPONENT_TYPE");
    }
    return component;
}

export function requireGuiProperty(type, name, access = "read") {
    const property = getGuiOwnEntry(requireGuiComponentDefinition(type).properties, name);
    if (!property) { throw new GuiContractError("CLRS_GUI_PROPERTY_NOT_FOUND"); }
    if (access !== "read" && access !== "write") {
        throw new TypeError("El acceso a la propiedad debe ser read o write.");
    }
    if (!property[access]) {
        throw new GuiContractError(access === "read" ? "CLRS_GUI_PROPERTY_WRITE_ONLY" : "CLRS_GUI_PROPERTY_READ_ONLY");
    }
    return property;
}

/** Sólo dominio local: las referencias e invariantes entre propiedades exigen el registro del runtime. */
export function assertGuiPropertyDomain(type, name, value, access = "write") {
    const property = requireGuiProperty(type, name, access);
    const domain = access === "read" ? property.readDomain ?? property.domain : property.domain;
    if (!isGuiValueInDomain(value, domain)) {
        throw new GuiContractError("CLRS_GUI_INVALID_PROPERTY_VALUE");
    }
    return property;
}

export function requireGuiEvent(type, name) {
    const event = getGuiOwnEntry(requireGuiComponentDefinition(type).events, name);
    if (!event) { throw new GuiContractError("CLRS_GUI_EVENT_NOT_FOUND"); }
    return event;
}

export function requireGuiAction(type, name) {
    const action = getGuiOwnEntry(requireGuiComponentDefinition(type).actions, name);
    if (!action) { throw new GuiContractError("CLRS_GUI_ACTION_NOT_SUPPORTED"); }
    return action;
}

/** Comprueba aridad y dominios conocidos, no ejecuta ni simula funciones nativas. */
export function assertGuiArgumentDomains(name, args, options) {
    const descriptor = getGuiOwnEntry(GUI_FUNCTION_DEFINITIONS, name);
    if (!descriptor) { throw new GuiContractError("CLRS_GUI_ACTION_NOT_SUPPORTED"); }
    if (!Array.isArray(args) || args.length !== descriptor.arity) {
        throw new GuiContractError("CLRS_GUI_INVALID_ARGUMENT");
    }
    descriptor.parameters.forEach((parameter, index) => {
        if (!Object.hasOwn(args, index) || !isGuiValueInDomain(args[index], parameter.domain, options)) {
            const code = parameter.domain.role === "component-id" ? "CLRS_GUI_INVALID_ID"
                : parameter.domain.role === "resolved-clrs-function" ? "CLRS_GUI_INVALID_CALLBACK"
                : name === "ESTABLECER_TEMA" ? "CLRS_GUI_INVALID_THEME_NAME"
                : name === "ESTABLECER_MODO_TEMA" ? "CLRS_GUI_INVALID_THEME_MODE"
                : "CLRS_GUI_INVALID_ARGUMENT";
            throw new GuiContractError(code);
        }
    });
    for (const rule of descriptor.constraints) {
        if (rule.kind === "ordered-range") {
            const indexOf = parameterName => descriptor.parameters.findIndex(parameter => parameter.name === parameterName);
            if (args[indexOf(rule.minimum)] > args[indexOf(rule.maximum)]) {
                throw new GuiContractError("CLRS_GUI_INVALID_ARGUMENT");
            }
        }
    }
    return descriptor;
}

/** Reutiliza las mismas reglas en el proceso generado, sin importar GTK en el Host. */
export function getGuiRuntimeValidationSource() {
    return [isGuiValueInDomain, matches, isCalendarDate, assertGuiIdentifier,
        assertGuiNewIdentifier, requireGuiComponentDefinition, requireGuiProperty,
        assertGuiPropertyDomain, requireGuiEvent, requireGuiAction, assertGuiArgumentDomains]
        .map(fn => fn.toString()).join("\n");
}
