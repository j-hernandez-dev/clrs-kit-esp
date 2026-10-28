import {
    getAvailableThemes
} from "../themes/ThemeManager.js";
import {
    DIRECTIONS
} from "../config/Directions.js";
import {
    CONNECTION_STYLES
} from "../config/ConnectionStyles.js";

export default function PreviewToolbar({
    theme,
    direction,
    connectionStyle,
    scopes,
    scopeId,
    searchQuery,
    searchResultCount,
    searchResultIndex,
    showMinimap,
    canFitSelection,
    onThemeChange,
    onDirectionChange,
    onConnectionStyleChange,
    onScopeChange,
    onSearchChange,
    onPreviousResult,
    onNextResult,
    onFitAll,
    onFitSelection,
    onToggleMinimap,
    onCreateFunction,
    onSaveDocument,
    onExportDiagram,
    editPending = false,
    canCreateFunction = true
}) {
    const themes =
        getAvailableThemes();
    const directions = [
        {
            value: DIRECTIONS.VERTICAL,
            label: "⇅ Vertical"
        },
        {
            value: DIRECTIONS.HORIZONTAL,
            label: "⇄ Horizontal"
        }
    ];
    const connectionStyles = [
        {
            value:
                CONNECTION_STYLES.CURVED,
            label: "↷ Curvo"
        },
        {
            value:
                CONNECTION_STYLES.STRAIGHT,
            label: "↘ Lineal"
        },
        {
            value:
                CONNECTION_STYLES.ORTHOGONAL,
            label: "↴ Ortogonal"
        }
    ];
    const resultLabel =
        searchQuery === ""
            ? ""
            : searchResultCount > 0
                ? `${searchResultIndex + 1}/${searchResultCount}`
                : "0/0";

    const handleSearchKeyDown = event => {
        if (event.key === "Enter") {
            event.preventDefault();

            if (event.shiftKey) {
                onPreviousResult();
            } else {
                onNextResult();
            }
        }

        if (event.key === "Escape") {
            onSearchChange("");
        }
    };

    return (
        <div className="diagram-toolbar">
            <select
                className="toolbar-select"
                value={theme}
                aria-label="Tema del diagrama"
                title="Tema del diagrama"
                onChange={event =>
                    onThemeChange(
                        event.target.value
                    )
                }
            >
                {themes.map(option => (
                    <option
                        key={option.id}
                        value={option.id}
                    >
                        {option.name}
                    </option>
                ))}
            </select>

            <select
                className="toolbar-select toolbar-select-compact"
                value={direction}
                aria-label="Dirección del diagrama"
                title="Dirección del diagrama"
                onChange={event =>
                    onDirectionChange(
                        event.target.value
                    )
                }
            >
                {directions.map(option => (
                    <option
                        key={option.value}
                        value={option.value}
                    >
                        {option.label}
                    </option>
                ))}
            </select>

            <select
                className="toolbar-select toolbar-connection-select"
                value={connectionStyle}
                aria-label="Estilo de conexiones"
                title="Estilo de conexiones"
                onChange={event =>
                    onConnectionStyleChange(
                        event.target.value
                    )
                }
            >
                {connectionStyles.map(option => (
                    <option
                        key={option.value}
                        value={option.value}
                    >
                        {option.label}
                    </option>
                ))}
            </select>

            <select
                className="toolbar-select toolbar-scope-select"
                value={scopeId}
                aria-label="Flujo visible"
                title="Mostrar el diagrama completo o aislar un flujo"
                onChange={event =>
                    onScopeChange(
                        event.target.value
                    )
                }
            >
                {scopes.map(scope => (
                    <option
                        key={scope.id}
                        value={scope.id}
                    >
                        {scope.label}
                    </option>
                ))}
            </select>

            <div className="toolbar-search">
                <input
                    className="toolbar-input"
                    type="search"
                    value={searchQuery}
                    placeholder="Buscar nodo…"
                    aria-label="Buscar nodo del diagrama"
                    onChange={event =>
                        onSearchChange(
                            event.target.value
                        )
                    }
                    onKeyDown={
                        handleSearchKeyDown
                    }
                />
                <span
                    className="toolbar-counter"
                    aria-live="polite"
                >
                    {resultLabel}
                </span>
                <button
                    className="toolbar-button"
                    type="button"
                    disabled={
                        searchResultCount === 0
                    }
                    aria-label="Coincidencia anterior"
                    title="Coincidencia anterior (Mayús+Enter)"
                    onClick={onPreviousResult}
                >
                    ↑
                </button>
                <button
                    className="toolbar-button"
                    type="button"
                    disabled={
                        searchResultCount === 0
                    }
                    aria-label="Coincidencia siguiente"
                    title="Coincidencia siguiente (Enter)"
                    onClick={onNextResult}
                >
                    ↓
                </button>
            </div>

            <div className="toolbar-actions">
                <button
                    className="toolbar-button toolbar-button-save"
                    type="button"
                    disabled={
                        editPending ||
                        !onSaveDocument
                    }
                    aria-label="Guardar archivo CLRS enlazado"
                    title="Guardar los cambios del archivo CLRS enlazado"
                    onClick={onSaveDocument}
                >
                    ⭳
                </button>
                <button
                    className="toolbar-button toolbar-button-export"
                    type="button"
                    disabled={!onExportDiagram}
                    aria-label="Exportar diagrama de flujo"
                    title="Exportar diagrama de flujo"
                    onClick={onExportDiagram}
                >
                ⤒
                </button>
                <span className="toolbar-separator" aria-hidden="true" />
                <button
                    className="toolbar-button toolbar-button-create-function"
                    type="button"
                    disabled={
                        editPending ||
                        !canCreateFunction ||
                        !onCreateFunction
                    }
                    aria-label="Crear un subproceso o función"
                    title={
                        canCreateFunction
                            ? "Crea un subproceso / función"
                            : "Abre el diagrama del documento completo para crear funciones"
                    }
                    onClick={onCreateFunction}
                >
                    ƒ
                </button>
                <button
                    className="toolbar-button"
                    type="button"
                    disabled={!canFitSelection}
                    aria-label="Centrar nodo activo"
                    title="Centrar y ajustar el nodo activo"
                    onClick={onFitSelection}
                >
                    ◎
                </button>
                <button
                    className="toolbar-button"
                    type="button"
                    aria-label="Ajustar diagrama completo"
                    title="Ajustar el flujo visible"
                    onClick={onFitAll}
                >
                    ⛶
                </button>
                <button
                    className={
                        "toolbar-button " +
                        (showMinimap
                            ? "toolbar-button-active"
                            : "")
                    }
                    type="button"
                    aria-pressed={showMinimap}
                    aria-label="Mostrar u ocultar minimapa"
                    title="Mostrar u ocultar minimapa"
                    onClick={onToggleMinimap}
                >
                    ▣
                </button>
            </div>
        </div>
    );
}
