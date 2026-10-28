import {
    brokerLearningCatalog
} from "./BrokerLearningCatalog.js";
import {
    brokerAlgorithmsLearningCatalog
} from "./BrokerAlgorithmsLearningCatalog.js";
import {
    BrokerLearningRouteId
} from "./BrokerLearningRoutesProgress.js";

/**
 * Catálogos productivos de las dos rutas. El dominio sigue aceptando
 * catálogos inyectados para pruebas, pero la composición de la extensión
 * utiliza esta colección completa por defecto.
 */
export const brokerLearningRouteCatalogs =
    Object.freeze({
        [BrokerLearningRouteId.PROGRAMMING]:
            brokerLearningCatalog,
        [BrokerLearningRouteId.ALGORITHMS]:
            brokerAlgorithmsLearningCatalog
    });
