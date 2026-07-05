const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>CORS Test</title>
      <style>
        body { font-family: sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; }
        button { margin: 4px; padding: 8px 16px; cursor: pointer; }
        #result { background: #f5f5f5; padding: 16px; margin: 12px 0; border-radius: 4px; white-space: pre-wrap; font-family: monospace; }
        .error { color: red; }
        .success { color: green; }
      </style>
    </head>
    <body>
      <h1>CORS Test</h1>
      <p>Frontend: http://localhost:4002 -> API: http://localhost:4001</p>

      <h2>Test cases</h2>
      <button onclick="testSimpleGet()">1. Simple GET</button>
      <button onclick="testPostJson()">2. POST (JSON)</button>
      <button onclick="testDelete()">3. DELETE</button>
      <button onclick="testWithCredentials()">4. With Credentials</button>

      <div id="result">Results will be shown here</div>

      <script>
        const result = document.getElementById('result');

        function showResult(label, data, isError) {
          result.className = isError ? 'error' : 'success';
          result.textContent = label + '\\n' + JSON.stringify(data, null, 2);
        }

        async function testSimpleGet() {
          try {
            const res = await fetch('http://localhost:4001/api/items');
            const data = await res.json();
            showResult('[Success] GET /api/items:', data, false);
          } catch (e) {
            showResult('[CORS Error] GET /api/items:', e.message, true);
          }
        }

        async function testPostJson() {
          try {
            const res = await fetch('http://localhost:4001/api/items', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: 'Grape', price: 300 }),
            });
            const data = await res.json();
            showResult('[Success] POST /api/items:', data, false);
          } catch (e) {
            showResult('[CORS Error] POST /api/items:', e.message, true);
          }
        }

        async function testDelete() {
          try {
            const res = await fetch('http://localhost:4001/api/items/1', {
              method: 'DELETE',
            });
            showResult('[Success] DELETE /api/items/1:', { status: res.status }, false);
          } catch (e) {
            showResult('[CORS Error] DELETE /api/items/1:', e.message, true);
          }
        }

        async function testWithCredentials() {
          try {
            const res = await fetch('http://localhost:4001/api/me', {
              credentials: 'include',
            });
            const data = await res.json();
            showResult('[Success] GET /api/me (with credentials):', data, false);
          } catch (e) {
            showResult('[CORS Error] GET /api/me:', e.message, true);
          }
        }
      </script>
    </body>
    </html>
  `);
});

app.listen(4002, () => console.log("Frontend: http://localhost:4002"));

