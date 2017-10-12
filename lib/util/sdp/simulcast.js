'use strict';

var flatMap = require('../').flatMap;

/**
 * Create a random SSRC.
 * @returns {string}
 */
function createSSRC() {
  var ssrcMax = 0xffffffff;
  return String(Math.floor(Math.random() * ssrcMax));
}

/**
 * Construct a {@link MediaStreamTrack} attribute store.
 * @class
 * @param {string} trackId - The MediaStreamTrack ID
 * @param {string} msid - The MediaStream ID
 * @param {string} cname - The MediaStream cname
 * @param {Array<string>} primarySSRCs - The primary SSRCs of the MediaStreamTrack
 * @param {Array<string>} rtxSSRCs - The retransmission SSRCs of the MediaStreamTrack
 */
function TrackAttributes(trackId, msid, cname, primarySSRCs, rtxSSRCs) {
  Object.defineProperties(this, {
    _ssrcFlowPairs: {
      value: new Map(rtxSSRCs.map(function(ssrc, i) {
        return [primarySSRCs[i], ssrc];
      }))
    },
    cname: {
      enumerable: true,
      value: cname
    },
    msid: {
      enumerable: true,
      value: msid
    },
    ssrcs: {
      enumerable: true,
      value: new Set(primarySSRCs)
    },
    trackId: {
      enumerable: true,
      value: trackId
    }
  });
}

/**
 * Add Simulcast SSRCs to the {@link TrackAttributes}.
 * @returns {void}
 */
TrackAttributes.prototype.addSimulcastSSRCs = function addSimulcastSSRCs() {
  var nSimulcastSSRCs = this.ssrcs.size * 2;
  var simulcastSSRCs = [];

  for (var i = 0; i < nSimulcastSSRCs; i++) {
    simulcastSSRCs.push(createSSRC());
  }
  simulcastSSRCs.forEach(function(ssrc) {
    this.ssrcs.add(ssrc);
    if (this._ssrcFlowPairs.size) {
      this._ssrcFlowPairs.set(ssrc, createSSRC());
    }
  }, this);
};

/**
 * Construct the SDP lines for the {@link TrackAttributes}.
 * @returns {Array<string>} Array of SDP lines
 */
TrackAttributes.prototype.toSdpLines = function toSdpLines() {
  var flowPairs = Array.from(this._ssrcFlowPairs.entries());
  var simSSRCs = Array.from(this.ssrcs.values());
  var ssrcs = flowPairs.length ? flatMap(flowPairs) : simSSRCs;
  var self = this;

  var attrLines = flatMap(ssrcs, function(ssrc) {
    return [
      'a=ssrc:' + ssrc + ' cname:' + self.cname,
      'a=ssrc:' + ssrc + ' msid:' + self.msid + ' ' + self.trackId
    ];
  });

  var flowPairLines = flowPairs.map(function(flowPair) {
    return 'a=ssrc-group:FID ' + flowPair.join(' ');
  });

  var simGroupLines = [
    'a=ssrc-group:SIM ' + simSSRCs.join(' ')
  ];

  return flowPairLines.concat(attrLines)
    .concat(simGroupLines)
    .join('\r\n');
};

/**
 * Get the matches for a given RegEx pattern.
 * @param {string} section - SDP media section
 * @param {string} pattern - RegEx pattern
 * @returns {Array<Array<string>>} Array of pattern matches
 */
function getMatches(section, pattern) {
  var matches = section.match(new RegExp(pattern, 'gm')) || [];
  return matches.map(function(match) {
    var matches = match.match(new RegExp(pattern)) || [];
    return matches.slice(1);
  });
}

/**
 * Get the SSRCs that belong to a simulcast group.
 * @param {string} section - SDP media section
 * @returns {Set<string>} Set of simulcast SSRCs
 */
function getSimulcastSSRCs(section) {
  var simGroupPattern = '^a=ssrc-group:SIM ([0-9]+) ([0-9]+) ([0-9]+)$';
  return new Set(flatMap(getMatches(section, simGroupPattern)));
}

