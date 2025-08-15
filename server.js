// ======================================================================
// BOOTSTRAP & DEPENDENCIES
// ======================================================================
require("dotenv").config(); // Loads env vars like GEONAMES_USER, PORT, etc.

const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
app.use(cors());
app.use(express.json());

// Keep for future use (e.g., text enhancement endpoints)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Global constants
const MAX_RESULTS = 1000; // unified result cap for list endpoints

// ======================================================================
// Utilities
// ======================================================================

/** Utility: Read JSON file (sync) with friendly error if missing/corrupt. */
function readJson(filePath, fallback = undefined) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (err) {
    console.error(`❌ Failed to read JSON: ${filePath}`, err.message);
    return fallback; // tolerates missing files during dev
  }
}

/** Utility: Safe string normalize (Arabic-aware). */
function norm(str) {
  return String(str || "")
    .normalize("NFC")
    .replace(/[أإآ]/g, "ا")
    .replace(/\s+/g, " ")
    .trim();
}

/** Utility: Case-insensitive contains (for EN). */
function containsCI(haystack, needle) {
  return String(haystack || "").toLowerCase().includes(String(needle || "").toLowerCase());
}

/** Utility: Filter array of strings by query (EN, case-insensitive). */
function filterListEN(list = [], q = "") {
  const query = String(q || "").toLowerCase();
  if (!query) return list.slice(0, MAX_RESULTS);
  return list.filter((item) => String(item || "").toLowerCase().includes(query)).slice(0, MAX_RESULTS);
}

/** Utility: Filter array of strings by query (AR, NFC-normalized). */
function filterListAR(list = [], q = "") {
  const query = norm(q);
  if (!query) return list.slice(0, MAX_RESULTS);
  return list.filter((item) => norm(item).includes(query)).slice(0, MAX_RESULTS);
}

/** Utility: Set-based unique + slice cap */
function uniqueCap(list = []) {
  return [...new Set(list)].slice(0, MAX_RESULTS);
}

/** Utility: Standard JSON error response */
function sendError(res, code, message) {
  return res.status(code).json({ error: message });
}

/** Utility: Async route wrapper (centralized try/catch) */
function asyncRoute(handler) {
  return (req, res) => {
    Promise.resolve(handler(req, res)).catch((err) => {
      console.error("❌ Unhandled route error:", err);
      sendError(res, 500, "internal_server_error");
    });
  };
}

// Very small in-memory cache for Arabic cities lookups
const cityCache = new Map(); // key: ISO2 -> value: [city names...]

// ======================================================================
// DATA LOADS (LOCAL JSON)
// ======================================================================

// Countries & universities
const countriesEn = readJson(path.join(__dirname, "data", "countries_with_universities_cleaned.json"), []);
const countriesAr = readJson(path.join(__dirname, "data", "countries_with_universities_cleaned - arabic.json"), []);

// Job titles
const jobTitlesEn = readJson(path.join(__dirname, "data", "job-titles-english.json"), {});
const jobTitlesAr = readJson(path.join(__dirname, "data", "job-titles-arabic.json"), {});

// Specializations (Bachelor) — objects with key "specializations"
const bachelorEnObj = readJson(path.join(__dirname, "data", "all_specializations-en.json"), { specializations: [] });
const bachelorArObj = readJson(path.join(__dirname, "data", "all_specializations-ar.json"), { specializations: [] });
const bachelorEn = Array.isArray(bachelorEnObj.specializations) ? bachelorEnObj.specializations : [];
const bachelorAr = Array.isArray(bachelorArObj.specializations) ? bachelorArObj.specializations : [];

// Masters/Doctors — plain arrays in your files
const mastersEn = readJson(path.join(__dirname, "data", "major-masters-en.json"), []) || [];
const mastersAr = readJson(path.join(__dirname, "data", "major-masters-ar.json"), []) || [];
const doctorsEn = readJson(path.join(__dirname, "data", "major-doctor-en.json"), []) || [];
const doctorsAr = readJson(path.join(__dirname, "data", "major-doctor-ar.json"), []) || [];

// World (EN) countries->cities (existing file)
const worldData = readJson(path.join(__dirname, "data", "countries_cities.json"), []);

// Certifications
const certificationsData = readJson(path.join(__dirname, "organization_certifications.json"), []);

// Hobbies & Skills & Languages
const hobbiesEn = readJson(path.join(__dirname, "data", "hobbies_and_interests.json"), []);
const hobbiesAr = readJson(path.join(__dirname, "data", "hobbies_and_interests-ar.json"), []);
const skillsEn = readJson(path.join(__dirname, "data", "skills-English.json"), []);
const skillsAr = readJson(path.join(__dirname, "data", "skills-Arabic.json"), {}); // map/object
const languagesAr = readJson(path.join(__dirname, "data", "alllanguages-ar.json"), {});

// ======================================================================
// ROUTES
// ======================================================================

/**
 * @route GET /health
 * @desc  Basic health check
 */
