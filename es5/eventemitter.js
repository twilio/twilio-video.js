'use strict';
var EventEmitter = require('events').EventEmitter;
var hidePrivateAndCertainPublicPropertiesInClass = require('./util').hidePrivateAndCertainPublicPropertiesInClass;
module.exports = hidePrivateAndCertainPublicPropertiesInClass(EventEmitter, ['domain']);
//# sourceMappingURL=eventemitter.js.map