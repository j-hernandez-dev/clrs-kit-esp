import {
    useEffect,
    useState
} from "react";

let katexLoader = null;

export function loadKaTeX() {
    katexLoader ??= Promise.all([
        import("katex"),
        import("katex/dist/katex.min.css")
    ]).then(([module]) =>
        module.default ?? module
    );

    return katexLoader;
}

export function useKaTeXHtml(
    latex,
    options = {}
) {
    const source =
        latex ?? "\\text{?}";
    const displayMode =
        options.displayMode !== false;
    const strict =
        options.strict ?? "ignore";
    const trust =
        options.trust === true;
    const [html, setHtml] = useState(null);

    useEffect(() => {
        let active = true;

        setHtml(null);

        void loadKaTeX()
            .then(katex => {
                if (!active) {
                    return;
                }

                setHtml(
                    katex.renderToString(
                        source,
                        {
                            displayMode,
                            throwOnError: false,
                            strict,
                            trust,
                            output: "html"
                        }
                    )
                );
            })
            .catch(() => {
                if (active) {
                    setHtml(null);
                }
            });

        return () => {
            active = false;
        };
    }, [
        source,
        displayMode,
        strict,
        trust
    ]);

    return html;
}
