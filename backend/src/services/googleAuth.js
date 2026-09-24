import { google } from "googleapis";
import { Settings } from "../models/Settings.js";
import { isDbConnected } from "../db.js";

const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/gmail.send"
];

export function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3001/api/google/callback";

  if (!clientId || !clientSecret) {
    return null;
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function generateGoogleAuthUrl() {
  const oauth2Client = getOAuth2Client();
  if (!oauth2Client) {
    throw new Error("Google Client ID and Client Secret are not configured.");
  }

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES
  });
}

export async function handleGoogleCallback(code) {
  const oauth2Client = getOAuth2Client();
  if (!oauth2Client) {
    throw new Error("Google Client ID and Client Secret are not configured.");
  }

  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  if (tokens.refresh_token && isDbConnected()) {
    try {
      await Settings.findOneAndUpdate(
        { key: "global" },
        {
          $set: {
            googleRefreshToken: tokens.refresh_token,
            googleConnected: true,
            googleConnectedAt: new Date()
          }
        },
        { upsert: true, returnDocument: "after" }
      );
    } catch (err) {
      console.error("Error saving Google refresh token:", err);
    }
  }

  return tokens;
}

export async function getAuthenticatedClient() {
  const oauth2Client = getOAuth2Client();
  if (!oauth2Client) return null;

  let refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!refreshToken && isDbConnected()) {
    try {
      const settings = await Settings.findOne({ key: "global" }).lean();
      if (settings?.googleRefreshToken) {
        refreshToken = settings.googleRefreshToken;
      }
    } catch (err) {
      console.error("Error retrieving Google refresh token:", err);
    }
  }

  if (!refreshToken) {
    return null;
  }

  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return oauth2Client;
}

export async function getGoogleStatus() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const configured = Boolean(clientId && clientSecret);
  const client = await getAuthenticatedClient();

  return {
    configured,
    connected: Boolean(client),
    driveReady: Boolean(client),
    gmailReady: Boolean(client)
  };
}
