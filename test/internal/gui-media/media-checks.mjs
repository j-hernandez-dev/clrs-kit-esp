import test from "node:test";
import assert from "node:assert/strict";
import { createGuiMediaAdapter } from "./GuiMediaAdapter.js";
import { classifyGuiMediaError, probeGuiEnvironment } from "./GuiEnvironmentProbe.js";
import { fakeModelsMedia } from "./FakeModelsMedia.js";

const fail = code => { throw Object.assign(new Error(code), { code }); };
test("archivo técnico: preferencias, reproducción y limpieza del adaptador conservado", () => {
    const fake = fakeModelsMedia();
    const adapter = createGuiMediaAdapter({ ...fake, fail, classifyGuiMediaError });
    const record = { type: "Video", id: "archivo", ...adapter.create(["archivo", "x.avi"]) };
    adapter.property(record, "volumen", 0.2, true);
    const stream = record.native.getMediaStream(); stream.prepare();
    assert.equal(stream.volume, 0.2);
    adapter.action(record, "REPRODUCIR"); assert.equal(stream.playing, true);
    adapter.action(record, "PAUSAR"); assert.equal(stream.playing, false);
    adapter.release(record); assert.equal(fake.subscriptions.size, 0);
    assert.equal(record.native.getMediaStream(), null);
    adapter.dispose();
});
test("archivo técnico: clasificación de errores permanece preservada", () => {
    const Gio = { ioErrorQuark: () => 42, IOErrorEnum: { NOT_FOUND: 1, NOT_SUPPORTED: 15 } };
    assert.equal(classifyGuiMediaError({ domain: 42, code: 1 }, Gio), "CLRS_GUI_MEDIA_RESOURCE_UNAVAILABLE");
    assert.equal(classifyGuiMediaError({ domain: 42, code: 15 }, Gio, {}, true), "CLRS_GUI_MEDIA_FORMAT_UNSUPPORTED");
});
test("archivo técnico: probe histórico requiere inicialización antes de MediaFile", async () => {
    let initialized = false;
    const Gtk = { getMajorVersion: () => 4, getMinorVersion: () => 10, getMicroVersion: () => 0,
        initCheck() { initialized = true; return true; }, Video: class {},
        MediaFile: { new() { assert.equal(initialized, true); return { constructor: { name: "GtkNoMediaFile" }, pause() {}, clear() {} }; } } };
    const result = await probeGuiEnvironment("internal", ["gui", "gui.video"], async () => ({ require: () => Gtk }));
    assert.equal(result.code, "CLRS_GUI_MEDIA_BACKEND_UNAVAILABLE");
});
