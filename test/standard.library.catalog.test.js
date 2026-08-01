import test from "node:test";
import assert from "node:assert/strict";

import {
    standartLibrary
} from "../src/compiler/StandartLibrary.js";
import {
    costSubstitution
} from "../src/complex/LibrarySubstitution.js";
import {
    AsymptoticClassifier
} from "../src/complex/asymptotic/AsymptoticClassifier.js";
import {
    formatOrder
} from "../src/complex/asymptotic/AsymptoticOrder.js";
import {
    CostExpressionFactory as Cost
} from "../src/complex/algebra/CostExpressionFactory.js";
import {
    CLRS_STANDARD_LIBRARY,
    CLRS_STANDARD_LIBRARY_NAMES,
    StandardLibraryReturnType,
    StandardLibrarySymbolicEffect,
    getStandardLibraryDefinition
} from "../src/standard-library/StandardLibraryCatalog.js";
import {
    CLRS_STANDARD_SYMBOLS
} from "../src/semantic/StandardSymbols.js";

const N = Cost.symbol("n");

test("el catálogo comparte nombres, costos y funciones del runtime", () => {
    assert.deepEqual(
        CLRS_STANDARD_SYMBOLS,
        CLRS_STANDARD_LIBRARY_NAMES
    );
    assert.equal(
        Object.isFrozen(
            CLRS_STANDARD_LIBRARY
        ),
        true
    );

    for (
        const name
        of CLRS_STANDARD_LIBRARY_NAMES
    ) {
        const definition =
            getStandardLibraryDefinition(
                name
            );

        assert.equal(
            Object.isFrozen(
                definition
            ),
            true
        );
        assert.ok(
            costSubstitution(name),
            `Falta el costo de ${name}.`
        );
        assert.match(
            standartLibrary,
            new RegExp(
                `function\\s+${name}\\s*\\(`
            ),
            `Falta ${name} en el runtime.`
        );
    }
});

test("el catálogo declara efectos y tipos sin inferir funciones desconocidas", () => {
    assert.deepEqual(
        getStandardLibraryDefinition(
            "PISO"
        ).symbolicEffect,
        {
            kind:
                StandardLibrarySymbolicEffect
                    .ROUNDING,
            argument: 0,
            direction: "floor"
        }
    );
    assert.equal(
        getStandardLibraryDefinition(
            "LONG"
        ).symbolicEffect.kind,
        StandardLibrarySymbolicEffect
            .SIZE
    );
    assert.equal(
        getStandardLibraryDefinition(
            "A_NUM"
        ).returnType,
        StandardLibraryReturnType
            .NUMBER
    );
    assert.equal(
        getStandardLibraryDefinition(
            "DESCONOCIDA"
        ),
        null
    );
});

test("el clasificador consume transformaciones simbólicas declaradas", () => {
    const classifier =
        new AsymptoticClassifier();
    const cases = [
        [
            Cost.call(
                "PISO",
                [N]
            ),
            "O(n)"
        ],
        [
            Cost.call(
                "ABS",
                [N]
            ),
            "O(n)"
        ],
        [
            Cost.call(
                "LOG2",
                [N]
            ),
            "O(log n)"
        ],
        [
            Cost.call(
                "RAIZ",
                [N]
            ),
            "O(n^0.5)"
        ],
        [
            Cost.call(
                "SEN",
                [N]
            ),
            "O(1)"
        ]
    ];

    for (
        const [expression, notation]
        of cases
    ) {
        assert.equal(
            formatOrder(
                classifier.classify(
                    expression
                )
            ),
            notation
        );
    }
});
