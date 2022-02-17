/* globals webkitAudioContext, AudioContext */
'use strict';
var NativeAudioContext = typeof AudioContext !== 'undefined'
    ? AudioContext
    : typeof webkitAudioContext !== 'undefined'
        ? webkitAudioContext
        : null;
/**
 * @interface AudioContextFactoryOptions
 * @property {AudioContext} [AudioContext] - The AudioContext constructor
 */
/**
 * {@link AudioContextFactory} ensures we construct at most one AudioContext
 * at a time, and that it is eventually closed when we no longer need it.
 * @property {AudioContextFactory} AudioContextFactory - The
 *   {@link AudioContextFactory} constructor
 */
var AudioContextFactory = /** @class */ (function () {
    /**
     * @param {AudioContextFactoryOptions} [options]
     */
    function AudioContextFactory(options) {
        options = Object.assign({
            AudioContext: NativeAudioContext
        }, options);
        Object.defineProperties(this, {
            _AudioContext: {
                value: options.AudioContext
            },
            _audioContext: {
                value: null,
                writable: true
            },
            _holders: {
                value: new Set()
            },
            AudioContextFactory: {
                enumerable: true,
                value: AudioContextFactory
            }
        });
    }
    /**
     * Each call to {@link AudioContextFactory#getOrCreate} should be paired with a
     * call to {@link AudioContextFactory#release}. Calling this increments an
     * internal reference count.
     * @param {*} holder - The object to hold a reference to the AudioContext
     * @returns {?AudioContext}
     */
    AudioContextFactory.prototype.getOrCreate = function (holder) {
        if (!this._holders.has(holder)) {
            this._holders.add(holder);
            if (this._AudioContext && !this._audioContext) {
                try {
                    this._audioContext = new this._AudioContext();
                }
                catch (error) {
                    // Do nothing;
                }
            }
        }
        return this._audioContext;
    };
    /**
     * Decrement the internal reference count. If it reaches zero, close and destroy
     * the AudioContext.
     * @param {*} holder - The object that held a reference to the AudioContext
     * @returns {void}
     */
    AudioContextFactory.prototype.release = function (holder) {
        if (this._holders.has(holder)) {
            this._holders.delete(holder);
            if (!this._holders.size && this._audioContext) {
                this._audioContext.close();
                this._audioContext = null;
            }
        }
    };
    return AudioContextFactory;
}());
module.exports = new AudioContextFactory();
//# sourceMappingURL=audiocontext.js.map