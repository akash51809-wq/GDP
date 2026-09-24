import { google } from "googleapis";
import { Readable } from "node:stream";
import { getAuthenticatedClient } from "./googleAuth.js";

function bufferToStream(buffer) {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

export async function getDriveClient() {
  const auth = await getAuthenticatedClient();
  if (!auth) {
    throw new Error("Google Drive is not authenticated. Please authorize Google account via /api/google/auth-url first.");
  }
  return google.drive({ version: "v3", auth });
}

/**
 * Uploads a JPG/JPEG image to Google Drive
 * @param {Object} options
 * @param {string} options.fileName - e.g. "ticket_12345.jpg"
 * @param {Buffer} options.fileBuffer - Image buffer
 * @param {string} [options.mimeType="image/jpeg"]
 * @param {string} [options.folderId] - Target Google Drive folder ID
 */
export async function uploadJpgImage({ fileName, fileBuffer, mimeType = "image/jpeg", folderId }) {
  const drive = await getDriveClient();

  const targetFolder = folderId || process.env.GOOGLE_DRIVE_FOLDER_ID;
  const fileMetadata = {
    name: fileName || `image_${Date.now()}.jpg`,
    parents: targetFolder ? [targetFolder] : []
  };

  const media = {
    mimeType,
    body: bufferToStream(fileBuffer)
  };

  const response = await drive.files.create({
    requestBody: fileMetadata,
    media,
    fields: "id, name, webViewLink, webContentLink, thumbnailLink, mimeType"
  });

  return response.data;
}

/**
 * Creates or retrieves a folder by name in Google Drive
 */
export async function getOrCreateFolder(folderName = "GDP-Images") {
  const drive = await getDriveClient();

  const listResponse = await drive.files.list({
    q: `mimeType = 'application/vnd.google-apps.folder' and name = '${folderName}' and trashed = false`,
    fields: "files(id, name)",
    spaces: "drive"
  });

  if (listResponse.data.files && listResponse.data.files.length > 0) {
    return listResponse.data.files[0];
  }

  const folderMetadata = {
    name: folderName,
    mimeType: "application/vnd.google-apps.folder"
  };

  const folder = await drive.files.create({
    requestBody: folderMetadata,
    fields: "id, name"
  });

  return folder.data;
}
