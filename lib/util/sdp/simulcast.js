'use strict';

var flatMap = require('../').flatMap;

/**
 * Create a random SSRC.
 * @returns {string}
 */
function createSSRC() {
  var ssrcLow = 0;
  var ssrcHigh = 0xffffffff;
  return String(ssrcLow + Math.floor(Math.random() * (ssrcHigh - ssrcLow)));
}

/**
 * Construct a {@link MediaStreamTrack} attribute store.
 * @class
 * @param {string} trackId - The MediaStreamTrack ID
 * @param {string} msid - The MediaStream ID
 * @param {Map<string, string>} ssrcFlowPairs - A Map which associates an SSRC
 *   with a retransmission SSRC
 */
function TrackAttributes(trackId, msid, ssrcFlowPairs) {
  Object.defineProperties(this, {
    _ssrcFlowPairs: {
      value: ssrcFlowPairs
    },
    cname: {
      value: null,
      writable: true
    },
    label: {
      value: null,
      writable: true
    },
    msid: {
      value: msid,
      writable: true
    },
    mslabel: {
      value: null,
      writable: true
    },
    ssrcs: {
      enumerable: true,
      value: new Set()
    },
    trackId: {
      enumerable: true,
      value: trackId
    }
  });
}

/**
 * Add Simulcast SSRCs to the {@link TrackAttributes}.
 */
TrackAttributes.prototype.addSimulcastSSRCs = function addSimulcastSSRCs() {
  var hasRtxSSRC = Array.from(this.ssrcs.values()).some(function(ssrc) {
    return this._ssrcFlowPairs.has(ssrc);
  }, this);

  var nSSRCs = this.ssrcs.size << 1;
  for (var i = 0; i < nSSRCs; i++) {
    this.ssrcs.add(createSSRC());
  }

  // If a retransmission SSRC exists for the MediaStreamTrack ID, then update
  // the SSRC Flow Pair Map with the Simulcast SSRCs.
  if (hasRtxSSRC) {
    var ssrcs = Array.from(this.ssrcs.values());
    for (i = 2; i < ssrcs.length; i += 2) {
      this._ssrcFlowPairs.set(ssrcs[i], ssrcs[i + 1]);
    }
  }
};

/**
 * Construct the SDP lines for the {@link TrackAttributes}.
 * @returns {Array<string>}
 */
TrackAttributes.prototype.toSdpLines = function toSdpLines() {
  var self = this;
  var ssrcs = Array.from(this.ssrcs.values());
  var simSSRCs = [];

  // If there are no retransmission SSRCs for this MediaStreamTrack, then
  // "ssrcs" will have only the 3 Simulcast SSRCs. Otherwise, "ssrcs" will
  // have 6 SSRCs, and so "ssrcs[0/2/4]" are selected as the Simulcast SSRCs.
  var delta = Math.floor(ssrcs.length / 3);
  for (var i = 0; i < ssrcs.length; i += delta) {
    simSSRCs.push(ssrcs[i]);
  }

  return flatMap(ssrcs, function(ssrc) {
    return [
      'a=ssrc:' + ssrc + ' cname:' + self.cname,
      'a=ssrc:' + ssrc + ' msid:' + self.msid + ' ' + self.trackId,
      'a=ssrc:' + ssrc + ' mslabel:' + self.mslabel,
      'a=ssrc:' + ssrc + ' label:' + self.label
    ];
  }).concat([
    'a=ssrc-group:SIM ' + simSSRCs.join(' ')
  ]);
};

/**
 * Create the SSRC Flow Pairs for the given SDP media section.
 * @param {string} section
 * @returns {Map<string, string>} A Map which associates an SSRC
 *   with a retransmission SSRC
 */
function createSSRCFlowPairs(section) {
  var ssrcFlowPattern = '^a=ssrc-group:FID (.*)$';
  var ssrcFlowMatches = section.match(new RegExp(ssrcFlowPattern, 'gm')) || [];
  return ssrcFlowMatches.reduce(function(ssrcFlowPairs, aLine) {
    var ssrcs = aLine.match(new RegExp(ssrcFlowPattern))[1].split(' ');
    ssrcFlowPairs.set(ssrcs[0], ssrcs[1]);
    return ssrcFlowPairs;
  }, new Map());
}

/**
 * Create a Map of MediaStreamTrack IDs and their {@link TrackAttributes}.
 * @param {string} section - SDP media section
 * @param {Map<string, string>} ssrcFlowPairs
 * @returns {Map<Track.ID, TrackAttributes>}
 */
function createTrackIdsToAttributes(section, ssrcFlowPairs) {
  var ssrcToTrackIdPattern = '^a=ssrc:([0-9]+) msid:([^\\s]+) ([^\\s]+)$';
  var ssrcToTrackIdRegex = new RegExp(ssrcToTrackIdPattern, 'gm');
  var ssrcToTrackIdMatches = section.match(ssrcToTrackIdRegex) || [];

  return ssrcToTrackIdMatches.reduce(function(trackIdsToAttributes, aLine) {
    var ssrcAndIds = aLine.match(new RegExp(ssrcToTrackIdPattern));
    var ssrc = ssrcAndIds[1];
    var msid = ssrcAndIds[2];
    var trackId = ssrcAndIds[3];

    var trackAttributes = trackIdsToAttributes.get(trackId)
      || new TrackAttributes(trackId, msid, ssrcFlowPairs);
    trackAttributes.ssrcs.add(ssrc);

    ['cname', 'mslabel', 'label'].forEach(function(attribute) {
      var pattern = 'a=ssrc:' + ssrc + ' ' + attribute + ':([^\r\n]+)';
      var matches = section.match(new RegExp(pattern));
      trackAttributes[attribute] = matches[1];
    });

    trackIdsToAttributes.set(trackId, trackAttributes);
    return trackIdsToAttributes;
  }, new Map());
}

/**
 * Apply simulcast settings to the given SDP media section.
 * @param {string} section
 * @returns {string} The transformed SDP media section
 */
function simulcast(section) {
  var ssrcFlowPairs = createSSRCFlowPairs(section);
  var trackIdsToAttributes = createTrackIdsToAttributes(section, ssrcFlowPairs);

  trackIdsToAttributes.forEach(function(trackAttribute) {
    trackAttribute.addSimulcastSSRCs();
  });

  return [
    section.split('\r\na=ssrc')[0]
  ].concat(Array.from(ssrcFlowPairs.keys()).map(function(ssrc) {
    return 'a=ssrc-group:FID ' + ssrc + ' ' + ssrcFlowPairs.get(ssrc);
  })).concat(flatMap(trackIdsToAttributes, function(trackAttribute) {
    return trackAttribute.toSdpLines();
  })).join('\r\n');
}

module.exports = simulcast;
