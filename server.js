const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
app.use(cors());

// Load job titles
const jobTitles = JSON.parse(
  fs.readFileSync(path.join(__dirname, "job-titles.json"), "utf-8")
);

// Load skills (expects a structure like { "React": 1, "Node.js": 2, ... } or array of strings)
const skills = JSON.parse(
  fs.readFileSync(path.join(__dirname, "skills.json"), "utf-8")
);

// Load countries with universities
const countriesWithUniversities = JSON.parse(
  fs.readFileSync(path.join(__dirname, "countries_with_universities_cleaned.json"), "utf-8")
);

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

// Countries endpoint (optionally filter by query)
app.get("/api/countries", (req, res) => {
  const query = req.query.q?.toLowerCase() || "";
  const matches = countriesWithUniversities
    .filter((country) => country.name.toLowerCase().includes(query))
    .map((country) => ({ code: country.code, name: country.name }));

  res.json(matches);
});

// Universities endpoint: by country code or global search
app.get("/api/universities", (req, res) => {
  const countryCode = req.query.country?.toUpperCase();
  const query = req.query.q?.toLowerCase();

  if (!countryCode && !query) {
    return res.status(400).json({ error: "Please provide a 'country' or a 'q' parameter." });
  }

  if (countryCode) {
    const country = countriesWithUniversities.find((c) => c.code === countryCode);
    if (!country || !country.data) {
      return res.status(404).json({ error: "Country not found or has no universities." });
    }

    const universities = Object.keys(country.data || {});
    const filtered = query
      ? universities.filter((u) => u.toLowerCase().includes(query)).slice(0, 15)
      : universities;

    return res.json(filtered);
  }

  // Global search
  if (query) {
    const allUniversities = countriesWithUniversities.flatMap((c) =>
      Object.keys(c.data || {}).filter((u) => u.toLowerCase().includes(query))
    );
    const unique = [...new Set(allUniversities)].slice(0, 15);
    return res.json(unique);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
