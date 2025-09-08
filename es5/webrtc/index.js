'use strict';
var WebRTC = {};
Object.defineProperties(WebRTC, {
    getStats: {
        enumerable: true,
        value: require('./getstats')
    },
    getUserMedia: {
        enumerable: true,
        value: require('./getusermedia')
    },
    MediaStream: {
        enumerable: true,
        value: require('./mediastream')
    },
    MediaStreamTrack: {
        enumerable: true,
        value: require('./mediastreamtrack')
    },
    RTCIceCandidate: {
        enumerable: true,
        value: require('./rtcicecandidate')
    },
    RTCPeerConnection: {
        enumerable: true,
        value: require('./rtcpeerconnection')
    },
    RTCSessionDescription: {
        enumerable: true,
        value: require('./rtcsessiondescription')
    }
});
module.exports = WebRTC;
//# sourceMappingURL=index.js.map