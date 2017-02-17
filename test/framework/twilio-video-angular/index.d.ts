declare module "twilio-video" {
  import events = require('events');

  function connect(options: { token: string }): Promise<Room>;

  class Room extends events.EventEmitter {
    disconnect(): void;
  }
}
