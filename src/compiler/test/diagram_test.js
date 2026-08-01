import { build } from "../../../flow/src/visitor/DiagramVisitor.js";
import { getAST } from "../BrowserPipeline.js";
import { run } from "../Pipeline.js";

const code = `
PRINCIPAL()
    para i <- 0 hasta 10
        retornar a

    mientras a > 0
        retornar a

    para i <- 10 bajando 0
        retornar a
`;

const ast = getAST(code);

console.log(JSON.stringify(ast, null, 4));

const diagram = build(ast);

console.log(JSON.stringify(diagram, null, 4));