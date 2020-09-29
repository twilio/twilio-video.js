'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _require = require('./'),
    defer = _require.defer;

/**
 * This is a pair of Deferreds that are set whenever local media is muted and
 * resolved whenever local media is unmuted/ended and restarted if necessary.
 */


var LocalMediaRestartDeferreds = function () {
  /**
   * Constructor.
   */
  function LocalMediaRestartDeferreds() {
    _classCallCheck(this, LocalMediaRestartDeferreds);

    Object.defineProperties(this, {
      _audio: {
        value: defer(),
        writable: true
      },
      _video: {
        value: defer(),
        writable: true
      }
    });

    // Initially, resolve both the Deferreds.
    this._audio.resolve();
    this._video.resolve();
  }

  /**
   * Resolve the Deferred for audio or video.
   * @param {'audio'|'video'} kind
   */


  _createClass(LocalMediaRestartDeferreds, [{
    key: 'resolveDeferred',
    value: function resolveDeferred(kind) {
      if (kind === 'audio') {
        this._audio.resolve();
      } else {
        this._video.resolve();
      }
    }

    /**
     * Start the Deferred for audio or video.
     * @param {'audio' | 'video'} kind
     */

  }, {
    key: 'startDeferred',
    value: function startDeferred(kind) {
      if (kind === 'audio') {
        this._audio = defer();
      } else {
        this._video = defer();
      }
    }

    /**
     * Wait until the Deferred for audio or video is resolved.
     * @param {'audio'|'video'} kind
     * @returns {Promise<void>}
     */

  }, {
    key: 'whenResolved',
    value: function whenResolved(kind) {
      return kind === 'audio' ? this._audio.promise : this._video.promise;
    }
  }]);

  return LocalMediaRestartDeferreds;
}();

module.exports = new LocalMediaRestartDeferreds();