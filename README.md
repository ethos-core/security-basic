# security-basic

A learning repository for web security fundamentals, using a hands-on vulnerable app with real attacks and their mitigations.

## Directory structure

```
security-basic/
├── README.md
└── xss/                 # XSS (Cross-Site Scripting) demo
    ├── server.js        # Express-based comment board app
    ├── attacker.js      # Attacker server that receives stolen cookies
    ├── views/index.ejs  # Page template
    ├── Dockerfile
    ├── docker-compose.yml
    └── package.json
```

## xss — XSS demo

Using a comment board as the example, this reproduces the three major types of XSS and the cookie theft that abuses them. The corresponding mitigations are also applied.

### Vulnerabilities and mitigations

| Type | Location | Mitigation |
|---|---|---|
| Stored XSS | Display of saved comments | Server-side `DOMPurify.sanitize()` plus EJS escaped output (`<%=`) |
| Reflected XSS | Reflection of the `?q=` search query | Content-Security-Policy (`script-src 'self'`) prevents execution (note: the search-result section is still raw output; the root fix is output escaping) |
| DOM-based XSS | Rendering of `location.hash` | Uses `textContent` instead of `innerHTML` |
| Cookie theft | `session_token` cookie | `HttpOnly` / `Secure` attributes so JavaScript cannot read it |

### Getting started

Start the main app (comment board):

```bash
cd xss
docker compose up -d
```

Open http://localhost:4000 in your browser.

Start the attacker server (receives and prints stolen cookies):

```bash
cd xss
node attacker.js
```

It listens on http://localhost:5000 and logs cookies sent to it via XSS.

### Trying the attacks (to observe pre-mitigation behavior)

- Reflected XSS: `http://localhost:4000/?q=<script>alert(1)</script>`
- Stored XSS: post `<img src=x onerror=alert(1)>` as a comment body
- DOM-based XSS: `http://localhost:4000/#<img src=x onerror=alert(1)>`

With the current code the mitigations above are in effect, so you can confirm these are blocked or neutralized.

### Dependencies

- Node.js 22 (Docker image `node:22-alpine`)
- express / ejs / cookie-parser
- dompurify / jsdom (for server-side HTML sanitization)

## Note

This repository is for learning and experimentation only. It contains vulnerable code and attack scripts, so do not run it anywhere other than a local environment (e.g. never on a public server).
