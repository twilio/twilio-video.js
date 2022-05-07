
/**
 * Expose `Backoff`.
 */

module.exports = Backoff;

/**
  * Initialize backoff timer with `opts`.
  *
  * - `min` initial timeout in milliseconds [100]
  * - `max` max timeout [10000]
  * - `jitter` [0]
  * - `factor` [2]
  *
  * @param {Object} opts
  * @api public
  */

function Backoff(opts) {
  opts = opts || {};
  this.ms = opts.min || 100;
  this.max = opts.max || 10000;
  this.factor = opts.factor || 2;
  this.jitter = opts.jitter > 0 && opts.jitter <= 1 ? opts.jitter : 0;
  this.attempts = 0;
  this._timeoutID = -1;
}

/**
  * Start the backoff operation.
  *
  * @return {void}
  * @api public
  */

Backoff.prototype.start = function(handler) {
  this._timeoutID = setTimeout(handler, this.duration());
};

/**
  * Return the backoff duration.
  *
  * @return {Number}
  * @api public
  */

Backoff.prototype.duration = function() {
  var ms = this.ms * Math.pow(this.factor, this.attempts++);
  if (this.jitter) {
    var rand =  Math.random();
    var deviation = Math.floor(rand * this.jitter * ms);
    ms = (Math.floor(rand * 10) & 1) === 0  ? ms - deviation : ms + deviation;
  }
  return Math.min(ms, this.max) | 0;
};

/**
  * Reset the number of attempts.
  *
  * @api public
  */

Backoff.prototype.reset = function() {
  this.attempts = 0;
  clearTimeout(this.timeoutID_);
  this._timeoutID = -1;
};
