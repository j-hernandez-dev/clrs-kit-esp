function initProgramKey() {
    if (globalThis.ProgramKey !== undefined) {
        return;
    }

    globalThis.ProgramKey = Math.floor(Math.random() * 98001) + 1000;
}

initProgramKey();

export { initProgramKey };