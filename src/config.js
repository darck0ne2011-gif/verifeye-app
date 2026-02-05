/**
 * API base URL for backend requests.
 * - Local dev: '' (uses Vite proxy to /api)
 * - Production: VITE_API_URL or fallback to Render backend
 */
export const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://verifeye-app.onrender.com' : '')
