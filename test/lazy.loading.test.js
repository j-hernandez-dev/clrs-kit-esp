import assert from "node:assert/strict";
import {
    readFile
} from "node:fs/promises";
import test from "node:test";

test("las bibliotecas visuales permanecen fuera de la entrada común", async () => {
    const [
        main,
        formula,
        brokerFormula,
        katexLoader,
        reportStyles,
        brokerScene
    ] = await Promise.all([
        source("frontend/src/main.jsx"),
        source("frontend/src/report/Formula.jsx"),
        source(
            "frontend/src/broker95/panels/Broker95LearningFormula.jsx"
        ),
        source(
            "frontend/src/math/useKaTeXHtml.js"
        ),
        source(
            "frontend/src/report/report.css"
        ),
        source(
            "frontend/src/broker95/scene/Broker95KaplayScene.js"
        )
    ]);

    assert.match(main, /const DiagramApp = lazy/u);
    assert.match(
        main,
        /const ComplexityReportApp = lazy/u
    );
    assert.match(main, /const Broker95App = lazy/u);
    assert.doesNotMatch(
        formula,
        /import\s+katex\s+from/u
    );
    assert.doesNotMatch(
        brokerFormula,
        /import\s+katex\s+from/u
    );
    assert.match(katexLoader, /import\("katex"\)/u);
    assert.match(
        katexLoader,
        /import\("katex\/dist\/katex\.min\.css"\)/u
    );
    assert.doesNotMatch(
        reportStyles,
        /@import\s+["']katex/u
    );
    assert.match(
        brokerScene,
        /\(\) => import\("kaplay"\)/u
    );
});

function source(relativePath) {
    return readFile(
        new URL(
            `../${relativePath}`,
            import.meta.url
        ),
        "utf8"
    );
}
