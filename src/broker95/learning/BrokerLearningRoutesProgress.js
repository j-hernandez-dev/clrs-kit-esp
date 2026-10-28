import {
    BrokerGameError
} from "../core/BrokerGameError.js";
import {
    brokerLearningCatalog
} from "./BrokerLearningCatalog.js";
import {
    createBrokerLearningProgress
} from "./BrokerLearningProgress.js";

export const BROKER_LEARNING_ROUTES_PROGRESS_SCHEMA_VERSION =
    1;

export const BrokerLearningRouteId =
    Object.freeze({
        PROGRAMMING: "programming",
        ALGORITHMS: "algorithms"
    });

export const BROKER_LEARNING_ROUTE_IDS =
    Object.freeze(
        Object.values(BrokerLearningRouteId)
    );

export const BROKER_LEARNING_ROUTE_TITLES =
    Object.freeze({
        [BrokerLearningRouteId.PROGRAMMING]:
            "Programación",
        [BrokerLearningRouteId.ALGORITHMS]:
            "Algoritmia"
    });

export const BROKER_DEFAULT_LEARNING_ROUTE_ID =
    BrokerLearningRouteId.PROGRAMMING;

export function getBrokerLearningRouteTitle(
    routeId
) {
    return BROKER_LEARNING_ROUTE_TITLES[
        requireBrokerLearningRouteId(routeId)
    ];
}

const ROOT_KEYS = Object.freeze([
    "availableRouteIds",
    "revision",
    "routes",
    "schemaVersion"
]);
const DORMANT_ROUTE_KEYS = Object.freeze([
    "completedLessonIds",
    "completedSectionIds",
    "currentLessonId",
    "learningCompletedAt",
    "learningStartedAt",
    "lessonAttempts",
    "lessonContractLinks",
    "revision",
    "schemaVersion",
    "totalPayout"
]);

export function createBrokerLearningRoutesProgress(
    source = {},
    options = {}
) {
    if (!isRecord(source)) {
        invalid(
            "BROKER95_LEARNING_ROUTES_PROGRESS_INVALID"
        );
    }

    const initial = Object.keys(source).length === 0;

    if (
        !initial &&
        !hasExactKeys(source, ROOT_KEYS)
    ) {
        invalid(
            "BROKER95_LEARNING_ROUTES_PROGRESS_FIELDS_INVALID"
        );
    }

    const schemaVersion =
        source.schemaVersion ??
        BROKER_LEARNING_ROUTES_PROGRESS_SCHEMA_VERSION;

    if (
        schemaVersion !==
        BROKER_LEARNING_ROUTES_PROGRESS_SCHEMA_VERSION
    ) {
        invalid(
            "BROKER95_LEARNING_ROUTES_PROGRESS_SCHEMA_UNSUPPORTED"
        );
    }

    const routesSource = source.routes ?? {};

    if (
        !isRecord(routesSource) ||
        Object.keys(routesSource).some(
            routeId =>
                !BROKER_LEARNING_ROUTE_IDS.includes(
                    routeId
                )
        )
    ) {
        invalid(
            "BROKER95_LEARNING_ROUTES_INVALID"
        );
    }

    if (
        !initial &&
        BROKER_LEARNING_ROUTE_IDS.some(
            routeId =>
                !Object.hasOwn(
                    routesSource,
                    routeId
                )
        )
    ) {
        invalid(
            "BROKER95_LEARNING_ROUTES_INCOMPLETE"
        );
    }

    const catalogs = normalizeRouteCatalogs(
        options.catalogs
    );
    validatePersistedAvailableRouteIds(
        source.availableRouteIds
    );
    const routes = Object.freeze({
        [BrokerLearningRouteId.PROGRAMMING]:
            createBrokerLearningProgress(
                routesSource[
                    BrokerLearningRouteId
                        .PROGRAMMING
                ] ?? {},
                {
                    catalog:
                        catalogs[
                            BrokerLearningRouteId
                                .PROGRAMMING
                        ]
                }
            ),
        [BrokerLearningRouteId.ALGORITHMS]:
            catalogs[
                BrokerLearningRouteId.ALGORITHMS
            ] == null
                ? createDormantRouteProgress(
                    routesSource[
                        BrokerLearningRouteId
                            .ALGORITHMS
                    ]
                )
                : createBrokerLearningProgress(
                    routesSource[
                        BrokerLearningRouteId
                            .ALGORITHMS
                    ] ?? {},
                    {
                        catalog:
                            catalogs[
                                BrokerLearningRouteId
                                    .ALGORITHMS
                            ]
                    }
                )
    });
    const availableRouteIds =
        deriveAvailableRouteIds(routes);

    return Object.freeze({
        schemaVersion,
        revision: nonNegativeInteger(
            source.revision ?? 0,
            "BROKER95_LEARNING_ROUTES_REVISION_INVALID"
        ),
        availableRouteIds,
        routes
    });
}

