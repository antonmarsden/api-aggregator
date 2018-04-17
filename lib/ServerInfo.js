const pjson = require("../package");

const userAgentName = pjson.name + " " + pjson.version;

module.exports = {
  userAgentName
};
