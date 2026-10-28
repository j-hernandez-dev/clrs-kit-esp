import {
    createExecutionCoveragePoint,
    ExecutionCoverageKind,
    normalizeExecutionCoverageEvent
} from "../../runtime/ExecutionCoverageEvent.js";
import {
    CLRS_TEST_LIMITS
} from "./CLRSTestTypes.js";
import {
    invalid,
    requireInlineText,
    requireNonNegativeInteger,
    requireRecord
} from "./CLRSTestValidation.js";

export const CLRS_TEST_COVERAGE_VERSION = 1;

const CONDITION_KINDS = new Set([
    ExecutionCoverageKind.BRANCH,
    ExecutionCoverageKind.LOOP
]);

export class CLRSTestCoveragePoint {

    constructor(source = {}) {
        const input = requireRecord(
            source,
            "CLRS_TEST_COVERAGE_POINT_INVALID",
            "coverage.point"
        );
        const runtimePoint =
            createExecutionCoveragePoint(
                input.kind,
                input.location,
                { name: input.name }
            );

        if (
            runtimePoint == null ||
            input.pointId !== runtimePoint.pointId
        ) {
            invalid(
                "CLRS_TEST_COVERAGE_POINT_ID_INVALID",
                "coverage.point.pointId"
            );
        }

        const sourcePath = requireInlineText(
            input.location?.sourcePath,
            CLRS_TEST_LIMITS.maximumPathCharacters,
            "CLRS_TEST_COVERAGE_PATH_INVALID",
            "coverage.point.location.sourcePath"
        );
        const hitCount = requireNonNegativeInteger(
            input.hitCount,
            "CLRS_TEST_COVERAGE_HIT_COUNT_INVALID",
            "coverage.point.hitCount"
        );
        const outcomeCounts =
            normalizeOutcomeCounts(
                input.outcomeCounts,
                runtimePoint.kind,
                hitCount
            );

        this.pointId = runtimePoint.pointId;
        this.kind = runtimePoint.kind;
        this.name = runtimePoint.name ?? null;
        this.location = Object.freeze({
            sourcePath,
            ...runtimePoint.location
        });
        this.hitCount = hitCount;
        this.outcomeCounts = outcomeCounts;

        Object.freeze(this);
    }
}

export class CLRSTestCoverage {

    constructor(source = {}) {
        const input = requireRecord(
            source,
            "CLRS_TEST_COVERAGE_INVALID",
            "coverage"
        );

        if (!Array.isArray(input.points)) {
            invalid(
                "CLRS_TEST_COVERAGE_POINTS_INVALID",
                "coverage.points"
            );
        }

        const points = input.points.map(point =>
            point instanceof CLRSTestCoveragePoint
                ? point
                : new CLRSTestCoveragePoint(point)
        );

        if (
            new Set(points.map(point => point.pointId))
                .size !== points.length
        ) {
            invalid(
                "CLRS_TEST_COVERAGE_POINTS_DUPLICATED",
                "coverage.points"
            );
        }

        if (
            typeof input.complete !== "boolean" ||
            typeof input.truncated !== "boolean"
        ) {
            invalid(
                "CLRS_TEST_COVERAGE_STATE_INVALID",
                "coverage"
            );
        }

        this.coverageVersion =
            CLRS_TEST_COVERAGE_VERSION;
        this.complete = input.complete;
        this.truncated = input.truncated;
        this.eventCount =
            requireNonNegativeInteger(
                input.eventCount,
                "CLRS_TEST_COVERAGE_EVENT_COUNT_INVALID",
                "coverage.eventCount"
            );
        this.testCount = requireCoverageTestCount(
            input.testCount ?? 1,
            "coverage.testCount"
        );
        this.evidenceTestCount =
            requireCoverageTestCount(
                input.evidenceTestCount ?? 1,
                "coverage.evidenceTestCount"
            );

        if (
            this.evidenceTestCount > this.testCount ||
            (
                this.complete &&
                this.evidenceTestCount !== this.testCount
            )
        ) {
            invalid(
                "CLRS_TEST_COVERAGE_TEST_COUNT_INVALID",
                "coverage.evidenceTestCount"
            );
        }

        this.points = Object.freeze(points);
        this.summary = summarizeCoverage(points);

        Object.freeze(this);
    }
}

export function createCLRSTestCoverage(source) {
    return source instanceof CLRSTestCoverage
        ? source
        : new CLRSTestCoverage(source);
}

/**
 * Cruza el catálogo estático del programa con los eventos pertenecientes a un
 * único caso. Los puntos no visitados permanecen con hitCount 0.
 */
