// ====================== BOOTSTRAP & DEPENDENCIES ======================
require("dotenv").config(); // <-- load .env (GEONAMES_USER, etc.)

const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
app.use(cors());
app.use(express.json());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ====================== DATA LOADS (LOCAL JSON) ======================
// Countries & universities
const countriesEn = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "data", "countries_with_universities_cleaned.json"),
    "utf-8"
  )
);

const countriesAr = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "data", "countries_with_universities_cleaned - arabic.json"),
    "utf-8"
  )
);

// Job titles
const jobTitlesEn = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data", "job-titles-english.json"), "utf-8")
);
const jobTitlesAr = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data", "job-titles-arabic.json"), "utf-8")
);

// Specializations
const specializationsEn = require("./data/all_specializations-en.json");
const specializationsAr = require("./data/all_specializations-ar.json");

// Skills
const skillsEn = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data", "skills-English.json"), "utf-8")
);
const skillsAr = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data", "skills-Arabic.json"), "utf-8")
);

// Languages (ar map)
const languagesAr = require("./data/alllanguages-ar.json");

// Hobbies
const hobbiesEn = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data", "hobbies_and_interests.json"), "utf-8")
);
const hobbiesAr = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data", "hobbies_and_interests-ar.json"), "utf-8")
);

// Majors
const majors = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data", "majors-Bachelor.json"), "utf-8")
);
const masters = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data", "major-masters.json"), "utf-8")
);
const doctors = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data", "major-doctor.json"), "utf-8")
);

// World (EN) countries->cities (your existing file)
const worldData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data", "countries_cities.json"), "utf8")
);


// Certifications
const certificationsData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "organization_certifications.json"), "utf8")
);

// ====================== HELPERS ======================
const norm = (s) =>
  (s || "")
    .normalize("NFC")
    .replace(/[أإآ]/g, "ا")
    .replace(/\s+/g, " ")
    .trim();

// very small in-memory cache for cities/ar lookups
const cityCache = new Map(); // key: `${iso2}`, value: [names...]

// ====================== ROUTES ======================

// ---- Skills
app.get("/api/skills", (req, res) => {
  const query = req.query.q?.toLowerCase() || "";
  const results = skillsEn.filter((skill) => skill.toLowerCase().includes(query)).slice(0, 1000);
  res.json(results);
});
app.get("/api/skillsar", (req, res) => {
  const query = req.query.q?.toLowerCase().trim() || "";
  const results = Object.entries(skillsAr)
    .filter(([_, value]) => value.toLowerCase().includes(query))
    .map(([_, value]) => value)
    .slice(0, 1000);
  res.json(results);
});

// ---- Hobbies
app.get("/api/hobbies", (req, res) => {
  const query = req.query.q?.toLowerCase() || "";
  const results = hobbiesEn.filter((h) => h.toLowerCase().includes(query)).slice(0, 1000);
  res.json(results);
});
app.get("/api/hobbies-ar", (req, res) => {
  const query = req.query.q?.toLowerCase() || "";
  const results = hobbiesAr.filter((h) => h.toLowerCase().includes(query)).slice(0, 1000);
  res.json(results);
});

// ---- Specializations
app.get("/api/specializations", (req, res) => {
  const query = req.query.q?.toLowerCase() || "";
  const list = specializationsEn.specializations || [];
  const results = list.filter((item) => item.toLowerCase().includes(query));
  res.json(results.slice(0, 1000));
});
app.get("/api/specializations/ar", (req, res) => {
  const query = req.query.q?.trim() || "";
  const list = specializationsAr.specializations || [];
  const results = list.filter((item) => item.normalize("NFC").includes(query.normalize("NFC")));
  res.json(results.slice(0, 1000));
});

// ---- Job titles
app.get("/api/jobtitles", (req, res) => {
  const query = req.query.q?.toLowerCase() || "";
  const results = Object.keys(jobTitlesEn).filter((t) => t.toLowerCase().includes(query)).slice(0, 1000);
  res.json(results);
});
app.get("/api/jobtitlesar", (req, res) => {
  const query = req.query.q?.toLowerCase() || "";
  const results = Object.values(jobTitlesAr).filter((t) => t.toLowerCase().includes(query)).slice(0, 1000);
  res.json(results);
});

// ---- Countries (EN + AR) and Universities
app.get("/api/countries", (req, res) => {
  const query = req.query.q?.toLowerCase() || "";
  const results = countriesEn
    .filter((c) => c.name.toLowerCase().includes(query))
    .map((c) => ({ code: c.code, name: c.name }));
  res.json(results);
});
app.get("/api/countriesar", (req, res) => {
  const query = req.query.q?.toLowerCase() || "";
  const results = countriesAr
    .filter((c) => c.name.toLowerCase().includes(query))
    .map((c) => ({ code: c.code, name: c.name }));
  res.json(results);
});

