/** AVI silencioso sin compresión, generado localmente para el ensayo (sin red ni códecs de codificación). */
export function createGuiVideoFixture() {
    const width = 16, height = 16, fps = 5, count = 15, frameSize = width * height * 3;
    const chunk = (tag, data) => {
        const header = Buffer.alloc(8); header.write(tag); header.writeUInt32LE(data.length, 4);
        return Buffer.concat([header, data, Buffer.alloc(data.length % 2)]);
    };
    const list = (tag, parts) => chunk("LIST", Buffer.concat([Buffer.from(tag), ...parts]));
    const main = Buffer.alloc(56);
    main.writeUInt32LE(1000000 / fps, 0); main.writeUInt32LE(frameSize * fps, 4);
    main.writeUInt32LE(16, 12); main.writeUInt32LE(count, 16); main.writeUInt32LE(1, 24);
    main.writeUInt32LE(frameSize, 28); main.writeUInt32LE(width, 32); main.writeUInt32LE(height, 36);
    const stream = Buffer.alloc(56); stream.write("vids", 0); stream.write("DIB ", 4);
    stream.writeUInt32LE(1, 20); stream.writeUInt32LE(fps, 24); stream.writeUInt32LE(count, 32);
    stream.writeUInt32LE(frameSize, 36); stream.writeUInt32LE(0xffffffff, 40);
    stream.writeInt16LE(width, 52); stream.writeInt16LE(height, 54);
    const format = Buffer.alloc(40); format.writeUInt32LE(40, 0); format.writeInt32LE(width, 4);
    format.writeInt32LE(height, 8); format.writeUInt16LE(1, 12); format.writeUInt16LE(24, 14); format.writeUInt32LE(frameSize, 20);
    const frames = [], indices = []; let offset = 4;
    for (let n = 0; n < count; n++) {
        const data = Buffer.alloc(frameSize, 25 + n * 12);
        const frame = chunk("00db", data); frames.push(frame);
        const entry = Buffer.alloc(16); entry.write("00db"); entry.writeUInt32LE(16, 4);
        entry.writeUInt32LE(offset, 8); entry.writeUInt32LE(data.length, 12); indices.push(entry); offset += frame.length;
    }
    const content = Buffer.concat([Buffer.from("AVI "), list("hdrl", [chunk("avih", main), list("strl", [chunk("strh", stream), chunk("strf", format)])]),
        list("movi", frames), chunk("idx1", Buffer.concat(indices))]);
    return chunk("RIFF", content);
}
