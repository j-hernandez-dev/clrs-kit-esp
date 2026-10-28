const NAVIGATION_KEYS = Object.freeze({
    ArrowDown: 1,
    ArrowRight: 1,
    ArrowUp: -1,
    ArrowLeft: -1
});

const STATUS_LABELS = Object.freeze({
    locked: "BLOQUEADA",
    available: "DISPONIBLE",
    completed: "COMPLETADA"
});

export function createBroker95LearningRouteSelectorModel(
    learning
) {
    if (!Array.isArray(learning?.routes)) {
        throw new TypeError(
            "Invalid BROKER.95 learning route selector."
        );
    }

    const programming = learning.routes.find(
        route => route.routeId === "programming"
    );
    const routes = learning.routes.map(route => {
        requireRoute(route);

        const hasProjection =
            learning.catalogs?.[route.routeId] != null &&
            learning.progress?.[route.routeId] != null;
        const canOpen =
            route.status !== "locked" &&
            hasProjection;
        const requirement = createRequirement(
            route,
            programming,
            hasProjection
        );

        return Object.freeze({
            ...route,
            canOpen,
            statusLabel:
                STATUS_LABELS[route.status],
            requirement,
            accessibleLabel: createAccessibleLabel(
                route,
                requirement,
                canOpen
            )
        });
    });

    return Object.freeze({
        routes: Object.freeze(routes),
        totalRoutes: routes.length,
        completedRoutes: routes.filter(
            route => route.status === "completed"
        ).length
    });
}

export function moveBroker95LearningRouteFocus(
    routeIds,
    currentRouteId,
    key
) {
    if (
        !Array.isArray(routeIds) ||
        routeIds.length === 0 ||
        routeIds.some(routeId =>
            typeof routeId !== "string" ||
            routeId.length === 0
        ) ||
        typeof currentRouteId !== "string" ||
        typeof key !== "string"
    ) {
        return null;
    }

    if (key === "Home") {
        return routeIds[0];
    }

    if (key === "End") {
        return routeIds.at(-1);
    }

    const offset = NAVIGATION_KEYS[key];

    if (offset == null) {
        return null;
    }

    const currentIndex = Math.max(
        0,
        routeIds.indexOf(currentRouteId)
    );
    const nextIndex = Math.max(
        0,
        Math.min(
            routeIds.length - 1,
            currentIndex + offset
        )
    );

    return routeIds[nextIndex];
}

function createRequirement(
    route,
    programming,
    hasProjection
) {
    if (route.routeId === "programming") {
        return route.status === "completed"
            ? "Fundamento completado"
            : "Ruta inicial · sin requisitos";
    }

    if (route.status === "completed") {
        return "Programación completada · ruta superada";
    }

    if (route.status === "available" && hasProjection) {
        return "Requisito cumplido: Programación completada";
    }

    return programming?.status === "completed"
        ? "Requisito cumplido · currículo en preparación"
        : "Completa Programación para desbloquear";
}

function createAccessibleLabel(
    route,
    requirement,
    canOpen
) {
    const progress = route.totalLessons > 0
        ? `${route.completedLessons} de ${route.totalLessons} lecciones, ${route.progressPercent} por ciento.`
        : "Sin lecciones disponibles todavía.";
    const action = canOpen
        ? "Presiona Entrar para abrir la ruta."
        : "Ruta no interactuable.";

    return `${route.title}. Estado: ${STATUS_LABELS[route.status].toLocaleLowerCase("es-MX")}. ${progress} ${requirement}. ${action}`;
}

function requireRoute(route) {
    if (
        route == null ||
        typeof route !== "object" ||
        typeof route.routeId !== "string" ||
        typeof route.title !== "string" ||
        !Object.hasOwn(STATUS_LABELS, route.status) ||
        !Number.isSafeInteger(route.completedLessons) ||
        !Number.isSafeInteger(route.totalLessons) ||
        !Number.isSafeInteger(route.progressPercent)
    ) {
        throw new TypeError(
            "Invalid BROKER.95 learning route summary."
        );
    }
}
