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

// Load skills
const skills = JSON.parse(
  fs.readFileSync(path.join(__dirname, "skills.json"), "utf-8")
);

// Load countries with universities
const countriesWithUniversities = JSON.parse(
  fs.readFileSync(path.join(__dirname, "countries_with_universities_cleaned.json"), "utf-8")
);

// 🔍 Job titles search
app.get("/api/job-titles", (req, res) => {
  const query = req.query.q?.toLowerCase() || "";
  const matches = Object.keys(jobTitles)
    .filter((title) => title.toLowerCase().includes(query))
    .slice(0, 15);
  res.json(matches);
});

// 🔍 Skills search
app.get("/api/skills", (req, res) => {
  const query = req.query.q?.toLowerCase() || "";
  const skillList = Array.isArray(skills) ? skills : Object.keys(skills);

  const matches = skillList
    .filter((skill) => skill.toLowerCase().includes(query))
    .slice(0, 15);

  res.json(matches);
});

// 🌍 Countries endpoint
app.get("/api/countries", (req, res) => {
  const query = req.query.q?.toLowerCase() || "";
  const matches = countriesWithUniversities
    .filter((country) => country.name.toLowerCase().includes(query))
    .map((country) => ({
      code: country.code.toUpperCase(),
      name: country.name,
    }));

  res.json(matches);
});

// 🎓 Universities endpoint
app.get("/api/universities", (req, res) => {
  const countryCode = req.query.country?.toUpperCase();
  const query = req.query.q?.toLowerCase();

  // Error if no filter provided
  if (!countryCode && !query) {
    return res.status(400).json({
      error: "Please provide a 'country' (ISO code) or a 'q' parameter.",
    });
  }

  // Filter by country (with optional search query)
  if (countryCode) {
    const country = countriesWithUniversities.find((c) => c.code === countryCode);

    if (!country || !country.data) {
      return res
        .status(404)
        .json({ error: "Country not found or has no universities." });
    }

    let universities = Object.keys(country.data || {});

    if (query) {
      universities = universities
        .filter((u) => u.toLowerCase().includes(query))
        .slice(0, 15);
    }

    return res.json(universities);
  }

  // Global query if no country specified
  if (query) {
    const allUniversities = countriesWithUniversities.flatMap((country) =>
      Object.keys(country.data || {}).filter((u) =>
        u.toLowerCase().includes(query)
      )
    );
    const unique = [...new Set(allUniversities)].slice(0, 15);
    return res.json(unique);
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌐 Server running on http://localhost:${PORT}`);
});
