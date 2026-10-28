import test from "node:test";
import assert from "node:assert/strict";
import { parseSource } from "../src/language/LanguageFrontend.js";
import { CostAnalysisVisitor } from "../src/complex/CostAnalysisVisitor.js";
import { ComplexityReportBuilder } from "../src/complex/report/ComplexityReportBuilder.js";
import { formatOrder } from "../src/complex/asymptotic/AsymptoticOrder.js";
import { GUI_FUNCTION_DEFINITIONS } from "../src/standard-library/gui/GuiFunctionCatalog.js";
import { GUI_COMPONENTS } from "../src/standard-library/gui/GuiComponentCatalog.js";
import { analyzeGuiCosts } from "../src/complex/gui/GuiCostAnalysis.js";
import { costSubstitution } from "../src/complex/LibrarySubstitution.js";
import { CostExpressionFactory as Cost } from "../src/complex/algebra/CostExpressionFactory.js";
import { AsymptoticClassifier } from "../src/complex/asymptotic/AsymptoticClassifier.js";
import { AsymptoticSizeNormalizer } from "../src/complex/asymptotic/AsymptoticSizeNormalizer.js";
import { guiPropertyCost, GUI_VOLUME_MEASURE } from "../src/standard-library/gui/GuiCostCatalog.js";
import { GUI_DATA_VALUE } from "../src/complex/gui/GuiCostMeasures.js";
import { simplifyCostExpression } from "../src/complex/algebra/CostExpressionSimplifier.js";
import { getGuiRuntimeFactorySource } from "../src/standard-library/gui/runtime/GuiRuntimeSource.js";
import { getStandardLibraryContractHelp } from "../src/standard-library/index.js";

const analyze = source => new CostAnalysisVisitor().costAnalysis(parseSource(source).ast);
const notation = (report, index = 0) => formatOrder(report.statementsCost[index].scenarioAsymptoticAnalysis.worst.order);
const single = (body, params = "") => analyze(`PRUEBA(${params})\n${body.split("\n").map(line => "    " + line).join("\n")}`);

test("GUI costos: 61 modelos canónicos, 24 componentes y ninguna dependencia nativa", () => {
    assert.equal(Object.keys(GUI_COMPONENTS).length, 24);
    assert.equal(Object.keys(GUI_FUNCTION_DEFINITIONS).length, 61);
    for (const [name, definition] of Object.entries(GUI_FUNCTION_DEFINITIONS)) {
        assert.equal(definition.costStatus, "modeled");
        assert.ok(Object.isFrozen(definition.cost));
        assert.ok(definition.cost.formula && definition.cost.detail);
        assert.ok(costSubstitution(name), name);
    }
    assert.equal(costSubstitution("VIDEO"), null);
    assert.equal(costSubstitution("VOLUMEN_GUI"), null);
    const volumeFactories = new Set(["VENTANA", "VENTANA_APLICACION", "ETIQUETA", "BOTON", "CASILLA",
        "BOTON_ALTERNABLE", "BOTON_ENLACE", "LISTA_DESPLEGABLE", "VISTA_COLUMNAS", "DIALOGO_ALERTA"]);
    for (const component of Object.values(GUI_COMPONENTS)) {
        const name = component.factory.name;
        assert.equal(GUI_FUNCTION_DEFINITIONS[name].cost.kind,
            name === "IMAGEN" ? "external" : volumeFactories.has(name) ? "volume" : "constant", name);
    }
});

test("GUI costos: constantes, contenido literal y volumen de parámetros", () => {
    assert.equal(notation(single('ENTRADA("e")\nESTABLECER("e", "visible", Verdadero)')), "O(1)");
    assert.equal(notation(single('ETIQUETA("e", "Hola")')), "O(1)");
    assert.equal(notation(single('LISTA_DESPLEGABLE("e", ["uno", "dos"])')), "O(1)");
    assert.equal(notation(single('ETIQUETA("e", texto)', "texto")), "O(n)");
    assert.equal(notation(single('LISTA_DESPLEGABLE("e", opciones)', "opciones")), "O(n)");
    assert.equal(notation(single('ANEXAR_FILA("tabla", fila)', "fila")), "O(n)");
    assert.equal(notation(single('ANEXAR_FILA("tabla", [-1, 0, 1])')), "O(1)");
});

