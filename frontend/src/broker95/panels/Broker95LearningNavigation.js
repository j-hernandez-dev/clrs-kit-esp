import {
    BROKER_DEFAULT_LEARNING_ROUTE_ID,
    BROKER_LEARNING_ROUTE_IDS
} from "../../../../src/broker95/learning/BrokerLearningRoutesProgress.js";

export const Broker95LearningScreen =
    Object.freeze({
        NETWORK: "network",
        ROUTE: "route",
        LESSON: "lesson"
    });

export function createBroker95LearningNavigation(
    source = {}
) {
    const screen = source.screen ??
        Broker95LearningScreen.NETWORK;
    const routeId = source.routeId ??
        BROKER_DEFAULT_LEARNING_ROUTE_ID;
    const lessonId = source.lessonId ?? null;

    if (
        !Object.values(Broker95LearningScreen)
            .includes(screen) ||
        !BROKER_LEARNING_ROUTE_IDS
            .includes(routeId) ||
        (
            screen !== Broker95LearningScreen.LESSON &&
            lessonId !== null
        ) ||
        (
            screen === Broker95LearningScreen.LESSON &&
            !isLessonId(lessonId)
        )
    ) {
        throw new TypeError(
            "Invalid BROKER.95 learning navigation."
        );
    }

    return Object.freeze({
        screen,
        routeId,
        lessonId
    });
}

export function openBroker95LearningRoute(
    navigation,
    routeId,
    gameState
) {
    const current =
        createBroker95LearningNavigation(navigation);
    const route = findRouteSummary(
        gameState,
        routeId
    );

    if (
        route?.status === "locked" ||
        gameState?.learning?.catalogs?.[routeId] == null ||
        gameState?.learning?.progress?.[routeId] == null
    ) {
        return navigation;
    }

    if (
        current.screen === Broker95LearningScreen.ROUTE &&
        current.routeId === routeId
    ) {
        return navigation;
    }

    return createBroker95LearningNavigation({
        screen: Broker95LearningScreen.ROUTE,
        routeId
    });
}

export function openBroker95LearningLesson(
    navigation,
    lessonId,
    gameState
) {
    const current =
        createBroker95LearningNavigation(navigation);

    if (
        current.screen !==
        Broker95LearningScreen.ROUTE
    ) {
        return navigation;
    }

    const catalog = gameState?.learning
        ?.catalogs?.[current.routeId];
    const lesson = requireCatalogLesson(
        catalog,
        lessonId
    );
    const routeLesson = requireRouteLesson(
        gameState,
        current.routeId,
        lesson.id
    );

    if (routeLesson.canOpen !== true) {
        return navigation;
    }

    if (
        current.screen === Broker95LearningScreen.LESSON &&
        current.lessonId === lesson.id
    ) {
        return navigation;
    }

    return createBroker95LearningNavigation({
        screen: Broker95LearningScreen.LESSON,
        routeId: current.routeId,
        lessonId: lesson.id
    });
}

export function showBroker95LearningRoute(
    navigation
) {
    const current =
        createBroker95LearningNavigation(navigation);

    return current.screen === Broker95LearningScreen.ROUTE
        ? navigation
        : createBroker95LearningNavigation({
            screen: Broker95LearningScreen.ROUTE,
            routeId: current.routeId
        });
}

export function showBroker95LearningNetwork(
    navigation
) {
    const current =
        createBroker95LearningNavigation(navigation);

    return current.screen ===
        Broker95LearningScreen.NETWORK
        ? navigation
        : createBroker95LearningNavigation({
            screen:
                Broker95LearningScreen.NETWORK,
            routeId: current.routeId
        });
}

/**
 * Una actualizaciÃ³n del Host puede bloquear una ruta o lecciÃ³n. La vista
 * local sÃ³lo retrocede; nunca intenta corregir el estado autoritativo.
 */
export function reconcileBroker95LearningNavigation(
    navigation,
    gameState
) {
    const current =
        createBroker95LearningNavigation(navigation);

    if (
        current.screen ===
        Broker95LearningScreen.NETWORK
    ) {
        return navigation;
    }

    const route = findRouteSummary(
        gameState,
        current.routeId
    );
    const routeReadable =
        route?.status !== "locked" &&
        gameState?.learning?.catalogs?.[
            current.routeId
        ] != null &&
        gameState?.learning?.progress?.[
            current.routeId
        ] != null;

    if (!routeReadable) {
        return createBroker95LearningNavigation({
            screen:
                Broker95LearningScreen.NETWORK,
            routeId: current.routeId
        });
    }

    if (current.screen === Broker95LearningScreen.ROUTE) {
        return navigation;
    }

    const catalog = gameState.learning
        .catalogs[current.routeId];
    const lesson = findCatalogLesson(
        catalog,
        current.lessonId
    );
    const routeLesson = findRouteLesson(
        gameState,
        current.routeId,
        current.lessonId
    );

    return lesson != null && routeLesson?.canOpen === true
        ? navigation
        : createBroker95LearningNavigation({
            screen: Broker95LearningScreen.ROUTE,
            routeId: current.routeId
        });
}

function requireCatalogLesson(catalog, lessonId) {
    if (!isLessonId(lessonId)) {
        throw new TypeError(
            "Invalid BROKER.95 learning lesson id."
        );
    }

    const lesson = findCatalogLesson(catalog, lessonId);

    if (!lesson) {
        throw new TypeError(
            "Unknown BROKER.95 learning lesson."
        );
    }

    return lesson;
}

function requireRouteLesson(
    gameState,
    routeId,
    lessonId
) {
    const lesson = findRouteLesson(
        gameState,
        routeId,
        lessonId
    );

    if (!lesson) {
        throw new TypeError(
            "Missing BROKER.95 learning route lesson."
        );
    }

    return lesson;
}

function findRouteSummary(gameState, routeId) {
    return gameState?.learning?.routes?.find(
        route => route.routeId === routeId
    ) ?? null;
}

function findCatalogLesson(catalog, lessonId) {
    return catalog?.lessons?.find(
        lesson => lesson.id === lessonId
    ) ?? null;
}

function findRouteLesson(
    gameState,
    routeId,
    lessonId
) {
    return gameState?.learning?.progress?.[routeId]
        ?.lessons?.find(
            lesson => lesson.lessonId === lessonId
        ) ?? null;
}

function isLessonId(value) {
    return typeof value === "string" &&
        /^(?:algorithm-)?lesson-\d{3,}$/u.test(value);
}
