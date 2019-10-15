/* eslint-disable no-await-in-loop */
'use strict';

const sinon = require('sinon');
const { EventEmitter } = require('events');
const { capitalize } = require('../../lib/util');
const { isSafari } = require('./guessbrowser');
const defaults = require('../lib/defaults');
const getToken = require('../lib/token');
const { createRoom } = require('../lib/rest');
const connect = require('../../lib/connect');
const minute = 1 * 60 * 1000;

function a(word) {
  return word.toLowerCase().match(/^[aeiou]/) ? 'an' : 'a';
}

const audioContext = typeof AudioContext !== 'undefined' && 'createMediaStreamDestination' in AudioContext.prototype
  ? new AudioContext()
  : null;

/**
 * Create a synthetic audio MediaStreamTrack, if possible.
 * @return {?MediaStreamTrack}
 */
function createSyntheticAudioStreamTrack() {
  if (!audioContext) {
    return null;
  }
  const oscillator = audioContext.createOscillator();
  const dest = audioContext.createMediaStreamDestination();
  oscillator.connect(dest);
  oscillator.start(0);
  return dest.stream.getAudioTracks()[0];
}

/**
 * A {@link Tree<X, Y>} is a Rose Tree whose edges are labeled with values of
 * type `X`, and whose nodes are labeled with values of type `Y`.
 * @typedef {Map<X, Pair<Y, Tree<X, Y>>} Tree<X, Y>
 */

/**
 * Reduce a {@link Tree<X, Y>}.
 *
 * This function is like Array's `reduce`, generalized to {@link Tree<X, Y>}s.
 * Given a reducing function, `f`, that combines a value of type `Y` with an
 * Array of values of type `Z`, this function traverses the {@link Tree<X, Y>}
 * in-order, "flattening" the values labeling each node into an Array of values
 * of type `Z`.
 *
 * This function ignores the values of type `X` labeling the edges of the
 * {@link Tree<X, Y>}.
 *
 * This function is adapted from `foldTree` in the Haskell `containers` package.
 * See here: https://hackage.haskell.org/package/containers/docs/Data-Tree.html
 *
 * @param {Tree<X, Y>} tree - the {@link Tree<X, Y>} to reduce
 * @param {function(Y, Array<Z>): Z} f - the reducing functions
 * @param {Y} y - an initial value of type `Y` to reduce
 * @returns {Z} z - the reduced value of type `Z`
 */
function reduce(tree, f, y) {
  /**
   * Reduce a level of a {@link Tree<X, Y>}.
   * @param {Tree<X, Y>} tree
   * @param {function(Y, Array<Z>): Z} f
   * @returns {Array<Z>}
   */
  function reduceLevel(tree, f) {
    // For every node,
    return [...tree.values()].map(([y, subtree]) => {
      // Reduce its subtree;
      const zs = reduceLevel(subtree, f);

      // Then combine the value of type `Y` labeling the node with the Array of
      // values of type `Z` reduced from the subtree.
      return f(y, zs);
    });
  }

  return f(y, reduceLevel(tree, f));
}

/**
 * Insert into a {@link Tree<X, Y>}. If a subtree at X exists, return it;
 * otherwise, create it.
 * @param {Tree<X, Y>} tree
 * @param {X} x
 * @param {Y} y
 * @returns {Tree<X, Y>} subtree
 */
function getOrCreate(tree, x, y) {
  if (!tree.has(x)) {
    tree.set(x, [y, new Map()]);
  }
  return tree.get(x)[1];
}

/**
 * Generate combination `contexts`. This function is useful for testing many
 * different combinations with Mocha.
 *
 * @example
 * combinationContext([
 *   [[1, 2], x => x],
 *   [[3, 4], y => y]
 * ], ([x, y]) => {
 *   it('works', () => {});
 * });
 *
 * //
 * //   1
 * //     3
 * //       ✓ works
 * //     4
 * //       ✓ works
 * //
 * //   2
 * //     3
 * //       ✓ works
 * //     4
 * //       ✓ works
 * //
 * //   4 passing (8ms)
 * //
 *
 * @param {Array<Pair<Array<*>, function(*): string>>} pairs
 * @param {function(Array<*>): void} callback
 * @returns {void}
 */
function combinationContext(pairs, callback) {
  const xss = pairs.map(pair => pair[0]);

  // Build up a Tree, whose edges are labeled with elements of the combinations
  // (or null, if the edge points to a leaf node) and whose nodes are labeled
  // with values of type
  //
  //   function(function(): void): void
  //
  // These values labeling are either `context`s bound to the given description
  // strings, or a function which will invoke the `callback` with a particular
  // `combination`.
  const tree = combinations(xss).reduce((tree, combination) => {
    combination.reduce((tree, x, i) => {
      const description = pairs[i][1](x);

      const subtree = getOrCreate(
        tree,
        x,
        callback => context(description, callback));

      if (i === combination.length - 1) {
        getOrCreate(
          subtree,
          null,
          () => callback(combination));
      }

      return subtree;
    }, tree);

    return tree;
  }, new Map());

  // Now reduce the Tree. At every level, invoke each `callback`'s `children`
  // in order.
  reduce(tree, (callback, children) => () =>
    callback(() => children.forEach(child => child()))
  , callback => callback())();
}

