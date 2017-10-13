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
 * @param {string} streamId - The MediaStream ID
 * @param {string} cName - The MediaStream cname
 * @property {string} cName
 * @property {boolean} isSimulcastEnabled
 * @property {Map<string, string>} rtxPairs
 * @property {Set<string>} primarySSRCs
 * @property {string} streamId
 * @property {string} trackId
 */
function TrackAttributes(trackId, streamId, cName) {
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
 * Add Simulcast SSRCs to the {@link TrackAttributes}.
 * @returns {void}
 */
TrackAttributes.prototype.addSimulcastSSRCs = function addSimulcastSSRCs() {
  if (this.isSimulcastEnabled) {
    return;
  }
  var simulcastSSRCs = [createSSRC(), createSSRC()];
  simulcastSSRCs.forEach(function(ssrc) {
    this.primarySSRCs.add(ssrc);
  }, this);

  if (this.rtxPairs.size) {
    simulcastSSRCs.forEach(function(ssrc) {
      this.rtxPairs.set(createSSRC(), ssrc);
    }, this);
  }
};

/**
 * Construct the SDP lines for the {@link TrackAttributes}.
 * @returns {Array<string>} Array of SDP lines
 */
TrackAttributes.prototype.toSdpLines = function toSdpLines() {
  var rtxPairs = Array.from(this.rtxPairs.entries()).map(function(rtxPair) {
    return rtxPair.reverse();
  });

  var simSSRCs = Array.from(this.primarySSRCs.values());
  var ssrcs = rtxPairs.length ? flatMap(rtxPairs) : simSSRCs;
  var self = this;

  var attrLines = flatMap(ssrcs, function(ssrc) {
    return [
      'a=ssrc:' + ssrc + ' cname:' + self.cName,
      'a=ssrc:' + ssrc + ' msid:' + self.streamId + ' ' + self.trackId
    ];
  });

  var rtxPairLines = rtxPairs.map(function(rtxPair) {
    return 'a=ssrc-group:FID ' + rtxPair.join(' ');
  });

  var simGroupLines = [
    'a=ssrc-group:SIM ' + simSSRCs.join(' ')
  ];

  return rtxPairLines.concat(attrLines)
    .concat(simGroupLines)
    .join('\r\n');
};

/**
 * Get the matches for a given RegEx pattern.
 * @param {string} section - SDP media section
 * @param {string} pattern - RegEx pattern
 * @returns {Array<Array<string>>} - Array of pattern matches
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
 * @param {string} - SSRC attribute value
 */
function getSSRCAttribute(section, ssrc, attribute) {
  var pattern = 'a=ssrc:' + ssrc + ' ' + attribute + ':(.+)';
  return section.match(new RegExp(pattern))[1];
}

/**
 * Create a Map of primary SSRCs and their retransmission SSRCs.
 * @param {string} section - SDP media section
 * @returns {Map<string, string>} - Map of retransmission SSRCs and their
 *   primary SSRCs
 */
function getSSRCRtxPairs(section) {
  var rtxPairPattern = '^a=ssrc-group:FID ([0-9]+) ([0-9]+)$';
  return new Map(getMatches(section, rtxPairPattern).map(function(pair) {
    return pair.reverse();
  }));
}

/**
 * Create a Map of MediaStreamTrack IDs and their {@link TrackAttributes}.
 * @param {string} section - SDP media section
 * @returns {Map<Track.ID, TrackAttributes>}
 */
function createTrackIdsToAttributes(section) {
  var simSSRCs = getSimulcastSSRCs(section);
  var ssrcAttrTuples = getMatches(section, '^a=ssrc:([0-9]+) msid:([^\\s]+) ([^\\s]+)$');
  var rtxPairs = getSSRCRtxPairs(section);

  return ssrcAttrTuples.reduce(function(trackIdsToSSRCs, tuple) {
    var ssrc = tuple[0];
    var streamId = tuple[1];
    var trackId = tuple[2];

    var trackAttributes = trackIdsToSSRCs.get(trackId) || new TrackAttributes(
      trackId,
      streamId,
      getSSRCAttribute(section, ssrc, 'cname'));

    if (rtxPairs.has(ssrc)) {
      trackAttributes.rtxPairs.set(ssrc, rtxPairs.get(ssrc));
    } else {
      trackAttributes.primarySSRCs.add(ssrc);
    }
    trackAttributes.isSimulcastEnabled = trackAttributes.isSimulcastEnabled
      || simSSRCs.has(ssrc);
    return trackIdsToSSRCs.set(trackId, trackAttributes);
  }, new Map());
}

/**
 * Apply simulcast settings to the given SDP media section.
 * @param {string} section - SDP media section
 * @returns {string} - The transformed SDP media section
 */
function simulcast(section) {
  var trackIdsToAttributes = createTrackIdsToAttributes(section);
  trackIdsToAttributes.forEach(function(trackAttributes) {
    trackAttributes.addSimulcastSSRCs();
  });

  return [
    section.split('\r\na=ssrc')[0]
  ].concat(flatMap(trackIdsToAttributes, function(trackAttributes) {
    return trackAttributes.toSdpLines();
  })).join('\r\n') + (/\r\n$/.test(section) ? '\r\n' : '');
}

module.exports = simulcast;
