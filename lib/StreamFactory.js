const duplex = require("duplexify");
const through = require("through2");
const zlib = require("zlib");

class StreamFactory {

  static createGunzipMaybe() {
    var stream = duplex();
    var peeker = through(function (chunk) {
      var newStream = zlib.createGunzip();
      stream.setReadable(newStream);
      stream.setWritable(newStream);
      stream.write(chunk);
    });
    stream.setReadable(peeker);
    stream.setWritable(peeker);
    return stream;
  }

  static createGzipMaybe() {
    var stream = duplex();
    var peeker = through(function (chunk) {
      var newStream = zlib.createGzip();
      stream.setReadable(newStream);
      stream.setWritable(newStream);
      stream.write(chunk);
    });
    stream.setReadable(peeker);
    stream.setWritable(peeker);
    return stream;
  }
}

module.exports = StreamFactory;
