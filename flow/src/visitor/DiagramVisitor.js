import {
    createDiagram,
    resetContext,
    createNode,
    connect,
    buildBlock,
    createSubgraph,
    addEdgeToSubgraph,
    addNodeToSubgraph,
    registerFunction,
    getFunction
} from "./DiagramContext.js";


/**
 * Construye un objeto de diagrama
 * a partir del AST.
 *
 * @param {any} ast
 * @returns {Object}
 */
export function build(ast) {

    if (!ast) {

        throw new Error(
            "There is no AST to analyze."
        );

    }

    if (ast.type !== "Program") {

        throw new Error(
            "The root node must be a Program."
        );

    }

    //--------------------------------------------------
    // Inicializar contexto
    //--------------------------------------------------

    resetContext();


    const diagram =
        createDiagram();


    const statements =
        ast.statements ?? [];

    //--------------------------------------------------
    // Registrar funciones
    //
    // Primera pasada:
    // solamente guarda las declaraciones.
    //
    // Esto permite resolver llamadas
    // aunque la función esté declarada después.
    //--------------------------------------------------

    for (const statement of statements) {


        if (
            statement.type === "FunctionDeclaration"
        ) {


            if (!statement.identifier) {

                continue;

            }


            registerFunction(

                statement.identifier.name,

                statement

            );

        }

    }

    //--------------------------------------------------
    // Construir subgraphs de funciones
    //
    // Segunda pasada:
    // ahora sí genera los nodos y edges
    // internos de cada función.
    //--------------------------------------------------

    for (const statement of statements) {


        if (
            statement.type === "FunctionDeclaration"
        ) {


            statementType(

                statement,

                diagram

            );

        }

    }

    //--------------------------------------------------
    // Construir flujo top-level
    //
    // Tercera pasada:
    // genera únicamente el código global.
    //--------------------------------------------------

    buildTopLevel(

        statements,

        diagram

    );



    return diagram;

}

/**
 * Construye el flujo top-level.
 *
 * Este flujo representa el código global
 * del programa.
 *
 * Reglas:
 *
 * - Las declaraciones de funciones no forman
 *   parte del flujo top-level.
 *
 * - Las llamadas explícitas permanecen.
 *
 * - Cuando aparece la declaración de PRINCIPAL(),
 *   se agrega una llamada automática inmediatamente
 *   después de la declaración.
 *
 * @param {Object[]} statements
 * @param {Object} diagram
 */
function buildTopLevel(
    statements,
    diagram
) {

    let insertedMainCall = false;

    //--------------------------------------------------
    // ¿Existe al menos una función?
    //--------------------------------------------------

    const hasFunctions =
        statements.some(
            statement =>
                statement.type === "FunctionDeclaration"
        );

    //--------------------------------------------------
    // Crear subgraph solamente si existen funciones
    //--------------------------------------------------

    let targetDiagram = diagram;
    let subgraph = null;

    if (hasFunctions) {

        subgraph =
            createSubgraph(

                diagram,

                {

                    id: "top_level",

                    title: "Flujo global"

                }

            );

        targetDiagram = {

            ...diagram,

            nodes: subgraph.nodes,

            edges: subgraph.edges

        };

    }

    //--------------------------------------------------
    // Inicio programa
    //--------------------------------------------------

    const startId =
        createNode(

            targetDiagram,

            {

                type: "start",

                label: "Inicio"

            }

        );

    let previousNode =
        startId;

    //--------------------------------------------------
    // Código global
    //--------------------------------------------------

    for (const statement of statements) {

        if (
            statement.type === "FunctionDeclaration"
        ) {

            //--------------------------------------------------
            // Llamada implícita a PRINCIPAL()
            //--------------------------------------------------

            if (
                statement.identifier?.name === "PRINCIPAL" &&
                !insertedMainCall
            ) {

                const result =
                    statementType(

                        {

                            type: "FunctionCall",

                            identifier: {

                                name: "PRINCIPAL"

                            },

                            arguments: []

                        },

                        targetDiagram

                    );

                if (result?.entry) {

                    connect(

                        targetDiagram,

                        previousNode,

                        result.entry

                    );

                    previousNode =
                        result.exit;

                }

                insertedMainCall = true;

            }

            continue;

        }

        const result =
            statementType(

                statement,

                targetDiagram

            );

        if (result?.entry) {

            connect(

                targetDiagram,

                previousNode,

                result.entry

            );

            previousNode =
                result.exit;

        }

    }

    //--------------------------------------------------
    // Fin programa
    //--------------------------------------------------

    const endId =
        createNode(

            targetDiagram,

            {

                type: "return",

                label: "Fin"

            }

        );

    connect(

        targetDiagram,

        previousNode,

        endId

    );

    //--------------------------------------------------
    // Registrar subgraph
    //--------------------------------------------------

    if (subgraph) {

        sortSubgraphEdges(
            subgraph
        );

        diagram.subgraphs.push(
            subgraph
        );

    }

}


