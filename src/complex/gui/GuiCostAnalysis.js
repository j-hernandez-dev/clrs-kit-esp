import { NodeTypes as N } from "../../ast/core/NodeTypes.js";
import { SemanticContext } from "../../semantic/SemanticContext.js";
import { SemanticModel } from "../../semantic/SemanticModel.js";
import { SemanticBindingCollector } from "../../semantic/visitors/SemanticBindingCollector.js";
import { SemanticReferenceResolver } from "../../semantic/visitors/SemanticReferenceResolver.js";
import { DEFAULT_GLOBAL_SYMBOLS } from "../../semantic/StandardSymbols.js";
import { resolvedGuiDefinition, walkGuiAst } from "../../semantic/gui/GuiUsageDetector.js";
import { GUI_FUNCTION_DEFINITIONS } from "../../standard-library/gui/GuiFunctionCatalog.js";
import { GUI_COMPONENTS } from "../../standard-library/gui/GuiComponentCatalog.js";
import { GUI_COST_ASSUMPTIONS, GUI_VOLUME_MEASURE, guiPropertyCost, guiEventConnectionCost } from "../../standard-library/gui/GuiCostCatalog.js";
import { decodeLanguageStringLiteral } from "../../language/StringLiteralSemantics.js";
import { CostExpressionFactory as Cost } from "../algebra/CostExpressionFactory.js";
import { getStandardLibraryDefinition } from "../../standard-library/StandardLibraryCatalog.js";
import { GUI_DATA_VALUE } from "./GuiCostMeasures.js";

const C = Cost.symbol("c");
const unknown = detail => Cost.unknown("GUI: " + detail);
const isGuiName = name => Object.hasOwn(GUI_FUNCTION_DEFINITIONS, name);

