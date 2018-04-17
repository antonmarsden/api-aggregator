# api-aggregator

An API gateway that provides rate limiting and caching for configurable endpoints. It has certain advantages over connecting directly to the endpoints from each application:
- Centralised API key management
- API keys are hidden from gateway clients
- **Shared** web cache that stores HTTP(S) responses for re-use
- Rate limits can be applied to **remote** endpoints to enforce API free usage limits or to "protect" the endpoint from unintended abuse.

This gateway has been designed to be:
- easily configurable
- fairly minimal
- used by multiple applications within an internal network

## Limitations

- Caching is only done in memory, as is rate limiting. A server restart will obliterate all state.
- This gateway does not provide any authentication or authorisation for the gateway clients.  Take a look at at [express gateway](https://www.express-gateway.io/) if you need advanced features.

## Running locally

Make sure you have [Node.js](http://nodejs.org/) installed.

```sh
git clone https://github.com/antonmarsden/api-aggregator.git
cd api-aggregator
npm install
npm start
```

The app should now be running on [localhost:3080](http://localhost:3080).

You can see a list of the available endpoints in the browser. The endpoints are disabled by default.

## Running with Docker

A Dockerfile is provided. Documentation to come.

## Configuring

To modify the configuration, you can use the various available in the
[config module](http://lorenwest.github.io/node-config/).
An easy way to start is to create a new configuration override file called **config/local.json**.
The content might look something like this:

```
{
  "ApiAggregator" : {
    "pipes" : {
      "geonames.org" : {
        "enabled" : true,
        "requestArgs" : {
          "username" : "demo"
        }
      }
    }
  }
}
```

In some cases you will need to define extra request arguments (usually API keys) so that the remote API server can identify you. The **geonames.org** API is an example of this, so you should replace the **demo** username above with your own username (you can apply for one [here](http://www.geonames.org/login)).

You will need to restart the server for the configuration changes to take effect.

## Custom endpoints

You can create your own endpoints by following the patterns given in default.json.

Beyond the basic local to remote URL mapping, the following capabilities are provided:
- Mapping a local endpoint to another local endpoint (see the **api.met.no-json** definition for an example).
- Enabling and disabling of endpoints (enabled by default).
- Caching of responses, enabled by default. You can disable the cache on an endpoint using **disableCache : false**.
- Basic rate limiting, e.g,
```
"rateLimit" : {
  "tokensPerInterval" : 1000,
  "interval" : "hour"
}
```
- Transforming XML to JSON. Note that the current implementation stores the raw response (XML) in the cache rather than the transformed data (JSON).
- API usage examples can be provided within the JSON configuration, and will appear on the main page if the endpoint is enabled.
