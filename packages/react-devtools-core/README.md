# `react-devtools-core`

A standalone React DevTools implementation.

This is a low-level package. If you're looking for the Electron app you can run, **use `react-devtools` package instead.**

## API

### `react-devtools-core`

This is similar requiring the `react-devtools` package, but provides several configurable options. Unlike `react-devtools`, requiring `react-devtools-core` doesn't connect immediately but instead exports a function:

```js
const { connectToDevTools } = require("react-devtools-core");
connectToDevTools(config);
```

Run `connectToDevTools()` in the same context as React to set up a connection to DevTools.  
Be sure to run this function *before* importing e.g. `react`, `react-dom`, `react-native`.

The `config` object may contain:
| Name                    | Type                         | Default            | Description                                                                                            |
|-------------------------|------------------------------|--------------------|--------------------------------------------------------------------------------------------------------|
| `host`                  | `string`                     | `"localhost"`      | Websocket will connect to this host.                                                                   |
| `port`                  | `number`                     | `8097`             | Websocket will connect to this port.                                                                   |
| `websocket`             | `WebSocket`                  |                    | Custom `WebSocket` to use. Overrides `host` and `port` settings if provided.                           |
| `isAppActive`           | `() => boolean`              |                    | If provided, DevTools will poll this method and wait until it returns true before connecting to React. |
| `retryInterval`         | `number`                     | `2000`             | Amount of time (in ms) to wait before retrying a failed connection.                                    |
| `maxConnectionAttempts` | `number`                     | `Number.MAX_VALUE` | Maximum number of times to try connecting to DevTools before giving up.                                |
| `resolveRNStyle`        | `(style: number) => ?Object` |                    | Used by the React Native style plug-in.                                                                |

## `react-devtools-core/standalone`

Renders the DevTools interface into a DOM node.

```js
require("react-devtools-core/standalone")
  .setContentDOMNode(document.getElementById("container"))
  .setStatusListener(status => {
    // This callback is optional...
  })
  .startServer(port);
```

Reference the `react-devtools` package for a complete integration example.

## Development

Watch for changes made to the backend entry point and rebuild:
```sh
yarn start:backend
```

Watch for changes made to the standalone UI entry point and rebuild:
```sh
yarn start:standalone
```