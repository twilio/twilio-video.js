'use strict';

module.exports.DEFAULT_ENVIRONMENT = 'prod';
module.exports.DEFAULT_REALM = 'us1';
module.exports.DEFAULT_REGION = 'gll';
module.exports.DEFAULT_LOG_LEVEL = 'warn';
module.exports.DEFAULT_LOGGER_NAME = 'twilio-video';
module.exports.WS_SERVER = function (environment, region) {
  region = region === 'gll' ? 'global' : encodeURIComponent(region);
  return environment === 'prod' ? 'wss://' + region + '.vss.twilio.com/signaling' : 'wss://' + region + '.vss.' + environment + '.twilio.com/signaling';
};
module.exports.PUBLISH_MAX_ATTEMPTS = 5;
module.exports.PUBLISH_BACKOFF_JITTER = 10;
module.exports.PUBLISH_BACKOFF_MS = 20;

/**
 * Returns the appropriate indefinite article ("a" | "an").
 * @param {string} word - The word which determines whether "a" | "an" is returned
 * @returns {string} "a" if word's first letter is a vowel, "an" otherwise
 */
function article(word) {
  // NOTE(mmalavalli): This will not be accurate for words like "hour",
  // which have consonants as their first character, but are pronounced like
  // vowels. We can address this issue if the need arises.
  return ['a', 'e', 'i', 'o', 'u'].includes(word.toLowerCase()[0]) ? 'an' : 'a';
}

module.exports.typeErrors = {
  ILLEGAL_INVOKE: function ILLEGAL_INVOKE(name, context) {
    return new TypeError('Illegal call to ' + name + ': ' + context);
  },
  INVALID_TYPE: function INVALID_TYPE(name, type) {
    return new TypeError(name + ' must be ' + article(type) + ' ' + type);
  },
  INVALID_VALUE: function INVALID_VALUE(name, values) {
    return new RangeError(name + ' must be one of ' + values.join(', '));
  },
  REQUIRED_ARGUMENT: function REQUIRED_ARGUMENT(name) {
    return new TypeError(name + ' must be specified');
  }
};

module.exports.DEFAULT_ICE_GATHERING_TIMEOUT_MS = 15000;
module.exports.DEFAULT_SESSION_TIMEOUT_SEC = 30;

module.exports.DEFAULT_NQ_LEVEL_LOCAL = 1;
module.exports.DEFAULT_NQ_LEVEL_REMOTE = 0;
module.exports.MAX_NQ_LEVEL = 3;

module.exports.ICE_ACTIVITY_CHECK_PERIOD_MS = 1000;
module.exports.ICE_INACTIVITY_THRESHOLD_MS = 3000;

module.exports.iceRestartBackoffConfig = {
  factor: 1.1,
  initialDelay: 1,
  maxDelay: module.exports.DEFAULT_SESSION_TIMEOUT_SEC * 1000,
  randomisationFactor: 0.5
};

module.exports.reconnectBackoffConfig = {
  factor: 1.5,
  initialDelay: 80,
  randomisationFactor: 0.5
};

module.exports.subscriptionMode = {
  MODE_COLLABORATION: 'collaboration',
  MODE_GRID: 'grid',
  MODE_PRESENTATION: 'presentation'
};

module.exports.trackSwitchOffMode = {
  MODE_DISABLED: 'disabled',
  MODE_DETECTED: 'detected',
  MODE_PREDICTED: 'predicted'
};

module.exports.trackPriority = {
  PRIORITY_HIGH: 'high',
  PRIORITY_LOW: 'low',
  PRIORITY_STANDARD: 'standard'
};