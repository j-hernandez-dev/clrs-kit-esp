export function selectCLRSTestTargets({
    roots,
    included,
    excluded,
    resolveMetadata
}) {
    const sources = included == null
        ? collectionValues(roots)
        : [...included];
    const exclusions = (excluded ?? [])
        .map(item => ({
            id: item.id,
            metadata: resolveMetadata(item)
        }));
    const selected = new Map();

    for (const source of sources) {
        collectTargets(
            source,
            resolveMetadata,
            selected
        );
    }

    return [...selected.values()].filter(target =>
        !isExcluded(target, exclusions)
    );
}

function collectTargets(
    item,
    resolveMetadata,
    selected
) {
    const metadata = resolveMetadata(item);

    if (metadata == null) {
        return;
    }

    if (metadata.kind === "case") {
        selected.set(item.id, { item, metadata });
        return;
    }

    const children = collectionValues(
        item.children
    );

    if (
        children.length === 0 &&
        metadata.runnable === false
    ) {
        selected.set(item.id, { item, metadata });
        return;
    }

    for (const child of children) {
        collectTargets(
            child,
            resolveMetadata,
            selected
        );
    }
}

function isExcluded(target, exclusions) {
    return exclusions.some(exclusion => {
        if (exclusion.id === target.item.id) {
            return true;
        }

        const metadata = exclusion.metadata;

        if (
            metadata == null ||
            metadata.sourceId !==
                target.metadata.sourceId ||
            metadata.sourceKey !==
                target.metadata.sourceKey ||
            metadata.definitionPath !==
                target.metadata.definitionPath
        ) {
            return false;
        }

        return metadata.kind === "suite" ||
            (
                metadata.kind === "case" &&
                metadata.caseId ===
                    target.metadata.caseId
            );
    });
}

function collectionValues(collection) {
    const values = [];

    collection.forEach(item => {
        values.push(item);
    });

    return values;
}