export function createInitialBrokerLearningRoutesProgress(
    options = {}
) {
    return createBrokerLearningRoutesProgress(
        {},
        options
    );
}

export function assertBrokerLearningRoutesProgress(
    progress,
    options = {}
) {
    createBrokerLearningRoutesProgress(
        progress,
        options
    );

    return progress;
}

export function getBrokerLearningRouteProgress(
    progress,
    routeId = BROKER_DEFAULT_LEARNING_ROUTE_ID,
    options = {}
) {
    const normalized =
        createBrokerLearningRoutesProgress(
            progress,
            options
        );
    const selectedRouteId =
        requireBrokerLearningRouteId(
            routeId
        );

    return normalized.routes[selectedRouteId];
}

export function replaceBrokerLearningRouteProgress(
    progress,
    routeId,
    routeProgress,
    options = {}
) {
    const normalized =
        createBrokerLearningRoutesProgress(
            progress,
            options
        );
    const selectedRouteId =
        requireBrokerLearningRouteId(
            routeId
        );
    const catalogs = normalizeRouteCatalogs(
        options.catalogs
    );
    const selectedCatalog =
        catalogs[selectedRouteId];
    const normalizedRoute = selectedCatalog == null
        ? createDormantRouteProgress(
            routeProgress
        )
        : createBrokerLearningProgress(
            routeProgress,
            { catalog: selectedCatalog }
        );

    if (
        normalized.routes[selectedRouteId] ===
            normalizedRoute ||
        sameJsonValue(
            normalized.routes[selectedRouteId],
            normalizedRoute
        )
    ) {
        return normalized;
    }

    return createBrokerLearningRoutesProgress(
        {
            ...normalized,
            revision: normalized.revision + 1,
            routes: {
                ...normalized.routes,
                [selectedRouteId]:
                    normalizedRoute
            }
        },
        { catalogs }
    );
}

export function resetBrokerLearningRoutesProgress(
    progress,
    options = {}
) {
    const normalized =
        createBrokerLearningRoutesProgress(
            progress,
            options
        );
    const catalogs = normalizeRouteCatalogs(
        options.catalogs
    );

    return createBrokerLearningRoutesProgress(
        {
            schemaVersion:
                BROKER_LEARNING_ROUTES_PROGRESS_SCHEMA_VERSION,
            revision: normalized.revision + 1,
            availableRouteIds: [
                BrokerLearningRouteId.PROGRAMMING
            ],
            routes: {
                [BrokerLearningRouteId.PROGRAMMING]:
                    createResetRouteProgress(
                        normalized.routes[
                            BrokerLearningRouteId
                                .PROGRAMMING
                        ],
                        catalogs[
                            BrokerLearningRouteId
                                .PROGRAMMING
                        ]
                    ),
                [BrokerLearningRouteId.ALGORITHMS]:
                    createResetRouteProgress(
                        normalized.routes[
                            BrokerLearningRouteId
                                .ALGORITHMS
                        ],
                        catalogs[
                            BrokerLearningRouteId
                                .ALGORITHMS
                        ]
                    )
            }
        },
        { catalogs }
    );
}

export function requireBrokerLearningRouteId(value) {
    if (!BROKER_LEARNING_ROUTE_IDS.includes(value)) {
        invalid(
            "BROKER95_LEARNING_ROUTE_ID_INVALID",
            [{ routeId: value }]
        );
    }

    return value;
}

export function isBrokerLearningRouteAvailable(
    progress,
    routeId,
    options = {}
) {
    const normalized =
        createBrokerLearningRoutesProgress(
            progress,
            options
        );
    const selectedRouteId =
        requireBrokerLearningRouteId(routeId);

    return normalized.availableRouteIds
        .includes(selectedRouteId);
}

