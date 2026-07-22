import {
    getAvailableThemes
} from "../themes/ThemeManager.js";

import {
    DIRECTIONS
} from "../config/Directions.js";


/**
 * Barra de controles del preview.
 *
 * Únicamente permite cambiar:
 *
 * - Tema visual.
 * - Dirección del diagrama.
 *
 * @param {Object} props
 * @param {string} props.theme
 * @param {string} props.direction
 * @param {Function} props.onThemeChange
 * @param {Function} props.onDirectionChange
 */
export default function PreviewToolbar({

    theme,

    direction,

    onThemeChange,

    onDirectionChange

}) {


    const themes =
        getAvailableThemes();

    const backgroundClass =
        theme === "dark"
            ? "dark-mode"
            : "light-mode";

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


    return (

        <div className="diagram-toolbar">

            <label className="toolbar-group">

                <select
                    className="toolbar-select"
                    value={theme}
                    onChange={(event) =>
                        onThemeChange(event.target.value)
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

            </label>


            <label className="toolbar-group">

                <select
                    className="toolbar-select"
                    value={direction}
                    onChange={(event) =>
                        onDirectionChange(event.target.value)
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

            </label>

        </div>

    );

}