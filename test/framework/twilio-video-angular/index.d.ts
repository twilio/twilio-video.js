declare module "twilio-video" {
  import events = require('events');

  class Client extends events.EventEmitter {
    constructor(token: string);

    connect(): Promise<Room>;
  }

  class Room extends events.EventEmitter {
    disconnect(): void;
  }
}
