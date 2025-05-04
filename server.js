const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
app.use(cors());

// Load job titles
const jobTitles = JSON.parse(fs.readFileSync(path.join(__dirname, "job-titles.json"), "utf-8"));

// Load skills (expects a structure like { "React": 1, "Node.js": 2, ... } or array of strings)
const skills = JSON.parse(fs.readFileSync(path.join(__dirname, "skills.json"), "utf-8"));

// Job titles endpoint
app.get("/api/job-titles", (req, res) => {
  const query = req.query.q?.toLowerCase() || "";
  const matches = Object.keys(jobTitles)
    .filter((title) => title.toLowerCase().includes(query))
    .slice(0, 15);
  res.json(matches);
});

// Skills endpoint
app.get("/api/skills", (req, res) => {
  const query = req.query.q?.toLowerCase() || "";
  const skillList = Array.isArray(skills)
    ? skills
    : Object.keys(skills); // support both array or object format

  const matches = skillList
    .filter((skill) => skill.toLowerCase().includes(query))
    .slice(0, 15);

  res.json(matches);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
