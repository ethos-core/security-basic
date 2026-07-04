const express = require("express");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const app = express();

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const users = {
  alice: { balance: 100000, password: "pass123" },
};

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (users[username]?.password === password) {
    res.cookie("user", username, {
      httpOnly: true,
      sameSite: "Strict",
    });
    res.redirect("/dashboard");
  }
});

app.get("/dashboard", (req, res) => {
  const user = req.cookies.user;
  if (!user || !users[user]) return res.redirect("/");

  const csrfToken = generateToken();
  res.cookie("csrf_token", csrfToken, { sameSite: "Strict" });

  res.send(`
    <h1>${user}'s account</h1>
    <p>Balance: ¥${users[user].balance.toLocaleString()}</p>
    <h2>Transfer</h2>
    <form method="POST" action="/transfer">
      <input type="hidden" name="_csrf" value="${csrfToken}">
      <input name="to" placeholder="Recipient">
      <input name="amount" type="number" placeholder="Amount">
      <button type="submit">Transfer</button>
    </form>
  `);
});

app.post("/transfer", (req, res) => {
  const origin = req.headers.origin || req.headers.referer;

  if (!origin || !origin.startsWith("http://localhost:4010")) {
    return res.status(403).send("Invalid origin: unauthorized request");
  }

  const user = req.cookies.user;
  if (!user) return res.status(401).send("Unauthorized");

  const cookieToken = req.cookies.csrf_token;
  const formToken = req.body._csrf;

  if (!cookieToken || cookieToken !== formToken) {
    return res.status(403).send("CSRF verification failed: invalid request");
  }

  const { to, amount } = req.body;
  const value = parseInt(amount);

  if (users[user].balance >= value) {
    users[user].balance -= value;
    console.log(`Transfer complete: ${user} -> ${to}: ¥${value}`);
    res.send(`Transfer complete: sent ¥${value} to ${to}. Balance: ¥${users[user].balance}`);
  } else {
    res.status(400).send("Insufficient balance");
  }
});

app.get("/", (req, res) => {
  res.send(`
    <h1>Bank Login</h1>
    <form method="POST" action="/login">
      <input name="username" placeholder="Username">
      <input name="password" type="password" placeholder="Password">
      <button>Login</button>
    </form>
  `);
});

app.listen(4010, () => console.log("Victim: http://localhost:4010"));