function createDormantRouteProgress(source = null) {
    const selected = source ?? {
        schemaVersion: 1,
        revision: 0,
        currentLessonId: null,
        completedLessonIds: [],
        completedSectionIds: [],
        lessonAttempts: {},
        lessonContractLinks: {},
        learningStartedAt: null,
        learningCompletedAt: null,
        totalPayout: 0
    };

    if (
        !isRecord(selected) ||
        !hasExactKeys(
            selected,
            DORMANT_ROUTE_KEYS
        ) ||
        selected.schemaVersion !== 1 ||
        selected.currentLessonId !== null ||
        selected.learningStartedAt !== null ||
        selected.learningCompletedAt !== null ||
        !emptyArray(selected.completedLessonIds) ||
        !emptyArray(selected.completedSectionIds) ||
        !emptyRecord(selected.lessonAttempts) ||
        !emptyRecord(selected.lessonContractLinks) ||
        selected.totalPayout !== 0
    ) {
        invalid(
            "BROKER95_LEARNING_ROUTE_NOT_CATALOGED"
        );
    }

    return Object.freeze({
        schemaVersion: 1,
        revision: nonNegativeInteger(
            selected.revision,
            "BROKER95_LEARNING_ROUTE_REVISION_INVALID"
        ),
        currentLessonId: null,
        completedLessonIds:
            Object.freeze([]),
        completedSectionIds:
            Object.freeze([]),
        lessonAttempts: Object.freeze({}),
        lessonContractLinks:
            Object.freeze({}),
        totalPayout: 0,
        learningStartedAt: null,
        learningCompletedAt: null
    });
}

function createResetRouteProgress(
    progress,
    catalog
) {
    if (catalog == null) {
        return createDormantRouteProgress({
            ...progress,
            revision: progress.revision + 1
        });
    }

    return createBrokerLearningProgress(
        {
            revision: progress.revision + 1
        },
        { catalog }
    );
}

function validatePersistedAvailableRouteIds(
    source = [BrokerLearningRouteId.PROGRAMMING]
) {
    if (
        !Array.isArray(source) ||
        source.length === 0 ||
        new Set(source).size !== source.length ||
        source.some(
            routeId =>
                !BROKER_LEARNING_ROUTE_IDS
                    .includes(routeId)
        ) ||
        !source.includes(
            BrokerLearningRouteId.PROGRAMMING
        )
    ) {
        invalid(
            "BROKER95_LEARNING_ROUTE_AVAILABILITY_INVALID"
        );
    }
}

function deriveAvailableRouteIds(routes) {
    const programming = routes[
        BrokerLearningRouteId.PROGRAMMING
    ];

    return Object.freeze([
        BrokerLearningRouteId.PROGRAMMING,
        ...(
            programming.learningCompletedAt == null
                ? []
                : [BrokerLearningRouteId.ALGORITHMS]
        )
    ]);
}

function normalizeRouteCatalogs(source = null) {
    if (
        source != null &&
        (
            !isRecord(source) ||
            Object.keys(source).some(
                routeId =>
                    !BROKER_LEARNING_ROUTE_IDS
                        .includes(routeId)
            )
        )
    ) {
        invalid(
            "BROKER95_LEARNING_ROUTE_CATALOGS_INVALID"
        );
    }

    return Object.freeze({
        [BrokerLearningRouteId.PROGRAMMING]:
            source?.[
                BrokerLearningRouteId.PROGRAMMING
            ] ?? brokerLearningCatalog,
        [BrokerLearningRouteId.ALGORITHMS]:
            source?.[
                BrokerLearningRouteId.ALGORITHMS
            ] ?? null
    });
}

function emptyArray(value) {
    return Array.isArray(value) &&
        value.length === 0;
}

function emptyRecord(value) {
    return isRecord(value) &&
        Object.keys(value).length === 0;
}

function hasExactKeys(value, expected) {
    const keys = Object.keys(value).sort();

    return keys.length === expected.length &&
        keys.every(
            (key, index) =>
                key === expected[index]
        );
}

function nonNegativeInteger(value, code) {
    if (
        !Number.isSafeInteger(value) ||
        value < 0
    ) {
        invalid(code);
    }

    return value;
}

function sameJsonValue(left, right) {
    return JSON.stringify(left) ===
        JSON.stringify(right);
}

function isRecord(value) {
    return value != null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        (
            Object.getPrototypeOf(value) ===
                Object.prototype ||
            Object.getPrototypeOf(value) === null
        );
}

function invalid(code, diagnostics = []) {
    throw BrokerGameError.invalidRule(
        code,
        "El progreso por rutas de aprendizaje de BROKER.95 no es válido.",
        diagnostics
    );
}
