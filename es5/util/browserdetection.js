/* globals chrome, navigator */
'use strict';
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
/**
 * Check whether the current browser is an Android device.
 * @returns {boolean}
 */
function isAndroid() {
    return /Android/.test(navigator.userAgent);
}
/**
 * Detects whether or not a device is an Apple touch screen device.
 * @returns {boolean}
 */
function hasTouchScreen() {
    return !!(navigator && navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
}
/**
 * Detects whether or not a device is an iPad.
 * @returns {boolean}
 */
function isIpad() {
    return hasTouchScreen() && window.screen.width >= 744 && (/Macintosh/i.test(navigator.userAgent)
        || /iPad/.test(navigator.userAgent)
        || /iPad/.test(navigator.platform));
}
/**
 * Detects whether or not a device is an iPhone.
 * @returns {boolean}
 */
function isIphone() {
    return hasTouchScreen() && window.screen.width <= 476 && (/Macintosh/i.test(navigator.userAgent)
        || /iPhone/.test(navigator.userAgent)
        || /iPhone/.test(navigator.platform));
}
/**
 * Check whether the current device is an iOS device.
 * @returns {boolean}
 */
function isIOS() {
    return isIpad() || isIphone();
}
/**
 * Check whether the current browser is a mobile browser
 * @returns {boolean}
 */
function isMobile() {
    return /Mobi/.test(navigator.userAgent);
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
    var nameAndVersions = parenthesizedSubstrings.reduce(function (userAgent, substring) { return userAgent.replace(substring, ''); }, navigator.userAgent);
    // Extract the potential browser <name>s by ignoring the first two names, which
    // point to <source> and <engine>.
    var matches = nameAndVersions.match(/[^\s]+/g) || [];
    var _a = __read(matches.map(function (nameAndVersion) {
        return nameAndVersion.split('/')[0].toLowerCase();
    })), browserNames = _a.slice(2);
    // Extract the <name> that is not expected to be present in the vanilla Chrome
    // browser, which indicates the rebranded name (ex: "edg[e]", "electron"). If null,
    // then this is a vanilla Chrome browser.
    return browserNames.find(function (name) {
        return !['chrome', 'mobile', 'safari'].includes(name);
    }) || null;
}
/**
 * Get the name of the mobile webkit based browser, if any.
 * @param browser
 * @returns {?string} Name of the mobile webkit based browser, or null if the browser
 *   is either not webkit based or mobile safari.
 */
function mobileWebKitBrowser(browser) {
    if (browser !== 'safari') {
        return null;
    }
    if ('brave' in navigator) {
        return 'brave';
    }
    return ['edge', 'edg'].find(function (name) {
        return navigator.userAgent.toLowerCase().includes(name);
    }) || null;
}
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
        }
        else if (string[i] === ')' && openParenthesisPositions.length > 0) {
            var openParenthesisPosition = openParenthesisPositions.pop();
            if (openParenthesisPositions.length === 0) {
                substrings.push(string.substring(openParenthesisPosition, i + 1));
            }
        }
    }
    return substrings;
}
module.exports = {
    isAndroid: isAndroid,
    isIOS: isIOS,
    isIpad: isIpad,
    isIphone: isIphone,
    isMobile: isMobile,
    isNonChromiumEdge: isNonChromiumEdge,
    mobileWebKitBrowser: mobileWebKitBrowser,
    rebrandedChromeBrowser: rebrandedChromeBrowser
};
//# sourceMappingURL=browserdetection.js.map