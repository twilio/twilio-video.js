'use strict';

console.trace("loading test/integration/index.js");
require('./spec/handoff');
require('./spec/connect');
require('./spec/docker');
require('./spec/localparticipant');
require('./spec/localtracks');
require('./spec/localtrackpublication');
require('./spec/rest');
require('./spec/room');
require('./spec/util/insightspublisher');
require('./spec/util/support');
require('./spec/util/simulcast');
