
// headers to pass from the inbound request to the external API
const passRequestHeaders = [
  "Accept",
  "Accept-Encoding",
  "Accept-Charset",
  "Accept-Language",
  "Cache-Control",
  "Content-Length",
  "Content-Type",
  "Date",
  "Expect",
  "If-Match",
  "If-Modified-Since",
  "If-None-Match",
  "If-Unmodified-Since",
  "Max-Forwards",
  "Pragma",
  "TE",
  "Via"
];

// headers to pass from the API response to the inbound response
const passResponseHeaders = [
  "Age",
  "Allow",
  "Cache-Control",
  "Content-Encoding",
  "Content-Language",
  "Content-Length",
  "Content-Location",
  "Content-Type",
  "Date",
  "ETag",
  "Expires",
  "Last-Modified",
  "Pragma",
  "Retry-After",
  "Transfer-Encoding",
  "Vary",
  "Via"
];

class ProxyUtils {

  static extractHeaders(r, filter) {
    const headers = {};
    for(let i = 0; i < filter.length; i++) {
      let name = filter[i].toLowerCase();
      const value = r.headers[name];
      if(value !== undefined) {
        headers[filter[i]] = value;
      }
    }
    return headers;
  }

  static extractRequestHeaders(req) {
    return this.extractHeaders(req, passRequestHeaders);
  }

  static extractResponseHeaders(res) {
    return this.extractHeaders(res, passResponseHeaders);
  }

}

module.exports = ProxyUtils;
