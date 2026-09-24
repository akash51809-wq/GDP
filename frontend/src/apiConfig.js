// In development with separate Vite server (localhost:5173), point to backend at localhost:3001.
// In production on Render (or any deployed domain), always use "" (relative URL) so all calls
// automatically hit the live backend on the current domain without depending on stale VITE_API_URL settings.
export const API = import.meta.env.DEV ? "http://localhost:3001" : "";
