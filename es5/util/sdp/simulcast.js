'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var difference = require('../').difference;
var flatMap = require('../').flatMap;

/**
 * Create a random {@link SSRC}.
 * @returns {SSRC}
 */
function createSSRC() {
  var ssrcMax = 0xffffffff;
  return String(Math.floor(Math.random() * ssrcMax));
}

/**
 * @property {string} cName
 * @property {boolean} isSimulcastEnabled
 * @property {Map<RtxSSRC, PrimarySSRC>} rtxPairs
 * @property {Set<PrimarySSRC>} primarySSRCs
 * @property {MediaStreamID} streamId
 * @property {Track.ID} trackId
 */

var TrackAttributes = function () {
  /**
   * Construct a {@link MediaStreamTrack} attribute store.
   * @param {Track.ID} trackId - The MediaStreamTrack ID
   * @param {MediaStreamID} streamId - The MediaStream ID
   * @param {string} cName - The MediaStream cname
   */
  function TrackAttributes(trackId, streamId, cName) {
    _classCallCheck(this, TrackAttributes);

    Object.defineProperties(this, {
      cName: {
        enumerable: true,
        value: cName
      },
      isSimulcastEnabled: {
        enumerable: true,
        value: false,
        writable: true
      },
      primarySSRCs: {
        enumerable: true,
        value: new Set()
      },
      rtxPairs: {
        enumerable: true,
        value: new Map()
      },
      streamId: {
        enumerable: true,
        value: streamId
      },
      trackId: {
        enumerable: true,
        value: trackId
      }
    });
  }

  /**
   * Add {@link SimSSRC}s to the {@link TrackAttributes}.
   * @returns {void}
   */


  _createClass(TrackAttributes, [{
    key: 'addSimulcastSSRCs',
    value: function addSimulcastSSRCs() {
      if (this.isSimulcastEnabled) {
        return;
      }
      var simulcastSSRCs = [createSSRC(), createSSRC()];
      simulcastSSRCs.forEach(function (ssrc) {
        this.primarySSRCs.add(ssrc);
      }, this);

      if (this.rtxPairs.size) {
        simulcastSSRCs.forEach(function (ssrc) {
          this.rtxPairs.set(createSSRC(), ssrc);
        }, this);
      }
    }

    /**
     * Add the given {@link PrimarySSRC} or {@link RtxSSRC} to the {@link TrackAttributes}
     * and update the "isSimulcastEnabled" flag if it is also a {@link SimSSRC}.
     * @param {SSRC} ssrc - The {@link SSRC} to be added
     * @param {?PrimarySSRC} primarySSRC - The {@link PrimarySSRC}; if the given
     *   {@link SSRC} itself is the {@link PrimarySSRC}, then this is set to null
     * @param {boolean} isSimSSRC - true if the given {@link SSRC} is a
     *   {@link SimSSRC}; false otherwise
     * @returns {void}
     */

  }, {
    key: 'addSSRC',
    value: function addSSRC(ssrc, primarySSRC, isSimSSRC) {
      if (primarySSRC) {
        this.rtxPairs.set(ssrc, primarySSRC);
      } else {
        this.primarySSRCs.add(ssrc);
      }
      this.isSimulcastEnabled = this.isSimulcastEnabled || isSimSSRC;
    }

    /**
     * Construct the SDP lines for the {@link TrackAttributes}.
     * @param {boolean} [excludeRtx=false]
     * @returns {Array<string>} Array of SDP lines
     */

  }, {
    key: 'toSdpLines',
    value: function toSdpLines(excludeRtx) {
      var _this = this;

      var rtxPairs = excludeRtx ? [] : Array.from(this.rtxPairs.entries()).map(function (rtxPair) {
        return rtxPair.reverse();
      });

      var simSSRCs = Array.from(this.primarySSRCs.values());
      var ssrcs = rtxPairs.length ? flatMap(rtxPairs) : simSSRCs;

      var attrLines = flatMap(ssrcs, function (ssrc) {
        return ['a=ssrc:' + ssrc + ' cname:' + _this.cName, 'a=ssrc:' + ssrc + ' msid:' + _this.streamId + ' ' + _this.trackId];
      });
      var rtxPairLines = rtxPairs.map(function (rtxPair) {
        return 'a=ssrc-group:FID ' + rtxPair.join(' ');
      });
      var simGroupLines = ['a=ssrc-group:SIM ' + simSSRCs.join(' ')];

      return rtxPairLines.concat(attrLines).concat(simGroupLines);
    }
  }]);

  return TrackAttributes;
}();

