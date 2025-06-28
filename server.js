const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
app.use(cors());
app.use(express.json());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Load countries & universities (English & Arabic)
const countriesEn = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data", "countries_with_universities_cleaned.json"), "utf-8")
);

const countriesAr = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data", "countries_with_universities_cleaned - arabic.json"), "utf-8")
);

//Read the job title files
const jobTitlesEn = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data", "job-titles-english.json"), "utf-8")
);

const jobTitlesAr = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data", "job-titles-arabic.json"), "utf-8")
);

// Load specializations (English & Arabic)
// Load Specializations Data
const specializationsEn = require("./data/all_specializations-en.json");
const specializationsAr = require("./data/all_specializations-ar.json");


//data-loading lines  skills
const skillsEn = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data", "skills-English.json"), "utf-8")
);

const skillsAr = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data", "skills-Arabic.json"), "utf-8")
);

const allLanguages = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data", "alllanguages-ar.json"), "utf-8")
);


const hobbiesEn = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data", "hobbies_and_interests.json"), "utf-8")
);

const hobbiesAr = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data", "hobbies_and_interests-ar.json"), "utf-8")
);


app.get("/api/skills", (req, res) => {
  const query = req.query.q?.toLowerCase() || "";
  const results = skillsEn
    .filter((skill) => skill.toLowerCase().includes(query))
    .slice(0, 1000);
  res.json(results);
});


app.get("/api/skillsar", (req, res) => {
  const query = req.query.q?.toLowerCase().trim() || "";

  const results = Object.entries(skillsAr)
    .filter(([_, value]) => value.toLowerCase().includes(query))
    .map(([_, value]) => value) // return only the Arabic label
    .slice(0, 1000);

  res.json(results);
});

// 🧩 Hobbies - English
app.get("/api/hobbies", (req, res) => {
  const query = req.query.q?.toLowerCase() || "";
  const results = hobbiesEn
    .filter((hobby) => hobby.toLowerCase().includes(query))
    .slice(0, 1000);
  res.json(results);
});

// 🧩 Hobbies - Arabic
app.get("/api/hobbies-ar", (req, res) => {
  const query = req.query.q?.toLowerCase() || "";
  const results = hobbiesAr
    .filter((hobby) => hobby.toLowerCase().includes(query))
    .slice(0, 1000);
  res.json(results);
});



// Endpoint: English Specializations
app.get("/api/specializations", (req, res) => {
  const query = req.query.q?.toLowerCase() || "";
  const list = specializationsEn.specializations || [];
  const results = list.filter((item) => item.toLowerCase().includes(query));
  res.json(results.slice(0, 1000));
});

// Endpoint: Arabic Specializations
app.get("/api/specializations/ar", (req, res) => {
  const query = req.query.q?.trim() || "";
  const list = specializationsAr.specializations || [];
  const results = list.filter((item) =>
    item.normalize("NFC").includes(query.normalize("NFC"))
  );
  res.json(results.slice(0, 1000));
});



// English job titles
app.get("/api/jobtitles", (req, res) => {
  const query = req.query.q?.toLowerCase() || "";
  const results = Object.keys(jobTitlesEn)
    .filter((title) => title.toLowerCase().includes(query))
    .slice(0, 1000);
  res.json(results);
});

// Arabic job titles
app.get("/api/jobtitlesar", (req, res) => {
  const query = req.query.q?.toLowerCase() || "";
  const results = Object.values(jobTitlesAr)
    .filter((title) => title.toLowerCase().includes(query))
    .slice(0, 1000);
  res.json(results);
});




//English countries list
app.get("/api/countries", (req, res) => {
  const query = req.query.q?.toLowerCase() || "";
  const results = countriesEn
    .filter((country) => country.name.toLowerCase().includes(query))
    .map((country) => ({
      code: country.code,
      name: country.name,
    }));
  res.json(results);
});

//English universities by country

app.get("/api/universities", (req, res) => {
  const code = req.query.country?.toUpperCase();
  const query = req.query.q?.toLowerCase();

  if (!code) return res.status(400).json({ error: "Missing country code" });

  const country = countriesEn.find((c) => c.code === code);
  if (!country || !country.data) return res.status(404).json({ error: "Country not found" });

  let universities = Object.keys(country.data);
  if (query) {
    universities = universities.filter((u) => u.toLowerCase().includes(query));
  }

  res.json(universities.slice(0, 1000));
});

// Arabic countries list
app.get("/api/countriesar", (req, res) => {
  const query = req.query.q?.toLowerCase() || "";
  const results = countriesAr
    .filter((country) => country.name.toLowerCase().includes(query))
    .map((country) => ({
      code: country.code,
      name: country.name,
    }));
  res.json(results);
});

// /Arabic universities by country
app.get("/api/universitiesar", (req, res) => {
  const code = req.query.country?.toUpperCase();
  const query = req.query.q?.toLowerCase();

  if (!code) return res.status(400).json({ error: "Missing country code" });

  const country = countriesAr.find((c) => c.code === code);
  if (!country || !country.data) return res.status(404).json({ error: "Country not found" });

  let universities = Object.keys(country.data);
  if (query) {
    universities = universities.filter((u) => u.toLowerCase().includes(query));
  }

  res.json(universities.slice(0, 1000));
});


// language  English API – search in keys
const languagesAr = require('./data/alllanguages-ar.json');

// English endpoint — searches by key
app.get('/api/languages', (req, res) => {
  const query = req.query.q?.toLowerCase().trim() || "";
  const results = Object.keys(languagesAr)
    .filter(key => key.toLowerCase().includes(query))
    .map(key => key); // return only English values
  res.json(results.slice(0, 1000));
});

// Arabic endpoint — searches by value
app.get('/api/languagesar', (req, res) => {
  const query = req.query.q?.toLowerCase().trim() || "";
  const results = Object.entries(languagesAr)
    .filter(([_, value]) => value.toLowerCase().includes(query))
    .map(([_, value]) => value); // return only Arabic values
  res.json(results.slice(0, 1000));
});



//GET /api/world-countries

const worldData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data", "countries+cities.json"), "utf8")
);

app.get("/api/world-countries", (req, res) => {
  const countries = worldData.map((entry) => entry.country);
  res.json(countries);
});

//GET /api/cities?country=CountryName

app.get("/api/cities", (req, res) => {
  const { country } = req.query;
  if (!country) {
    return res.status(400).json({ error: "Missing country query param" });
  }

  const match = worldData.find((entry) => entry.country.toLowerCase() === country.toLowerCase());
  if (!match) {
    return res.status(404).json({ error: "Country not found" });
  }

  res.json(match.cities);
});


// Load organization + certifications JSON
const certificationsData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "organization_certifications.json"), "utf8")
);

// ✅ Endpoint to get all organization names
app.get("/api/organizations", (req, res) => {
  const names = certificationsData.map((org) => org.organization_name);
  res.json(names);
});

// ✅ Endpoint to get certifications by organization name
app.get("/api/certifications", (req, res) => {
  const orgName = req.query.organization_name;
  if (!orgName) {
    return res.status(400).json({ error: "organization_name is required" });
  }

  const org = certificationsData.find((item) => item.organization_name === orgName);
  if (!org) {
    return res.status(404).json({ error: "Organization not found" });
  }

  res.json(org.name);
});


// ✅ Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