/**
 * Despacha un nodo del AST hacia
 * su constructor correspondiente.
 *
 * Todos los builders deben devolver:
 *
 * {
 *      entry: String,
 *      exit: String
 * }
 *
 * @param {any} statement
 * @param {Object} diagram
 *
 * @returns {{
 *      entry: String,
 *      exit: String
 * }}
 */
function statementType(
    statement,
    diagram
) {

    if (!statement?.type) {

        throw new Error(
            "The statement node is not valid."
        );

    }

    const builders = {

        Assignment:
            assignment,

        FunctionDeclaration:
            functionDeclaration,

        FunctionCall:
            functionCall,

        WriteStatement:
            writeStatement,

        ReadStatement:
            readStatement,

        IfStatement:
            ifStatement,

        WhileStatement:
            whileStatement,

        ForStatement:
            forStatement,

        ReturnStatement:
            returnStatement

    };

    const builder =
        builders[statement.type];

    if (!builder) {

        throw new Error(

            `There is no builder for node: ${statement.type}`

        );

    }

    return builder(
        statement,
        diagram
    );

}

/**
 * Devuelve la representación textual
 * de una expresión.
 *
 * @param {any} expression
 * @returns {String}
 */
function getExpression(expression) {

    if (!expression || !expression.type) {

        throw new Error(
            "Invalid expression."
        );

    }

    switch (expression.type) {

        //--------------------------------------------------
        // Identificador
        //--------------------------------------------------

        case "Identifier":

            return expression.name;


        //--------------------------------------------------
        // Literales
        //--------------------------------------------------

        case "NumberLiteral":
        case "StringLiteral":
        case "BooleanLiteral":

            return getLiteral(expression);


        //--------------------------------------------------
        // Expresión binaria
        //--------------------------------------------------

        case "BinaryExpression":

            return (

                getExpression(expression.left) +
                " " +
                expression.operator +
                " " +
                getExpression(expression.right)

            );


        //--------------------------------------------------
        // Expresión lógica
        //--------------------------------------------------

        case "LogicalExpression":

            let operator = expression.operator === "&&" 
            ? "Y" : "O";

            return (
                getExpression(expression.left) +
                " " +
                operator +
                " " +
                getExpression(expression.right)

            );


        //--------------------------------------------------
        // Negación lógica
        //--------------------------------------------------

        case "LogicalNot":

            return (

                "No " +

                getExpression(
                    expression.operand
                )

            );


        //--------------------------------------------------
        // Agrupación
        //--------------------------------------------------

        case "GroupExpression":

            return (

                "(" +

                getExpression(
                    expression.expression
                ) +

                ")"

            );


        //--------------------------------------------------
        // Llamada a función
        //--------------------------------------------------

        case "FunctionCall": {

            const args =

                (expression.arguments ?? [])

                    .map(argument =>
                        getExpression(argument)
                    )

                    .join(", ");

            return (

                `${expression.identifier.name}(${args})`

            );

        }


        //--------------------------------------------------
        // Acceso a arreglo
        //--------------------------------------------------

        case "Access": {

            let result =
                expression.identifier.name;

            for (const index of expression.indexes ?? []) {

                result +=

                    `[${getExpression(index)}]`;

            }

            return result;

        }


        //--------------------------------------------------
        // No soportado
        //--------------------------------------------------

        default:

            throw new Error(

                `Unsupported expression: ${expression.type}`

            );

    }

}


