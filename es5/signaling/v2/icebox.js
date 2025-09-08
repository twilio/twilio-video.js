'use strict';
var Filter = require('../../util/filter');
/**
 * An {@link IceBox} stores trickled ICE candidates. Candidates added to the
 * {@link IceBox} via {@link IceBox#update} are compared against previously
 * trickled candidates and only new candidates will be returned (assuming they
 * match the current ICE username fragment set by {@link IceBox#setUfrag}).
 * @property {?string} ufrag
 */
var IceBox = /** @class */ (function () {
    /**
     * Construct an {@link IceBox}.
     */
    function IceBox() {
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
                get: function () {
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
    IceBox.prototype.setUfrag = function (ufrag) {
        this._ufrag = ufrag;
        var ice = this._filter.toMap().get(ufrag);
        return ice ? ice.candidates : [];
    };
    /**
     * Update the {@link IceBox}. This method returns any new ICE candidates
     * associated with the current username fragment.
     * @param {object} iceState
     * @returns {Array<RTCIceCandidateInit>}
     */
    IceBox.prototype.update = function (iceState) {
        // NOTE(mroberts): The Server sometimes does not set the candidates property.
        iceState.candidates = iceState.candidates || [];
        var oldIceState = this._filter.toMap().get(iceState.ufrag);
        var oldCandidates = oldIceState ? oldIceState.candidates : [];
        return this._filter.update(iceState) && this._ufrag === iceState.ufrag
            ? iceState.candidates.slice(oldCandidates.length)
            : [];
    };
    return IceBox;
}());
module.exports = IceBox;
//# sourceMappingURL=icebox.js.map