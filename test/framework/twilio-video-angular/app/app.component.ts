import { Room, connect } from 'twilio-video';
import { Component, OnInit } from '@angular/core';

/**
 * Get a {@link Location}'s query parameters.
 * @param {Location} location
 * @returns {Map<string, Array<string>>} queryParameters
 */
function getQueryParameters(location: Location): Map<string, Array<string>> {
  return (location.search.split('?')[1] || '').split('&').reduce((queryParameters, keyValuePair) => {
    let [key, value] = keyValuePair.split('=');
    key = decodeURIComponent(key);
    value = decodeURIComponent(value);
    queryParameters.set(key, (queryParameters.get(key) || []).concat([value]));
    return queryParameters;
  }, new Map());
}

@Component({
  selector: 'my-app',
  template: `<pre *ngIf="error"><code>{{error.stack}}</code></pre>
<p *ngIf="!error && !room">Connecting to a new Room&hellip;</p>
<p *ngIf="room && room.state === 'disconnected'">Disconnected from Room {{room.sid}}.</p>
<p *ngIf="room && room.state !== 'disconnected'">Connected to Room {{room.sid}}.</p>`
})
export class AppComponent implements OnInit {
  room: Room;
  error: Error;

  ngOnInit() {
    const token = (getQueryParameters(location).get('token') || [])[0];
    if (!token) {
      this.error = new Error('Token is required');
      return;
    }

    connect(token).then(room => {
      this.room = room;
      room.once('disconnected', () => {});
      room.disconnect();
    }, error => {
      this.error = error;
    });
  }
}
