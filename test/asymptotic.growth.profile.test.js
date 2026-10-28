import test from "node:test";
import assert from "node:assert/strict";

import {
    createAsymptoticGrowthProfile
} from "../frontend/src/report/AsymptoticGrowthProfile.js";

test("ordena las familias visuales de verde a naranja", () => {
    const notations = [
        "Θ(1)",
        "O(log log n)",
        "O(log n)",
        "O(n)",
        "O(n log n)",
        "O(n^2)",
        "O(2^n)",
        "O(n!)"
    ];
    const profiles = notations.map(
        createAsymptoticGrowthProfile
    );

    assert.equal(
        profiles.every(profile =>
            profile.available
        ),
        true
    );
    assert.deepEqual(
        profiles.map(profile => profile.rank),
        [0, 1, 2, 4, 5, 6, 9, 10]
    );
    assert.equal(
        new Set(
            profiles.map(profile =>
                profile.color
            )
        ).size,
        profiles.length
    );
});

test("genera muestras estables y conserva desconocido sin inventar curva", () => {
    const linear =
        createAsymptoticGrowthProfile(
            "Θ(n)"
        );
    const unknown =
        createAsymptoticGrowthProfile(
            "O(?)"
        );

    assert.deepEqual(
        linear.samples.map(sample =>
            sample.time
        ),
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    );
    assert.deepEqual(
        createAsymptoticGrowthProfile(
            "O(n log n)"
        ).samples.slice(0, 2).map(
            sample => sample.time
        ),
        [0, 0]
    );
    assert.equal(unknown.available, false);
    assert.deepEqual(unknown.samples, []);
});
