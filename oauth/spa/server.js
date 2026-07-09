const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>OAuth 2.0 + PKCE Demo SPA</title>
      <style>
        body { font-family: sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; }
        button { margin: 4px; padding: 10px 20px; cursor: pointer; background: #4CAF50; color: white; border: none; border-radius: 4px; font-size: 14px; }
        button:disabled { background: #ccc; cursor: not-allowed; }
        button.danger { background: #f44336; }
        #log { background: #1e1e1e; color: #d4d4d4; padding: 16px; border-radius: 4px; font-family: monospace; font-size: 13px; white-space: pre-wrap; max-height: 500px; overflow-y: auto; margin-top: 16px; }
        .section { border: 1px solid #ddd; padding: 16px; margin: 12px 0; border-radius: 4px; }
        .status { padding: 8px 12px; border-radius: 4px; margin: 8px 0; }
        .status.authenticated { background: #e8f5e9; color: #2e7d32; }
        .status.unauthenticated { background: #fbe9e7; color: #c62828; }
      </style>
    </head>
    <body>
      <h1>OAuth 2.0 + PKCE Demo</h1>
      <div id="auth-status" class="status unauthenticated">Not authenticated</div>

      <div class="section">
        <h2>1. Authorization flow</h2>
        <button onclick="startAuth()">Login (start PKCE flow)</button>
        <button onclick="logout()" class="danger">Logout</button>
      </div>

      <div class="section">
        <h2>2. API access</h2>
        <button onclick="getUserInfo()">Get user info</button>
        <button onclick="getProtectedData()">Get protected data</button>
        <button onclick="refreshAccessToken()">Refresh token</button>
      </div>

      <h2>Log</h2>
      <div id="log"></div>

      <script>
        const AUTH_SERVER = "http://localhost:4040";
        const RESOURCE_SERVER = "http://localhost:4041";
        const CLIENT_ID = "spa-client";
        const REDIRECT_URI = "http://localhost:4042/callback";

        let accessToken = null;
        let refreshToken = null;

        function log(label, data) {
          const el = document.getElementById("log");
          const time = new Date().toLocaleTimeString("en-US");
          el.textContent += "[" + time + "] " + label + "\\n";
          if (data) el.textContent += JSON.stringify(data, null, 2) + "\\n";
          el.textContent += "---\\n";
          el.scrollTop = el.scrollHeight;
        }

        function updateStatus() {
          const el = document.getElementById("auth-status");
          if (accessToken) {
            el.className = "status authenticated";
            el.textContent = "Authenticated (access token acquired)";
          } else {
            el.className = "status unauthenticated";
            el.textContent = "Not authenticated";
          }
        }

        // --- PKCE utilities ---
        function generateRandomString(length) {
          const array = new Uint8Array(length);
          crypto.getRandomValues(array);
          return base64UrlEncode(array);
        }

        function base64UrlEncode(buffer) {
          const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
          let str = "";
          for (let i = 0; i < bytes.length; i++) {
            str += String.fromCharCode(bytes[i]);
          }
          return btoa(str).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/, "");
        }

        async function generateCodeChallenge(verifier) {
          const encoder = new TextEncoder();
          const data = encoder.encode(verifier);
          const digest = await crypto.subtle.digest("SHA-256", data);
          return base64UrlEncode(new Uint8Array(digest));
        }

        // --- Start authorization flow ---
        async function startAuth() {
          const codeVerifier = generateRandomString(32);
          const state = generateRandomString(16);
          const codeChallenge = await generateCodeChallenge(codeVerifier);

          sessionStorage.setItem("pkce_code_verifier", codeVerifier);
          sessionStorage.setItem("oauth_state", state);

          log("Generated PKCE parameters", {
            code_verifier: codeVerifier,
            code_challenge: codeChallenge,
            state: state,
          });

          const params = new URLSearchParams({
            response_type: "code",
            client_id: CLIENT_ID,
            redirect_uri: REDIRECT_URI,
            state: state,
            code_challenge: codeChallenge,
            code_challenge_method: "S256",
            scope: "openid profile",
          });

          const authUrl = AUTH_SERVER + "/authorize?" + params.toString();
          log("Redirecting to authorization server", { url: authUrl });
          window.location.href = authUrl;
        }

        // --- Token acquisition ---
        async function exchangeCodeForToken(code, state) {
          const savedState = sessionStorage.getItem("oauth_state");
          if (state !== savedState) {
            log("Error: state parameter mismatch (possible CSRF attack)", {
              expected: savedState,
              received: state,
            });
            return;
          }
          log("state verification succeeded", { state });

          const codeVerifier = sessionStorage.getItem("pkce_code_verifier");
          if (!codeVerifier) {
            log("Error: code_verifier not found");
            return;
          }

          log("Sending token request", {
            grant_type: "authorization_code",
            code: code.substring(0, 16) + "...",
            code_verifier: codeVerifier.substring(0, 16) + "...",
          });

          const res = await fetch(AUTH_SERVER + "/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              grant_type: "authorization_code",
              code: code,
              redirect_uri: REDIRECT_URI,
              client_id: CLIENT_ID,
              code_verifier: codeVerifier,
            }),
          });

          const data = await res.json();

          if (data.access_token) {
            accessToken = data.access_token;
            refreshToken = data.refresh_token;
            log("Token acquisition succeeded", {
              access_token: accessToken.substring(0, 20) + "...",
              token_type: data.token_type,
              expires_in: data.expires_in,
              scope: data.scope,
            });

            const payload = JSON.parse(atob(accessToken.split(".")[1]));
            log("Access token payload", payload);
            updateStatus();
          } else {
            log("Token acquisition failed", data);
          }

          sessionStorage.removeItem("pkce_code_verifier");
          sessionStorage.removeItem("oauth_state");
        }

        // --- Token refresh ---
        async function refreshAccessToken() {
          if (!refreshToken) {
            log("Error: no refresh token");
            return;
          }

          const res = await fetch(AUTH_SERVER + "/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              grant_type: "refresh_token",
              refresh_token: refreshToken,
              client_id: CLIENT_ID,
            }),
          });

          const data = await res.json();

          if (data.access_token) {
            accessToken = data.access_token;
            refreshToken = data.refresh_token;
            log("Token refresh succeeded", {
              access_token: accessToken.substring(0, 20) + "...",
              expires_in: data.expires_in,
            });
            updateStatus();
          } else {
            log("Token refresh failed", data);
          }
        }

        // --- API access ---
        async function getUserInfo() {
          if (!accessToken) { log("Error: not authenticated"); return; }
          try {
            const res = await fetch(RESOURCE_SERVER + "/api/userinfo", {
              headers: { Authorization: "Bearer " + accessToken },
            });
            const data = await res.json();
            log("User info (" + res.status + ")", data);
          } catch (e) {
            log("API error", { message: e.message });
          }
        }

        async function getProtectedData() {
          if (!accessToken) { log("Error: not authenticated"); return; }
          try {
            const res = await fetch(RESOURCE_SERVER + "/api/protected-data", {
              headers: { Authorization: "Bearer " + accessToken },
            });
            const data = await res.json();
            log("Protected data (" + res.status + ")", data);
          } catch (e) {
            log("API error", { message: e.message });
          }
        }

        // --- Logout ---
        function logout() {
          accessToken = null;
          refreshToken = null;
          sessionStorage.clear();
          log("Logged out");
          updateStatus();
        }

        // --- Callback handling (on page load) ---
        (function handleCallback() {
          const params = new URLSearchParams(window.location.search);
          const code = params.get("code");
          const state = params.get("state");
          const error = params.get("error");

          if (error) {
            log("Authorization error", { error, description: params.get("error_description") });
            return;
          }
          if (code) {
            window.history.replaceState({}, "", "/");
            exchangeCodeForToken(code, state);
          }
        })();
      </script>
    </body>
    </html>
  `);
});

app.get("/callback", (req, res) => {
  res.redirect("/?code=" + req.query.code + "&state=" + (req.query.state || ""));
});

app.listen(4042, () => console.log("SPA: http://localhost:4042"));

