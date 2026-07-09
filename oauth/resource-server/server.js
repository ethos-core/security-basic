const express = require("express");
const jwt = require("jsonwebtoken");
const app = express();

const SECRET = "oauth-lab-secret-key";

app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "http://localhost:4042");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST");
    if (req.method === "OPTIONS") return res.status(204).end();
    next();
})

function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Access token is required" });
    }
    const token = authHeader.split(" ")[1];
    try {
        req.user = jwt.verify(token, SECRET);
        next();
    } catch (err) {
        if (err.name === "TokenExpiredError") {
            return res.status(401).json({ error: "token_expired", description: "The token has expired" });
        }
        return res.status(401).json({ error: "invalid_token", description: "The token is invalid" });
    }
}

app.get("/api/userinfo", authenticateToken, (req, res) => {
    res.json({
        sub: req.user.sub,
        name: req.user.name,
        email: req.user.email,
        scope: req.user.scope,
    });
});

app.get("/api/protected-data", authenticateToken, (req, res) => {
    res.json({
        message: "Successfully accessed the protected resource",
        data: [
            { id: 1, title: "Confidential A", value: "secret-value-1" },
            { id: 2, title: "Confidential B", value: "secret-value-2" },
        ],
        accessedBy: req.user.name,
        accessedAt: new Date().toISOString(),
    });
});
  
app.listen(4041, () => console.log("Resource Server: http://localhost:4041"));
  
