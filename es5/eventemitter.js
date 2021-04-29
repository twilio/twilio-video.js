'use strict';

var _require = require('events'),
    EventEmitter = _require.EventEmitter;

var _require2 = require('./util'),
    hidePrivateAndCertainPublicPropertiesInClass = _require2.hidePrivateAndCertainPublicPropertiesInClass;

module.exports = hidePrivateAndCertainPublicPropertiesInClass(EventEmitter, ['domain']);