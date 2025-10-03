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
var __spreadArray = (this && this.__spreadArray) || function (to, from) {
    for (var i = 0, il = from.length, j = to.length; i < il; i++, j++)
        to[j] = from[i];
    return to;
};
/**
 * Create a {@link Deferred}.
 * @returns {Deferred}
 */
function defer() {
    var deferred = {};
    deferred.promise = new Promise(function (resolve, reject) {
        deferred.resolve = resolve;
        deferred.reject = reject;
    });
    return deferred;
}
/**
 * Copy a method from a `source` prototype onto a `wrapper` prototype. Invoking
 * the method on the `wrapper` prototype will invoke the corresponding method
 * on an instance accessed by `target`.
 * @param {object} source
 * @param {object} wrapper
 * @param {string} target
 * @param {string} methodName
 * @returns {undefined}
 */
function delegateMethod(source, wrapper, target, methodName) {
    if (methodName in wrapper) {
        // Skip any methods already set.
        return;
    }
    else if (methodName.match(/^on[a-z]+$/)) {
        // Skip EventHandlers (these are handled in the constructor).
        return;
    }
    var isProperty = false;
    try {
        var propDesc = Object.getOwnPropertyDescriptor(source, methodName);
        isProperty = propDesc && !!propDesc.get;
    }
    catch (error) {
        // its okay to eat failure here.
    }
    // NOTE(mpatwardhan):skip properties. we are only interested in overriding
    // functions. we do not even want to evaluate  `typeof source[methodName]` for properties
    // because getter would get invoked, and they might have side effects.
    // For example RTCPeerConnection.peerIdentity is a property that returns a promise.
    // calling typeof RTCPeerConnection.peerIdentity, would leak a promise, and in case it rejects
    // we see errors.
    if (isProperty) {
        return;
    }
    var type;
    try {
        type = typeof source[methodName];
    }
    catch (error) {
        // NOTE(mroberts): Attempting to check the type of non-function members
        // on the prototype throws an error for some types.
    }
    if (type !== 'function') {
        // Skip non-function members.
        return;
    }
    /* eslint no-loop-func:0 */
    wrapper[methodName] = function () {
        return this[target][methodName].apply(this[target], arguments);
    };
}
/**
 * Copy methods from a `source` prototype onto a `wrapper` prototype. Invoking
 * the methods on the `wrapper` prototype will invoke the corresponding method
 * on an instance accessed by `target`.
 * @param {object} source
 * @param {object} wrapper
 * @param {string} target
 * @returns {undefined}
 */
function delegateMethods(source, wrapper, target) {
    for (var methodName in source) {
        delegateMethod(source, wrapper, target, methodName);
    }
}
/**
 * Finds the items in list1 that are not in list2.
 * @param {Array<*>|Map<*>|Set<*>} list1
 * @param {Array<*>|Map<*>|Set<*>} list2
 * @returns {Set}
 */
function difference(list1, list2) {
    list1 = Array.isArray(list1) ? new Set(list1) : new Set(list1.values());
    list2 = Array.isArray(list2) ? new Set(list2) : new Set(list2.values());
    var difference = new Set();
    list1.forEach(function (item) {
        if (!list2.has(item)) {
            difference.add(item);
        }
    });
    return difference;
}
/**
 * Map a list to an array of arrays, and return the flattened result.
 * @param {Array<*>|Set<*>|Map<*>} list
 * @param {function(*): Array<*>} mapFn
 * @returns Array<*>
 */
function flatMap(list, mapFn) {
    var listArray = list instanceof Map || list instanceof Set
        ? Array.from(list.values())
        : list;
    return listArray.reduce(function (flattened, item) { return flattened.concat(mapFn(item)); }, []);
}
/**
 * Get the browser's user agent, if available.
 * @returns {?string}
 */
