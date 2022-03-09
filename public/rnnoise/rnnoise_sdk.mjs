/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable no-console */
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
    this._isActive = false;
    this._isActive = false; // match what we sent in processorOptions.activeInitially.
    console.log('RNNoiseNode constructor');
    this.port.onmessage = ({ data }) => {
      if (data.vadProb) {
        this._vadProb = data.vadProb;
        this._isActive = data.isActive;
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
  getIsActive() {
    return this._isActive;
  }
  update(keepalive) {
    this.port.postMessage(keepalive);
  }
}
RNNoiseNode.webModule = null;
let audioContext = null;
let connected = false;
let rnnoiseNode = null;
let sourceNode = null;
let destinationNode = null;
let inputStream = null;
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export default {
  init: async rnnoiseRootPath => {
    audioContext = new AudioContext({ sampleRate: 48000 });
    const wasmPath = rnnoiseRootPath + '/rnnoise-processor.wasm';
    const processorJSPath = rnnoiseRootPath + '/rnnoise_processor.js';
    console.log({ wasmPath, processorJSPath });
    await RNNoiseNode.register(audioContext, wasmPath, processorJSPath);
  },
  isInitialized: () => !!audioContext,
  connect: stream => {
    if (!audioContext) {
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
    rnnoiseNode.update(true);
    return outputStream;
  },
  isConnected: () => connected,
  disconnect: () => {
    if (connected) {
      rnnoiseNode.update(false);
      rnnoiseNode.disconnect();
      sourceNode.disconnect();
      destinationNode.disconnect();
      inputStream.getTracks().forEach(track => track.stop());
      connected = false;
    }
  },
  enable: () => connected && rnnoiseNode.update(true),
  isEnabled: () => connected && rnnoiseNode.getIsActive(),
  disable: () => connected && rnnoiseNode.update(false),
};

