'use strict';

module.exports.DEFAULT_ENVIRONMENT = 'prod';
module.exports.DEFAULT_REALM = 'us1';
module.exports.DEFAULT_LOG_LEVEL = 'warn';
module.exports.REGISTRAR_SERVER = 'endpoint.twilio.com';
module.exports.WS_SERVER = (environment, realm) => {
  switch (environment) {
    case 'prod':
      switch (realm) {
        case 'us1':
          return 'wss://endpoint.twilio.com';
        default:
          return `wss://endpoint.${realm}.twilio.com`;
      }
    default:
      return `wss://endpoint.${environment}-${realm}.twilio.com`;
  }
};
module.exports.ECS_SERVER = (environment, realm) => {
  switch (environment) {
    case 'prod':
      return `https://ecs.${realm}.twilio.com`;
    default:
      return `https://ecs.${environment}-${realm}.twilio.com`;
  }
};
module.exports.ECS_TIMEOUT = 60;
module.exports.PUBLISH_MAX_ATTEMPTS = 5;
module.exports.PUBLISH_BACKOFF_JITTER = 10;
module.exports.PUBLISH_BACKOFF_MS = 20;

module.exports.ICE_SERVERS_TIMEOUT_MS = 3000;
module.exports.ICE_SERVERS_DEFAULT_TTL = 3600;
module.exports.DEFAULT_ICE_SERVERS = environment => {
  switch (environment) {
    case 'prod':
      return [
        { urls: 'stun:global.stun.twilio.com:3478?transport=udp' }
      ];
    default:
      return [
        { urls: `stun:global.stun.${environment}.twilio.com:3478?transport=udp` }
      ];
  }
};

// Headers
/* eslint key-spacing:0 */
module.exports.headers = {
  X_TWILIO_ACCESSTOKEN:   'X-Twilio-AccessToken'
};

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
  INVALID_TYPE(name, type) {
    return new TypeError(`${name} must be ${article(type)} ${type}`);
  },
  INVALID_VALUE(name, values) {
    return new RangeError(`${name} must be one of `, values.join(', '));
  },
  REQUIRED_ARGUMENT(name) {
    return new TypeError(`${name} must be specified`);
  }
};

module.exports.DEFAULT_NQ_LEVEL_LOCAL = 1;
module.exports.DEFAULT_NQ_LEVEL_REMOTE = 0;
module.exports.MAX_NQ_LEVEL = 3;