/**
 * Convierte un literal
 * a su representación textual.
 *
 * @param {any} literal
 *
 * @returns {String}
 */
function getLiteral(literal) {

    switch (literal.type) {

        case "StringLiteral":

            return `"${literal.value}"`;


        case "BooleanLiteral":

            return literal.value === true ||
                literal.value === "TRUE"

                ? "Verdadero"

                : "Falso";


        default:

            return String(literal.value);

    }

}

/**
 * Construye un nodo de proceso
 * para una asignación.
 *
 * @param {any} statement
 * @param {Object} diagram
 *
 * @returns {{
 *      entry: String,
 *      exit: String
 * }}
 */
function assignment(
    statement,
    diagram
) {

    const left =
        getExpression(statement.left);

    const right =
        getExpression(statement.right);

    const id =
        createNode(diagram, {

            type: "process",

            label:
                `${left} <- ${right}`

        });

    return {

        entry: id,

        exit: id

    };

}


function functionDeclaration(
    statement,
    diagram
) {

    if (!statement.identifier) {

        throw new Error(
            "The function declaration does not have an identifier."
        );

    }


    //--------------------------------------------------
    // Nombre función
    //--------------------------------------------------

    const identifier =
        statement.identifier.name;



    //--------------------------------------------------
    // Parámetros
    //--------------------------------------------------

    const args =

        (statement.parameters ?? [])

            .map(parameter => {

                let result =
                    parameter.identifier.name;


                for (const _ of parameter.dimensions ?? []) {

                    result += "[]";

                }


                return result;

            })

            .join(", ");



    //--------------------------------------------------
    // Crear contexto de función
    //--------------------------------------------------

    const subgraph =
        createSubgraph(

            diagram,

            {

                id:
                    `function_${identifier}`,

                title:
                    `${identifier}`

            }

        );



    //--------------------------------------------------
    // Diagrama temporal de función
    //--------------------------------------------------

    const functionDiagram = {

        ...diagram,

        nodes:
            subgraph.nodes,

        edges:
            subgraph.edges

    };



    //--------------------------------------------------
    // Nodo inicio
    //--------------------------------------------------

    const startId =
        createNode(

            functionDiagram,

            {

                type: "start",

                label:
                    `Inicio\n${identifier}(${args})`

            }

        );



    //--------------------------------------------------
    // Construir cuerpo
    //--------------------------------------------------

    const body =
        buildBlock(

            functionDiagram,

            statement.body?.statements,

            statementType

        );



    let exitId;



    //--------------------------------------------------
    // Función vacía
    //--------------------------------------------------

    if (!body.first) {

        exitId =
            createNode(

                functionDiagram,

                {

                    type: "return",

                    label: "Fin"

                }

            );


        connect(

            functionDiagram,

            startId,

            exitId

        );

    }


    else {


        //--------------------------------------------------
        // Inicio -> cuerpo
        //--------------------------------------------------

        connect(

            functionDiagram,

            startId,

            body.first

        );



        //--------------------------------------------------
        // Revisar retorno
        //--------------------------------------------------

        const statements =
            statement.body?.statements ?? [];


        const lastStatement =
            statements.at(-1);



        exitId =
            body.last;



        if (!endsWithReturn(lastStatement)) {

            exitId =
                createNode(

                    functionDiagram,

                    {

                        type: "return",

                        label: "Fin"

                    }

                );


            connect(

                functionDiagram,

                body.last,

                exitId

            );

        }

    }

    //--------------------------------------------------
    // Ordenar el subgraph
    //--------------------------------------------------

    sortSubgraphEdges(
        subgraph
    );

    //--------------------------------------------------
    // Guardar subgraph
    //--------------------------------------------------

    diagram.subgraphs.push(
        subgraph
    );



    //--------------------------------------------------
    // Registrar función
    //--------------------------------------------------

    registerFunction(

        identifier,

        {

            entry: startId,

            exit: exitId

        }

    );


    return {

        entry: startId,

        exit: exitId

    };

}