test("GUI costos: volumen incluye dimensiones interiores y cadenas, no sólo la longitud exterior", () => {
    const source = 'F(texto)\n    G([[texto, ["abcd", "*.png"]]])\nG(filtros)\n    DIALOGO_ARCHIVO("f")\n    ESTABLECER("f", "filtros", filtros)';
    const ast = parseSource('F()\n    ANEXAR_FILA("t", [1, "abcd", NULO])').ast;
    const record = analyzeGuiCosts(ast).calls[0];
    assert.equal(record.expression.terms[1].kind, "sum");
    const text = JSON.stringify(record.expression);
    assert.match(text, /"value":5/);
    assert.equal(notation(analyze('F()\n    ANEXAR_FILA("t", [1, "abcd", NULO])')), "O(1)");
    const nested = analyze(source).statementsCost[0].costExpression;
    assert.match(JSON.stringify(nested), /dato GUI/);
    assert.match(JSON.stringify(nested), /volumen GUI/);
});

test("GUI costos: ciclos y ramas conservan escenarios y composición", () => {
    const report = single('para i = 1 hasta n\n    ANEXAR_FILA("tabla", fila)', "n, fila");
    assert.match(notation(report), /O\((?:m n|n m|m\*n|n\*m)\)/);
    const branch = single('si usar\n    ETIQUETA("e", texto)\nsino\n    ENTRADA("e")', "usar, texto");
    assert.equal(formatOrder(branch.statementsCost[0].scenarioAsymptoticAnalysis.best.order), "O(1)");
    assert.equal(notation(branch), "O(n)");
});

test("GUI costos: estado, propiedades dinámicas e imagen no se inventan como constantes", () => {
    for (const body of ['OBTENER("e", "texto")', 'ESTABLECER("e", propiedad, valor)',
        'ESTABLECER("t", "datos", filas)', 'QUITAR_FILA("t", 0)', 'LIMPIAR_FILAS("t")',
        'CONTENER("v", "e")', 'CERRAR("v")', 'IMAGEN("i", "foto.png")']) {
        const report = single(body, "propiedad, valor, filas");
        assert.equal(notation(report), "O(?)", body);
        const rendered = JSON.stringify(new ComplexityReportBuilder().build(report));
        assert.doesNotMatch(rendered, /No se encontró una función de costo para T(?:OBTENER|ESTABLECER|IMAGEN|CERRAR)/);
        assert.match(rendered, /GUI:/);
    }
});

test("GUI costos: espera humana excluida y callbacks analizados por invocación", () => {
    const report = analyze('EVENTO(id)\n    para i = 1 hasta 10\n        escribir i\nPRINCIPAL()\n    BOTON("b", "OK")\n    CONECTAR("b", "clic", EVENTO)');
    assert.equal(notation(report, 1), "O(1)");
    assert.doesNotMatch(JSON.stringify(report.statementsCost[1].costExpression), /TEVENTO/);
    const dialog = single('ABRIR_ARCHIVOS("f", NULO)');
    const view = new ComplexityReportBuilder().build(dialog);
    assert.equal(notation(dialog), "O(?)");
    assert.ok(view.functions[0].assumptions.some(a => a.includes("espera humana")));
    assert.match(JSON.stringify(view), /no lee los archivos/);
    const asyncCallback = analyze('EVENTO(id)\n    ABRIR_ARCHIVO("f", NULO)\nPRINCIPAL()\n    DIALOGO_ARCHIVO("f")\n    BOTON("b", "OK")\n    CONECTAR("b", "clic", EVENTO)');
    assert.equal(notation(asyncCallback), "O(?)", "El callback se analiza por separado");
    assert.equal(notation(asyncCallback, 1), "O(1)", "Registrar no suma el cuerpo ni la espera del callback");
});

test("GUI costos: respeta funciones homónimas y la medida interna no es una función del lenguaje", () => {
    const report = analyze('ETIQUETA(n)\n    para i = 1 hasta n\n        escribir i\nUSA(n)\n    ETIQUETA(n)');
    assert.equal(report.guiCostModel, undefined);
    assert.equal(notation(report, 1), "O(n)");
    assert.equal(new AsymptoticClassifier().classify(Cost.call("VOLUMEN_GUI", [Cost.symbol("n")])).known, false);
});

