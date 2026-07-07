const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="UTF-8"><title>Header Check</title></head>
    <body>
      <h1>Security Headers Test</h1>
      <p>Check the response headers in the Network tab of DevTools.</p>
      <pre id="headers"></pre>
      <script>
        fetch(location.href).then(res => {
          const headers = {};
          res.headers.forEach((v, k) => headers[k] = v);
          document.getElementById('headers').textContent = JSON.stringify(headers, null, 2);
        });
      </script>
    </body>
    </html>
  `);
});

app.listen(3000);