Endpoint = typeof Twilio === 'undefined'
         ? require('../../lib/endpoint')
         : Twilio.Endpoint;

/*
getToken = typeof getToken === 'undefined'
         ? require('../token').getLiveToken
         : getToken;
         */

describe('Endpoint', function() {
  this.timeout(30 * 1000); // 30 seconds
  
  function createEndpoint(name) {
    /*return getToken(process.env.accountSid, process.env.authToken, name)
      .then(function(token) {
        var endpoint = new Endpoint(token, {
          register: false
        });
        return endpoint.register();
      });*/
    var token = {
      "capability_token": "eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJpc3MiOiAiQUM5NmNjYzkwNDc1M2IzMzY0ZjI0MjExZThkOTc0NmE5MyIsICJzY29wZSI6ICJzY29wZTpjbGllbnQ6b3V0Z29pbmc_YXBwU2lkPUFQMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAiLCAiZXhwIjogMTQyNDM4NzE0NH0.hwuENHlfsXP547SihJ7ylTbpFfYOwBiWnPuxROX8g4Q",
      "stun_turn_token": {
        "username": "3d86a32a6a46c2792f2dc23e9214d3d744069844f39c61ec99b72a31eeafc8b6",
        "password": "1Pgc4/KVwZRZ52BX6FQBGMk1QUrgNVI6Knm6kLfKJFM=",
        "date_updated": "Thu, 19 Feb 2015 22:05:44 +0000",
        "account_sid": "AC96ccc904753b3364f24211e8d9746a93",
        "ttl": "86400",
        "date_created": "Thu, 19 Feb 2015 22:05:44 +0000",
        "ice_servers": [{
          "url": "stun:global.stun.twilio.com:3478?transport=udp"
        }, {
          "url": "turn:global.turn.twilio.com:3478?transport=udp",
          "username": "3d86a32a6a46c2792f2dc23e9214d3d744069844f39c61ec99b72a31eeafc8b6",
          "credential": "1Pgc4/KVwZRZ52BX6FQBGMk1QUrgNVI6Knm6kLfKJFM="
        }]
      }
    };
    // var endpoint = new Endpoint(JSON.stringify(token), {
    //   register: false
    // });
    // return endpoint.register();
  }

  describe('constructor', function(done) {
    // createEndpoint('alice')
    //   .then(function() {
    //     done();
    //   }, done);
  });

});