test("GUI costos: no reutiliza una medida de entrada después de mutaciones o alias", () => {
    const mutated = single('AGREGA(opciones, "otra")\nLISTA_DESPLEGABLE("e", opciones)', "opciones");
    assert.equal(notation(mutated), "O(?)");
    const local = single('texto = "hola"\nETIQUETA("e", texto)');
    assert.equal(notation(local), "O(1)");
});

test("GUI costos: compone parámetros, literales y volúmenes a través de funciones", () => {
    for (const [argument, expected] of [['["a", "b"]', "O(1)"], ['[texto, texto]', "O(n)"],
        ['opciones', "O(n)"], ['MAYUS(texto)', "O(?)"], ['desconocido', "O(?)"]]) {
        const report = analyze(`F(opciones)\n    LISTA_DESPLEGABLE("e", opciones)\nG(texto, opciones)\n    F(${argument})`);
        assert.equal(notation(report, 1), expected, argument);
    }
    const forwarded = analyze('F(texto)\n    ETIQUETA("e", texto)\nG(texto)\n    F(texto)\nH()\n    G("hola")');
    assert.equal(notation(forwarded, 1), "O(n)");
    assert.equal(notation(forwarded, 2), "O(1)");
    const lengths = analyze('F(opciones)\n    LISTA_DESPLEGABLE("e", opciones)\n    para i = 0 hasta LONG(opciones) - 1\n        MOSTRAR("e")\nG()\n    F(["a", "b"])');
    assert.equal(notation(lengths, 1), "O(1)", "LONG conserva longitud literal, no inventa otro tamaño libre");
});

test("GUI costos: una medida desconocida no recibe un alias asintótico conocido", () => {
    const expression = Cost.call(GUI_VOLUME_MEASURE, [Cost.unknown("argumento no resuelto")]);
    const normalizer = new AsymptoticSizeNormalizer([expression]);
    assert.equal(normalizer.resolve(expression), null);
    assert.equal(normalizer.resolveOrRegister(expression), null);
    assert.equal(normalizer.entries().length, 0);
    assert.equal(new AsymptoticClassifier().classify(expression).known, false);
    const data = Cost.call(GUI_DATA_VALUE, [Cost.constant(9)]);
    assert.equal(new AsymptoticClassifier().classify(data).known, false, "El volumen no convierte datos en un escalar CLRS");
    assert.deepEqual(simplifyCostExpression(Cost.call(GUI_VOLUME_MEASURE, [data])), Cost.constant(9));
    const array = Cost.call(GUI_DATA_VALUE, [Cost.constant(20), Cost.constant(2)]);
    assert.deepEqual(simplifyCostExpression(Cost.call("LONG", [array])), Cost.constant(2));
    assert.equal(simplifyCostExpression(Cost.call("LONG", [data])).kind, "unknown", "No sustituye volumen por longitud");
});

test("GUI costos: recurrencias conservan costo directo y volumen independiente", () => {
    const scalar = analyze('F(n)\n    si n > 0\n        MOSTRAR("e")\n        F(n - 1)');
    assert.equal(notation(scalar), "O(n)");
    const data = analyze('F(n, texto)\n    si n > 0\n        ESTABLECER("e", "texto", texto)\n        F(n - 1, texto)\nG(n)\n    F(n, "hola")');
    assert.match(notation(data), /O\((?:m n|n m|m\*n|n\*m)\)/);
    assert.equal(notation(data, 1), "O(n)");
});

test("GUI costos: invalida alias, escrituras, lecturas, ramas y mutación entre funciones", () => {
    for (const body of ['opciones = ["a"]\notras = opciones\nAGREGA(otras, "b")\nLISTA_DESPLEGABLE("e", opciones)',
        'texto = "a"\nleer texto\nETIQUETA("e", texto)',
        'si usar\n    texto = "a"\nETIQUETA("e", texto)',
        'texto = "a"\ntexto = MAYUS(texto)\nETIQUETA("e", texto)']) {
        assert.equal(notation(single(body, "usar")), "O(?)", body);
    }
    const report = analyze('F(opciones)\n    LISTA_DESPLEGABLE("e", opciones)\nG(opciones)\n    AGREGA(opciones, "otra")\n    F(opciones)');
    assert.equal(notation(report, 1), "O(?)");
    const indirect = analyze('MUTA(opciones)\n    AGREGA(opciones, "otra")\nG(opciones)\n    MUTA(opciones)\n    LISTA_DESPLEGABLE("e", opciones)');
    assert.equal(notation(indirect, 1), "O(?)");
});

