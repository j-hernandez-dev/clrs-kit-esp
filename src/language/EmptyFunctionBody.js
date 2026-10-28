/**
 * Representación fuente no ejecutable de un cuerpo de función todavía vacío.
 *
 * La firma aislada `FUNCION()` también puede ser una llamada global. Este
 * marcador conserva de forma inequívoca la declaración y desaparece del AST,
 * de modo que el diagrama puede proyectar un `Fin` sintético sin introducir
 * un retorno ni otra instrucción ejecutable.
 */
export const EMPTY_FUNCTION_BODY_COMMENT =
    "// Subproceso sin instrucciones";

