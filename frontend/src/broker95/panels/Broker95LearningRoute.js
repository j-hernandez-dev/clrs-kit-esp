export const Broker95LearningNodeSide =
    Object.freeze({
        LEFT: "left",
        RIGHT: "right"
    });

export function createBroker95LearningRouteModel(
    catalog,
    route
) {
    requireCatalog(catalog);
    requireRoute(route);

    const catalogLessonById = new Map(
        catalog.lessons.map(lesson => [
            lesson.id,
            lesson
        ])
    );
    const routeLessonById = new Map(
        route.lessons.map(lesson => [
            lesson.lessonId,
            lesson
        ])
    );
    const routeSectionById = new Map(
        route.sections.map(section => [
            section.sectionId,
            section
        ])
    );
    const lessonIds = [];
    const sections = catalog.sections.map(
        section => {
            const progress =
                routeSectionById.get(
                    section.id
                );

            if (!progress) {
                invalidRoute();
            }

            const lessons = section.lessonIds.map(
                lessonId => {
                    const lesson =
                        catalogLessonById.get(
                            lessonId
                        );
                    const lessonProgress =
                        routeLessonById.get(
                            lessonId
                        );

                    if (
                        !lesson ||
                        !lessonProgress ||
                        lesson.sectionId !==
                            section.id ||
                        lessonProgress.sectionId !==
                            section.id
                    ) {
                        invalidRoute();
                    }

                    lessonIds.push(lessonId);

                    return Object.freeze({
                        lesson,
                        progress: lessonProgress,
                        side: lesson.order % 2 === 0
                            ? Broker95LearningNodeSide
                                .RIGHT
                            : Broker95LearningNodeSide
                                .LEFT,
                        current:
                            lesson.id ===
                            route.currentLessonId
                    });
                }
            );

            return Object.freeze({
                section,
                progress,
                lessons: Object.freeze(lessons)
            });
        }
    );
    const uniqueLessonIds = new Set(lessonIds);

    if (
        sections.length !==
            catalog.sectionCount ||
        lessonIds.length !==
            catalog.lessonCount ||
        lessonIds.length !==
            route.totalLessons ||
        uniqueLessonIds.size !==
            lessonIds.length ||
        catalog.lessons.some(
            lesson =>
                !uniqueLessonIds.has(lesson.id)
        ) ||
        route.lessons.some(
            lesson =>
                !uniqueLessonIds.has(
                    lesson.lessonId
                )
        )
    ) {
        invalidRoute();
    }

    const availableLessons = route.lessons
        .filter(lesson =>
            lesson.status === "available"
        );

    if (
        (!route.routeCompleted &&
            (
                availableLessons.length !== 1 ||
                availableLessons[0].lessonId !==
                    route.currentLessonId
            )) ||
        (route.routeCompleted &&
            availableLessons.length !== 0)
    ) {
        invalidRoute();
    }

    return Object.freeze({
        sections: Object.freeze(sections),
        openLessonIds: Object.freeze(
            route.lessons
                .filter(lesson =>
                    lesson.canOpen === true
                )
                .map(lesson =>
                    lesson.lessonId
                )
        ),
        currentLessonId:
            route.currentLessonId,
        routeCompleted:
            route.routeCompleted,
        completedLessons:
            route.completedLessons,
        totalLessons: route.totalLessons,
        progressPercent:
            route.progressPercent
    });
}

export function scrollBroker95LearningTarget(
    target,
    options = {}
) {
    if (
        target == null ||
        typeof target.scrollIntoView !==
            "function"
    ) {
        return false;
    }

    const reducedMotion =
        options.reducedMotion ??
        globalThis.matchMedia?.(
            "(prefers-reduced-motion: reduce)"
        )?.matches ??
        false;

    if (
        options.focus === true &&
        typeof target.focus === "function"
    ) {
        target.focus({ preventScroll: true });
    }

    target.scrollIntoView({
        behavior:
            reducedMotion ? "auto" : "smooth",
        block: "center",
        inline: "nearest"
    });

    return true;
}

function requireCatalog(catalog) {
    if (
        !Array.isArray(catalog?.sections) ||
        !Array.isArray(catalog?.lessons) ||
        !Number.isSafeInteger(
            catalog?.sectionCount
        ) ||
        !Number.isSafeInteger(
            catalog?.lessonCount
        )
    ) {
        invalidRoute();
    }
}

function requireRoute(route) {
    if (
        !Array.isArray(route?.sections) ||
        !Array.isArray(route?.lessons) ||
        !Number.isSafeInteger(
            route?.totalLessons
        ) ||
        !Number.isSafeInteger(
            route?.completedLessons
        ) ||
        !Number.isSafeInteger(
            route?.progressPercent
        ) ||
        typeof route?.routeCompleted !==
            "boolean"
    ) {
        invalidRoute();
    }
}

function invalidRoute() {
    throw new TypeError(
        "Invalid BROKER.95 learning route projection."
    );
}
