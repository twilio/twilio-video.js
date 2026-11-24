'use strict';

const { join, relative } = require('path');

const root = join(__dirname, '..');

/**
 * Read TEST_RETRIES: unset or empty is 0; anything but a non-negative integer throws.
 */
function parseRetries(value) {
  if (!value) {
    return 0;
  }
  if (!/^\d+$/.test(value)) {
    throw new Error(`TEST_RETRIES must be a non-negative integer, got ${JSON.stringify(value)}`);
  }
  return Number(value);
}

/**
 * Run each spec file in order, rerunning a failed file up to `retries` more times.
 * @param {string[]} files
 * @param {function(string): Promise<{exitCode: number, failures: string[]}>} runFile -
 *   runs one file; `failures` names its failed tests and hooks
 * @param {number} retries
 * @returns {Promise<{exitCode: number, retried: Array, failed: Array}>} `exitCode` is the
 *   first non-zero exit code of a file that failed every attempt, or 0. `retried` and
 *   `failed` list `{ file, attempts }`, where `attempts` holds the failures of each failed
 *   attempt in order.
 */
async function runWithRetries(files, runFile, retries) {
  let exitCode = 0;
  const retried = [];
  const failed = [];
  for (const file of files) {
    const attempts = [];
    let result;
    do {
      // eslint-disable-next-line no-await-in-loop
      result = await runFile(file);
      if (result.exitCode) {
        attempts.push(result.failures);
      }
    } while (result.exitCode && attempts.length <= retries);

    if (!result.exitCode) {
      if (attempts.length) {
        retried.push({ file, attempts });
      }
    } else {
      failed.push({ file, attempts });
      exitCode = exitCode || result.exitCode;
    }
  }
  return { exitCode, retried, failed };
}

function formatFiles(heading, entries) {
  const lines = [heading];
  entries.forEach(({ file, attempts }) => {
    lines.push(`- \`${relative(root, file)}\``);
    attempts.forEach((failures, i) => {
      if (!failures.length) {
        lines.push(`  - attempt ${i + 1}: no failed test reported`);
      }
      failures.forEach(failure => lines.push(`  - attempt ${i + 1}: ${failure}`));
    });
  });
  return lines;
}

/**
 * Markdown listing the result of runWithRetries, or '' when no file failed an attempt.
 */
function formatSummary({ retried, failed }) {
  if (!retried.length && !failed.length) {
    return '';
  }
  let lines = ['### E2E spec files that failed an attempt', ''];
  if (retried.length) {
    lines = lines.concat(formatFiles('Passed on a rerun:', retried), '');
  }
  if (failed.length) {
    lines = lines.concat(formatFiles('Failed every attempt:', failed), '');
  }
  return lines.join('\n');
}

module.exports = { formatSummary, parseRetries, runWithRetries };
