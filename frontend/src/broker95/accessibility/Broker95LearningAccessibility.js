const NAVIGATION_KEYS = Object.freeze({
    ArrowDown: 1,
    ArrowRight: 1,
    ArrowUp: -1,
    ArrowLeft: -1
});

export function createBroker95LearningLessonLabel({
    lesson,
    progress,
    section,
    totalLessons
}) {
    requireLessonInput({
        lesson,
        progress,
        section,
        totalLessons
    });

    return [
        `Lección ${lesson.order} de ${totalLessons}`,
        lesson.title,
        `Sección ${section.order}: ${section.title}`,
        `Estado: ${statusLabel(progress.status)}`
    ].join(". ");
}

export function createBroker95LearningSectionLabel({
    section,
    progress
}) {
    if (
        !Number.isSafeInteger(section?.order) ||
        typeof section?.title !== "string" ||
        !Number.isSafeInteger(
            progress?.completedLessons
        ) ||
        !Number.isSafeInteger(
            progress?.totalLessons
        )
    ) {
        invalidAccessibility();
    }

    return `Sección ${section.order}: ${section.title}. ${progress.completedLessons} de ${progress.totalLessons} lecciones completadas. Estado: ${statusLabel(progress.status)}.`;
}

export function moveBroker95LearningFocus(
    openLessonIds,
    currentLessonId,
    key
) {
    if (
        !Array.isArray(openLessonIds) ||
        openLessonIds.length === 0 ||
        openLessonIds.some(
            lessonId => !isLessonId(lessonId)
        ) ||
        !isLessonId(currentLessonId) ||
        typeof key !== "string"
    ) {
        return null;
    }

    if (key === "Home") {
        return openLessonIds[0];
    }

    if (key === "End") {
        return openLessonIds.at(-1);
    }

    const offset = NAVIGATION_KEYS[key];

    if (offset == null) {
        return null;
    }

    const currentIndex = openLessonIds
        .indexOf(currentLessonId);

    if (currentIndex < 0) {
        return openLessonIds[0];
    }

    const nextIndex = Math.max(
        0,
        Math.min(
            openLessonIds.length - 1,
            currentIndex + offset
        )
    );

    return openLessonIds[nextIndex];
}

function requireLessonInput({
    lesson,
    progress,
    section,
    totalLessons
}) {
    if (
        !isLessonId(lesson?.id) ||
        !Number.isSafeInteger(lesson?.order) ||
        typeof lesson?.title !== "string" ||
        progress?.lessonId !== lesson.id ||
        !Number.isSafeInteger(section?.order) ||
        typeof section?.title !== "string" ||
        !Number.isSafeInteger(totalLessons) ||
        totalLessons < lesson.order
    ) {
        invalidAccessibility();
    }
}

function statusLabel(status) {
    return {
        locked: "bloqueada",
        available: "disponible, estás aquí",
        completed: "completada"
    }[status] ?? "desconocido";
}

function isLessonId(value) {
    return typeof value === "string" &&
        /^(?:algorithm-)?lesson-\d{3,}$/u
            .test(value);
}

function invalidAccessibility() {
    throw new TypeError(
        "Invalid BROKER.95 learning accessibility projection."
    );
}
