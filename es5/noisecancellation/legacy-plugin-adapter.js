"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LegacyPluginAdapter = void 0;
const AudioContextFactory = require('../webaudio/audiocontext');
class LegacyPluginAdapter {
    constructor(legacy) {
        this.legacy = legacy;
    }
    init(options) { return this.legacy.init(options); }
    isInitialized() { return this.legacy.isInitialized(); }
    isConnected() { return this.legacy.isConnected(); }
    isEnabled() { return this.legacy.isEnabled(); }
    connect(input) { return this.legacy.connect(input); }
    disconnect() { this.legacy.disconnect(); }
    enable() { this.legacy.enable(); }
    disable() { this.legacy.disable(); }
    setLogging(enable) { this.legacy.setLogging(enable); }
    getVersion() { return this.legacy.getVersion(); }
    isSupported() {
        const holder = {};
        const ctx = AudioContextFactory.getOrCreate(holder);
        try {
            return !!ctx && this.legacy.isSupported(ctx);
        }
        finally {
            AudioContextFactory.release(holder);
        }
    }
    destroy() {
        return Promise.resolve().then(() => {
            this.legacy.destroy();
        });
    }
}
exports.LegacyPluginAdapter = LegacyPluginAdapter;
//# sourceMappingURL=legacy-plugin-adapter.js.map