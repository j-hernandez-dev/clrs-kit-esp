import {
    AsymptoticAnalysisStatus
} from "../asymptotic/AsymptoticAnalysis.js";
import {
    IterationAnalysisKind
} from "../iteration/IterationAnalysis.js";
import {
    RecurrenceAnalysisStatus
} from "../recurrence/RecurrenceAnalysis.js";
import {
    createUnknownComplexityReason
} from "./UnknownComplexityReason.js";
import {
    UnknownComplexityModel
} from "./UnknownComplexityModel.js";

export class UnknownComplexityAnalysisService {

    analyze(report) {
        if (
            !Array.isArray(
                report?.statementsCost
            )
        ) {
            throw new TypeError(
                "Unknown complexity analysis requires a cost report."
            );
        }

        if (
            Object.hasOwn(
                report,
                "unknownComplexityAnalysis"
            )
        ) {
            return report
                .unknownComplexityAnalysis;
        }

        const records = [];

        for (
            const root
            of report.statementsCost
        ) {
            this.collectNode(
                root,
                records
            );
        }

        const model =
            new UnknownComplexityModel(
                records
            );

        Object.defineProperty(
            report,
            "unknownComplexityAnalysis",
            { value: model }
        );

        return model;
    }

    collectNode(node, records) {
        const primary = [];
        const iteration =
            node.iterationAnalysis;

        if (
            iteration?.kind ===
                IterationAnalysisKind.UNKNOWN &&
            iteration.code != null
        ) {
            primary.push(
                this.addReason(
                    node,
                    records,
                    {
                        code: iteration.code,
                        message:
                            iteration.message,
                        scenario: "both"
                    }
                )
            );
        }

        const recurrence =
            node.recurrenceAnalysis;

        if (
            recurrence?.status ===
                RecurrenceAnalysisStatus
                    .UNSUPPORTED &&
            recurrence.code != null
        ) {
            primary.push(
                this.addReason(
                    node,
                    records,
                    {
                        code:
                            recurrence.code,
                        message:
                            recurrence.message,
                        scenario: "worst"
                    }
                )
            );
        }

        const scenarioAnalysis =
            node.scenarioAsymptoticAnalysis;

        if (scenarioAnalysis != null) {
            this.collectAsymptoticReason(
                node,
                records,
                scenarioAnalysis.best,
                "best",
                primary
            );
            this.collectAsymptoticReason(
                node,
                records,
                scenarioAnalysis.worst,
                "worst",
                primary
            );
        } else {
            this.collectAsymptoticReason(
                node,
                records,
                node.asymptoticAnalysis,
                "worst",
                primary
            );
        }

        for (
            const instruction
            of node.instructions ?? []
        ) {
            this.collectNode(
                instruction,
                records
            );
        }
    }

    collectAsymptoticReason(
        node,
        records,
        analysis,
        scenario,
        causes
    ) {
        if (
            analysis?.status !==
                AsymptoticAnalysisStatus.UNKNOWN ||
            analysis.code == null
        ) {
            return;
        }

        this.addReason(
            node,
            records,
            {
                code: analysis.code,
                message:
                    analysis.message,
                scenario,
                causes:
                    causes
                        .filter(reason =>
                            reason.scenario ===
                                "both" ||
                            reason.scenario ===
                                scenario
                        )
                        .map(reason =>
                            reason.code
                        )
            }
        );
    }

    addReason(
        node,
        records,
        data
    ) {
        const reason =
            createUnknownComplexityReason({
                ...data,
                nodeType: node.type,
                location: node.location
            });
        const duplicate =
            records.some(record =>
                record.node === node &&
                record.reason.code ===
                    reason.code &&
                record.reason.scenario ===
                    reason.scenario
            );

        if (!duplicate) {
            records.push({
                node,
                reason
            });
        }

        return reason;
    }
}