function getUserAgent() {
    return typeof navigator !== 'undefined' && typeof navigator.userAgent === 'string'
        ? navigator.userAgent
        : null;
}
/**
 * Guess the browser.
 * @param {string} [userAgent=navigator.userAgent]
 * @returns {?string} browser - "chrome", "firefox", "safari", or null
 */
function guessBrowser(userAgent) {
    if (typeof userAgent === 'undefined') {
        userAgent = getUserAgent();
    }
    if (/Chrome|CriOS/.test(userAgent)) {
        return 'chrome';
    }
    if (/Firefox|FxiOS/.test(userAgent)) {
        return 'firefox';
    }
    if (/Safari|iPhone|iPad|iPod/.test(userAgent)) {
        return 'safari';
    }
    return null;
}
/**
 * Guess the browser version.
 * @param {string} [userAgent=navigator.userAgent]
 * @returns {?{major: number, minor: number}}
 */
function guessBrowserVersion(userAgent) {
    if (typeof userAgent === 'undefined') {
        userAgent = getUserAgent();
    }
    var prefix = {
        chrome: 'Chrome|CriOS',
        firefox: 'Firefox|FxiOS',
        safari: 'Version'
    }[guessBrowser(userAgent)];
    if (!prefix) {
        return null;
    }
    var regex = new RegExp("(" + prefix + ")/([^\\s]+)");
    var _a = __read(userAgent.match(regex) || [], 3), match = _a[2];
    if (!match) {
        return null;
    }
    var versions = match.split('.').map(Number);
    return {
        major: isNaN(versions[0]) ? null : versions[0],
        minor: isNaN(versions[1]) ? null : versions[1]
    };
}
/**
 * Check whether the current browser is iOS Chrome.
 * @param {string} [userAgent=navigator.userAgent]
 * @returns {boolean}
 */
function isIOSChrome(userAgent) {
    if (typeof userAgent === 'undefined') {
        userAgent = getUserAgent();
    }
    return (/Mobi/.test(userAgent) && guessBrowser() === 'chrome' && /iPad|iPhone|iPod/.test(userAgent));
}
/**
 * Intercept an event that might otherwise be proxied on an EventTarget.
 * @param {EventTarget} target
 * @param {string} type
 * @returns {void}
 */
function interceptEvent(target, type) {
    var currentListener = null;
    Object.defineProperty(target, 'on' + type, {
        get: function () {
            return currentListener;
        },
        set: function (newListener) {
            if (currentListener) {
                this.removeEventListener(type, currentListener);
            }
            if (typeof newListener === 'function') {
                currentListener = newListener;
                this.addEventListener(type, currentListener);
            }
            else {
                currentListener = null;
            }
        }
    });
}
/**
 * This is a function for turning a Promise into the kind referenced in the
 * Legacy Interface Extensions section of the WebRTC spec.
 * @param {Promise<*>} promise
 * @param {function<*>} onSuccess
 * @param {function<Error>} onFailure
 * @returns {Promise<undefined>}
 */
function legacyPromise(promise, onSuccess, onFailure) {
    return onSuccess
        ? promise.then(onSuccess, onFailure)
        : promise;
}
/**
 * Make a unique ID.
 * @return {string}
 */
function makeUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0;
        var v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
/**
 * For each property name on the `source` prototype, add getters and/or setters
 * to `wrapper` that proxy to `target`.
 * @param {object} source
 * @param {object} wrapper
 * @param {string} target
 * @returns {undefined}
 */
function proxyProperties(source, wrapper, target) {
    Object.getOwnPropertyNames(source).forEach(function (propertyName) {
        proxyProperty(source, wrapper, target, propertyName);
    });
}
/**
 * For the property name on the `source` prototype, add a getter and/or setter
 * to `wrapper` that proxies to `target`.
 * @param {object} source
 * @param {object} wrapper
 * @param {string} target
 * @param {string} propertyName
 * @returns {undefined}
 */
