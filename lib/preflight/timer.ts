import type { TimeMeasurement } from '../../tsdef/PreflightTypes';

export class Timer {
  // eslint-disable-next-line no-undefined
  private _end: number | undefined = undefined;
  private _start: number;

  constructor() {
    this.start();
  }

  start() : this {
    this._start = Date.now();
    return this;
  }

  stop(): this {
    this._end = Date.now();
    return this;
  }

  getTimeMeasurement() : TimeMeasurement {
    return {
      start: this._start,
      end: this._end,
      // eslint-disable-next-line no-undefined
      duration: this._end === undefined ? undefined : this._end - this._start
    };
  }
}
