import { google } from "googleapis";
import { getAuthenticatedClient } from "./googleAuth.js";

export async function getGmailClient() {
  const auth = await getAuthenticatedClient();
  if (!auth) {
    throw new Error("Gmail API is not authenticated. Please authorize Google account via /api/google/auth-url first.");
  }
  return google.gmail({ version: "v1", auth });
}

function makeRawEmail({ to, from, subject, bodyHtml, bodyText }) {
  const boundary = "__boundary_gdp__";
  const emailLines = [
    `To: ${to}`,
    from ? `From: ${from}` : "",
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    bodyText || "",
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    bodyHtml || bodyText || "",
    "",
    `--${boundary}--`
  ].filter(Boolean);

  const raw = Buffer.from(emailLines.join("\r\n"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return raw;
}

/**
 * Send email notification via Gmail API
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} [options.bodyHtml] - HTML message
 * @param {string} [options.bodyText] - Plain text message
 */
export async function sendEmail({ to, subject, bodyHtml, bodyText, from }) {
  const gmail = await getGmailClient();
  const raw = makeRawEmail({ to, from, subject, bodyHtml, bodyText });

  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw }
  });

  return res.data;
}
