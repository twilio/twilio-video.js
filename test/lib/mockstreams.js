'use strict';

class ReadableStream {
  constructor({ start }) {
    this._transformStream = null;
    this._writableStream = null;
    setTimeout(() => start({
      enqueue: arg => {
        if (this._transformStream) {
          this._transformStream.transform(arg, {
            enqueue: arg => {
              if (this._writableStream) {
                this._writableStream.write(arg);
              }
            }
          });
        }
      }
    }));
  }

  pipeThrough(transformStream) {
    this._transformStream = transformStream;
    return this;
  }

  pipeTo(writableStream) {
    this._writableStream = writableStream;
    return Promise.resolve();
  }
}

class TransformStream {
  constructor({ transform }) {
    this.transform = transform;
  }
}

class WritableStream {
  constructor() {
    this.write = () => {};
  }
}

function mockStreams(_global) {
  _global = _global || global;
  _global.ReadableStream = ReadableStream;
  _global.TransformStream = TransformStream;
  _global.WritableStream = WritableStream;
  return _global;
}

module.exports = mockStreams;