test("GUI costos: modelos para cada propiedad y resolución local del tipo real", () => {
    for (const component of Object.values(GUI_COMPONENTS)) {
        for (const [name, descriptor] of Object.entries(component.properties)) {
            for (const write of [false, true]) {
                if (!descriptor.access.includes(write ? "W" : "R")) { continue; }
                const cost = guiPropertyCost(component.type, name, descriptor, write);
                assert.ok(cost.kind && cost.formula && cost.detail, `${component.type}.${name}`);
            }
        }
    }
    assert.equal(notation(single('ENTRADA("e")\nESTABLECER("e", "texto", texto)', "texto")), "O(n)");
    assert.equal(notation(single('VENTANA("v", "Título")\nESTABLECER("v", "modal", Verdadero)')), "O(1)");
    assert.equal(notation(single('DIALOGO_ARCHIVO("v")\nESTABLECER("v", "modal", Verdadero)')), "O(?)");
    assert.equal(notation(single('CALENDARIO("c")\nESTABLECER("c", "fecha", fecha)', "fecha")), "O(1)");
    assert.equal(notation(single('LISTA_VISUAL("l")\nESTABLECER("l", "seleccion", seleccion)', "seleccion")), "O(?)");
    assert.equal(notation(single('ESTABLECER("v", "modal", Verdadero)')), "O(?)", "Sin tipo demostrado no se escoge el más barato");
    for (const property of ["__proto__", "constructor", "toString"]) {
        assert.equal(notation(single(`ESTABLECER("e", "${property}", 1)`)), "O(?)");
    }
});

test("GUI costos: registrar eventos de cambio considera su instantánea inicial", () => {
    const prefix = 'EVENTO(id, texto)\n    escribir texto\nPRINCIPAL()\n    ENTRADA("e")\n';
    assert.equal(notation(analyze(prefix + '    CONECTAR("e", "cambio", EVENTO)'), 1), "O(?)");
    assert.equal(notation(analyze(prefix + '    CONECTAR("e", "activar", EVENTO)'), 1), "O(1)");
    const report = analyze('EVENTO(id)\n    escribir id\nPRINCIPAL(evento)\n    BOTON("b", "OK")\n    CONECTAR("b", evento, EVENTO)');
    assert.equal(notation(report, 1), "O(?)");
    assert.doesNotMatch(JSON.stringify(report.statementsCost[1].costExpression), /TEVENTO/);
});

test("GUI costos: temas, ayuda y retorno GUI opaco mantienen el contrato", () => {
    assert.equal(notation(single('ESTABLECER_TEMA(nombre)', "nombre")), "O(n)");
    assert.equal(notation(single('ESTABLECER_MODO_TEMA("oscuro")')), "O(1)");
    assert.equal(notation(single('OBTENER_TEMA()')), "O(?)");
    for (const definition of Object.values(GUI_FUNCTION_DEFINITIONS)) {
        assert.equal(getStandardLibraryContractHelp(definition.name).cost, definition.cost);
        assert.equal(definition.symbolicEffect.kind, "opaque");
    }
    const runtime = getGuiRuntimeFactorySource();
    assert.doesNotMatch(runtime, /analyzeGuiCosts|GuiCostAnalysis|volumen GUI|costStatus|createGuiMediaAdapter|gui\.video|GStreamer/);
});

test("GUI costos: costo de argumentos anidados y regresión de programas sin GUI", () => {
    const report = single('ETIQUETA("e", MAYUS(texto))', "texto");
    assert.equal(notation(report), "O(?)");
    assert.match(JSON.stringify(report.statementsCost[0].costExpression), /"name":"n"/);
    const plain = single('para i = 1 hasta n\n    escribir i', "n");
    assert.equal(plain.guiCostModel, undefined);
    assert.equal(notation(plain), "O(n)");
    assert.ok(!plain.statementsCost[0].scenarioCost.assumptions.some(a => a.startsWith("GUI:")));
});
