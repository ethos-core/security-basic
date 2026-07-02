const express = require("express");
const cookieParser = require("cookie-parser");
const app = express();
const { JSDOM } = require("jsdom");
const DOMPurify = require("dompurify");
const window = new JSDOM("").window;
const purify = DOMPurify(window);

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

const comments = [];

app.use((req, res, next) => {
  res.cookie("session_token", "secret-abc-123", {
    httpOnly: true,
    secure: true,
  });
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
  );
  next();
});

app.get("/", (req, res) => {
  const search = req.query.q || "";
  res.render("index", { comments, search });
});

app.post("/comment", (req, res) => {
  const { name, body } = req.body;
  comments.push({
    name: purify.sanitize(name),
    body: purify.sanitize(body),
    createdAt: new Date().toISOString(),
  });
  res.redirect("/");
});

app.listen(4000, () => console.log("Server running on http://localhost:4000"));