function endsWithReturn(statement) {

    if (!statement) {

        return false;

    }


    switch (statement.type) {

        case "ReturnStatement":

            return true;


        case "IfStatement":

            return (

                statement.thenBlock?.statements
                    ?.at(-1)?.type === "ReturnStatement"

                &&

                statement.elseBlock?.statements
                    ?.at(-1)?.type === "ReturnStatement"

            );


        default:

            return false;

    }

}

/**
 * Ordena las conexiones de un subgraph
 * según el orden de creación de los nodos.
 *
 * @param {Object} subgraph
 */
export function sortSubgraphEdges(
    subgraph
) {

    if (!subgraph?.edges) {

        return;

    }


    const getNumber = (id) => {

        return Number(
            String(id)
                .replace("N", "")
        );

    };


    subgraph.edges.sort((a, b) => {

        const sourceA =
            getNumber(a.source);

        const sourceB =
            getNumber(b.source);


        if (sourceA !== sourceB) {

            return sourceA - sourceB;

        }


        const targetA =
            getNumber(a.target);

        const targetB =
            getNumber(b.target);


        return targetA - targetB;

    });

}


/**
 * Construye un nodo de llamada
 * a función o procedimiento.
 *
 * La función llamada no se expande aquí.
 * Su contenido pertenece al subgraph
 * generado por functionDeclaration().
 *
 * @param {any} statement
 * @param {Object} diagram
 *
 * @returns {{
 *      entry: String,
 *      exit: String
 * }}
 */
function functionCall(
    statement,
    diagram
) {

    if (!statement.identifier) {

        throw new Error(
            "The function call does not have an identifier."
        );

    }


    //--------------------------------------------------
    // Nombre función
    //--------------------------------------------------

    const identifier =
        statement.identifier.name;



    //--------------------------------------------------
    // Argumentos
    //--------------------------------------------------

    const args =

        (statement.arguments ?? [])

            .map(argument =>
                getExpression(argument)
            )

            .join(", ");



    //--------------------------------------------------
    // Buscar función registrada
    //--------------------------------------------------

    const targetFunction =
        getFunction(identifier);



    //--------------------------------------------------
    // Nodo llamada
    //--------------------------------------------------

    const id =
        createNode(

            diagram,

            {

                type: "call",

                label:
                    `${identifier}(${args})`

            }

        );



    //--------------------------------------------------
    // Asociar referencia al subgraph
    //--------------------------------------------------

    const node =
        diagram.nodes.find(

            item =>
                item.id === id

        );


    if (
        node &&
        targetFunction
    ) {

        node.reference = {

            type: "function",

            name: identifier,

            subgraphId:
                targetFunction.subgraphId

        };

    }



    //--------------------------------------------------
    // Resultado
    //--------------------------------------------------

    return {

        entry: id,

        exit: id

    };

}


/**
 * Construye un nodo
 * de escritura.
 *
 * @param {any} statement
 * @param {Object} diagram
 *
 * @returns {{
 *      entry: String,
 *      exit: String
 * }}
 */
