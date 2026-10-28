export class ReportNode {

    constructor(
        statementsCost = [],
        iterationAnalysis = null,
        recurrenceInputAnalysis = null,
        controlFlowAnalysis = null
    ) {
        this.statementsCost =
            statementsCost;

        if (iterationAnalysis != null) {
            Object.defineProperty(
                this,
                "iterationAnalysis",
                {
                    value:
                        iterationAnalysis
                }
            );
        }

        if (
            recurrenceInputAnalysis != null
        ) {
            Object.defineProperty(
                this,
                "recurrenceInputAnalysis",
                {
                    value:
                        recurrenceInputAnalysis
                }
            );
        }

        if (controlFlowAnalysis != null) {
            Object.defineProperty(
                this,
                "controlFlowAnalysis",
                {
                    value:
                        controlFlowAnalysis
                }
            );
        }
    }
}
