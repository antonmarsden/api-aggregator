const http = require("http");
const ApiAggregator = require("./lib/ApiAggregator.js");
const config = require("config");

const apiConfig = config.get("ApiAggregator");
const apiAggregator = new ApiAggregator(apiConfig);

process.on("warning", (e) => console.warn(e.stack));

const server = http.createServer((req, res) => apiAggregator.serve(req, res));
server.on("error", (err) => console.error("Detected error on server: " + err));
console.log("Starting ApiAggregator on port " + apiAggregator.listenPort);
server.on("listening", () => console.log("ApiAggregator listening on port " + apiAggregator.listenPort));
server.listen(apiAggregator.listenPort);