/**
 * Get the matches for a given RegEx pattern.
 * @param {string} section - SDP media section
 * @param {string} pattern - RegEx pattern
 * @returns {Array<Array<string>>} - Array of pattern matches
 */


function getMatches(section, pattern) {
  var matches = section.match(new RegExp(pattern, 'gm')) || [];
  return matches.map(function (match) {
    var matches = match.match(new RegExp(pattern)) || [];
    return matches.slice(1);
  });
}

/**
 * Get the {@link SimSSRC}s that belong to a simulcast group.
 * @param {string} section - SDP media section
 * @returns {Set<SimSSRC>} Set of simulcast {@link SSRC}s
 */
function getSimulcastSSRCs(section) {
  var simGroupPattern = '^a=ssrc-group:SIM ([0-9]+) ([0-9]+) ([0-9]+)$';
  return new Set(flatMap(getMatches(section, simGroupPattern)));
}

/**
 * Get the value of the given attribute for an SSRC.
 * @param {string} section - SDP media section
 * @param {SSRC} ssrc - {@link SSRC} whose attribute's value is to be determinded
 * @param {string} attribute - {@link SSRC} attribute name
 * @param {string} - {@link SSRC} attribute value
 */
function getSSRCAttribute(section, ssrc, attribute) {
  var pattern = 'a=ssrc:' + ssrc + ' ' + attribute + ':(.+)';
  return section.match(new RegExp(pattern))[1];
}

/**
 * Create a Map of {@link PrimarySSRC}s and their {@link RtxSSRC}s.
 * @param {string} section - SDP media section
 * @returns {Map<RtxSSRC, PrimarySSRC>} - Map of {@link RtxSSRC}s and their
 *   corresponding {@link PrimarySSRC}s
 */
function getSSRCRtxPairs(section) {
  var rtxPairPattern = '^a=ssrc-group:FID ([0-9]+) ([0-9]+)$';
  return new Map(getMatches(section, rtxPairPattern).map(function (pair) {
    return pair.reverse();
  }));
}

/**
 * Create SSRC attribute tuples.
 * @param {string} section
 * @param {'planb' | 'unified'} sdpFormat
 * @returns {Array<[SSRC, MediaStreamID, Track.ID]>}
 */
function createSSRCAttributeTuples(section, sdpFormat) {
  return {
    planb: createPlanBSSRCAttributeTuples,
    unified: createUnifiedPlanSSRCAttributeTuples
  }[sdpFormat](section);
}
/**
 * Create "plan-b" SSRC attribute tuples.
 * @param {string} section
 * @returns {Array<[SSRC, MediaStreamID, Track.ID]>}
 */
function createPlanBSSRCAttributeTuples(section) {
  return getMatches(section, '^a=ssrc:([0-9]+) msid:([^\\s]+) ([^\\s]+)$');
}
/**
 * Create "unified-plan" SSRC attribute tuples.
 * @param {string} section
 * @returns {Array<[SSRC, MediaStreamID, Track.ID]>}
 */
function createUnifiedPlanSSRCAttributeTuples(section) {
  var _flatMap = flatMap(getMatches(section, '^a=msid:(.+) (.+)$')),
      _flatMap2 = _slicedToArray(_flatMap, 2),
      streamId = _flatMap2[0],
      trackId = _flatMap2[1];

  var ssrcs = flatMap(getMatches(section, '^a=ssrc:(.+) cname:.+$'));
  return ssrcs.map(function (ssrc) {
    return [ssrc, streamId, trackId];
  });
}