/**
 * Generate combinations by taking the Cartesian product of Arrays.
 * @param {Array<Array<*>>} xss
 * @param {function(X, Y): Z} [combine]
 * @returns {Array<*>} zs
 */
function combinations(xss) {
  return xss.reduce((xs, ys) => {
    return product(xs, ys, (x, y) => x.concat(y));
  }, [[]]);
}

/**
 * Combine every element of an Array with the remaining elements of the Array.
 * The combine function defaults to pairing the element with the remaining
 * elements of the Array.
 * @param {Array<X>} xs
 * @param {function(X, Array<X>): Y} [combine]
 * @returns {Array<Y>} ys
 */
function pairs(xs, combine) {
  combine = combine || ((x, xs) => [x, xs]);
  return xs.reduce((ys, x, i) => {
    const remaining = xs.slice();
    remaining.splice(i, 1);
    return ys.concat([combine(x, remaining)]);
  }, []);
}

/**
 * Take the product of two Arrays. The combine function defaults to Cartesian
 * product.
 * @param {Array<X>} xs
 * @param {Array<Y>} ys
 * @param {function(X, Y): Z} [combine]
 * @returns {Array<Z>} zs
 */
function product(xs, ys, combine) {
  combine = combine || ((x, y) => [x, y]);
  return xs.reduce((zs, x) => {
    return zs.concat(ys.map(y => combine(x, y)));
  }, []);
}

function randomBoolean() {
  return Math.random() < 0.5;
}

function randomName() {
  return Math.random().toString(36).slice(2);
}

/**
 * Wait for the given {@link RemoteParticipant} to become the Dominant Speaker.
 * @param {Room} room
 * @param {RemoteParticipant} participant
 * @return {Promise<void>}
 */
async function dominantSpeakerChanged(room, participant) {
  while (room.dominantSpeaker !== participant) {
    await new Promise(resolve => room.once('dominantSpeakerChanged', resolve));
  }
}

/**
 * Wait for {@link RemoteParticipant}s to connect to a {@link Room}.
 * @param {Room} room - the {@link Room}
 * @param {number} n - the number of {@link RemoteParticipant}s to wait for
 * @returns Promise<void>
 */
async function participantsConnected(room, n) {
  while (room.participants.size < n) {
    await new Promise(resolve => room.once('participantConnected', resolve));
  }
}

/**
 * Wait for {@link RemoteTrack}s of a {@link RemoteParticipant} to be subscribed to.
 * @param {RemoteParticipant} participant - the {@link RemoteParticipant}
 * @param {number} n - the number of {@link RemoteTrack}s to wait for
 * @returns Promise<void>
 */
async function tracksSubscribed(participant, n) {
  while (participant._tracks.size < n) {
    await new Promise(resolve => participant.once('trackSubscribed', resolve));
  }
}

/**
 * Wait for {@link Track}s to be published.
 * @param {Participant} participant - the {@link Participant}
 *   publishing the {@link LocalTrack}s
 * @param {number} n - the number of {@link Track}s to wait for
 * @param {Track.Kind} [kind] - an optional filter for {@link `Track}s of a
 *   particular kind
 * @returns {Promise<void>}
 */
async function tracksPublished(participant, n, kind) {
  const trackPublications = kind ? participant[`${kind}Tracks`] : participant.tracks;
  while (trackPublications.size < n) {
    await new Promise(resolve => {
      function trackPublished(publication) {
        if (kind && publication.kind !== kind) {
          return;
        }
        resolve();
        participant.removeListener('trackPublished', trackPublished);
      }
      participant.on('trackPublished', trackPublished);
    });
  }
}

/**
 * Wait for {@link RemoteTrack}s of a {@link RemoteParticipant} to be unpublished.
 * @param {RemoteParticipant} participant - the {@link RemoteParticipant}
 * @param {number} n - the final number of {@link RemoteTrack}s to count down to
 * @returns Promise<void>
 */
async function tracksUnpublished(participant, n) {
  while (participant.tracks.size > n) {
    await new Promise(resolve => participant.once('trackUnpublished', resolve));
  }
}

