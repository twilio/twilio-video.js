'use strict';
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
    if (options.processorOptions.activeInitially) {
      console.log('processor activeInitially');
      this.state = rnnoiseExports.newState();
    } else {
      console.log('processor NOT activeInitially');
      this.state = null;
    }
    // enable
    // disable
    // destroy
    // enableLogging
    // disableLogging
    this.port.onmessage = ({ data: keepalive }) => {
      let vadProb = 0;
      if (keepalive) {
        if (this.state === null) {
          console.log('processor creating state again');
          this.state = rnnoiseExports.newState();
        }
        vadProb = rnnoiseExports.getVadProb(this.state);
      } else if (this.state) {
        console.log('processor deleting state');
        rnnoiseExports.deleteState(this.state);
        this.state = null;
      }
      this.port.postMessage({ vadProb, isActive: this.state !== null });
    };
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
      console.log(`${processCount}: RNNoise ${this.state ? 'enabled' : 'disabled'}`);
    }
    return true;
  }
}
registerProcessor('rnnoise', RNNNoiseProcessor);
