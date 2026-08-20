'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNoiseCancellationAudioProcessor = createNoiseCancellationAudioProcessor;
const tslib_1 = require("tslib");
const legacy_plugin_adapter_1 = require("./noisecancellation/legacy-plugin-adapter");
const dynamicImport = require('./util/dynamicimport');
const Log = require('./util/log');
const PLUGIN_CONFIG = {
    krisp: {
        supportedVersions: ['1.0.0', '2.0.0'],
        pluginFile: 'krispsdk.mjs'
    },
    rnnoise: {
        supportedVersions: ['0.6.0'],
        pluginFile: 'rnnoise_sdk.mjs'
    }
};
const parseVersion = (version) => {
    // Strip semver pre-release suffix (e.g. "2.0.0-rc.1") before parsing.
    const core = version.split('-')[0];
    const parts = core.split('.').map(v => Number(v));
    if (parts.length !== 3 || parts.some(Number.isNaN)) {
        throw new Error(`Unsupported Plugin version format: ${version}`);
    }
    return parts;
};
const ensureVersionCompatible = ({ supportedVersions, pluginVersion }) => {
    const pluginParts = parseVersion(pluginVersion);
    const match = supportedVersions
        .map(parseVersion)
        .find(parts => parts[0] === pluginParts[0]);
    if (!match) {
        throw new Error(`Major version mismatch: [Plugin version ${pluginVersion}], [Supported Versions ${supportedVersions.join(', ')}]`);
    }
    if (pluginParts[1] < match[1]) {
        throw new Error(`Minor version mismatch: [Plugin version ${pluginVersion}] < [Supported Version ${match.join('.')}]`);
    }
};
const adaptPlugin = (maybeLegacyPlugin, major) => {
    return major === 2
        ? maybeLegacyPlugin
        : new legacy_plugin_adapter_1.LegacyPluginAdapter(maybeLegacyPlugin);
};
let audioProcessors = new Map();
function createNoiseCancellationAudioProcessor(noiseCancellationOptions, log) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        let audioProcessor = audioProcessors.get(noiseCancellationOptions.vendor);
        if (!audioProcessor) {
            let pluginConfig = PLUGIN_CONFIG[noiseCancellationOptions.vendor];
            if (!pluginConfig) {
                throw new Error(`Unsupported NoiseCancellationOptions.vendor: ${noiseCancellationOptions.vendor}`);
            }
            const { supportedVersions, pluginFile } = pluginConfig;
            const rootDir = noiseCancellationOptions.sdkAssetsPath;
            const sdkFilePath = `${rootDir}/${pluginFile}`;
            try {
                log.debug('loading noise cancellation sdk: ', sdkFilePath);
                const dynamicModule = yield dynamicImport(sdkFilePath);
                log.debug('Loaded noise cancellation sdk:', dynamicModule);
                const maybeLegacyPlugin = dynamicModule.default;
                if (!maybeLegacyPlugin || typeof maybeLegacyPlugin.getVersion !== 'function') {
                    throw new Error(`Invalid noise cancellation plugin module: ${sdkFilePath}`);
                }
                const pluginVersion = maybeLegacyPlugin.getVersion();
                log.debug('Plugin Version =', pluginVersion);
                ensureVersionCompatible({ supportedVersions, pluginVersion });
                const major = parseVersion(pluginVersion)[0];
                const plugin = adaptPlugin(maybeLegacyPlugin, major);
                if (!plugin.isSupported()) {
                    throw new Error('Noise Cancellation plugin is not supported on your browser');
                }
                if (!plugin.isInitialized()) {
                    log.debug('initializing noise cancellation sdk: ', rootDir);
                    yield plugin.init({ rootDir });
                    log.debug('noise cancellation sdk initialized!');
                }
                audioProcessor = {
                    vendor: noiseCancellationOptions.vendor,
                    isInitialized: () => plugin.isInitialized(),
                    isConnected: () => plugin.isConnected(),
                    isEnabled: () => plugin.isEnabled(),
                    disconnect: () => plugin.disconnect(),
                    enable: () => plugin.enable(),
                    disable: () => plugin.disable(),
                    destroy: () => plugin.destroy(),
                    setLogging: (enable) => plugin.setLogging(enable),
                    connect: (sourceTrack) => {
                        log.debug('connect: ', sourceTrack.id);
                        if (plugin.isConnected()) {
                            plugin.disconnect();
                        }
                        const mediaStream = plugin.connect(new MediaStream([sourceTrack]));
                        if (!mediaStream) {
                            throw new Error('Error connecting with noise cancellation sdk');
                        }
                        const cleanTrack = mediaStream.getAudioTracks()[0];
                        if (!cleanTrack) {
                            throw new Error('Error getting clean track from noise cancellation sdk');
                        }
                        plugin.enable();
                        return cleanTrack;
                    },
                };
                audioProcessors.set(noiseCancellationOptions.vendor, audioProcessor);
            }
            catch (er) {
                log.error(`Error loading noise cancellation sdk:${sdkFilePath}`, er);
                throw er;
            }
        }
        return audioProcessor;
    });
}
//# sourceMappingURL=noisecancellationadapter.js.map