# security-basic

A learning repository for web security fundamentals. Each directory is a self-contained, Dockerized demo that reproduces a common attack or security mechanism, with the corresponding mitigations applied.

## Directory structure

```
security-basic/
├── README.md
├── xss/       # XSS (Cross-Site Scripting) demo
├── csrf/      # CSRF (Cross-Site Request Forgery) demo
├── cors/      # CORS (Cross-Origin Resource Sharing) demo
├── headers/   # Security response headers demo (nginx reverse proxy)
└── jwt/       # JWT authentication demo (access / refresh tokens)
```

## Demos and ports

| Demo | Description | URL(s) |
|---|---|---|
| xss | Comment board reproducing Stored / Reflected / DOM-based XSS and cookie theft | app: http://localhost:4000, attacker: http://localhost:5000 |
| csrf | Bank app vulnerable to CSRF plus an attacker page, with defenses | victim: http://localhost:4010, attacker: http://localhost:4011 |
| cors | Cross-origin API and frontend demonstrating CORS behavior | api: http://localhost:4001, frontend: http://localhost:4002 |
| headers | Express app behind nginx that sets security response headers | http://localhost:4030 |
| jwt | JWT auth with access/refresh tokens, rotation and logout | http://localhost:4020 |

Each demo is started from its own directory (unless noted):

```bash
cd <demo>
docker compose up -d
```

---

## xss — XSS demo

Using a comment board as the example, this reproduces the three major types of XSS and the cookie theft that abuses them. The corresponding mitigations are also applied.

| Type | Location | Mitigation |
|---|---|---|
| Stored XSS | Display of saved comments | Server-side `DOMPurify.sanitize()` plus EJS escaped output (`<%=`) |
| Reflected XSS | Reflection of the `?q=` search query | Content-Security-Policy (`script-src 'self'`) prevents execution (note: the search-result section is still raw output; the root fix is output escaping) |
| DOM-based XSS | Rendering of `location.hash` | Uses `textContent` instead of `innerHTML` |
| Cookie theft | `session_token` cookie | `HttpOnly` / `Secure` attributes so JavaScript cannot read it |

Start the app with `docker compose up -d` (http://localhost:4000). The attacker server that receives stolen cookies is run separately:

```bash
cd xss
node attacker.js   # listens on http://localhost:5000
```

Attack payloads to try (blocked/neutralized by the current mitigations):

- Reflected XSS: `http://localhost:4000/?q=<script>alert(1)</script>`
- Stored XSS: post `<img src=x onerror=alert(1)>` as a comment body
- DOM-based XSS: `http://localhost:4000/#<img src=x onerror=alert(1)>`

---

## csrf — CSRF demo

A simple bank app (victim) with a login, balance and money-transfer form, plus an attacker page that tries to force a transfer using the victim's session.

| Concern | Mitigation |
|---|---|
| Cross-site request forgery | CSRF token (double-submit cookie) validated on `POST /transfer` |
| Cross-site cookie sending | `SameSite=Strict` cookies (`user`, `csrf_token`) |
| Request origin | `Origin` / `Referer` check against `http://localhost:4010` |

Start with `docker compose up -d`. Log in at http://localhost:4010 (`alice` / `pass123`), then open the attacker page at http://localhost:4011 and try the transfer — it is rejected by the defenses.

---

## cors — CORS demo

An API service and a separate frontend origin. The frontend issues simple, JSON, DELETE and credentialed requests to the API to demonstrate how CORS controls cross-origin access.

Key API headers:

- `Access-Control-Allow-Origin: http://localhost:4002` (specific origin, required for credentials)
- `Access-Control-Allow-Methods`, `Access-Control-Allow-Headers`
- `Access-Control-Allow-Credentials: true` (needed for `credentials: 'include'`)

Start with `docker compose up -d`, then open http://localhost:4002 and use the buttons to exercise each request type.

---

## headers — Security headers demo

An Express app behind an nginx reverse proxy. nginx adds recommended security response headers and hides its version.

| Header | Value |
|---|---|
| Content-Security-Policy | restrictive `default-src 'self'` policy |
| Strict-Transport-Security | `max-age=31536000; includeSubDomains; preload` |
| X-Frame-Options | `DENY` |
| X-Content-Type-Options | `nosniff` |
| Referrer-Policy | `strict-origin-when-cross-origin` |
| Permissions-Policy | disables camera / microphone / geolocation / payment |

`server_tokens off;` hides the nginx version. Start with `docker compose up -d` and inspect the response headers at http://localhost:4030 (browser DevTools Network tab or `curl -I`).

---

## jwt — JWT authentication demo

An Express app demonstrating a JWT-based auth flow with short-lived access tokens and long-lived refresh tokens.

- Registration with bcrypt-hashed passwords
- Access token (JWT) with a 15-minute expiry, sent as a `Bearer` token
- Refresh token stored in an `HttpOnly`, `SameSite=Strict` cookie scoped to `/auth/refresh`
- Refresh-token rotation with reuse detection (an old refresh token is rejected)
- Logout invalidates the access token via a blacklist

The signing secrets are provided as environment variables in `docker-compose.yml` (for the lab only). Start with `docker compose up -d` and use the UI at http://localhost:4020 to register, log in and exercise the token flow.

---

## Dependencies

- Node.js 22 (Docker image `node:22-alpine`) and nginx (`nginx:alpine`)
- express, ejs, cookie-parser
- dompurify, jsdom (xss)
- jsonwebtoken, bcryptjs (jwt)

## Note

This repository is for learning and experimentation only. It contains vulnerable code and attack scripts, so do not run it anywhere other than a local environment (e.g. never on a public server).
