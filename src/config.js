/**
 * API base URL for backend requests.
 * Default: https://verifeye-app.onrender.com
 * Override: set VITE_API_URL in .env (e.g. "" for local Vite proxy)
 */
export const API_BASE = typeof import.meta.env.VITE_API_URL === 'string' ? import.meta.env.VITE_API_URL : 'https://verifeye-app.onrender.com'
