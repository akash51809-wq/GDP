// In production on Render (unified single-service), API calls go to the same origin ("/api/...")
// In development, it points to "http://localhost:3001" or VITE_API_URL
export const API =
  (import.meta.env.VITE_API_URL || "").trim() ||
  (import.meta.env.PROD ? "" : "http://localhost:3001");
