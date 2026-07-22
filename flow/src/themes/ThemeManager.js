/**
 * Gestor central de temas Mermaid.
 *
 * Los temas personalizados devuelven
 * objetos con estilos definidos manualmente.
 *
 * Los temas nativos de Mermaid devuelven
 * únicamente la configuración necesaria
 * para utilizar el tema interno.
 */

import { CLASSIC_THEME } from "./presets/ClassicTheme.js";
import { DARK_THEME } from "./presets/DarkTheme.js";
import { MODERN_THEME } from "./presets/ModernTheme.js";
import { PASTEL_THEME } from "./presets/PastelTheme.js";
import { SOBER_THEME } from "./presets/SoberTheme.js";

/**
 * Temas personalizados disponibles.
 */
const CUSTOM_THEMES = {

    classic: CLASSIC_THEME,

    modern: MODERN_THEME,

    pastel: PASTEL_THEME,

    sober: SOBER_THEME,

    dark: DARK_THEME

};


/*
Temas nativos soportados por Mermaid.
const MERMAID_THEMES = {

    default: "default",

    dark: "dark",

    forest: "forest",

    neutral: "neutral"

};

//--------------------------------------------------
// Tema nativo Mermaid
//--------------------------------------------------

    if (MERMAID_THEMES[themeName]) {

        return {

            type: "mermaid",

            theme: MERMAID_THEMES[themeName]

        };

    }
*/

/**
 * Obtiene la configuración del tema.
 *
 * @param {string} themeName
 *
 * @returns {Object}
 */
export function getTheme(themeName) {


    //--------------------------------------------------
    // Tema personalizado
    //--------------------------------------------------

    if (CUSTOM_THEMES[themeName]) {

        return {

            type: "custom",

            theme: CUSTOM_THEMES[themeName]

        };

    }

    //--------------------------------------------------
    // Default
    //--------------------------------------------------

    return {

        type: "custom",

        theme: DARK_THEME

    };

}


/**
 * Obtiene los temas disponibles
 * para la interfaz.
 *
 * @returns {Object[]}
 */
export function getAvailableThemes() {

    return [

        {
            id: "classic",
            name: "❦ Clásico"
        },

        {
            id: "modern",
            name: "✦ Moderno"
        },

        {
            id: "pastel",
            name: "✿ Pastel"
        },

        {
            id: "sober",
            name: "⬒ Sobrio"
        },

        {
            id: "dark",
            name: "◐ Oscuro"
        }

    ];

}