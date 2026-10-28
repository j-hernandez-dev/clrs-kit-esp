import React, {
    lazy,
    Suspense
} from "react";
import ReactDOM from "react-dom/client";

import "./style.css";

const webviewMode =
    document.querySelector(
        'meta[name="clrs-webview-mode"]'
    )?.content ??
    globalThis.__CLRS_WEBVIEW_MODE__ ??
    new URLSearchParams(
        globalThis.location?.search ?? ""
    ).get("view") ??
    "diagram";

document.documentElement.dataset
    .webviewMode = webviewMode;

const DiagramApp = lazy(
    () => import("./DiagramRoot.jsx")
);
const ComplexityReportApp = lazy(
    () => import(
        "./report/ComplexityReportApp.jsx"
    )
);
const Broker95App = lazy(
    () => import(
        "./broker95/Broker95App.jsx"
    )
);

const content = {
    "complexity-report": (
        <ComplexityReportApp />
    ),
    broker95: <Broker95App />
}[webviewMode] ?? (
    <DiagramApp />
);
const loadingLabel = webviewMode === "broker95"
    ? "Cargando BROKER.95…"
    : webviewMode === "complexity-report"
        ? "Cargando informe de complejidad…"
        : "Cargando diagrama…";

ReactDOM.createRoot(
    document.getElementById("app")
).render(
    <React.StrictMode>
        <Suspense fallback={(
            <div
                className="clrs-webview-loading"
                role="status"
                aria-live="polite"
            >
                {loadingLabel}
            </div>
        )}>
            {content}
        </Suspense>
    </React.StrictMode>
);
