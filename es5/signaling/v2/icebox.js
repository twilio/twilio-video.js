'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Filter = require('../../util/filter');

/**
 * An {@link IceBox} stores trickled ICE candidates. Candidates added to the
 * {@link IceBox} via {@link IceBox#update} are compared against previously
 * trickled candidates and only new candidates will be returned (assuming they
 * match the current ICE username fragment set by {@link IceBox#setUfrag}).
 * @property {?string} ufrag
 */

var IceBox = function () {
  /**
   * Construct an {@link IceBox}.
   */
  function IceBox() {
    _classCallCheck(this, IceBox);

    Object.defineProperties(this, {
      _filter: {
        value: new Filter({
          getKey: function getKey(iceState) {
            return iceState.ufrag;
          },
          isLessThanOrEqualTo: function isLessThanOrEqualTo(a, b) {
            return a.revision <= b.revision;
          }
        })
      },
      _ufrag: {
        writable: true,
        value: null
      },
      ufrag: {
        enumerable: true,
        get: function get() {
          return this._ufrag;
        }
      }
    });
  }

  /**
   * Set the ICE username fragment on the {@link IceBox}. This method returns any
   * ICE candidates associated with the username fragment.
   * @param {string} ufrag
   * @returns {Array<RTCIceCandidateInit>}
   */


  _createClass(IceBox, [{
    key: 'setUfrag',
    value: function setUfrag(ufrag) {
      this._ufrag = ufrag;
      var ice = this._filter.toMap().get(ufrag);
      return ice ? ice.candidates : [];
    }

    /**
     * Update the {@link IceBox}. This method returns any new ICE candidates
     * associated with the current username fragment.
     * @param {object} iceState
     * @returns {Array<RTCIceCandidateInit>}
     */

  }, {
    key: 'update',
    value: function update(iceState) {
      // NOTE(mroberts): The Server sometimes does not set the candidates property.
      iceState.candidates = iceState.candidates || [];
      var oldIceState = this._filter.toMap().get(iceState.ufrag);
      var oldCandidates = oldIceState ? oldIceState.candidates : [];
      return this._filter.update(iceState) && this._ufrag === iceState.ufrag ? iceState.candidates.slice(oldCandidates.length) : [];
    }
  }]);

  return IceBox;
}();

module.exports = IceBox;