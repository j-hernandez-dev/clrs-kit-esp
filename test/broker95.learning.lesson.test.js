import assert from "node:assert/strict";
import {
    readFile
} from "node:fs/promises";
import test from "node:test";

import {
    createBrokerGameState,
    createBrokerPublicGameState,
    createBrokerPublicLearningCatalog
} from "../src/broker95/index.js";
import {
    Broker95LearningLessonAction,
    createBroker95LearningLessonModel
} from "../frontend/src/broker95/panels/Broker95LearningLesson.js";

function fixture() {
    const catalog =
        createBrokerPublicLearningCatalog();
    const route = createBrokerPublicGameState(
        createBrokerGameState()
    ).learning.progress.programming;
    const lesson = catalog.lessons[0];
    const section = catalog.sections[0];
    const routeLesson = route.lessons[0];

    return {
        lesson,
        section,
        routeLesson
    };
}

test("proyecta todo el contenido curricular y la primera práctica", () => {
    const source = fixture();
    const model =
        createBroker95LearningLessonModel(
            source
        );

    assert.equal(
        model.action,
        Broker95LearningLessonAction.OBTAIN
    );
    assert.equal(
        model.actionLabel,
        "OBTENER CONTRATO"
    );
    assert.equal(model.actionDisabled, false);
    assert.equal(model.completed, false);
    assert.equal(model.earnedReward, null);
    assert.ok(model.lesson.explanation.length > 0);
    assert.ok(model.lesson.examples.length > 0);
    assert.ok(
        model.lesson.introducedKnowledge.length >
            0
    );
    assert.ok(
        model.lesson.accumulatedKnowledge.length >=
            model.lesson.introducedKnowledge.length
    );
});

test("una lección completada muestra repetición, mejor nota y paga acumulada", () => {
    const source = fixture();
    const model =
        createBroker95LearningLessonModel({
            ...source,
            routeLesson: {
                ...source.routeLesson,
                status: "completed",
                completed: true,
                canObtainContract: true,
                bestScore: 80
            }
        });

    assert.equal(
        model.action,
        Broker95LearningLessonAction.REPEAT
    );
    assert.equal(
        model.actionLabel,
        "REPETIR CONTRATO"
    );
    assert.equal(model.bestScore, 80);
    assert.equal(model.earnedReward, 9);
});

test("un contrato enlazado bloquea otro pedido y sólo conserva su aviso vigente", () => {
    const source = fixture();
    const linked = {
        ...source.routeLesson,
        canObtainContract: false,
        activeContractId: 17,
        learningAttempt: 1
    };
    const notice = {
        lessonId: source.lesson.id,
        sectionId: source.section.id,
        contractId: 17,
        title: "Primera salida",
        learningAttempt: 1,
        repetition: false
    };
    const model =
        createBroker95LearningLessonModel({
            ...source,
            routeLesson: linked,
            notice
        });

    assert.equal(
        model.action,
        Broker95LearningLessonAction
            .CONTRACT_LINKED
    );
    assert.equal(model.actionDisabled, true);
    assert.equal(model.notice, notice);

    const stale =
        createBroker95LearningLessonModel({
            ...source,
            routeLesson: linked,
            notice: {
                ...notice,
                contractId: 16
            }
        });

    assert.equal(stale.notice, null);
});

test("el estado ocupado y una proyección cruzada se manejan de forma segura", () => {
    const source = fixture();
    const busy =
        createBroker95LearningLessonModel({
            ...source,
            busy: true
        });

    assert.equal(busy.actionDisabled, true);
    assert.equal(
        busy.actionLabel,
        "CIPHER ESTÁ GENERANDO…"
    );
    assert.throws(
        () => createBroker95LearningLessonModel({
            ...source,
            section: {
                ...source.section,
                id: "section-02"
            }
        }),
        /Invalid BROKER\.95 learning lesson projection/u
    );
});

test("la vista representa contenido pedagógico y solicita únicamente el lessonId", async () => {
    const [application, formula, katexLoader, styles] =
        await Promise.all([
            readFile(
                new URL(
                    "../frontend/src/broker95/Broker95App.jsx",
                    import.meta.url
                ),
                "utf8"
            ),
            readFile(
                new URL(
                    "../frontend/src/broker95/panels/Broker95LearningFormula.jsx",
                    import.meta.url
                ),
                "utf8"
            ),
            readFile(
                new URL(
                    "../frontend/src/math/useKaTeXHtml.js",
                    import.meta.url
                ),
                "utf8"
            ),
            readFile(
                new URL(
                    "../frontend/src/broker95/broker95.css",
                    import.meta.url
                ),
                "utf8"
            )
        ]);

    assert.match(
        application,
        /PROBLEMA ANTES DEL ALGORITMO[\s\S]*CONCEPTOS CLAVE[\s\S]*CONCEPTO[\s\S]*MODELO MATEMÁTICO[\s\S]*REPRESENTACIÓN[\s\S]*TRANSFERENCIA/u
    );
    assert.match(
        application,
        /NUEVO EN ESTA LECCIÓN/u
    );
    assert.match(
        application,
        /CONOCIMIENTOS ACUMULADOS/u
    );
    assert.match(
        application,
        /CONTRATO ESPERADO/u
    );
    assert.match(
        application,
        /SUGERENCIA DE EXPLORACIÓN[\s\S]*OPCIONAL/u
    );
    assert.match(formula, /useKaTeXHtml/u);
    assert.match(katexLoader, /katex\.renderToString/u);
    assert.match(katexLoader, /import\("katex"\)/u);
    assert.match(formula, /trust:\s*false/u);
    assert.match(formula, /role="img"/u);
    assert.match(
        styles,
        /\.broker95-learning-formula-render[\s\S]*overflow-x:\s*auto/u
    );
    assert.match(
        application,
        /bridge\.obtainLearningContract\(\s*lesson\.id,\s*learningRouteId\s*\)/u
    );
    assert.match(
        application,
        /ai -set \{model\.notice\.contractId\}/u
    );
    assert.match(
        application,
        /Ruta[\s\S]*model\.notice\.routeTitle[\s\S]*Lección[\s\S]*model\.notice\.lessonOrder[\s\S]*model\.notice\.lessonTitle/u
    );
    assert.match(
        styles,
        /\.broker95-learning-notice-context[\s\S]*grid-template-columns/u
    );
    assert.match(
        application,
        /dismissLearningContractNotice/u
    );
    assert.match(
        application,
        /Cerrar notificación de contrato/u
    );
    assert.doesNotMatch(
        application,
        /<textarea/u
    );
});
