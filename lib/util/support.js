/* globals chrome, navigator */
'use strict';

const { guessBrowser, support: isWebRTCSupported } = require('@twilio/webrtc/lib/util');

const SUPPORTED_CHROME_BASED_BROWSERS = [
  'edg',
  'edge',
  'electron',
  'headlesschrome'
];

/**
 * Get the top level parenthesized substrings within a given string. Unmatched
 * parentheses are ignored.
 * Ex: "abc) (def) gh(ij) (kl (mn)o) (pqr" => ["(def)", "(ij)", "(kl (mn)o)"]
 * @param {string} string
 * @returns {string[]}
 */
function getParenthesizedSubstrings(string) {
  const openParenthesisPositions = [];
  const substrings = [];
  for (let i = 0; i < string.length; i++) {
    if (string[i] === '(') {
      openParenthesisPositions.push(i);
    } else if (string[i] === ')' && openParenthesisPositions.length > 0) {
      const openParenthesisPosition = openParenthesisPositions.pop();
      if (openParenthesisPositions.length === 0) {
        substrings.push(string.substring(openParenthesisPosition, i + 1));
      }
    }
  }
  return substrings;
}

/**
 * Check whether the current browser is non-Chromium Edge.
 * @param {string} browser
 * @returns {boolean}
 */
function isNonChromiumEdge(browser) {
  return browser === 'chrome' && /Edge/.test(navigator.userAgent) && (
    typeof chrome === 'undefined' || typeof chrome.runtime === 'undefined'
  );
}

/**
 * Get the name of the rebranded Chromium browser, if any. Re-branded Chrome's user
 * agent has the following format:
 * <source>/<version> (<os>) <engine>/<version> (<engine_name>) Chrome/<version> [Mobile] Safari/<version>
 * @param browser
 * @returns {?string} Name of the rebranded Chrome browser, or null if the browser
 *   is either not Chrome or vanilla Chrome.
 */
function rebrandedChromeBrowser(browser) {
  // If the browser is not Chrome based, then it is not a rebranded Chrome browser.
  if (browser !== 'chrome') {
    return null;
  }

  // Latest desktop Brave browser has a "brave" property in navigator.
  if ('brave' in navigator) {
    return 'brave';
  }

  // Remove the "(.+)" entries from the user agent thereby retaining only the
  // <name>[/<version>] entries.
  const parenthesizedSubstrings = getParenthesizedSubstrings(navigator.userAgent);
  const nameAndVersions = parenthesizedSubstrings.reduce(
    (userAgent, substring) => userAgent.replace(substring, ''),
    navigator.userAgent
  );

  // Extract the potential browser <name>s by ignoring the first two names, which
  // point to <source> and <engine>.
  const matches = nameAndVersions.match(/[^\s]+/g) || [];
  const [/* source */, /* engine */, ...browserNames] = matches.map(nameAndVersion => {
    return nameAndVersion.split('/')[0].toLowerCase();
  });

  // Extract the <name> that is not expected to be present in the vanilla Chrome
  // browser, which indicates the rebranded name (ex: "edg[e]", "electron"). If null,
  // then this is a vanilla Chrome browser.
  return browserNames.find(name => {
    return !['chrome', 'mobile', 'safari'].includes(name);
  }) || null;
}

/**
 * Check if the current browser is officially supported by twilio-video.js.
 * @returns {boolean}
 */
function isSupported() {
  const browser = guessBrowser();
  const rebrandedChrome = rebrandedChromeBrowser(browser);
  return !!browser
    && isWebRTCSupported()
    && (!rebrandedChrome || SUPPORTED_CHROME_BASED_BROWSERS.includes(rebrandedChrome))
    && !isNonChromiumEdge(browser);
}

module.exports = isSupported;
