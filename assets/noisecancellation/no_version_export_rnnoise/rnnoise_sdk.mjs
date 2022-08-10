// Author: Makarand Patwardhan
// Implements interface to interact with twilio-video SDK

/* eslint-disable no-console */

const NativeAudioContext = typeof window.AudioContext !== 'undefined' ? window.AudioContext : typeof window.webkitAudioContext !== 'undefined' ? window.webkitAudioContext : null;
async function fetchAndCompileWebAssemblyModule(moduleUrl) {
  const response = await fetch(moduleUrl);
  const buffer = await response.arrayBuffer();
  const mod = await WebAssembly.compile(buffer);
  return mod;
}
class RNNoiseNode extends AudioWorkletNode {
  constructor(context) {
    super(context, 'rnnoise', {
      channelCountMode: 'explicit',
      channelCount: 1,
      channelInterpretation: 'speakers',
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      processorOptions: {
        module: RNNoiseNode.webModule,
        activeInitially: false,
      },
    });
    this._vadProb = 0;
    this._isEnabled = false; // match what we sent in processorOptions.activeInitially.
    this._isAlive = false;
    console.log('RNNoiseNode constructor');
    this.port.onmessage = ({ data }) => {
      this._isEnabled = data.isEnabled;
      this._isAlive = data.isAlive;
      if (data.vadProb) {
        this._vadProb = data.vadProb;
        if (this._onUpdate) {
          this._onUpdate();
        }
      }
    };
  }
  static async register(context, webAssemblyUrl, processorUrl) {
    RNNoiseNode.webModule = await fetchAndCompileWebAssemblyModule(webAssemblyUrl);
    await context.audioWorklet.addModule(processorUrl);
  }
  onUpdate(onupdate) {
    this._onUpdate = onupdate;
  }
  getVadProb() {
    return this._vadProb;
  }
  getIsEnabled() {
    return this._isEnabled;
  }
  enable() {
    this.port.postMessage('enable');
    this._isEnabled = true;
  }
  disable() {
    this.port.postMessage('disable');
    this._isEnabled = false;
  }
  destroy() {
    this.port.postMessage('destroy');
  }
  setLogging(enabled) {
    this.port.postMessage(enabled ? 'enableLogging' : 'disableLogging');
  }
}
RNNoiseNode.webModule = null;
let initialized = false;
let audioContext = null;
let connected = false;
let rnnoiseNode = null;
let sourceNode = null;
let destinationNode = null;
let inputStream = null;

const init = async ({ rootDir }) => {
  console.log('rnnoise.init, was initialized = ', initialized);
  audioContext = new AudioContext();
  const wasmPath = rootDir + '/rnnoise-processor.wasm';
  const processorJSPath = rootDir + '/rnnoise_processor.js';
  console.log({ wasmPath, processorJSPath });
  await RNNoiseNode.register(audioContext, wasmPath, processorJSPath);
  initialized = true;
};

const isInitialized = () => initialized;

const connect = stream => {
  if (!isInitialized()) {
    throw new Error('you must call init before connect');
  }
  sourceNode = audioContext.createMediaStreamSource(stream);
  if (!rnnoiseNode) {
    rnnoiseNode = new RNNoiseNode(audioContext);
  }
  destinationNode = audioContext.createMediaStreamDestination();
  sourceNode.connect(rnnoiseNode);
  rnnoiseNode.connect(destinationNode);
  const outputStream = destinationNode.stream;
  connected = true;
  inputStream = stream;
  rnnoiseNode.enable();
  return outputStream;
};

const isConnected = () => connected;

const disconnect = () => {
  if (connected) {
    connected = false;
    rnnoiseNode.disable();
    rnnoiseNode.disconnect();
    sourceNode.disconnect();
    destinationNode.disconnect();
    inputStream.getTracks().forEach(track => track.stop());
  }
};

const enable = () => connected && rnnoiseNode.enable();
const isEnabled = () => connected && rnnoiseNode.getIsEnabled();
const disable = () => connected && rnnoiseNode.disable();
const destroy = () => {
  initialized = false;
  disconnect();
  if (rnnoiseNode) {
    rnnoiseNode.destroy();
    rnnoiseNode = null;
  }
};

const setLogging = enable => {
  if (rnnoiseNode) {
    rnnoiseNode.setLogging(enable);
  }
};

const isSupported = ctx => {
  if (!NativeAudioContext) {
    return false;
  }

  if (!(ctx instanceof NativeAudioContext)) {
    return false;
  }

  if (!ctx.audioWorklet) {
    return false;
  }

  if (!ctx.audioWorklet.addModule) {
    return false;
  }
  return true;
};



export default {
  init,
  isInitialized,
  connect,
  isConnected,
  disconnect,
  enable,
  isEnabled,
  disable,
  destroy,
  setLogging,
  isSupported,
};

