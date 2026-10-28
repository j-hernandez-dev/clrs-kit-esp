import {
    useKaTeXHtml
} from "../math/useKaTeXHtml.js";

export default function Formula({
    latex,
    display = true
}) {
    const source = latex ?? "\\text{?}";
    const html = useKaTeXHtml(source, {
        displayMode: display,
        strict: "ignore",
        trust: false
    });

    return (
        <div
            className={
                display
                    ? "report-formula"
                    : "report-formula-inline"
            }
            {...(
                html == null
                    ? { children: source }
                    : {
                        dangerouslySetInnerHTML: {
                            __html: html
                        }
                    }
            )}
        />
    );
}