/** Sólo datos estáticos y resolución de símbolos; no carga el runtime GTK. */
export function analyzeGuiCosts(ast) {
    let candidate = false;
    walkGuiAst(ast, node => { if (node.type === N.FUNCTION_CALL && Object.hasOwn(GUI_FUNCTION_DEFINITIONS, node.identifier.name)) { candidate = true; } });
    if (!candidate) { return { get: () => null, isGuiName, assumptions: [], calls: [] }; }
    // Las mismas dos pasadas que semántica; los diagnósticos siguen siendo
    // responsabilidad del frontend, no se relanza aquí un error de usuario.
    const context = new SemanticContext(ast, DEFAULT_GLOBAL_SYMBOLS);
    new SemanticBindingCollector(context).collect(ast);
    new SemanticReferenceResolver(context).resolve(ast);
    const model = new SemanticModel(context);
    const byCall = new WeakMap(), calls = [], owners = new WeakMap();
    const functions = new Map(), forwarding = [];
    walkGuiAst(ast, (node, owner) => {
        if (node.type === N.FUNCTION_DECLARATION) { functions.set(node.identifier.name, node); }
        if (node.type === N.FUNCTION_CALL && owner) { owners.set(node, owner); }
    });
    const mutableOwners = new WeakSet();
    const mutatingBuiltins = new Set(["AGREGA", "ELIM", "INSER", "ORDENA", "INVER"]);
    const readonlyBuiltin = node => getStandardLibraryDefinition(node.identifier.name)
        && model.getSymbol(node.identifier)?.declarations.length === 0
        && !mutatingBuiltins.has(node.identifier.name);
    walkGuiAst(ast, (node, owner) => {
        if (!owner) { return; }
        const parameters = new Set(owner.parameters.map(p => p.identifier.name));
        const usesParameter = value => {
            let uses = false;
            walkGuiAst(value, child => { if (child.type === N.IDENTIFIER && parameters.has(child.name)) { uses = true; } });
            return uses;
        };
        // Sin un seguimiento de alias/mutaciones probado no se sustituye el
        // volumen actual por el de entrada. También se invalida al crear alias.
        if ((node.type === N.ASSIGNMENT && (usesParameter(node.left) || usesParameter(node.right)))
            || (node.type === N.READ_STATEMENT && usesParameter(node))) {
            mutableOwners.add(owner);
        }
        if (node.type === N.FUNCTION_CALL && usesParameter(node.arguments)
            && !resolvedGuiDefinition(node, model) && !readonlyBuiltin(node)) {
            const callee = functions.get(node.identifier.name);
            if (callee) { forwarding.push({ owner, callee }); }
            else { mutableOwners.add(owner); }
        }
    });
    // Propaga escapes por llamadas de usuario, incluidas cadenas y ciclos. Una
    // función que sólo reenvía datos a una GUI que los copia no muta su entrada.
    let changed = true;
    while (changed) {
        changed = false;
        for (const { owner, callee } of forwarding) {
            if (mutableOwners.has(callee) && !mutableOwners.has(owner)) {
                mutableOwners.add(owner); changed = true;
            }
        }
    }
    const literals = collectStableLiterals(ast, model, readonlyBuiltin);
    const componentTypes = collectLocalComponentTypes(functions, model);
    const volume = (argument, owner, at) => volumeOf(argument, mutableOwners.has(owner) ? null : owner,
        name => {
            const fact = literals.get(owner)?.get(name);
            return fact && fact.assignment.location.endLine < at.location.startLine ? fact.value : null;
        });
    walkGuiAst(ast, (node, owner) => {
        const definition = resolvedGuiDefinition(node, model);
        if (!definition) { return; }
        let profile = definition.cost;
        if (profile.kind === "property") { profile = resolveProperty(node, definition.name === "ESTABLECER", componentTypes.get(node)); }
        if (profile.kind === "event") { profile = guiEventConnectionCost(literalString(node.arguments[1])); }
        const expression = profile.kind === "constant" ? C : profile.kind === "volume"
            ? Cost.sum([C, ...profile.arguments.map(index => volume(node.arguments[index], owner, node))])
            : unknown(`${definition.name}: ${profile.detail} Modelo: ${profile.formula}. No se demuestra el tamaño de ese estado/recurso desde esta llamada.`);
        const record = { name: definition.name, expression, profile, location: node.location,
            owner: owner?.identifier.name ?? null };
        byCall.set(node, record); calls.push(record);
    });
    const guiFunctions = new Set(calls.map(call => call.owner).filter(Boolean));
    changed = true;
    while (changed) {
        changed = false;
        walkGuiAst(ast, (node, owner) => {
            if (owner && node.type === N.FUNCTION_CALL && guiFunctions.has(node.identifier.name)
                && !guiFunctions.has(owner.identifier.name)) { guiFunctions.add(owner.identifier.name); changed = true; }
        });
    }
    return { get: node => byCall.get(node) ?? null, isGuiName, calls,
        argumentValue(node, index, resolved) {
            // Sólo en un programa GUI: preserva el tamaño de datos literales al
            // sustituir parámetros, sin fingir que esos datos son números.
            const argument = node.arguments[index], owner = owners.get(node);
            const fact = argument?.type === N.IDENTIFIER ? literals.get(owner)?.get(argument.name) : null;
            let value = fact && fact.assignment.location.endLine < node.location.startLine ? fact.value : argument;
            while (value?.type === N.GROUP_EXPRESSION) { value = value.expression; }
            if (guiFunctions.has(node.identifier.name) && [N.STRING_LITERAL, N.ARRAY_EXPRESSION, N.NULL_LITERAL].includes(value?.type)) {
                const length = value.type === N.ARRAY_EXPRESSION ? value.elements.length
                    : value.type === N.STRING_LITERAL ? decodeLanguageStringLiteral(value.value).length : null;
                return Cost.call(GUI_DATA_VALUE, [volume(value, owner, node), ...(length == null ? [] : [Cost.constant(length)])]);
            }
            if (guiFunctions.has(node.identifier.name) && resolved.kind === "symbol"
                && (mutableOwners.has(owner) || argument?.type !== N.IDENTIFIER
                    || !owner?.parameters.some(p => p.identifier.name === argument.name))) {
                return Cost.call(GUI_DATA_VALUE, [unknown("El argumento reenviado no conserva una medida de entrada demostrada (estado, alias o mutación).")]);
            }
            return resolved;
        },
        assumptions: calls.length ? GUI_COST_ASSUMPTIONS : [] };
}

function literalString(node) {
    if (node?.type === N.GROUP_EXPRESSION) { return literalString(node.expression); }
    return node?.type === N.STRING_LITERAL ? decodeLanguageStringLiteral(node.value) : null;
}

// Sólo factories dominantes en un tramo lineal de la misma función. No se
// deduce el tipo del texto del ID ni se adivina estado tras ramas/callbacks.
function collectLocalComponentTypes(functions, model) {
    const types = new WeakMap();
    for (const owner of functions.values()) {
        const known = new Map();
        for (const statement of owner.body.statements) {
            if ([N.IF_STATEMENT, N.FOR_STATEMENT, N.WHILE_STATEMENT].includes(statement.type)) { known.clear(); continue; }
            // Los argumentos se evalúan antes de la operación exterior. Una
            // llamada anidada desconocida invalida hechos antes de consultarlos.
            walkGuiAst(statement, node => {
                if (node.type !== N.FUNCTION_CALL) { return; }
                const definition = resolvedGuiDefinition(node, model);
                if (!definition || definition.asynchronous || ["CERRAR", "CONECTAR"].includes(definition.name)) { known.clear(); }
            });
            walkGuiAst(statement, node => {
                if (resolvedGuiDefinition(node, model)?.cost.kind === "property") {
                    types.set(node, known.get(literalString(node.arguments[0])));
                }
            });
            const definition = resolvedGuiDefinition(statement, model);
            const id = literalString(statement.arguments?.[0]);
            if (definition?.kind === "factory" && id != null) { known.set(id, definition.componentType); }
        }
    }
    return types;
}

