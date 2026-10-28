import {
    BROKER_LEARNING_ROUTE_IDS,
    BrokerLearningRouteId,
    createBrokerLearningRoutesProgress,
    getBrokerLearningRouteProgress
} from "./BrokerLearningRoutesProgress.js";
import {
    isBrokerLearningContract
} from "../core/BrokerContract.js";
import {
    BrokerGameError
} from "../core/BrokerGameError.js";
import {
    brokerLearningCatalog
} from "./BrokerLearningCatalog.js";
import {
    reconcileBrokerLearningProgress
} from "./BrokerLearningProgressReconciliation.js";

/**
 * Reconcilia cada ruta exclusivamente contra los contratos que declaran su
 * misma identidad. Ningún contrato puede crear enlaces en otra ruta.
 */
export function reconcileBrokerLearningRoutesProgress(
    source = {},
    contracts = [],
    options = {}
) {
    const progress =
        createBrokerLearningRoutesProgress(
            source,
            options
        );
    const catalogs = Object.freeze({
        [BrokerLearningRouteId.PROGRAMMING]:
            options.catalogs?.[
                BrokerLearningRouteId.PROGRAMMING
            ] ?? brokerLearningCatalog,
        [BrokerLearningRouteId.ALGORITHMS]:
            options.catalogs?.[
                BrokerLearningRouteId.ALGORITHMS
            ] ?? null
    });
    let routes = progress.routes;

    for (const routeId of BROKER_LEARNING_ROUTE_IDS) {
        const routeContracts = contracts.filter(
            contract =>
                isBrokerLearningContract(contract) &&
                contract.learningRouteId === routeId
        );
        const catalog = catalogs[routeId];

        if (catalog == null) {
            if (routeContracts.length > 0) {
                invalidReconciliation(
                    "BROKER95_LEARNING_ROUTE_RECONCILIATION_NOT_CATALOGED",
                    [{ routeId }]
                );
            }

            continue;
        }

        routes = {
            ...routes,
            [routeId]: reconcileBrokerLearningProgress(
                getBrokerLearningRouteProgress(
                    progress,
                    routeId,
                    options
                ),
                routeContracts,
                { catalog }
            )
        };
    }

    return createBrokerLearningRoutesProgress(
        {
            ...progress,
            routes
        },
        options
    );
}

function invalidReconciliation(
    code,
    diagnostics = []
) {
    throw BrokerGameError.invalidRule(
        code,
        "No fue posible reconciliar los contratos con sus rutas de aprendizaje.",
        diagnostics
    );
}
