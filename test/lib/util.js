'use strict';

const sinon = require('sinon');
const { EventEmitter } = require('events');
const { capitalize } = require('../../lib/util');

function a(word) {
  return word.toLowerCase().match(/^[aeiou]/) ? 'an' : 'a';
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
 * Wait for {@link RemoteTrack}s to be added to a {@link RemoteParticipant}.
 * @param {RemoteParticipant} participant - the {@link RemoteParticipant}
 * @param {number} n - the number of {@link RemoteTrack}s to wait for
 * @returns Promise<void>
 */
async function tracksAdded(participant, n) {
  while (participant.tracks.size < n) {
    await new Promise(resolve => participant.once('trackAdded', resolve));
  }
}

/**
 * Wait for {@link LocalTrack}s to be published.
 * @param {LocalParticipant} participant - the {@link LocalParticipant}
 *   publishing the {@link LocalTrack}s
 * @param {number} n - the number of {@link LocalTrack}s to wait for
 * @param {Track.Kind} [kind] - an optional filter for {@link LocalTrack}s of a
 *   particular kind
 * @returns {Promise<void>}
 */
async function tracksPublished(participant, n, kind) {
  const trackPublications = kind
    ? participant[kind + 'TrackPublications']
    : participant.trackPublications;
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
 * Wait for {@link RemoteTrack}s to be removed from a {@link RemoteParticipant}.
 * @param {RemoteParticipant} participant - the {@link RemoteParticipant}
 * @param {number} n - the final number of {@link RemoteTrack}s to count down to
 * @returns Promise<void>
 */
async function tracksRemoved(participant, n) {
  while (participant.tracks.size > n) {
    await new Promise(resolve => participant.once('trackRemoved', resolve));
  }
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
 * Wait for a certain number of {@link RemoteTrack} events.
 * @param {string} event - the event to wait for
 * @param {RemoteParticipant} participant - the {@link RemoteParticipant}
 * @param {number} n - the number of events to wait for
 * @returns {Promise.<Array<RemoteTracks>>}
 */
async function waitForTracks(event, participant, n) {
  if (n <= 0) {
    return [];
  }
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

exports.a = a;
exports.capitalize = capitalize;
exports.combinationContext = combinationContext;
exports.combinations = combinations;
exports.makeEncodingParameters = makeEncodingParameters;
exports.pairs = pairs;
exports.participantsConnected = participantsConnected;
exports.randomBoolean = randomBoolean;
exports.randomName = randomName;
exports.tracksAdded = tracksAdded;
exports.tracksPublished = tracksPublished;
exports.tracksRemoved = tracksRemoved;
exports.trackStarted = trackStarted;
exports.waitForTracks = waitForTracks;