/**
 * Wait for {@link RemoteTrack}s of a {@link RemoteParticipant} to be unsubscribed from.
 * @param {RemoteParticipant} participant - the {@link RemoteParticipant}
 * @param {number} n - the final number of {@link RemoteTrack}s to count down to
 * @returns Promise<void>
 */
async function tracksUnsubscribed(participant, n) {
  while (participant._tracks.size > n) {
    await new Promise(resolve => participant.once('trackUnsubscribed', resolve));
  }
}

/**
 * Wait for a {@link RemoteTrack} to be switched off.
 * @param {RemoteTrack} track - the {@link RemoteTrack}
 * @returns Promise<void>
 */
async function trackSwitchedOff(track) {
  if (track.isSwitchedOff) {
    return;
  }
  await new Promise(resolve => track.once('switchedOff', resolve));
}

/**
 * Wait for a {@link RemoteTrack} to be switched on.
 * @param {RemoteTrack} track - the {@link RemoteTrack}
 * @returns Promise<void>
 */
async function trackSwitchedOn(track) {
  if (!track.isSwitchedOff) {
    return;
  }
  await new Promise(resolve => track.once('switchedOn', resolve));
}

/**
 * Wait for a {@link RemoteTrackPublication}'s priority change event.
 * @param {RemoteTrackPublication} trackPub - the {@link RemoteTrackPublication}
 * @returns Promise<void>
 */
async function trackPublishPriorityChanged(trackPub) {
  await new Promise(resolve => trackPub.once('publishPriorityChanged', resolve));
}

/**
 * Wait for a {@link RemoteTrack} to start.
 * @param {RemoteTrack} track - the {@link RemoteTrack}
 * @returns Promise<void>
 */
async function trackStarted(track) {
  if (track.isStarted) {
    return;
  }
  await new Promise(resolve => track.once('started', resolve));
}

/**
 * Make a fake {@link EncodingParametersImpl}.
 * @param {PeerConnectionV2Options} [options]
 */
function makeEncodingParameters(options) {
  const encodingParameters = new EventEmitter();
  encodingParameters.maxAudioBitrate = options.maxAudioBitrate || null;
  encodingParameters.maxVideoBitrate = options.maxVideoBitrate || null;
  encodingParameters.update = sinon.spy(params => {
    encodingParameters.maxAudioBitrate = params.maxAudioBitrate;
    encodingParameters.maxVideoBitrate = params.maxVideoBitrate;
    encodingParameters.emit('changed');
  });

  options = options || {};
  options.encodingParameters = encodingParameters;
  return encodingParameters;
}

/**
 * Wait for a certain number of {@link RemoteTrack} or {@link RemoteTrackPublication} events.
 * @param {string} event - the event to wait for
 * @param {RemoteParticipant} participant - the {@link RemoteParticipant}
 * @param {number} n - the number of events to wait for
 * @returns {Promise.<Array<RemoteTrack|RemoteTrackPublication>>}
 */
async function waitForTracks(event, participant, n) {
  if (n <= 0) {
    return [];
  }
  // eslint-disable-next-line no-return-await
  return await new Promise(resolve => {
    const tracks = [];
    participant.on(event, function onevent(track) {
      tracks.push(track);
      if (--n === 0) {
        participant.removeListener(event, onevent);
        resolve(tracks);
      }
    });
  });
}


// NOTE(mmalavalli): Safari is rejecting getUserMedia()'s Promise with an
// OverConstrainedError. So these capture dimensions are disabled.
const smallVideoConstraints = isSafari ? {} : {
  width: 160,
  height: 120
};

const isRTCRtpSenderParamsSupported = typeof RTCRtpSender !== 'undefined'
  && typeof RTCRtpSender.prototype.getParameters === 'function'
  && typeof RTCRtpSender.prototype.setParameters === 'function';

async function setup({ name, testOptions, otherOptions, nTracks, alone, roomOptions }) {
  name = name || randomName();
  const options = Object.assign({
    audio: true,
    video: smallVideoConstraints
  }, testOptions, defaults);
  const token = getToken(randomName());
  options.name = await createRoom(name, options.topology, roomOptions);
  const thisRoom = await connect(token, options);
  if (alone) {
    return [options.name, thisRoom];
  }

  otherOptions = Object.assign({
    audio: true,
    video: smallVideoConstraints
  }, otherOptions);
  const thoseOptions = Object.assign({ name: thisRoom.name }, otherOptions, defaults);
  const thoseTokens = [randomName(), randomName()].map(getToken);
  const thoseRooms = await Promise.all(thoseTokens.map(token => connect(token, thoseOptions)));

  await Promise.all([thisRoom].concat(thoseRooms).map(room => {
    return participantsConnected(room, thoseRooms.length);
  }));
  const thoseParticipants = [...thisRoom.participants.values()];
  await Promise.all(thoseParticipants.map(participant => tracksSubscribed(participant, typeof nTracks === 'number' ? nTracks : 2)));
  const peerConnections = [...thisRoom._signaling._peerConnectionManager._peerConnections.values()].map(pcv2 => pcv2._peerConnection);
  return [options.name, thisRoom, thoseRooms, peerConnections];
}

