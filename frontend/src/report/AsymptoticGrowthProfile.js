const SAMPLE_SIZES = Object.freeze([
    0,
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    10
]);

const COLOR_START = Object.freeze([
    73,
    190,
    111
]);
const COLOR_END = Object.freeze([
    238,
    126,
    55
]);

export function createAsymptoticGrowthProfile(
    notation
) {
    const expression = normalizeExpression(
        notation
    );
    const family = classifyFamily(expression);

    if (family == null) {
        return Object.freeze({
            available: false,
            notation: String(notation ?? "O(?)"),
            family: "unknown",
            color: growthColor(0),
            fillColor: growthColor(0, 0.12),
            samples: Object.freeze([])
        });
    }

    const color = growthColor(family.rank);
    const samples = SAMPLE_SIZES.map(size =>
        Object.freeze({
            size,
            time: safeGrowthValue(
                family.evaluate(size)
            )
        })
    );

    return Object.freeze({
        available: true,
        notation: String(notation),
        family: family.id,
        rank: family.rank,
        color,
        fillColor:
            growthColor(
                family.rank,
                0.12
            ),
        samples: Object.freeze(samples)
    });
}

function normalizeExpression(notation) {
    const value = String(notation ?? "")
        .trim()
        .replace(/²/gu, "^2")
        .replace(/³/gu, "^3")
        .replace(/√/gu, "sqrt ")
        .replace(/\s+/gu, " ");
    const match = value.match(
        /^(?:O|Θ|Ω)\((.*)\)$/u
    );

    return (match?.[1] ?? value)
        .trim()
        .toLocaleLowerCase("en");
}

function classifyFamily(expression) {
    if (
        expression.length === 0 ||
        expression.includes("?")
    ) {
        return null;
    }

    if (expression.includes("!")) {
        return family(
            "factorial",
            10,
            factorial
        );
    }

    if (isQuasiPolynomial(expression)) {
        return family(
            "quasi-polynomial",
            8,
            size => Math.pow(
                size,
                Math.log2(
                    Math.max(size, 2)
                )
            )
        );
    }

    const exponentialBase =
        numericExponentialBase(expression);

    if (exponentialBase != null) {
        return family(
            "exponential",
            9,
            size => Math.pow(
                exponentialBase,
                size
            )
        );
    }

    const polynomialDegree =
        dominantPolynomialDegree(expression);

    if (polynomialDegree != null) {
        if (polynomialDegree < 1) {
            return family(
                "sublinear",
                3,
                size => Math.pow(
                    size,
                    polynomialDegree
                )
            );
        }

        if (polynomialDegree > 1) {
            return family(
                "polynomial",
                Math.min(
                    7,
                    4 + polynomialDegree
                ),
                size => Math.pow(
                    size,
                    polynomialDegree
                )
            );
        }
    }

    if (/\bsqrt\b/u.test(expression)) {
        return family(
            "sublinear",
            3,
            Math.sqrt
        );
    }

    if (
        /(?:^|\s)(?!log\b)[a-z]\w*(?:\s*\^[^\s]+)?\s+log(?:_|\b)/iu
            .test(expression)
    ) {
        return family(
            "linearithmic",
            5,
            size =>
                size * Math.log2(
                    Math.max(size, 1)
                )
        );
    }

    const logarithmDepth =
        countLogarithms(expression);

    if (logarithmDepth > 0) {
        return family(
            logarithmDepth > 1
                ? "iterated-logarithmic"
                : "logarithmic",
            logarithmDepth > 1 ? 1 : 2,
            size => iteratedLog(
                size,
                logarithmDepth
            )
        );
    }

    if (hasVariable(expression)) {
        return family(
            "linear",
            4,
            size => size
        );
    }

    return family(
        "constant",
        0,
        () => 1
    );
}

function family(id, rank, evaluate) {
    return { id, rank, evaluate };
}

function isQuasiPolynomial(expression) {
    return (
        /[a-z]\s*\^\s*\([^)]*log/iu
            .test(expression) ||
        /[a-z]\s*\^\s*[a-z]/iu
            .test(expression)
    );
}

function numericExponentialBase(expression) {
    const match = expression.match(
        /(?:^|\s|\()([0-9]+(?:\.[0-9]+)?)\s*\^\s*(?:[a-z]|\()/iu
    );
    const value = Number(match?.[1]);

    return Number.isFinite(value) && value > 1
        ? value
        : null;
}

function dominantPolynomialDegree(expression) {
    const degrees = [...expression.matchAll(
        /[a-z]\s*\^\s*(-?[0-9]+(?:\.[0-9]+)?|k)\b/giu
    )].map(match =>
        match[1] === "k"
            ? 4
            : Number(match[1])
    ).filter(Number.isFinite);

    return degrees.length === 0
        ? null
        : Math.max(...degrees);
}

function hasVariable(expression) {
    const withoutLogarithms = expression
        .replace(/\blog(?:_[0-9]+)?\b/giu, "");

    return /\b[a-z]\w*\b/iu
        .test(withoutLogarithms);
}

function countLogarithms(expression) {
    return (
        expression.match(/\blog(?:_[0-9]+)?\b/giu) ??
        []
    ).length;
}

function iteratedLog(size, depth) {
    let value = Math.max(size, 1);

    for (let index = 0; index < depth; index += 1) {
        value = Math.log2(
            Math.max(value, 1)
        );
    }

    return value;
}

function factorial(size) {
    let value = 1;

    for (let factor = 2; factor <= size; factor += 1) {
        value *= factor;
    }

    return value;
}

function safeGrowthValue(value) {
    if (!Number.isFinite(value)) {
        return 1_000_000_000_000;
    }

    return Math.min(
        1_000_000_000_000,
        Math.max(0, value)
    );
}

function growthColor(rank, alpha = 1) {
    const ratio = Math.min(
        1,
        Math.max(0, rank / 10)
    );
    const channels = COLOR_START.map(
        (start, index) => Math.round(
            start +
            (COLOR_END[index] - start) *
                ratio
        )
    );

    return `rgba(${channels.join(", ")}, ${alpha})`;
}
