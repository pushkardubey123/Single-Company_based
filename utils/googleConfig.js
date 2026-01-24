const { google } = require("googleapis");
require("dotenv").config();

const oAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.REDIRECT_URI
);

oAuth2Client.setCredentials({
  access_token: process.env.GOOGLE_ACCESS_TOKEN,
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  scope: "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events",
  token_type: "Bearer",
});

const calendar = google.calendar({
  version: "v3",
  auth: oAuth2Client,
});

console.log("Google Calendar initialized using environment tokens");

module.exports = calendar;
