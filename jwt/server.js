const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");

const app = express();
app.use(express.json());
app.use(cookieParser());

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

const users = new Map();
const tokenBlacklist = new Set();
const refreshTokens = new Map();

app.post("/auth/register", async (req, res) => {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
        return res.status(400).json({ error: "All fields are required" });
    }
    if (password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    if (users.has(email)) {
        return res.status(409).json({ error: "This email address is already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const id = crypto.randomUUID();
    users.set(email, { id, name, passwordHash });
    res.status(201).json({ message: "Registration complete", user: { id, name, email } });
})

app.post("/auth/login", async (req, res) => {
    const { email, password } = req.body;
    const user = users.get(email);

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        return res.status(401).json({ error: "Authentication failed" });
    }

    const accessToken = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "15m" });
    const refreshToken = jwt.sign({ id: user.id }, JWT_REFRESH_SECRET, { expiresIn: "7d" });

    refreshTokens.set(user.id, refreshToken);

    res.cookie("refresh_token", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: "/auth/refresh",
    });
    
    res.json({
        accessToken,
        expiresIn: 900,
        user: { id: user.id, email, name: user.name },
    });
})

app.post("/auth/refresh", (req, res) => {
    const refreshToken = req.cookies.refresh_token;

    if (!refreshToken) {
      return res.status(401).json({ error: "No refresh token" });
    }

    try {
        const payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
        const storedToken = refreshTokens.get(payload.id);

        if (storedToken !== refreshToken) {
            refreshTokens.delete(payload.id);
            return res.status(401).json({ error: "Invalid refresh token" });
        }

        const user = [...users.values()].find(u => u.id === payload.id);

        if (!user) {
            return res.status(401).json({ error: "User not found" });
        }

        const newAccessToken = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "15m" });
        const newRefreshToken = jwt.sign({ id: user.id }, JWT_REFRESH_SECRET, { expiresIn: "7d" });

        refreshTokens.set(user.id, newRefreshToken);

        res.cookie("refresh_token", newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "Strict",
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: "/auth/refresh",
        });

        res.json({ accessToken: newAccessToken, expiresIn: 900 });
    } catch (error) {
        return res.status(401).json({ error: "Invalid refresh token" });
    }
})

app.post("/auth/logout", authenticateToken, (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    tokenBlacklist.add(token);
    refreshTokens.delete(req.user.id);
    res.clearCookie("refresh_token", { path: "/auth/refresh" });
    res.json({ message: "Logout complete" });
})

function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Invalid authorization header" });
    }

    const token = authHeader.split(" ")[1];

    if (tokenBlacklist.has(token)) {
        return res.status(401).json({ error: "Invalid token" });
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = payload;
        next()
    } catch(error) {
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({ error: "Token has expired", code: "TOKEN_EXPIRED" });
        }

        return res.status(401).json({ error: "Invalid token" });
    }
}

app.get("/api/profile", authenticateToken, (req, res) => {
    res.json({
        message: "Authenticated data",
        user: req.user,
        serverTime: new Date().toISOString(),
    });
});

app.get("/", (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>JWT Auth Test</title>
        <style>
          body { font-family: sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; }
          input { display: block; width: 100%; padding: 8px; margin: 4px 0; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
          button { margin: 4px; padding: 8px 16px; cursor: pointer; background: #0066cc; color: white; border: none; border-radius: 4px; }
          button.danger { background: #cc3333; }
          #log { background: #1e1e1e; color: #d4d4d4; padding: 16px; border-radius: 4px; font-family: monospace; font-size: 13px; white-space: pre-wrap; max-height: 500px; overflow-y: auto; }
          .section { border: 1px solid #ddd; padding: 16px; margin: 12px 0; border-radius: 4px; }
        </style>
      </head>
      <body>
        <h1>JWT Auth Test</h1>
  
        <div class="section">
          <h2>1. Register</h2>
          <input id="reg-name" placeholder="Name">
          <input id="reg-email" placeholder="Email address">
          <input id="reg-password" type="password" placeholder="Password (8+ characters)">
          <button onclick="register()">Register</button>
        </div>
  
        <div class="section">
          <h2>2. Login</h2>
          <input id="login-email" placeholder="Email address">
          <input id="login-password" type="password" placeholder="Password">
          <button onclick="login()">Login</button>
        </div>
  
        <div class="section">
          <h2>3. Actions</h2>
          <button onclick="getProfile()">Get profile</button>
          <button onclick="refreshToken()">Refresh token</button>
          <button onclick="logout()" class="danger">Logout</button>
        </div>
  
        <h2>Log</h2>
        <div id="log"></div>
  
        <script>
          let accessToken = null;
  
          function log(label, data) {
            const el = document.getElementById('log');
            const time = new Date().toLocaleTimeString('en-US');
            el.textContent += '[' + time + '] ' + label + '\\n';
            if (data) el.textContent += JSON.stringify(data, null, 2) + '\\n';
            el.textContent += '---\\n';
            el.scrollTop = el.scrollHeight;
          }
  
          async function register() {
            const res = await fetch('/auth/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: document.getElementById('reg-name').value,
                email: document.getElementById('reg-email').value,
                password: document.getElementById('reg-password').value,
              }),
            });
            log('Register', await res.json());
          }
  
          async function login() {
            const res = await fetch('/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: document.getElementById('login-email').value,
                password: document.getElementById('login-password').value,
              }),
            });
            const data = await res.json();
            if (data.accessToken) {
              accessToken = data.accessToken;
              const parts = accessToken.split('.');
              const payload = JSON.parse(atob(parts[1]));
              log('Login success', data);
              log('JWT payload', payload);
              log('Expires at', new Date(payload.exp * 1000).toLocaleString('en-US'));
            } else {
              log('Login failed', data);
            }
          }
  
          async function getProfile() {
            const res = await fetch('/api/profile', {
              headers: { Authorization: 'Bearer ' + accessToken },
            });
            log('Get profile (' + res.status + ')', await res.json());
          }
  
          async function refreshToken() {
            const res = await fetch('/auth/refresh', {
              method: 'POST',
              credentials: 'include',
            });
            const data = await res.json();
            if (data.accessToken) {
              accessToken = data.accessToken;
              log('Refresh success', data);
            } else {
              log('Refresh failed', data);
            }
          }
  
          async function logout() {
            const res = await fetch('/auth/logout', {
              method: 'POST',
              headers: { Authorization: 'Bearer ' + accessToken },
              credentials: 'include',
            });
            const data = await res.json();
            accessToken = null;
            log('Logout', data);
          }
        </script>
      </body>
      </html>
    `);
  });
  
  app.listen(4020, () => console.log("JWT Lab: http://localhost:4020"));
  
  
