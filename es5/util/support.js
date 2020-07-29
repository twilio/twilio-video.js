/* globals chrome, navigator */
'use strict';

function _toArray(arr) { return Array.isArray(arr) ? arr : Array.from(arr); }

var _require = require('@twilio/webrtc/lib/util'),
    guessBrowser = _require.guessBrowser,
    isWebRTCSupported = _require.support;

var SUPPORTED_CHROME_BASED_BROWSERS = ['edg', 'edge', 'electron', 'headlesschrome'];

/**
 * Get the top level parenthesized substrings within a given string. Unmatched
 * parentheses are ignored.
 * Ex: "abc) (def) gh(ij) (kl (mn)o) (pqr" => ["(def)", "(ij)", "(kl (mn)o)"]
 * @param {string} string
 * @returns {string[]}
 */
function getParenthesizedSubstrings(string) {
  var openParenthesisPositions = [];
  var substrings = [];
  for (var i = 0; i < string.length; i++) {
    if (string[i] === '(') {
      openParenthesisPositions.push(i);
    } else if (string[i] === ')' && openParenthesisPositions.length > 0) {
      var openParenthesisPosition = openParenthesisPositions.pop();
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
  return browser === 'chrome' && /Edge/.test(navigator.userAgent) && (typeof chrome === 'undefined' || typeof chrome.runtime === 'undefined');
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
  var parenthesizedSubstrings = getParenthesizedSubstrings(navigator.userAgent);
  var nameAndVersions = parenthesizedSubstrings.reduce(function (userAgent, substring) {
    return userAgent.replace(substring, '');
  }, navigator.userAgent);

  // Extract the potential browser <name>s by ignoring the first two names, which
  // point to <source> and <engine>.
  var matches = nameAndVersions.match(/[^\s]+/g) || [];

  var _matches$map = matches.map(function (nameAndVersion) {
    return nameAndVersion.split('/')[0].toLowerCase();
  }),
      _matches$map2 = _toArray(_matches$map),
      browserNames = _matches$map2.slice(2);

  // Extract the <name> that is not expected to be present in the vanilla Chrome
  // browser, which indicates the rebranded name (ex: "edg[e]", "electron"). If null,
  // then this is a vanilla Chrome browser.


  return browserNames.find(function (name) {
    return !['chrome', 'mobile', 'safari'].includes(name);
  }) || null;
}

/**
 * Check if the current browser is officially supported by twilio-video.js.
 * @returns {boolean}
 */
function isSupported() {
  var browser = guessBrowser();
  var rebrandedChrome = rebrandedChromeBrowser(browser);
  return !!browser && isWebRTCSupported() && (!rebrandedChrome || SUPPORTED_CHROME_BASED_BROWSERS.includes(rebrandedChrome)) && !isNonChromiumEdge(browser);
}

module.exports = isSupported;