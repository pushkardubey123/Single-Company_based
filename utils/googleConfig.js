const { google } = require("googleapis");
require("dotenv").config();

const oAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.REDIRECT_URI
);

// 1. Credentials set karein
oAuth2Client.setCredentials({
  access_token: process.env.GOOGLE_ACCESS_TOKEN,
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN, // Ye initially .env se aayega
  scope: "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events",
  token_type: "Bearer",
});

// 2. TOKEN UPDATE LISTENER (Ye naya code add karein)
// Jab bhi access token expire hoga, googleapis library automatically refresh karegi.
// Ye event tab trigger hoga jab naya access token ya refresh token milega.
oAuth2Client.on('tokens', (tokens) => {
  if (tokens.refresh_token) {
    // IMPORTANT: Agar naya refresh token mila hai, toh use Database ya .env mein update karein!
    console.log("New Refresh Token received:", tokens.refresh_token);
    
    // Yahan code likhein naye refresh token ko DB mein save karne ka.
    // Example: updateAdminToken(tokens.refresh_token);
    // Kyunki agar aapne naya wala save nahi kiya, toh next restart pe purana wala load hoga jo expire ho chuka hoga.
  }
  
  if (tokens.access_token) {
    console.log("Access token refreshed automatically.");
    // Optional: Access token ko bhi save kar sakte hain taaki next request fast ho.
    oAuth2Client.setCredentials(tokens);
  }
});

const calendar = google.calendar({
  version: "v3",
  auth: oAuth2Client,
});

console.log("Google Calendar initialized");

module.exports = calendar;