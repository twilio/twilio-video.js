'use strict';

class Pipeline {
  constructor() {
    this._stages = [];
  }

  addStage(stage) {
    this._stages.push(stage);
  }

  render() {
    this._stages.forEach(
      stage => stage.render()
    );
  }
}

module.exports = Pipeline;
