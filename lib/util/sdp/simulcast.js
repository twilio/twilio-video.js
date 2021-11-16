'use strict';

const { difference, flatMap } = require('../');

/**
 * Create a random {@link SSRC}.
 * @returns {SSRC}
 */
function createSSRC() {
  const ssrcMax = 0xffffffff;
  return String(Math.floor(Math.random() * ssrcMax));
}

/**
 * @property {string} cName
 * @property {boolean} isSimulcastEnabled
 * @property {Map<RtxSSRC, PrimarySSRC>} rtxPairs
 * @property {Set<PrimarySSRC>} primarySSRCs
 * @property {string} streamId
 * @property {Track.ID} trackId
 */
class TrackAttributes {
  /**
   * Construct a {@link MediaStreamTrack} attribute store.
   * @param {Track.ID} trackId - The MediaStreamTrack ID
   * @param {MediaStreamID} streamId - The MediaStream ID
   * @param {string} cName - The MediaStream cname
   */
  constructor(trackId, streamId, cName) {
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
  addSimulcastSSRCs() {
    if (this.isSimulcastEnabled) {
      return;
    }
    const simulcastSSRCs = [createSSRC(), createSSRC()];
    simulcastSSRCs.forEach(function(ssrc) {
      this.primarySSRCs.add(ssrc);
    }, this);

    if (this.rtxPairs.size) {
      simulcastSSRCs.forEach(function(ssrc) {
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
  addSSRC(ssrc, primarySSRC, isSimSSRC) {
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
  toSdpLines(excludeRtx) {
    const rtxPairs = excludeRtx
      ? []
      : Array.from(this.rtxPairs.entries()).map(rtxPair => rtxPair.reverse());

    const simSSRCs = Array.from(this.primarySSRCs.values());
    const ssrcs = rtxPairs.length ? flatMap(rtxPairs) : simSSRCs;

    const attrLines = flatMap(ssrcs, ssrc => [
      `a=ssrc:${ssrc} cname:${this.cName}`,
      `a=ssrc:${ssrc} msid:${this.streamId} ${this.trackId}`
    ]);
    const rtxPairLines = rtxPairs.map(rtxPair => `a=ssrc-group:FID ${rtxPair.join(' ')}`);
    const simGroupLines = [
      `a=ssrc-group:SIM ${simSSRCs.join(' ')}`
    ];

    return rtxPairLines.concat(attrLines).concat(simGroupLines);
  }
}

/**
 * Get the matches for a given RegEx pattern.
 * @param {string} section - SDP media section
 * @param {string} pattern - RegEx pattern
 * @returns {Array<Array<string>>} - Array of pattern matches
 */
function getMatches(section, pattern) {
  const matches = section.match(new RegExp(pattern, 'gm')) || [];
  return matches.map(match => {
    const matches = match.match(new RegExp(pattern)) || [];
    return matches.slice(1);
  });
}

/**
 * Get the {@link SimSSRC}s that belong to a simulcast group.
 * @param {string} section - SDP media section
 * @returns {Set<SimSSRC>} Set of simulcast {@link SSRC}s
 */
function getSimulcastSSRCs(section) {
  const simGroupPattern = '^a=ssrc-group:SIM ([0-9]+) ([0-9]+) ([0-9]+)$';
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
  const pattern = `a=ssrc:${ssrc} ${attribute}:(.+)`;
  return section.match(new RegExp(pattern))[1];
}

/**
 * Create a Map of {@link PrimarySSRC}s and their {@link RtxSSRC}s.
 * @param {string} section - SDP media section
 * @returns {Map<RtxSSRC, PrimarySSRC>} - Map of {@link RtxSSRC}s and their
 *   corresponding {@link PrimarySSRC}s
 */
function getSSRCRtxPairs(section) {
  const rtxPairPattern = '^a=ssrc-group:FID ([0-9]+) ([0-9]+)$';
  return new Map(getMatches(section, rtxPairPattern).map(pair => pair.reverse()));
}

/**
 * Create SSRC attribute tuples.
 * @param {string} section
 * @returns {Array<[SSRC, MediaStreamID, Track.ID]>}
 */
function createSSRCAttributeTuples(section) {
  const [streamId, trackId] = flatMap(getMatches(section, '^a=msid:(.+) (.+)$'));
  const ssrcs = flatMap(getMatches(section, '^a=ssrc:(.+) cname:.+$'));
  return ssrcs.map(ssrc => [ssrc, streamId, trackId]);
}

/**
 * Create a Map of MediaStreamTrack IDs and their {@link TrackAttributes}.
 * @param {string} section - SDP media section
 * @returns {Map<Track.ID, TrackAttributes>}
 */
function createTrackIdsToAttributes(section) {
  const simSSRCs = getSimulcastSSRCs(section);
  const rtxPairs = getSSRCRtxPairs(section);
  const ssrcAttrTuples = createSSRCAttributeTuples(section);

  return ssrcAttrTuples.reduce((trackIdsToSSRCs, tuple) => {
    const ssrc = tuple[0];
    const streamId = tuple[1];
    const trackId = tuple[2];

    const trackAttributes = trackIdsToSSRCs.get(trackId) || new TrackAttributes(
      trackId,
      streamId,
      getSSRCAttribute(section, ssrc, 'cname'));

    const primarySSRC = rtxPairs.get(ssrc) || null;
    trackAttributes.addSSRC(ssrc, primarySSRC, simSSRCs.has(ssrc));
    return trackIdsToSSRCs.set(trackId, trackAttributes);
  }, new Map());
}

/**
 * Apply simulcast settings to the given SDP media section.
 * @param {string} section - SDP media section
 * @param {Map<Track.ID, TrackAttributes>} trackIdsToAttributes - Existing
 *   map which will be updated for new MediaStreamTrack IDs
 * @returns {string} - The transformed SDP media section
 */
function setSimulcastInMediaSection(section, trackIdsToAttributes) {
  const newTrackIdsToAttributes = createTrackIdsToAttributes(section);
  const newTrackIds = Array.from(newTrackIdsToAttributes.keys());
  let trackIds = Array.from(trackIdsToAttributes.keys());
  const trackIdsToAdd = difference(newTrackIds, trackIds);
  const trackIdsToIgnore = difference(trackIds, newTrackIds);

  // Update "trackIdsToAttributes" with TrackAttributes for new
  // MediaStreamTrack IDs.
  const trackAttributesToAdd = flatMap(trackIdsToAdd, trackId => newTrackIdsToAttributes.get(trackId));
  trackAttributesToAdd.forEach(trackAttributes => {
    trackAttributes.addSimulcastSSRCs();
    trackIdsToAttributes.set(trackAttributes.trackId, trackAttributes);
  });

  // Get the SDP lines of the relevant MediaStreamTrack IDs from
  // "trackIdsToAttributes".
  trackIds = Array.from(trackIdsToAttributes.keys());
  const relevantTrackIds = difference(trackIds, trackIdsToIgnore);
  const relevantTrackAttributes = flatMap(relevantTrackIds, trackId => trackIdsToAttributes.get(trackId));
  const excludeRtx = !section.match(/a=rtpmap:[0-9]+ rtx/);
  const relevantSdpLines = flatMap(relevantTrackAttributes, trackAttributes => trackAttributes.toSdpLines(excludeRtx));

  // Add the simulcast SSRC SDP lines to the media section. The Set ensures
  // that the duplicates of the SSRC SDP lines that are in both "section" and
  // "relevantSdpLines" are removed.
  const sectionLines = flatMap(new Set(section.split('\r\n').concat(relevantSdpLines)));

  const xGoogleFlagConference = 'a=x-google-flag:conference';
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
