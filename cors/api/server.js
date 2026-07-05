const express = require("express");
const cookieParser = require("cookie-parser");
const app = express();

app.use(express.json());
app.use(cookieParser());

const items = [
  { id: 1, name: "Apple", price: 150 },
  { id: 2, name: "Orange", price: 100 },
  { id: 3, name: "Banana", price: 200 },
];

app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "http://localhost:4002");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Credentials", "true");

    if (req.method === "OPTIONS") {
        return res.status(204).end();
    }
    next();
});

app.get("/api/items", (req, res) => {
  res.json(items);
});

app.post("/api/items", (req, res) => {
  const item = { id: items.length + 1, ...req.body };
  items.push(item);
  res.status(201).json(item);
});

app.delete("/api/items/:id", (req, res) => {
  const index = items.findIndex((i) => i.id === parseInt(req.params.id));
  if (index === -1) return res.status(404).json({ error: "Not found" });
  items.splice(index, 1);
  res.status(204).end();
});

app.get("/api/me", (req, res) => {
  const token = req.cookies.auth_token;
  if (token === "valid-token") {
    res.json({ name: "Test User", email: "test@example.com" });
  } else {
    res.status(401).json({ error: "Unauthorized" });
  }
});

app.listen(4001, () => console.log("API: http://localhost:4001"));