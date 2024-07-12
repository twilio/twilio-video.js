'use strict';

class Benchmark {

  // NOTE (mmalavalli): How many timing information to save per benchmark.
  // This is about the amount of timing info generated on a 24fps input.
  // Enough samples to calculate fps.
  static cacheSize = 41;

  constructor() {
    this._timingCache = new Map();
    this._timings = new Map();
  }

  end(name) {
    const timing = this._timings.get(name);
    if (!timing) {
      return;
    }
    timing.end = Date.now();
    timing.delay = timing.end - timing.start;
    this._save(name, { ...timing });
  }

  getAverageDelay(name) {
    const timingCache = this._timingCache.get(name);
    if (!timingCache || !timingCache.length) {
      return 0;
    }
    return timingCache.map(timing => timing.delay)
      .reduce((total, value) => total + value, 0) / timingCache.length;
  }

  getNames() {
    return Array.from(this._timingCache.keys());
  }

  getRate(name) {
    const timingCache = this._timingCache.get(name);
    if (!timingCache || timingCache.length < 2) {
      return 0;
    }
    const totalDelay = timingCache[timingCache.length - 1].end - timingCache[0].start;
    return (timingCache.length / totalDelay) * 1000;
  }

  start(name) {
    let timing = this._timings.get(name);
    if (!timing) {
      timing = {};
      this._timings.set(name, timing);
    }
    timing.start = Date.now();
    delete timing.end;
    delete timing.delay;
  }

  _save(name, timing) {
    let timingCache = this._timingCache.get(name);
    if (!timingCache) {
      timingCache = [];
      this._timingCache.set(name, timingCache);
    }

    timingCache.push(timing);

    if (timingCache.length > Benchmark.cacheSize) {
      timingCache.splice(0, timingCache.length - Benchmark.cacheSize);
    }
  }
}

module.exports = Benchmark;
