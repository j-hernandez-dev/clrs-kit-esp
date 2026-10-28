import {
    BrokerRisk,
    getBrokerRiskRule
} from "../core/BrokerRiskRules.js";

const PROFILES = Object.freeze({
    [BrokerRisk.LOW]: profile({
        difficultyId: "easy",
        label: "Fácil",
        expectedScope:
            "Una idea directa y breve. Debe resolverse con variables, operadores, decisiones o ciclos simples, sin exigir almacenar ni recorrer colecciones.",
        typicalTechniques: [
            "fórmulas, conversiones y operaciones aritméticas",
            "clasificaciones con si, sino si y sino",
            "acumuladores, contadores y ciclos simples",
            "validación de entrada y ciclos con centinela",
            "máximo o mínimo de pocos valores leídos secuencialmente"
        ],
        forbiddenTechniques: [
            "arreglos, matrices o recorridos de colecciones",
            "búsqueda u ordenamiento de colecciones",
            "pilas, colas, tablas hash o estructuras enlazadas",
            "recursión, divide y vencerás o programación dinámica",
            "árboles, grafos, métodos numéricos u optimización"
        ],
        programShape: {
            collections: "forbidden",
            recursion: "forbidden",
            dynamicStructures: "forbidden",
            expectedControlDepth: 2,
            expectedCoreSteps: Object.freeze([1, 4])
        }
    }),
    [BrokerRisk.MEDIUM]: profile({
        difficultyId: "intermediate",
        label: "Intermedio",
        expectedScope:
            "Manipulación sistemática de datos o un algoritmo elemental reconocible. Puede requerir arreglos, cadenas o matrices, pero no una estrategia algorítmica avanzada.",
        typicalTechniques: [
            "recorridos, transformaciones y conteos sobre arreglos o cadenas",
            "matrices y simulaciones paso a paso",
            "búsqueda lineal o binaria",
            "burbuja, selección o inserción",
            "pilas o colas básicas, hashing sencillo, RLE y cifrados clásicos",
            "MCD, divisibilidad y teoría de números elemental"
        ],
        forbiddenTechniques: [
            "listas enlazadas u otras estructuras dinámicas",
            "recursión significativa o divide y vencerás",
            "heaps, árboles y recorridos de grafos",
            "programación dinámica compleja",
            "métodos numéricos u optimización avanzada"
        ],
        programShape: {
            collections: "allowed",
            recursion: "discouraged",
            dynamicStructures: "forbidden",
            expectedControlDepth: 3,
            expectedCoreSteps: Object.freeze([2, 7])
        }
    }),
    [BrokerRisk.HIGH]: profile({
        difficultyId: "hard",
        label: "Difícil",
        expectedScope:
            "La solución exige una estrategia no obvia, recursión relevante, divide y vencerás, una estructura dinámica o un método matemático estructurado.",
        typicalTechniques: [
            "merge sort, heap sort o quicksort",
            "recursión y divide y vencerás",
            "listas enlazadas, heaps, árboles de búsqueda y árboles",
            "métodos numéricos como bisección o Newton",
            "geometría, procesamiento o modelos matemáticos estructurados"
        ],
        forbiddenTechniques: [
            "problemas cuyo núcleo sea sólo una fórmula, una decisión o un recorrido directo",
            "grafos generales y algoritmos avanzados de grafos",
            "programación dinámica compleja y optimización combinatoria",
            "estructuras especializadas o algoritmos distribuidos"
        ],
        programShape: {
            collections: "expected",
            recursion: "allowed",
            dynamicStructures: "allowed",
            expectedControlDepth: 4,
            expectedCoreSteps: Object.freeze([3, 10])
        }
    }),
    [BrokerRisk.EXTREME]: profile({
        difficultyId: "extreme",
        label: "Extremo",
        expectedScope:
            "Problema algorítmico avanzado que combina modelado, elección de estrategia y varias invariantes o estructuras especializadas.",
        typicalTechniques: [
            "grafos, caminos, flujo, conectividad y estructuras de rango",
            "programación dinámica compleja y optimización combinatoria",
            "algoritmos aproximados, probabilísticos, online o de streaming",
            "estructuras persistentes o especializadas",
            "problemas avanzados de texto, geometría o dominios especializados"
        ],
        forbiddenTechniques: [
            "enunciados que se resuelvan únicamente con una fórmula o un ciclo directo",
            "variantes elementales que no requieran justificar una estrategia"
        ],
        programShape: {
            collections: "expected",
            recursion: "allowed",
            dynamicStructures: "allowed",
            expectedControlDepth: 5,
            expectedCoreSteps: Object.freeze([4, 14])
        }
    })
});

export function getBrokerExerciseDifficultyProfile(risk) {
    getBrokerRiskRule(risk);
    return PROFILES[risk];
}

export const BROKER_EXERCISE_DIFFICULTY_PROFILES = PROFILES;

function profile(value) {
    return Object.freeze({
        difficultyId: value.difficultyId,
        label: value.label,
        expectedScope: value.expectedScope,
        typicalTechniques: Object.freeze([
            ...value.typicalTechniques
        ]),
        forbiddenTechniques: Object.freeze([
            ...value.forbiddenTechniques
        ]),
        programShape: Object.freeze({
            ...value.programShape
        })
    });
}
