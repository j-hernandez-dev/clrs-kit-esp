/**
 * 
 * AccessNode.js
 * 
 * ==================================
 * ACCESS NODE
 * ==================================
 *
 * Representa el acceso a un identificador
 * o elemento de un arreglo dentro del AST.
 *
 * Ejemplos:
 *
 *     variable
 *
 *     arreglo[indice]
 *
 *     matriz[fila][columna]
 *
 * Los índices son expresiones del AST,
 * por lo que pueden contener operaciones,
 * llamadas a funciones u otros accesos.
 *
 * La validación de existencia del símbolo
 * y dimensiones corresponde al análisis
 * semántico.
 * ==================================
 */

import { ASTNode } from "../core/ASTNode.js";
import { NodeTypes } from "../core/NodeTypes.js";


export class UnaryNode extends ASTNode {


    /**
     * 
     * @param {any} location
     * @param {any} operator
     * @param {any} operand
     */
    constructor(operator, operand, location) {

        super(NodeTypes.UNARY, location);
        this.operator = operator;
        this.operand = operand;
    }
}