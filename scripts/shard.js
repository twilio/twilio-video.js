'use strict';

const { join, relative } = require('path');

const root = join(__dirname, '..');

// Seconds assumed for a spec file that test/integration/timings.json doesn't list yet.
const DEFAULT_SECONDS = 10;

/**
 * Pick shard `<n>/<total>` of the spec files (absolute paths), in their given order. Unset
 * runs every file; a malformed value throws. The split is deterministic, so shards computed
 * on separate runners together run each file exactly once.
 * @param {Object<string, number>} timings - seconds per file, keyed by repo-relative path
 */
function shardFiles(files, shard, timings) {
  if (!shard) {
    return files;
  }
  const match = /^(\d+)\/(\d+)$/.exec(shard);
  const index = match && Number(match[1]);
  const total = match && Number(match[2]);
  if (!match || index < 1 || index > total) {
    throw new Error(`TEST_SHARD must be <n>/<total> with n from 1 to total, got ${JSON.stringify(shard)}`);
  }

  const seconds = file => {
    const time = timings[relative(root, file)];
    return typeof time === 'number' ? time : DEFAULT_SECONDS;
  };
  const longestFirst = [...files].sort((a, b) => seconds(b) - seconds(a) || (a < b ? -1 : 1));

  const totals = new Array(total).fill(0);
  const picked = new Set();
  longestFirst.forEach(file => {
    const lightest = totals.indexOf(Math.min(...totals));
    totals[lightest] += seconds(file);
    if (lightest === index - 1) {
      picked.add(file);
    }
  });
  return files.filter(file => picked.has(file));
}

module.exports = { shardFiles };
