import { NodeTypes as N } from "../../ast/core/NodeTypes.js";
import { SemanticError } from "../../errors/SemanticError.js";
import { SemanticSymbolKind as K } from "../SemanticSymbol.js";
import { decodeLanguageStringLiteral } from "../../language/StringLiteralSemantics.js";
import { isGuiValueInDomain } from "../../standard-library/gui/GuiContractValidation.js";
import { GUI_COMPONENTS } from "../../standard-library/gui/GuiComponentCatalog.js";
import { canInvokeStandardSynchronously } from "../../standard-library/StandardLibraryInvocation.js";
import { detectGuiUsage, resolvedGuiDefinition, resolvedGuiIdentifierDefinition, walkGuiAst } from "./GuiUsageDetector.js";

const immediateEvents = new Set(Object.values(GUI_COMPONENTS).flatMap(component =>
    Object.values(component.events).filter(event => event.returnPolicy === "synchronous-boolean").map(event => event.name)));

export function analyzeGuiSemantics(ast, context) {
    const model = { getSymbol: node => context.symbolByNode.get(node) ?? null };
    const usage = detectGuiUsage(ast, model);
    const callbacks = new WeakMap();
    const synchronousFunctions = new Set();
    const synchronousStandardFunctions = new Set();
    walkGuiAst(ast, (node, _owner, parent) => {
        if (node.type !== N.IDENTIFIER || !resolvedGuiIdentifierDefinition(node, model)) { return; }
        if (parent?.type === N.FUNCTION_CALL && parent.identifier === node) { return; }
        if (resolvedGuiDefinition(parent, model)?.name === "CONECTAR" && parent.arguments[2] === node) { return; }
        context.report(new SemanticError("Las funciones GUI deben invocarse directamente; no pueden almacenarse ni pasarse como valores.", node,
            { code: "CLRS_GUI_FUNCTION_REFERENCE_NOT_ALLOWED" }));
    });
    if (!usage.requiresGui) { return { usage, callbacks, synchronousFunctions, synchronousStandardFunctions }; }
    const functions = collectFunctions(ast, model);
    const callbackCalls = [];
    const report = (code, message, node) => context.report(new SemanticError(message, node, { code }));

    for (const { node, definition } of usage.calls) {
        const args = node.arguments ?? [];
        if (args.length !== definition.arity) {
            report("CLRS_GUI_INVALID_ARGUMENT", `${definition.name} requiere ${definition.arity} argumentos.`, node);
            continue;
        }
        args.forEach((argument, index) => {
            const domain = definition.parameters[index].domain;
            if (domain.role === "resolved-clrs-function") { return; }
            const constant = guiConstantValue(argument);
            if (constant.known && !isGuiValueInDomain(constant.value, domain)) {
                const code = domain.role === "component-id" ? "CLRS_GUI_INVALID_ID"
                    : definition.name === "ESTABLECER_TEMA" ? "CLRS_GUI_INVALID_THEME_NAME"
                    : definition.name === "ESTABLECER_MODO_TEMA" ? "CLRS_GUI_INVALID_THEME_MODE" : "CLRS_GUI_INVALID_ARGUMENT";
                report(code, `El argumento «${definition.parameters[index].name}» no es válido para ${definition.name}.`, argument);
            }
        });
        for (const rule of definition.constraints) {
            if (rule.kind !== "ordered-range") { continue; }
            const at = name => guiConstantValue(args[definition.parameters.findIndex(parameter => parameter.name === name)]);
            const minimum = at(rule.minimum), maximum = at(rule.maximum);
            if (minimum.known && maximum.known && minimum.value > maximum.value) {
                report("CLRS_GUI_INVALID_ARGUMENT", "El mínimo no puede superar al máximo del rango GUI.", node);
            }
        }
        if (definition.name !== "CONECTAR") { continue; }
        const argument = args[2];
        const symbol = argument.type === N.IDENTIFIER ? model.getSymbol(argument) : null;
        if (!isUnambiguousFunction(symbol) || !functions.has(symbol)) {
            report("CLRS_GUI_INVALID_CALLBACK", "CONECTAR requiere un identificador de función CLRS, no una cadena, llamada ni variable.", argument);
            continue;
        }
        callbackCalls.push({ node, argument, symbol, event: guiConstantValue(args[1]) });
    }

    // Punto fijo: una llamada indirecta/desconocida o suspensión contamina sus llamadores.
    const unsafe = new Set([...functions].filter(([, info]) => info.suspends).map(([symbol]) => symbol));
    let changed = true;
    while (changed) {
        changed = false;
        for (const [symbol, info] of functions) {
            if (!unsafe.has(symbol) && [...info.dependencies].some(dependency => unsafe.has(dependency))) {
                unsafe.add(symbol); changed = true;
            }
        }
    }
    const markSynchronous = symbol => {
        if (synchronousFunctions.has(symbol)) { return; }
        synchronousFunctions.add(symbol);
        const info = functions.get(symbol);
        info.standardFunctions.forEach(name => synchronousStandardFunctions.add(name));
        info.dependencies.forEach(markSynchronous);
    };
    for (const call of callbackCalls) {
        const synchronous = !unsafe.has(call.symbol);
        callbacks.set(call.node, Object.freeze({ symbol: call.symbol, synchronous, location: call.argument.location }));
        if (synchronous) { markSynchronous(call.symbol); }
        else if (call.event.known && immediateEvents.has(call.event.value)) {
            report("CLRS_GUI_CALLBACK_REQUIRES_SYNC", `El evento «${call.event.value}» requiere respuesta inmediata. Su callback no puede leer entrada, esperar archivos/diálogos ni realizar llamadas potencialmente asíncronas.`, call.argument);
        }
    }
    return { usage, callbacks, synchronousFunctions, synchronousStandardFunctions };
}

