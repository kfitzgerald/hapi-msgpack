# hapi-msgpack

HAPI plugin that automatically encodes response payloads and decodes request payloads. 

[![Build Status](https://travis-ci.org/kfitzgerald/hapi-msgpack.svg?branch=master)](https://travis-ci.org/kfitzgerald/hapi-msgpack) [![Coverage Status](https://coveralls.io/repos/github/kfitzgerald/hapi-msgpack/badge.svg?branch=master)](https://coveralls.io/github/kfitzgerald/hapi-msgpack?branch=master)

## Installing

This plugin is compatible with most HAPI versions. 

 * hapi-msgpack v2.x+ support HAPI 17+. 
 * hapi-msgpack v1.x support HAPI 16 and earlier. 

## HAPI 17+

```sh
npm install hapi-msgpack
```

or using Yarn:

```sh
yarn add hapi-msgpack
```

## HAPI 16+

```sh
npm install hapi-msgpack@^1.x.x
```

or using Yarn:

```sh
yarn add hapi-msgpack@^1.x.x
```

## Usage

Register the plugin like so:

```js
const server = new Hapi.Server();
const plugin = {
    plugin: require('hapi-msgpack'),
    options: {
        mimeType: 'application/x-msgpack'
    }
};

await server.register(plugin);
await server.start();

// ... off you go ...

```

Options are entirely optional. Defaults are:
 * `mimeType`: `application/x-msgpack` – Change this if you wish to use a different mime-type for MessagePack requests/responses.
 
And that's about it. The plugin hooks into the request and reponse process, so you don't need to add any special 
handling of MessagePack data. It's decoded as if it were sent as JSON in the first place.

## Notes

Internal Error Handling
 * The plugin will `request.log` an error and return `400 Bad Request` if the message pack data is corrupt. The event tags are: `['error','msgpack','decode']`
 * The plugin will `request.log` a warning if the request payload is not decode-able. The event tags are: `['warning','msgpack','decode']`
  
Route Validation
 * Since the payload is decoded before validation, your typical route validation schemes work as expected.
 
Code Quality
 * 100% code coverage via unit tests
 
## Testing

To run the full test suite:

```sh
npm run report
```

This will perform:
* Unit tests
* Code coverage report
* Code linting

All of the built-in test scripts are:

 * `npm run clean` – Removes code coverage directories
 * `npm run test` – Runs unit tests
 * `npm run cover` – Runs unit tests with code coverage
 * `npm run lint` – Runs eslint code rules checks
 * `npm run report` – Runs unit tests with code coverage and code rules checks
 
 
When contributing, please ensure your changes are 100% covered by tests. 