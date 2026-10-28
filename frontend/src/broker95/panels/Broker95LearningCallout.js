const STANDALONE_RIGHT_ARROW =
    /^(\s*)(?:→|➜|➡|->)(\s*)$/u;

export function formatBroker95LearningCalloutText(
    text
) {
    return text
        .split("\n")
        .map(line =>
            line.replace(
                STANDALONE_RIGHT_ARROW,
                "$1↓$2"
            )
        )
        .join("\n");
}