export function aggregateCLRSTestCoverage({
    sourcePath,
    catalog = [],
    events = [],
    complete = false,
    truncated = false
}) {
    if (
        !Array.isArray(catalog) ||
        !Array.isArray(events)
    ) {
        invalid(
            "CLRS_TEST_COVERAGE_EVIDENCE_INVALID",
            "coverage"
        );
    }

    const points = new Map();

    for (const source of catalog) {
        const point = normalizeCatalogPoint(source);

        if (point == null) {
            invalid(
                "CLRS_TEST_COVERAGE_CATALOG_INVALID",
                "coverage.catalog"
            );
        }

        points.set(
            point.pointId,
            mutablePoint(point, sourcePath)
        );
    }

    for (const source of events) {
        const event =
            normalizeExecutionCoverageEvent(
                source
            );

        if (event == null) {
            invalid(
                "CLRS_TEST_COVERAGE_EVENT_INVALID",
                "coverage.events"
            );
        }

        const point = points.get(event.pointId) ??
            mutablePoint(event, sourcePath);

        point.hitCount += 1;

        if (event.outcome === true) {
            point.trueCount += 1;
        } else if (event.outcome === false) {
            point.falseCount += 1;
        }

        points.set(event.pointId, point);
    }

    return new CLRSTestCoverage({
        complete,
        truncated,
        eventCount: events.length,
        testCount: 1,
        evidenceTestCount: 1,
        points: [...points.values()].map(point => ({
            pointId: point.pointId,
            kind: point.kind,
            name: point.name,
            location: point.location,
            hitCount: point.hitCount,
            outcomeCounts:
                CONDITION_KINDS.has(point.kind)
                    ? {
                        true: point.trueCount,
                        false: point.falseCount
                    }
                    : null
        }))
    });
}

/**
 * Une la evidencia independiente de los casos ejecutados. Conserva el
 * catálogo completo, suma visitas y resultados condicionales y distingue los
 * casos solicitados de aquellos que realmente produjeron una traza.
 */
export function accumulateCLRSTestCoverage({
    coverages,
    testCount = null
}) {
    if (!Array.isArray(coverages)) {
        invalid(
            "CLRS_TEST_COVERAGE_ACCUMULATION_INVALID",
            "coverage.coverages"
        );
    }

    const declaredTestCount = coverages.reduce(
        (total, coverage) => safeCoverageSum(
            total,
            coverage?.testCount ?? 1,
            "coverage.testCount"
        ),
        0
    );
    const normalizedTestCount =
        requireCoverageTestCount(
            testCount ?? declaredTestCount,
            "coverage.testCount"
        );

    if (declaredTestCount > normalizedTestCount) {
        invalid(
            "CLRS_TEST_COVERAGE_TEST_COUNT_INVALID",
            "coverage.testCount"
        );
    }

    const evidence = coverages
        .filter(coverage => coverage != null)
        .map(createCLRSTestCoverage);

    if (evidence.length === 0) {
        return null;
    }

    const points = new Map();
    let eventCount = 0;
    let evidenceTestCount = 0;

    for (const coverage of evidence) {
        eventCount = safeCoverageSum(
            eventCount,
            coverage.eventCount,
            "coverage.eventCount"
        );
        evidenceTestCount = safeCoverageSum(
            evidenceTestCount,
            coverage.evidenceTestCount,
            "coverage.evidenceTestCount"
        );

        for (const point of coverage.points) {
            const accumulated = points.get(
                point.pointId
            );

            if (accumulated == null) {
                points.set(
                    point.pointId,
                    mutableCoveragePoint(point)
                );
                continue;
            }

            if (!sameCoveragePoint(
                accumulated,
                point
            )) {
                invalid(
                    "CLRS_TEST_COVERAGE_POINT_CONFLICT",
                    "coverage.points"
                );
            }

            accumulated.hitCount = safeCoverageSum(
                accumulated.hitCount,
                point.hitCount,
                "coverage.point.hitCount"
            );

            if (point.outcomeCounts != null) {
                accumulated.trueCount =
                    safeCoverageSum(
                        accumulated.trueCount,
                        point.outcomeCounts.true,
                        "coverage.point.outcomeCounts.true"
                    );
                accumulated.falseCount =
                    safeCoverageSum(
                        accumulated.falseCount,
                        point.outcomeCounts.false,
                        "coverage.point.outcomeCounts.false"
                    );
            }
        }
    }

    return new CLRSTestCoverage({
        complete:
            evidenceTestCount === normalizedTestCount &&
            evidence.every(coverage =>
                coverage.complete
            ),
        truncated: evidence.some(coverage =>
            coverage.truncated
        ),
        eventCount,
        testCount: normalizedTestCount,
        evidenceTestCount,
        points: [...points.values()].map(point => ({
            pointId: point.pointId,
            kind: point.kind,
            name: point.name,
            location: point.location,
            hitCount: point.hitCount,
            outcomeCounts:
                CONDITION_KINDS.has(point.kind)
                    ? {
                        true: point.trueCount,
                        false: point.falseCount
                    }
                    : null
        }))
    });
}

