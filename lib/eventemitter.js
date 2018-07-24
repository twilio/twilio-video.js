'use strict';

const { EventEmitter } = require('events');

const { hidePrivatePropertiesInClass } = require('./util');

module.exports = hidePrivatePropertiesInClass(EventEmitter);
