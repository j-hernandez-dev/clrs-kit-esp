import {
    BrokerContractType
} from "../core/BrokerContract.js";
import {
    BrokerGameError
} from "../core/BrokerGameError.js";

/**
 * Crea la notificación persistente de terminal después de obtener un
 * ejercicio desde Aprendizaje. El tipo del contrato sigue siendo una regla
 * interna: para el jugador se presenta mediante el ciclo normal de contratos.
 */
export function formatBrokerLearningContractCreated(
    source
) {
    const contract = source?.contract;
    const lesson = source?.lesson;

    if (
        contract == null ||
        typeof contract !== "object" ||
        contract.contractType !==
            BrokerContractType.LEARNING ||
        !Number.isSafeInteger(contract.id) ||
        contract.id <= 0 ||
        typeof contract.title !== "string" ||
        contract.title.trim().length === 0 ||
        contract.title.length > 240 ||
        lesson == null ||
        typeof lesson !== "object" ||
        lesson.learningRouteId !==
            contract.learningRouteId ||
        lesson.lessonId !== contract.lessonId ||
        lesson.sectionId !== contract.sectionId ||
        typeof lesson.routeTitle !== "string" ||
        lesson.routeTitle.trim().length === 0 ||
        !Number.isSafeInteger(
            lesson.lessonOrder
        ) ||
        lesson.lessonOrder < 1 ||
        typeof lesson.lessonTitle !== "string" ||
        lesson.lessonTitle.trim().length === 0
    ) {
        throw BrokerGameError.invalidRule(
            "BROKER95_LEARNING_TERMINAL_CONTRACT_INVALID",
            "No fue posible presentar el contrato generado.",
            []
        );
    }

    return [
        "┌─[BROKER.95://NUEVO-CONTRATO]",
        `│ #${contract.id} · ${contract.title.trim()}`,
        "│",
        `│ Ruta: ${lesson.routeTitle.trim()}`,
        `│ Lección ${lesson.lessonOrder} · ${lesson.lessonTitle.trim()}`,
        "│",
        "│ Broker.95 generó un ejercicio basado en esta lección.",
        "├─[SIGUIENTE PASO]",
        "│ Ve a Terminal y utiliza:",
        `│ ai -set ${contract.id}`,
        "│",
        `│ Para inspeccionarlo: ai -read ${contract.id}`,
        "└─[FIN DEL AVISO]"
    ].join("\n");
}
