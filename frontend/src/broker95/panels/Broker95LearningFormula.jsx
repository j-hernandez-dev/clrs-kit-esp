import {
    useKaTeXHtml
} from "../../math/useKaTeXHtml.js";

export default function Broker95LearningFormula({
    formula
}) {
    const html = useKaTeXHtml(
        formula.latex,
        {
            displayMode: true,
            strict: "ignore",
            trust: false
        }
    );
    const accessibleLabel = [
        formula.title,
        formula.description,
        `Fórmula: ${formula.latex}`
    ].filter(Boolean).join(". ");

    return (
        <article className="broker95-learning-formula">
            <header>
                <span aria-hidden="true">ƒ</span>
                <h4>{formula.title}</h4>
            </header>
            <div
                className="broker95-learning-formula-render"
                role="img"
                aria-label={accessibleLabel}
            >
                <div
                    aria-hidden="true"
                    {...(
                        html == null
                            ? {
                                children:
                                    formula.latex
                            }
                            : {
                                dangerouslySetInnerHTML: {
                                    __html: html
                                }
                            }
                    )}
                />
            </div>
            {formula.description && (
                <p>{formula.description}</p>
            )}
        </article>
    );
}
