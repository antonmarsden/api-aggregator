const RequestFactory = require("./RequestFactory.js");
const ApiPipe = require("./ApiPipe.js");
const mustache = require("mustache");
const fs = require("fs");

class ApiAggregator {

  constructor(config) {
    this.listenPort = 3000;
    this.pipes = {};
    if(config !== undefined) {
      this.listenPort = config.listenPort || 3000;
      let serverUrl = "http://localhost:" + this.listenPort;
      let requestFactory = new RequestFactory(config.cacheAdapter);
      Object.keys(config.pipes).forEach((k) => {
        let pipeConf = config.pipes[k];
        if(pipeConf.enabled) {
          this.pipes[pipeConf.localEndpoint] = new ApiPipe(serverUrl, requestFactory, pipeConf);
        }
      });
    }
    this.usage = "";
    if(config.usageTemplateFile !== undefined) {
      const text = fs.readFileSync(config.usageTemplateFile, "utf8");
      let templateVars = JSON.parse(JSON.stringify(config.pipes));
      templateVars = Object.values(templateVars);
      templateVars.forEach((v) => {
        if(v.examples) {
          let tmp = [];
          Object.keys(v.examples).forEach((k) => {
            tmp.push({
              name: k,
              "url": v.examples[k]
            });
          });
          v.examples = tmp;
        }
      });
      this.usage = mustache.render(text, templateVars);
    }
  }

  serve(req, res) {
    if(req.url === "/") {
      this._provideUsageInfo(req, res);
      return;
    }
    // get the first part of the path
    let pipeKey = "/" + req.url.split("/")[1] + "/";
    if(this.pipes[pipeKey]) {
      this.pipes[pipeKey].serve(req, res);
    } else {
      this._notFound(req, res);
    }
  }

  _provideUsageInfo(req, res) {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(this.usage);
  }

  _notFound(req, res) {
    // no match found
    res.writeHead(404);
    res.end("mapping for " + req.url + " not found");
  }

}

module.exports = ApiAggregator;
