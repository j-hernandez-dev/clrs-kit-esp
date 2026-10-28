/** Adaptador autocontenido; el stream y Gio.File nunca salen hacia CLRS. */
export function createGuiMediaAdapter({ Gtk, Gio, GLib, fail, connect, verifyMedia,
    classifyGuiMediaError, onMediaFailure = () => {} }) {
    const states = new Set();
    const mediaError = cause => {
        try { fail(classifyGuiMediaError(cause, Gio, GLib, true)); }
        catch (error) { error.cause = cause; return error; }
    };
    const releaseState = state => {
        if (!state || state.released) { return; }
        state.released = true;
        // Every cleanup is attempted even if one native operation fails.
        const safely = action => { try { action(); } catch { /* preserve original failure */ } };
        safely(() => state.stopPrepared?.()); safely(() => state.stopError?.()); safely(() => state.stopStream?.());
        state.stopPrepared = state.stopError = state.stopStream = null;
        safely(() => state.native.getMediaStream()?.pause());
        safely(() => state.native.setFile(null));
        states.delete(state);
    };
    const localFile = filename => {
        const file = Gio.File.newForPath(filename);
        let input;
        try { input = file.read(null); input.close(null); }
        catch (cause) {
            try { input?.close(null); } catch { /* preserve original error */ }
            throw mediaError(cause);
        }
        return file;
    };
    const stream = record => record.native.getMediaStream();
    const applyPreferences = state => {
        const media = state.native.getMediaStream();
        // Algunos backends crean su reproductor al preparar/realizar el widget, no al asignar el archivo.
        if (media?.isPrepared() && !media.getError()) {
            media.setVolume(state.volume); media.setMuted(state.muted); media.setLoop(state.loop);
        }
    };
    const seek = (record, seconds) => {
        const media = stream(record);
        const micros = Math.round(seconds * 1000000);
        if (!Number.isSafeInteger(micros)) { fail("CLRS_GUI_INVALID_PROPERTY_VALUE"); }
        if (!media || !media.isSeekable()) {
            if (micros === 0 && (!media || Number(media.getTimestamp()) === 0)) { return; }
            fail("CLRS_GUI_MEDIA_NOT_SEEKABLE");
        }
        media.seek(BigInt(micros));
    };
    return {
        create(args) {
            verifyMedia();
            const file = localFile(args[1]);
            const native = new Gtk.Video();
            const state = { native, path: args[1], volume: 1, muted: false, loop: native.getLoop(), committed: false };
            const checkError = () => {
                const cause = native.getMediaStream()?.getError();
                if (!cause) { return; }
                const error = mediaError(cause);
                state.error = error;
                releaseState(state);
                if (state.committed) { onMediaFailure(args[0], error); }
            };
            const observeStream = () => {
                state.stopPrepared?.(); state.stopError?.(); state.stopPrepared = state.stopError = null;
                if (state.released) { return; }
                const current = native.getMediaStream();
                if (current) {
                    state.stopPrepared = connect(current, "notify::prepared", () => applyPreferences(state));
                    state.stopError = connect(current, "notify::error", checkError);
                }
                checkError();
                if (!state.released) { applyPreferences(state); }
            };
            try {
                state.stopStream = connect(native, "notify::media-stream", observeStream);
                native.setFile(file);
                observeStream();
                if (state.error) { throw state.error; }
                states.add(state); state.committed = true;
                return { native, state };
            } catch (cause) {
                releaseState(state);
                throw cause.code?.startsWith("CLRS_GUI_") ? cause : mediaError(cause);
            }
        },
        property(record, name, value, write) {
            const state = record.state;
            const media = stream(record);
            if (write) {
                switch (name) {
                    case "archivo": nativeFile(); break;
                    case "reproduccion_automatica": record.native.setAutoplay(value); break;
                    case "bucle": record.native.setLoop(value); state.loop = value; applyPreferences(state); break;
                    case "volumen": state.volume = value; applyPreferences(state); break;
                    case "silenciado": state.muted = value; applyPreferences(state); break;
                    case "posicion": seek(record, value); break;
                    default: return null;
                }
                return { value: undefined };
            }
            switch (name) {
                case "archivo": return { value: state.path };
                case "reproduccion_automatica": return { value: record.native.getAutoplay() };
                case "bucle": return { value: record.native.getLoop() };
                case "volumen": return { value: media?.isPrepared() ? media.getVolume() : state.volume };
                case "silenciado": return { value: media?.isPrepared() ? media.getMuted() : state.muted };
                case "reproduciendo": return { value: media ? media.getPlaying() : false };
                case "preparado": return { value: media ? media.isPrepared() : false };
                case "finalizado": return { value: media ? media.getEnded() : false };
                case "duracion": return { value: media ? Number(media.getDuration()) / 1000000 : 0 };
                case "posicion": return { value: media ? Number(media.getTimestamp()) / 1000000 : 0 };
                case "desplazable": return { value: media ? media.isSeekable() : false };
                default: return null;
            }
            function nativeFile() {
                const file = localFile(value);
                media?.pause();
                record.native.setFile(file);
                if (state.error) { throw state.error; }
                state.path = value;
                applyPreferences(state);
            }
        },
        action(record, name) {
            const media = stream(record);
            if (!["REPRODUCIR", "PAUSAR", "PARAR"].includes(name)) { return false; }
            if (name === "REPRODUCIR") {
                if (!media) { fail("CLRS_GUI_MEDIA_LOAD_FAILED"); }
                if (media.getError()) { throw mediaError(media.getError()); }
                media.play();
            } else if (name === "PAUSAR") { media?.pause(); }
            else {
                // Validar antes de pausar: un rechazo no debe aparentar que reinició el video.
                if (media && !media.isSeekable() && Number(media.getTimestamp()) !== 0) { fail("CLRS_GUI_MEDIA_NOT_SEEKABLE"); }
                media?.pause(); seek(record, 0);
            }
            return true;
        },
        release(record) {
            if (record.type !== "Video" || !states.has(record.state)) { return; }
            releaseState(record.state);
        },
        dispose() {
            for (const state of states) { releaseState(state); }
            states.clear();
        }
    };
}