function writeStatement(
    statement,
    diagram
) {

    const label =

        "Salida " +

        (statement.expressions ?? [])

            .map(expression =>
                getExpression(expression)
            )

            .join(", ");

    const id =
        createNode(diagram, {

            type: "write",

            label

        });

    return {

        entry: id,

        exit: id

    };

}


/**
 * Construye un nodo
 * de lectura.
 *
 * @param {any} statement
 * @param {Object} diagram
 *
 * @returns {{
 *      entry: String,
 *      exit: String
 * }}
 */
function readStatement(
    statement,
    diagram
) {

    const label =

        "Entrada " +

        (statement.identifiers ?? [])

            .map(identifier =>
                getExpression(identifier)
            )

            .join(", ");

    const id =
        createNode(diagram, {

            type: "read",

            label

        });

    return {

        entry: id,

        exit: id

    };

}


/**
 * Construye un nodo
 * de retorno.
 *
 * @param {any} statement
 * @param {Object} diagram
 *
 * @returns {{
 *      entry: String,
 *      exit: String
 * }}
 */
function returnStatement(
    statement,
    diagram
) {

    let label = "Retornar";

    if (statement.expression) {

        label +=

            "\n" +

            getExpression(
                statement.expression
            );

    }

    const id =
        createNode(diagram, {

            type: "return",

            label

        });

    return {

        entry: id,

        exit: id

    };

}

function ifStatement(
    statement,
    diagram
) {

    const decisionId =
        createNode(diagram, {

            type: "decision",

            label:
                `${getExpression(statement.condition)}`

        });


    const branches = [];


    //--------------------------------------------------
    // THEN
    //--------------------------------------------------

    const thenBlock =
        buildBlock(

            diagram,

            statement.thenBlock?.statements,

            statementType

        );


    branches.push({

        decision:
            decisionId,

        block:
            thenBlock,

        label:
            "Sí"

    });



    //--------------------------------------------------
    // ELSE IF
    //--------------------------------------------------

    let previousDecision =
        decisionId;


    for (const branch of statement.elseIfBranches ?? []) {


        const elseIfId =
            createNode(diagram, {

                type: "decision",

                label:
                    `¿${getExpression(branch.condition)}?`

            });


        connect(

            diagram,

            previousDecision,

            elseIfId,

            "No"

        );


        const block =
            buildBlock(

                diagram,

                branch.block?.statements,

                statementType

            );


        branches.push({

            decision:
                elseIfId,

            block,

            label:
                "Sí"

        });


        previousDecision =
            elseIfId;

    }



    //--------------------------------------------------
    // ELSE
    //--------------------------------------------------

    let hasElse =
        false;


    if (statement.elseBlock) {

        hasElse =
            true;


        const elseBlock =
            buildBlock(

                diagram,

                statement.elseBlock.statements,

                statementType

            );


        branches.push({

            decision:
                previousDecision,

            block:
                elseBlock,

            label:
                "No"

        });

    }



    //--------------------------------------------------
    // Determinar si necesita merge
    //--------------------------------------------------

    const needsMerge =

        branches.some(branch => {

            return branch.block.first
                &&
                !isTerminal(
                    branch.block.last,
                    diagram
                );

        })

        ||

        !hasElse;



    let mergeId = null;


    if (needsMerge) {

        mergeId =
            createNode(diagram, {

                type: "merge",

                label: ""

            });

    }



    //--------------------------------------------------
    // Conectar ramas
    //--------------------------------------------------

    for (const branch of branches) {


        const {

            decision,

            block,

            label

        } = branch;



        if (block.first) {


            connect(

                diagram,

                decision,

                block.first,

                label

            );


            if (mergeId) {

                connectToMerge(

                    block.last,

                    mergeId,

                    diagram

                );

            }


        } else {


            if (mergeId) {


                connect(

                    diagram,

                    decision,

                    mergeId,

                    label

                );


            }

        }

    }



    //--------------------------------------------------
    // Si hay else-if pero no else,
    // el último No continúa
    //--------------------------------------------------

    if (!hasElse && mergeId) {

        connect(

            diagram,

            previousDecision,

            mergeId,

            "No"

        );

    }

    //--------------------------------------------------
    // Resultado
    //--------------------------------------------------

    return {

        entry:
            decisionId,

        exit:
            mergeId ?? null

    };

}