/**
 * Returns a promise that resolves after being connected/disconnected from network.
 * @param {('online'|'offline')} onlineOrOffline - if online waits for connected state
 * @returns {Promise<void>}
 */
function waitToGo(onlineOrOffline) {
  const wantonline = onlineOrOffline === 'online';
  // eslint-disable-next-line no-console
  return new Promise((resolve) => {
    if (window.navigator.onLine !== wantonline) {
      window.addEventListener(onlineOrOffline, resolve, { once: true });
    } else {
      resolve();
    }
  });
}

/**
 * Returns a promise that resolves after being connected to the network.
 * @returns {Promise<void>}
 */
async function waitToGoOnline() {
  try {
    await waitFor(waitToGo('online'), 'wait to go online', 1 * minute);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log('waitToGoOnline failed. but since its known to be unstable on ' +
                'firefox sometime so letting it go:', err);
  }
}

/**
 * Returns a promise that resolves after being disconneected from the network.
 * @returns {Promise<void>}
 */
async function waitToGoOffline() {
  await waitFor(waitToGo('offline'), 'wait to go offline');
}

/**
 * Note: when a test waits for promise that fails to settle.
 *   1) The test fail w/o a good indication of what happend, as for Mocha the test never finished
 *   2) This also causes subsequent tests to not get executed.
 * So instead of using raw `await fooPromise` use `await waitFor(fooPromise)` abstraction
 * solves above problems by limiting all waits to a finite time. It also helps fail the test
 * with more useful `message` parameter w/o cluttering test code.
 * Returns a promise that if not settled in timeoutMS, gets rejected.
 * @param {Promise|Array<Promise>} promiseOrArray - Promises to wait on
 * @param {string} message - indicates the message logged when promise rejects.
 * @param {number} timeoutMS - time to wait in miliseconds.
 * @returns {Promise<any>}
 */
let waitId = 101;
async function waitFor(promiseOrArray, message, timeoutMS = 4 * minute) {
  const thisWaitId = waitId++;
  // eslint-disable-next-line no-console
  console.log(`>>>> [${thisWaitId}] Will wait ${timeoutMS} ms for : ${message}`);
  const startTime = new Date();
  const promise = Array.isArray(promiseOrArray) ? Promise.all(promiseOrArray) : promiseOrArray;
  let timer = null;
  const timeoutPromise = new Promise((_resolve, reject) => {
    timer = setTimeout(() => {
      const endTime = new Date();
      const durationInSeconds = (endTime - startTime) / 1000;
      // eslint-disable-next-line no-console
      console.warn(`xxxx [${thisWaitId}] Timed out waiting for : ${message} [${durationInSeconds} seconds]`);
      reject(new Error(`Timed out waiting for : ${message}`));
    }, timeoutMS);
  });

  const result = await Promise.race([promise, timeoutPromise]);
  const endTime = new Date();
  const durationInSeconds = (endTime - startTime) / 1000;
  // eslint-disable-next-line no-console
  console.log(`<<<< [${thisWaitId}] Succeeded in waiting for: ${message} [${durationInSeconds} seconds]`);
  clearTimeout(timer);
  return result;
}

exports.a = a;
exports.capitalize = capitalize;
exports.createSyntheticAudioStreamTrack = createSyntheticAudioStreamTrack;
exports.combinationContext = combinationContext;
exports.combinations = combinations;
exports.isRTCRtpSenderParamsSupported = isRTCRtpSenderParamsSupported;
exports.dominantSpeakerChanged = dominantSpeakerChanged;
exports.makeEncodingParameters = makeEncodingParameters;
exports.pairs = pairs;
exports.participantsConnected = participantsConnected;
exports.randomBoolean = randomBoolean;
exports.randomName = randomName;
exports.tracksSubscribed = tracksSubscribed;
exports.trackSwitchedOff = trackSwitchedOff;
exports.trackSwitchedOn = trackSwitchedOn;
exports.tracksPublished = tracksPublished;
exports.tracksUnpublished = tracksUnpublished;
exports.tracksUnsubscribed = tracksUnsubscribed;
exports.trackStarted = trackStarted;
exports.waitForTracks = waitForTracks;
exports.smallVideoConstraints = smallVideoConstraints;
exports.setup = setup;
exports.waitFor = waitFor;
exports.waitToGoOnline = waitToGoOnline;
exports.waitToGoOffline = waitToGoOffline;
exports.trackPublishPriorityChanged = trackPublishPriorityChanged;

