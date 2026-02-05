/**
 * API base URL for backend requests.
 * - Local dev: '' (uses Vite proxy to /api)
 * - Production: set VITE_API_URL in .env (e.g. https://your-api.onrender.com)
 */
export const API_BASE = import.meta.env.VITE_API_URL || ''