/**
 * Create a Map of MediaStreamTrack IDs and their {@link TrackAttributes}.
 * @param {string} section - SDP media section
 * @param {'planb' | 'unified'} sdpFormat
 * @returns {Map<Track.ID, TrackAttributes>}
 */
function createTrackIdsToAttributes(section, sdpFormat) {
  var simSSRCs = getSimulcastSSRCs(section);
  var rtxPairs = getSSRCRtxPairs(section);
  var ssrcAttrTuples = createSSRCAttributeTuples(section, sdpFormat);

  return ssrcAttrTuples.reduce(function (trackIdsToSSRCs, tuple) {
    var ssrc = tuple[0];
    var streamId = tuple[1];
    var trackId = tuple[2];

    var trackAttributes = trackIdsToSSRCs.get(trackId) || new TrackAttributes(trackId, streamId, getSSRCAttribute(section, ssrc, 'cname'));

    var primarySSRC = rtxPairs.get(ssrc) || null;
    trackAttributes.addSSRC(ssrc, primarySSRC, simSSRCs.has(ssrc));
    return trackIdsToSSRCs.set(trackId, trackAttributes);
  }, new Map());
}

/**
 * Apply simulcast settings to the given SDP media section.
 * @param {string} section - SDP media section
 * @param {'planb' | 'unified'} sdpFormat
 * @param {Map<Track.ID, TrackAttributes>} trackIdsToAttributes - Existing
 *   map which will be updated for new MediaStreamTrack IDs
 * @returns {string} - The transformed SDP media section
 */
function setSimulcastInMediaSection(section, sdpFormat, trackIdsToAttributes) {
  var newTrackIdsToAttributes = createTrackIdsToAttributes(section, sdpFormat);
  var newTrackIds = Array.from(newTrackIdsToAttributes.keys());
  var trackIds = Array.from(trackIdsToAttributes.keys());
  var trackIdsToAdd = difference(newTrackIds, trackIds);
  var trackIdsToIgnore = difference(trackIds, newTrackIds);

  // Update "trackIdsToAttributes" with TrackAttributes for new
  // MediaStreamTrack IDs.
  var trackAttributesToAdd = flatMap(trackIdsToAdd, function (trackId) {
    return newTrackIdsToAttributes.get(trackId);
  });
  trackAttributesToAdd.forEach(function (trackAttributes) {
    trackAttributes.addSimulcastSSRCs();
    trackIdsToAttributes.set(trackAttributes.trackId, trackAttributes);
  });

  // Get the SDP lines of the relevant MediaStreamTrack IDs from
  // "trackIdsToAttributes".
  trackIds = Array.from(trackIdsToAttributes.keys());
  var relevantTrackIds = difference(trackIds, trackIdsToIgnore);
  var relevantTrackAttributes = flatMap(relevantTrackIds, function (trackId) {
    return trackIdsToAttributes.get(trackId);
  });
  var excludeRtx = !section.match(/a=rtpmap:[0-9]+ rtx/);
  var relevantSdpLines = flatMap(relevantTrackAttributes, function (trackAttributes) {
    return trackAttributes.toSdpLines(excludeRtx);
  });

  // Add the simulcast SSRC SDP lines to the media section. The Set ensures
  // that the duplicates of the SSRC SDP lines that are in both "section" and
  // "relevantSdpLines" are removed.
  var sectionLines = flatMap(new Set(section.split('\r\n').concat(relevantSdpLines)));

  var xGoogleFlagConference = 'a=x-google-flag:conference';
  if (!section.match(xGoogleFlagConference)) {
    sectionLines.push(xGoogleFlagConference);
  }

  return sectionLines.join('\r\n');
}

/**
 * String representing a MediaStream ID.
 * @typedef {string} MediaStreamID
 */

/**
 * String representing the SSRC of a MediaStreamTrack.
 * @typedef {string} SSRC
 */

/**
 * Primary SSRC.
 * @typedef {SSRC} PrimarySSRC
 */

/**
 * Retransmission SSRC.
 * @typedef {SSRC} RtxSSRC
 */

/**
 * Simulcast SSRC.
 * @typedef {SSRC} SimSSRC
 */

module.exports = setSimulcastInMediaSection;