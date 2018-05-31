const debug = require("debug")("ApiPipe");
const XmlJsonTransform = require("./XmlJsonTransform.js");
const RateLimiter = require("limiter").RateLimiter;
const StreamFactory = require("./StreamFactory.js");
const ServerInfo = require("./ServerInfo.js");
const ProxyUtils = require("./ProxyUtils.js");
const HTTPError = require("node-http-error");
const duplexChildProcess = require("duplex-child-process");

const JQ_FILTER_HEADER = "JQ-Filter";

const ApiPipe = class {

  constructor(serverUrl, requestFactory, config) {
    this.serverUrl = serverUrl;
    this.requestFactory = requestFactory;
    this.targetEndpoint = config.targetEndpoint;
    this.localEndpoint = config.localEndpoint;
    this.convertXmlToJson = config.convertXmlToJson;
    this.disableCache = config.disableCache;
    this.jqFilters = config.jqFilters;
    this.extraHeaders = config.extraHeaders;

    // Custom args to append to the request (usually API keys)
    if(config.requestArgs !== undefined) {
      let tmp = "";
      Object.keys(config.requestArgs).forEach(function (key) {
         let value = config.requestArgs[key];
         if(value === null) {
           throw Error("requestArgs." + key + " is null for local endpoint " + config.localEndpoint);
         }
         tmp += "&" + key + "=" + value;
      });
      this.requestAppend = tmp;
    }

    if(config.rateLimit !== undefined) {
      this.rateLimiter = new RateLimiter(config.rateLimit.tokensPerInterval, config.rateLimit.interval, true);
    }
  }

  _rateLimitReached(req, res) {
    // too many requests
    res.writeHead(429);
    res.end("too many requests");
  }

  _genericErrorHandler(error, req, res) {
    console.error(error);
    console.error(error.stack);
    if(!res.headersSent) {
      // remove existing headers
      res.getHeaderNames().forEach(function(name) {
        res.removeHeader(name);
      });
      // write the error
      res.writeHead(error.status || 502, { "Content-Type": "text/plain" });
      res.write(error.message || "Bad gateway");
    }
    res.end();
  }

  serve(req, res) {

    let targetUrl = this.targetEndpoint + req.url.substring(1);

    /* Handle internal URLs. TODO: Should be possible to internally route these
       requests to the appropriate ApiPipe, if it exists. */
    if(targetUrl.startsWith("/")) {
      targetUrl = this.serverUrl + targetUrl;
    }

    debug("target URL = " + targetUrl);

    const targetHeaders = ProxyUtils.extractRequestHeaders(req);

    // Filtering/converting only supports gzip encoding
    const jqFilter = req.headers[JQ_FILTER_HEADER.toLowerCase()];

    const clientAcceptsGzip = targetHeaders["Accept-Encoding"] !== undefined &&
                              targetHeaders["Accept-Encoding"].includes("gzip");

    debug("clientAcceptsGzip = " + clientAcceptsGzip);

    if(jqFilter || this.convertXmlToJson) {
      if(clientAcceptsGzip) {
        targetHeaders["Accept-Encoding"] = "gzip";
      } else {
        Reflect.deleteProperty(targetHeaders, "Accept-Encoding");
      }
    }

    if(debug.enabled) {
      debug("client request headers = " + JSON.stringify(req.headers, null, 2));
      debug("targetHeaders = " + JSON.stringify(targetHeaders));
    }

    const targetReq = this.requestFactory.createRequest(targetUrl, {
      method : req.method,
      headers: targetHeaders,
      cache : !(this.disableCache)
    });

    targetReq.on("prerequest", (opts) => {
      if(this.rateLimiter !== undefined) {
        if(!this.rateLimiter.tryRemoveTokens(1)) {
          throw new HTTPError(429, "Too many requests");
        }
      }

      /* The requestAppend content is excluded from the cache checking logic.
         It is assumed that the args are purely an authentication mechanism
         at this stage */
      if(this.requestAppend) {
        opts.search += this.requestAppend;
        opts.query += this.requestAppend;
        opts.path += this.requestAppend;
        opts.href += this.requestAppend;
      }

      /* As with requestAppend, extra headers are excluded from the cache checking
         logic. */
      if(this.extraHeaders) {
        let tmp = this.extraHeaders;
        Object.keys(tmp).forEach(function(key) {
          let value = tmp[key];
          if(value === null) {
            throw Error("extraHeaders." + key + " is null");
          }
          opts.headers[key] = tmp[key];
        });
      }

    });
    targetReq.on("request", (r) => {
      r.on("error", (error) => {
        console.error("API request error: " + error);
      });
      req.pipe(r);
    });

    const genericErrorHandler = this._genericErrorHandler.bind(this);

    targetReq.on("error", (error) => {
      genericErrorHandler(error, req, res);
    });

    const convertXmlToJson = this.convertXmlToJson;
    let jqFilterLogic = null;
    if(jqFilter) {
      jqFilterLogic = this.jqFilters[jqFilter];
      if(!jqFilterLogic) {
        throw new HTTPError(412, "jqFilter named " + jqFilter + " not found");
      }
    }

    targetReq.on("response", function(response) {

        debug("fromCache = " + response.fromCache);

        const contentType = response.headers["content-type"];
        const contentEncoding = response.headers["content-encoding"];

        if(debug.enabled) {
          debug("API response headers: " + JSON.stringify(response.headers, null, 2));
        }

        let pipeChain = [response];

        const responseHeaders = ProxyUtils.extractResponseHeaders(response);
        responseHeaders.Server = ServerInfo.userAgentName;

        if(debug.enabled) {
          debug("response code = " + response.statusCode + " (" + response.statusMessage + ")");
        }

        res.statusCode = response.statusCode;
        res.statusMessage = response.statusMessage;

        if(convertXmlToJson && contentType.startsWith("text/xml")) {

          responseHeaders["Content-Type"] = "application/json;charset=UTF-8";

          Reflect.deleteProperty(responseHeaders, "Content-Length");
          Reflect.deleteProperty(responseHeaders, "Content-MD5");

          if(contentEncoding === "gzip") {
            pipeChain.push(StreamFactory.createGunzipMaybe());
          }

          pipeChain.push(new XmlJsonTransform());

          if(clientAcceptsGzip) {
            pipeChain.push(StreamFactory.createGzipMaybe());
            responseHeaders["Content-Encoding"] = "gzip";
          }
        }

        // Ensure that we check the latest Content-Type (the xml-json transform may have been applied)
        if(jqFilter && responseHeaders["Content-Type"].startsWith("application/json")) {
          if(contentEncoding === "gzip") {
            pipeChain.push(StreamFactory.createGunzipMaybe());
          }
          Reflect.deleteProperty(responseHeaders, "Content-Length");
          Reflect.deleteProperty(responseHeaders, "Content-MD5");
          debug("Applying jqFilter " + jqFilter);
          const cp = duplexChildProcess.spawn("bin/jq", [
            "-c",
            jqFilterLogic
          ]);
          pipeChain.push(cp);

          // Add JQ_FILTER_HEADER to the Vary header
          if(responseHeaders.Vary === undefined) {
            responseHeaders.Vary = JQ_FILTER_HEADER;
          } else {
            responseHeaders.Vary += ", " + JQ_FILTER_HEADER;
          }

          if(clientAcceptsGzip) {
            pipeChain.push(StreamFactory.createGzipMaybe());
            responseHeaders["Content-Encoding"] = "gzip";
          }
        }

        if(debug.enabled) {
          debug("Outgoing response headers: " + JSON.stringify(responseHeaders, null, 2));
        }

        Object.keys(responseHeaders).forEach(function(key) {
          res.setHeader(key, responseHeaders[key]);
        });

        for(let i = 0; i < pipeChain.length - 1; i++) {
          pipeChain[i].pipe(pipeChain[i+1]);
        }

        pipeChain[pipeChain.length - 1].pipe(res);

        for(let i = 0; i < pipeChain.length; i++) {
          pipeChain[i].on("error", (error) => {
            genericErrorHandler(error, req, res);
          });
        }

      });

  }

}

module.exports = ApiPipe;
