/* eslint-disable no-console */
'use strict';
console.log('makarand: loading rnnoise_processor.js');
let rnnoiseExports = null;
let heapFloat32;
let processCount = 0;
class RNNNoiseProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super(Object.assign(Object.assign({}, options), { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] }));
    if (!rnnoiseExports) {
      rnnoiseExports = new WebAssembly.Instance(options.processorOptions.module).exports;
      heapFloat32 = new Float32Array(rnnoiseExports.memory.buffer);
    }
    // enable
    // disable
    // destroy
    // enableLogging
    // disableLogging
    this.logging = true;
    this.keepAlive = true;
    if (options.processorOptions.activeInitially) {
      this.log('activeInitially');
      this.state = rnnoiseExports.newState();
    } else {
      this.log('NOT activeInitially');
      this.state = null;
    }

    this.port.onmessage = ({ data: command }) => {
      let vadProb = 0;
      this.log('handling command: ', command);
      switch (command) {
        case 'enable':
          if (!this.state) {
            this.state = rnnoiseExports.newState();
          }
          vadProb = rnnoiseExports.getVadProb(this.state);
          break;
        case 'disable':
          if (this.state) {
            rnnoiseExports.deleteState(this.state);
            this.state = null;
          }
          break;
        case 'destroy':
          if (this.state) {
            rnnoiseExports.deleteState(this.state);
            this.state = null;
          }
          this.keepAlive = false;
          break;
        case 'enableLogging':
          this.logging = true;
          this.log('logging Enabled');
          break;
        case 'disableLogging':
          this.log('Will disable logging');
          this.logging = false;
          break;
        default:
          // eslint-disable-next-line no-console
          console.warn('unknown command: ', command);
      }
      if (command === 'enable' && this.state === null) {
        this.log('processor creating state again');
        this.state = rnnoiseExports.newState();
      }
      this.port.postMessage({
        vadProb,
        isEnabled: this.state !== null,
        isAlive: this.keepAlive
      });
    };
  }

  log(...messages) {
    if (this.logging) {
      // eslint-disable-next-line no-console
      console.log('rnnoise_processor:', ...messages);
    }
  }

  process(inputs, outputs, parameters) {
    if (this.state && inputs && inputs.length > 0 && inputs[0].length > 0) {
      heapFloat32.set(inputs[0][0], rnnoiseExports.getInput(this.state) / 4);
      const o = outputs[0][0];
      const ptr4 = rnnoiseExports.pipe(this.state, o.length) / 4;
      if (ptr4) {
        o.set(heapFloat32.subarray(ptr4, ptr4 + o.length));
      }
    } else {
      // rnnoise is turned off.
      // eslint-disable-next-line no-lonely-if
      if (inputs && inputs.length > 0 && inputs[0].length > 0) {
        outputs[0][0].set(inputs[0][0]);
      }
    }
    processCount++;
    if (processCount % 1111 === 0) {
      this.log(`${processCount}: RNNoise ${this.state ? 'enabled' : 'disabled'}`);
    }
    return this.keepAlive;
  }
}
console.log('makarand registering rnnoise processor: start');
registerProcessor('rnnoise', RNNNoiseProcessor);
console.log('makarand registering rnnoise processor: end');
