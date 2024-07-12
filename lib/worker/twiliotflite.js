/* globals createTwilioTFLiteModule, createTwilioTFLiteSIMDModule, importScripts */

'use strict';

const loadedScripts = new Set();

class TwilioTFLite {
  constructor() {
    this._isSimdEnabled = null;
    this._tflite = null;
  }

  initialize(
    assetsPath,
    modelName,
    moduleLoaderName,
    moduleSimdLoaderName
  ) {
    if (this._tflite) {
      return Promise.resolve();
    }
    return Promise.all([
      this._loadWasmModule(
        assetsPath,
        moduleLoaderName,
        moduleSimdLoaderName,
      ),
      fetch(`${assetsPath}${modelName}`),
    ]).then(
      ([, modelResponse]) =>
        modelResponse.arrayBuffer()
    ).then(model => {
      const { _tflite: tflite } = this;
      const modelBufferOffset = tflite._getModelBufferMemoryOffset();
      tflite.HEAPU8.set(new Uint8Array(model), modelBufferOffset);
      tflite._loadModel(model.byteLength);
    });
  }

  loadInputBuffer(inputBuffer) {
    const { _tflite: tflite } = this;
    const height = tflite._getInputHeight();
    const width = tflite._getInputWidth();
    const pixels = width * height;
    const tfliteInputMemoryOffset = tflite._getInputMemoryOffset() / 4;

    for (let i = 0; i < pixels; i++) {
      const curTFLiteOffset = tfliteInputMemoryOffset + i * 3;
      const curImageBufferOffset = i * 4;
      tflite.HEAPF32[curTFLiteOffset] = inputBuffer[curImageBufferOffset] / 255;
      tflite.HEAPF32[curTFLiteOffset + 1] = inputBuffer[curImageBufferOffset + 1] / 255;
      tflite.HEAPF32[curTFLiteOffset + 2] = inputBuffer[curImageBufferOffset + 2] / 255;
    }
  }

  runInference(outputBuffer) {
    const { _tflite: tflite } = this;
    const height = tflite._getInputHeight();
    const width = tflite._getInputWidth();
    const pixels = width * height;
    const tfliteOutputMemoryOffset = tflite._getOutputMemoryOffset() / 4;

    tflite._runInference();

    for (let i = 0; i < pixels; i++) {
      outputBuffer[i * 4 + 3] = Math.round(tflite.HEAPF32[tfliteOutputMemoryOffset + i] * 255);
    }
  }

  _loadScript(path) {
    if (loadedScripts.has(path)) {
      return;
    }
    importScripts(path);
    loadedScripts.add(path);
  }

  _loadWasmModule(
    assetsPath,
    moduleLoaderName,
    moduleSimdLoaderName
  ) {
    return Promise.resolve().then(() => {
      this._loadScript(`${assetsPath}${moduleSimdLoaderName}`);
      return createTwilioTFLiteSIMDModule();
    }).then(tflite => {
      this._tflite = tflite;
      this._isSimdEnabled = true;
    }).catch(() => {
      this._loadScript(`${assetsPath}${moduleLoaderName}`);
      return createTwilioTFLiteModule().then(tflite => {
        this._tflite = tflite;
        this._isSimdEnabled = false;
      });
    });
  }
}

module.exports = TwilioTFLite;
