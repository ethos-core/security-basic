const express = require("express");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const SECRET = "oauth-lab-secret-key";
const REFRESH_SECRET = "oauth-lab-refresh-secret";

const registeredClients = {
  "spa-client": {
    redirectUris: ["http://localhost:4042/callback"],
    name: "PKCE Demo SPA",
  },
};

const users = {
  testuser: { password: "password123", name: "Test User", email: "test@example.com" },
};

const authorizationCodes = new Map();
const refreshTokenStore = new Map();

app.get("/authorize", (req, res) => {
    const {
        response_type,
        client_id,
        redirect_uri,
        state,
        code_challenge,
        code_challenge_method,
        scope,
    } = req.query;

    if (response_type !== "code") {
        return res.status(400).json({ error: "Unsupported response type" });
    }

    const client = registeredClients[client_id];
    if (!client) {
        return res.status(400).json({ error: "Invalid client ID" });
    }
    if (!client.redirectUris.includes(redirect_uri)) {
        return res.status(400).json({ error: "Invalid redirect URI" });
    }
    if (!code_challenge || code_challenge_method !== "S256") {
        return res.status(400).json({ error: "invalid_request", description: "PKCE (S256) is required" });
    }

    res.send(`
        <!DOCTYPE html>
        <html lang="ja">
        <head>
          <meta charset="UTF-8">
          <title>Login - Authorization Server</title>
          <style>
            body { font-family: sans-serif; max-width: 400px; margin: 80px auto; padding: 20px; }
            input { display: block; width: 100%; padding: 10px; margin: 8px 0; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
            button { width: 100%; padding: 12px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; }
            button:hover { background: #45a049; }
            .info { background: #e8f5e9; padding: 12px; border-radius: 4px; margin-bottom: 16px; font-size: 14px; }
          </style>
        </head>
        <body>
          <h2>Authorization Server Login</h2>
          <div class="info">
            <strong>${client.name}</strong> is requesting access to your account.<br>
            Scope: ${scope || "openid profile"}
          </div>
          <form method="POST" action="/authorize/decision">
            <input type="hidden" name="client_id" value="${client_id}">
            <input type="hidden" name="redirect_uri" value="${redirect_uri}">
            <input type="hidden" name="state" value="${state || ""}">
            <input type="hidden" name="code_challenge" value="${code_challenge}">
            <input type="hidden" name="code_challenge_method" value="${code_challenge_method}">
            <input type="hidden" name="scope" value="${scope || "openid profile"}">
            <input name="username" placeholder="Username (testuser)" required>
            <input name="password" type="password" placeholder="Password (password123)" required>
            <button type="submit">Login and authorize</button>
          </form>
        </body>
        </html>
    `);
})

app.post("/authorize/decision", (req, res) => {
    const { username, password, client_id, redirect_uri, state, code_challenge, code_challenge_method, scope } = req.body;
    const user = users[username];
    if (!user || user.password !== password) {
        return res.status(401).json({ error: "invalid_grant", description: "Invalid username or password" });
    }

    const code = crypto.randomBytes(32).toString("hex");

    authorizationCodes.set(code, {
        clientId: client_id,
        redirectUri: redirect_uri,
        codeChallenge: code_challenge,
        codeChallengeMethod: code_challenge_method,
        userId: username,
        scope,
        expiresAt: Date.now() + 10 * 60 * 1000,
    })

    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set("code", code);
    redirectUrl.searchParams.set("state", state || "");

    res.redirect(redirectUrl.toString());
})

app.post("/token", (req, res) => {
    const { grant_type, code, redirect_uri, client_id, code_verifier, refresh_token } = req.body;

    if (grant_type === "authorization_code") {
        const authCode = authorizationCodes.get(code);

        if (!authCode) {
            return res.status(400).json({ error: "invalid_grant", description: "Invalid authorization code" });
        }
        if (authCode.expiresAt < Date.now()) {
            authorizationCodes.delete(code);
            return res.status(400).json({ error: "invalid_grant", description: "Authorization code has expired" });
        }
        if (authCode.clientId !== client_id || authCode.redirectUri !== redirect_uri) {
            return res.status(400).json({ error: "invalid_grant", description: "Invalid client or redirect URI" });
        }
        if (!code_verifier) {
            return res.status(400).json({ error: "invalid_grant", description: "Code verifier is required" });
        }

        const expectedChallenge = base64UrlEncode(
            crypto.createHash("sha256").update(code_verifier).digest()
        )

        if (expectedChallenge !== authCode.codeChallenge) {
            return res.status(400).json({ error: "invalid_grant", description: "PKCE verification failed" });
        }

        authorizationCodes.delete(code);

        const user = users[authCode.userId]
        const accessToken = jwt.sign(
            { sub: authCode.userId, name: user.name, email: user.email, scope: authCode.scope },
            SECRET,
            { expiresIn: "15m", issuer: "http://localhost:4040" }
        );

        const refreshToken = jwt.sign(
            { sub: authCode.userId, tokenId: crypto.randomUUID() },
            REFRESH_SECRET,
            { expiresIn: "7d" }
        );
        refreshTokenStore.set(authCode.userId, refreshToken);

        return res.json({
            access_token: accessToken,
            token_type: "Bearer",
            expires_in: 900,
            refresh_token: refreshToken,
            scope: authCode.scope,
        });      
    }

    if (grant_type === "refresh_token") {
        if (!refresh_token) {
            return res.status(400).json({ error: "invalid_request", description: "refresh_token is required" });
        }

        try {
            const payload = jwt.verify(refresh_token, REFRESH_SECRET)
            const storedToken = refreshTokenStore.get(payload.sub);

            if (storedToken !== refresh_token) {
                refreshTokenStore.delete(payload.sub);
                return res.status(400).json({ error: "invalid_grant", description: "Invalid refresh token (reuse detected)" });
            }

            const user = users[payload.sub]

            if (!user) {
                return res.status(400).json({ error: "invalid_grant", description: "User not found" });
            }

            const newAccessToken = jwt.sign({
                sub: payload.sub, name: user.name, email: user.email, scope: "openid profile" },
                SECRET,
                { expiresIn: "15m", issuer: "http://localhost:4040" }
            );

            const newRefreshToken = jwt.sign(
                { sub: payload.sub, tokenId: crypto.randomUUID() },
                REFRESH_SECRET,
                { expiresIn: "7d" }
            );

            refreshTokenStore.set(payload.sub, newRefreshToken);

            return res.json({
                access_token: newAccessToken,
                token_type: "Bearer",
                expires_in: 900,
                refresh_token: newRefreshToken,
            });
        } catch (err) {
            return res.status(400).json({ error: "invalid_grant", description: "Refresh token is invalid or expired" });
        }
    }

    return res.status(400).json({ error: "unsupported_grant_type" });
})

app.get("/.well-known/openid-configuration", (req, res) => {
    res.json({
      issuer: "http://localhost:4040",
      authorization_endpoint: "http://localhost:4040/authorize",
      token_endpoint: "http://localhost:4040/token",
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
    });
});

function base64UrlEncode(buffer) {
    return buffer
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }
  
app.listen(4040, () => console.log("Auth Server: http://localhost:4040"));
  
  