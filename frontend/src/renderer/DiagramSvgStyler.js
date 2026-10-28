/**
 * Completa los estilos del SVG que Mermaid no conserva de forma uniforme
 * entre versiones. Los colores proceden siempre del tema ya resuelto, por
 * lo que no se introducen valores especÃ­ficos de un tema de VS Code.
 */
export function styleDiagramSvg(
    svgElement,
    themeConfig
) {
    if (!svgElement) {
        return;
    }

    svgElement.style.width = "100%";
    svgElement.style.height = "100%";

    centerTerminalLabels(svgElement);

    // El hover usa el color propio de cada contorno, también en temas
    // personalizados. Se captura antes de aplicar trazas o selecciones.
    const view = svgElement.ownerDocument?.defaultView;
    if (view?.getComputedStyle) {
        svgElement.querySelectorAll([
            ".node > :is(rect, polygon, path, circle, ellipse)",
            ".node > g:not(.label) > :is(rect, polygon, path, circle, ellipse)"
        ].join(", ")).forEach(shape => {
            shape.style.setProperty(
                "--clrs-node-outline-color",
                view.getComputedStyle(shape).stroke
            );
        });
    }

    const theme =
        themeConfig?.theme ??
        themeConfig;
    const arrowColor =
        theme?.arrow?.color;
    const subgraph =
        theme?.subgraph;
    const edgeLabelBackground =
        subgraph?.fill ??
        theme?.arrow?.colorLabel ??
        theme?.canvas?.background;

    svgElement
        .querySelectorAll(
            ".edgePath path, .flowchart-link"
        )
        .forEach(path => {
            path.style.strokeWidth = "2px";
            // Un path SVG se rellena de negro por omisiÃ³n. Mermaid suele
            // declarar `fill: none` desde su hoja interna, pero esa regla
            // puede quedar desfasada junto con el tema y convertir las
            // curvas en grandes polÃ­gonos negros.
            path.style.fill = "none";

            if (arrowColor) {
                path.style.stroke =
                    arrowColor;
            }
            path.style.setProperty?.("--clrs-edge-theme-stroke", arrowColor || view?.getComputedStyle?.(path).stroke || "currentColor");
        });

    // Mermaid puede representar una etiqueta de conexión como un rect SVG
    // o como HTML dentro de un foreignObject. El fondo se aplica sólo a esos
    // elementos; nunca al path de la flecha, que debe permanecer sin relleno
    // para no volver a formar polígonos negros en las curvas.
    if (edgeLabelBackground) {
        svgElement
            .querySelectorAll(
                ".edgeLabel rect"
            )
            .forEach(rectangle => {
                rectangle.style.fill =
                    edgeLabelBackground;
                rectangle.style.fillOpacity = "1";
                rectangle.style.stroke = "none";
                rectangle.style.rx = "999px";
                rectangle.style.ry = "999px";
                rectangle.setAttribute?.(
                    "rx",
                    "999"
                );
                rectangle.setAttribute?.(
                    "ry",
                    "999"
                );
            });

        svgElement
            .querySelectorAll([
                ".edgeLabel .labelBkg",
                ".edgeLabel foreignObject > div"
            ].join(", "))
            .forEach(labelBackground => {
                labelBackground.style.backgroundColor =
                    edgeLabelBackground;
                labelBackground.style.backgroundImage =
                    "none";
                labelBackground.style.borderRadius =
                    "999px";
                labelBackground.style.opacity = "1";
            });
    }

    if (arrowColor) {
        svgElement
            .querySelectorAll([
                'marker[id$="pointEnd"] path',
                'marker[id$="pointStart"] path'
            ].join(", "))
            .forEach(markerPath => {
                markerPath.style.fill =
                    arrowColor;
                markerPath.style.stroke =
                    arrowColor;
            });
    }

    if (!subgraph) {
        return;
    }

    svgElement
        .querySelectorAll(".cluster rect")
        .forEach(rectangle => {
            if (subgraph.fill) {
                rectangle.style.fill =
                    subgraph.fill;
            }

            if (subgraph.stroke) {
                rectangle.style.stroke =
                    subgraph.stroke;
            }
        });

    svgElement
        .querySelectorAll([
            ".cluster-label text",
            ".cluster-label span",
            ".cluster-label p"
        ].join(", "))
        .forEach(label => {
            if (subgraph.text) {
                label.style.fill =
                    subgraph.text;
                label.style.color =
                    subgraph.text;
            }
        });
}

function centerTerminalLabels(svgElement) {
    svgElement
        .querySelectorAll([
            ".node-start .nodeLabel",
            ".node-start .nodeLabel p",
            ".node-start foreignObject > div",
            ".node-return .nodeLabel",
            ".node-return .nodeLabel p",
            ".node-return foreignObject > div"
        ].join(", "))
        .forEach(label => {
            // Un nodo DOM real expone CSSStyleDeclaration. Los consumidores
            // sin navegador pueden proporcionar dobles parciales que no
            // representan una etiqueta y deben permanecer intactos.
            if (
                typeof label.style.setProperty !==
                "function"
            ) {
                return;
            }

            label.style.setProperty(
                "text-align",
                "center",
                "important"
            );
            label.style.setProperty(
                "text-align-last",
                "center",
                "important"
            );
            label.style.width = "100%";
            label.style.boxSizing = "border-box";
        });

    // Mermaid puede envolver cada línea en elementos intermedios. Aplicar
    // el mismo centrado a sus descendientes evita que una segunda línea
    // (por ejemplo, la expresión de `Retornar`) herede otra alineación.
    svgElement
        .querySelectorAll([
            ".node-start .nodeLabel *",
            ".node-return .nodeLabel *"
        ].join(", "))
        .forEach(label => {
            if (typeof label.style?.setProperty !== "function") {
                return;
            }

            label.style.setProperty(
                "text-align",
                "center",
                "important"
            );
            label.style.setProperty(
                "text-align-last",
                "center",
                "important"
            );
        });
}
