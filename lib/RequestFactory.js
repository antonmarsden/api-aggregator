const http = require("http");
const https = require("https");
const URL = require("url");
const ServerInfo = require("./ServerInfo.js");
const CacheableRequest = require("cacheable-request");

const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });

class RequestFactory {

  constructor(cacheAdapter) {
    this.cacheableHttp = new CacheableRequest(http.request, cacheAdapter);
    this.cacheableHttps = new CacheableRequest(https.request, cacheAdapter);
  }

  createRequest(reqUrl, reqOpts) {
    let opts = reqUrl instanceof URL.URL ? reqUrl : URL.parse(reqUrl);
    opts = Object.assign(opts, reqOpts);
    const isHttps = opts.protocol === "https:";
    opts.agent = isHttps ? httpsAgent : httpAgent
    opts.headers = Object.assign({
      "User-Agent" : ServerInfo.userAgentName
    }, reqOpts.headers);
    return (isHttps ? this.cacheableHttps : this.cacheableHttp)(opts);
  }

}

module.exports = RequestFactory;
