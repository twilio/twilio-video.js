#!/usr/bin/env node
'use strict';

// Semver precedence, hand-rolled: prepare-release.yml runs this before `npm ci`
// so that a bad input fails in seconds rather than after the install, which
// means no packages are available to it.

const VERSION = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.]+))?$/;

/**
 * Split a version into its comparable parts.
 * @param {string} version - an exact version, e.g. "2.36.0" or "2.36.0-rc.1"
 * @returns {?{numbers: Array<number>, prerelease: Array<string>}} null if
 *   `version` is not an exact X.Y.Z[-prerelease]
 */
function parse(version) {
  const match = VERSION.exec(version);
  if (!match) {
    return null;
  }
  return {
    numbers: [Number(match[1]), Number(match[2]), Number(match[3])],
    // Splitting on "." handles both "rc.1" and the dotless "rc1" used before 2.30.
    prerelease: match[4] ? match[4].split('.') : []
  };
}

function comparePrerelease(a, b) {
  if (!a.length && !b.length) {
    return 0;
  }
  // An absent prerelease outranks any prerelease: 2.34.0 > 2.34.0-rc.5. This is
  // the rule `sort -V` lacks, and it decides every final release this repo cuts.
  if (!a.length) {
    return 1;
  }
  if (!b.length) {
    return -1;
  }

  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) {
    // A shorter set of identifiers loses when everything before it is equal.
    if (i >= a.length) {
      return -1;
    }
    if (i >= b.length) {
      return 1;
    }

    const x = a[i];
    const y = b[i];
    const xIsNumeric = /^\d+$/.test(x);
    const yIsNumeric = /^\d+$/.test(y);

    if (xIsNumeric && yIsNumeric) {
      if (Number(x) !== Number(y)) {
        return Number(x) < Number(y) ? -1 : 1;
      }
    } else if (xIsNumeric !== yIsNumeric) {
      // Numeric identifiers sort below alphanumeric ones.
      return xIsNumeric ? -1 : 1;
    } else if (x !== y) {
      return x < y ? -1 : 1;
    }
  }
  return 0;
}

/**
 * Order two versions by semver precedence.
 * @param {string} a
 * @param {string} b
 * @returns {number} -1 if a < b, 0 if equal, 1 if a > b
 * @throws {Error} if either version is not an exact X.Y.Z[-prerelease]
 */
function compare(a, b) {
  const left = parse(a);
  const right = parse(b);

  for (const [version, parsed] of [[a, left], [b, right]]) {
    if (!parsed) {
      throw new Error(`${version} is not an exact version (expected 2.36.0 or 2.36.0-rc.1).`);
    }
  }

  for (let i = 0; i < 3; i++) {
    if (left.numbers[i] !== right.numbers[i]) {
      return left.numbers[i] < right.numbers[i] ? -1 : 1;
    }
  }
  return comparePrerelease(left.prerelease, right.prerelease);
}

/**
 * Whether `next` is a strictly forward move from `current`.
 * @param {string} current
 * @param {string} next
 * @returns {boolean}
 * @throws {Error} if either version is not an exact X.Y.Z[-prerelease]
 */
function isForward(current, next) {
  return compare(next, current) > 0;
}

if (require.main === module) {
  const current = process.argv[2];
  const next = process.argv[3];

  if (!current || !next) {
    console.error('::error::usage: check-version-bump.js <current-version> <next-version>');
    process.exit(1);
  }

  try {
    if (!isForward(current, next)) {
      console.error(`::error::${next} is not greater than the current version ${current}.`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exit(1);
  }

  console.log(`::notice::${next} moves forward from ${current}.`);
}

module.exports = { compare, isForward, parse };
