const debug = require("debug")("ApiAggregator");
const RequestFactory = require("./RequestFactory.js");
const ApiPipe = require("./ApiPipe.js");
const mustache = require("mustache");
const fs = require("fs");

class ApiAggregator {

  constructor(config) {
    this.listenPort = 3000;
    this.pipes = {};
    this.disabledPipes = [];
    if(config !== undefined) {
      this.listenPort = config.listenPort || 3000;
      let serverUrl = "http://localhost:" + this.listenPort;
      let requestFactory = new RequestFactory(config.cacheAdapter);
      Object.keys(config.pipes).forEach((k) => {
        let pipeConf = config.pipes[k];
        if(pipeConf.enabled === undefined || pipeConf.enabled === true) {
          this.pipes[pipeConf.localEndpoint] = new ApiPipe(serverUrl, requestFactory, pipeConf);
        } else {
          this.disabledPipes.push(pipeConf.localEndpoint);
        }
      });
    }
    this.usage = "";
    if(config.usageTemplateFile !== undefined) {
      const text = fs.readFileSync(config.usageTemplateFile, "utf8");
      let templateVars = JSON.parse(JSON.stringify(config.pipes));
      templateVars = Object.values(templateVars);
      templateVars.forEach((v) => {
        v.enabled = (v.enabled === undefined || v.enabled === true);
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
    let targetPipe = this.pipes[pipeKey];
    if(targetPipe !== undefined) {
      let pipeUrl = req.url.replace(pipeKey, "/");
      debug("pipeUrl = " + pipeUrl);
      req.url = pipeUrl;
      this.pipes[pipeKey].serve(req, res);
    } else if (this.disabledPipes.includes(pipeKey)) {
      this._pipeDisabled(req, res);
    } else {
      this._notFound(req, res);
    }
  }

  _provideUsageInfo(req, res) {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(this.usage);
  }

  _pipeDisabled(req, res) {
    // no match found
    res.writeHead(401);
    res.end("This API pipe is currently disabled");
  }

  _notFound(req, res) {
    // no match found
    res.writeHead(404);
    res.end("mapping for " + req.url + " not found");
  }

}

module.exports = ApiAggregator;
