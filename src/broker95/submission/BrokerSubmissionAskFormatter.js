export function formatBrokerSubmissionAsk(result) {
    return [
        "CIPHER // CONSULTA",
        "────────────────",
        `Contrato #${result.contract.id} · ${result.contract.title}`,
        "",
        result.answer
    ].join("\n");
}