function connectToMerge(
    nodeId,
    mergeId,
    diagram
) {

    if (!nodeId) {

        return false;

    }


    if (isTerminal(nodeId, diagram)) {

        return false;

    }


    connect(
        diagram,
        nodeId,
        mergeId
    );


    return true;

}

function isTerminal(nodeId, diagram) {

    if (!nodeId) {

        return false;

    }


    const node =
        diagram.nodes.find(
            node => node.id === nodeId
        );


    if (!node) {

        return false;

    }


    return node.type === "return";

}

/**
 * Genera el diagrama de un ciclo Mientras.
 *
 * @param {any} statement
 * @param {Object} diagram
 *
 * @returns {{
 *      entry: String,
 *      exit: String
 * }}
 */
function whileStatement(
    statement,
    diagram
) {

    //--------------------------------------------------
    // Nodo decisión
    //--------------------------------------------------

    const condition =
        getExpression(statement.condition);


    const decisionId =
        createNode(diagram, {

            type: "decision",

            label:
                `¿${condition}?`

        });



    //--------------------------------------------------
    // Bloque del ciclo
    //--------------------------------------------------

    const body =
        buildBlock(

            diagram,

            statement.body?.statements,

            statementType

        );



    //--------------------------------------------------
    // Rama verdadera
    //--------------------------------------------------

    if (body.first) {


        connect(

            diagram,

            decisionId,

            body.first,

            "Sí"

        );


        if (
            !isTerminal(
                body.last,
                diagram
            )
        ) {


            connect(

                diagram,

                body.last,

                decisionId

            );

        }

    } else {


        // Mientras vacío:
        // vuelve inmediatamente a evaluar

        connect(

            diagram,

            decisionId,

            decisionId,

            "Sí"

        );

    }



    //--------------------------------------------------
    // Rama falsa
    //--------------------------------------------------

    return {

        entry:
            decisionId,

        exit:
            decisionId

    };

}

/**
 * Genera el diagrama de un ciclo Para.
 *
 * @param {any} statement
 * @param {Object} diagram
 *
 * @returns {{
 *      entry: String,
 *      exit: String
 * }}
 */
function forStatement(
    statement,
    diagram
) {

    //--------------------------------------------------
    // Nodo preparación
    //--------------------------------------------------

    const forId =
        createNode(diagram, {

            type: "preparation",

            label:
                buildForHeader(statement)

        });



    //--------------------------------------------------
    // Bloque ciclo
    //--------------------------------------------------

    const body =
        buildBlock(

            diagram,

            statement.body?.statements,

            statementType

        );



    //--------------------------------------------------
    // Conectar cuerpo
    //--------------------------------------------------

    if (body.first) {


        connect(

            diagram,

            forId,

            body.first

        );


        if (
            !isTerminal(
                body.last,
                diagram
            )
        ) {

            connect(

                diagram,

                body.last,

                forId

            );

        }

    }



    //--------------------------------------------------
    // Salida
    //--------------------------------------------------

    return {

        entry:
            forId,

        exit:
            forId

    };

}


/**
 * Construye el encabezado textual de un ciclo Para.
 *
 * @param {any} statement
 */
function buildForHeader(statement) {

    const variable =
        getExpression(statement.initializer.left);

    const initialValue =
        getExpression(statement.initializer.right);

    const finalValue =
        getExpression(statement.condition.right);

    const incrementOperator =
        statement.increment.right.operator;

    const direction =

        incrementOperator === "+"
            ? "hasta"
            : "bajando";

    return (

        `Para ${variable} <- ${initialValue} ${direction} ${finalValue}`

    );

}