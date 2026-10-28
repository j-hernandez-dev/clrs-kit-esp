const formula = (text, latex = text) => ({
    text,
    latex
});

function scenario(
    name,
    notation,
    latex,
    status = "known"
) {
    const original = formula(
        "TORDENA(A) = 4c + nc log n",
        "TORDENA\\left(A\\right) = 4c + nc\\log\\left(n\\right)"
    );
    const simplified = formula(
        "TORDENA(A) = 4c + cn log n",
        "TORDENA\\left(A\\right) = 4c + cn\\log\\left(n\\right)"
    );

    return {
        name,
        status,
        confidence: "exact",
        conclusion: {
            kind: "tight",
            confidence: "exact",
            conditional: false,
            operator: "Θ",
            notation:
                notation.replace(
                    /^O(?=\()/,
                    "Θ"
                ),
            sourceNotation: notation,
            label: "Orden ajustado",
            summary:
                "El crecimiento está demostrado como cota superior e inferior dentro del modelo de costo.",
            proof: {
                status: "verified",
                confidence: "exact",
                boundKind: "tight",
                evidence: []
            },
            latex:
                latex.replace(
                    "\\mathcal{O}",
                    "\\Theta"
                )
        },
        original,
        simplified,
        asymptotic: {
            notation,
            latex,
            status,
            code: null,
            message: null,
            conditions: []
        },
        explanations: [{
            stage: "model",
            title: "Función de costo",
            formula: original,
            explanation:
                "Se suman los costos de las instrucciones y de cada nivel de iteración."
        }, {
            stage: "algebra",
            title: "Simplificación algebraica",
            formula: simplified,
            explanation:
                "Se agrupan coeficientes y términos equivalentes mediante identidades seguras."
        }, {
            stage: "asymptotic",
            title: "Clasificación asintótica",
            formula: formula(notation, latex),
            explanation:
                "Se conserva el término con mayor crecimiento asintótico."
        }],
        reasons: []
    };
}

export const reportPreviewFixture = {
    kind: "complexity-report",
    document: {
        uri: "file:///ordenamiento.clrs",
        fileName: "ordenamiento.clrs",
        version: 12
    },
    status: "known",
    functions: [{
        id: "TORDENA",
        name: "ORDENA",
        costName: "TORDENA",
        parameters: ["A"],
        signature: "ORDENA(A)",
        location: {
            startLine: 1,
            startColumn: 1,
            endLine: 12,
            endColumn: 1
        },
        status: "known",
        best: scenario(
            "best",
            "O(n log n)",
            "\\mathcal{O}\\left(n\\log(n)\\right)"
        ),
        worst: scenario(
            "worst",
            "O(n^2)",
            "\\mathcal{O}\\left(n^2\\right)"
        ),
        assumptions: [
            "La entrada contiene n elementos."
        ],
        evidence: [
            "El ciclo exterior progresa linealmente."
        ],
        callGraph: {
            nodes: [{
                id: "TPRINCIPAL",
                label: "PRINCIPAL",
                current: false,
                location: {
                    startLine: 14,
                    startColumn: 1
                }
            }, {
                id: "TORDENA",
                label: "ORDENA",
                current: true,
                location: {
                    startLine: 1,
                    startColumn: 1
                }
            }],
            edges: [{
                id: "call:0",
                from: "TPRINCIPAL",
                to: "TORDENA"
            }]
        }
    }, {
        id: "TPRINCIPAL",
        name: "PRINCIPAL",
        costName: "TPRINCIPAL",
        parameters: [],
        signature: "PRINCIPAL()",
        location: {
            startLine: 14,
            startColumn: 1
        },
        status: "known",
        best: scenario(
            "best",
            "O(n log n)",
            "\\mathcal{O}\\left(n\\log(n)\\right)"
        ),
        worst: scenario(
            "worst",
            "O(n^2)",
            "\\mathcal{O}\\left(n^2\\right)"
        ),
        assumptions: [],
        evidence: [],
        callGraph: null
    }]
};