app.get("/health", (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

/**
 * @route GET /api/skills
 * @query q?: string
 * @desc  Skills (English), case-insensitive filter
 */
app.get("/api/skills", (req, res) => {
  const q = req.query.q || "";
  res.json(filterListEN(skillsEn, q));
});

/**
 * @route GET /api/skillsar
 * @query q?: string
 * @desc  Skills (Arabic), NFC-normalized filter (values of the map)
 */
app.get("/api/skillsar", (req, res) => {
  const q = req.query.q || "";
  const values = Object.values(skillsAr || {});
  res.json(filterListAR(values, q));
});

/**
 * @route GET /api/hobbies
 * @query q?: string
 * @desc  Hobbies (English)
 */
app.get("/api/hobbies", (req, res) => {
  const q = req.query.q || "";
  res.json(filterListEN(hobbiesEn, q));
});

/**
 * @route GET /api/hobbies-ar
 * @query q?: string
 * @desc  Hobbies (Arabic)
 */
app.get("/api/hobbies-ar", (req, res) => {
  const q = req.query.q || "";
  res.json(filterListAR(hobbiesAr, q));
});

/**
 * @route GET /api/jobtitles
 * @query q?: string
 * @desc  Job titles (English): uses keys of jobTitlesEn
 */
app.get("/api/jobtitles", (req, res) => {
  const q = req.query.q || "";
  const titles = Object.keys(jobTitlesEn || {});
  res.json(filterListEN(titles, q));
});

/**
 * @route GET /api/jobtitlesar
 * @query q?: string
 * @desc  Job titles (Arabic): uses values of jobTitlesAr
 */
app.get("/api/jobtitlesar", (req, res) => {
  const q = req.query.q || "";
  const titles = Object.values(jobTitlesAr || {});
  res.json(filterListAR(titles, q));
});

/**
 * @route GET /api/countries
 * @query q?: string
 * @desc  Countries (EN), returns [{ code, name }]
 */
app.get("/api/countries", (req, res) => {
  const q = req.query.q || "";
  const results = (countriesEn || [])
    .filter((c) => containsCI(c.name, q))
    .map((c) => ({ code: c.code, name: c.name }))
    .slice(0, MAX_RESULTS);
  res.json(results);
});

/**
 * @route GET /api/countriesar
 * @query q?: string
 * @desc  Countries (AR), returns [{ code, name }]
 */
app.get("/api/countriesar", (req, res) => {
  const q = req.query.q || "";
  const results = (countriesAr || [])
    .filter((c) => norm(c.name).includes(norm(q)))
    .map((c) => ({ code: c.code, name: c.name }))
    .slice(0, MAX_RESULTS);
  res.json(results);
});

/**
 * @route GET /api/universities
 * @query country: ISO2 (required), q?: string
 * @desc  University names (EN) for a country
 */
app.get("/api/universities", (req, res) => {
  const code = String(req.query.country || "").toUpperCase();
  const q = req.query.q ? String(req.query.q).toLowerCase() : "";

  if (!code) return sendError(res, 400, "Missing country code");

  const country = (countriesEn || []).find((c) => c.code === code);
  if (!country || !country.data) return sendError(res, 404, "Country not found");

  let universities = Object.keys(country.data || {});
  if (q) universities = universities.filter((u) => String(u).toLowerCase().includes(q));

  res.json(universities.slice(0, MAX_RESULTS));
});

/**
 * @route GET /api/universitiesar
 * @query country: ISO2 (required), q?: string
 * @desc  University names (AR) for a country
 */
app.get("/api/universitiesar", (req, res) => {
  const code = String(req.query.country || "").toUpperCase();
  const q = req.query.q ? norm(req.query.q) : "";

  if (!code) return sendError(res, 400, "Missing country code");

  const country = (countriesAr || []).find((c) => c.code === code);
  if (!country || !country.data) return sendError(res, 404, "Country not found");

  let universities = Object.keys(country.data || {});
  if (q) universities = universities.filter((u) => norm(u).includes(q));

  res.json(universities.slice(0, MAX_RESULTS));
});

/**
 * @route GET /api/languages
 * @query q?: string
 * @desc  Language keys (EN translit) from Arabic map file
 */
app.get("/api/languages", (req, res) => {
  const q = req.query.q || "";
  const keys = Object.keys(languagesAr || {});
  res.json(filterListEN(keys, q));
});

/**
 * @route GET /api/languagesar
 * @query q?: string
 * @desc  Arabic language names (values)
 */
app.get("/api/languagesar", (req, res) => {
  const q = req.query.q || "";
  const values = Object.values(languagesAr || {});
  res.json(filterListAR(values, q));
});

/**
 * @route GET /api/world-countries
 * @desc  Return list of country names from worldData (EN)
 */
app.get("/api/world-countries", (req, res) => {
  const countries = (worldData || []).map((entry) => entry.name);
  res.json(countries.slice(0, MAX_RESULTS));
});

/**
 * @route GET /api/cities
 * @query country: string (required, EN name)
 * @desc  Return cities for a given EN country name (from local file)
 */
app.get("/api/cities", (req, res) => {
  const country = String(req.query.country || "");
  if (!country) return sendError(res, 400, "Missing country query param");

  const match = (worldData || []).find(
    (entry) => String(entry.name || "").toLowerCase() === country.toLowerCase()
  );
  if (!match) return sendError(res, 404, "Country not found");

  res.json((match.cities || []).slice(0, MAX_RESULTS));
});

/**
 * @route GET /api/organizations
 * @desc  Return list of organization names for certifications
 */
app.get("/api/organizations", (req, res) => {
  const names = (certificationsData || []).map((org) => org.organization_name);
  res.json(names.slice(0, MAX_RESULTS));
});

/**
 * @route GET /api/certifications
 * @query organization_name: string (required)
 * @desc  Return certifications for given organization
 */
app.get("/api/certifications", (req, res) => {
  const orgName = req.query.organization_name;
  if (!orgName) return sendError(res, 400, "organization_name is required");

  const org = (certificationsData || []).find((item) => item.organization_name === orgName);
  if (!org) return sendError(res, 404, "Organization not found");

  res.json((org.name || []).slice(0, MAX_RESULTS));
});

/**
 * @route GET /api/cities/ar
 * @query country: Arabic country name (required)
 * @desc  Fetch Arabic city names via GeoNames for the ISO2 code matching the Arabic country
 */
app.get(
  "/api/cities/ar",
  asyncRoute(async (req, res) => {
    const countryNameRaw = String(req.query.country || "").trim();
    if (!countryNameRaw) return sendError(res, 400, "Missing country query param");

    const countryName = norm(countryNameRaw);

    // find Arabic country in your Arabic countries list
    const match = (countriesAr || []).find((c) => norm(c?.name) === countryName);
    if (!match?.code) return sendError(res, 404, "Country not found in Arabic list");

    const iso2 = String(match.code || "").toUpperCase();
    if (!iso2) return sendError(res, 500, "Invalid ISO2 code for country");

    // Cache hit
    if (cityCache.has(iso2)) return res.json(cityCache.get(iso2));

    const user = process.env.GEONAMES_USER;
    if (!user) return sendError(res, 500, "GEONAMES_USER is not configured");

    // Build GeoNames query
    const url = new URL("http://api.geonames.org/searchJSON");
    url.searchParams.set("country", iso2);
    url.searchParams.set("featureClass", "P"); // populated places
    url.searchParams.set("maxRows", String(MAX_RESULTS));
    url.searchParams.set("lang", "ar");
    url.searchParams.set("username", user);

    const r = await fetch(url);
    if (!r.ok) return sendError(res, 502, `geonames_error_${r.status}`);

    const j = await r.json();
    const names = Array.isArray(j?.geonames)
      ? j.geonames.map((g) => String(g?.name || "").trim()).filter(Boolean)
      : [];

    const uniqueSorted = [...new Set(names)].sort((a, b) =>
      a.localeCompare(b, "ar", { sensitivity: "base" })
    );

    cityCache.set(iso2, uniqueSorted); // cache for subsequent requests
    res.json(uniqueSorted);
  })
);

// ======================================================================
// DEGREE ENDPOINTS (2 per level: EN & AR)
// ======================================================================

/**
 * @route GET /api/bachelor
 * @query q?: string
 * @desc  Bachelor specializations (EN)
 */
app.get("/api/bachelor", (req, res) => {
  const q = req.query.q || "";
  res.json(uniqueCap((bachelorEn || []).filter((m) => containsCI(m, q))));
});

/**
 * @route GET /api/bachelor/ar
 * @query q?: string
 * @desc  Bachelor specializations (AR)
 */
app.get("/api/bachelor/ar", (req, res) => {
  const q = req.query.q || "";
  res.json(uniqueCap((bachelorAr || []).filter((m) => norm(m).includes(norm(q)))));
});

/**
 * @route GET /api/masters
 * @query q?: string
 * @desc  Master specializations (EN)
 */
app.get("/api/masters", (req, res) => {
  const q = req.query.q || "";
  res.json(uniqueCap((mastersEn || []).filter((m) => containsCI(m, q))));
});

/**
 * @route GET /api/masters/ar
 * @query q?: string
 * @desc  Master specializations (AR)
 */
app.get("/api/masters/ar", (req, res) => {
  const q = req.query.q || "";
  res.json(uniqueCap((mastersAr || []).filter((m) => norm(m).includes(norm(q)))));
});

/**
 * @route GET /api/doctors
 * @query q?: string
 * @desc  Doctor specializations (EN)
 */
app.get("/api/doctors", (req, res) => {
  const q = req.query.q || "";
  res.json(uniqueCap((doctorsEn || []).filter((m) => containsCI(m, q))));
});

/**
 * @route GET /api/doctors/ar
 * @query q?: string
 * @desc  Doctor specializations (AR)
 */
app.get("/api/doctors/ar", (req, res) => {
  const q = req.query.q || "";
  res.json(uniqueCap((doctorsAr || []).filter((m) => norm(m).includes(norm(q)))));
});

// ======================================================================
// START SERVER
// ======================================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});