export function createRecurrenceSystem({
    componentId,
    names,
    equations,
    reductionKind,
    hasBaseCase,
    boundKind = "tight"
}) {
    return Object.freeze({
        kind: "recurrence-system",
        componentId,
        names:
            Object.freeze([...names]),
        equations:
            Object.freeze(
                equations.map(
                    freezeEquation
                )
            ),
        reductionKind,
        hasBaseCase,
        boundKind,
        tight:
            boundKind === "tight"
    });
}

function freezeEquation(equation) {
    return Object.freeze({
        name: equation.name,
        measure: equation.measure,
        forms:
            Object.freeze(
                equation.forms.map(form =>
                    Object.freeze({
                        recursive:
                            form.recursive,
                        toll:
                            form.toll,
                        tollOrder:
                            form.tollOrder,
                        terms:
                            Object.freeze(
                                form.terms.map(
                                    term =>
                                        Object.freeze({
                                            ...term
                                        })
                                )
                            )
                    })
                )
            ),
        transitionTerms:
            Object.freeze(
                equation.transitionTerms
                    .map(term =>
                        Object.freeze({
                            ...term
                        })
                    )
            ),
        enveloped:
            equation.enveloped
    });
}
