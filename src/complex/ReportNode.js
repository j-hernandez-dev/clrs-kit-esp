export class ReportNode {

    constructor(
        statementsCost = [],
        iterationAnalysis = null,
        recurrenceInputAnalysis = null
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
    }
}
