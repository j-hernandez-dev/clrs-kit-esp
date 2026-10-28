import {
    useEffect,
    useRef,
    useState
} from "react";

const EXIT_DURATION_MS = 130;

/**
 * Conserva brevemente el último editor al cerrarse para que la salida
 * visual pueda terminar antes de desmontar el formulario. La lógica y la
 * autoridad de la edición continúan viviendo fuera de esta capa.
 */
export default function DiagramEditorPresence({
    children
}) {
    const present = children != null;
    const lastChildRef = useRef(children);
    const [mounted, setMounted] = useState(
        present
    );
    const [closing, setClosing] = useState(false);

    if (present) {
        lastChildRef.current = children;
    }

    useEffect(() => {
        if (present) {
            setMounted(true);
            setClosing(false);
            return undefined;
        }

        if (!mounted) {
            return undefined;
        }

        setClosing(true);
        const timeout = globalThis.setTimeout(
            () => {
                setMounted(false);
                setClosing(false);
                lastChildRef.current = null;
            },
            EXIT_DURATION_MS
        );

        return () =>
            globalThis.clearTimeout(timeout);
    }, [present, mounted]);

    if (!present && !mounted) {
        return null;
    }

    return (
        <div
            className={
                "diagram-editor-presence" +
                (closing
                    ? " diagram-editor-presence-closing"
                    : "")
            }
        >
            {present
                ? children
                : lastChildRef.current}
        </div>
    );
}
