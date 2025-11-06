const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");

const TOKEN_PATH = path.join(__dirname, "../config/google-tokens.json");

// 🔹 Pehle tokens.json check karo
let tokens = null;
if (fs.existsSync(TOKEN_PATH)) {
  tokens = JSON.parse(fs.readFileSync(TOKEN_PATH));
}

// 🔹 OAuth client (for user authorization)
const oAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.REDIRECT_URI
);

// Agar tokens file mil gayi, use set kar do
if (tokens) {
  oAuth2Client.setCredentials(tokens);
  console.log("✅ Using saved tokens for Google Calendar API");
} else {
  console.warn("⚠️ No saved tokens found. Run /google/auth to authorize first.");
}

// 🔹 Calendar client create
const calendar = google.calendar({ version: "v3", auth: oAuth2Client });

module.exports = calendar;