function normalizeCatalogPoint(source) {
    const point = createExecutionCoveragePoint(
        source?.kind,
        source?.location,
        { name: source?.name }
    );

    return point != null &&
        source?.pointId === point.pointId
        ? point
        : null;
}

function mutablePoint(point, sourcePath) {
    return {
        pointId: point.pointId,
        kind: point.kind,
        name: point.name ?? null,
        location: {
            sourcePath,
            ...point.location
        },
        hitCount: 0,
        trueCount: 0,
        falseCount: 0
    };
}

function mutableCoveragePoint(point) {
    return {
        pointId: point.pointId,
        kind: point.kind,
        name: point.name,
        location: point.location,
        hitCount: point.hitCount,
        trueCount: point.outcomeCounts?.true ?? 0,
        falseCount: point.outcomeCounts?.false ?? 0
    };
}

function sameCoveragePoint(left, right) {
    return left.kind === right.kind &&
        left.name === right.name &&
        left.location.sourcePath ===
            right.location.sourcePath &&
        left.location.startLine ===
            right.location.startLine &&
        left.location.startColumn ===
            right.location.startColumn &&
        left.location.endLine ===
            right.location.endLine &&
        left.location.endColumn ===
            right.location.endColumn;
}

function safeCoverageSum(left, right, path) {
    const sum = left + right;

    if (!Number.isSafeInteger(sum)) {
        invalid(
            "CLRS_TEST_COVERAGE_COUNT_OVERFLOW",
            path
        );
    }

    return sum;
}

function requireCoverageTestCount(value, path) {
    const count = requireNonNegativeInteger(
        value,
        "CLRS_TEST_COVERAGE_TEST_COUNT_INVALID",
        path
    );

    if (count === 0) {
        invalid(
            "CLRS_TEST_COVERAGE_TEST_COUNT_INVALID",
            path
        );
    }

    return count;
}

function normalizeOutcomeCounts(
    source,
    kind,
    hitCount
) {
    if (!CONDITION_KINDS.has(kind)) {
        if (source != null) {
            invalid(
                "CLRS_TEST_COVERAGE_OUTCOMES_UNEXPECTED",
                "coverage.point.outcomeCounts"
            );
        }

        return null;
    }

    const input = requireRecord(
        source,
        "CLRS_TEST_COVERAGE_OUTCOMES_INVALID",
        "coverage.point.outcomeCounts"
    );
    const trueCount = requireNonNegativeInteger(
        input.true,
        "CLRS_TEST_COVERAGE_OUTCOMES_INVALID",
        "coverage.point.outcomeCounts.true"
    );
    const falseCount = requireNonNegativeInteger(
        input.false,
        "CLRS_TEST_COVERAGE_OUTCOMES_INVALID",
        "coverage.point.outcomeCounts.false"
    );

    if (trueCount + falseCount !== hitCount) {
        invalid(
            "CLRS_TEST_COVERAGE_OUTCOMES_MISMATCH",
            "coverage.point.outcomeCounts"
        );
    }

    return Object.freeze({
        true: trueCount,
        false: falseCount
    });
}

function summarizeCoverage(points) {
    const summary = {
        totalPoints: points.length,
        coveredPoints: 0,
        totalStatements: 0,
        coveredStatements: 0,
        totalFunctions: 0,
        coveredFunctions: 0,
        totalBranchOutcomes: 0,
        coveredBranchOutcomes: 0,
        totalLoopOutcomes: 0,
        coveredLoopOutcomes: 0
    };

    for (const point of points) {
        summary.coveredPoints +=
            point.hitCount > 0 ? 1 : 0;

        switch (point.kind) {
            case ExecutionCoverageKind.STATEMENT:
                summary.totalStatements += 1;
                summary.coveredStatements +=
                    point.hitCount > 0 ? 1 : 0;
                break;
            case ExecutionCoverageKind.FUNCTION:
                summary.totalFunctions += 1;
                summary.coveredFunctions +=
                    point.hitCount > 0 ? 1 : 0;
                break;
            case ExecutionCoverageKind.BRANCH:
                summary.totalBranchOutcomes += 2;
                summary.coveredBranchOutcomes +=
                    coveredOutcomes(point);
                break;
            case ExecutionCoverageKind.LOOP:
                summary.totalLoopOutcomes += 2;
                summary.coveredLoopOutcomes +=
                    coveredOutcomes(point);
                break;
        }
    }

    return Object.freeze(summary);
}

function coveredOutcomes(point) {
    return (
        point.outcomeCounts.true > 0 ? 1 : 0
    ) + (
        point.outcomeCounts.false > 0 ? 1 : 0
    );
}
