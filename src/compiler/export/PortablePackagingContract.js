function deepFreeze(value) {
    if (value && typeof value === "object") {
        for (const child of Object.values(value)) { deepFreeze(child); }
        Object.freeze(value);
    }
    return value;
}

/** Autoridad única para el empaquetado distribuible mediante @yao-pkg/pkg. */
export const PORTABLE_PACKAGING_CONTRACT = deepFreeze({
    dependency: { name: "@yao-pkg/pkg", version: "^6.22.0", cli: "pkg" },
    node: { supportedMajors: [22, 24, 26] },
    supportedPlatforms: ["win32", "linux", "darwin"],
    target: "host",
    outputDirectory: "dist",
    assets: ["node_modules/node-gtk/lib/binding/**/*"]
});

/** Rango de Node compartido por los manifests portables CLI y GUI. */
export function createPortableNodeEngineRange() {
    return PORTABLE_PACKAGING_CONTRACT.node.supportedMajors
        .map(major => `>=${major} <${major + 1}`).join(" || ");
}

/** Scripts npm del perfil CLI: el JavaScript fuente es también el entrypoint de pkg. */
export function createCliBuildScripts(identity) {
    const { name, entryFile } = requirePortableIdentity(identity);
    const prefix = `${PORTABLE_PACKAGING_CONTRACT.dependency.cli} . --targets ${PORTABLE_PACKAGING_CONTRACT.target} --output`;
    const output = `./${PORTABLE_PACKAGING_CONTRACT.outputDirectory}/${name}`;
    return Object.freeze({
        start: `node ./${entryFile}`,
        "build:win": `${prefix} ${output}.exe`,
        "build:unix": `${prefix} ${output}`
    });
}

/** Scripts npm construidos sólo con la identidad portable ya normalizada. */
export function createPortableBuildScripts(identity) {
    const { name, entryFile } = requirePortableIdentity(identity);
    const prepareFile = identity?.preparePackableFile;
    if (prepareFile !== "prepare-packable.cjs") {
        throw new TypeError("La identidad no es apta para construir scripts npm portables.");
    }
    const prefix = `node ./${prepareFile} && ${PORTABLE_PACKAGING_CONTRACT.dependency.cli} . --targets ${PORTABLE_PACKAGING_CONTRACT.target} --output`;
    const output = `./${PORTABLE_PACKAGING_CONTRACT.outputDirectory}/${name}/${name}`;
    return Object.freeze({
        start: `node ./${entryFile}`,
        "build:win": `${prefix} ${output}.exe`,
        "build:unix": `${prefix} ${output}`
    });
}

function requirePortableIdentity(identity) {
    const name = identity?.portableName;
    const entryFile = identity?.entryFile;
    if (typeof name !== "string" || !/^[a-z0-9][a-z0-9_-]*$/u.test(name)
        || identity?.name !== name || entryFile !== `${name}.js`) {
        throw new TypeError("La identidad no es apta para construir scripts npm portables.");
    }
    return { name, entryFile };
}
