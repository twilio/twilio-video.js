/* globals context */
'use strict';

const CancelablePromise = require('./util/cancelablepromise');
const { typeErrors: E } = require('./util/constants');

/**
 * Connect as a media extension {@link Participant}.
 * @param {ConnectOptions} [options]
 * @returns {CancelablePromise<Room>}
 */
function connectAsMediaExtension(options = {}) {
  if (typeof context === 'object' && typeof context.connectAsMediaExtension === 'function') {
    return connectAsMediaExtension(options);
  }
  // eslint-disable-next-line new-cap
  return CancelablePromise.reject(E.ILLEGAL_INVOKE(
    'connectAsMediaExtension',
    'The context is not a media extension'
  ));
}

module.exports = connectAsMediaExtension;
