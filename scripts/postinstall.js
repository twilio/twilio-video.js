#!/usr/bin/env node
var fs = require('fs');

fs.existsSync('node_modules/lib') || fs.symlinkSync('../lib', 'node_modules/lib', 'dir');
fs.existsSync('node_modules/test') || fs.symlinkSync('../test', 'node_modules/test', 'dir');
