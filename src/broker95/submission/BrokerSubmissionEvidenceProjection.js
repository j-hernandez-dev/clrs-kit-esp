export const BROKER_SUBMISSION_EVIDENCE_OUTPUT_LIMIT =
    4_096;

/**
 * Proyección compacta para CIPHER. Excluye de manera deliberada stdin y el
 * resultado esperado de cada caso; conserva sólo el resultado observado.
 */
export function createBrokerCompactTestEvidence(
    execution
) {
    return Object.freeze({
        executionVersion:
            execution.executionVersion,
        status: execution.status,
        ...(execution.gui ? { gui: execution.gui } : {}),
        analysis: execution.analysis,
        summary: execution.summary,
        elapsedMs: execution.elapsedMs,
        cases: Object.freeze(
            execution.testCases.map(item =>
                Object.freeze({
                    id: item.id,
                    kind: item.kind,
                    requirementIds:
                        item.requirementIds,
                    comparison: item.comparison,
                    status: item.status,
                    reason: item.reason,
                    stdout: truncateEvidenceText(
                        item.stdout
                    ),
                    stdoutTruncated:
                        item.stdout.length >
                            BROKER_SUBMISSION_EVIDENCE_OUTPUT_LIMIT,
                    stderr: truncateEvidenceText(
                        item.stderr
                    ),
                    stderrTruncated:
                        item.stderr.length >
                            BROKER_SUBMISSION_EVIDENCE_OUTPUT_LIMIT,
                    exitCode: item.exitCode,
                    signal: item.signal,
                    elapsedMs: item.elapsedMs
                })
            )
        )
    });
}

function truncateEvidenceText(value) {
    return String(value ?? "").slice(
        0,
        BROKER_SUBMISSION_EVIDENCE_OUTPUT_LIMIT
    );
}
