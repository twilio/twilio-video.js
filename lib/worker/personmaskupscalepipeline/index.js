'use strict';

const SinglePassBilateralFilterStage = require('./singlepassbilateralfilterstage');
const {
  WebGL2Pipeline,
  WebGL2PipelineInputStage
} = require('../webgl2pipeline');

class PersonMaskUpscalePipeline extends WebGL2Pipeline {
  constructor(inputDimensions, outputCanvas) {
    super();
    const glOut = outputCanvas.getContext('webgl2');

    const outputDimensions = {
      height: outputCanvas.height,
      width: outputCanvas.width
    };

    this.addStage(new WebGL2PipelineInputStage(glOut));

    this.addStage(new SinglePassBilateralFilterStage(
      glOut,
      'horizontal',
      'texture',
      inputDimensions,
      outputDimensions,
      1,
      2
    ));

    this.addStage(new SinglePassBilateralFilterStage(
      glOut,
      'vertical',
      'canvas',
      inputDimensions,
      outputDimensions,
      2
    ));
  }

  render(inputFrame) {
    const [
      inputStage,
      ...processingStages
    ] = this._stages;
    inputStage.render(inputFrame);
    processingStages.forEach(
      stage => stage.render()
    );
  }

  updateBilateralFilterConfig(config) {
    const [, ...bilateralFilterStages] = this._stages;
    const { sigmaSpace } = config;
    if (typeof sigmaSpace === 'number') {
      bilateralFilterStages.forEach(stage => {
        stage.updateSigmaColor(0.1);
        stage.updateSigmaSpace(sigmaSpace);
      });
    }
  }
}

module.exports = PersonMaskUpscalePipeline;
