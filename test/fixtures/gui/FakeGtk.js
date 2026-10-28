/** Doble de infraestructura: sólo el ensayo nativo verifica las firmas GI reales. */
export function fakeGtk() {
    const all = [];
    const apps = [];
    let token = 0;
    let writes = 0;
    const theme = new Proxy({ gtkThemeName: "Tema inicial", gtkApplicationPreferDarkTheme: false }, {
        set(target, key, value) { writes++; target[key] = value; return true; }
    });
    class Signals {
        signals = new Map();
        connect(name, callback) { const id = ++token; this.signals.set(id, [name, callback]); return id; }
        disconnect(id) { this.signals.delete(id); }
        emit(name, ...args) {
            for (const [signal, callback] of this.signals.values()) {
                if (signal === name && callback(...args) === true) { return true; }
            }
            return false;
        }
    }
    class Widget extends Signals {
        parent = null;
        children = [];
        visible = false;
        constructor(props = {}) { super(); Object.assign(this, props); all.push(this); }
        getParent() { return this.parent; }
        show() { this.visible = true; }
        hide() { this.visible = false; }
        grabFocus() { return true; }
        setTooltipText(value) { this.tooltipText = value; }
        getTooltipText() { return this.tooltipText ?? null; }
        append(child) { this.children.push(child); child.parent = this; }
        prepend(child) { this.children.unshift(child); child.parent = this; }
        remove(child) { this.children.splice(this.children.indexOf(child), 1); child.parent = null; }
        setChild(child) { for (const previous of [...this.children]) { this.remove(previous); } if (child) { this.append(child); } }
        attach(child, ...position) { this.append(child); child.position = position; }
    }
    class Application extends Signals {
        windows = [];
        holds = 0;
        quitCalled = false;
        constructor() { super(); apps.push(this); }
        run() { this.emit("activate"); }
        register() { return true; }
        hold() { this.holds++; }
        release() { this.holds--; }
        getWindows() { return [...this.windows]; }
        addWindow(window) { this.windows.push(window); window.app = this; }
        removeWindow(window) {
            this.windows.splice(this.windows.indexOf(window), 1); window.app = null;
            window.emit("notify::application"); this.emit("window-removed", window);
        }
        quit() { this.quitCalled = true; }
    }
    class Window extends Widget {
        getApplication() { return this.app ?? null; }
        setTitle(title) { this.title = title; }
        setDefaultSize(width, height) { this.requestedSize = [width, height]; }
        present() { this.show(); }
        isActive() { return this.visible; }
        isMaximized() { return !!this.maximized; }
        isFullscreen() { return !!this.fullscreened; }
        close() { if (this.emit("close-request")) { return; } if (this.hideOnClose) { this.hide(); } else { this.destroy(); } }
        destroy() { this.app?.removeWindow(this); this.app = null; this.destroyed = true; }
        maximize() { this.maximized = true; }
        minimize() { this.minimized = true; }
        fullscreen() { this.fullscreened = true; }
        unmaximize() { this.maximized = false; }
        unminimize() { this.minimized = false; }
        unfullscreen() { this.fullscreened = false; }
    }
    class ApplicationWindow extends Window {}
    class ScrolledWindow extends Widget {
        minContentWidth = -1; maxContentWidth = -1; minContentHeight = -1; maxContentHeight = -1;
    }
    const Gtk = { Application, Window, ApplicationWindow, Box: Widget, Grid: Widget, ScrolledWindow,
        Orientation: { HORIZONTAL: 0, VERTICAL: 1 }, Align: { START: 1, CENTER: 3, END: 2, FILL: 0 },
        PolicyType: { AUTOMATIC: 1, ALWAYS: 0, NEVER: 2 }, Settings: { getDefault: () => theme },
        WrapMode: { NONE: 0, CHAR: 1, WORD: 2, WORD_CHAR: 3 },
        Justification: { LEFT: 0, RIGHT: 1, CENTER: 2, FILL: 3 },
        PositionType: { LEFT: 0, RIGHT: 1, TOP: 2, BOTTOM: 3 },
        SelectionMode: { NONE: 0, SINGLE: 1, BROWSE: 2, MULTIPLE: 3 } };
    const loop = { run() {}, quit() { this.stopped = true; } };
    const namespaces = { Gtk, Gio: { ApplicationFlags: { NON_UNIQUE: 32 },
        SettingsSchemaSource: { getDefault: () => ({ lookup: () => ({}) }) } }, GLib: {
        MainContext: { default: () => ({ iteration: () => false }) },
        MainLoop: { new: () => loop }, PRIORITY_DEFAULT_IDLE: 200, idleAdd(_priority, callback) { queueMicrotask(callback); }
    },
        Pango: { WrapMode: { WORD: 0, CHAR: 1, WORD_CHAR: 2 }, EllipsizeMode: { NONE: 0, START: 1, MIDDLE: 2, END: 3 } } };
    return { binding: { default: { require: name => namespaces[name] } }, Gtk, apps, all, theme, loop,
        get writes() { return writes; } };
}
