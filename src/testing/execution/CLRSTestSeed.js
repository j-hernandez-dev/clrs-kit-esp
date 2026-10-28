export function deriveCLRSTestCaseSeed(
    baseSeed,
    suiteId,
    caseId
) {
    let hash = (2_166_136_261 ^ baseSeed) >>> 0;

    for (const character of `${suiteId}:${caseId}`) {
        hash ^= character.codePointAt(0);
        hash = Math.imul(hash, 16_777_619) >>> 0;
    }

    return hash;
}
