import {
    useEffect,
    useState
} from "react";

import {
    requirePort
} from "../../../src/application/ports/ApplicationPorts.js";

export function useDiagramModel(
    sourceCode,
    modelStore,
    sourceOrigin = null
) {
    const store = requirePort(
        modelStore,
        "diagramModelStore",
        [
            "getState",
            "subscribe",
            "setSource"
        ]
    );
    const [state, setState] = useState(
        store.getState
    );

    useEffect(() => {
        setState(store.getState());

        return store.subscribe(setState);
    }, [store]);

    useEffect(() => {
        store.setSource(
            sourceCode,
            { sourceOrigin }
        );
    }, [store, sourceCode, sourceOrigin]);

    return state;
}
