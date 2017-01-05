# Framework Tests

Framework Tests ensure twilio-video.js works with popular JavaScript frameworks,
such as

* Angular
* Ember
* Meteor
* React

With each of these frameworks, there are a variety of ways to use them,
complicating the task of ensuring twilio-video.js actually works with them. We
focus on the most common use cases—for example, React apps created with
`create-react-app` or Angular apps created from the Quickstart seed.

## Test Application

Each Framework Test project implements essentially the same Test Application.
The Test Application

1. Reads an Access Token from a `token` parameter in the URL,
2. Creates a Client using the `token`,
3. Connects to a new Room, and finally
4. Disconnects from the Room.

## Consuming Framework Tests

The twilio-video.js build process will

1. Reinstall each Framework Test from scratch,
2. Run any project-specific tests, and finally
3. Exercise the Test Application using Selenium.
