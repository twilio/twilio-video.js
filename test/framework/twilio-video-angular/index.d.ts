declare module "twilio-video" {
  import events = require('events');

  class Client {
    constructor();
    connect(options: { token: string }): Promise<Room>;
  }

  class Room extends events.EventEmitter {
    disconnect(): void;
  }
}
