/* eslint-disable no-console */
'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNoiseCancellationAudioProcessor = void 0;
var Log = require('./util/log');
var dynamicImport = require('./dynamicImport');
var KRISP_VERSION = '2.1.0';
var RNNOISE_VERSION = '2.0.0';
var KRISP_SDK_FILE = 'krispsdk.mjs';
var RNNOISE_SDK_FILE = 'rnnoise_sdk.mjs';
var audioProcessors = new Map();
function createNoiseCancellationAudioProcessor(noiseCancellationOptions, log) {
    return __awaiter(this, void 0, void 0, function () {
        var audioProcessor, sdkFilePath, rootDir, dynamicModule, sdkAPI_1, er_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    audioProcessor = audioProcessors.get(noiseCancellationOptions.vendor);
                    if (!!audioProcessor) return [3 /*break*/, 6];
                    sdkFilePath = void 0;
                    rootDir = void 0;
                    switch (noiseCancellationOptions.vendor) {
                        case 'krisp':
                            rootDir = noiseCancellationOptions.sdkAssetsPath + "/" + KRISP_VERSION;
                            sdkFilePath = rootDir + "/" + KRISP_SDK_FILE;
                            break;
                        case 'rnnoise':
                            rootDir = noiseCancellationOptions.sdkAssetsPath + "/" + RNNOISE_VERSION;
                            sdkFilePath = rootDir + "/" + RNNOISE_SDK_FILE;
                            break;
                        default:
                            throw new Error("Unsupported NoiseCancellationOptions.vendor: " + noiseCancellationOptions.vendor);
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 5, , 6]);
                    log.debug('loading noise cancellation sdk: ', sdkFilePath);
                    return [4 /*yield*/, dynamicImport(sdkFilePath)];
                case 2:
                    dynamicModule = _a.sent();
                    log.debug('Loaded noise cancellation sdk:', dynamicModule);
                    sdkAPI_1 = dynamicModule.default;
                    if (!!sdkAPI_1.isInitialized()) return [3 /*break*/, 4];
                    log.debug('initializing noise cancellation sdk: ', rootDir);
                    return [4 /*yield*/, sdkAPI_1.init({ rootDir: rootDir })];
                case 3:
                    _a.sent();
                    log.debug('noise cancellation sdk initialized!');
                    _a.label = 4;
                case 4:
                    audioProcessor = {
                        vendor: noiseCancellationOptions.vendor,
                        isInitialized: function () { return sdkAPI_1.isInitialized(); },
                        isConnected: function () { return sdkAPI_1.isConnected(); },
                        isEnabled: function () { return sdkAPI_1.isEnabled(); },
                        disconnect: function () { return sdkAPI_1.disconnect(); },
                        enable: function () { return sdkAPI_1.enable(); },
                        disable: function () { return sdkAPI_1.disable(); },
                        destroy: function () { return sdkAPI_1.destroy(); },
                        setLogging: function (enable) { return sdkAPI_1.setLogging(enable); },
                        connect: function (sourceTrack) {
                            log.debug('connect: ', sourceTrack.id);
                            if (sdkAPI_1.isConnected()) {
                                sdkAPI_1.disconnect();
                            }
                            var mediaStream = sdkAPI_1.connect(new MediaStream([sourceTrack]));
                            if (!mediaStream) {
                                throw new Error('Error connecting with noise cancellation sdk');
                            }
                            var cleanTrack = mediaStream.getAudioTracks()[0];
                            if (!cleanTrack) {
                                throw new Error('Error getting clean track from noise cancellation sdk');
                            }
                            sdkAPI_1.enable();
                            return cleanTrack;
                        },
                    };
                    audioProcessors.set(noiseCancellationOptions.vendor, audioProcessor);
                    return [3 /*break*/, 6];
                case 5:
                    er_1 = _a.sent();
                    log.error("Error loading noise cancellation sdk:" + sdkFilePath, er_1);
                    throw er_1;
                case 6: return [2 /*return*/, audioProcessor];
            }
        });
    });
}
exports.createNoiseCancellationAudioProcessor = createNoiseCancellationAudioProcessor;
//# sourceMappingURL=noisecancellationadapter.js.map