'use strict';

const { EventEmitter } = require('events');

const { hidePrivateAndCertainPublicPropertiesInClass } = require('./util');

module.exports = hidePrivateAndCertainPublicPropertiesInClass(EventEmitter, ['domain']);
