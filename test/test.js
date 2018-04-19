const chai = require('chai');
const http = require("http");
const config = require("config");
const ApiAggregator = require("../lib/ApiAggregator.js");

const serverPort = 1234;
const endpointPort = 5678;

const apiConfig = config.get("ApiAggregator");
const apiAggregator = new ApiAggregator(apiConfig);

process.on("warning", (e) => console.warn(e.stack));

const server = http.createServer((req, res) => apiAggregator.serve(req, res));

describe('server', function () {
  before(function () {
    server.listen(serverPort);
  });

  after(function () {
    server.close();
  });
});