app.get("/api/universities", (req, res) => {
  const code = req.query.country?.toUpperCase();
  const query = req.query.q?.toLowerCase();
  if (!code) return res.status(400).json({ error: "Missing country code" });

  const country = countriesEn.find((c) => c.code === code);
  if (!country || !country.data) return res.status(404).json({ error: "Country not found" });

  let universities = Object.keys(country.data);
  if (query) universities = universities.filter((u) => u.toLowerCase().includes(query));
  res.json(universities.slice(0, 1000));
});

app.get("/api/universitiesar", (req, res) => {
  const code = req.query.country?.toUpperCase();
  const query = req.query.q?.toLowerCase();
  if (!code) return res.status(400).json({ error: "Missing country code" });

  const country = countriesAr.find((c) => c.code === code);
  if (!country || !country.data) return res.status(404).json({ error: "Country not found" });

  let universities = Object.keys(country.data);
  if (query) universities = universities.filter((u) => u.toLowerCase().includes(query));
  res.json(universities.slice(0, 1000));
});

// ---- Languages
app.get("/api/languages", (req, res) => {
  const query = req.query.q?.toLowerCase().trim() || "";
  const results = Object.keys(languagesAr).filter((k) => k.toLowerCase().includes(query));
  res.json(results.slice(0, 1000));
});
app.get("/api/languagesar", (req, res) => {
  const query = req.query.q?.toLowerCase().trim() || "";
  const results = Object.entries(languagesAr)
    .filter(([_, v]) => v.toLowerCase().includes(query))
    .map(([_, v]) => v);
  res.json(results.slice(0, 1000));
});

// ---- Majors
app.get("/api/bachelor", (req, res) => {
  const query = req.query.q?.toLowerCase() || "";
  const results = [...new Set(majors.filter((m) => m.toLowerCase().includes(query)))].slice(0, 1000);
  res.json(results);
});
app.get("/api/masters", (req, res) => {
  const query = req.query.q?.toLowerCase() || "";
  const results = [...new Set(masters.filter((m) => m.toLowerCase().includes(query)))].slice(0, 1000);
  res.json(results);
});
app.get("/api/doctors", (req, res) => {
  const query = req.query.q?.toLowerCase() || "";
  const results = [...new Set(doctors.filter((m) => m.toLowerCase().includes(query)))].slice(0, 1000);
  res.json(results);
});

// ---- World countries (EN file) + cities (EN)
app.get("/api/world-countries", (req, res) => {
  const countries = worldData.map((entry) => entry.name);
  res.json(countries);
});
app.get("/api/cities", (req, res) => {
  const { country } = req.query;
  if (!country) return res.status(400).json({ error: "Missing country query param" });

  const match = worldData.find((entry) => entry.name.toLowerCase() === String(country).toLowerCase());
  if (!match) return res.status(404).json({ error: "Country not found" });

  res.json(match.cities);
});

// ---- Organizations & Certifications
app.get("/api/organizations", (req, res) => {
  const names = certificationsData.map((org) => org.organization_name);
  res.json(names);
});
app.get("/api/certifications", (req, res) => {
  const orgName = req.query.organization_name;
  if (!orgName) return res.status(400).json({ error: "organization_name is required" });

  const org = certificationsData.find((item) => item.organization_name === orgName);
  if (!org) return res.status(404).json({ error: "Organization not found" });

  res.json(org.name);
});

// ====================== NEW: /api/cities/ar ======================
app.get("/api/cities/ar", async (req, res) => {
  try {
    const countryNameRaw = (req.query.country || "").trim();
    if (!countryNameRaw) {
      return res.status(400).json({ error: "Missing country query param" });
    }

    const countryName = norm(countryNameRaw);

    // find Arabic country in your Arabic countries list
    const match = (countriesAr || []).find((c) => norm(c?.name) === countryName);
    if (!match?.code) {
      return res.status(404).json({ error: "Country not found in Arabic list" });
    }

    const iso2 = match.code; // e.g., "JO"
    const cacheKey = iso2.toUpperCase();
    if (cityCache.has(cacheKey)) {
      return res.json(cityCache.get(cacheKey));
    }

    const user = process.env.GEONAMES_USER;
    if (!user) {
      return res.status(500).json({ error: "GEONAMES_USER is not configured" });
    }

    const url = new URL("http://api.geonames.org/searchJSON");
    url.searchParams.set("country", iso2);
    url.searchParams.set("featureClass", "P"); // populated places
    url.searchParams.set("maxRows", "1000");
    url.searchParams.set("lang", "ar");
    url.searchParams.set("username", user);

    const r = await fetch(url);
    if (!r.ok) return res.status(502).json({ error: `geonames error: ${r.status}` });

    const j = await r.json();
    const names = Array.isArray(j?.geonames)
      ? j.geonames.map((g) => (g?.name || "").trim()).filter(Boolean)
      : [];

    const uniqueSorted = [...new Set(names)].sort((a, b) =>
      a.localeCompare(b, "ar", { sensitivity: "base" })
    );

    // cache for subsequent requests
    cityCache.set(cacheKey, uniqueSorted);

    res.json(uniqueSorted);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "failed_to_fetch_cities_ar" });
  }
});

// ====================== START SERVER ======================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