function isUnambiguousFunction(symbol) {
    return symbol?.hasKind(K.FUNCTION) && !symbol.hasKind(K.VARIABLE) && !symbol.hasKind(K.PARAMETER);
}

function collectFunctions(ast, model) {
    const functions = new Map();
    walkGuiAst(ast, node => {
        if (node.type === N.FUNCTION_DECLARATION) {
            functions.set(model.getSymbol(node.identifier), { suspends: false, dependencies: new Set(), standardFunctions: new Set() });
        }
    });
    walkGuiAst(ast, (node, owner) => {
        if (!owner) { return; }
        const info = functions.get(model.getSymbol(owner.identifier));
        if (node.type === N.READ_STATEMENT) { info.suspends = true; }
        if (node.type !== N.FUNCTION_CALL) { return; }
        const symbol = model.getSymbol(node.identifier);
        const gui = resolvedGuiDefinition(node, model);
        if (gui) { info.suspends ||= gui.asynchronous; }
        else if (isUnambiguousFunction(symbol) && functions.has(symbol)) { info.dependencies.add(symbol); }
        else if (symbol?.hasKind(K.BUILTIN) && !symbol.declarations.length && canInvokeStandardSynchronously(symbol.name)) {
            info.standardFunctions.add(symbol.name);
        } else { info.suspends = true; }
    });
    return functions;
}

export function guiConstantValue(node) {
    if (!node) { return { known: false }; }
    switch (node.type) {
        case N.STRING_LITERAL: return { known: true, value: decodeLanguageStringLiteral(node.value) };
        case N.NUMBER_LITERAL:
        case N.SCIENTIFIC_LITERAL: return { known: true, value: Number(node.value) };
        case N.BOOLEAN_LITERAL: return { known: true, value: node.value === true || node.value === "TRUE" };
        case N.NULL_LITERAL: return { known: true, value: null };
        case N.GROUP_EXPRESSION: return guiConstantValue(node.expression);
        case N.UNARY: {
            const operand = guiConstantValue(node.operand);
            if (operand.known && typeof operand.value === "number" && ["-", "+"].includes(node.operator)) {
                return { known: true, value: node.operator === "-" ? -operand.value : operand.value };
            }
            break;
        }
        case N.ARRAY_EXPRESSION: {
            const values = node.elements.map(guiConstantValue);
            if (values.every(item => item.known)) { return { known: true, value: values.map(item => item.value) }; }
            break;
        }
    }
    return { known: false };
}
