const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
app.use(cors());
app.use(express.json()); // Middleware to parse JSON

// ✅ HARDCODE YOUR OPENAI KEY HERE (safe only for local development)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ;

// Load JSON data files
const jobTitles = JSON.parse(
  fs.readFileSync(path.join(__dirname, "job-titles.json"), "utf-8")
);

const jobTitlesAr = JSON.parse(
  fs.readFileSync(path.join(__dirname, "job-titles-arabic.json"), "utf-8")
);
const skills = JSON.parse(
  fs.readFileSync(path.join(__dirname, "skills.json"), "utf-8")
);
const countriesWithUniversities = JSON.parse(
  fs.readFileSync(path.join(__dirname, "countries_with_universities_cleaned.json"), "utf-8")
);
const specializations = JSON.parse(
  fs.readFileSync(path.join(__dirname, "all_specializations.json"), "utf-8")
);

// 🔍 Job titles search
app.get("/api/job-titles", (req, res) => {
  const query = req.query.q?.toLowerCase() || "";
  const matches = Object.keys(jobTitles)
    .filter((title) => title.toLowerCase().includes(query))
    .slice(0, 1000);
  res.json(matches);
});

app.get("/api/job-titlesar", (req, res) => {
  const query = req.query.q?.toLowerCase() || "";

  const matches = Object.values(jobTitlesAr)
    .map((title) => title.trim())
    .filter((title) => title.toLowerCase().includes(query))
    .slice(0, 1000);

  res.json(matches);
});

// 🔍 Skills search
app.get("/api/skills", (req, res) => {
  const query = req.query.q?.toLowerCase() || "";
  const skillList = Array.isArray(skills) ? skills : Object.keys(skills);

  const matches = skillList
    .filter((skill) => skill.toLowerCase().includes(query))
    .slice(0, 1000);

  res.json(matches);
});

// 🌍 Countries search
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

// 🎓 Universities search
app.get("/api/universities", (req, res) => {
  const countryCode = req.query.country?.toUpperCase();
  const query = req.query.q?.toLowerCase();

  if (!countryCode && !query) {
    return res.status(400).json({
      error: "Please provide a 'country' (ISO code) or a 'q' parameter.",
    });
  }

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
        .slice(0, 1000);
    }

    return res.json(universities);
  }

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

// ✅ Specializations search
app.get("/api/specializations", (req, res) => {
  const query = req.query.q?.toLowerCase() || "";
  const list = specializations.specializations || [];

  const results = list
    .filter((item) => item.toLowerCase().includes(query))
    .slice(0, 1000);

  res.json(results);
});

// 🌍 Arabic Countries search
app.get("/api/countriesar", (req, res) => {
  const query = req.query.q?.toLowerCase() || "";
  const matches = arabicCountriesWithUniversities
    .filter((country) => country.name.toLowerCase().includes(query))
    .map((country) => ({
      code: country.code.toUpperCase(),
      name: country.name,
    }));

  res.json(matches);
});

// 🎓 Arabic Universities search
app.get("/api/universitiesar", (req, res) => {
  const countryCode = req.query.country?.toUpperCase();
  const query = req.query.q?.toLowerCase();

  if (!countryCode && !query) {
    return res.status(400).json({
      error: "يرجى تزويدنا بمعرّف الدولة (country) أو اسم الجامعة (q).",
    });
  }

  if (countryCode) {
    const country = arabicCountriesWithUniversities.find((c) => c.code === countryCode);

    if (!country || !country.data) {
      return res
        .status(404)
        .json({ error: "لم يتم العثور على الدولة أو لا تحتوي على جامعات." });
    }

    let universities = Object.keys(country.data || {});
    if (query) {
      universities = universities
        .filter((u) => u.toLowerCase().includes(query))
        .slice(0, 1000);
    }

    return res.json(universities);
  }

  if (query) {
    const allUniversities = arabicCountriesWithUniversities.flatMap((country) =>
      Object.keys(country.data || {}).filter((u) =>
        u.toLowerCase().includes(query)
      )
    );
    const unique = [...new Set(allUniversities)].slice(0, 15);
    return res.json(unique);
  }
});


// 🌍 Translate resume using OpenAI
app.post("/api/translate-resume", async (req, res) => {
  const { resume, targetLanguage } = req.body;

  if (!resume || !targetLanguage) {
    return res.status(400).json({ error: "Missing resume or targetLanguage" });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "user",
            content: `Translate this resume to ${targetLanguage} and return valid JSON only:\n${JSON.stringify(resume)}`,
          },
        ],
        temperature: 0.3,
      }),
    });

    const result = await response.json();

    if (result.choices?.[0]?.message?.content) {
      const translated = JSON.parse(result.choices[0].message.content);
      return res.json(translated);
    } else {
      return res.status(500).json({ error: "Translation failed", details: result });
    }
  } catch (error) {
    console.error("Translation error:", error);
    return res.status(500).json({ error: "Internal server error", message: error.message });
  }
});

// ✅ Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌐 Server running on http://localhost:${PORT}`);
});
