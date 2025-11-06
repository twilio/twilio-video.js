declare module 'twilio-video' {
  import events = require('events');

  function connect(token: string): Promise<Room>;

  class Room extends events.EventEmitter {
    disconnect(): void;
  }
}
