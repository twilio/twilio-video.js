'use strict';

var Filter = require('../../util/filter');

/**
 * Construct an {@link IceBox}.
 * @class
 * @classdesc An {@link IceBox} stores trickled ICE candidates. Candidates added
 * to the {@link IceBox} via {@link IceBox#update} are compared against
 * previously trickled candidates and only new candidates will be returned
 * (assuming they match the current ICE username fragment set by
 * {@link IceBox#setUsernameFragment}.
 * @property {?string} usernameFragment
 */
function IceBox() {
  if (!(this instanceof IceBox)) {
    return new IceBox();
  }
  Object.defineProperties(this, {
    _filter: {
      value: new Filter({
        getKey: function getKey(iceState) {
          return iceState.usernameFragment;
        },
        isLessThanOrEqualTo: function isLessThanOrEqualTo(a, b) {
          return a.revision <= b.revision;
        }
      })
    },
    _usernameFragment: {
      writable: true,
      value: null
    },
    usernameFragment: {
      enumerable: true,
      get: function() {
        return this._usernameFragment;
      }
    }
  });
}

/**
 * Set the ICE username fragment on the {@link IceBox}. This method returns any
 * ICE candidates associated with the username fragment.
 * @param {string} usernameFragment
 * @returns {Array<RTCIceCandidateInit>}
 */
IceBox.prototype.setUsernameFragment = function setUsernameFragment(usernameFragment) {
  this._usernameFragment = usernameFragment;
  var ice = this._filter.toMap().get(usernameFragment);
  return ice ? ice.candidates : [];
};

/**
 * Update the {@link IceBox}. This method returns any new ICE candidates
 * associated with the current username fragment.
 * @param {object} iceState
 * @returns {Array<RTCIceCandidateInit>}
 */
IceBox.prototype.update = function update(iceState) {
  var oldIceState = this._filter.toMap().get(iceState.usernameFragment);
  var oldCandidates = oldIceState ? oldIceState.candidates : [];
  return this._filter.update(iceState) && this._usernameFragment === iceState.usernameFragment
    ? iceState.candidates.slice(oldCandidates.length)
    : [];
};

module.exports = IceBox;