/**
 * Get the value of the given attribute for an SSRC.
 * @param {string} section - SDP media section
 * @param {string} ssrc - SSRC whose attribute's value is to be determinded
 * @param {string} attribute - SSRC attribute name
 * @param {string} SSRC attribute value
 */
function getSSRCAttribute(section, ssrc, attribute) {
  var pattern = 'a=ssrc:' + ssrc + ' ' + attribute + ':([^\\s]+)';
  return section.match(new RegExp(pattern))[1];
}

/**
 * Create a Map of primary SSRCs and their retransmission SSRCs.
 * @param {string} section - SDP media section
 * @returns {Map<string, string>} Map of primary SSRCs and their
 *   retransmission SSRCs
 */
function getSSRCFlowPairs(section) {
  var flowPairPattern = '^a=ssrc-group:FID ([0-9]+) ([0-9]+)$';
  return new Map(getMatches(section, flowPairPattern));
}

/**
 * Build a Map of MediaStreamTrack IDs and their SSRC attributes
 * @param {string} section - SDP media section
 * @returns {Map<Track.ID, {cname: string, msid: string, primarySSRCs: Array<string>, rtxSSRCs: Array<string>, trackId: Track.ID}>}
 */
function getTrackAttributes(section) {
  var ssrcAttrTuples = getMatches(section, '^a=ssrc:([0-9]+) msid:([^\\s]+) ([^\\s]+)$');
  var ssrcFlowPairs = getSSRCFlowPairs(section);

  return ssrcAttrTuples.reduce(function(trackIdsToSSRCs, tuple) {
    var msid = tuple[1];
    var ssrc = tuple[0];
    var trackId = tuple[2];

    var trackInfo = trackIdsToSSRCs.get(trackId) || {
      cname: getSSRCAttribute(section, ssrc, 'cname'),
      msid: msid,
      primarySSRCs: [],
      rtxSSRCs: [],
      trackId: trackId
    };

    trackInfo[ssrcFlowPairs.size === 0 || ssrcFlowPairs.has(ssrc)
      ? 'primarySSRCs' : 'rtxSSRCs'].push(ssrc);

    return trackIdsToSSRCs.set(trackId, trackInfo);
  }, new Map());
}

/**
 * Create a Map of MediaStreamTrack IDs and their {@link TrackAttributes}.
 * @param {string} section - SDP media section
 * @returns {Map<Track.ID, TrackAttributes>}
 */
function createTrackIdsToAttributes(section) {
  var trackAttributes = getTrackAttributes(section);
  return Array.from(trackAttributes.values()).reduce(function(trackIdsToAttributes, attributes) {
    return trackIdsToAttributes.set(attributes.trackId,
      new TrackAttributes(attributes.trackId,
        attributes.msid,
        attributes.cname,
        attributes.primarySSRCs,
        attributes.rtxSSRCs));
  }, new Map());
}

/**
 * Apply simulcast settings to the given SDP media section.
 * @param {string} section - SDP media section
 * @returns {string} The transformed SDP media section
 */
function simulcast(section) {
  var simSSRCs = getSimulcastSSRCs(section);
  var trackIdsToAttributes = createTrackIdsToAttributes(section);

  trackIdsToAttributes.forEach(function(trackAttributes) {
    var trackSSRCs = Array.from(trackAttributes.ssrcs.values());
    var isSimulcastEnabled = trackSSRCs.some(function(ssrc) {
      return simSSRCs.has(ssrc);
    });
    if (!isSimulcastEnabled) {
      trackAttributes.addSimulcastSSRCs();
    }
  });

  return [
    section.split('\r\na=ssrc')[0]
  ].concat(flatMap(trackIdsToAttributes, function(trackAttributes) {
    return trackAttributes.toSdpLines();
  })).join('\r\n') + (/\r\n$/.test(section) ? '\r\n' : '');
}

module.exports = simulcast;
