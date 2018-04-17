const stream = require("stream");
const XML = require("pixl-xml");

class XmlJsonTransform extends stream.Transform {

  constructor(xmlOptions) {
    super({
      writableObjectMode : false,
      readableObjectMode : false
    });
    this.xmlOptions = xmlOptions;
    this.bufferList = {
      list: [],
      totalLength: 0
    }
  }

  _reset() {
    this.bufferList.list = [];
    this.bufferList.totalLength = 0;
  }

  _transform(chunk, encoding, next) {
    this.bufferList.list.push(chunk);
    this.bufferList.totalLength = this.bufferList.totalLength + chunk.length;
    next();
  }

  _final(done) {
    try {
      if(this.bufferList.totalLength > 0) {
        const xmlBuffer = Buffer.concat(this.bufferList.list, this.bufferList.totalLength);
        const json = XML.parse(xmlBuffer, this.xmlOptions);
        const jsonString = JSON.stringify(json);
        this.push(jsonString);
      } else {
        this.end();
      }
      done();
    } catch(e) {
      done(e);
    } finally {
      this._reset();
    }
  }

}

module.exports = XmlJsonTransform;