function proxyProperty(source, wrapper, target, propertyName) {
    if (propertyName in wrapper) {
        // Skip any properties already set.
        return;
    }
    else if (propertyName.match(/^on[a-z]+$/)) {
        Object.defineProperty(wrapper, propertyName, {
            value: null,
            writable: true
        });
        target.addEventListener(propertyName.slice(2), function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            return wrapper.dispatchEvent.apply(wrapper, __spreadArray([], __read(args)));
        });
        return;
    }
    Object.defineProperty(wrapper, propertyName, {
        enumerable: true,
        get: function () {
            return target[propertyName];
        }
    });
}
/**
 * Check whether native WebRTC APIs are supported.
 * @returns {boolean}
 */
function support() {
    return typeof navigator === 'object'
        && typeof navigator.mediaDevices === 'object'
        && typeof navigator.mediaDevices.getUserMedia === 'function'
        && typeof RTCPeerConnection === 'function';
}
/**
 * Create a Set of supported codecs for a certain kind of media.
 * @param {'audio'|'video'} kind
 * @returns {Promise<Set<AudioCodec|VideoCodec>>}
 */
function createSupportedCodecsSet(kind) {
    if (typeof RTCRtpSender !== 'undefined'
        && typeof RTCRtpSender.getCapabilities === 'function') {
        return Promise.resolve(new Set(RTCRtpSender
            .getCapabilities(kind)
            .codecs
            .map(function (_a) {
            var mimeType = _a.mimeType;
            return mimeType.split('/')[1].toLowerCase();
        })));
    }
    if (typeof RTCPeerConnection === 'undefined'
        || typeof RTCPeerConnection.prototype === 'undefined'
        || typeof RTCPeerConnection.prototype.addTransceiver !== 'function'
        || typeof RTCPeerConnection.prototype.close !== 'function'
        || typeof RTCPeerConnection.prototype.createOffer !== 'function') {
        return Promise.resolve(new Set());
    }
    var pc = new RTCPeerConnection();
    pc.addTransceiver(kind);
    return pc.createOffer().then(function (_a) {
        var sdp = _a.sdp;
        pc.close();
        return new Set((sdp.match(/^a=rtpmap:.+$/gm) || [])
            .map(function (line) { return line.match(/^a=rtpmap:.+ ([^/]+)/)[1].toLowerCase(); }));
    }, function () {
        pc.close();
        return new Set();
    });
}
// NOTE(mmalavalli): Cache the supported audio and video codecs here.
var supportedCodecs = new Map();
/**
 * Check whether a given codec for a certain kind of media is supported.
 * @param {AudioCodec|VideoCodec} codec
 * @param {'audio'|'video'} kind
 * @returns {Promise<boolean>}
 */
function isCodecSupported(codec, kind) {
    var codecs = supportedCodecs.get(kind);
    if (codecs) {
        return Promise.resolve(codecs.has(codec.toLowerCase()));
    }
    return createSupportedCodecsSet(kind).then(function (codecs) {
        supportedCodecs.set(kind, codecs);
        return codecs.has(codec.toLowerCase());
    });
}
/**
 * Clear cached supported codecs (unit tests only).
 */
function clearCachedSupportedCodecs() {
    supportedCodecs.clear();
}
/**
 * @typedef {object} Deferred
 * @property {Promise} promise
 * @property {function} reject
 * @property {function} resolve
 */
exports.clearCachedSupportedCodecs = clearCachedSupportedCodecs;
exports.defer = defer;
exports.delegateMethods = delegateMethods;
exports.difference = difference;
exports.flatMap = flatMap;
exports.guessBrowser = guessBrowser;
exports.guessBrowserVersion = guessBrowserVersion;
exports.isCodecSupported = isCodecSupported;
exports.isIOSChrome = isIOSChrome;
exports.interceptEvent = interceptEvent;
exports.legacyPromise = legacyPromise;
exports.makeUUID = makeUUID;
exports.proxyProperties = proxyProperties;
exports.support = support;
//# sourceMappingURL=index.js.map