/** Literales locales dominantes sin alias, escrituras posteriores ni escapes. */
function collectStableLiterals(ast, model, readonlyBuiltin) {
    const byOwner = new WeakMap();
    walkGuiAst(ast, (node, owner, parent) => {
        if (node.type !== N.ASSIGNMENT || !owner || parent !== owner.body
            || node.left.type !== N.IDENTIFIER || !literalOnly(node.right)
            || owner.parameters.some(p => p.identifier.name === node.left.name)) { return; }
        const facts = byOwner.get(owner) ?? new Map();
        facts.set(node.left.name, { value: node.right, assignment: node }); byOwner.set(owner, facts);
    });
    walkGuiAst(ast, (node, owner) => {
        const facts = byOwner.get(owner);
        if (!facts) { return; }
        const uses = (value, name) => {
            let found = false;
            walkGuiAst(value, child => { if (child.type === N.IDENTIFIER && child.name === name) { found = true; } });
            return found;
        };
        for (const [name, fact] of facts) {
            if ((node.type === N.ASSIGNMENT && node !== fact.assignment && (uses(node.left, name) || uses(node.right, name)))
                || (node.type === N.READ_STATEMENT && uses(node, name))
                || (node.type === N.FUNCTION_CALL && uses(node.arguments, name)
                    && !resolvedGuiDefinition(node, model) && !readonlyBuiltin(node))) { facts.delete(name); }
        }
    });
    return byOwner;
}

function literalOnly(node) {
    if (node?.type === N.GROUP_EXPRESSION) { return literalOnly(node.expression); }
    if (node?.type === N.ARRAY_EXPRESSION) { return node.elements.every(literalOnly); }
    if (node?.type === N.UNARY && ["+", "-"].includes(node.operator)) {
        return [N.NUMBER_LITERAL, N.SCIENTIFIC_LITERAL].includes(node.operand.type);
    }
    return [N.STRING_LITERAL, N.NUMBER_LITERAL, N.SCIENTIFIC_LITERAL, N.BOOLEAN_LITERAL, N.NULL_LITERAL].includes(node?.type);
}

function resolveProperty(node, write, componentType) {
    const name = literalString(node.arguments[1]);
    if (name == null) {
        return { kind: "state", formula: "costo de la propiedad efectiva", detail: "El nombre de propiedad es dinámico; no se supone que su valor sea escalar." };
    }
    const components = componentType ? [GUI_COMPONENTS[componentType]] : Object.values(GUI_COMPONENTS);
    const profiles = components.flatMap(component => {
        const descriptor = Object.hasOwn(component.properties, name) ? component.properties[name] : null;
        if (!descriptor || !descriptor.access.includes(write ? "W" : "R")) { return []; }
        return [guiPropertyCost(component.type, name, descriptor, write)];
    });
    if (profiles.length && profiles.every(profile => profile.kind === "constant")) { return profiles[0]; }
    if (profiles.length && profiles.every(profile => profile.kind === "volume")) {
        return { kind: "volume", arguments: [2], formula: "c + volumen del valor", detail: "Transfiere el valor recibido." };
    }
    return profiles.find(profile => ["state", "external"].includes(profile.kind))
        ?? { kind: "state", formula: "costo de la propiedad efectiva", detail: "No se conoce una propiedad pública compatible." };
}

function volumeOf(node, owner, localValue = () => null) {
    if (!node) { return unknown("No se conoce el argumento cuyo volumen debe medirse."); }
    if (node.type === N.GROUP_EXPRESSION) { return volumeOf(node.expression, owner, localValue); }
    if (node.type === N.ARRAY_EXPRESSION) {
        return Cost.sum([Cost.constant(1), ...(node.elements ?? []).map(element => volumeOf(element, owner, localValue))]);
    }
    if (node.type === N.STRING_LITERAL) { return Cost.constant(1 + decodeLanguageStringLiteral(node.value).length); }
    if ([N.NUMBER_LITERAL, N.SCIENTIFIC_LITERAL, N.BOOLEAN_LITERAL, N.NULL_LITERAL].includes(node.type)) { return Cost.constant(1); }
    if (node.type === N.UNARY && literalOnly(node)) { return Cost.constant(1); }
    if (node.type === N.IDENTIFIER && localValue(node.name)) { return volumeOf(localValue(node.name), null); }
    if (node.type === N.IDENTIFIER && (owner?.parameters ?? []).some(p => p.identifier.name === node.name)) {
        return Cost.call(GUI_VOLUME_MEASURE, [Cost.symbol(node.name)]);
    }
    return unknown("El volumen del argumento depende de un valor local, acceso o resultado que no tiene una medida estructural demostrada.");
}
