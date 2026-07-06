
export class BlockCostNode{
    constructor(
        type,
        location,
        expression,
        instructions = [], //costNode
    )
    {
        this.type = type;
        this.location = location;
        this.expression = expression;
        this.instructions = instructions;
    }
}