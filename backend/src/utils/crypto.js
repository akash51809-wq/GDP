import crypto from "node:crypto";

/**
 * Robust encryption/decryption module using AES-256-GCM.
 * Protects sensitive tokens (OAuth refresh tokens, SMTP passwords, API keys) at rest in the database.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits recommended for GCM
const SALT = "gdp-secure-storage-salt-v1";

// Derive 32-byte key from ENCRYPTION_KEY or SESSION_SECRET or fallback
function getEncryptionKey() {
  const secret = process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET || "gdp-fallback-secret-key-32-chars-long";
  return crypto.scryptSync(secret, SALT, 32);
}

/**
 * Encrypt a plaintext string into a combined format: ivHex:authTagHex:encryptedHex
 * @param {string} text - Plain text to encrypt
 * @returns {string} - Encrypted payload with IV and auth tag
 */
export function encrypt(text) {
  if (!text || typeof text !== "string") return text;
  // If already encrypted, don't double encrypt
  if (/^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/i.test(text)) {
    return text;
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypt a combined payload (ivHex:authTagHex:encryptedHex) back to plaintext
 * @param {string} cipherText - The encrypted payload
 * @returns {string} - Decrypted plaintext or original string if not encrypted
 */
export function decrypt(cipherText) {
  if (!cipherText || typeof cipherText !== "string") return cipherText;

  const parts = cipherText.split(":");
  if (parts.length !== 3) {
    // String is not in encrypted format (likely legacy plaintext), return as-is
    return cipherText;
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  if (ivHex.length !== IV_LENGTH * 2 || authTagHex.length !== 32) {
    return cipherText;
  }

  try {
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    console.error("Decryption failed (key mismatch or corrupted data):", err.message);
    return "";
  }
}

/**
 * Masks a secret string (e.g. for display in UI or logs)
 * Returns '••••••••' or masks except last 4 chars
 */
export function maskSecret(secret, visibleChars = 0) {
  if (!secret || typeof secret !== "string") return "";
  if (visibleChars > 0 && secret.length > visibleChars) {
    return "•".repeat(Math.max(4, secret.length - visibleChars)) + secret.slice(-visibleChars);
  }
  return "••••••••";
}
