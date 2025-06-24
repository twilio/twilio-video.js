'use strict';
var _a = require('../webrtc/util'), guessBrowser = _a.guessBrowser, isWebRTCSupported = _a.support;
var getSdpFormat = require('../webrtc/util/sdp').getSdpFormat;
var _b = require('./browserdetection'), isAndroid = _b.isAndroid, isMobile = _b.isMobile, isNonChromiumEdge = _b.isNonChromiumEdge, rebrandedChromeBrowser = _b.rebrandedChromeBrowser, mobileWebKitBrowser = _b.mobileWebKitBrowser;
var SUPPORTED_CHROME_BASED_BROWSERS = [
    'crios',
    'edg',
    'edge',
    'electron',
    'headlesschrome'
];
var SUPPORTED_ANDROID_BROWSERS = [
    'chrome',
    'firefox'
];
var SUPPORTED_IOS_BROWSERS = [
    'chrome',
    'safari'
];
// Currently none. Add 'brave', 'edg', and 'edge' here once we start supporting them
var SUPPORTED_MOBILE_WEBKIT_BASED_BROWSERS = [];
/**
 * Check if the current browser is officially supported by twilio-video.js.
 * @returns {boolean}
 */
function isSupported() {
    var browser = guessBrowser();
    // NOTE (csantos): Return right away if there is no browser detected
    // to prevent unnecessary checks which could lead to errors
    if (!browser) {
        return false;
    }
    var rebrandedChrome = rebrandedChromeBrowser(browser);
    var mobileWebKit = mobileWebKitBrowser(browser);
    var supportedMobileBrowsers = isAndroid() ?
        SUPPORTED_ANDROID_BROWSERS : SUPPORTED_IOS_BROWSERS;
    return !!browser
        && isWebRTCSupported()
        && getSdpFormat() === 'unified'
        && (!rebrandedChrome || SUPPORTED_CHROME_BASED_BROWSERS.includes(rebrandedChrome))
        && !isNonChromiumEdge(browser)
        && (!mobileWebKit || SUPPORTED_MOBILE_WEBKIT_BASED_BROWSERS.includes(mobileWebKit))
        && (!isMobile() || supportedMobileBrowsers.includes(browser));
}
module.exports = isSupported;
//# sourceMappingURL=support.js.map